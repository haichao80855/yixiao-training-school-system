const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '../walkthrough_screenshots/enroll_fix');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 启动 Chrome 走查验证学员签约报读二次打开第4步与刷新丢课包Bug修复...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    console.log('📍 步骤 1：访问学员中心页面...');
    await page.goto('http://localhost:5173/studentCenter/allStudent', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    // 步骤 2：录入一个全新学员以做独立全生命周期隔离测试
    console.log('📍 步骤 2：新增测试建档学员【测试生-李明辉】...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addBtn = buttons.find(b => b.textContent && b.textContent.includes('新增学员'));
      if (addBtn) addBtn.click();
      else throw new Error('未找到新增学员按钮');
    });
    await new Promise(r => setTimeout(r, 800));

    // 填写学员姓名和手机
    await page.evaluate(() => {
      const nameInput = document.querySelector('input[placeholder="请输入姓名"]');
      if (nameInput) {
        nameInput.value = '测试生-李明辉';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const phoneInput = document.querySelector('input[placeholder="11位手机号"]');
      if (phoneInput) {
        phoneInput.value = '13812345678';
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // 点击提交建档
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-dialog button'));
      const submitBtn = btns.find(b => b.textContent && b.textContent.includes('立即建档'));
      if (submitBtn) submitBtn.click();
      else throw new Error('未找到立即建档按钮');
    });
    await new Promise(r => setTimeout(r, 1200));

    // 步骤 3：对【测试生-李明辉】执行首次签约报读
    console.log('📍 步骤 3：为【测试生-李明辉】执行四步签约报读开单向导...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.el-table__body-wrapper tr'));
      const targetRow = rows.find(r => r.textContent && r.textContent.includes('测试生-李明辉'));
      if (!targetRow) throw new Error('列表未找到新学员【测试生-李明辉】');
      const enrollBtn = Array.from(targetRow.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('报读'));
      if (enrollBtn) enrollBtn.click();
      else throw new Error('未找到报读操作按钮');
    });
    await new Promise(r => setTimeout(r, 800));

    // 向导第 1 步 -> 点击下一步
    console.log('  向导 Step 1: 确认学员与校区 -> 下一步');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-dialog button'));
      const nextBtn = btns.find(b => b.textContent && b.textContent.trim() === '下一步');
      if (nextBtn) nextBtn.click();
      else throw new Error('向导第1步未找到下一步按钮');
    });
    await new Promise(r => setTimeout(r, 600));

    // 向导第 2 步 -> 点击下一步
    console.log('  向导 Step 2: 课程与课时配置 -> 下一步');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-dialog button'));
      const nextBtn = btns.find(b => b.textContent && b.textContent.trim() === '下一步');
      if (nextBtn) nextBtn.click();
      else throw new Error('向导第2步未找到下一步按钮');
    });
    await new Promise(r => setTimeout(r, 600));

    // 向导第 3 步 -> 点击下一步
    console.log('  向导 Step 3: 折扣减免核算 -> 下一步');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-dialog button'));
      const nextBtn = btns.find(b => b.textContent && b.textContent.trim() === '下一步');
      if (nextBtn) nextBtn.click();
      else throw new Error('向导第3步未找到下一步按钮');
    });
    await new Promise(r => setTimeout(r, 600));

    // 向导第 4 步 -> 点击确认签约收款并入库
    console.log('  向导 Step 4: 支付结算 -> 点击【确认签约收款并入库】');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-dialog button'));
      const submitBtn = btns.find(b => b.textContent && b.textContent.includes('确认签约收款并入库'));
      if (submitBtn) submitBtn.click();
      else throw new Error('未找到签约入库确认按钮');
    });
    await new Promise(r => setTimeout(r, 1500));

    // 检查首次报读后表格中李明辉的课包显示
    const checkAfterEnroll = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.el-table__body-wrapper tr'));
      const targetRow = rows.find(r => r.textContent && r.textContent.includes('测试生-李明辉'));
      return targetRow ? targetRow.textContent : '';
    });
    console.log('  首次报读后李明辉数据:', checkAfterEnroll);
    if (!checkAfterEnroll.includes('课时') || checkAfterEnroll.includes('暂无有效课包')) {
      throw new Error('首次报读后列表未显示有效在读课包！');
    }
    console.log('  ✅ 首次报读成功，在读课包即时生效！');

    // 步骤 4：核心断言 1 —— 再次点击【报读】，核验是否会直接跳到第 4 步
    console.log('📍 步骤 4：【关键缺陷验证 1】对同一学员再次点击【报读】，验证是否回到第 1 步...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.el-table__body-wrapper tr'));
      const targetRow = rows.find(r => r.textContent && r.textContent.includes('测试生-李明辉'));
      const enrollBtn = Array.from(targetRow.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('报读'));
      enrollBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // 提取当前步骤指示器的状态
    const stepAudit = await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      if (!dialog) return { found: false };
      const dialogText = dialog.textContent || '';
      // 检查当前显示的表单内容标题
      const isStep1 = dialogText.includes('第 1 步：确认报读学员与合同签约校区');
      const isStep4 = dialogText.includes('第 4 步：结算清单');
      return { found: true, isStep1, isStep4, text: dialogText.substring(0, 120) };
    });

    console.log('  二次打开弹窗步骤检测:', stepAudit);
    if (stepAudit.isStep4) {
      throw new Error('❌ 缺陷复现：再次点击报读直接显示第 4 步支付结算页！');
    }
    if (!stepAudit.isStep1) {
      throw new Error('❌ 再次点击报读未回到第 1 步！');
    }
    console.log('  ✅ 缺陷 1 已彻底修复：再次打开报读弹窗从第 1 步重新开始！');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_enroll_reopened_step1_success.png') });

    // 关闭报读弹窗
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-dialog button'));
      const cancelBtn = btns.find(b => b.textContent && b.textContent.includes('取消'));
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // 步骤 5：核心断言 2 —— 刷新浏览器页面后，核验在读课包与剩余课时是否丢失
    console.log('📍 步骤 5：【关键缺陷验证 2】模拟浏览器真实 F5 刷新页面 (page.reload)...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // 检查刷新后表格中李明辉的课包与剩余课时
    const checkAfterReload = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.el-table__body-wrapper tr'));
      const targetRow = rows.find(r => r.textContent && r.textContent.includes('测试生-李明辉'));
      if (!targetRow) return { found: false };
      const text = targetRow.textContent || '';
      const hasNoPackage = text.includes('暂无有效课包');
      const hasLessons = text.includes('课时') && !hasNoPackage;
      return { found: true, text, hasNoPackage, hasLessons };
    });

    console.log('  刷新后学员行检查结果:', checkAfterReload);
    if (!checkAfterReload.found) {
      throw new Error('刷新后未找到测试学员【测试生-李明辉】！');
    }
    if (checkAfterReload.hasNoPackage || !checkAfterReload.hasLessons) {
      throw new Error('❌ 缺陷复现：刷新页面后在读课包与剩余课时变为空！');
    }
    console.log('  ✅ 缺陷 2 已彻底修复：刷新页面后在读课包与剩余课时完整持久化完好！');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_reloaded_packages_persisted_success.png') });

    // 步骤 6：打开 360° 学员画像抽屉，核验证照和课包流水
    console.log('📍 步骤 6：打开 360° 画像抽屉核验课包资产深度明细...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.el-table__body-wrapper tr'));
      const targetRow = rows.find(r => r.textContent && r.textContent.includes('测试生-李明辉'));
      const drawerBtn = Array.from(targetRow.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('360°画像'));
      drawerBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const drawerCheck = await page.evaluate(() => {
      const drawer = document.querySelector('.el-drawer');
      const text = drawer ? drawer.textContent : '';
      return {
        hasTitle: text.includes('测试生-李明辉'),
        hasActivePackage: text.includes('有效课包') || text.includes('课包') || text.includes('C++编程集训课'),
        hasHours: text.includes('课时') && (text.includes('68') || text.includes('64'))
      };
    });
    console.log('  360°抽屉核验结果:', drawerCheck);
    if (!drawerCheck.hasActivePackage || !drawerCheck.hasHours) {
      throw new Error('360°画像抽屉中未正确展示持久化的课包明细！');
    }
    console.log('  ✅ 360°画像抽屉中课包资产明细 100% 正常！');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_drawer_profile_persisted_success.png') });

    console.log('\n🎉 [PASS] 学员报读二次打开跳步缺陷 & 刷新丢课包缺陷已全部完美修复并通过浏览器真机核验！');
  } catch (err) {
    console.error('❌ 执行失败:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
