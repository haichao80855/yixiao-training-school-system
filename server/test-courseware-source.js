/**
 * 课件来源切换 (盛通 / 百家云原链接 <-> 自有 OSS 备份) 测试
 * 不依赖运行中的服务和数据库：用假的 Prisma 与内存存储。先 npm run build。
 */
const assert = require('assert');
const policy = require('./dist/modules/curriculum/domain/courseware-source.policy');
const monitor = require('./dist/modules/curriculum/domain/courseware-health.monitor');
const { CoursewareSourceService } = require('./dist/modules/curriculum/courseware-source.service');
const { AliyunOssStorageAdapter } = require('./dist/modules/upload/domain/adapters/aliyun-oss-storage.adapter');

const ST = 'https://public-prod-shengtong.oss-cn-zhangjiakou.aliyuncs.com';
const BJY = 'https://pro-img-brtm.baijiayun.com/0baijiacloud/live_ppt/193299/193299_ppt_html/index.html';
const PPTX = `${ST}/course/ppt/1676686561989%E7%AC%AC01%E8%8A%82-%E5%88%9D%E8%AF%86C%2B%2B.pptx`;
const PPTX_KEY = 'courseware/shengtong/course/ppt/1676686561989第01节-初识C++.pptx';
const PDF_NOEXT = `${ST}/course/publicMaterial/1670209414069`;
const NOT_MIRRORED = `${ST}/course/ppt/not-backed-up.pptx`;

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.stack}`);
    process.exitCode = 1;
  }
}

function fakePrisma() {
  const rows = new Map();
  return {
    rows,
    systemSetting: {
      findUnique: async ({ where }) => rows.get(where.key) || null,
      upsert: async ({ where, create, update }) => {
        const row = rows.has(where.key) ? { ...rows.get(where.key), ...update } : { ...create };
        rows.set(where.key, row);
        return row;
      },
    },
  };
}

function fakeStorage(keys) {
  const calls = [];
  return {
    calls,
    exists: async (k) => keys.includes(k),
    signedUrl: (k, opts) => {
      calls.push({ k, opts });
      return `https://mirror.example/${encodeURI(k)}?sig=1`;
    },
  };
}

const down = async () => ({ ok: false, reason: 'HTTP 403' });
const up = async () => ({ ok: true });

function makeService(mirroredKeys = [PPTX_KEY, 'courseware/shengtong/course/publicMaterial/1670209414069']) {
  const prisma = fakePrisma();
  const storage = fakeStorage(mirroredKeys);
  const svc = new CoursewareSourceService(prisma, storage);
  return { svc, prisma, storage };
}

async function setHealth(svc, probe, rounds = 2) {
  svc.useTestDoubles({ probe });
  for (let i = 0; i < rounds; i++) await svc.probeNow();
}

