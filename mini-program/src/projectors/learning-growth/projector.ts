import type {
  LearningGrowthProjector,
  LessonGrowthQuery,
  LessonGrowthView,
  RadarDimension,
  LessonGrowthPhoto,
} from './types';
import type { GrowthQueryPort, GrowthCachePort, RawWorkbenchDto } from './ports';
import { mediaPipeline } from '../../services/media-pipeline';

export interface LearningGrowthProjectorOptions {
  queryPort: GrowthQueryPort;
  cachePort: GrowthCachePort;
  cacheTtlMs?: number;
}


/**
 * 由课次大纲 HTML 构建「课程内容与知识点大纲」：
 * 知识点提炼规则与家长端 parent-portal.service#keyPoints 一致 (段落 / 列表项 / 分号句号切分，2~60 字，最多 5 条)，
 * 保证老师在【看学情】预览到的与家长端「本节课学了什么」一致
 */
function buildCourseOutline(rawHtml: string | null | undefined): { points: string[]; html: string } {
  const html = typeof rawHtml === 'string' ? rawHtml.trim() : '';
  if (!html) return { points: [], html: '' };
  // rich-text 渲染前的基础清洗 (同家长端)：移除脚本 / 样式 / 内嵌对象、事件属性与 javascript: 链接
  const safeHtml = html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
  const points = safeHtml
    .replace(/<\/(p|li|h\d|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split(/[\n;；。]/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 2 && s.length <= 60)
    .slice(0, 5);
  return { points, html: safeHtml };
}

export class DefaultLearningGrowthProjector implements LearningGrowthProjector {
  private readonly queryPort: GrowthQueryPort;
  private readonly cachePort: GrowthCachePort;
  private readonly cacheTtlMs: number;

  constructor(options: LearningGrowthProjectorOptions) {
    this.queryPort = options.queryPort;
    this.cachePort = options.cachePort;
    this.cacheTtlMs = options.cacheTtlMs || 3 * 60 * 1000; // 默认 3 分钟
  }

  async projectLessonGrowth(
    queryInput: LessonGrowthQuery | { scheduleId: string; studentId: string; forceRefresh?: boolean }
  ): Promise<LessonGrowthView> {
    const scheduleId = queryInput.scheduleId;
    const studentId = queryInput.studentId;
    const forceRefresh = Boolean(queryInput.forceRefresh);
    const cacheKey = `growth_cache_${scheduleId}_${studentId}`;

    // 1. 检查本地短时缓存
    if (!forceRefresh) {
      const cached = this.cachePort.get<LessonGrowthView>(cacheKey);
      if (cached) {
        return {
          ...cached,
          source: 'cache_instant',
        };
      }
    }

    // 2. 网络拉取并投影
    try {
      const view = await this.fetchAndProject(scheduleId, studentId);
      this.cachePort.set(cacheKey, view, this.cacheTtlMs);
      return view;
    } catch (networkError) {
      console.warn('[LearningGrowthProjector] 网络拉取学情失败，尝试降级沙箱:', networkError);

      // 3. 降级兜底：尝试获取可能已过期的缓存
      const fallbackCached = this.cachePort.get<LessonGrowthView>(cacheKey);
      if (fallbackCached) {
        return {
          ...fallbackCached,
          source: 'degraded_fallback',
        };
      }

      // 4. 彻底离线且无缓存：返回安全占位空对象，阻断白屏
      return this.buildSafeFallbackView(scheduleId, studentId);
    }
  }

  evictGrowthCache(scheduleId: string): void {
    const prefix = `growth_cache_${scheduleId}_`;
    this.cachePort.clearByPrefix(prefix);
  }

  private async fetchAndProject(scheduleId: string, studentId: string): Promise<LessonGrowthView> {
    // 视角 A: 尝试获取专属家长端单课回执接口
    if (typeof this.queryPort.fetchParentSingleLesson === 'function') {
      try {
        const rawParent = await this.queryPort.fetchParentSingleLesson(scheduleId);
        if (rawParent && rawParent.lesson) {
          return this.mapFromParentSingleLesson(rawParent, scheduleId, studentId);
        }
      } catch {
        // 自动降级至工作台水化
      }
    }

    // 视角 B: 降级从教务工作台同构水化
    const wb = await this.queryPort.fetchScheduleWorkbench(scheduleId);
    return this.mapFromWorkbench(wb, scheduleId, studentId);
  }

  private mapFromParentSingleLesson(raw: any, scheduleId: string, studentId: string): LessonGrowthView {
    const lesson = raw.lesson || {};
    const ratingScore = Number(lesson.ratingScore) || 5.0;
    const score = Math.round(ratingScore * 19.6);
    const radar = this.computeRadarDimensions(ratingScore);
    const radarSvg = this.generateRadarSvgPoints(radar);
    const radarSvgDataUri = this.generateRadarSvgDataUri(radarSvg, radar);

    const photos: LessonGrowthPhoto[] = Array.isArray(lesson.photos)
      ? lesson.photos.map((p: any) => {
          const rawUrl = p.url || '';
          const canonical = mediaPipeline.canonicalizeUrl(rawUrl);
          return {
            url: canonical,
            thumbUrl: p.thumbUrl ? mediaPipeline.canonicalizeUrl(p.thumbUrl) : canonical,
          };
        })
      : [];

    const video = lesson.video?.videoUrl
      ? {
          videoUrl: mediaPipeline.canonicalizeUrl(lesson.video.videoUrl),
          coverUrl: lesson.video.coverUrl ? mediaPipeline.canonicalizeUrl(lesson.video.coverUrl) : undefined,
        }
      : undefined;

    return {
      studentId,
      studentName: raw.studentName || '学员',
      scheduleId,
      className: lesson.courseName || '综合精品课',
      dateText: lesson.dateFormatted || '2026-10-16',
      timeSlotText: lesson.timeSlot || '18:30 - 20:30',
      score,
      levelText: this.getScoreLevelText(score),
      performanceTag: lesson.performanceTag || '专注标兵',
      teacherComment: lesson.personalizedComment || '随堂实操表现优异，积极配合教学互动！',
      syllabusPoints: Array.isArray(lesson.syllabusPoints) && lesson.syllabusPoints.length > 0
        ? lesson.syllabusPoints
        : ['核心概念解析与实践', '随堂交互与逻辑思维拓展'],
      courseOutline: buildCourseOutline(lesson.studyContentHtml || lesson.studyContent),
      photos,
      video,
      badges: Array.isArray(lesson.badges) && lesson.badges.length > 0
        ? lesson.badges
        : [
            { name: '专注标兵', icon: 'star', desc: '整堂课程全神贯注' },
            { name: '逻辑先锋', icon: 'award', desc: '随堂难点迎刃而解' },
          ],
      radarDimensions: radar,
      radarSvgPolygonPoints: radarSvg,
      radarSvgDataUri,
      source: 'network_fresh',
      queriedAt: Date.now(),
    };
  }

  private mapFromWorkbench(wb: RawWorkbenchDto, scheduleId: string, studentId: string): LessonGrowthView {
    const schedule = wb.schedule || { id: scheduleId, className: '综合课程', date: '2026-10-16', startTime: '18:30', endTime: '20:30' };
    const students = wb.students || [];
    const targetStudent = students.find((s) => s.studentId === studentId) || {
      studentId,
      name: '学员',
      rating: 5.0,
      comment: '',
    };

    const ratingScore = Number(targetStudent.rating) || Number(wb.evaluationSummary?.overallRating) || 5.0;
    const score = Math.round(ratingScore * 19.6);
    const radar = this.computeRadarDimensions(ratingScore);
    const radarSvg = this.generateRadarSvgPoints(radar);
    const radarSvgDataUri = this.generateRadarSvgDataUri(radarSvg, radar);

    const isPersonalized = Boolean(
      targetStudent.hasPersonalEvaluation ||
      targetStudent.evaluatedAt ||
      (Array.isArray(targetStudent?.photos) && targetStudent.photos.length > 0) ||
      targetStudent.videoUrl
    );

    const photos: LessonGrowthPhoto[] = [];
    if (isPersonalized) {
      // 学员已有专属课评/特写：严格只使用学员自身相册，即使清空也绝不回退至全班公共相册
      if (Array.isArray(targetStudent?.photos)) {
        for (const p of targetStudent.photos) {
          if (p) {
            const canonical = mediaPipeline.canonicalizeUrl(p);
            photos.push({ url: canonical, thumbUrl: canonical });
          }
        }
      }
    } else if (Array.isArray(wb.evaluationSummary?.photoList)) {
      // 仅当学员无独立专属课评时，才使用全班公共相册
      for (const p of wb.evaluationSummary.photoList) {
        if (p) {
          const canonical = mediaPipeline.canonicalizeUrl(p);
          photos.push({ url: canonical, thumbUrl: canonical });
        }
      }
    }

    // 与家长端一致：只展示老师对该学员的专属评语。不再回退到课次公共点评或固定文案——
    // 家长端看不到那些文字，老师在【看学情】里却会把它当成已写给孩子的评语
    const comment =
      targetStudent.currentComment ||
      targetStudent.comment ||
      '暂未填写该学员的专属评语';

    const rawVideoUrl = isPersonalized
      ? (targetStudent?.videoUrl || '')
      : (targetStudent?.videoUrl || wb.evaluationSummary?.videoUrl || '');
    const canonicalVideoUrl = rawVideoUrl ? mediaPipeline.canonicalizeUrl(rawVideoUrl) : '';

    return {
      studentId,
      studentName: targetStudent.name || '学员',
      scheduleId,
      className: schedule.className,
      dateText: schedule.date,
      timeSlotText: schedule.timeRange || `${schedule.startTime}-${schedule.endTime}`,
      score,
      levelText: this.getScoreLevelText(score),
      performanceTag: targetStudent.performanceTag || (score >= 90 ? '专注标兵' : '进步之星'),
      teacherComment: comment,
      // 取课次真实大纲，不再使用固定的示例知识点
      syllabusPoints: buildCourseOutline(wb.evaluationSummary?.studyContent).points,
      courseOutline: buildCourseOutline(wb.evaluationSummary?.studyContent),
      photos,
      video: canonicalVideoUrl ? { videoUrl: canonicalVideoUrl } : undefined,

      badges: [
        { name: '专注标兵', icon: 'star', desc: '课堂互动积极高效' },
        { name: '实践达人', icon: 'zap', desc: '实操环节高质量闭环' },
        { name: '素养先锋', icon: 'shield', desc: '核心素养全面发展' },
      ],
      radarDimensions: radar,
      radarSvgPolygonPoints: radarSvg,
      radarSvgDataUri,
      source: 'network_fresh',
      queriedAt: Date.now(),
    };
  }

  /**
   * 纯数学 5 维雷达图折算算法
   * 维度: [专注力, 表达力, 逻辑力, 动手力, 合作力]
   */
  private computeRadarDimensions(baseRating: number): RadarDimension[] {
    const baseScore = Math.min(100, Math.round(baseRating * 19.6));
    // 依据基线评分做细微且符合教育规律的维度微差
    return [
      { key: 'focus', label: '专注力', score: Math.min(100, baseScore) },
      { key: 'expression', label: '表达力', score: Math.min(100, Math.max(60, baseScore - 3)) },
      { key: 'logic', label: '逻辑力', score: Math.min(100, Math.max(60, baseScore + 2)) },
      { key: 'practice', label: '动手力', score: Math.min(100, Math.max(60, baseScore + 1)) },
      { key: 'collaboration', label: '合作力', score: Math.min(100, Math.max(60, baseScore - 2)) },
    ];
  }

  /**
   * 原生 SVG 5 维正多边形顶点几何折算
   * 中心 (100, 100), 最大半径 R = 80
   * 顶点 0 (专注力) 朝正上方 (-π/2)
   */
  public generateRadarSvgPoints(dimensions: RadarDimension[]): string {
    const cx = 100;
    const cy = 100;
    const maxR = 80;
    const total = 5;

    const points: string[] = [];

    for (let i = 0; i < total; i++) {
      const dim = dimensions[i] || { score: 90 };
      const normalized = Math.max(10, Math.min(100, dim.score)) / 100;
      const r = maxR * normalized;
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / total;

      const x = Math.round((cx + r * Math.cos(angle)) * 10) / 10;
      const y = Math.round((cy + r * Math.sin(angle)) * 10) / 10;

      points.push(`${x},${y}`);
    }

    return points.join(' ');
  }

  /**
   * 兼容微信小程序原生 WXML <image> 矢量渲染的完整 SVG Data URI 编码生成器
   */
  public generateRadarSvgDataUri(points: string, dimensions?: RadarDimension[]): string {
    const coords = (points || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => {
        const [x, y] = p.split(',').map(Number);
        return { x: Number(x) || 100, y: Number(y) || 100 };
      });

    const circles = coords
      .map(
        (c) =>
          `<circle cx="${c.x}" cy="${c.y}" r="3.5" fill="%232563EB" stroke="%23FFFFFF" stroke-width="1.5" />`
      )
      .join('');

    const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
      <!-- 同心正五边形背景网格 (3 层: 33%, 66%, 100%) -->
      <polygon points="100,73.6 125,91.8 115.5,121.4 84.5,121.4 75,91.8" fill="none" stroke="%23E2E8F0" stroke-width="1" />
      <polygon points="100,47.2 150.2,83.7 131,142.8 69,142.8 49.8,83.7" fill="none" stroke="%23CBD5E1" stroke-width="1" />
      <polygon points="100,20 176.1,75.3 147,164.7 53,164.7 23.9,75.3" fill="none" stroke="%2394A3B8" stroke-width="1.5" />

      <!-- 5 条辐射中轴线 -->
      <line x1="100" y1="100" x2="100" y2="20" stroke="%23CBD5E1" stroke-width="1" stroke-dasharray="3,3" />
      <line x1="100" y1="100" x2="176.1" y2="75.3" stroke="%23CBD5E1" stroke-width="1" stroke-dasharray="3,3" />
      <line x1="100" y1="100" x2="147" y2="164.7" stroke="%23CBD5E1" stroke-width="1" stroke-dasharray="3,3" />
      <line x1="100" y1="100" x2="53" y2="164.7" stroke="%23CBD5E1" stroke-width="1" stroke-dasharray="3,3" />
      <line x1="100" y1="100" x2="23.9" y2="75.3" stroke="%23CBD5E1" stroke-width="1" stroke-dasharray="3,3" />

      <!-- 投影多边形数据层 (蓝色半透明填充 + 2.5px 边框) -->
      <polygon
        points="${points}"
        fill="rgba(37, 99, 235, 0.28)"
        stroke="%232563EB"
        stroke-width="2.5"
      />
      ${circles}
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svgXml)}`;
  }

  private getScoreLevelText(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 70) return 'B';
    return 'C';
  }

  private buildSafeFallbackView(scheduleId: string, studentId: string): LessonGrowthView {
    const radar = this.computeRadarDimensions(4.5);
    const radarSvg = this.generateRadarSvgPoints(radar);
    const radarSvgDataUri = this.generateRadarSvgDataUri(radarSvg, radar);
    return {
      studentId,
      studentName: '学员',
      scheduleId,
      className: '随堂课程',
      dateText: '2026-10-16',
      timeSlotText: '18:30 - 20:30',
      score: 88,
      levelText: 'A',
      performanceTag: '学习标兵',
      teacherComment: '随堂学习表现优异，课堂练习认真扎实！',
      syllabusPoints: ['重点知识掌握牢固'],
      courseOutline: { points: [], html: '' },
      photos: [],
      badges: [{ name: '学习之星', icon: 'star', desc: '课堂表现良好' }],
      radarDimensions: radar,
      radarSvgPolygonPoints: radarSvg,
      radarSvgDataUri,
      source: 'degraded_fallback',
      queriedAt: Date.now(),
    };
  }
}
