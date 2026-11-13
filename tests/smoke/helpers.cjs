/**
 * 浏览器冒烟测试的公共工具：
 * - 静态服务器：托管构建好的后台前端 (dist/)，把 /api、/uploads 转发给本次测试的后端 (TEST_BASE_URL)
 * - 启动 Chrome (puppeteer-core，用本机或 CI 装好的 Chrome)
 * - 通过真实登录页登录
 *
 * 只在隔离环境里运行：npm run test:smoke (会先构建前端，再起临时库 + 临时后端)。
 * 冒烟测试造的数据不自己清理，由运行器在每个测试后删除 (见 tests/run-suite.cjs 的残留检查)，
 * 所以不要对开发库运行这些脚本。
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const assert = require('assert');
const puppeteer = require('puppeteer-core');
const { BASE_URL } = require('../../server/test-utils/target');
const { ACCOUNTS, SEED_PASSWORD } = require('../../server/test-utils/accounts');

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** 托管 dist/ (单页应用，未知路径回落到 index.html)，/api 和 /uploads 转发到测试后端 */
function startStaticServer(port = 0) {
  const backend = new URL(BASE_URL);
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
      const proxied = http.request(
        { hostname: backend.hostname, port: backend.port, path: req.url, method: req.method, headers: { ...req.headers, host: backend.host } },
        (up) => {
          res.writeHead(up.statusCode, up.headers);
          up.pipe(res);
        },
      );
      proxied.on('error', (e) => {
        res.writeHead(502);
        res.end(String(e));
      });
      req.pipe(proxied);
      return;
    }
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, urlPath);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

async function launchBrowser() {
  const executablePath = chromePath();
  assert.ok(executablePath, '找不到 Chrome，请设置 CHROME_PATH');
  return puppeteer.launch({
    executablePath,
    headless: process.env.SMOKE_HEADFUL ? false : true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900', '--lang=zh-CN'],
    defaultViewport: { width: 1440, height: 900 },
  });
}

/**
 * 打开一个冒烟会话：静态服务器 + 浏览器 + 新页面。页面里的脚本报错会记下来，测试结束时检查。
 */
async function openSession() {
  const { server, url } = await startStaticServer();
  const browser = await launchBrowser();
  const pageErrors = [];
  let context = null;
  const session = {
    url,
    browser,
    page: null,
    pageErrors,
    /** 换一个全新的无痕上下文 (没有登录状态、没有本地存储)，用于切换账号 */
    async freshPage() {
      if (context) await context.close().catch(() => {});
      context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.on('pageerror', (err) => pageErrors.push(err.message));
      page.setDefaultTimeout(15000);
      // 业务日期按北京时间，CI 机器是 UTC，统一成北京时间避免「今天」对不上
      await page.emulateTimezone('Asia/Shanghai');
      session.page = page;
      return page;
    },
    async close() {
      await browser.close().catch(() => {});
      await new Promise((r) => server.close(r));
    },
  };
  await session.freshPage();
  return session;
}

