import { Injectable, Logger, OnModuleDestroy, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageEnginePort } from '../upload/domain/ports/storage-engine.port';
import {
  BAIJIAYUN_HOST,
  COURSEWARE_SOURCE_MODES,
  CoursewareProvider,
  CoursewareSourceMode,
  OFFICE_PREVIEW_EXTS,
  SHENGTONG_HOST,
  contentDisposition,
  fileExtOf,
  mirrorKeyOf,
  parseHttpsUrl,
  providerOf,
  safeFilename,
  shouldUseMirror,
} from './domain/courseware-source.policy';
import {
  HealthMap,
  ProbeOutcome,
  ProviderHealth,
  applyRound,
  initialHealth,
} from './domain/courseware-health.monitor';

export const SOURCE_MODE_SETTING_KEY = 'courseware.sourceMode';

/** 固定的探测样本：已确认在备份中的盛通文件、常用的百家云白板。运行中还会加入老师最近打开过的链接 */
const SEED_SAMPLES: Record<CoursewareProvider, string[]> = {
  shengtong: [
    `https://${SHENGTONG_HOST}/course/coverOrIcon//16732473761881.jpg`,
    `https://${SHENGTONG_HOST}/course/publicMaterial/1670209414069`,
    `https://${SHENGTONG_HOST}/course/ppt/uaro%E4%B8%80%E6%9C%9F%E7%AC%AC1%E8%AF%BE%E5%86%B0%E7%B3%95.pptx`,
    `https://${SHENGTONG_HOST}/3/2025-03-01/document/1740834516929-0-%E7%AC%AC1%E8%AF%BE-C%2B%2B%E5%9F%BA%E6%9C%AC%E6%A1%86%E6%9E%B6%20-%20%E8%AF%BE%E4%BB%B6.pptx`,
    `https://${SHENGTONG_HOST}/course/ppt/1681260286706Day2.pptx`,
    `https://${SHENGTONG_HOST}/course/ppt/%E9%93%B2%E8%BD%A6.pptx`,
    `https://${SHENGTONG_HOST}/course/ppt/1669982669193%E7%94%B5%E5%8A%A8%E6%8A%95%E7%9F%B3%E8%BD%A6.pptx`,
    `https://${SHENGTONG_HOST}/course/ppt/%E8%A2%8B%E9%BC%A0.pptx`,
  ],
  baijiayun: ['516587', '193299', '674475', '677507', '34822', '136952', '142529', '41486'].map(
    (id) => `https://${BAIJIAYUN_HOST}/0baijiacloud/live_ppt/${id}/${id}_ppt_html/index.html`,
  ),
};

const SAMPLES_PER_ROUND = 6;
const RECENT_LIMIT = 100;
const PROBE_TIMEOUT_MS = 8000;
const MIRROR_HIT_TTL_MS = 10 * 60 * 1000;
const MIRROR_MISS_TTL_MS = 2 * 60 * 1000;
const DOWNLOAD_LINK_TTL_S = 10 * 60;
const PREVIEW_LINK_TTL_S = 3 * 60 * 60;

export type ResolvePurpose = 'download' | 'preview';

export interface ResolveInput {
  purpose: ResolvePurpose;
  downloadUrl?: string;
  pptUrl?: string;
  /** 课件文件名 (pptFileName)，用于下载文件名和判断格式 */
  filename?: string;
}

export interface ResolveResult {
  /** origin = 原平台；mirror = 自有备份；unavailable = 原平台故障且没有备份 */
  source: 'origin' | 'mirror' | 'unavailable';
  /** iframe = 直接嵌入 url；office = 用 Office 在线预览嵌入；download = 只能下载；none = 没有可用地址 */
  viewer?: 'iframe' | 'office' | 'download' | 'none';
  url: string;
  message?: string;
}

export type ProbeFn = (url: string) => Promise<ProbeOutcome>;

async function defaultProbe(url: string): Promise<ProbeOutcome> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return res.ok ? { ok: true } : { ok: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    const name = (e as { name?: string })?.name || 'error';
    return { ok: false, reason: name === 'TimeoutError' ? 'timeout' : name };
  }
}

function officeViewerUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

/**
 * 课件来源服务：决定一次「下载 / 在线看」该用原平台还是自有备份，并定时探测原平台是否可用。
 */
