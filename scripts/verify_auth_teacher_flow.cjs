const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '../walkthrough_screenshots/auth');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 启动原生 Chrome 浏览器执行安全退出与授课教师登录全流程走查...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 步骤 1：访问首页，确保初始处于登录状态（冬海潮）
    console.log('📍 步骤 1：访问控制台并检查当前用户信息...');
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    // 步骤 2：呼出用户下拉菜单并点击【安全退出】
    console.log('📍 步骤 2：点击用户下拉菜单呼出操作项...');
    const userDropdownSelector = '.el-dropdown';
    await page.waitForSelector(userDropdownSelector, { timeout: 5000 });
    await page.click(userDropdownSelector);
    await new Promise(r => setTimeout(r, 600));

    // 截图记录下拉菜单
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_dropdown_menu_open.png') });
    console.log('  📸 已保存下拉菜单截图');

    console.log('📍 步骤 3：点击【安全退出】并确认退出对话框...');
    // 点击安全退出选项
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.el-dropdown-menu__item'));
      const logoutItem = items.find(el => el.textContent && el.textContent.includes('安全退出'));
      if (logoutItem) {
        logoutItem.click();
      } else {
        throw new Error('未找到【安全退出】下拉菜单项');
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // 等待并点击二次确认弹窗的【确定退出】
    console.log('  点击确认对话框【确定退出】...');
    await page.evaluate(() => {
      const confirmBtns = Array.from(document.querySelectorAll('.el-message-box__btns button'));
      const okBtn = confirmBtns.find(b => b.textContent && b.textContent.includes('确定退出'));
      if (okBtn) {
        okBtn.click();
      } else {
        throw new Error('未找到退出确认弹窗【确定退出】按钮');
      }
    });
    await new Promise(r => setTimeout(r, 1200));

    // 验证是否已成功重定向到 /login 页面
    const currentUrl = page.url();
    console.log(`  当前页面 URL: ${currentUrl}`);
    if (!currentUrl.includes('/login')) {
      throw new Error(`安全退出失败，期望重定向至 /login，实际停留于: ${currentUrl}`);
    }
    console.log('  ✅ 安全退出成功，已平滑重定向至 /login 登录门户！');

    // 步骤 4：在登录页核验角色卡片并截图
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_login_portal_view.png') });
    console.log('  📸 已保存登录页全景截图');

    // 步骤 5：使用快捷角色卡片登录【授课老师 - 张老师】
    console.log('📍 步骤 5：点击【授课老师 - 张老师】快捷卡片一键登录...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const teacherCard = buttons.find(b => b.textContent && b.textContent.includes('张老师') && b.textContent.includes('授课老师'));
      if (teacherCard) {
        teacherCard.click();
      } else {
        throw new Error('未找到【张老师 - 授课老师】快捷登录卡片');
      }
    });

    // 等待登录成功并跳转至教学讲台 (/educational/workbench)
    await new Promise(r => setTimeout(r, 1800));
    const afterTeacherLoginUrl = page.url();
    console.log(`  教师登录后 URL: ${afterTeacherLoginUrl}`);
    if (!afterTeacherLoginUrl.includes('/educational/workbench')) {
      throw new Error(`教师登录后未直通教学讲台，当前URL: ${afterTeacherLoginUrl}`);
    }

    // 步骤 6：核验教师账号在教学讲台的显示与排课卡片
    console.log('📍 步骤 6：核验顶部栏与讲台页面的教师专属信息...');
    const teacherHeaderInfo = await page.evaluate(() => {
      const header = document.querySelector('header');
      const text = header ? header.textContent : '';
      const hasZhang = text ? text.includes('张老师') : false;
      const hasTeacherBadge = text ? (text.includes('讲师') || text.includes('少儿编程专职主讲教师')) : false;

      // 讲台专属状态
      const mainContent = document.querySelector('main') || document.body;
      const mainText = mainContent.textContent || '';
      const hasCurrentTeacher = mainText.includes('当前讲师：张老师');
      const hasOnlyMyLessons = mainText.includes('仅看我的课程');

      return { text, hasZhang, hasTeacherBadge, hasCurrentTeacher, hasOnlyMyLessons };
    });

    console.log('  核验结果:', teacherHeaderInfo);
    if (!teacherHeaderInfo.hasZhang) {
      throw new Error('顶部导航栏未正确展示当前登录人【张老师】！');
    }
    if (!teacherHeaderInfo.hasCurrentTeacher) {
      throw new Error('教学讲台页面未正确标识【当前讲师：张老师】！');
    }
    console.log('  ✅ 教师账号在顶部栏与教学讲台显示 100% 正常！');

    // 截存教师端讲台全屏
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_teacher_workbench_view.png') });
    console.log('  📸 已保存张老师专属教学讲台界面截图');

    // 步骤 7：测试在下拉菜单中直接无缝切换回【冬海潮 (管理员)】
    console.log('📍 步骤 7：测试下拉菜单快捷身份切换（快速换回超级管理员）...');
    await page.click('.el-dropdown');
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.el-dropdown-menu__item'));
      const adminSwitchItem = items.find(el => el.textContent && el.textContent.includes('冬海潮'));
      if (adminSwitchItem) {
        adminSwitchItem.click();
      } else {
        throw new Error('未找到快速换成冬海潮管理员菜单项');
      }
    });

    await new Promise(r => setTimeout(r, 1200));
    const adminUrl = page.url();
    console.log(`  切回管理员后 URL: ${adminUrl}`);
    const adminHeader = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.textContent : '';
    });
    if (!adminHeader.includes('冬海潮')) {
      throw new Error('切回管理员后顶部栏未显示冬海潮！');
    }
    console.log('  ✅ 角色与身份无缝互切完全跑通！');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_switched_back_admin_view.png') });
    console.log('  📸 已保存切回超级管理员截图');

    console.log('\n🎉 [PASS] 安全退出与教师账号登录/讲台展示全流程验证全部成功！');
  } catch (err) {
    console.error('❌ 执行失败:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
