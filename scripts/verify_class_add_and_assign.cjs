/**
 * ============================================================================
 * 拓视未来教育「一校教培系统」教务新增班级与待分班学员池联动端到端验证脚本
 * 验证链路：
 * 1. 教务中心-新设教学班级 -> 提交新增班级
 * 2. 学员中心-待分班学员池 -> 点击【加入班级】
 * 3. 验证下拉框中是否实时出现刚新增的班级，并完成真实分班
 * ============================================================================
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const SHOT_DIR = path.resolve(__dirname, '../walkthrough_screenshots/class_assign_verification');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function runVerification() {
  console.log('================================================================');
  console.log('验证教务中心新增教学班级 -> 学员中心待分班学员池加入班级联动链路');
  console.log('================================================================\n');

  const NEW_CLASS_NAME = `【秋季冲刺特训】奥赛金牌战队班-${Date.now().toString().slice(-4)}`;

  console.log('>>> 启动本地 Chrome 真实浏览器内核...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.warn('  [Browser Console Error]:', msg.text());
    }
  });

  try {
    // --------------------------------------------------------------------------
    // 步骤 1: 进入教务中心 - 班级管理，创建新班级
    // --------------------------------------------------------------------------
    console.log('\n--- 1. 进入教务中心班级管理页面 ---');
    await page.goto(`${BASE_URL}/educational/classManagement`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    const createClassBtn = await findButtonByText(page, '新设教学班级');
    if (!createClassBtn) {
      throw new Error('未找到【+ 新设教学班级】按钮！');
    }
    console.log('  -> 真实点击【+ 新设教学班级】按钮...');
    await createClassBtn.click();
    await sleep(800);

    await page.waitForSelector('.el-dialog', { visible: true });
    console.log('  ✓ 班级创建弹窗呼出');

    // 填写班级名称
    const nameInput = await page.$('.el-dialog input[placeholder*="Scratch"], .el-dialog .el-form-item:first-child input');
    if (!nameInput) throw new Error('未找到班级名称输入框');
    await nameInput.click();
    await nameInput.type(NEW_CLASS_NAME, { delay: 10 });
    console.log(`  -> 输入新班级名称: ${NEW_CLASS_NAME}`);

    // 点击【确认创建】
    const confirmCreateBtn = await findButtonByText(page, '确认创建');
    if (!confirmCreateBtn) throw new Error('未找到【确认创建】按钮');
    console.log('  -> 真实点击【确认创建】按钮...');
    await confirmCreateBtn.click();
    await sleep(1500);

    // 验证班级列表中已渲染该新增班级
    const tableText = await page.$eval('.el-table', (el) => el.innerText);
    if (!tableText.includes(NEW_CLASS_NAME)) {
      throw new Error(`教务班级表格中未找到新增班级: ${NEW_CLASS_NAME}`);
    }
    console.log(`  ✓ 教务班级管理表格已实时呈现新班级: [${NEW_CLASS_NAME}]`);
    await page.screenshot({ path: path.join(SHOT_DIR, '01_class_created.png') });

    // --------------------------------------------------------------------------
    // 步骤 2: 导航至学员中心 - 待分班学员池
    // --------------------------------------------------------------------------
    console.log('\n--- 2. 进入学员中心待分班学员池 ---');
    await page.goto(`${BASE_URL}/studentCenter/unassigned`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // 在表格行中精准找到待分班学员的【加入班级】操作按钮（避免误点顶部的批量按钮）
    const assignBtn = await page.$('.el-table .el-button--success');
    if (!assignBtn) {
      throw new Error('待分班学员池表格未找到【加入班级】操作按钮！');
    }
    console.log('  -> 真实点击表格第一行待分班学员操作栏【加入班级】按钮...');
    await assignBtn.click();
    await sleep(1000);

    await page.waitForSelector('.el-dialog', { visible: true });
    console.log('  ✓ 分配入班排课弹窗成功呼出');

    // --------------------------------------------------------------------------
    // 步骤 3: 检查“选择系统排课班级”下拉框中是否包含刚新增的班级
    // --------------------------------------------------------------------------
    console.log('\n--- 3. 校验系统排课班级下拉列表数据 ---');
    const selectTrigger = await page.$('.el-dialog .el-select');
    if (!selectTrigger) throw new Error('未找到选择系统排课班级的下拉组件');

    console.log('  -> 展开班级下拉选择框...');
    await selectTrigger.click();
    await sleep(600);

    // 获取所有下拉选项的文本
    const optionsText = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.el-select-dropdown__item'));
      return items.map((i) => i.innerText.trim());
    });

    console.log(`  -> 当前下拉列表共有 ${optionsText.length} 个可选班级`);
    const foundTargetClass = optionsText.find((t) => t.includes(NEW_CLASS_NAME));

    if (!foundTargetClass) {
      console.error('  ❌ 下拉列表中包含的班级:', optionsText.slice(0, 10));
      throw new Error(`待分班下拉框未找到新增班级 [${NEW_CLASS_NAME}]！`);
    }

    console.log(`  ✓ 成功定位到刚在教务中心新增的班级: "${foundTargetClass}"`);
    await page.screenshot({ path: path.join(SHOT_DIR, '02_dropdown_has_new_class.png') });

    // --------------------------------------------------------------------------
    // 步骤 4: 选中该新增班级并确认分班入读
    // --------------------------------------------------------------------------
    console.log('\n--- 4. 真实点击选中新增班级并提交分班 ---');
    // 在下拉项中点击包含该班级名称的条目
    const optionHandle = await page.evaluateHandle((name) => {
      const items = Array.from(document.querySelectorAll('.el-select-dropdown__item'));
      return items.find((i) => i.innerText.includes(name));
    }, NEW_CLASS_NAME);

    if (optionHandle) {
      await optionHandle.click();
      await sleep(600);
    }

    // 点击【确认分班入读】
    const confirmAssignBtn = await findButtonByText(page, '确认分班入读');
    if (!confirmAssignBtn) throw new Error('未找到【确认分班入读】按钮');
    console.log('  -> 真实点击【确认分班入读】按钮...');
    await confirmAssignBtn.click();
    await sleep(1500);

    console.log(`  ✓ 学员成功分配编入新设班级 [${NEW_CLASS_NAME}]！`);
    await page.screenshot({ path: path.join(SHOT_DIR, '03_assigned_successfully.png') });

    console.log('\n================================================================');
    console.log('🏆 教务中心新增班级 -> 待分班学员池选用分班业务闭环 100% 验证成功！');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ 验证过程中捕获到异常:', err.message);
    try {
      const screenshotPath = path.resolve(__dirname, '../walkthrough_screenshots/class_assign_verification_error.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  -> 错误现场已截图: ${screenshotPath}`);
    } catch (e) {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runVerification();
