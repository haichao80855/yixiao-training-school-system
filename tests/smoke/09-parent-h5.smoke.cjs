/**
 * 冒烟 9：家长端 H5 走查与截图 (家长端 UI 改进计划第 0 期)。
 * - 用夹具造好课评、课表、课程、成长数据 (parent-fixtures.cjs)，用种子家长账号从登录页登录；
 * - 在 320 / 375 / 414 三种宽度下逐页截图到 test-results/parent-h5/<宽度>/，作为改版前后对照；
 * - 每页统计可见文字的最小字号、小于 12px 的文字数、小于 44px 的可点击元素数，写到 metrics.json；
 * - 硬性检查「文字 ≥ 12px」「可点击区域两边 ≥ 24px 且面积 ≥ 44×44」；PARENT_UI_STRICT=0 时只统计。
 * 需要先构建家长端：cd mini-program && npm run build:h5
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../../server/node_modules/@prisma/client');
const { runSmoke, check, BASE_URL } = require('./helpers.cjs');
const { PARENT, seedParentDemo } = require('./parent-fixtures.cjs');

const prisma = new PrismaClient();
const OUT = path.resolve(__dirname, '../../test-results/parent-h5');
const WIDTHS = [320, 375, 414];
// 第 1 期起默认硬性检查；PARENT_UI_STRICT=0 只统计不判失败 (例如拍改版前的基线)
const STRICT = process.env.PARENT_UI_STRICT !== '0';

/** 在页面里统计字号和点击区域 */
function measure() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
  };
  let minFont = Infinity;
  const small = [];
  for (const el of document.querySelectorAll('body *')) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    minFont = Math.min(minFont, size);
    if (size < 12) small.push(`${size.toFixed(1)}px「${el.textContent.trim().slice(0, 12)}」`);
  }
  const tiny = [];
  for (const el of document.querySelectorAll('[role="button"], button, a, uni-button, .p-tap')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    // p-hit-min 用 ::after 把点击区域撑到 88rpx：按伪元素和元素本身中较大的算
    const after = getComputedStyle(el, '::after');
    const aw = after.content && after.content !== 'none' && after.position === 'absolute' ? parseFloat(after.width) || 0 : 0;
    const ah = after.content && after.content !== 'none' && after.position === 'absolute' ? parseFloat(after.height) || 0 : 0;
    // 标准：两边都不小于 24px (WCAG 2.5.8)，且面积不小于 44×44 (苹果建议的点击尺寸)。
    // 例如课表一周 7 天的日期格在 320px 宽时只能做到 36×56，面积够大，算合格
    const w = Math.max(r.width, aw);
    const h = Math.max(r.height, ah);
    if (Math.min(w, h) < 23.5 || w * h < 43.5 * 43.5) tiny.push(`${Math.round(r.width)}×${Math.round(r.height)}「${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 10)}」`);
  }
  return { minFont: Number.isFinite(minFont) ? minFont : null, smallText: small.length, smallSamples: small.slice(0, 5), smallTargets: tiny.length, targetSamples: tiny.slice(0, 5) };
}

