/**
 * ==============================================================================
 * Challenger M1-2: 后端新增端点与数据持久化对抗性检验套件 (Empirical Controller Harness)
 *
 * 检验项：
 * 1. 钱包充提实测：POST /api/students/:id/wallet/recharge 与 withdraw
 *    - 充值本金与赠送金累加正确性
 *    - 赠送金严禁提现规则 (提现金额超过本金余额时强拦截)
 *    - 透支提现拦截规则 (提现金额超过总余额时强拦截)
 *    - 零本金提现拦截 (哪怕账户有赠送金，本金为0时提现1元也必须被拦截)
 *    - 本金提现扣减与底层数据持久化
 *    - WalletLedger 财务账本流水入库验证
 *
 * 2. 班级删除完整性实测：DELETE /api/educational/classes/:id
 *    - 存在在读学员 (active 课包 / currentStudentCount > 0) 禁止删除
 *    - 存在排课日程且有点名考勤消课记录 / completed 状态的班级禁止删除
 *    - 无依赖班级安全解绑历史非活动课包并物理删除实体
 *
 * 3. 订单修改实测：PUT /api/financial/orders/:id
 *    - 正常订单修改与持久化落盘
 *    - 财务账期加锁保护订单 (isLocked = true) 严禁修改
 *    - 已作废订单 (status = 'void') 严禁修改
 *    - 加锁订单严禁作废冲正
 * ==============================================================================
 */

const path = require('path');
const { PrismaService } = require('../server/dist/prisma/prisma.service');
const { StudentService } = require('../server/dist/modules/student/student.service');
const { StudentController } = require('../server/dist/modules/student/student.controller');
const { EducationalService } = require('../server/dist/modules/educational/educational.service');
const { EducationalController } = require('../server/dist/modules/educational/educational.controller');
const { FinancialService } = require('../server/dist/modules/financial/financial.service');
const { FinancialController } = require('../server/dist/modules/financial/financial.controller');

const prisma = new PrismaService();
const studentService = new StudentService(prisma);
const studentController = new StudentController(studentService);
const educationalService = new EducationalService(prisma);
const educationalController = new EducationalController(educationalService);
const financialService = new FinancialService(prisma);
const financialController = new FinancialController(financialService);

