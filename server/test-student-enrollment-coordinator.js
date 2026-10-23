const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('招生签约履约协调器（StudentEnrollmentCoordinator）专项验证套件');
  console.log('班容准入校验、钱包防透支、外键双向绑定、退费折算与审批回滚闭环');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;
  function assert(condition, desc) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS [${passed}]: ${desc}`);
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      process.exit(1);
    }
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const HOST = '127.0.0.1';

  // 1. 登录超管获取 Token
  const loginRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'donghaichao', password: '123456' },
  );
  assert(loginRes.status === 200 || loginRes.status === 201, '超管登录成功获取 Token');
  const token = loginRes.body?.data?.accessToken || loginRes.body?.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 准备测试数据：校区、课程、班级（满员测试班和普通班）、学员
  const campus = await prisma.campus.findFirst();
  assert(!!campus, '数据库存在测试校区');

  const course = await prisma.course.findFirst({
    where: { pricePerLesson: { gt: 0 } },
  });
  const classroom = await prisma.classroom.findFirst();
  assert(!!classroom, '数据库存在测试教室');

  const now = new Date();
  const future = new Date(Date.now() + 90 * 86400000);

  // 创建一个满员班级 (capacity: 2, currentStudentCount: 2)
  const fullClassCode = `CLS-FULL-${Date.now()}`;
  const fullClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      classroomId: classroom.id,
      code: fullClassCode,
      name: '测试满员特训班',
      capacity: 2,
      currentStudentCount: 2,
      startDate: now,
      endDate: future,
      teacherId: (await prisma.user.findFirst()).id,
      status: 'full',
    },
  });

  // 创建一个正常空班级 (capacity: 10, currentStudentCount: 0)
  const openClassCode = `CLS-OPEN-${Date.now()}`;
  const openClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      classroomId: classroom.id,
      code: openClassCode,
      name: '测试开班招生班',
      capacity: 10,
      currentStudentCount: 0,
      startDate: now,
      endDate: future,
      teacherId: (await prisma.user.findFirst()).id,
      status: 'recruiting',
    },
  });

  // 创建一个测试学员
  const studentSeq = Math.floor(100000 + Math.random() * 900000);
  const testStudent = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `STEST${studentSeq}`,
      name: `协调器测试学员-${studentSeq}`,
      gender: 'male',
      phone: `138${studentSeq.toString().slice(0, 8)}`,
      status: 'normal',
    },
  });
  // 初始化空钱包
  await prisma.studentWallet.create({
    data: {
      studentId: testStudent.id,
      principalBalance: 0,
      bonusBalance: 0,
    },
  });

  console.log('\n--- 场景一：班级满员准入强校验拦截 ---');
  const overCapacityRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/student/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: testStudent.id,
      courseId: course.id,
      classId: fullClass.id,
      totalLessons: 10,
      pricePerLesson: course.pricePerLesson,
      paymentMethod: 'wechat',
    },
  );
  assert(overCapacityRes.status === 400, '向满员班级签约时后端返回 400 拦截');
  const overMsg = overCapacityRes.body?.message || '';
  assert(overMsg.includes('严禁超编签约入班') || overMsg.includes('额定人数上限'), `拦截文案精确契合防腐规则: "${overMsg}"`);

  console.log('\n--- 场景二：电子钱包透支拦截与充值履约 ---');
  // 此时学员钱包余额为 0，尝试用 wallet 支付
  const walletOverdraftRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/student/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: testStudent.id,
      courseId: course.id,
      totalLessons: 10,
      pricePerLesson: course.pricePerLesson,
      paymentMethod: 'wallet',
    },
  );
  assert(walletOverdraftRes.status === 400, '电子钱包余额不足时阻断开单签约 (400)');

  // 给学员钱包充值 10000 元本金
  const rechargeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/student/${testStudent.id}/wallet/recharge`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      amount: 10000,
      bonus: 0,
      paymentMethod: 'wechat',
      description: '自动化测试预存本金',
    },
  );
  assert(rechargeRes.status === 200 || rechargeRes.status === 201, '学员钱包充值成功');

  console.log('\n--- 场景三：正常签约开单与班级履约联动 ---');
  const enrollRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/student/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: testStudent.id,
      courseId: course.id,
      classId: openClass.id,
      totalLessons: 20,
      bonusLessons: 5,
      pricePerLesson: 100,
      paymentMethod: 'wallet',
      channel: 'ground',
      remark: '协调器自动化签约单',
    },
  );
  assert(enrollRes.status === 200 || enrollRes.status === 201, '签约开单成功');
  const enrollData = enrollRes.body?.data || enrollRes.body;
  assert(enrollData.success === true, '开单返回 success: true');
  assert(enrollData.assignedClass === true, '回执标明已成功分班');
  assert(!!enrollData.packageId, `生成有效课包 ID: ${enrollData.packageId}`);
  assert(!!enrollData.orderId, `生成有效订单 ID: ${enrollData.orderId}`);

  // 数据库级断言：
  // 1. Order.packageId 显式外键已物理关联
  const dbOrder = await prisma.order.findUnique({
    where: { id: enrollData.orderId },
  });
  assert(dbOrder.packageId === enrollData.packageId, '订单表 Order.packageId 显式外键精确绑定课包 ID');

  // 2. 班级人数从 0 原子递增至 1
  const updatedOpenClass = await prisma.class.findUnique({
    where: { id: openClass.id },
  });
  assert(updatedOpenClass.currentStudentCount === 1, '实体班级人数原子递增: currentStudentCount = 1');

  // 3. 学员学籍状态流转为 in_class
  const updatedStudent = await prisma.student.findUnique({
    where: { id: testStudent.id },
  });
  assert(updatedStudent.status === 'in_class', '学员生命周期状态自动流转为 in_class');

  // 4. 钱包消费账本记账扣减
  const walletLedger = await prisma.walletLedger.findFirst({
    where: { studentId: testStudent.id, type: 'consumption' },
    orderBy: { createdAt: 'desc' },
  });
  assert(!!walletLedger && walletLedger.amount === 2000, '自动记录钱包消费账本流水 (扣减 2000 元)');

  console.log('\n--- 场景四：盛通防腐退费发起与三级审批工单联动 ---');
  // 针对刚签约的课包 (20 正课 + 5 赠课, price: 100)
  const refundReq = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/student/${testStudent.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'refund',
      packageId: enrollData.packageId,
      reasonCategory: '搬家离校',
      reasonDetail: '跨省搬迁申请退费',
    },
  );
  assert(refundReq.status === 200 || refundReq.status === 201, '发起退费异动成功');
  const refundResult = refundReq.body?.data || refundReq.body;
  assert(refundResult.success === true, '退费回执 success: true');
  // 盛通退费规则校验：赠课不折现，实付正课 20 课时折现 2000 元
  assert(refundResult.computedRefundAmount === 2000, `盛通规则计算实退金额: ¥${refundResult.computedRefundAmount} (赠送5课时不折现)`);

  // 数据库级断言：
  // 课包置为 refunded
  const refundedPkg = await prisma.studentCoursePackage.findUnique({
    where: { id: enrollData.packageId },
  });
  assert(refundedPkg.status === 'refunded' && refundedPkg.remainingLessons === 0, '课包状态置为 refunded，剩余课时归零');

  // 退费单生成且绑定 packageId
  const refundOrderInDb = await prisma.order.findUnique({
    where: { id: refundResult.orderId },
  });
  assert(refundOrderInDb.packageId === enrollData.packageId, '退费订单物理外键 packageId 精确指向被退课包');
  assert(refundOrderInDb.status === 'unpaid', '退费订单初始状态为 unpaid 待审批');

  // 自动登记三级审批流
  const approvalFlow = await prisma.approvalFlow.findUnique({
    where: { orderId: refundResult.orderId },
  });
  assert(!!approvalFlow && approvalFlow.currentStep === 1, '自动登记三级审批流工单，当前处于第 1 级 (教学核实)');

  console.log('\n--- 场景五：审批驳回资产精确回滚 (零正则无胶水溯源) ---');
  // 模拟教务主管审核驳回
  const rejectRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${approvalFlow.id}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      action: 'reject',
      comment: '材料不全，驳回重填',
    },
  );
  assert(rejectRes.status === 200 || rejectRes.status === 201, '审批驳回操作成功');

  // 验证原课包资产被协调器精确解冻恢复
  const restoredPkg = await prisma.studentCoursePackage.findUnique({
    where: { id: enrollData.packageId },
  });
  assert(restoredPkg.status === 'active', '课包状态权威恢复为 active');
  // 驳回 = 退费未发生：恢复到发起退费前的 25 课时 (20 实付 + 5 赠送)。
  // 旧逻辑按退费金额反推只恢复 20 课时，赠课被吞，且 bonusLessons=5 仍在，导致实付正课被少算 5 节
  assert(restoredPkg.remainingLessons === 25, `课包精确恢复为退费前的 25 课时 (20 实付 + 5 赠送，原路资产复原)`);

  console.log('\n--- 场景六：重新发起退费并通过三级终审 ---');
  const reRefundReq = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/student/${testStudent.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'refund',
      packageId: enrollData.packageId,
      reasonCategory: '搬家离校',
      reasonDetail: '材料补齐再次申请退费',
    },
  );
  assert(reRefundReq.status === 200 || reRefundReq.status === 201, '二次发起退费成功');
  const reRefundData = reRefundReq.body?.data || reRefundReq.body;

  // 逐步审批通过：Step 1 -> Step 2 -> Step 3
  const flow2 = await prisma.approvalFlow.findUnique({
    where: { orderId: reRefundData.orderId },
  });

  // Step 1: 教学端考勤核实
  const step1 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${flow2.id}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    { action: 'approve', comment: '教学出勤已核实' },
  );
  assert(step1.body?.status === 'pending' || step1.body?.data?.status === 'pending', '第 1 级教学核实通过，流转至第 2 级');

  // Step 2: 校长审批
  const step2 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${flow2.id}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    { action: 'approve', comment: '校长核准同意' },
  );
  assert(step2.body?.status === 'pending' || step2.body?.data?.status === 'pending', '第 2 级校长复核通过，流转至第 3 级');

  // Step 3: 财务终审
  const step3 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${flow2.id}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    { action: 'approve', comment: '财务退款终审通过' },
  );
  assert(step3.body?.status === 'approved' || step3.body?.data?.status === 'approved', '三级风控全流程终审通过');

  // 终审通过后，退费订单确立为 paid 终态并记录支付时间
  const finalOrder = await prisma.order.findUnique({
    where: { id: reRefundData.orderId },
  });
  assert(finalOrder.status === 'paid', '退费订单状态确立为 paid 终态');
  assert(!!finalOrder.payTime, '退费订单成功记录 payTime 支付结算时间戳');

  // 清理测试临时数据
  await prisma.class.deleteMany({
    where: { id: { in: [fullClass.id, openClass.id] } },
  });

  console.log('\n================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项招生签约履约协调器专项测试用例 100% 验证通过！`);
  console.log('================================================================');
}

runTests()
  .catch((e) => {
    console.error('测试运行异常失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
