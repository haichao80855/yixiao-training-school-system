const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const SHOT_DIR = path.resolve(__dirname, '../walkthrough_screenshots/e2e_business_audit');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function checkPort(port, host = 'localhost') {
  return new Promise(resolve => {
    const req = http.get(`http://${host}:${port}`, res => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port, name, maxSeconds = 30) {
  console.log(`[Wait] 正在等待 ${name} (端口 ${port}) 启动就绪...`);
  for (let i = 0; i < maxSeconds * 2; i++) {
    if (await checkPort(port)) {
      console.log(`[Ready] ${name} (端口 ${port}) 已就绪！`);
      return true;
    }
    await sleep(500);
  }
  throw new Error(`${name} 未能在 ${maxSeconds} 秒内启动就绪`);
}

async function main() {
  console.log('================================================================');
  console.log('拓视未来教育「一校教培系统」端到端真实浏览器点击全业务闭环走查');
  console.log('================================================================\n');

  // 1. 启动 Vite 与 NestJS
  let viteProcess = null;
  let nestProcess = null;

  if (!(await checkPort(5173))) {
    console.log('[DevServer] 启动 Vite 前端开发服务器...');
    viteProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe'
    });
  }

  if (!(await checkPort(3001))) {
    console.log('[Server] 启动 NestJS 后端服务...');
    nestProcess = spawn('npm', ['run', 'server:dev'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe'
    });
  }

  await waitForServer(5173, 'Vite 前端', 25);
  // NestJS 后端可选等待
  await waitForServer(3001, 'NestJS 后端', 20).catch(err => {
    console.warn('  ⚠️ NestJS 后端未能启动，将使用纯前端 Mock 模式执行走查:', err.message);
  });

  // 2. 启动原生 Chrome
  console.log('\n[Browser] 正在启动原生 Google Chrome (1440x900)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  let stepIdx = 1;
  async function shot(label) {
    const filename = `${String(stepIdx++).padStart(2, '0')}_${label}.png`;
    const target = path.join(SHOT_DIR, filename);
    await page.screenshot({ path: target, fullPage: false });
    console.log(`  📸 [截屏] ${filename}`);
    return target;
  }

  try {
    // -------------------------------------------------------------
    // 【Step 1】访问当前用户所在的教学讲台
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 1】访问当前用户所在的教学讲台...');
    await page.goto(`${BASE_URL}/educational/workbench`, { waitUntil: 'networkidle2' });
    await sleep(1500);

    const initialTitle = await page.title();
    console.log(`  页面标题: ${initialTitle}`);
    await shot('initial_workbench');

    // 提取讲台顶部状态
    const teacherBadge = await page.$eval('.bg-blue-50, .text-st-secondary, h2, h3, div', () => {
      const el = Array.from(document.querySelectorAll('span, div')).find(d => d.innerText && d.innerText.includes('当前讲师'));
      return el ? el.innerText : '未知';
    }).catch(() => '未知');
    console.log(`  讲师状态标签: ${teacherBadge}`);

    // -------------------------------------------------------------
    // 【Step 2】测试视图切换 (卡片 ↔ 表格)
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 2】测试视图切换 (卡片 ↔ 表格)...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tableBtn = btns.find(b => b.innerText.includes('表格视图'));
      if (tableBtn) tableBtn.click();
    });
    await sleep(600);
    await shot('view_mode_table');

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cardBtn = btns.find(b => b.innerText.includes('卡片视图'));
      if (cardBtn) cardBtn.click();
    });
    await sleep(600);
    await shot('view_mode_card');

    // -------------------------------------------------------------
    // 【Step 3】点击顶栏「🧹 测试数据」弹窗并恢复演示 Mock 数据
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 3】点击顶栏「🧹 测试数据」弹窗...');
    const testDataBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('测试数据'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`  点击测试数据按钮: ${testDataBtnClicked}`);
    await sleep(800);
    await shot('test_data_modal_opened');

    console.log('  点击「恢复初始预置数据」...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-dialog button'));
      const restoreBtn = btns.find(b => b.innerText.includes('恢复系统初始预置') || b.innerText.includes('恢复预置') || b.innerText.includes('恢复'));
      if (restoreBtn) restoreBtn.click();
    });
    await sleep(600);

    // 确认 ElMessageBox 弹窗
    await page.evaluate(() => {
      const confirmBtns = Array.from(document.querySelectorAll('.el-message-box button'));
      const okBtn = confirmBtns.find(b => b.innerText.includes('确认恢复') || b.innerText.includes('确定') || b.innerText.includes('确认'));
      if (okBtn) okBtn.click();
    });
    await sleep(1500);

    // 等待刷新完成
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
    await sleep(1500);
    await shot('workbench_after_restore_data');

    // -------------------------------------------------------------
    // 【Step 4】切换讲师角色 (若当前讲师无课，切换到张老师或超级管理员)
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 4】检查当前是否有课程卡片...');
    let cardCount = await page.$$eval('.bg-white.rounded-xl.shadow-xs, .el-card', els => els.length);
    console.log(`  当前排课卡片数: ${cardCount}`);

    if (cardCount === 0) {
      console.log('  由于钱欣蕾账号仅本人数据且无排课，点击右上角头像切换为【授课教师 (张老师)】...');
      // 打开用户下拉菜单
      await page.evaluate(() => {
        const trigger = document.querySelector('.el-dropdown') || document.querySelector('[class*="dropdown"]');
        if (trigger) trigger.click();
      });
      await sleep(600);
      await shot('user_dropdown_opened');

      // 点击切换为教师
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.el-dropdown-menu__item, [role="menuitem"]'));
        const teacherItem = items.find(i => i.innerText.includes('授课教师') || i.innerText.includes('张老师') || i.innerText.includes('讲师'));
        if (teacherItem) teacherItem.click();
      });
      await sleep(1500);

      // 重新读取卡片数
      cardCount = await page.$$eval('.bg-white.rounded-xl.shadow-xs, .el-card', els => els.length);
      console.log(`  切换账号后当前排课卡片数: ${cardCount}`);
      await shot('workbench_after_switch_teacher');
    }

    // -------------------------------------------------------------
    // 【Step 5】业务点击：备课大纲抽屉 (LessonLessonPlanDrawer)
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 5】点击课程卡片上的【备课】按钮...');
    const beikeClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.trim() === '备课');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`  点击备课按钮结果: ${beikeClicked}`);
    await sleep(1000);
    await shot('beike_drawer_opened');

    // 关闭备课抽屉
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.el-drawer__close-btn');
      if (closeBtn) closeBtn.click();
    });
    await sleep(600);

    // -------------------------------------------------------------
    // 【Step 6】业务点击：授课状态机 (上课 -> 结课)
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 6】测试授课状态机 (上课)...');
    const startClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.trim() === '上课');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`  点击【上课】按钮结果: ${startClicked}`);
    await sleep(1000);
    await shot('lesson_started');

    console.log('  测试授课状态机 (结课)...');
    const finishClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.trim() === '结课');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`  点击【结课】按钮结果: ${finishClicked}`);
    await sleep(800);

    // 二次确认结课弹窗
    await page.evaluate(() => {
      const okBtns = Array.from(document.querySelectorAll('.el-message-box button'));
      const ok = okBtns.find(b => b.innerText.includes('结课') || b.innerText.includes('确定') || b.innerText.includes('确认'));
      if (ok) ok.click();
    });
    await sleep(1200);
    await shot('lesson_finished');

    // -------------------------------------------------------------
    // 【Step 7】业务点击：点名消课弹窗 (快捷消课与考勤流转)
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 7】点击【点名消课】按钮...');
    const attendClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('点名消课') || b.innerText.includes('签到消课') || b.innerText.includes('点名'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`  点击点名消课按钮结果: ${attendClicked}`);
    await sleep(1000);
    await shot('attendance_dialog_opened');

    // 提交点名消课
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('.el-dialog button')).find(b => b.innerText.includes('确认') || b.innerText.includes('消课') || b.innerText.includes('提交'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(1200);
    await shot('after_attendance_submitted');

    // -------------------------------------------------------------
    // 【Step 8】业务点击：写课评与 AI 课评助手
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 8】点击【写课评】按钮...');
    const evalClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('写课评') || b.innerText.includes('课评'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`  点击写课评按钮结果: ${evalClicked}`);
    await sleep(1000);
    await shot('evaluation_dialog_opened');

    // 点击 AI 一键生成课评
    const aiGenClicked = await page.evaluate(() => {
      const aiBtn = Array.from(document.querySelectorAll('.el-dialog button')).find(b => b.innerText.includes('AI') || b.innerText.includes('智能生成') || b.innerText.includes('生成'));
      if (aiBtn) {
        aiBtn.click();
        return true;
      }
      return false;
    });
    console.log(`  点击 AI 智能生成课评: ${aiGenClicked}`);
    await sleep(1200);
    await shot('evaluation_ai_generated');

    // 点击发布课评
    await page.evaluate(() => {
      const pubBtn = Array.from(document.querySelectorAll('.el-dialog button')).find(b => b.innerText.includes('发布') || b.innerText.includes('保存'));
      if (pubBtn) pubBtn.click();
    });
    await sleep(1200);
    await shot('evaluation_published');

    // -------------------------------------------------------------
    // 【Step 9】侧边栏联动：导航至 7x15 排课网格
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 9】点击侧边栏【7×15 排课网格】...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.el-menu-item, a'));
      const link = links.find(l => l.innerText.includes('7×15 排课网格') || l.innerText.includes('排课网格'));
      if (link) link.click();
    });
    await sleep(1500);
    console.log(`  当前页面 URL: ${page.url()}`);
    await shot('sidebar_schedule_grid');

    // -------------------------------------------------------------
    // 【Step 10】侧边栏联动：导航至 授课点名消课与反结课
    // -------------------------------------------------------------
    console.log('\n>>> 【Step 10】点击侧边栏【授课点名消课】...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.el-menu-item, a'));
      const link = links.find(l => l.innerText.includes('授课点名消课') || l.innerText.includes('点名消课'));
      if (link) link.click();
    });
    await sleep(1500);
    console.log(`  当前页面 URL: ${page.url()}`);
    await shot('sidebar_rollcall_management');

    console.log('\n================================================================');
    console.log('✅ 端到端真实 Chrome 点击走查全流程执行完成！');
    console.log(`控制台捕获错误数: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('部分控制台错误示例:', consoleErrors.slice(0, 5));
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ 执行走查过程中捕获未处理异常:', err);
    await page.screenshot({ path: path.join(SHOT_DIR, 'fatal_error.png') }).catch(() => {});
  } finally {
    await browser.close();
    if (viteProcess) {
      console.log('[Cleanup] 关闭 Vite 进程...');
      viteProcess.kill();
    }
    if (nestProcess) {
      console.log('[Cleanup] 关闭 NestJS 进程...');
      nestProcess.kill();
    }
  }
}

main().catch(console.error);