(async () => {
  console.log('课件来源策略');
  await test('盛通链接映射到备份 key，与备份脚本规则一致 (解码、合并连续斜杠)', () => {
    assert.strictEqual(policy.mirrorKeyOf(PPTX), PPTX_KEY);
    assert.strictEqual(
      policy.mirrorKeyOf(`${ST}/course/coverOrIcon//16732473761881.jpg`),
      'courseware/shengtong/course/coverOrIcon/16732473761881.jpg',
    );
    assert.strictEqual(policy.mirrorKeyOf(BJY), null);
    assert.strictEqual(policy.mirrorKeyOf('http://public-prod-shengtong.oss-cn-zhangjiakou.aliyuncs.com/a.pptx'), null);
    // URL 解析会消掉编码过的 ..，结果仍在备份前缀之内
    const dotted = policy.mirrorKeyOf(`${ST}/a/%2E%2E/%2E%2E/b.pptx`);
    assert.ok(dotted.startsWith('courseware/shengtong/') && !dotted.includes('..'));
    assert.strictEqual(policy.mirrorKeyOf('not a url'), null);
  });
  await test('备份 key 可还原为盛通链接', () => {
    const url = policy.originUrlOfMirrorKey(PPTX_KEY);
    assert.strictEqual(policy.mirrorKeyOf(url), PPTX_KEY);
    assert.ok(url.startsWith(ST));
  });
  await test('中文文件名的 Content-Disposition', () => {
    const v = policy.contentDisposition('attachment', '第01节-初识C++.pptx');
    assert.ok(v.startsWith('attachment; filename="'));
    assert.ok(v.includes("filename*=UTF-8''%E7%AC%AC01"));
    assert.ok(!/[^\x20-\x7e]/.test(v));
    assert.strictEqual(policy.safeFilename('../x/"a".pptx'), 'a.pptx');
  });

  console.log('健康状态机');
  const ok = { ok: true };
  const bad = { ok: false, reason: 'HTTP 403' };
  await test('首次正常即为 up，不算变化', () => {
    const r = monitor.applyRound(monitor.initialHealth(), [ok, ok, ok], new Date());
    assert.strictEqual(r.next.state, 'up');
    assert.strictEqual(r.changed, false);
  });
  await test('连续 2 轮故障才判定 down，并触发变化', () => {
    let h = monitor.applyRound(monitor.initialHealth(), [ok, ok, ok], new Date()).next;
    let r = monitor.applyRound(h, [bad, bad, bad], new Date());
    assert.strictEqual(r.next.state, 'up');
    r = monitor.applyRound(r.next, [bad, bad, ok], new Date());
    assert.strictEqual(r.next.state, 'down');
    assert.strictEqual(r.changed, true);
    h = r.next;
    r = monitor.applyRound(h, [ok, ok, ok], new Date());
    assert.strictEqual(r.next.state, 'down', '恢复也需要连续 2 轮');
    r = monitor.applyRound(r.next, [ok, ok, ok], new Date());
    assert.strictEqual(r.next.state, 'up');
    assert.strictEqual(r.changed, true);
  });
  await test('一半失败或样本不足不改变计数', () => {
    assert.strictEqual(monitor.judgeRound([ok, bad]), 'inconclusive');
    assert.strictEqual(monitor.judgeRound([ok, ok, bad, bad]), 'inconclusive');
  });

  console.log('下载');
  await test('原平台正常：用盛通原链接', async () => {
    const { svc } = makeService();
    await setHealth(svc, up, 1);
    const r = await svc.resolve({ purpose: 'download', downloadUrl: PPTX, filename: '第01节-初识C++.pptx' });
    assert.deepStrictEqual(r, { source: 'origin', url: PPTX });
  });
  await test('盛通故障且有备份：返回备份签名链接，带下载文件名', async () => {
    const { svc, storage } = makeService();
    await setHealth(svc, down);
    const r = await svc.resolve({ purpose: 'download', downloadUrl: PPTX, filename: '第01节-初识C++.pptx' });
    assert.strictEqual(r.source, 'mirror');
    const call = storage.calls.pop();
    assert.strictEqual(call.k, PPTX_KEY);
    assert.ok(call.opts.response.contentDisposition.startsWith('attachment'));
    assert.strictEqual(call.opts.response.contentType, undefined, 'OSS 不允许改写 Content-Type');
  });
  await test('没有扩展名的备份对象：下载文件名用课件名 (含扩展名)', async () => {
    const { svc, storage } = makeService();
    await setHealth(svc, down);
    await svc.resolve({ purpose: 'download', downloadUrl: PDF_NOEXT, filename: '冰糕.pdf' });
    const call = storage.calls.pop();
    assert.ok(call.opts.response.contentDisposition.includes(encodeURIComponent('冰糕.pdf')));
  });
  await test('盛通故障且没有备份：不可用', async () => {
    const { svc } = makeService();
    await setHealth(svc, down);
    const r = await svc.resolve({ purpose: 'download', downloadUrl: NOT_MIRRORED });
    assert.strictEqual(r.source, 'unavailable');
    assert.ok(r.message.includes('没有备份'));
  });
  await test('手动切到备份：有备份用备份，没备份退回原链接', async () => {
    const { svc, prisma } = makeService();
    await svc.setMode('mirror', 'u1');
    assert.strictEqual(prisma.rows.get('courseware.sourceMode').value, 'mirror');
    assert.strictEqual((await svc.resolve({ purpose: 'download', downloadUrl: PPTX })).source, 'mirror');
    const r = await svc.resolve({ purpose: 'download', downloadUrl: NOT_MIRRORED });
    assert.strictEqual(r.source, 'origin');
    assert.strictEqual(r.url, NOT_MIRRORED);
  });
  await test('手动固定原平台：即使探测为故障也不切换', async () => {
    const { svc } = makeService();
    await svc.setMode('origin');
    await setHealth(svc, down);
    assert.strictEqual((await svc.resolve({ purpose: 'download', downloadUrl: PPTX })).source, 'origin');
  });
  await test('非法模式被拒绝', async () => {
    const { svc } = makeService();
    await assert.rejects(() => svc.setMode('cloud'));
  });
  await test('设置从数据库读取 (重启后保持)', async () => {
    const { svc, prisma } = makeService();
    prisma.rows.set('courseware.sourceMode', { key: 'courseware.sourceMode', value: 'mirror' });
    assert.strictEqual(await svc.getMode(), 'mirror');
  });
  await test('不认识的链接原样返回', async () => {
    const { svc } = makeService();
    await setHealth(svc, down);
    const r = await svc.resolve({ purpose: 'download', downloadUrl: 'https://example.com/a.pptx' });
    assert.deepStrictEqual(r, { source: 'origin', url: 'https://example.com/a.pptx' });
  });

  console.log('在线看');
  await test('百家云正常：嵌入白板', async () => {
    const { svc } = makeService();
    await setHealth(svc, up, 1);
    const r = await svc.resolve({ purpose: 'preview', pptUrl: BJY, downloadUrl: PPTX, filename: 'a.pptx' });
    assert.deepStrictEqual(r, { source: 'origin', viewer: 'iframe', url: BJY });
  });
  await test('两个平台都故障：用 Office 预览备份文件', async () => {
    const { svc, storage } = makeService();
    await setHealth(svc, down);
    const r = await svc.resolve({ purpose: 'preview', pptUrl: BJY, downloadUrl: PPTX, filename: 'a.pptx' });
    assert.strictEqual(r.source, 'mirror');
    assert.strictEqual(r.viewer, 'office');
    assert.ok(r.url.startsWith('https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fmirror.example'));
    assert.ok(storage.calls.pop().opts.response.contentDisposition.startsWith('inline'));
  });
  await test('只有百家云故障：用 Office 预览盛通原文件', async () => {
    const { svc } = makeService();
    const probe = async (url) => (url.includes('baijiayun') ? { ok: false, reason: 'HTTP 404' } : { ok: true });
    await setHealth(svc, probe);
    const r = await svc.resolve({ purpose: 'preview', pptUrl: BJY, downloadUrl: PPTX, filename: 'a.pptx' });
    assert.strictEqual(r.source, 'origin');
    assert.strictEqual(r.viewer, 'office');
    assert.ok(r.url.includes(encodeURIComponent(PPTX)));
  });
  await test('PDF 直接嵌入', async () => {
    const { svc } = makeService();
    await setHealth(svc, down);
    const r = await svc.resolve({ purpose: 'preview', pptUrl: BJY, downloadUrl: PDF_NOEXT, filename: '冰糕.pdf' });
    assert.strictEqual(r.viewer, 'iframe');
    assert.strictEqual(r.source, 'mirror');
  });
  await test('关闭 Office 预览：提示下载', async () => {
    process.env.COURSEWARE_OFFICE_PREVIEW = 'off';
    try {
      const { svc } = makeService();
      await setHealth(svc, down);
      const r = await svc.resolve({ purpose: 'preview', pptUrl: BJY, downloadUrl: PPTX, filename: 'a.pptx' });
      assert.strictEqual(r.viewer, 'download');
      assert.strictEqual(r.source, 'mirror');
    } finally {
      delete process.env.COURSEWARE_OFFICE_PREVIEW;
    }
  });
  await test('都故障且没有备份：不可用', async () => {
    const { svc } = makeService();
    await setHealth(svc, down);
    const r = await svc.resolve({ purpose: 'preview', pptUrl: BJY, downloadUrl: NOT_MIRRORED, filename: 'a.pptx' });
    assert.strictEqual(r.source, 'unavailable');
    assert.strictEqual(r.viewer, 'none');
  });
  await test('探测会用到老师最近打开过的链接', async () => {
    const { svc } = makeService();
    const seen = [];
    svc.useTestDoubles({ probe: async (u) => (seen.push(u), { ok: true }) });
    await svc.resolve({ purpose: 'download', downloadUrl: NOT_MIRRORED });
    for (let i = 0; i < 20 && !seen.includes(NOT_MIRRORED); i++) await svc.probeNow();
    assert.ok(seen.includes(NOT_MIRRORED));
    assert.ok(seen.every((u) => u.startsWith('https://public-prod-shengtong') || u.startsWith('https://pro-img-brtm')));
  });
  await test('状态接口给出生效来源', async () => {
    const { svc } = makeService();
    await setHealth(svc, down);
    const s = await svc.status();
    assert.strictEqual(s.mode, 'auto');
    assert.strictEqual(s.providers.shengtong.state, 'down');
    assert.strictEqual(s.providers.shengtong.effective, 'mirror');
  });

  console.log('OSS 签名');
  await test('签名链接带上响应头参数', () => {
    const seen = [];
    const fake = { signatureUrl: (k, o) => (seen.push(o), `https://b.oss/${k}`) };
    const oss = new AliyunOssStorageAdapter(undefined, { write: fake, sign: fake });
    oss.signedUrl('courseware/shengtong/a.pptx', {
      expiresInSeconds: 600,
      response: { contentDisposition: 'inline; filename="a.pdf"' },
    });
    assert.deepStrictEqual(seen[0].response, { 'content-disposition': 'inline; filename="a.pdf"' });
    oss.signedUrl('photos/a.jpg', { expiresInSeconds: 600 });
    assert.strictEqual(seen[1].response, undefined, '不带 response 时保持原有签名参数');
  });

  console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
})();
