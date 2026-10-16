const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 注入微信小程序基础全局垫片
if (typeof global.wx === 'undefined') {
  global.wx = new Proxy(
    {
      getSystemInfoSync: () => ({ platform: 'devtools', windowWidth: 375, windowHeight: 667 }),
      canIUse: () => true,
      getStorageSync: () => null,
      setStorageSync: () => {},
      removeStorageSync: () => {},
      request: () => {},
      uploadFile: () => {},
      showToast: () => {},
      showModal: () => {},
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
console.log('🧪 运行微信小程序端学员开单意图协调器 (Client Enrollment Intent Coordinator) 深度测试');
console.log('================================================================================\n');

// 加载编译后的协调器产物
const coordinatorModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/coordinators/enrollment/coordinator.js'
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
const coordinator = moduleExports.enrollmentCoordinator || moduleExports;
const startSession = moduleExports.startSession || coordinator.startSession;

assert.ok(coordinator, '❌ enrollmentCoordinator 未成功导出');
assert.ok(typeof startSession === 'function', '❌ startSession 工厂方法未成功导出');
console.log('✔ [Check 0] 协调器深模块极简接口形态校验通过 (startSession)\n');

// 构造测试专用 Mock 端口
class MockEnrollmentPort {
  constructor() {
    this.submittedPayloads = [];
  }

  async fulfill(payload) {
    this.submittedPayloads.push(JSON.parse(JSON.stringify(payload)));
    const isSingleCourse = payload.courses.length === 1 && payload.goods.length === 0;
    const dispatchMode = isSingleCourse ? 'DIRECT_SINGLE_COURSE' : 'MULTI_CATEGORY_BUNDLE';

    const items = [];
    for (const c of payload.courses) {
      items.push({
        type: 'course',
        id: c.id,
        name: c.name,
        quantity: 1,
        unitPrice: c.totalPrice,
        subtotal: c.totalPrice,
        classId: c.classId,
        className: c.className,
      });
    }
    for (const g of payload.goods) {
      const subtotal = Math.round(g.price * g.quantity * 100) / 100;
      items.push({
        type: 'goods',
        id: g.id,
        name: g.name,
        quantity: g.quantity,
        unitPrice: g.price,
        subtotal,
      });
    }

    const orderNo = `ORD-TEST-${Date.now()}`;
    return {
      receiptId: orderNo,
      orderNo,
      studentId: payload.studentId,
      studentName: payload.studentName,
      campusId: payload.campusId,
      paymentMethod: payload.paymentMethod,
      totalAmount: payload.totalAmount,
      coursesSubtotal: payload.coursesSubtotal,
      goodsSubtotal: payload.goodsSubtotal,
      totalItems: items.length,
      items,
      completedAt: new Date().toISOString(),
      success: true,
      dispatchMode,
    };
  }
}

async function runTests() {
  // =========================================================================
  // 场景 1: 多课程与物品混合勾选时，金额准确累加，全部条目无损记录，无静默丢弃
  // =========================================================================
  console.log('>>> [Scenario 1] 多课程与物品混合勾选无损装配与防浮点漂移核算...');
  const mockPort1 = new MockEnrollmentPort();
  const student1 = {
    id: 'stu-101',
    name: '张小凡',
    studentNo: 'S10001',
    walletBalance: 20000,
    status: 'active',
  };
  const session1 = startSession(student1, { port: mockPort1 });

  // 勾选两门课程
  const courseA = { id: 'crs-qm', name: '启蒙英语', totalPrice: 1200.5, totalLessons: 24, pricePerLesson: 50.02 };
  const courseB = { id: 'crs-jj', name: '进阶数学', totalPrice: 2400.3, totalLessons: 48, pricePerLesson: 50.01 };
  session1.toggleCourse(courseA);
  session1.toggleCourse(courseB);

  // 勾选两件教具教材物品 (验证多品类与数量运算防浮点漂移)
  const goodsA = { id: 'g-book', name: '启蒙绘本教材', price: 88.88, unit: '本' };
  const goodsB = { id: 'g-pen', name: '智能点读笔', price: 25.1, unit: '支' };
  session1.toggleGoods(goodsA, 2); // 88.88 * 2 = 177.76
  session1.toggleGoods(goodsB, 3); // 25.10 * 3 = 75.30

  // 核算金额: 1200.5 + 2400.3 = 3600.8; 177.76 + 75.30 = 253.06; total = 3853.86
  const summary1 = session1.financialSummary;
  assert.strictEqual(summary1.coursesSubtotal, 3600.8, '❌ 课程小计金额核算不准确');
  assert.strictEqual(summary1.goodsSubtotal, 253.06, '❌ 物品小计金额核算不准确');
  assert.strictEqual(summary1.totalAmount, 3853.86, '❌ 混合订单总金额核算存在浮点漂移或误差');
  assert.strictEqual(session1.selectedCourses.length, 2, '❌ 已选课程数应为2');
  assert.strictEqual(session1.selectedGoods.length, 2, '❌ 已选物品数应为2');

  // 提交并核验无损记录 (杜绝旧版 selectedCourses[0] 截断缺陷)
  const receipt1 = await session1.submit();
  assert.strictEqual(receipt1.success, true, '❌ 提交开单收据未成功');
  assert.strictEqual(receipt1.items.length, 4, '❌ 提交明细缺少条目，未无损保留');
  assert.strictEqual(receipt1.dispatchMode, 'MULTI_CATEGORY_BUNDLE', '❌ 多品类未命中批量装配调度');
  assert.strictEqual(receipt1.totalAmount, 3853.86, '❌ 收据总金额与意图金额不一致');
  console.log('  ✔ 多课程与物品混合装配金额精确累加无漂移，全部明细无损记录，0静默丢失\n');

  // =========================================================================
  // 场景 2: 移除某门课程时，挂载在该课程下的班级选择被物理出清 (级联自愈保护)
  // =========================================================================
  console.log('>>> [Scenario 2] 移除课程时关联班级级联自愈出清保护...');
  const session2 = startSession(student1, { port: mockPort1 });
  session2.toggleCourse(courseA);
  session2.toggleCourse(courseB);

  // 为两门课程分别排班
  const classA = { id: 'cls-a1', name: '启蒙A班', courseId: 'crs-qm' };
  const classB = { id: 'cls-b1', name: '数学B班', courseId: 'crs-jj' };
  session2.assignClass('crs-qm', classA);
  session2.assignClass('crs-jj', classB);

  assert.strictEqual(session2.selectedClasses.length, 2, '❌ 初始应有两个排入的班级');
  assert.ok(session2.selectedClasses.some((c) => c.id === 'cls-a1'), '❌ 缺少启蒙A班');
  assert.ok(session2.selectedClasses.some((c) => c.id === 'cls-b1'), '❌ 缺少数学B班');

  // 移除课程A (启蒙英语)
  session2.toggleCourse(courseA);

  assert.strictEqual(session2.selectedCourses.length, 1, '❌ 移除课程A后应剩余1门课程');
  assert.strictEqual(session2.selectedCourses[0].id, 'crs-jj', '❌ 剩余课程应为进阶数学');
  assert.strictEqual(session2.selectedClasses.length, 1, '❌ 挂载在课程A下的班级应同步被物理出清！');
  assert.strictEqual(session2.selectedClasses[0].id, 'cls-b1', '❌ 仅应保留数学B班');

  // 移除课程B
  session2.toggleCourse(courseB);
  assert.strictEqual(session2.selectedCourses.length, 0, '❌ 全部课程已移除');
  assert.strictEqual(session2.selectedClasses.length, 0, '❌ 班级列表应已物理全部出清！');
  console.log('  ✔ 移除课程后关联班级自动级联物理出清，不变式校验通过\n');

  // =========================================================================
  // 场景 3: 电子钱包余额不足以覆盖全单时，精确拦截并标明差额
  // =========================================================================
  console.log('>>> [Scenario 3] 电子钱包余额不足精确拦截与差额提示...');
  const brokeStudent = {
    id: 'stu-broke',
    name: '碧瑶',
    studentNo: 'S10002',
    walletBalance: 200, // 仅200元本金
    status: 'active',
  };
  const session3 = startSession(brokeStudent, { port: mockPort1 });
  session3.toggleCourse({ id: 'crs-expensive', name: '仙剑心法课', totalPrice: 800 });

  // 默认微信支付下合法
  assert.strictEqual(session3.validationReport.isValid, true, '❌ 微信支付下应为合法');

  // 切换为钱包支付
  session3.setPaymentMethod('wallet');
  const walletReport = session3.validationReport;
  assert.strictEqual(walletReport.isValid, false, '❌ 钱包本金不足时应被拦截');
  assert.strictEqual(walletReport.deficit, 600, '❌ 差额核算错误 (800 - 200 = 600)');
  assert.ok(
    walletReport.errors.some((e) => e.includes('600')),
    '❌ 错误信息应清晰提示差额 ¥600'
  );

  // 尝试提交阻断
  let intercepted = false;
  try {
    await session3.submit();
  } catch (err) {
    intercepted = true;
    assert.ok(err.message.includes('600'), '❌ 阻断异常中需包含差额明细');
  }
  assert.ok(intercepted, '❌ 钱包余额不足时提交未被阻断！');

  // 切换回微信或支付宝支付，自动自愈
  session3.setPaymentMethod('alipay');
  assert.strictEqual(session3.validationReport.isValid, true, '❌ 切换支付方式后风控应自动自愈');
  console.log('  ✔ 电子钱包本金不足精确阻断并明确差额，切换通道后平滑自愈\n');

  // =========================================================================
  // 场景 4: 单课程直通与多品类装配的分流调度断言
  // =========================================================================
  console.log('>>> [Scenario 4] 单课程直通与多品类装配的分流调度...');
  const mockPort4 = new MockEnrollmentPort();
  const session4 = startSession(student1, { port: mockPort4 });

  // 仅添加一门单课程
  session4.toggleCourse(courseA);
  const receiptSingle = await session4.submit();
  assert.strictEqual(receiptSingle.dispatchMode, 'DIRECT_SINGLE_COURSE', '❌ 单课程未走直通调度通道');

  // 添加物品转变为多品类
  session4.toggleGoods(goodsA, 1);
  const receiptMulti = await session4.submit();
  assert.strictEqual(receiptMulti.dispatchMode, 'MULTI_CATEGORY_BUNDLE', '❌ 混合品类未走装配调度通道');
  console.log('  ✔ 单课程直通通道与多品类装配通道精准分流调度通过\n');

  // =========================================================================
  // 场景 5: 提交返回规范的开单收据，包含单据号与明细
  // =========================================================================
  console.log('>>> [Scenario 5] 规范开单收据单据号与明细契约...');
  assert.ok(receiptMulti.receiptId && receiptMulti.receiptId.startsWith('ORD-'), '❌ 收据号格式不合规');
  assert.strictEqual(receiptMulti.orderNo, receiptMulti.receiptId, '❌ orderNo 应与 receiptId 保持一致');
  assert.strictEqual(receiptMulti.studentId, 'stu-101');
  assert.strictEqual(receiptMulti.studentName, '张小凡');
  assert.ok(receiptMulti.completedAt, '❌ 缺少完成时间戳');
  assert.ok(Array.isArray(receiptMulti.items) && receiptMulti.items.length === 2, '❌ 明细列表不合规');
  const item0 = receiptMulti.items[0];
  assert.ok(item0.id && item0.name && item0.unitPrice && item0.subtotal, '❌ 明细条目缺少关键财务属性');
  console.log('  ✔ 规范开单收据、单据号与明细契约校验通过\n');

  // =========================================================================
  // 场景 6: 课程-班级归属强类型校验 (严禁跨课程非法排班)
  // =========================================================================
  console.log('>>> [Scenario 6] 课程-班级归属强类型校验与非法跨课排班阻断...');
  const session6 = startSession(student1, { port: mockPort1 });
  session6.toggleCourse(courseA); // 启蒙英语

  // 尝试为启蒙英语关联数学班级 (courseId 不匹配)
  let classMismatchThrown = false;
  try {
    session6.assignClass('crs-qm', { id: 'cls-foreign', name: '奥数一班', courseId: 'crs-math-diff' });
  } catch (e) {
    classMismatchThrown = true;
    assert.ok(e.message.includes('不匹配'), '❌ 异常应明确指出课程班级归属不匹配');
  }
  assert.ok(classMismatchThrown, '❌ 跨课程非法排入班级未被拦截！');
  console.log('  ✔ 跨课程非法排班强类型校验与防御拦截通过\n');

  // =========================================================================
  // 场景 7: 学籍 SSOT 前置风控拦截断言
  // =========================================================================
  console.log('>>> [Scenario 7] 学籍 SSOT 前置风控拦截 (停课/流失/无权限)...');
  const suspendedStudent = { id: 'stu-s', name: '停课学员', status: 'suspended', statusText: '停课' };
  const sessionSuspended = startSession(suspendedStudent, { port: mockPort1 });
  sessionSuspended.toggleCourse(courseA);
  assert.strictEqual(sessionSuspended.validationReport.canEnroll, false, '❌ 停课学员应被风控拦截');
  assert.strictEqual(sessionSuspended.validationReport.isValid, false, '❌ 停课学员校验不能为合法');

  const lostStudent = { id: 'stu-l', name: '流失学员', status: 'lost', statusText: '已流失' };
  const sessionLost = startSession(lostStudent, { port: mockPort1 });
  sessionLost.toggleCourse(courseA);
  assert.strictEqual(sessionLost.validationReport.canEnroll, false, '❌ 已流失学员应被风控拦截');

  const noPermStudent = { id: 'stu-np', name: '禁报学员', status: 'active', permissions: { canEnroll: false } };
  const sessionNoPerm = startSession(noPermStudent, { port: mockPort1 });
  sessionNoPerm.toggleCourse(courseA);
  assert.strictEqual(sessionNoPerm.validationReport.canEnroll, false, '❌ canEnroll: false 学员应被风控拦截');
  console.log('  ✔ 学籍 SSOT 前置风控全面覆盖通过\n');

  // =========================================================================
  // 场景 8: 防连击并发提交保护 (isSubmitting 状态锁防御)
  // =========================================================================
  console.log('>>> [Scenario 8] 并发连击提交防护与 isSubmitting 状态锁断言...');
  let delayedFulfillCount = 0;
  const delayedPort = {
    fulfill: async (payload) => {
      delayedFulfillCount++;
      await new Promise((resolve) => setTimeout(resolve, 80));
      return {
        receiptId: 'ORD-CONCURRENT-1',
        orderNo: 'ORD-CONCURRENT-1',
        studentId: payload.studentId,
        studentName: payload.studentName,
        campusId: payload.campusId,
        paymentMethod: payload.paymentMethod,
        totalAmount: payload.totalAmount,
        coursesSubtotal: payload.coursesSubtotal,
        goodsSubtotal: payload.goodsSubtotal,
        totalItems: 1,
        items: [],
        completedAt: new Date().toISOString(),
        success: true,
      };
    },
  };

  const sessionConcurrent = startSession(student1, { port: delayedPort });
  sessionConcurrent.toggleCourse(courseA);

  let concurrentRejectionCount = 0;
  const submitPromises = [
    sessionConcurrent.submit().catch((e) => {
      if (e.message.includes('正在处理中')) concurrentRejectionCount++;
      return null;
    }),
    sessionConcurrent.submit().catch((e) => {
      if (e.message.includes('正在处理中')) concurrentRejectionCount++;
      return null;
    }),
  ];

  const results = await Promise.all(submitPromises);
  assert.strictEqual(delayedFulfillCount, 1, '❌ 并发提交穿透了协调器状态锁，造成多次履约！');
  assert.strictEqual(concurrentRejectionCount, 1, '❌ 第二次并发提交未被拦截提示正在处理中');
  assert.strictEqual(sessionConcurrent.isSubmitting, false, '❌ 完成提交后 isSubmitting 锁应正确释放');
  console.log('  ✔ 并发连击精确拦截，fulfill 仅执行 1 次，isSubmitting 锁生命周期完备\n');

  // =========================================================================
  // 场景 9: 电子钱包 1 分钱与 0 余额极限边界断言 (¥100.01 vs ¥100.00, ¥0)
  // =========================================================================
  console.log('>>> [Scenario 9] 电子钱包极限边界 (少 1 分钱 ¥100.01 vs ¥100.00 与 ¥0 余额)...');
  const closeStudent = { id: 'stu-close', name: '差一分学员', walletBalance: 100.00, status: 'active' };
  const sessionClose = startSession(closeStudent, { port: mockPort1 });
  sessionClose.toggleCourse({ id: 'crs-close', name: '精准计费课', totalPrice: 100.01 });
  sessionClose.setPaymentMethod('wallet');

  const closeReport = sessionClose.validationReport;
  assert.strictEqual(closeReport.isValid, false, '❌ 少一分钱时钱包支付应被精确拦截');
  assert.strictEqual(closeReport.deficit, 0.01, '❌ 差额核算未精确到 0.01 元浮点防漂移');
  assert.ok(closeReport.errors.some((e) => e.includes('0.01')), '❌ 错误提示需精确指出差额 ¥0.01');

  // 0 余额学员
  const zeroStudent = { id: 'stu-zero', name: '零余额学员', walletBalance: 0, status: 'active' };
  const sessionZero = startSession(zeroStudent, { port: mockPort1 });
  sessionZero.toggleCourse({ id: 'crs-close', name: '精准计费课', totalPrice: 100.00 });
  sessionZero.setPaymentMethod('wallet');
  const zeroReport = sessionZero.validationReport;
  assert.strictEqual(zeroReport.isValid, false, '❌ 0 余额学员应被拦截');
  assert.strictEqual(zeroReport.deficit, 100.00, '❌ 0 余额差额应为全额 100.00');
  console.log('  ✔ 电子钱包 1 分钱与 0 余额极端边界防浮点漂移计算精确断言通过\n');

  // =========================================================================
  // 场景 10: 班级全量自愈同步 (setClasses 与反选出清)
  // =========================================================================
  console.log('>>> [Scenario 10] setClasses 声明式批量分配与反选物理出清...');
  const sessionClasses = startSession(student1, { port: mockPort1 });
  sessionClasses.toggleCourse(courseA); // crs-qm
  sessionClasses.toggleCourse(courseB); // crs-jj

  // 批量分配两个班级
  sessionClasses.setClasses([
    { id: 'cls-a1', name: '启蒙A班', courseId: 'crs-qm' },
    { id: 'cls-b1', name: '数学B班', courseId: 'crs-jj' },
  ]);
  assert.strictEqual(sessionClasses.selectedClasses.length, 2, '❌ 批量排班后应有 2 个班级');

  // 反选启蒙A班，仅保留数学B班
  sessionClasses.setClasses([
    { id: 'cls-b1', name: '数学B班', courseId: 'crs-jj' },
  ]);
  assert.strictEqual(sessionClasses.selectedClasses.length, 1, '❌ 反选出清后应仅剩余 1 个班级');
  assert.strictEqual(sessionClasses.selectedClasses[0].id, 'cls-b1');
  assert.strictEqual(sessionClasses.selectedCourses.find((c) => c.id === 'crs-qm').assignedClass, null, '❌ 启蒙课程关联班级应已被置空');

  // 全量反选清空班级
  sessionClasses.setClasses([]);
  assert.strictEqual(sessionClasses.selectedClasses.length, 0, '❌ 清空班级后 selectedClasses 应为空');
  console.log('  ✔ setClasses 声明式批量同步与反选出清自愈校验通过\n');

  // =========================================================================
  // 场景 11: 课程非空强校验与适配器防伪装配
  // =========================================================================
  console.log('>>> [Scenario 11] 零课程开单拦截与适配器零课程防御...');
  const sessionEmptyCourse = startSession(student1, { port: mockPort1 });
  sessionEmptyCourse.toggleGoods(goodsA, 1);
  const emptyReport = sessionEmptyCourse.validationReport;
  assert.strictEqual(emptyReport.isValid, false, '❌ 仅选择物品未选择课程时应被风控拦截');
  assert.ok(emptyReport.errors.some((e) => e.includes('请至少选择一门报读课程')), '❌ 需明确提示至少选择一门报读课程');

  let emptyCourseBlocked = false;
  try {
    await sessionEmptyCourse.submit();
  } catch (e) {
    emptyCourseBlocked = true;
  }
  assert.ok(emptyCourseBlocked, '❌ 零课程开单必须在 submit 阶段被阻断');
  console.log('  ✔ 零课程开单强类型防御通过\n');

  // =========================================================================
  // 场景 12: 单班级唯一归属不变式保护 (严防同一班级被两门课程重复关联)
  // =========================================================================
  console.log('>>> [Scenario 12] 单班级唯一归属不变式保护...');
  const sessionUniqueClass = startSession(student1, { port: mockPort1 });
  sessionUniqueClass.toggleCourse(courseA);
  sessionUniqueClass.toggleCourse(courseB);

  // 为课程 A 关联通用班级 cls-shared
  sessionUniqueClass.assignClass(courseA.id, { id: 'cls-shared', name: '通用多能班' });
  assert.strictEqual(sessionUniqueClass.selectedClasses.length, 1);
  assert.strictEqual(sessionUniqueClass.selectedClasses[0].id, 'cls-shared');

  // 重新将同一班级 cls-shared 关联到课程 B
  sessionUniqueClass.assignClass(courseB.id, { id: 'cls-shared', name: '通用多能班' });
  assert.strictEqual(sessionUniqueClass.selectedClasses.length, 1, '❌ 同一班级不可被多门课程同时重复关联');
  assert.strictEqual(sessionUniqueClass.selectedCourses.find((c) => c.id === courseA.id).assignedClass, null, '❌ 课程 A 的班级应已被置换解绑');
  assert.strictEqual(sessionUniqueClass.selectedCourses.find((c) => c.id === courseB.id).assignedClass.id, 'cls-shared', '❌ 课程 B 应获得该班级');
  console.log('  ✔ 单班级跨课排入唯一性不变式保护校验通过\n');

  // =========================================================================
  // 场景 13: 极端畸变与非法输入自愈防御 (NaN 数量、负数价格/数量、浮点注入与资产篡改拦截)
  // =========================================================================
  console.log('>>> [Scenario 13] 极端畸变与非法输入自愈防御 (NaN, 负数, 浮点篡改)...');
  const sessionCorrupted = startSession(student1, { port: mockPort1 });
  sessionCorrupted.toggleCourse({ id: 'crs-corrupted', name: '正常课程', totalPrice: 300 });

  // 13.1 尝试传入负数金额教具
  sessionCorrupted.toggleGoods({ id: 'g-neg', name: '负数教具', price: -100 }, 1);
  assert.strictEqual(sessionCorrupted.financialSummary.goodsSubtotal, 0, '❌ 负数价格教具应被安全归零防御');
  assert.strictEqual(sessionCorrupted.financialSummary.totalAmount, 300, '❌ 负数价格不应降低订单总额');

  // 13.2 尝试传入 NaN 数量
  sessionCorrupted.toggleGoods({ id: 'g-nan', name: '正常教具', price: 50 }, 2);
  assert.strictEqual(sessionCorrupted.selectedGoods.length, 2);
  sessionCorrupted.toggleGoods({ id: 'g-nan', name: '正常教具', price: 50 }, NaN);
  assert.strictEqual(
    sessionCorrupted.selectedGoods.some((g) => g.id === 'g-nan'),
    false,
    '❌ 传入 NaN 数量应安全出清该教具'
  );

  // 13.3 尝试向未选物品传入负数数量或 0
  sessionCorrupted.toggleGoods({ id: 'g-unselected', name: '未选教具', price: 80 }, -5);
  assert.strictEqual(
    sessionCorrupted.selectedGoods.some((g) => g.id === 'g-unselected'),
    false,
    '❌ 向未选物品传入负数数量严禁静默新增'
  );
  sessionCorrupted.toggleGoods({ id: 'g-unselected2', name: '未选教具2', price: 80 }, 0);
  assert.strictEqual(
    sessionCorrupted.selectedGoods.some((g) => g.id === 'g-unselected2'),
    false,
    '❌ 向未选物品传入 0 数量严禁静默新增'
  );

  // 13.4 浮点数量强制取整
  sessionCorrupted.toggleGoods({ id: 'g-float-qty', name: '课本', price: 20 }, 2.8);
  const floatItem = sessionCorrupted.selectedGoods.find((g) => g.id === 'g-float-qty');
  assert.strictEqual(floatItem.quantity, 2, '❌ 教具数量应强制截断取整');
  assert.strictEqual(sessionCorrupted.financialSummary.goodsSubtotal, 40, '❌ 取整后金额核算应为 40');
  console.log('  ✔ 极端畸变输入 (NaN/负数/浮点数量) 完备自愈防御通过\n');

  // =========================================================================
  // 场景 14: 跨课程无关班级批量分配 (setClasses) 强隔离自愈保护
  // =========================================================================
  console.log('>>> [Scenario 14] 跨课程无关班级批量分配 (setClasses) 强隔离自愈保护...');
  const sessionCrossClass = startSession(student1, { port: mockPort1 });
  sessionCrossClass.toggleCourse(courseA); // 仅选了启蒙英语 crs-qm

  // 用户在弹窗中误选了属于数学课程的班级 (courseId: 'crs-jj')
  // setClasses 必须平滑过滤忽略该班级，绝不可崩溃，也不可强行分配给启蒙英语
  sessionCrossClass.setClasses([
    { id: 'cls-math-unselected', name: '奥数尖子班', courseId: 'crs-jj' },
  ]);
  assert.strictEqual(sessionCrossClass.selectedClasses.length, 0, '❌ 未选课程的班级应被安全过滤');
  assert.strictEqual(sessionCrossClass.selectedCourses[0].assignedClass, null, '❌ 启蒙课程不应被强塞数学班级');

  // 传入通用班级 (无 courseId) 则正常分配
  sessionCrossClass.setClasses([
    { id: 'cls-universal', name: '公共自习班' },
  ]);
  assert.strictEqual(sessionCrossClass.selectedClasses.length, 1);
  assert.strictEqual(sessionCrossClass.selectedClasses[0].id, 'cls-universal');
  assert.strictEqual(sessionCrossClass.selectedCourses[0].assignedClass.id, 'cls-universal');
  console.log('  ✔ 跨课程无关班级批量分配强隔离与通用班级自适应分配通过\n');

  // =========================================================================
  // 场景 15: 多课程履约部分网络断层时已完成项目自愈出清与防二次重复扣费断言
  // =========================================================================
  console.log('>>> [Scenario 15] 多课程履约部分网络断层时已完成项目自愈出清与防重充断言...');
  const partialFailPort = {
    fulfill: async (payload) => {
      // 模拟多课程批量建单中第 2 门课程失败
      const err = new Error('微服务网关超时 504');
      err.partialCompletedCourseIds = ['crs-qm'];
      throw err;
    },
  };

  const sessionPartial = startSession(student1, { port: partialFailPort });
  sessionPartial.toggleCourse(courseA); // crs-qm (第1门)
  sessionPartial.toggleCourse(courseB); // crs-jj (第2门)
  sessionPartial.toggleGoods(goodsA, 1); // 全单配套物品挂载在第1门课程

  assert.strictEqual(sessionPartial.selectedCourses.length, 2);
  assert.strictEqual(sessionPartial.selectedGoods.length, 1);

  let partialCaught = false;
  try {
    await sessionPartial.submit();
  } catch (e) {
    partialCaught = true;
    assert.ok(e.message.includes('504'));
  }
  assert.ok(partialCaught, '❌ 预期部分失败抛出异常');

  // 核心断言：已在后端建单成功的第 1 门课程 (crs-qm) 与物品必须已被自动移出草稿！
  assert.strictEqual(sessionPartial.selectedCourses.length, 1, '❌ 已建单成功的课程必须自动移出草稿！');
  assert.strictEqual(sessionPartial.selectedCourses[0].id, 'crs-jj', '❌ 草稿中仅应剩余未完成的进阶数学');
  assert.strictEqual(sessionPartial.selectedGoods.length, 0, '❌ 已入账物品必须已从草稿出清');

  // 再次提交时仅提交未完成的第 2 门课程，彻底杜绝重复建单与重复扣费！
  const successRetryPort = {
    fulfill: async (payload) => {
      assert.strictEqual(payload.courses.length, 1, '❌ 重试时必须仅包含未完成的 1 门课程！');
      assert.strictEqual(payload.courses[0].id, 'crs-jj');
      assert.strictEqual(payload.goods.length, 0, '❌ 重试时不应重复挂载物品');
      return {
        receiptId: 'ORD-RETRY-1',
        orderNo: 'ORD-RETRY-1',
        studentId: payload.studentId,
        studentName: payload.studentName,
        campusId: payload.campusId,
        paymentMethod: payload.paymentMethod,
        totalAmount: payload.totalAmount,
        coursesSubtotal: payload.coursesSubtotal,
        goodsSubtotal: payload.goodsSubtotal,
        totalItems: 1,
        items: [],
        completedAt: new Date().toISOString(),
        success: true,
      };
    },
  };
  const sessionRetry = startSession(student1, { port: successRetryPort });
  sessionRetry.toggleCourse(courseB);
  const retryReceipt = await sessionRetry.submit();
  assert.strictEqual(retryReceipt.success, true);
  console.log('  ✔ 多课程部分失败自动出清完成项，重试防二次重复建单扣费断言通过\n');

  // =========================================================================
  // 场景 16: removeClass 课程与班级精确解绑防误伤断言
  // =========================================================================
  console.log('>>> [Scenario 16] removeClass 课程与班级精确解绑防误伤断言...');
  const sessionRemove = startSession(student1, { port: mockPort1 });
  sessionRemove.toggleCourse(courseA); // crs-qm
  sessionRemove.toggleCourse(courseB); // crs-jj
  sessionRemove.assignClass('crs-qm', { id: 'cls-1', name: '启蒙A班', courseId: 'crs-qm' });
  sessionRemove.assignClass('crs-jj', { id: 'cls-2', name: '数学B班', courseId: 'crs-jj' });

  // 尝试用错误的课程ID与班级ID组合调用 removeClass('crs-qm', 'cls-2')
  // 启蒙课程实际关联的是 cls-1，绝不能错误将启蒙课程的 cls-1 解绑！
  sessionRemove.removeClass('crs-qm', 'cls-2');
  assert.strictEqual(
    sessionRemove.selectedCourses.find((c) => c.id === 'crs-qm').assignedClass?.id,
    'cls-1',
    '❌ 启蒙课程的 cls-1 不应被误伤解绑！'
  );
  assert.strictEqual(
    sessionRemove.selectedCourses.find((c) => c.id === 'crs-jj').assignedClass,
    null,
    '❌ 真正属于 cls-2 的数学课程班级应被精确出清'
  );
  console.log('  ✔ removeClass 精准靶向解绑防误伤不变式验证通过\n');

  // =========================================================================
  // 场景 17: 多学员切换与草稿销毁生命周期自愈（跨学员防状态污染）
  // =========================================================================
  console.log('>>> [Scenario 17] 多学员切换与草稿销毁生命周期自愈（跨学员防状态污染）...');
  const studentA = { id: 'stu-A', name: '学员A', walletBalance: 5000, status: 'active' };
  const studentB = { id: 'stu-B', name: '学员B', walletBalance: 200, status: 'active' };

  const sessionLifecycle = startSession(studentA, { port: mockPort1 });
  sessionLifecycle.toggleCourse(courseA);
  sessionLifecycle.toggleGoods(goodsA, 2);
  assert.strictEqual(sessionLifecycle.totalItemsCount, 2);

  // 模拟生命周期 clear 清空
  sessionLifecycle.clear();
  assert.strictEqual(sessionLifecycle.totalItemsCount, 0, '❌ clear() 后条目总数应为 0');
  assert.strictEqual(sessionLifecycle.selectedCourses.length, 0);
  assert.strictEqual(sessionLifecycle.selectedGoods.length, 0);
  assert.strictEqual(sessionLifecycle.selectedClasses.length, 0);
  assert.strictEqual(sessionLifecycle.financialSummary.totalAmount, 0);

  // 切换为学员B
  sessionLifecycle.setStudent(studentB);
  assert.strictEqual(sessionLifecycle.student.id, 'stu-B');
  assert.strictEqual(sessionLifecycle.financialSummary.walletBalance, 200);
  console.log('  ✔ 多学员切换与草稿销毁生命周期隔离自愈通过\n');

  // =========================================================================
  // 场景 18: 支付方式白名单严格校验与非法通道拦截防静默篡改
  // =========================================================================
  console.log('>>> [Scenario 18] 支付方式白名单严格校验与非法通道拦截防静默篡改...');
  const sessionPayment = startSession(student1, { port: mockPort1 });
  sessionPayment.toggleCourse(courseA);

  // 18.1 非法支付通道与空值必须直接抛出异常拒绝
  let rejectedIllegal = false;
  try {
    sessionPayment.setPaymentMethod('crypto_currency');
  } catch (err) {
    rejectedIllegal = true;
    assert.ok(err.message.includes('不支持或非法的支付通道'), '❌ 异常信息应明确提示非法通道');
  }
  assert.ok(rejectedIllegal, '❌ 非法支付通道未被强类型阻断！');

  let rejectedEmpty = false;
  try {
    sessionPayment.setPaymentMethod('');
  } catch (err) {
    rejectedEmpty = true;
    assert.ok(err.message.includes('支付方式不能为空'));
  }
  assert.ok(rejectedEmpty, '❌ 空支付方式未被强类型阻断！');

  // 18.2 合法别名自适应映射归一化
  sessionPayment.setPaymentMethod('wx');
  assert.strictEqual(sessionPayment.paymentMethod, 'wechat');
  sessionPayment.setPaymentMethod('ali');
  assert.strictEqual(sessionPayment.paymentMethod, 'alipay');
  sessionPayment.setPaymentMethod('cash');
  assert.strictEqual(sessionPayment.paymentMethod, 'pos');
  sessionPayment.setPaymentMethod('bank');
  assert.strictEqual(sessionPayment.paymentMethod, 'bank_transfer');
  sessionPayment.setPaymentMethod('balance');
  assert.strictEqual(sessionPayment.paymentMethod, 'wallet');

  // 18.3 若属性被非法直接强行篡改，validationReport 仍需牢牢兜底拦截
  sessionPayment.paymentMethod = 'bogus_channel';
  assert.strictEqual(sessionPayment.validationReport.isValid, false, '❌ validationReport 必须拦截非法篡改的支付方式');
  assert.ok(sessionPayment.validationReport.errors.some((e) => e.includes('非法或不受支持')));
  sessionPayment.setPaymentMethod('wechat');
  console.log('  ✔ 支付方式白名单与非法通道防御拦截断言通过\n');

  // =========================================================================
  // 场景 19: setGoods 显式数量优先与批量覆盖断言（防件数吞噬）
  // =========================================================================
  console.log('>>> [Scenario 19] setGoods 显式数量优先与批量覆盖断言（防件数吞噬）...');
  const sessionGoodsPrecedence = startSession(student1, { port: mockPort1 });
  sessionGoodsPrecedence.toggleCourse(courseA);

  // 先添加物品，默认 1 件
  sessionGoodsPrecedence.toggleGoods(goodsA, 1);
  assert.strictEqual(sessionGoodsPrecedence.selectedGoods[0].quantity, 1);
  assert.strictEqual(sessionGoodsPrecedence.financialSummary.goodsSubtotal, 88.88);

  // 随后通过 setGoods 批量同步并显式指定数量为 5 件
  sessionGoodsPrecedence.setGoods([
    { id: goodsA.id, name: goodsA.name, price: goodsA.price, quantity: 5 },
  ]);
  assert.strictEqual(
    sessionGoodsPrecedence.selectedGoods[0].quantity,
    5,
    '❌ setGoods 必须优先采纳新传入的显式数量 5 件，严禁被旧数量 1 件吞噬'
  );
  assert.strictEqual(
    sessionGoodsPrecedence.financialSummary.goodsSubtotal,
    444.4,
    '❌ 5 件总金额应为 88.88 * 5 = 444.40'
  );
  console.log('  ✔ setGoods 显式数量优先与防件数吞噬断言通过\n');

  // =========================================================================
  // 场景 20: String 与 Number 混合 ID 跨类型归一化自适应匹配
  // =========================================================================
  console.log('>>> [Scenario 20] String 与 Number 混合 ID 跨类型自适应排班与解绑...');
  const sessionMixedId = startSession(student1, { port: mockPort1 });
  const courseNumeric = { id: 101, name: '数理逻辑课', totalPrice: 500 };
  const classNumeric = { id: 201, name: '培优班', courseId: '101' };

  sessionMixedId.toggleCourse(courseNumeric);
  assert.strictEqual(sessionMixedId.selectedCourses.length, 1);
  assert.strictEqual(sessionMixedId.selectedCourses[0].id, '101');

  // 使用 string 课程ID为 number courseId 的班级排班
  sessionMixedId.assignClass('101', classNumeric);
  assert.strictEqual(sessionMixedId.selectedClasses.length, 1, '❌ 混合类型 ID 排班应成功匹配');
  assert.strictEqual(sessionMixedId.selectedClasses[0].id, '201');

  // 使用 number classId 解绑
  sessionMixedId.removeClass('101', 201);
  assert.strictEqual(sessionMixedId.selectedClasses.length, 0, '❌ 混合类型 ID 解绑应自适应识别出清');
  console.log('  ✔ String 与 Number 跨类型 ID 自适应排班与解绑断言通过\n');

  // =========================================================================
  // 场景 21: 无效学员档案准入严密拦截（空对象 / 缺失 id）
  // =========================================================================
  console.log('>>> [Scenario 21] 无效学员档案准入严密拦截（空对象/缺少id）...');
  const sessionInvalidStudent = startSession({}, { port: mockPort1 });
  sessionInvalidStudent.toggleCourse(courseA);

  const invalidReport = sessionInvalidStudent.validationReport;
  assert.strictEqual(invalidReport.canEnroll, false, '❌ 空学员对象必须被准入风控拦截');
  assert.strictEqual(invalidReport.isValid, false, '❌ 空学员档案校验必须失败');
  assert.ok(
    invalidReport.errors.some((e) => e.includes('未选择学员或学员档案无效')),
    '❌ 错误信息需准确提示学员档案无效'
  );

  let submitBlocked = false;
  try {
    await sessionInvalidStudent.submit();
  } catch (e) {
    submitBlocked = true;
    assert.ok(e.message.includes('未选择学员或学员档案无效'));
  }
  assert.ok(submitBlocked, '❌ 缺少 id 的学员提交必须被阻断，严禁发出 studentId 为空的脏报文');
  console.log('  ✔ 无效学员档案准入拦截与防脏报文断言通过\n');

  // =========================================================================
  // 场景 22: 单例协调器多会话独立隔离性断言（防共享状态污染）
  // =========================================================================
  console.log('>>> [Scenario 22] 单例协调器多会话独立隔离性断言（防共享状态污染）...');
  const sessionAlice = coordinator.startSession(student1, { port: mockPort1 });
  const sessionBob = coordinator.startSession(studentB, { port: mockPort1 });

  sessionAlice.toggleCourse(courseA);
  sessionAlice.toggleGoods(goodsA, 2);

  assert.strictEqual(sessionAlice.totalItemsCount, 2, '❌ Alice 草稿应有 2 项');
  assert.strictEqual(sessionBob.totalItemsCount, 0, '❌ Bob 草稿必须严格为空，严禁被 Alice 污染！');
  assert.strictEqual(sessionBob.selectedCourses.length, 0);
  assert.strictEqual(sessionBob.selectedGoods.length, 0);
  assert.strictEqual(sessionBob.financialSummary.totalAmount, 0);

  sessionBob.toggleCourse(courseB);
  assert.strictEqual(sessionAlice.selectedCourses.length, 1);
  assert.strictEqual(sessionAlice.selectedCourses[0].id, 'crs-qm');
  assert.strictEqual(sessionBob.selectedCourses.length, 1);
  assert.strictEqual(sessionBob.selectedCourses[0].id, 'crs-jj');
  console.log('  ✔ 单例协调器多会话独立隔离性断言通过\n');

  // =========================================================================
  // 场景 23: 真实 Http 适配器部分成功时学员全息档案缓存即时失效断言
  // =========================================================================
  console.log('>>> [Scenario 23] 部分成功时学员档案全景投影缓存失效补偿断言...');
  let invalidatedStudentId = null;
  const originalInvalidate = require('../mini-program/dist/build/mp-weixin/projectors/student/projector.js')
    .studentProjector.invalidateDossier;
  require('../mini-program/dist/build/mp-weixin/projectors/student/projector.js').studentProjector.invalidateDossier = (sid) => {
    invalidatedStudentId = sid;
  };

  const { HttpEnrollmentAdapter } = require(
    '../mini-program/dist/build/mp-weixin/coordinators/enrollment/adapters/http-enrollment.adapter.js'
  );
  const realHttpAdapter = new HttpEnrollmentAdapter();

  // 模拟 studentApi.enrollStudent: 第 1 门成功，第 2 门失败
  const studentApiModule = require('../mini-program/dist/build/mp-weixin/api/student.js').studentApi;
  const originalEnrollStudent = studentApiModule.enrollStudent;
  let callCount = 0;
  studentApiModule.enrollStudent = async (payload) => {
    callCount++;
    if (callCount === 1) {
      return { success: true, orderNo: 'ORD-PARTIAL-SUCCESS-1' };
    }
    throw new Error('网络连接超时 504 Gateway Timeout');
  };

  const sessionHttpPartial = startSession(student1, { port: realHttpAdapter });
  sessionHttpPartial.toggleCourse(courseA);
  sessionHttpPartial.toggleCourse(courseB);

  let httpPartialCaught = false;
  try {
    await sessionHttpPartial.submit();
  } catch (e) {
    httpPartialCaught = true;
    assert.ok(e.partialCompletedCourseIds && e.partialCompletedCourseIds.length === 1);
  }
  assert.ok(httpPartialCaught, '❌ HttpEnrollmentAdapter 部分失败应抛出自愈异常');
  assert.strictEqual(
    invalidatedStudentId,
    'stu-101',
    '❌ 部分成功后必须立即失效学员全息档案缓存，以防档案投影陈旧！'
  );

  // 恢复 mock
  studentApiModule.enrollStudent = originalEnrollStudent;
  require('../mini-program/dist/build/mp-weixin/projectors/student/projector.js').studentProjector.invalidateDossier = originalInvalidate;
  console.log('  ✔ 部分成功时学员全息档案缓存即时失效补偿断言通过\n');

  console.log('================================================================================');
  console.log('🎉 恭喜！学员开单意图协调器深模块所有专属契约与高危场景 100% 验证通过！');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
