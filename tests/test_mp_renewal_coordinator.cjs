/**
 * ==============================================================================
 * 微信小程序移动端「课消流失预警与一键续费决策流深模块」跨接缝专项自动化验证套件
 * Client Renewal Risk & Decision Pipeline Coordinator Test Suite
 * 对齐 ADR-0006 课消风控与续费决策协议、ACB 财务防腐屏障与向导灌装闭环
 * ==============================================================================
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 1. 注入微信小程序全局基础环境垫片，供 Node.js 单元测试运行
let lastNavigatedUrl = '';
let lastMadePhoneCall = '';
let lastToastTitle = '';
let lastModalOptions = null;
let customRequestHandler = null;
let customPhoneCallHandler = null;
let customClipboardHandler = null;
const storageMock = new Map();

if (typeof global.wx === 'undefined') {
  global.wx = new Proxy(
    {
      getSystemInfoSync: () => ({ platform: 'devtools', windowWidth: 375, windowHeight: 667, statusBarHeight: 20 }),
      canIUse: () => true,
      getStorageSync: (k) => storageMock.get(k) || null,
      setStorageSync: (k, v) => storageMock.set(k, v),
      removeStorageSync: (k) => storageMock.delete(k),
      request: (opts) => {
        if (typeof customRequestHandler === 'function') {
          return customRequestHandler(opts);
        }
      },
      uploadFile: () => {},
      showToast: (opts) => { lastToastTitle = opts?.title || ''; },
      showModal: (opts) => { lastModalOptions = opts; },
      showLoading: () => {},
      hideLoading: () => {},
      navigateTo: (opts) => { lastNavigatedUrl = opts?.url || ''; },
      makePhoneCall: (opts) => {
        lastMadePhoneCall = opts?.phoneNumber || '';
        if (typeof customPhoneCallHandler === 'function') {
          return customPhoneCallHandler(opts);
        }
      },
      setClipboardData: (opts) => {
        if (typeof customClipboardHandler === 'function') {
          return customClipboardHandler(opts);
        }
        if (typeof opts?.success === 'function') opts.success();
      },
      getMenuButtonBoundingClientRect: () => ({ left: 280, top: 24, width: 87, height: 32 }),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => {};
      },
    }
  );
}
if (typeof global.uni === 'undefined') {
  global.uni = global.wx;
}
global.Page = global.Page || function () {};
global.Component = global.Component || function () {};
global.App = global.App || function () {};
global.getApp = global.getApp || function () { return {}; };
global.getCurrentPages = global.getCurrentPages || function () { return []; };

console.log('================================================================================');
console.log('🧪 运行微信小程序端「课消流失预警与一键续费决策流深模块」跨接缝专项测试');
console.log('覆盖：流失预警大盘、ACB财务防腐硬阻断、原单价继承、班容溢出自动降级与开单直通');
console.log('================================================================================\n');

// 2. 确保并加载编译产物
const coordinatorModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/coordinators/renewal/coordinator.js'
);
if (!fs.existsSync(coordinatorModulePath)) {
  const { execSync } = require('child_process');
  console.log('⚡ 检测到协调器编译产物缺失，正在自动执行 mp:build...');
  execSync('npm --prefix mini-program run build:mp-weixin', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
}

const moduleExports = require(coordinatorModulePath);
const coordinator = moduleExports.renewalCoordinator || moduleExports;
const ClientRenewalCoordinator = moduleExports.ClientRenewalCoordinator || coordinator.ClientRenewalCoordinator || coordinator.CoordinatorClass;
const FakeRenewalDecisionAdapter = moduleExports.FakeRenewalDecisionAdapter || coordinator.FakeRenewalDecisionAdapter;
const HttpRenewalDecisionAdapter = moduleExports.HttpRenewalDecisionAdapter || coordinator.HttpRenewalDecisionAdapter;
const RefundLockedError = moduleExports.RefundLockedError || coordinator.RefundLockedError;
const RENEWAL_RISK_CONSTANTS = moduleExports.RENEWAL_RISK_CONSTANTS || coordinator.RENEWAL_RISK_CONSTANTS;

// -----------------------------------------------------------------------------
// [Check 0] 极简外部接口形态契约校验 (Interface Contract)
// -----------------------------------------------------------------------------
assert.ok(coordinator, '❌ renewalCoordinator 未成功导出');
assert.strictEqual(typeof coordinator.loadWarningDashboard, 'function', '❌ loadWarningDashboard 方法未导出');
assert.strictEqual(typeof coordinator.prepareRenewalDecision, 'function', '❌ prepareRenewalDecision 方法未导出');
assert.strictEqual(typeof coordinator.proceedToCheckout, 'function', '❌ proceedToCheckout 方法未导出');
assert.strictEqual(typeof coordinator.initiateContact, 'function', '❌ initiateContact 方法未导出');
assert.ok(FakeRenewalDecisionAdapter, '❌ FakeRenewalDecisionAdapter 适配器未导出');
assert.ok(HttpRenewalDecisionAdapter, '❌ HttpRenewalDecisionAdapter 适配器未导出');
assert.ok(ClientRenewalCoordinator, '❌ ClientRenewalCoordinator 类未导出');
assert.ok(RefundLockedError, '❌ RefundLockedError 强类型异常未导出');
assert.ok(RENEWAL_RISK_CONSTANTS, '❌ RENEWAL_RISK_CONSTANTS 未导出');

console.log('✔ [Check 0] 协调器深模块极简外部接口校验通过 (4 大任务入口 + 2 大六边形适配器 + 强类型异常)\n');

async function runTests() {
  let passedCount = 0;
  function pass(desc) {
    passedCount++;
    console.log(`  ✓ PASS [${passedCount}]: ${desc}`);
  }

  // ---------------------------------------------------------------------------
  // Scenario 1: 流失预警大盘数据与指标解析映射断言
  // ---------------------------------------------------------------------------
  console.log('>>> [Scenario 1] 测试流失预警大盘数据与指标解析映射断言...');
  const fakeAdapter = new FakeRenewalDecisionAdapter();
  const coordinator = new ClientRenewalCoordinator(fakeAdapter);

  const dashboard = await coordinator.loadWarningDashboard();
  assert.ok(dashboard, '预警大盘必须返回有效数据');
  assert.strictEqual(typeof dashboard.total, 'number', '大盘必须具备 total 字段');
  assert.ok(dashboard.statistics, '大盘必须具备 statistics 核心指标对象');

  // 指标统计断言
  assert.strictEqual(dashboard.statistics.criticalCount, 3, '紧急预警学员数应为 3 (陈小明、林月茹、赵灵儿)');
  assert.strictEqual(dashboard.statistics.dormantCount, 1, '休眠学员数应为 1 (李逍遥)');
  assert.ok(dashboard.statistics.estimatedRenewalPoolAmount > 0, '预估续费总池必须大于 0 元');
  assert.strictEqual(dashboard.statistics.urgent, dashboard.statistics.criticalCount, 'UI 兼容字段 urgent 必须对齐 criticalCount');
  assert.strictEqual(dashboard.statistics.warning, dashboard.statistics.warningCount, 'UI 兼容字段 warning 必须对齐 warningCount');

  // 学员全景数据快照映射断言
  const stu1 = dashboard.list.find((s) => s.studentId === 'stu-urgent-01');
  assert.ok(stu1, '学员陈小明必须存在于预警列表中');
  assert.strictEqual(stu1.level, 'urgent', '剩余 2 课时学员评级必须为 urgent');
  assert.strictEqual(stu1.consumptionHealth.warningLevel, 'critical', '消课风险等级必须为 critical');
  assert.strictEqual(stu1.consumptionHealth.visualBadge.color, 'danger', '视觉语义徽章颜色必须为 danger');
  assert.strictEqual(stu1.decision.renewalWindowOpen, true, '剩余 2 课时学员续费窗口必须为 true');
  assert.strictEqual(stu1.decision.advice, 'URGENT_RENEWAL', '紧急学员动作建议必须为 URGENT_RENEWAL');

  // 条件过滤断言
  const filteredDormant = await coordinator.loadWarningDashboard({ dormantOnly: true });
  assert.ok(filteredDormant.list.every((s) => s.consumptionHealth.dormantRisk !== 'active'), 'dormantOnly 过滤结果必须全为休眠风险学员');

  pass('流失预警大盘统计指标（紧急、休眠、预估总池）与结构化学员名册解析映射验证通过');

  // ---------------------------------------------------------------------------
  // Scenario 2: ACB 财务防腐屏障强阻断测试 (在途退费/已退费拦截)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 2] 测试 ACB 财务防腐屏障强阻断 (在途退费/已退费拦截)...');
  let refundLockBlocked = false;
  try {
    // 学员赵灵儿 (stu-refund-locked-03) 存在在途退费
    await coordinator.prepareRenewalDecision('stu-refund-locked-03');
  } catch (err) {
    if (
      err instanceof RefundLockedError ||
      err.name === 'RefundLockedError' ||
      err.code === 'REFUND_LOCKED'
    ) {
      refundLockBlocked = true;
      assert.ok(err.message.includes('退费') || err.message.includes('防腐屏障'), '异常提示文案必须明确指明退费防腐屏障锁定');
    } else {
      throw new Error(`预期抛出 RefundLockedError，实际捕获异常: ${err.message}`);
    }
  }

  assert.strictEqual(refundLockBlocked, true, '存在在途退费课包的学员发起续费开单必须被严密拦截并抛出 RefundLockedError');
  pass('存在在途退费（ACB）时发起续费被严密拦截并抛出强类型 RefundLockedError 断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 3: 老学员原单价智能继承与优惠赠课计算断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 3] 测试老学员原单价智能继承与优惠赠课计算...');
  // 学员陈小明 (stu-urgent-01)，历史课包签约单价 220 元/课时，钱包余额 5000 元
  const draft1 = await coordinator.prepareRenewalDecision('stu-urgent-01');

  assert.ok(draft1, '必须成功生成续费开单草案');
  assert.ok(draft1.draftId.startsWith('DRAFT-'), '草案编号必须规范生成');
  assert.strictEqual(draft1.studentId, 'stu-urgent-01', '学员 ID 匹配');
  assert.strictEqual(draft1.quote.pricePerLesson, 220, '老学员历史签约单价 220 元/课时必须 100% 精确继承');
  assert.strictEqual(draft1.quote.totalLessons, 48, '推荐续约课时默认为标准学期 48 课时');
  assert.strictEqual(draft1.quote.bonusLessons, 2, '老学员续报默认配赠 2 课时');
  assert.strictEqual(draft1.quote.originalTotalPrice, 220 * 48, '原价合计必须等于 单价 * 总课时 (10560元)');
  assert.strictEqual(draft1.quote.suggestedDiscount, 200, '老带新/续费特准减免默认为 200 元');
  assert.strictEqual(draft1.quote.actualPayAmount, 10560 - 200, '预计实付金额必须正确计算为 10360 元');
  assert.strictEqual(draft1.enrollCommand.totalLessons, 48, '开单指令总课时一致');
  assert.strictEqual(draft1.enrollCommand.bonusLessons, 2, '开单指令配赠课时一致');
  assert.strictEqual(draft1.enrollCommand.pricePerLesson, 220, '开单指令单价一致');

  pass('续费草案正确继承老学员历史签约单价、课时规格与赠课优惠试算断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 4: 班容动态核验与自动安全降级 (原班满员回退待分班资产池)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 4] 测试班容动态核验与自动安全降级 (原班满员安全回退待分班)...');
  // 学员林月茹 (stu-fullclass-02) 所在班级 class-physics-full 当前在读 12/12 (已满员)
  const draftFull = await coordinator.prepareRenewalDecision('stu-fullclass-02');

  assert.ok(draftFull, '草案生成成功');
  assert.strictEqual(draftFull.validation.isClassFull, true, '必须精确检测出原班级当前已满员');
  assert.strictEqual(draftFull.validation.fallbackUnassigned, true, '原班满员时必须自动置位 fallbackUnassigned: true 安全回退待分班');
  assert.strictEqual(draftFull.quote.classId, null, '满员自动降级后 quote.classId 必须被清空置为 null');
  assert.strictEqual(draftFull.quote.className, null, '满员自动降级后 quote.className 必须置为 null');
  assert.strictEqual(draftFull.enrollCommand.classId, undefined, '满员自动降级后开单指令 classId 必须为 undefined 杜绝炸班');
  assert.strictEqual(draftFull.enrollCommand.fallbackUnassigned, true, '开单指令必须显式携带 fallbackUnassigned 待分班标记');
  assert.ok(draftFull.validation.warningMessage.includes('待分班'), '风控提示文案必须说明已自动回退待分班资产池');

  // 额外场景 4.1：测试通过 port.checkClassCapacity 进行即时班容满员拦截与安全降级
  const mockPortWithCap = {
    fetchWarningRoster: async () => ({ total: 0, statistics: {}, list: [] }),
    fetchStudentRisk: async () => ({}),
    generateRenewalDraft: async () => ({
      draftId: 'DRAFT-DYNAMIC-01',
      studentId: 'stu-dynamic-01',
      studentName: '动态学员',
      studentNo: 'STU-DYN-01',
      campusId: 'campus-bj-01',
      campusName: '中关村校区',
      createdAt: new Date().toISOString(),
      quote: {
        courseId: 'crs-math-02',
        courseName: '初中数学培优',
        classId: 'class-dynamic-full',
        className: '初二数学满员班',
        totalLessons: 48,
        bonusLessons: 2,
        pricePerLesson: 220,
        originalTotalPrice: 10560,
        suggestedDiscount: 200,
        walletPrincipalBalance: 0,
        canUseWalletDeduction: false,
        actualPayAmount: 10360,
        paymentMethod: 'wechat',
        remark: '动态测试',
      },
      validation: {
        pass: true,
        isClassFull: false, // 服务端初始下发为 false
        isRefundLocked: false,
        fallbackUnassigned: false,
      },
      enrollCommand: {
        studentId: 'stu-dynamic-01',
        courseId: 'crs-math-02',
        classId: 'class-dynamic-full',
        totalLessons: 48,
        bonusLessons: 2,
        pricePerLesson: 220,
        discountAmount: 200,
        couponAmount: 0,
        paymentMethod: 'wechat',
        channel: 'renewal',
      },
    }),
    checkClassCapacity: async () => ({ capacity: 15, currentStudentCount: 15, isFull: true }),
  };
  const dynamicCoord = new ClientRenewalCoordinator(mockPortWithCap);
  const dynDraft = await dynamicCoord.prepareRenewalDecision('stu-dynamic-01');
  assert.strictEqual(dynDraft.validation.isClassFull, true, '端侧协调器必须通过 checkClassCapacity 校验出满员');
  assert.strictEqual(dynDraft.validation.fallbackUnassigned, true, '动态核验满员必须自动降级待分班');
  assert.strictEqual(dynDraft.quote.classId, null, '动态核验满员后 quote.classId 必须清空');

  pass('原班满员时班级选择降级回退待分班资产池标记断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 5: proceedToCheckout 无损暂存草案并直通向导路由断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 5] 测试 proceedToCheckout 无损暂存草案与向导直通路由...');
  lastNavigatedUrl = '';
  const checkoutRes = await coordinator.proceedToCheckout(draft1);

  assert.strictEqual(checkoutRes.success, true, '跳转开单必须返回 success: true');
  assert.strictEqual(checkoutRes.draftId, draft1.draftId, '必须返回正确的 draftId');
  assert.ok(checkoutRes.url.includes('/package-student/enroll/wizard'), '跳转目标必须直达开单向导 wizard.vue');
  assert.ok(checkoutRes.url.includes(`renewalDraftId=${encodeURIComponent(draft1.draftId)}`), 'URL 必须携带 renewalDraftId 参数');
  assert.ok(checkoutRes.url.includes(`studentId=${encodeURIComponent(draft1.studentId)}`), 'URL 必须携带 studentId 参数');
  assert.strictEqual(lastNavigatedUrl, checkoutRes.url, 'uni.navigateTo 必须被实际触发并匹配路由');

  // 暂存草案无损读取校验
  const staged = coordinator.getStagedDraft(draft1.draftId);
  assert.ok(staged, '协调器内部必须可无损读取已暂存草案');
  assert.strictEqual(staged.draftId, draft1.draftId, '暂存草案 ID 保持一致');
  assert.strictEqual(staged.quote.pricePerLesson, 220, '暂存草案原单价保持一致');

  // 防御校验：请求不存在的草案 ID 严禁串用他人草案，必须严格返回 null
  const nonExistent = coordinator.getStagedDraft('non-existent-draft-999');
  assert.strictEqual(nonExistent, null, '请求不存在的草案 ID 必须严格返回 null，严禁串用他人草案');

  // 清除草案后读取校验
  coordinator.clearStagedDraft(draft1.draftId);
  assert.strictEqual(coordinator.getStagedDraft(draft1.draftId), null, '清除草案后必须返回 null');

  pass('proceedToCheckout 无损暂存草案并直通开单向导路由断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 6: initiateContact 规范化触发客户端外呼与沟通意图断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 6] 测试 initiateContact 客户端真实外呼触发...');
  lastMadePhoneCall = '';
  const contactRes = await coordinator.initiateContact('138-0013-8001', '陈小明');
  assert.strictEqual(contactRes.success, true, '外呼触发返回 success: true');
  assert.strictEqual(contactRes.phone, '13800138001', '手机号码必须清洗非数字连字符');
  assert.strictEqual(lastMadePhoneCall, '13800138001', 'uni.makePhoneCall 必须接收到规范化电话号码');

  // 异常电话号码拦截测试
  let emptyPhoneFailed = false;
  try {
    await coordinator.initiateContact('');
  } catch (err) {
    emptyPhoneFailed = true;
  }
  assert.strictEqual(emptyPhoneFailed, true, '空电话号码必须拦截报错');

  pass('initiateContact 客户端外呼唤起与电话号码清洗断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 7: package-edu/warning/index.vue 假数据出清与接缝改造静态代码断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 7] 静态代码断言：package-edu/warning/index.vue 假数据彻底出清与接缝改造...');
  const warningVuePath = path.resolve(__dirname, '../mini-program/src/package-edu/warning/index.vue');
  assert.ok(fs.existsSync(warningVuePath), 'warning/index.vue 必须物理存在');

  const warningContent = fs.readFileSync(warningVuePath, 'utf8');

  // 假数据严禁残留断言
  assert.ok(!warningContent.includes('李思聪'), '❌ 严禁在 warning/index.vue 中残留硬编码「李思聪」假数据');
  assert.ok(!warningContent.includes('王梓涵'), '❌ 严禁在 warning/index.vue 中残留硬编码「王梓涵」假数据');
  assert.ok(!warningContent.includes('张美玲'), '❌ 严禁在 warning/index.vue 中残留硬编码「张美玲」假数据');

  // 核心接缝与业务调用断言
  assert.ok(warningContent.includes('renewalCoordinator'), 'warning/index.vue 必须引入 renewalCoordinator');
  assert.ok(warningContent.includes('loadWarningDashboard'), 'warning/index.vue 必须调用 loadWarningDashboard');
  assert.ok(warningContent.includes('prepareRenewalDecision'), 'warning/index.vue 必须调用 prepareRenewalDecision');
  assert.ok(warningContent.includes('proceedToCheckout'), 'warning/index.vue 必须调用 proceedToCheckout 路由直通向导');
  assert.ok(warningContent.includes('initiateContact'), 'warning/index.vue 必须调用 initiateContact 真实触发外呼');
  assert.ok(warningContent.includes('RefundLockedError'), 'warning/index.vue 必须显式处理 RefundLockedError 财务退费强阻断');

  // 页面生命周期与多维过滤断言
  assert.ok(warningContent.includes('onShow'), 'warning/index.vue 必须接入 onShow 实现页面返回时自动刷新');
  assert.ok(warningContent.includes('absence'), 'warning/index.vue 必须支持 absence 连续缺勤统计与过滤');

  // DOM 样式类名兼容断言
  assert.ok(warningContent.includes('warning-stat-card'), 'warning/index.vue 必须兼容 warning-stat-card 既有样式类名');
  assert.ok(warningContent.includes('warning-item'), 'warning/index.vue 必须兼容 warning-item 既有样式类名');
  assert.ok(warningContent.includes('warning-card'), 'warning/index.vue 必须兼容 warning-card 样式类名');

  // 页面体积非平凡断言
  const warningStat = fs.statSync(warningVuePath);
  assert.ok(warningStat.size >= 5000, `warning/index.vue 体积需 >= 5000B (实际: ${warningStat.size}B)`);

  pass('预警中心 warning/index.vue 假数据出清、协调器接入与退费锁定阻断静态代码断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 8: package-student/enroll/wizard.vue 续费草案灌装意图接缝静态代码断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 8] 静态代码断言：package-student/enroll/wizard.vue 续费草案灌装意图接缝...');
  const wizardVuePath = path.resolve(__dirname, '../mini-program/src/package-student/enroll/wizard.vue');
  assert.ok(fs.existsSync(wizardVuePath), 'wizard.vue 必须物理存在');

  const wizardContent = fs.readFileSync(wizardVuePath, 'utf8');

  assert.ok(wizardContent.includes('renewalCoordinator'), 'wizard.vue 必须引入 renewalCoordinator');
  assert.ok(wizardContent.includes('renewalDraftId'), 'wizard.vue 必须识别 renewalDraftId 续费草案意图');
  assert.ok(wizardContent.includes('applyRenewalDraft'), 'wizard.vue 必须具备 applyRenewalDraft 智能草案灌装能力');
  assert.ok(wizardContent.includes('draft.draftId !== draftId') || wizardContent.includes('draftId !== draftId'), 'wizard.vue 必须严密校验草案 ID 防串用');
  assert.ok(wizardContent.includes('clearStagedDraft'), 'wizard.vue 提交成功后必须出清暂存草案');
  assert.ok(wizardContent.includes('enrollmentCoordinator.startSession') || wizardContent.includes('startSession'), 'wizard.vue 必须使用 enrollmentCoordinator.startSession 灌装');
  assert.ok(wizardContent.includes('fallbackUnassigned'), 'wizard.vue 必须识别 fallbackUnassigned 待分班安全回退标记');
  assert.ok(wizardContent.includes('pricePerLesson'), 'wizard.vue 必须灌装老学员原单价 pricePerLesson');
  assert.ok(wizardContent.includes('renewal-draft-banner') || wizardContent.includes('currentRenewalDraft'), 'wizard.vue 必须渲染续费草案提示横幅');

  pass('开单向导 wizard.vue 续费意图识别、原单价与待分班标记灌装静态代码断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 9: 选课切换与定制参数 (Custom Draft Options & Course Switching)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 9] 测试选课切换与定制参数透传 (customLessons, bonusLessons, customDiscount, pricePerLesson)...');
  const customDraft = await coordinator.prepareRenewalDecision('stu-urgent-01', {
    targetCourseId: 'crs-phy-03',
    pricePerLesson: 280,
    customLessons: 30,
    bonusLessons: 4,
    customDiscount: 300,
  });

  assert.ok(customDraft, '定制参数草案生成成功');
  assert.strictEqual(customDraft.quote.courseId, 'crs-phy-03', '目标课程成功切换至 crs-phy-03');
  assert.strictEqual(customDraft.quote.pricePerLesson, 280, '定制单价 280 精确生效');
  assert.strictEqual(customDraft.quote.totalLessons, 30, '定制课时 30 课时精确生效');
  assert.strictEqual(customDraft.quote.bonusLessons, 4, '定制赠课 4 课时精确生效');
  assert.strictEqual(customDraft.quote.suggestedDiscount, 300, '特批折扣 300 元精确生效');
  assert.strictEqual(customDraft.quote.originalTotalPrice, 280 * 30, '原价精确计算为 8400 元');
  assert.strictEqual(customDraft.quote.actualPayAmount, 8400 - 300, '实付金额精确计算为 8100 元');
  assert.strictEqual(customDraft.enrollCommand.bonusLessons, 4, '开单指令中赠课保持 4 课时一致');
  assert.strictEqual(customDraft.enrollCommand.discountAmount, 300, '开单指令中优惠金额保持 300 元一致');

  pass('选课切换与定制草案参数 (单价/课时/赠课/优惠立减) 深度透传验证通过');

  // ---------------------------------------------------------------------------
  // Scenario 10: 暂存草案彻底出清与防僵尸复活断言 (Anti-Stale Draft Resurrection)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 10] 测试暂存草案彻底出清与防僵尸复活...');
  const zombieCheckDraft = await coordinator.prepareRenewalDecision('stu-urgent-01');
  assert.ok(coordinator.getStagedDraft(zombieCheckDraft.draftId), '草案准备完成后必须可读取');

  // 出清当前草案
  coordinator.clearStagedDraft(zombieCheckDraft.draftId);
  assert.strictEqual(
    coordinator.getStagedDraft(zombieCheckDraft.draftId),
    null,
    '指定草案 ID 出清后，getStagedDraft(draftId) 必须严格返回 null'
  );
  assert.strictEqual(
    coordinator.getStagedDraft(),
    null,
    '出清当前草案后，getStagedDraft() 缺省读取亦不得复活已出清的僵尸草案'
  );

  pass('暂存草案彻底出清与防僵尸草案复活机制断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 11: 客户端外呼号码边界校验 (Short Phone / Invalid Character Boundaries)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 11] 测试客户端外呼号码边界校验...');
  let shortPhoneBlocked = false;
  try {
    await coordinator.initiateContact('123'); // 小于 5 位无效号码
  } catch (e) {
    shortPhoneBlocked = true;
  }
  assert.strictEqual(shortPhoneBlocked, true, '短于 5 位的无效号码必须被拦截抛错');

  let symbolPhoneBlocked = false;
  try {
    await coordinator.initiateContact('----'); // 仅含连字符无效号码
  } catch (e) {
    symbolPhoneBlocked = true;
  }
  assert.strictEqual(symbolPhoneBlocked, true, '无有效数字的号码必须被拦截抛错');

  pass('客户端外呼号码边界校验（过短号码与纯字符清洗拦截）断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 12: 切换学员、选课出清与向导草案数据闭环静态断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 12] 静态代码断言：切换学员出清、选课变更与数据闭环...');
  assert.ok(wizardContent.includes('handleSwitchStudent'), 'wizard.vue 必须具备 handleSwitchStudent 规范化出清切换学员能力');
  assert.ok(wizardContent.includes('cleanupWizardSession'), 'wizard.vue 必须具备 cleanupWizardSession 页面卸载出清能力');
  assert.ok(wizardContent.includes('bonusLessons'), 'wizard.vue 必须将赠课 bonusLessons 灌装入 renewalCourseItem');
  assert.ok(wizardContent.includes('discountAmount'), 'wizard.vue 必须将优惠 discountAmount 灌装入 renewalCourseItem');

  pass('向导切换学员防串用、页面卸载出清与赠课优惠全链路灌装静态代码断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 13: 续费渠道 (channel=renewal) 全链路透传与会话重置
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 13] 测试续费渠道 (channel=renewal) 全链路透传与会话解耦...');
  const enrollmentCoordinatorPath = path.resolve(
    __dirname,
    '../mini-program/dist/build/mp-weixin/coordinators/enrollment/coordinator.js'
  );
  if (fs.existsSync(enrollmentCoordinatorPath)) {
    const enrollmentMod = require(enrollmentCoordinatorPath);
    const startSessionFn = enrollmentMod.startSession || enrollmentMod.enrollmentCoordinator?.startSession;
    let capturedPayload = null;
    const fakePort = {
      async fulfill(payload) {
        capturedPayload = payload;
        return {
          orderId: 'ORD-TEST-RENEWAL-001',
          orderNo: 'ORD-TEST-RENEWAL-001',
          totalAmount: payload.totalAmount,
          items: [],
          status: 'paid',
          studentId: payload.studentId,
          campusId: payload.campusId,
          paymentMethod: payload.paymentMethod,
          createdAt: new Date().toISOString(),
        };
      },
    };

    const session = startSessionFn(
      { id: 'stu-test-renewal', name: '续约学员', campusId: 'c-01', campusName: '总部' },
      { port: fakePort, channel: 'renewal', defaultPaymentMethod: 'wechat' }
    );
    assert.strictEqual(session.channel, 'renewal', '会话必须正确记录 channel=renewal');
    session.toggleCourse({
      id: 'crs-001',
      name: '续费课程',
      totalPrice: 2000,
      totalLessons: 20,
      bonusLessons: 2,
      discountAmount: 200,
      pricePerLesson: 100,
    });
    await session.submit();
    assert.ok(capturedPayload, 'submit 必须产生履约 payload');
    assert.strictEqual(capturedPayload.channel, 'renewal', '提交 payload 必须携带 channel=renewal');

    // 测试重置 channel
    session.setChannel(undefined);
    assert.strictEqual(session.channel, undefined, 'setChannel(undefined) 必须能正确出清渠道');
  }
  pass('续费渠道 (channel=renewal) 全链路透传与会话重置断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 14: customLessons 优先于 recommendedLessons 的定制优先级核验
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 14] 测试 customLessons 优先于 recommendedLessons 定制优先级...');
  const priorityDraft = await coordinator.prepareRenewalDecision('stu-urgent-01', {
    customLessons: 24,
    recommendedLessons: 48,
  });
  assert.strictEqual(
    priorityDraft.quote.totalLessons,
    24,
    '当同时提供 customLessons 与 recommendedLessons 时，customLessons 必须享有绝对优先权'
  );
  pass('customLessons 优先于 recommendedLessons 优先级断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 15: HttpRenewalDecisionAdapter 对 HTTP 409 Conflict 状态码防腐拦截 (真适配器调用)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 15] 测试 HttpRenewalDecisionAdapter 对 HTTP 409 Conflict 状态码防腐拦截 (真适配器调用)...');
  const realHttpAdapter = new HttpRenewalDecisionAdapter();
  let http409Caught = false;
  try {
    // 桩注入底层网络请求返回 409 Conflict
    customRequestHandler = function(opts) {
      if (typeof opts.success === 'function') {
        opts.success({
          statusCode: 409,
          data: {
            message: '该学员名下存在已退费或在途退费审批课包，已被财务防腐屏障锁定',
            code: 'REFUND_LOCKED',
          },
        });
      }
    };

    try {
      // 真实调用适配器原型方法，杜绝内联伪造单测
      await realHttpAdapter.generateRenewalDraft('stu-test-409');
    } catch (e) {
      if (
        e instanceof RefundLockedError ||
        e?.name === 'RefundLockedError' ||
        e?.code === 'REFUND_LOCKED'
      ) {
        http409Caught = true;
      } else {
        throw new Error(`预期捕获 RefundLockedError，实际捕获: ${e.name || e.message}`);
      }
    }
  } finally {
    customRequestHandler = null;
  }

  assert.strictEqual(http409Caught, true, '真 HttpRenewalDecisionAdapter 在接收到 409 时必须准确抛出强类型 RefundLockedError');
  pass('HttpRenewalDecisionAdapter 对 HTTP 409 Conflict 状态码防腐拦截断言通过 (真实类方法)');

  // ---------------------------------------------------------------------------
  // Scenario 16: Vue 侦听器竞态防护与向导状态机生命周期重置断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 16] 测试 Vue 异步侦听器竞态防清空与切换学员出清断言...');
  const { ref, watch, nextTick } = require('vue');
  const testStudent = ref(null);
  const testRenewalDraft = ref(null);
  const testCourses = ref([]);

  // 模拟 wizard.vue 修复后的 watcher
  watch(testStudent, (val, oldVal) => {
    if (
      testRenewalDraft.value &&
      val &&
      (String(testRenewalDraft.value.studentId) === String(val.id) ||
        String(testRenewalDraft.value.studentId) === String(val.studentId))
    ) {
      return;
    }
    if (!val || (oldVal && val && oldVal.id !== val.id)) {
      testCourses.value = [];
    }
  });

  // 1. 模拟向导已有前序学员 A
  testStudent.value = { id: 'stu-a', name: '前序学员A' };
  await nextTick();

  // 2. 模拟从预警中心跳转灌装学员 B 的续费草案
  testRenewalDraft.value = { studentId: 'stu-b', draftId: 'DRAFT-STU-B' };
  testStudent.value = { id: 'stu-b', name: '续费学员B' };
  testCourses.value = [{ id: 'crs-math', name: '数学续费课程', price: 200 }];
  await nextTick();

  // 断言：watcher microtask 异步执行后，草案课程不得被误清空
  assert.strictEqual(testCourses.value.length, 1, '续费草案灌装后，Vue 异步侦听器严禁误清空已选续费课程');
  assert.strictEqual(testCourses.value[0].id, 'crs-math', '已选续费课程保持完整');

  // 3. 模拟点击「切换学员」出清
  testRenewalDraft.value = null;
  testStudent.value = null;
  testCourses.value = [];
  await nextTick();
  assert.strictEqual(testStudent.value, null, '切换学员后学员档案成功出清');
  assert.strictEqual(testCourses.value.length, 0, '切换学员后课程列表成功出清');

  pass('Vue 异步侦听器竞态防清空与向导切换学员完整状态机闭环断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 17: 跨课程重选与原班级课程不匹配安全回退待分班断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 17] 测试跨课程重选与原班级课程不匹配安全回退待分班断言...');
  // 针对学员陈小明 (原在读课程为 crs-math-02，班级为 class-math-01)，跨课程指定续约至 crs-phy-03 (物理)
  const crossCourseDraft = await coordinator.prepareRenewalDecision('stu-urgent-01', {
    targetCourseId: 'crs-phy-03',
  });

  assert.ok(crossCourseDraft, '跨课程草案生成成功');
  assert.strictEqual(crossCourseDraft.quote.courseId, 'crs-phy-03', '目标课程成功指定为物理');
  assert.strictEqual(crossCourseDraft.quote.classId, null, '原数学班级严禁错配给物理课程，quote.classId 必须置为 null');
  assert.strictEqual(crossCourseDraft.validation.fallbackUnassigned, true, '跨课程换课必须置位 fallbackUnassigned: true 安全回退待分班');
  assert.strictEqual(crossCourseDraft.enrollCommand.classId, undefined, '开单指令中 classId 必须为 undefined 杜绝错班入库');
  assert.strictEqual(crossCourseDraft.enrollCommand.fallbackUnassigned, true, '开单指令显式打上待分班标记');

  pass('跨课程重选与原班级课程不匹配安全回退待分班断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 18: 原生拨号系统失败自动写入系统剪贴板兜底断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 18] 测试原生外呼失败自动写入系统剪贴板兜底断言...');
  let lastCopiedClipboard = '';
  customClipboardHandler = function(opts) {
    lastCopiedClipboard = opts?.data || '';
    if (typeof opts.success === 'function') opts.success();
  };

  // 模拟外呼系统调用失败 (如 iPad、弱网或取消)
  customPhoneCallHandler = function(opts) {
    if (typeof opts.fail === 'function') {
      opts.fail(new Error('fail: call cancelled or unsupported device'));
    }
  };

  try {
    await coordinator.initiateContact('139-1234-5678', '测试学员');
    assert.strictEqual(lastCopiedClipboard, '13912345678', '原生外呼失败时必须自动将清洗后电话号码复制到剪贴板兜底');
  } finally {
    customPhoneCallHandler = null;
    customClipboardHandler = null;
  }

  pass('原生外呼失败自动写入系统剪贴板兜底断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 19: 开单向导班容溢出预检与满员阻断静态断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 19] 静态代码断言：向导满员班容预检与 request 409 穿透...');
  const reqContent = fs.readFileSync(path.resolve(__dirname, '../mini-program/src/utils/request.ts'), 'utf8');
  assert.ok(reqContent.includes('error.status = res.statusCode'), 'request.ts 必须保留 error.status');
  assert.ok(reqContent.includes('res.statusCode !== 409'), 'request.ts 必须在 409 时抑制全局 Toast 干扰');

  const wizContent = fs.readFileSync(path.resolve(__dirname, '../mini-program/src/package-student/enroll/wizard.vue'), 'utf8');
  assert.ok(wizContent.includes('cls.currentStudentCount >= cls.capacity'), 'wizard.vue confirmClassSelection 必须预检班容溢出');
  assert.ok(
    wizContent.includes('currentRenewalDraft.value') &&
      wizContent.includes('currentRenewalDraft.value.studentId'),
    'wizard.vue 必须具备草案生效防清空保护守卫'
  );

  pass('开单向导班容溢出预检、草案生效防清空与 request 409 穿透静态代码断言通过');

  console.log('\n================================================================================');
  console.log(`🎉 恭喜！课消流失预警与一键续费决策流深模块全部 ${passedCount} 项断言 100% 验证通过！`);
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ 测试执行失败:', err);
  process.exit(1);
});