let passCount = 0;
let failCount = 0;
const testResults = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    passCount++;
    testResults.push({ name: testName, status: 'PASS', detail });
    console.log(`  ✅ [PASS] ${testName}${detail ? ' -> ' + detail : ''}`);
  } else {
    failCount++;
    testResults.push({ name: testName, status: 'FAIL', detail });
    console.error(`  ❌ [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
  }
}

const mockAdminUser = {
  id: 'user-donghaichao',
  account: 'donghaichao',
  realName: '冬海潮',
  dataScope: 'all',
  roles: [{ code: 'super_admin' }],
  permissions: ['*'],
};

// ==============================================================================
// 1. 钱包充提对抗实测 (Student Wallet)
// ==============================================================================
async function testWalletModule() {
  console.log('----------------------------------------------------------------');
  console.log('【领域 1】学员电子钱包充值与提现对抗性测试');
  console.log('----------------------------------------------------------------');

  const testStudentNo = `TEST_STU_${Date.now()}`;
  let studentId = null;

  try {
    // 1.1 准备独立测试学员
    const campus = await prisma.campus.findFirst();
    const createdStudent = await prisma.student.create({
      data: {
        campusId: campus.id,
        studentNo: testStudentNo,
        name: '对抗性测试学员',
        gender: 'male',
        phone: '13900009999',
        status: 'normal',
      },
    });
    studentId = createdStudent.id;

    // 初始状态：无钱包或零余额
    let initWallet = await prisma.studentWallet.findUnique({
      where: { studentId },
    });
    assert(
      !initWallet || (initWallet.principalBalance === 0 && initWallet.bonusBalance === 0),
      '1.1 初始学员钱包为未开通或零余额状态',
    );

    // 1.2 零余额提现拦截测试
    let zeroWithdrawError = null;
    try {
      await studentController.withdrawWallet(
        studentId,
        { amount: 50, reason: '尝试空账提现' },
        mockAdminUser,
      );
    } catch (err) {
      zeroWithdrawError = err;
    }
    assert(
      zeroWithdrawError && zeroWithdrawError.status === 400,
      '1.2 零余额透支提现被严格拦截 (400 BadRequestException)',
      zeroWithdrawError ? zeroWithdrawError.message : '未捕获预期异常',
    );

    // 1.3 正常充值本金与赠送金入账
    // 本金 200，赠送金 50
    const rechargeResult = await studentController.rechargeWallet(
      studentId,
      {
        amount: 200,
        bonus: 50,
        operator: '财务核销员A',
        remark: '对抗测试首充入账',
      },
      mockAdminUser,
    );

    assert(rechargeResult && rechargeResult.success === true, '1.3 钱包充值接口调用成功响应');
    assert(
      rechargeResult.balance === 250 &&
        rechargeResult.principalBalance === 200 &&
        rechargeResult.bonusBalance === 50,
      '1.3.1 接口返回余额正确性 (总额=250, 本金=200, 赠送=50)',
      JSON.stringify(rechargeResult),
    );

    // 1.4 底层数据库落盘核验 (StudentWallet & WalletLedger)
    const dbWalletAfterRecharge = await prisma.studentWallet.findUnique({
      where: { studentId },
    });
    assert(
      dbWalletAfterRecharge &&
        dbWalletAfterRecharge.principalBalance === 200 &&
        dbWalletAfterRecharge.bonusBalance === 50,
      '1.4 底层 StudentWallet 表持久化数据一致 (principal=200, bonus=50)',
    );

    const rechargeLedgers = await prisma.walletLedger.findMany({
      where: { studentId, type: 'recharge' },
    });
    assert(
      rechargeLedgers.length === 1 &&
        rechargeLedgers[0].amount === 250 &&
        rechargeLedgers[0].principalChange === 200 &&
        rechargeLedgers[0].bonusChange === 50 &&
        rechargeLedgers[0].operator === '财务核销员A',
      '1.4.1 底层 WalletLedger 流水账本落盘记录完整',
    );

    // 1.5 对抗测试：尝试提现动用赠送金 (提现 220 > 本金 200，但在总额 250 内)
    let bonusWithdrawError = null;
    try {
      await studentController.withdrawWallet(
        studentId,
        { amount: 220, reason: '试图动用赠送金提现' },
        mockAdminUser,
      );
    } catch (err) {
      bonusWithdrawError = err;
    }
    assert(
      bonusWithdrawError &&
        bonusWithdrawError.status === 400 &&
        bonusWithdrawError.message.includes('赠送金不可提现'),
      '1.5 赠送金不可提现风控规则生效：提现超本金被拦截 (400 BadRequestException)',
      bonusWithdrawError ? bonusWithdrawError.message : '未捕获预期异常',
    );

    // 核验数据库未被非法扣减
    const dbWalletAfterIllegal = await prisma.studentWallet.findUnique({
      where: { studentId },
    });
    assert(
      dbWalletAfterIllegal.principalBalance === 200 && dbWalletAfterIllegal.bonusBalance === 50,
      '1.5.1 拦截后数据库本金余额未被非法扣减 (依然为 200)',
    );

    // 1.6 对抗测试：尝试透支提现 (提现 500 > 总额 250)
    let overdraftError = null;
    try {
      await studentController.withdrawWallet(
        studentId,
        { amount: 500, reason: '透支提现' },
        mockAdminUser,
      );
    } catch (err) {
      overdraftError = err;
    }
    assert(
      overdraftError && overdraftError.status === 400,
      '1.6 透支提现被严格拦截 (400 BadRequestException)',
      overdraftError ? overdraftError.message : '未捕获预期异常',
    );

    // 1.7 正常部分本金提现 (提现 80 <= 本金 200)
    const normalWithdrawResult = await studentController.withdrawWallet(
      studentId,
      { amount: 80, reason: '学员退部分本金', operator: '核销员B' },
      mockAdminUser,
    );
    assert(
      normalWithdrawResult && normalWithdrawResult.success === true,
      '1.7 正常本金提现请求成功',
    );
    assert(
      normalWithdrawResult.principalBalance === 120 &&
        normalWithdrawResult.bonusBalance === 50 &&
        normalWithdrawResult.balance === 170,
      '1.7.1 提现后接口返回计算正确 (本金=120, 赠送=50, 总额=170)',
    );

    // 核验数据库落盘与流水
    const dbWalletAfterNormal = await prisma.studentWallet.findUnique({
      where: { studentId },
    });
    assert(
      dbWalletAfterNormal.principalBalance === 120 && dbWalletAfterNormal.bonusBalance === 50,
      '1.7.2 提现后底层数据库本金扣减落盘一致 (120)',
    );

    const withdrawLedgers = await prisma.walletLedger.findMany({
      where: { studentId, type: 'withdraw' },
    });
    assert(
      withdrawLedgers.length === 1 &&
        withdrawLedgers[0].amount === -80 &&
        withdrawLedgers[0].principalChange === -80 &&
        withdrawLedgers[0].bonusChange === 0 &&
        withdrawLedgers[0].operator === '核销员B',
      '1.7.3 提现出账负向流水记录落盘 (amount=-80, principalChange=-80, operator=核销员B)',
    );

    // 1.8 边界测试：提现全部剩余本金 (提现 120)
    const fullPrincipalResult = await studentController.withdrawWallet(
      studentId,
      { amount: 120, reason: '提现全部本金' },
      mockAdminUser,
    );
    assert(
      fullPrincipalResult &&
        fullPrincipalResult.principalBalance === 0 &&
        fullPrincipalResult.bonusBalance === 50 &&
        fullPrincipalResult.balance === 50,
      '1.8 本金清零后，赠送金 50 仍完整保留在账户',
    );

    // 1.9 本金为零时，即使账户有 50 赠送金，提现哪怕 1 元也必须被拦截
    let zeroPrincipalError = null;
    try {
      await studentController.withdrawWallet(
        studentId,
        { amount: 1, reason: '本金为零动用赠送金' },
        mockAdminUser,
      );
    } catch (err) {
      zeroPrincipalError = err;
    }
    assert(
      zeroPrincipalError &&
        zeroPrincipalError.status === 400 &&
        zeroPrincipalError.message.includes('赠送金不可提现'),
      '1.9 本金为零时，任何大于0的提现均被拦截 (即使总余额=50)',
      zeroPrincipalError ? zeroPrincipalError.message : '未捕获预期异常',
    );
  } finally {
    // 清理测试学员及其资产
    if (studentId) {
      await prisma.walletLedger.deleteMany({ where: { studentId } });
      await prisma.studentWallet.deleteMany({ where: { studentId } });
      await prisma.student.delete({ where: { id: studentId } });
    }
  }
}

// ==============================================================================
// 2. 班级删除完整性对抗实测 (DELETE /api/educational/classes/:id)
// ==============================================================================
async function testClassDeleteModule() {
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 2】班级删除完整性与依赖防线对抗性测试');
  console.log('----------------------------------------------------------------');

  const campus = await prisma.campus.findFirst();
  const course = await prisma.course.findFirst();
  const teacher = await prisma.user.findFirst();
  const classroom = await prisma.classroom.findFirst();

  // 2.1 对抗测试：有在读学员 (active 课包) 的班级禁止删除
  // 使用既有班级 cls-scratch-sat-0900 (内置 3 名 active 学员)
  let activeStudentDeleteError = null;
  try {
    await educationalController.deleteClass('cls-scratch-sat-0900');
  } catch (err) {
    activeStudentDeleteError = err;
  }
  assert(
    activeStudentDeleteError &&
      activeStudentDeleteError.status === 400 &&
      activeStudentDeleteError.message.includes('在读学员'),
    '2.1 有在读学员的班级禁止删除 (400 BadRequest 拦截)',
    activeStudentDeleteError ? activeStudentDeleteError.message : '未捕获预期异常',
  );
  // 核验数据库实体未被删除
  const stillExistClass = await prisma.class.findUnique({
    where: { id: 'cls-scratch-sat-0900' },
  });
  assert(!!stillExistClass, '2.1.1 拦截后数据库班级记录完好无损');

  // 2.2 对抗测试：有排课考勤记录的班级禁止删除
  // 创建一个 currentStudentCount = 0 的班级，但挂载带有考勤消课记录的排课日程
  const testClassWithAtt = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      code: `CLS_ATT_${Date.now()}`,
      name: '带考勤排课测试班',
      capacity: 10,
      currentStudentCount: 0,
      teacherId: teacher.id,
      classroomId: classroom.id,
      startDate: new Date(),
      endDate: new Date(),
      status: 'in_progress',
    },
  });

  const student = await prisma.student.findFirst();
  const testSchedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClassWithAtt.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-15',
      startTime: '10:00',
      endTime: '11:30',
      status: 'completed',
    },
  });

  const testAttendance = await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: testSchedule.id,
      studentId: student.id,
      status: 'present',
      deductLessons: 1,
      operator: '测试教务员',
    },
  });

  try {
    let attendanceDeleteError = null;
    try {
      await educationalController.deleteClass(testClassWithAtt.id);
    } catch (err) {
      attendanceDeleteError = err;
    }
    assert(
      attendanceDeleteError &&
        attendanceDeleteError.status === 400 &&
        attendanceDeleteError.message.includes('考勤'),
      '2.2 有点名考勤消课记录的班级禁止删除 (400 BadRequest 拦截)',
      attendanceDeleteError ? attendanceDeleteError.message : '未捕获预期异常',
    );

    const checkAttClass = await prisma.class.findUnique({
      where: { id: testClassWithAtt.id },
    });
    assert(!!checkAttClass, '2.2.1 拦截后数据库班级记录完好无损');
  } finally {
    // 清理临时考勤与日程
    await prisma.attendanceRecord.delete({ where: { id: testAttendance.id } });
    await prisma.scheduleEvent.delete({ where: { id: testSchedule.id } });
    await prisma.class.delete({ where: { id: testClassWithAtt.id } });
  }

  // 2.3 正向测试：无依赖班级安全解绑与物理删除
  // 创建一个无在读学员、仅含未执行空日程与历史非活动课包的班级
  const safeDeleteClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      code: `CLS_SAFE_${Date.now()}`,
      name: '安全解绑测试班',
      capacity: 10,
      currentStudentCount: 0,
      teacherId: teacher.id,
      classroomId: classroom.id,
      startDate: new Date(),
      endDate: new Date(),
      status: 'recruiting',
    },
  });

  // 挂载一个未执行空日程
  const emptySchedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: safeDeleteClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-20',
      startTime: '14:00',
      endTime: '15:30',
      status: 'scheduled',
    },
  });

  // 挂载一个已完结的历史课包 (status = 'completed')
  const historicalPkg = await prisma.studentCoursePackage.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      classId: safeDeleteClass.id,
      totalLessons: 20,
      remainingLessons: 0,
      consumedLessons: 20,
      status: 'completed',
    },
  });

  try {
    const safeDeleteResult = await educationalController.deleteClass(safeDeleteClass.id);

    assert(
      safeDeleteResult && safeDeleteResult.success === true,
      '2.3 无依赖班级安全物理删除成功 (200 OK)',
      safeDeleteResult.message,
    );

    // 验证数据库状态：班级实体彻底清除
    const dbDeletedClass = await prisma.class.findUnique({
      where: { id: safeDeleteClass.id },
    });
    assert(!dbDeletedClass, '2.3.1 班级实体已从数据库彻底物理删除');

    // 验证未执行日程已被级联清理
    const dbDeletedSchedule = await prisma.scheduleEvent.findUnique({
      where: { id: emptySchedule.id },
    });
    assert(!dbDeletedSchedule, '2.3.2 未执行的空排课日程已被级联清理');

    // 验证历史课包安全解绑 (classId 置为 null，而不是报错或级联删除课包)
    const dbHistoricalPkg = await prisma.studentCoursePackage.findUnique({
      where: { id: historicalPkg.id },
    });
    assert(
      dbHistoricalPkg && dbHistoricalPkg.classId === null,
      '2.3.3 历史课包外键解绑为 null，资产档案安全保留',
    );
  } finally {
    await prisma.studentCoursePackage.delete({ where: { id: historicalPkg.id } });
  }
}

// ==============================================================================
// 3. 订单修改与锁定制约对抗实测 (PUT /api/financial/orders/:id)
// ==============================================================================
async function testOrderModule() {
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 3】订单修改约束与账期锁保护对抗性测试');
  console.log('----------------------------------------------------------------');

  const campus = await prisma.campus.findFirst();
  const student = await prisma.student.findFirst();
  const user = await prisma.user.findFirst();

  const testOrderNo = `ORD_TEST_${Date.now()}`;
  const testOrder = await prisma.order.create({
    data: {
      campusId: campus.id,
      studentId: student.id,
      orderNo: testOrderNo,
      orderType: 'regular',
      status: 'paid',
      originalPrice: 1000,
      receivableAmount: 1000,
      actualAmount: 1000,
      paymentMethod: 'wechat',
      creatorId: user.id,
      ownerId: user.id,
      channel: 'ground',
      isLocked: false,
      remark: '原始订单备注',
    },
  });

  const orderId = testOrder.id;

  try {
    // 3.1 正常订单信息修改与落盘
    const updateResult = await financialController.updateOrder(
      orderId,
      {
        remark: '修改后的正向备注信息',
        actualAmount: 950,
        deliveryStatus: 'delivered',
      },
      mockAdminUser,
    );
    assert(
      updateResult && updateResult.id === orderId,
      '3.1 正常订单信息修改成功 (200 OK)',
    );

    const dbUpdatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });
    assert(
      dbUpdatedOrder.remark === '修改后的正向备注信息' &&
        dbUpdatedOrder.actualAmount === 950 &&
        dbUpdatedOrder.deliveryStatus === 'delivered',
      '3.1.1 订单修改内容真实落盘 (actualAmount=950, remark, deliveryStatus)',
    );

    // 3.2 财务账期加锁保护实测 (isLocked = true)
    const lockResult = await financialController.lockOrder(orderId, { isLocked: true });
    assert(lockResult && lockResult.isLocked === true, '3.2 订单账期加锁接口调用成功');

    const dbLockedOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });
    assert(dbLockedOrder.isLocked === true, '3.2.1 底层数据库 isLocked 标记确立为 true');

    // 3.3 对抗测试：尝试修改已锁定订单
    let updateLockedError = null;
    try {
      await financialController.updateOrder(
        orderId,
        { remark: '【恶意篡改】账期加锁后的非法修改', actualAmount: 100 },
        mockAdminUser,
      );
    } catch (err) {
      updateLockedError = err;
    }
    assert(
      updateLockedError &&
        updateLockedError.status === 400 &&
        updateLockedError.message.includes('加锁保护'),
      '3.3 已锁定订单禁止修改 (400 BadRequest 强拦截)',
      updateLockedError ? updateLockedError.message : '未捕获预期异常',
    );

    const dbOrderAfterHacked = await prisma.order.findUnique({
      where: { id: orderId },
    });
    assert(
      dbOrderAfterHacked.actualAmount === 950 &&
        dbOrderAfterHacked.remark === '修改后的正向备注信息',
      '3.3.1 拦截后数据库订单金额与备注未被篡改',
    );

    // 3.4 对抗测试：尝试作废已锁定订单
    let voidLockedError = null;
    try {
      await financialController.voidOrder(orderId);
    } catch (err) {
      voidLockedError = err;
    }
    assert(
      voidLockedError &&
        voidLockedError.status === 400 &&
        voidLockedError.message.includes('加锁保护'),
      '3.4 已加锁订单严禁作废冲正 (400 BadRequest 拦截)',
      voidLockedError ? voidLockedError.message : '未捕获预期异常',
    );

    // 3.5 解锁订单并正常作废
    await financialController.lockOrder(orderId, { isLocked: false });

    const voidResult = await financialController.voidOrder(orderId);
    assert(voidResult && voidResult.status === 'void', '3.5 解锁后订单正常作废成功');

    const dbVoidedOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });
    assert(dbVoidedOrder.status === 'void', '3.5.1 订单状态落盘为 void');

    // 3.6 对抗测试：尝试修改已作废订单
    let updateVoidedError = null;
    try {
      await financialController.updateOrder(
        orderId,
        { remark: '已作废订单篡改' },
        mockAdminUser,
      );
    } catch (err) {
      updateVoidedError = err;
    }
    assert(
      updateVoidedError &&
        updateVoidedError.status === 400 &&
        updateVoidedError.message.includes('已作废'),
      '3.6 已作废订单严禁修改 (400 BadRequest 强拦截)',
      updateVoidedError ? updateVoidedError.message : '未捕获预期异常',
    );
  } finally {
    await prisma.order.delete({ where: { id: orderId } });
  }
}

// ==============================================================================
// 主测试运行与报告生成
// ==============================================================================
async function runAll() {
  console.log('================================================================================');
  console.log('🎯 Challenger M1-2: 后端新增端点与数据持久化对抗性实测套件启动');
  console.log('================================================================================\n');

  try {
    await testWalletModule();
    await testClassDeleteModule();
    await testOrderModule();

    console.log('\n================================================================================');
    console.log(`📊 测试汇总: 总计 ${passCount + failCount} 项断言 | 通过: ${passCount} | 失败: ${failCount}`);
    console.log(`📈 对抗性测试通过率: ${((passCount / (passCount + failCount)) * 100).toFixed(2)}%`);
    console.log('================================================================================\n');

    if (failCount > 0) {
      console.error('❌ 对抗性测试存在失败断言！判决：CHALLENGE_FAILED');
      process.exitCode = 1;
    } else {
      console.log('🏆 所有对抗性与持久化断言 100% 全部通过！判决：APPROVE');
      process.exitCode = 0;
    }
  } catch (err) {
    console.error('💥 测试运行器未捕获异常:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runAll();