/** 通过真实登录页登录。role 为 server/test-utils/accounts.js 里的角色名 */
async function loginAs(session, role, redirect) {
  const { url } = session;
  const loginUrl = `${url}/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;
  // 切换账号用全新的无痕上下文；如果当前页面就在这个登录地址 (例如刚被送回登录页)，直接在原页面登录
  const page = session.page.url().startsWith(loginUrl) && redirect ? session.page : await session.freshPage();
  if (page.url() !== loginUrl) await page.goto(loginUrl, { waitUntil: 'networkidle0' });
  const fill = async (selector, value) => {
    // 页面渲染完成前输入的内容会被清掉：输入后核对，不对就重输
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector(selector, { visible: true });
      await page.click(selector, { clickCount: 3 });
      await page.type(selector, value);
      if ((await page.$eval(selector, (el) => el.value)) === value) return;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`没能在 ${selector} 输入内容`);
  };
  await fill('input[placeholder="用户名 / 工号 / 手机号"]', ACCOUNTS[role]);
  await fill('input[placeholder="请输入密码"]', SEED_PASSWORD);
  await Promise.all([
    page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 15000 }),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForNetworkIdle({ idleTime: 300 }).catch(() => {});
}

/** 登录接口拿令牌，给测试造数据用 (造数据走接口，界面只测关键操作) */
async function apiLogin(role) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: ACCOUNTS[role], password: SEED_PASSWORD }),
  });
  const body = await res.json();
  assert.ok(body?.data?.accessToken, `${role} 登录失败`);
  return { token: body.data.accessToken, user: body.data.user };
}

async function api(token, method, urlPath, body, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, body: data };
}

/** 页面上可见文本 */
const pageText = (page) => page.evaluate(() => document.body.innerText);

/** 点击包含指定文字的按钮 (Element Plus 按钮文字在 span 里) */
async function clickButton(page, text, scope = 'body') {
  const clicked = await page.evaluate(
    (t, s) => {
      const root = document.querySelector(s) || document.body;
      const btn = [...root.querySelectorAll('button')].find((b) => b.innerText.replace(/\s+/g, '').includes(t.replace(/\s+/g, '')) && !b.disabled && b.offsetParent !== null);
      if (!btn) return false;
      btn.click();
      return true;
    },
    text,
    scope,
  );
  assert.ok(clicked, `没找到可点击的按钮「${text}」`);
}

/** 点击可见的、文字包含 text 的元素 (按 selector 过滤，默认任意可点击元素) */
async function clickText(page, text, selector = 'button, a, span, div, li, label, td') {
  const handle = await page.waitForFunction(
    (t, sel) => {
      const norm = (x) => x.replace(/\s+/g, '');
      const els = [...document.querySelectorAll(sel)].filter((el) => el.offsetParent !== null && norm(el.innerText || '').includes(norm(t)));
      // 选文字最短 (最内层) 的那个，避免点到外层容器
      els.sort((a, b) => a.innerText.length - b.innerText.length);
      return els[0] || null;
    },
    { timeout: 15000 },
    text,
    selector,
  );
  try {
    await handle.asElement().click();
  } catch {
    // 下拉菜单、弹层动画进行中鼠标点不中：直接触发元素的 click
    await handle.asElement().evaluate((el) => el.click());
  }
}

/** 在 label 为 formLabel 的表单项里打开 el-select，选择文字包含 optionText 的选项 (不传则选第一个) */
async function chooseOption(page, formLabel, optionText) {
  const trigger = await page.evaluateHandle((label) => {
    const item = [...document.querySelectorAll('.el-form-item')].find(
      (el) => el.offsetParent !== null && el.querySelector('.el-form-item__label')?.innerText.replace(/\s+/g, '').includes(label.replace(/\s+/g, '')),
    );
    return item?.querySelector('.el-select__wrapper, .el-select .el-input__wrapper, .el-select') || null;
  }, formLabel);
  assert.ok(trigger.asElement(), `没找到表单项「${formLabel}」里的下拉框`);
  // Element Plus 的下拉框要真实的鼠标事件才会展开
  await trigger.asElement().click();
  const option = await page.waitForFunction(
    (t) => {
      const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.offsetParent !== null && !o.classList.contains('is-disabled'));
      return (t ? opts.find((o) => o.innerText.includes(t)) : opts[0]) || null;
    },
    { timeout: 10000 },
    optionText || '',
  );
  // 下拉动画进行中鼠标点不中，选项直接触发 click 即可
  await option.asElement().evaluate((el) => el.click());
}

/** 等弹窗、确认框和遮罩完全关闭 (关闭动画期间的点击会落在遮罩上) */
async function waitOverlaysGone(page) {
  await page.waitForFunction(() => ![...document.querySelectorAll('.el-overlay, .el-message-box')].some((el) => el.offsetParent !== null && getComputedStyle(el).display !== 'none'), { timeout: 10000 });
}

/** 等待 Element Plus 提示消息出现，返回文字 */
async function waitMessage(page, pattern) {
  const h = await page.waitForFunction(
    (src) => {
      const re = new RegExp(src);
      return [...document.querySelectorAll('.el-message')].map((m) => m.innerText).find((t) => re.test(t)) || null;
    },
    { timeout: 15000 },
    pattern.source,
  );
  return h.jsonValue();
}

/** 北京时间的今天，如 2026-11-12 */
function todayInShanghai() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

let passed = 0;
function check(cond, desc) {
  assert.ok(cond, `❌ ${desc}`);
  passed += 1;
  console.log(`  ✓ PASS [${passed}]: ${desc}`);
}

/** 运行一个冒烟测试：失败时截图到 test-results/smoke/ 方便排查 */
async function runSmoke(name, fn) {
  console.log(`\n${'='.repeat(70)}\n浏览器冒烟：${name}\n${'='.repeat(70)}`);
  const session = await openSession();
  try {
    await fn(session);
    check(session.pageErrors.length === 0, `页面没有脚本报错${session.pageErrors.length ? `：${session.pageErrors.join(' | ')}` : ''}`);
    console.log(`\n🎉 ${name}：${passed} 项检查通过\n`);
  } catch (err) {
    const dir = path.join(ROOT, 'test-results/smoke');
    fs.mkdirSync(dir, { recursive: true });
    const shot = path.join(dir, `${name.replace(/[^\w一-龥-]+/g, '_')}.png`);
    await session.page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.error(`\n❌ ${name} 失败：${err.message}\n   当前地址：${session.page.url()}\n   截图：${path.relative(ROOT, shot)}`);
    process.exitCode = 1;
  } finally {
    await session.close();
  }
}

module.exports = { waitOverlaysGone, todayInShanghai, clickText, chooseOption, waitMessage, startStaticServer, runSmoke, loginAs, apiLogin, api, pageText, clickButton, check, chromePath, BASE_URL, ACCOUNTS };