runSmoke('家长端 H5 走查与截图', async (s) => {
  const cleanup = await seedParentDemo(prisma);
  try {
    const page = s.page;
    // 家长端构建产物把接口地址写成线上域名 (.env.production)。测试里一律拦下，转给本地临时后端，
    // 绝不让请求打到线上；拦不住的外部请求直接中止。
    const PROD_ORIGINS = ['https://aiic.space', 'http://aiic.space'];
    let escaped = 0;
    const escapedUrls = [];
    // 模拟接口失败：设了 failNext 时，匹配的接口请求都返回 500，直到清空 failNext
    let failNext = null;
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      const url = req.url();
      const prod = PROD_ORIGINS.find((o) => url.startsWith(o));
      if (!prod) {
        if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return req.continue();
        escaped += 1;
        escapedUrls.push(url.slice(0, 120));
        return req.abort();
      }
      if (failNext && req.method() === 'GET' && failNext.test(url)) {
        return req.respond({ status: 500, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ message: '模拟服务异常' }) });
      }
      try {
        const headers = { ...req.headers() };
        delete headers.host;
        const res = await fetch(BASE_URL + url.slice(prod.length), { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
        const body = Buffer.from(await res.arrayBuffer());
        const outHeaders = {};
        res.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) outHeaders[k] = v; });
        outHeaders['access-control-allow-origin'] = '*';
        await req.respond({ status: res.status, headers: outHeaders, body });
      } catch (err) {
        await req.abort().catch(() => {});
      }
    });
    // 登录
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${s.url}/parent/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input');
    // uni 的输入框在页面初始化完成前输入的内容不会进到表单里：逐字输入，核对后不对就重输
    const fill = async (index, value) => {
      for (let i = 0; i < 5; i++) {
        const input = (await page.$$('input'))[index];
        await input.click({ clickCount: 3 });
        await page.keyboard.type(value, { delay: 20 });
        await new Promise((r) => setTimeout(r, 200));
        if ((await input.evaluate((el) => el.value)) === value) return;
      }
    };
    await new Promise((r) => setTimeout(r, 800));
    await fill(0, PARENT.phone);
    await fill(1, PARENT.password);
    await page.tap('.login-button');
    await page.waitForFunction(() => location.pathname.includes('/package-parent/'), { timeout: 15000 });
    check(true, '种子家长从登录页登录，进入家长端');

    const sid = PARENT.childId;
    const ev = await prisma.scheduleEvent.findFirst({ where: { evaluation: { isNot: null }, attendances: { some: { studentId: sid } } }, orderBy: { date: 'desc' } });
    const pkg = await prisma.studentCoursePackage.findFirst({ where: { studentId: sid, status: 'active' }, orderBy: { createdAt: 'desc' } });
    const pages = [
      ['01-课评', 'package-parent/evaluations/index'],
      ['02-课评详情', `package-parent/evaluations/detail?sid=${sid}&eid=${ev?.id}`],
      ['03-课表', 'package-parent/schedule/index'],
      ['04-课程', 'package-parent/courses/index'],
      ['05-课时明细', `package-parent/courses/usage?sid=${sid}&pid=${pkg?.id}`],
      ['06-成长', 'package-parent/growth/index'],
      ['07-历史档案', 'package-parent/growth/archive'],
      ['08-我的', 'package-parent/me/index'],
    ];

    const metrics = {};
    for (const width of WIDTHS) {
      fs.mkdirSync(path.join(OUT, String(width)), { recursive: true });
      await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      for (const [name, route] of pages) {
        await page.goto(`${s.url}/parent/${route}`, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 700)); // 等入场动画结束
        await page.screenshot({ path: path.join(OUT, String(width), `${name}.png`), fullPage: true });
        const m = await page.evaluate(measure);
        metrics[`${width}/${name}`] = m;
        const text = await page.evaluate(() => document.body.innerText);
        check(text.trim().length > 0, `${width}px「${name}」有内容 (最小字号 ${m.minFont}px，<12px 文字 ${m.smallText} 处，<44px 点击区域 ${m.smallTargets} 个)`);
        if (STRICT) {
          check(m.smallText === 0, `${width}px「${name}」没有小于 12px 的文字：${m.smallSamples.join('，')}`);
          check(m.smallTargets === 0, `${width}px「${name}」可点击区域都不小于 44px：${m.targetSamples.join('，')}`);
        }
      }
    }
    // ---------- 切换标签保留状态 (家长端 UI 改进第 3 期) ----------
    await page.setViewport({ width: 375, height: 600, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${s.url}/parent/package-parent/evaluations/index`, { waitUntil: 'networkidle0' });
    const tapTab = async (label) => {
      // 之前打开的页面还留在页面栈里 (隐藏)，只点当前可见的标签栏；标签文字里可能带未读数 (「3课评」)
      const tabs = await page.$$('.tab-item');
      for (const t of tabs) {
        const ok = await t.evaluate((el, l) => el.offsetParent !== null && el.querySelector('.tab-label')?.textContent.trim() === l, label);
        if (ok) {
          await t.tap();
          return;
        }
      }
      throw new Error(`找不到标签「${label}」`);
    };
    await page.evaluate(() => window.scrollTo(0, 400));
    await new Promise((r) => setTimeout(r, 300));
    const scrolled = await page.evaluate(() => window.scrollY);
    await tapTab('课表');
    await page.waitForFunction(() => location.pathname.includes('/schedule/'));
    await new Promise((r) => setTimeout(r, 800));
    await tapTab('课评');
    await page.waitForFunction(() => location.pathname.includes('/evaluations/'));
    await new Promise((r) => setTimeout(r, 400));
    const back = await page.evaluate(() => ({ y: window.scrollY, skeleton: !!document.querySelector('.skeleton-list'), cards: document.querySelectorAll('.feed').length }));
    check(Math.abs(back.y - scrolled) < 40 && !back.skeleton && back.cards > 0, `课评 → 课表 → 课评：滚动位置还在 (${scrolled} → ${back.y})，没有重新显示骨架屏`);

    await tapTab('课程');
    await page.waitForFunction(() => location.pathname.includes('/courses/'));
    await new Promise((r) => setTimeout(r, 600));
    await tapTab('课表');
    await page.waitForFunction(() => location.pathname.includes('/schedule/'));
    const noFlash = await page.evaluate(() => !document.querySelector('.tl-skeleton'));
    check(noFlash, '切回之前看过的「课表」时直接显示内容，不闪骨架屏');
    await page.goBack();
    await new Promise((r) => setTimeout(r, 800));
    check(page.url().includes('/parent/package-parent/'), `浏览器「返回」回到上一个标签，没有离开家长端 (${new URL(page.url()).pathname})`);

    // ---------- 加载失败：每页显示「重新加载」，点了以后恢复 (家长端 UI 改进第 2 期) ----------
    await page.setViewport({ width: 375, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const failCases = [
      ['01-课评', /\/students\/[^/]+\/evaluations\?/],
      ['02-课评详情', /\/students\/[^/]+\/evaluations\/[^/?]+(\?|$)/],
      ['03-课表', /\/students\/[^/]+\/schedule/],
      ['04-课程', /\/students\/[^/]+\/courses(\?|$)/],
      ['05-课时明细', /\/courses\/[^/]+\/usage/],
      ['06-成长', /\/students\/[^/]+\/album/],
      ['07-历史档案', /\/students\/[^/]+\/archive/],
    ];
    for (const [name, pattern] of failCases) {
      const route = pages.find(([n]) => n === name)[1];
      failNext = pattern;
      await page.goto(`${s.url}/parent/${route}`, { waitUntil: 'networkidle0' });
      const failed = await page.waitForFunction(() => document.body.innerText.includes('重新加载'), { timeout: 8000 }).then(() => true, () => false);
      const text = await page.evaluate(() => document.body.innerText);
      check(failed && !/还没有|没有课$|这一天没有课/.test(text.split('重新加载')[0].slice(-40)), `「${name}」接口失败时显示原因和「重新加载」，不显示成「没有数据」`);
      failNext = null;
      await page.tap('.error-state .retry');
      const recovered = await page.waitForFunction(() => !document.querySelector('.error-state'), { timeout: 8000 }).then(() => true, () => false);
      check(recovered, `「${name}」点「重新加载」后正常显示`);
    }
    failNext = null;

    check(escaped === 0, `没有请求发到本机以外的地址 (拦下 ${escaped} 个：${escapedUrls.join('，')})`);
    fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 2));
    console.log(`  截图与统计：${path.relative(process.cwd(), OUT)}`);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