@Injectable()
export class CoursewareSourceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('CoursewareSource');
  private health: HealthMap = { shengtong: initialHealth(), baijiayun: initialHealth() };
  private mode: CoursewareSourceMode = 'auto';
  private modeLoaded = false;
  private readonly recent: Record<CoursewareProvider, string[]> = { shengtong: [], baijiayun: [] };
  private readonly mirrorCache = new Map<string, { exists: boolean; at: number }>();
  private timer: NodeJS.Timeout | null = null;
  private probing: Promise<void> | null = null;
  private probeFn: ProbeFn = defaultProbe;
  private now: () => number = () => Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageEnginePort,
  ) {}

  /** 测试用：替换探测函数和时钟 */
  useTestDoubles(doubles: { probe?: ProbeFn; now?: () => number }) {
    if (doubles.probe) this.probeFn = doubles.probe;
    if (doubles.now) this.now = doubles.now;
  }

  probeEnabled(): boolean {
    const flag = (process.env.COURSEWARE_PROBE || '').trim().toLowerCase();
    if (flag === 'on') return true;
    if (flag === 'off') return false;
    return process.env.STORAGE_ENGINE === 'oss';
  }

  private intervalMs(): number {
    const minutes = Number(process.env.COURSEWARE_PROBE_INTERVAL_MIN);
    return (Number.isFinite(minutes) && minutes >= 1 ? minutes : 10) * 60 * 1000;
  }

  onModuleInit() {
    if (!this.probeEnabled()) return;
    // 启动后稍等再测，避免拖慢启动
    this.schedule(15 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delayMs: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.probeNow().finally(() => {
        // 有平台处在「疑似故障」(已出现故障轮但尚未翻转) 时 1 分钟后复测，尽快确认
        const suspect = (Object.values(this.health) as ProviderHealth[]).some(
          (h) => h.consecutiveDown > 0 && h.state !== 'down',
        );
        this.schedule(suspect ? 60 * 1000 : this.intervalMs());
      });
    }, delayMs);
    this.timer.unref?.();
  }

  // ---------------------------------------------------------------- 模式
  async getMode(): Promise<CoursewareSourceMode> {
    if (!this.modeLoaded) {
      try {
        const row = await this.prisma.systemSetting.findUnique({ where: { key: SOURCE_MODE_SETTING_KEY } });
        const value = row?.value as CoursewareSourceMode | undefined;
        if (value && COURSEWARE_SOURCE_MODES.includes(value)) this.mode = value;
        this.modeLoaded = true;
      } catch (e) {
        this.logger.warn(`读取课件来源设置失败，按 auto 处理: ${(e as Error).message}`);
      }
    }
    return this.mode;
  }

  async setMode(mode: string, userId?: string): Promise<CoursewareSourceMode> {
    if (!COURSEWARE_SOURCE_MODES.includes(mode as CoursewareSourceMode)) {
      throw new BadRequestException(`课件来源只能是 ${COURSEWARE_SOURCE_MODES.join(' / ')}`);
    }
    const value = mode as CoursewareSourceMode;
    await this.prisma.systemSetting.upsert({
      where: { key: SOURCE_MODE_SETTING_KEY },
      update: { value, updatedBy: userId || null },
      create: { key: SOURCE_MODE_SETTING_KEY, value, updatedBy: userId || null },
    });
    this.mode = value;
    this.modeLoaded = true;
    this.logger.log(`课件来源已改为 ${value} (操作人 ${userId || '未知'})`);
    return value;
  }

  // ---------------------------------------------------------------- 探测
  private remember(provider: CoursewareProvider, url: string) {
    const list = this.recent[provider];
    const i = list.indexOf(url);
    if (i >= 0) list.splice(i, 1);
    list.unshift(url);
    if (list.length > RECENT_LIMIT) list.length = RECENT_LIMIT;
  }

  private samplesFor(provider: CoursewareProvider): string[] {
    const pool = [...new Set([...this.recent[provider].slice(0, 30), ...SEED_SAMPLES[provider]])];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, SAMPLES_PER_ROUND);
  }

  /** 立即探测一轮 (并发调用会合并为同一轮) */
  probeNow(): Promise<void> {
    if (!this.probing) {
      this.probing = this.runProbeRound().finally(() => {
        this.probing = null;
      });
    }
    return this.probing;
  }

  private async runProbeRound() {
    for (const provider of ['shengtong', 'baijiayun'] as CoursewareProvider[]) {
      const samples = this.samplesFor(provider);
      const outcomes = await Promise.all(samples.map((u) => this.probeFn(u)));
      const { next, changed } = applyRound(this.health[provider], outcomes, new Date(this.now()));
      this.health[provider] = next;
      if (changed) void this.alert(provider, next);
    }
  }

  private async alert(provider: CoursewareProvider, h: ProviderHealth) {
    const name = provider === 'shengtong' ? '盛通 (课件下载)' : '百家云 (在线白板)';
    const mode = await this.getMode();
    const text =
      h.state === 'down'
        ? `【课件备份】${name} 连续探测失败 (${h.lastRound?.fail}/${h.lastRound?.samples}，${h.lastFailures.slice(0, 3).join('、')})。` +
          (mode === 'auto' ? '系统已自动改用自有备份。' : `当前课件来源为手动「${mode}」，未自动切换。`)
        : `【课件备份】${name} 已恢复正常${mode === 'auto' ? '，系统已切回原平台' : ''}。`;
    this.logger.warn(text);
    const hook = (process.env.ALERT_WEBHOOK_URL || '').trim();
    if (!hook) return;
    try {
      await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    } catch (e) {
      // webhook 地址里带 token，只记录错误类型
      this.logger.warn(`课件告警发送失败: ${(e as Error)?.name || 'error'}`);
    }
  }

  // ---------------------------------------------------------------- 备份
  private async isMirrored(key: string): Promise<boolean> {
    const hit = this.mirrorCache.get(key);
    const t = this.now();
    if (hit && t - hit.at < (hit.exists ? MIRROR_HIT_TTL_MS : MIRROR_MISS_TTL_MS)) return hit.exists;
    let exists = false;
    try {
      exists = await this.storage.exists(key);
    } catch (e) {
      this.logger.warn(`查询课件备份失败: ${(e as Error).message}`);
    }
    this.mirrorCache.set(key, { exists, at: t });
    if (this.mirrorCache.size > 5000) this.mirrorCache.clear();
    return exists;
  }

  private signMirror(key: string, filename: string, purpose: ResolvePurpose): string {
    // 文件类型由备份时写入的 Content-Type 决定 (OSS 不允许在签名链接里改写)，这里只决定文件名和打开方式。
    // 下载文件名优先用课件名；没有扩展名时补上 (盛通部分 PDF 的对象路径没有扩展名)
    const ext = fileExtOf(filename) || fileExtOf(key);
    const base = filename || safeFilename(key.split('/').pop() || '课件');
    const name = fileExtOf(base) || !ext ? base : `${base}.${ext}`;
    return this.storage.signedUrl(key, {
      expiresInSeconds: purpose === 'download' ? DOWNLOAD_LINK_TTL_S : PREVIEW_LINK_TTL_S,
      response: {
        contentDisposition: contentDisposition(purpose === 'download' ? 'attachment' : 'inline', name),
      },
    });
  }

  private async useMirrorFor(provider: CoursewareProvider): Promise<boolean> {
    return shouldUseMirror(await this.getMode(), this.health[provider].state === 'down');
  }

  private officePreviewEnabled(): boolean {
    return (process.env.COURSEWARE_OFFICE_PREVIEW || '').trim().toLowerCase() !== 'off';
  }

  // ---------------------------------------------------------------- 解析
  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const purpose: ResolvePurpose = input.purpose === 'preview' ? 'preview' : 'download';
    const downloadUrl = parseHttpsUrl(input.downloadUrl)?.toString() || '';
    const pptUrl = parseHttpsUrl(input.pptUrl)?.toString() || '';
    const filename = safeFilename(input.filename || '');
    const downloadProvider = providerOf(downloadUrl);
    if (downloadProvider) this.remember(downloadProvider, downloadUrl);
    if (providerOf(pptUrl) === 'baijiayun') this.remember('baijiayun', pptUrl);

    return purpose === 'download'
      ? this.resolveDownload(downloadUrl, filename)
      : this.resolvePreview(pptUrl, downloadUrl, filename);
  }

  private async resolveDownload(downloadUrl: string, filename: string): Promise<ResolveResult> {
    if (!downloadUrl) return { source: 'unavailable', viewer: 'none', url: '', message: '该课次没有可下载的课件' };
    // 不是盛通的链接：系统不认识，原样返回
    if (providerOf(downloadUrl) !== 'shengtong') return { source: 'origin', url: downloadUrl };
    if (!(await this.useMirrorFor('shengtong'))) return { source: 'origin', url: downloadUrl };

    const key = mirrorKeyOf(downloadUrl);
    if (key && (await this.isMirrored(key))) {
      return { source: 'mirror', url: this.signMirror(key, filename, 'download') };
    }
    if ((await this.getMode()) === 'mirror') {
      return { source: 'origin', url: downloadUrl, message: '该课件没有备份，仍使用盛通原链接' };
    }
    return {
      source: 'unavailable',
      viewer: 'none',
      url: downloadUrl,
      message: '盛通当前无法访问，且该课件没有备份',
    };
  }

  private async resolvePreview(pptUrl: string, downloadUrl: string, filename: string): Promise<ResolveResult> {
    // 1. 百家云白板可用：照常嵌入
    if (pptUrl && providerOf(pptUrl) !== 'baijiayun') return { source: 'origin', viewer: 'iframe', url: pptUrl };
    if (pptUrl && !(await this.useMirrorFor('baijiayun'))) return { source: 'origin', viewer: 'iframe', url: pptUrl };

    // 2. 白板不可用 (或没有白板)：改用课件源文件预览
    const ext = fileExtOf(filename) || fileExtOf(downloadUrl.split('?')[0]);
    const fileUrl = await this.previewFileUrl(downloadUrl, filename);
    if (!fileUrl) {
      return {
        source: 'unavailable',
        viewer: 'none',
        url: pptUrl || downloadUrl,
        message: pptUrl ? '百家云在线白板当前无法访问，且该课件没有备份' : '该课次没有在线课件',
      };
    }
    const source = fileUrl.source;
    if (ext === 'pdf' || ['png', 'jpg', 'jpeg'].includes(ext)) return { source, viewer: 'iframe', url: fileUrl.url };
    if (OFFICE_PREVIEW_EXTS.has(ext) && this.officePreviewEnabled()) {
      return { source, viewer: 'office', url: officeViewerUrl(fileUrl.url) };
    }
    const download = await this.resolveDownload(downloadUrl, filename);
    return {
      source: download.source,
      viewer: download.source === 'unavailable' ? 'none' : 'download',
      url: download.url,
      message: '该课件暂不支持在线预览，请下载后查看',
    };
  }

  /** 预览用的文件地址：盛通该用备份时用备份签名链接，否则用盛通原链接 */
  private async previewFileUrl(
    downloadUrl: string,
    filename: string,
  ): Promise<{ source: 'origin' | 'mirror'; url: string } | null> {
    if (!downloadUrl) return null;
    if (providerOf(downloadUrl) !== 'shengtong') return { source: 'origin', url: downloadUrl };
    const key = mirrorKeyOf(downloadUrl);
    const mirrored = !!key && (await this.isMirrored(key));
    if (await this.useMirrorFor('shengtong')) {
      if (mirrored) return { source: 'mirror', url: this.signMirror(key!, filename, 'preview') };
      return (await this.getMode()) === 'mirror' ? { source: 'origin', url: downloadUrl } : null;
    }
    return { source: 'origin', url: downloadUrl };
  }

  // ---------------------------------------------------------------- 状态
  async status() {
    const mode = await this.getMode();
    const effective = (p: CoursewareProvider) => (shouldUseMirror(mode, this.health[p].state === 'down') ? 'mirror' : 'origin');
    return {
      mode,
      probeEnabled: this.probeEnabled(),
      probeIntervalMinutes: this.intervalMs() / 60000,
      officePreview: this.officePreviewEnabled(),
      storageEngine: process.env.STORAGE_ENGINE || 'local',
      providers: {
        shengtong: { ...this.health.shengtong, effective: effective('shengtong') },
        baijiayun: { ...this.health.baijiayun, effective: effective('baijiayun') },
      },
    };
  }
}
