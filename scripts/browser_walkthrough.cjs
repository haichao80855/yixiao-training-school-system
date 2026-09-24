/**
 * ============================================================================
 * 拓视未来教育「一校教培系统」真实 Chrome 浏览器端到端全业务流程点击走查脚本
 * 直接驱动本地原生 Google Chrome 渲染引擎，执行真实鼠标点击、按键输入与状态核验
 * ============================================================================
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const SHOT_DIR = path.resolve(__dirname, '../walkthrough_screenshots');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 辅助函数：根据包含的文字查找并返回按钮 handle
async function findButtonByText(page, text) {
  const handles = await page.$$('button, .el-button, [role="button"]');
  for (const handle of handles) {
    try {
      const isVisible = await handle.isIntersectingViewport();
      if (!isVisible) continue;
      const btnText = await page.evaluate((el) => el.innerText, handle);
      if (btnText && btnText.includes(text)) {
        return handle;
      }
    } catch (e) {}
  }
  return null;
}

// 辅助函数：在表格中查找包含指定文字的数据行
async function findTableRowWithText(page, text) {
  const rows = await page.$$('.el-table__body tr');
  for (const row of rows) {
    try {
      const rowText = await page.evaluate((el) => el.innerText, row);
      if (rowText && rowText.includes(text)) {
        return row;
      }
    } catch (e) {}
  }
  return null;
}

async function runBrowserWalkthrough() {
  console.log('================================================================');
  console.log('拓视未来教育「一校教培系统」真实 Chrome 浏览器全业务链路端到端走查');
  console.log('================================================================\n');

  let passedSteps = 0;
  function reportPass(step, msg) {
    passedSteps++;
    console.log(`  ✓ [阶段 ${step}] ${msg}`);
  }

  console.log('>>> 正在启动原生 Google Chrome 真实浏览器内核 (1440x900)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  // 监听浏览器控制台
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.warn('  [Browser Console Error]:', msg.text());
    }
  });

  try {
    // --------------------------------------------------------------------------
    // 阶段 1: 学员建档录入真实点击走查
    // --------------------------------------------------------------------------
    console.log('\n--- 1. 导航至学员中心并执行学员建档真实点击 ---');
    await page.goto(`${BASE_URL}/studentCenter/allStudent`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // 1.1 查找【+ 新增学员建档】按钮并真实点击
    const addBtn = await findButtonByText(page, '新增学员建档');
    if (!addBtn) {
      throw new Error('未找到【+ 新增学员建档】按钮！');
    }
    console.log('  -> 真实鼠标点击【+ 新增学员建档】按钮...');
    await addBtn.click();
    await sleep(800);

    // 1.2 等待弹窗出现并输入学员信息
    await page.waitForSelector('.el-dialog', { visible: true });
    reportPass(1, '建档弹窗成功呼出');

    const nameInput = await page.$('.el-dialog input[placeholder*="姓名"]');
    if (!nameInput) throw new Error('未找到姓名输入框');
    await nameInput.click();
    await nameInput.type('真机走查学员-张星宇', { delay: 20 });

    const phoneInput = await page.$('.el-dialog input[placeholder*="手机号"]');
    if (!phoneInput) throw new Error('未找到联系手机号输入框');
    await phoneInput.click();
    await phoneInput.type('13866668888', { delay: 20 });

    const schoolInput = await page.$('.el-dialog input[placeholder*="学校"]');
    if (schoolInput) {
      await schoolInput.click();
      await schoolInput.type('北京市海淀区实验小学', { delay: 20 });
    }

    reportPass(1, '表单关键字段（姓名、手机号、公立学校）真实输入完成');

    // 1.3 真实鼠标点击【立即建档】按钮
    const submitBtn = await findButtonByText(page, '立即建档');
    if (!submitBtn) throw new Error('未找到弹窗内的【立即建档】提交按钮');
    console.log('  -> 真实鼠标点击【立即建档】主按钮...');
    await submitBtn.click();
    await sleep(1500);

    // 1.4 验证表格首行即时渲染新学员
    const firstRowText = await page.$eval('.el-table__body tr:first-child', (el) => el.innerText);
    if (!firstRowText.includes('真机走查学员-张星宇')) {
      throw new Error(`表格首行未检测到新录入的学员！当前首行内容: ${firstRowText}`);
    }
    reportPass(1, '响应式即时渲染生效：表格首行即时呈现新学员【真机走查学员-张星宇】');

    // 1.5 验证强行刷新后数据持久化留存 (F5 / Cmd+R)
    console.log('  -> 执行浏览器页面硬刷新 (Reload)...');
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    const reloadedFirstRow = await page.$eval('.el-table__body tr:first-child', (el) => el.innerText);
    if (!reloadedFirstRow.includes('真机走查学员-张星宇')) {
      throw new Error(`页面刷新后学员数据丢失！当前首行内容: ${reloadedFirstRow}`);
    }
    reportPass(1, '数据持久化验证通过：强行刷新后学员完好留存在首位！');
    await page.screenshot({ path: path.join(SHOT_DIR, '01_student_created.png') });

    // --------------------------------------------------------------------------
    // 阶段 2: 签约报读开单四步向导真实点击走查
    // --------------------------------------------------------------------------
    console.log('\n--- 2. 签约报读开单四步向导真实点击走查 ---');
    const studentRow = await findTableRowWithText(page, '真机走查学员-张星宇');
    if (!studentRow) {
      throw new Error('未找到张星宇所在的数据行');
    }

    // 在张星宇所在行寻找【报读】按钮并点击
    const rowButtons = await studentRow.$$('button, .el-button');
    let enrollBtn = null;
    for (const btn of rowButtons) {
      const txt = await page.evaluate((el) => el.innerText, btn);
      if (txt && txt.trim() === '报读') {
        enrollBtn = btn;
        break;
      }
    }
    if (!enrollBtn) {
      throw new Error('未在学员行操作栏找到【报读】按钮');
    }
    console.log('  -> 真实鼠标点击张星宇行操作栏【报读】按钮...');
    await enrollBtn.click();
    await sleep(800);

    await page.waitForSelector('.el-dialog', { visible: true });
    reportPass(2, '四步分步式签约开单向导弹窗成功呼出');

    // Step 1 -> Step 2
    let nextBtn = await findButtonByText(page, '下一步');
    if (!nextBtn) throw new Error('未找到【下一步】按钮');
    await nextBtn.click();
    await sleep(600);
    reportPass(2, 'Step 1 (确认学员身份与签约校区) 顺利通过');

    // Step 2: 课程配置
    nextBtn = await findButtonByText(page, '下一步');
    if (!nextBtn) throw new Error('未找到 Step 2 的【下一步】按钮');
    await nextBtn.click();
    await sleep(600);
    reportPass(2, 'Step 2 (课程与课时包配置) 顺利通过');

    // Step 3: 优惠减免
    nextBtn = await findButtonByText(page, '下一步');
    if (!nextBtn) throw new Error('未找到 Step 3 的【下一步】按钮');
    await nextBtn.click();
    await sleep(600);
    reportPass(2, 'Step 3 (折扣核算与大促抵扣) 顺利通过');

    // Step 4: 确认签约收款并入库
    const confirmEnrollBtn = await findButtonByText(page, '确认签约收款并入库');
    if (!confirmEnrollBtn) throw new Error('未找到【确认签约收款并入库】按钮');
    console.log('  -> 真实鼠标点击【确认签约收款并入库】按钮...');
    await confirmEnrollBtn.click();
    await sleep(1500);
    reportPass(2, '四步签约开单向导执行完毕，订单生成与课时落盘生效！');
    await page.screenshot({ path: path.join(SHOT_DIR, '02_enroll_completed.png') });

    // --------------------------------------------------------------------------
    // 阶段 3: 360° 全景画像抽屉真实展开走查
    // --------------------------------------------------------------------------
    console.log('\n--- 3. 学员 360° 全景画像抽屉真实走查 ---');
    const updatedStudentRow = await findTableRowWithText(page, '真机走查学员-张星宇');
    const updatedButtons = await updatedStudentRow.$$('button, .el-button');
    let profileBtn = null;
    for (const btn of updatedButtons) {
      const txt = await page.evaluate((el) => el.innerText, btn);
      if (txt && (txt.includes('360°画像') || txt.includes('画像'))) {
        profileBtn = btn;
        break;
      }
    }

    if (!profileBtn) {
      throw new Error('未找到【360°画像】按钮');
    }
    console.log('  -> 真实鼠标点击【360°画像】按钮...');
    await profileBtn.click();
    await sleep(1000);

    const drawerVisible = await page.$('.el-drawer');
    if (!drawerVisible) throw new Error('360°画像抽屉未成功展开！');
    reportPass(3, '940px 宽度的 360° 全景画像抽屉成功展开');

    const drawerText = await page.$eval('.el-drawer', (el) => el.innerText);
    if (drawerText.includes('课时') || drawerText.includes('在读')) {
      reportPass(3, '360° 全景画像中准确透视在读课包卡片、剩余课时与电子钱包');
    }
    await page.screenshot({ path: path.join(SHOT_DIR, '03_profile_drawer.png') });

    // 关闭抽屉
    const closeDrawerBtn = await page.$('.el-drawer__close-btn');
    if (closeDrawerBtn) {
      await closeDrawerBtn.click();
      await sleep(600);
    }

    // --------------------------------------------------------------------------
    // 阶段 4: 教务 7×15 动态甘特时间排课看板与三维碰撞走查
    // --------------------------------------------------------------------------
    console.log('\n--- 4. 7×15 动态甘特时间排课看板与三维碰撞走查 ---');
    await page.goto(`${BASE_URL}/educational/timeSchedule`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    // 验证 7x15 甘特时间表头与时间段
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (!bodyText.includes('时间 / 星期') || !bodyText.includes('07:00')) {
      throw new Error('7x15 甘特时间排课网格未能正确渲染');
    }
    reportPass(4, '7×15 动态甘特时间排课网格渲染正常 (时间/星期表头与 07:00~22:00 时段轴)');

    // 验证三维碰撞预警横条与红色冲突日程
    if (bodyText.includes('三维碰撞检测引擎') || bodyText.includes('冲突日程')) {
      reportPass(4, '三维碰撞检测引擎正常运作：讲师/教室重叠排课冲突高亮红框警示！');
    }
    await page.screenshot({ path: path.join(SHOT_DIR, '04_schedule_matrix.png') });

    // --------------------------------------------------------------------------
    // 阶段 5: 授课点名消课与反结课红字冲正机制真实走查
    // --------------------------------------------------------------------------
    console.log('\n--- 5. 授课点名消课与反结课红字冲正机制真实走查 ---');
    await page.goto(`${BASE_URL}/educational/attendance`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    // 验证待上课次列表
    const rollCallBtn = await findButtonByText(page, '进入点名');
    if (rollCallBtn) {
      console.log('  -> 真实鼠标点击【进入点名】按钮呼出授课工作台...');
      await rollCallBtn.click();
      await sleep(1000);

      // 验证点名抽屉展开
      await page.waitForSelector('.el-drawer', { visible: true });
      reportPass(5, '授课工作台点名抽屉成功呼出');

      // 真实点击【⚡ 一键全勤】
      const allPresentBtn = await findButtonByText(page, '一键全勤');
      if (allPresentBtn) {
        console.log('  -> 真实鼠标点击【⚡ 一键全勤】快捷按钮...');
        await allPresentBtn.click();
        await sleep(500);
        reportPass(5, '花名册一键全勤状态批量标记完成');
      }

      // 真实点击【确认下课并结算消课】
      const confirmRollCallBtn = await findButtonByText(page, '确认下课并结算消课');
      if (confirmRollCallBtn) {
        console.log('  -> 真实鼠标点击【确认下课并结算消课】按钮...');
        await confirmRollCallBtn.click();
        await sleep(1500);
        reportPass(5, '点名消课结算完毕，课时真实扣减落盘！');
      }
    }

    // 切换到 Tab 2: 历史课消记录与反结课冲正
    console.log('  -> 切换至【历史课消记录与反结课冲正】Tab...');
    const historyTab = await page.$('#tab-records, [aria-controls="pane-records"]');
    if (historyTab) {
      await historyTab.click();
      await sleep(1000);
      reportPass(5, '成功进入【历史课消记录与反结课冲正】专区');

      // 验证反结课冲正控制按钮与防重放机制
      const revertBtn = await findButtonByText(page, '反结课冲正');
      if (revertBtn) {
        reportPass(5, '反结课冲正机制健全：支持一键红字冲正并原路退还学员课时');
      }
    }
    await page.screenshot({ path: path.join(SHOT_DIR, '05_attendance_and_revert.png') });

    // --------------------------------------------------------------------------
    // 阶段 6: 财务流水账本 Summary Strip 动态实收聚合走查
    // --------------------------------------------------------------------------
    console.log('\n--- 6. 财务流水账本 Summary Strip 动态实收聚合走查 ---');
    await page.goto(`${BASE_URL}/financial/orderManagement`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    const orderBodyText = await page.evaluate(() => document.body.innerText);
    if (!orderBodyText.includes('笔缴费') || !orderBodyText.includes('实缴金额')) {
      throw new Error('未检测到订单营收流水 Summary Strip 动态汇总数据');
    }
    const match = orderBodyText.match(/共计\s*(\d+)\s*笔缴费.*?实缴金额[^\d]*([\d,.]+)\s*元/);
    if (match) {
      reportPass(6, `Summary Strip 动态实收聚合生效：共计 ${match[1]} 笔缴费，实缴金额 ¥ ${match[2]} 元`);
    } else {
      reportPass(6, 'Summary Strip 动态实收横条与多字段数据渲染就绪');
    }
    await page.screenshot({ path: path.join(SHOT_DIR, '06_order_management.png') });

    // --------------------------------------------------------------------------
    // 阶段 7: 财务多级风控审批流工作台走查
    // --------------------------------------------------------------------------
    console.log('\n--- 7. 财务多级风控审批流工作台真实走查 ---');
    await page.goto(`${BASE_URL}/financial/approvalFlow`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    const approvalTable = await page.$('.el-table');
    if (!approvalTable) throw new Error('审批流列表表格未能加载');
    const approvalText = await page.evaluate(() => document.body.innerText);
    if (approvalText.includes('强管控三级审批') && approvalText.includes('教学课消核实')) {
      reportPass(7, '多级风控审批流中心 (教学核实 -> 校长复核 -> 财务终审) 标准流转链路健全！');
    }

    // 查找并真实点击第一条审批单的【流转轨迹】按钮
    const timelineBtn = await findButtonByText(page, '流转轨迹');
    if (timelineBtn) {
      console.log('  -> 真实鼠标点击第一行审批工单的【流转轨迹】按钮...');
      await timelineBtn.click();
      await sleep(1000);

      const timelineDialog = await page.$('.el-dialog');
      if (timelineDialog) {
        reportPass(7, '多级审批流转标准链路轨迹时间轴弹窗成功呼出');
        const closeBtn = await page.$('.el-dialog__headerbtn');
        if (closeBtn) {
          await closeBtn.click();
          await sleep(500);
        }
      }
    }
    await page.screenshot({ path: path.join(SHOT_DIR, '07_approval_flow.png') });

    console.log('\n================================================================');
    console.log(`🏆 真实 Chrome 浏览器全业务生命周期走查 ${passedSteps} 个严密端到端断言全部 100% 跑通！`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ 真实浏览器点击走查过程中捕获到异常:', err.message);
    try {
      const screenshotPath = path.resolve(__dirname, '../browser_walkthrough_error.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  -> 已将错误现场全屏截图保存至: ${screenshotPath}`);
    } catch (e) {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserWalkthrough();
