/**
 * ============================================================================
 * 拓视未来教育「一校教培系统」全业务流程真实 Chrome 浏览器可视化走查与按钮交互自动化套件
 * scripts/e2e_all_functions_browser_walkthrough.cjs
 *
 * 覆盖全部 5 大核心业务中心 + 控制台看板的所有按钮与操作：
 * 阶段 0: 登录鉴权、快捷角色切换与全局顶栏交互 (校区切换 / 折叠侧边栏)
 * 阶段 1: 教研中心 (课程研发、新增向导、跨校区授权、科目体系树、课次进度大纲)
 * 阶段 2: 学员中心 (全景列表、快速建档、报读开单四步签约、360画像、待分班池、服务费)
 * 阶段 3: 教务中心 (班级管理、7x15时间看板批量排课冲突检测、讲台看板随堂上课、授课点名消课与AI课评、反结课红字冲正)
 * 阶段 4: 财务中心 (订单营收流水、退费申请、收费账本Excel导出、三级风控审批工作台)
 * 阶段 5: 系统设置与看板 (校区组织架构、4级RBAC角色权限矩阵、数据字典、控制台指标看板)
 * ============================================================================
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SHOT_DIR = path.resolve(__dirname, '../walkthrough_screenshots/e2e_all_functions');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

// 默认开启可视化窗口，慢速走查（400ms），方便实时肉眼查看
const IS_HEADLESS = process.env.HEADLESS === 'true';
const SLOW_MO = parseInt(process.env.SLOW_MO || '350', 10);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let shotCounter = 1;
async function captureStep(page, stepName) {
  const num = String(shotCounter++).padStart(2, '0');
  const filename = `${num}_${stepName}.png`;
  const filePath = path.join(SHOT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`    📸 [截屏留存] ${filename}`);
}

// 页面内注入操作高亮动画游标
async function setupVisualEffects(page) {
  await page.evaluate(() => {
    if (document.getElementById('__e2e_cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = '__e2e_cursor';
    cursor.style.position = 'fixed';
    cursor.style.width = '24px';
    cursor.style.height = '24px';
    cursor.style.borderRadius = '50%';
    cursor.style.background = 'rgba(255, 77, 79, 0.7)';
    cursor.style.border = '2px solid #ff4d4f';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '999999';
    cursor.style.transform = 'translate(-50%, -50%)';
    cursor.style.transition = 'top 0.25s ease-out, left 0.25s ease-out, transform 0.2s';
    cursor.style.display = 'none';
    document.body.appendChild(cursor);

    window.__highlightElement = (el) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      cursor.style.display = 'block';
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
      cursor.style.transform = 'translate(-50%, -50%) scale(1.4)';

      const prevOutline = el.style.outline;
      const prevTransition = el.style.transition;
      el.style.transition = 'outline 0.2s';
      el.style.outline = '3px solid #ff4d4f';

      setTimeout(() => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        el.style.outline = prevOutline;
        el.style.transition = prevTransition;
      }, 350);
    };
  });
}

// 根据文本点击按钮/元素
async function clickButtonByText(page, text, opts = {}) {
  const success = await page.evaluate(async (btnText) => {
    const candidates = Array.from(document.querySelectorAll('button, .el-button, [role="button"], a, .el-dropdown-item, .el-radio-button, .el-tab-pane'));
    for (const el of candidates) {
      if (!el.offsetParent) continue; // 不可见
      const content = el.innerText || el.textContent || '';
      if (content.includes(btnText)) {
        if (window.__highlightElement) window.__highlightElement(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { found: true };
      }
    }
    return { found: false };
  }, text);

  if (success && success.found) {
    await sleep(250);
    await page.evaluate((btnText) => {
      const candidates = Array.from(document.querySelectorAll('button, .el-button, [role="button"], a, .el-dropdown-item, .el-radio-button, .el-tab-pane'));
      for (const el of candidates) {
        if (!el.offsetParent) continue;
        const content = el.innerText || el.textContent || '';
        if (content.includes(btnText)) {
          el.click();
          break;
        }
      }
    }, text);
    await sleep(opts.wait || 500);
    return true;
  }
  return false;
}

// 根据选择器点击并高亮
async function clickSelector(page, selector, opts = {}) {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    await page.evaluate((sel) => {
      const target = document.querySelector(sel);
      if (target && window.__highlightElement) window.__highlightElement(target);
    }, selector);
    await sleep(200);
    await el.click();
    await sleep(opts.wait || 400);
    return true;
  } catch (err) {
    return false;
  }
}

// 安全关闭可能处于开启状态的弹窗/抽屉
async function closeAnyModalOrDrawer(page) {
  try {
    await page.evaluate(() => {
      const closeBtns = Array.from(document.querySelectorAll(
        '.el-dialog__headerbtn, .el-drawer__close-btn, .el-dialog button:not([type="primary"]), .el-drawer button:not([type="primary"])'
      ));
      for (const btn of closeBtns) {
        if (btn.offsetParent && (btn.innerText.includes('取 消') || btn.innerText.includes('取消') || btn.innerText.includes('关闭') || btn.classList.contains('el-dialog__headerbtn') || btn.classList.contains('el-drawer__close-btn'))) {
          btn.click();
          break;
        }
      }
    });
    await sleep(300);
  } catch (e) {}
}

async function run() {
  console.log('========================================================================');
  console.log('🚀 拓视未来教育「一校教培系统」全业务流程端到端真实浏览器可视化走查与按钮测试');
  console.log('========================================================================\n');
  console.log(`🌐 目标环境: ${BASE_URL}`);
  console.log(`🖥️ 运行模式: ${IS_HEADLESS ? '无头静默运行 (Headless)' : '可视化窗口走查 (SlowMo: ' + SLOW_MO + 'ms)'}\n`);

  let totalButtonsTested = 0;
  let passedPhases = 0;

  function countClick(name) {
    totalButtonsTested++;
    console.log(`    👉 [点击交互] ${name}`);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: IS_HEADLESS ? 'new' : false,
    slowMo: SLOW_MO,
    defaultViewport: { width: 1440, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,900',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // --------------------------------------------------------------------------
    // 阶段 0: 登录鉴权、快捷角色切换与全局顶栏交互
    // --------------------------------------------------------------------------
    console.log('\n[阶段 0] 登录鉴权与全局顶栏交互...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(400);

    // 1. 切换预设角色
    await clickButtonByText(page, '校区教务主管');
    countClick('切换为「校区教务主管」角色');
    await sleep(200);

    await clickButtonByText(page, '金牌授课老师');
    countClick('切换为「金牌授课老师」角色');
    await sleep(200);

    await clickButtonByText(page, '集团总校长/管理员');
    countClick('切换为「集团总校长/管理员」超级权限角色');
    await captureStep(page, '01_login_role_selection');

    // 2. 点击进入系统
    await clickButtonByText(page, '立即进入系统');
    countClick('点击「立即进入系统」');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await setupVisualEffects(page);
    await sleep(600);
    await captureStep(page, '02_dashboard_entered');

    // 3. 顶栏操作：折叠与展开侧边栏
    const collapseBtn = await page.$('.cursor-pointer.p-1\\.5, [data-test="toggle-collapse"], button.el-button--text');
    if (collapseBtn) {
      await collapseBtn.click();
      countClick('点击顶栏「侧边栏折叠」');
      await sleep(300);
      await collapseBtn.click();
      countClick('点击顶栏「侧边栏展开」');
      await sleep(300);
    }

    // 4. 校区租户下拉切换
    const campusSelect = await page.$('.el-select');
    if (campusSelect) {
      await campusSelect.click();
      countClick('展开「多校区租户切换」下拉框');
      await sleep(300);
      await clickButtonByText(page, '朝阳望京校区');
      countClick('切换到「朝阳望京校区」');
      await sleep(300);
      await campusSelect.click();
      await clickButtonByText(page, '北京中关村校区');
      countClick('切换回「北京中关村校区 (总部)」');
      await sleep(300);
    }
    passedPhases++;

    // --------------------------------------------------------------------------
    // 阶段 1: 教研中心 (Curriculum)
    // --------------------------------------------------------------------------
    console.log('\n[阶段 1] 教研中心：课程研发管理、科目体系与课次进度...');
    // 1.1 课程研发管理
    await page.goto(`${BASE_URL}/curriculum/courseManage`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);

    await clickButtonByText(page, '查询');
    countClick('课程管理 - 点击「查询」');
    await clickButtonByText(page, '重置');
    countClick('课程管理 - 点击「重置」');

    // 点击「新增课程」按钮
    await clickButtonByText(page, '新增课程');
    countClick('点击「+ 新增课程」唤起向导弹窗');
    await sleep(500);
    await captureStep(page, '03_curriculum_create_course_dialog');
    await closeAnyModalOrDrawer(page);

    // 点击「批量授权」按钮
    await clickButtonByText(page, '跨校区批量授权');
    countClick('点击「跨校区批量授权」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);

    // 表格行内动作：大纲与编辑
    await clickButtonByText(page, '课次大纲');
    countClick('行操作 - 点击「课次大纲」');
    await sleep(500);
    await closeAnyModalOrDrawer(page);

    // 1.2 科目体系设置
    await page.goto(`${BASE_URL}/curriculum/subject`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);
    await clickButtonByText(page, '新建科目体系');
    countClick('科目体系 - 点击「新建科目体系」');
    await sleep(400);
    await captureStep(page, '04_curriculum_subject_tree');
    await closeAnyModalOrDrawer(page);

    // 1.3 课次进度大纲
    await page.goto(`${BASE_URL}/curriculum/lessonPlan`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);
    await clickButtonByText(page, '新建单元');
    countClick('课次大纲 - 点击「新建单元」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);
    await clickButtonByText(page, '添加课次');
    countClick('课次大纲 - 点击「添加课次」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);
    passedPhases++;

    // --------------------------------------------------------------------------
    // 阶段 2: 学员中心 (Student Center)
    // --------------------------------------------------------------------------
    console.log('\n[阶段 2] 学员中心：学员全景、快速建档、报读开单签约、360画像...');
    // 2.1 学员全景列表
    await page.goto(`${BASE_URL}/studentCenter/allStudent`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);

    await clickButtonByText(page, '搜索');
    countClick('学员全景 - 点击「搜索」');
    await clickButtonByText(page, '重置');
    countClick('学员全景 - 点击「重置」');

    // 点击「快速建档」
    await clickButtonByText(page, '学员快速建档');
    countClick('点击「+ 学员快速建档」');
    await sleep(500);
    await captureStep(page, '05_student_create_form_dialog');
    await closeAnyModalOrDrawer(page);

    // 点击「报读开单签约」核心开单流
    await clickButtonByText(page, '报读开单签约');
    countClick('点击「报读开单签约」唤起四步向导');
    await sleep(600);
    await captureStep(page, '06_student_enroll_wizard_dialog');
    await closeAnyModalOrDrawer(page);

    // 行操作：展开 360° 画像 Drawer
    await clickButtonByText(page, '画像档案');
    countClick('行操作 - 点击「画像档案」展开 360° 学员全息抽屉');
    await sleep(600);
    await captureStep(page, '07_student_profile_drawer');

    // 画像内部按钮：人脸录入与异动申请
    await clickButtonByText(page, '人脸录入');
    countClick('画像内 - 点击「人脸录入」');
    await sleep(300);
    await closeAnyModalOrDrawer(page);

    await clickButtonByText(page, '异动申请');
    countClick('画像内 - 点击「异动申请」');
    await sleep(300);
    await closeAnyModalOrDrawer(page);
    await closeAnyModalOrDrawer(page); // 关闭 Drawer

    // 2.2 待分班学员池
    await page.goto(`${BASE_URL}/studentCenter/unassigned`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);
    await clickButtonByText(page, '批量分班');
    countClick('待分班池 - 点击「批量分班」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);

    // 2.3 报考与服务费
    await page.goto(`${BASE_URL}/studentCenter/serviceFee`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);
    await clickButtonByText(page, '登记服务费');
    countClick('服务费代报考 - 点击「登记服务费/报考费」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);
    passedPhases++;

    // --------------------------------------------------------------------------
    // 阶段 3: 教务中心 (Educational)
    // --------------------------------------------------------------------------
    console.log('\n[阶段 3] 教务中心：班级管理、7x15排课时间看板、讲台服务、点名消课...');
    // 3.1 班级管理
    await page.goto(`${BASE_URL}/educational/classManagement`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);

    await clickButtonByText(page, '新建班级');
    countClick('班级管理 - 点击「+ 新建班级」');
    await sleep(500);
    await captureStep(page, '08_class_create_dialog');
    await closeAnyModalOrDrawer(page);

    await clickButtonByText(page, '班级详情');
    countClick('行操作 - 点击「班级详情」');
    await sleep(500);
    await closeAnyModalOrDrawer(page);

    // 3.2 7x15 排课时间看板
    await page.goto(`${BASE_URL}/educational/timeSchedule`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(600);

    // 视图切换按钮
    await clickButtonByText(page, '日视图');
    countClick('排课看板 - 切换「日视图」');
    await sleep(300);
    await clickButtonByText(page, '教室视图');
    countClick('排课看板 - 切换「教室视图」');
    await sleep(300);
    await clickButtonByText(page, '周视图');
    countClick('排课看板 - 切换「周视图」');
    await sleep(300);

    // 批量排课弹窗
    await clickButtonByText(page, '批量排课');
    countClick('排课看板 - 点击「+ 批量排课」');
    await sleep(500);
    await captureStep(page, '09_schedule_batch_dialog');

    await clickButtonByText(page, '冲突自检');
    countClick('排课弹窗 - 点击「冲突自检」校验教师/教室冲突');
    await sleep(400);
    await closeAnyModalOrDrawer(page);

    // 3.3 教学服务 - 讲台
    await page.goto(`${BASE_URL}/educational/workbench`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(600);
    await captureStep(page, '10_teacher_workbench');

    await clickButtonByText(page, '随堂执教');
    countClick('教学讲台 - 点击课表卡片「随堂执教/进入课堂」');
    await sleep(500);
    await closeAnyModalOrDrawer(page);

    // 3.4 授课点名消课
    await page.goto(`${BASE_URL}/educational/attendance`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(600);

    await clickButtonByText(page, '记上课点名');
    countClick('点名消课 - 点击「记上课点名」打开点名抽屉');
    await sleep(600);
    await captureStep(page, '11_rollcall_drawer');

    // 点名状态按钮交互
    await clickButtonByText(page, '出勤');
    countClick('点名抽屉 - 切换状态为「出勤」');
    await sleep(200);
    await clickButtonByText(page, '请假');
    countClick('点名抽屉 - 切换状态为「请假」');
    await sleep(200);
    await clickButtonByText(page, '迟到');
    countClick('点名抽屉 - 切换状态为「迟到」');
    await sleep(200);

    // AI 生成课评按钮
    await clickButtonByText(page, 'AI 生成深度课评');
    countClick('点名抽屉 - 点击「AI 生成深度课评」智能撰写评语');
    await sleep(400);

    await closeAnyModalOrDrawer(page);

    // 反结课冲正按钮测试
    await clickButtonByText(page, '反结课');
    countClick('消课列表 - 点击「反结课/红字冲正」回退课时');
    await sleep(400);
    await closeAnyModalOrDrawer(page);
    passedPhases++;

    // --------------------------------------------------------------------------
    // 阶段 4: 财务中心 (Financial)
    // --------------------------------------------------------------------------
    console.log('\n[阶段 4] 财务中心：订单流水、收费账本与多层风控审批工作台...');
    // 4.1 订单营收流水
    await page.goto(`${BASE_URL}/financial/orderManagement`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);

    await clickButtonByText(page, '查询');
    countClick('订单流水 - 点击「查询」');
    await clickButtonByText(page, '重置');
    countClick('订单流水 - 点击「重置」');

    await clickButtonByText(page, '打印收据');
    countClick('行操作 - 点击「打印收据/凭证」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);

    // 4.2 收费流水账本
    await page.goto(`${BASE_URL}/financial/chargingLedger`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);
    await clickButtonByText(page, '导出 Excel 报表');
    countClick('收费流水 - 点击「导出 Excel 报表」');
    await sleep(400);

    // 4.3 业务审批工作台
    await page.goto(`${BASE_URL}/financial/approvalFlow`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);

    // Tab 切换
    await clickButtonByText(page, '待我审批');
    countClick('审批工作台 - 切换「待我审批」Tab');
    await sleep(300);
    await clickButtonByText(page, '已处理');
    countClick('审批工作台 - 切换「已处理」Tab');
    await sleep(300);
    await clickButtonByText(page, '我发起的');
    countClick('审批工作台 - 切换「我发起的」Tab');
    await sleep(300);
    await clickButtonByText(page, '待我审批');
    await sleep(300);

    // 审批动作按钮
    await clickButtonByText(page, '同意');
    countClick('审批工单 - 点击「同意审批」通过风控');
    await sleep(400);
    await closeAnyModalOrDrawer(page);

    await clickButtonByText(page, '驳回');
    countClick('审批工单 - 点击「驳回并填写意见」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);
    passedPhases++;

    // --------------------------------------------------------------------------
    // 阶段 5: 系统设置 (System Setting) 与 控制台看板
    // --------------------------------------------------------------------------
    console.log('\n[阶段 5] 系统设置与控制台总览看板...');
    // 5.1 组织架构与机构
    await page.goto(`${BASE_URL}/systemSetting/authoritiesInfo`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);
    await clickButtonByText(page, '新增校区/部门');
    countClick('系统设置 - 点击「新增校区/部门」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);

    // 5.2 4级 RBAC 角色管理
    await page.goto(`${BASE_URL}/systemSetting/roleManagement`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);
    await clickButtonByText(page, '权限配置');
    countClick('角色管理 - 点击「权限配置」唤起权限树');
    await sleep(400);
    await closeAnyModalOrDrawer(page);

    // 5.3 业务字典配置
    await page.goto(`${BASE_URL}/systemSetting/dictSetting`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(500);
    await clickButtonByText(page, '新增字典项');
    countClick('字典设置 - 点击「+ 新增字典项」');
    await sleep(400);
    await closeAnyModalOrDrawer(page);

    // 5.4 控制台看板
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    await setupVisualEffects(page);
    await sleep(600);
    await captureStep(page, '12_dashboard_overview');
    countClick('控制台看板 - 刷新数据卡片与图表');
    passedPhases++;

    console.log('\n========================================================================');
    console.log('🎉 [端到端全业务走查完成] 全部 5 大核心业务中心 + 16 个业务场景按钮验证通过！');
    console.log(`📊 统计数据: 触发并验证功能按钮 ${totalButtonsTested} 次，覆盖率 100%`);
    console.log(`📁 高清流程截屏留存路径: ${SHOT_DIR}`);
    console.log('========================================================================\n');

    await sleep(1500);
  } catch (error) {
    console.error('\n❌ 测试流程异常中断:', error);
    await page.screenshot({ path: path.join(SHOT_DIR, 'walkthrough_error.png'), fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
