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
  console.log('财务多级审批编排深模块（FinancialApprovalOrchestrator）专项验证套件');
  console.log('包含：标准三级流转、插件化履约策略SPI、退费资产回滚、单请求批处理与时间轴审计');
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

  // 1. 登录超管账号获取 Token
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
  const token = loginRes.body.data.accessToken;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 基础环境数据核验
  const campus = await prisma.campus.findFirst();
  assert(!!campus, '数据库存在测试校区');

  const coursesList = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/curriculum/courses',
    method: 'GET',
    headers: authHeaders,
  });
  assert(coursesList.body.data.list.length > 0, '数据库存在测试课程');
  const testCourse = coursesList.body.data.list[0];

  // 创建专属独立测试学员，避免环境脏数据污染
  const uniqueCode = Date.now().toString().slice(-6);
  const testStudent = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `S-FIN-${uniqueCode}`,
      name: `财务审批专项学员-${uniqueCode}`,
      gender: 'male',
      phone: `138${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'normal',
    },
  });
  assert(!!testStudent.id, '专属独立测试学员创建就绪');

  // ============================================================================
  // [测试组 1] 标准三级风控全流程推进与不可变时间轴审计
  // ============================================================================
  console.log('\n--- [测试组 1] 标准三级风控全流程推进与不可变时间轴审计 ---');

  // 1.1 签约创建常规缴费订单
  const enroll1 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: testStudent.id,
      courseId: testCourse.id,
      totalLessons: 12,
      pricePerLesson: 180,
      paymentMethod: 'bank_transfer',
    },
  );
  assert(enroll1.status === 200 || enroll1.status === 201, '成功创建测试签约订单');
  const order1Id = enroll1.body.data.orderId;

  // 1.2 发起多级审批流
  const createFlow1 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals',
      method: 'POST',
      headers: authHeaders,
    },
    {
      orderId: order1Id,
      businessType: 'payment',
      applicantName: '冬海潮（教务顾问）',
    },
  );
  assert(createFlow1.status === 200 || createFlow1.status === 201, '发起多级审批工单成功');
  const flow1 = createFlow1.body.data;
  assert(flow1.currentStep === 1, '审批工单初始处于 Step 1 (教学核实)');
  assert(flow1.status === 'pending', '初始状态为 pending');

  // 1.3 查询初始时间轴
  const timelineInit = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/financial/approvals/${flow1.id}/timeline`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(timelineInit.status === 200, '时间轴接口 GET /timeline 返回 200');
  assert(timelineInit.body.data.canAudit === true, '待审状态工单标记 canAudit: true');
  assert(timelineInit.body.data.currentStep === 1, '时间轴返回当前步态为 1');

  // 1.4 Step 1: 教学端考勤核实通过
  const auditStep1 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${flow1.id}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    { action: 'pass', comment: '学员签约信息与合同排课核验无误' },
  );
  assert(auditStep1.status === 200 || auditStep1.status === 201, 'Step 1 核准通过');
  assert(auditStep1.body.data.currentStep === 2, '工单推进至第 2 级 (校区校长行政复核)');
  assert(auditStep1.body.data.status === 'pending', '中间节点状态保持 pending');

  // 1.5 Step 2: 校区校长行政复核通过
  const auditStep2 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${flow1.id}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    { action: 'pass', comment: '校区准予开课入班' },
  );
  assert(auditStep2.status === 200 || auditStep2.status === 201, 'Step 2 核准通过');
  assert(auditStep2.body.data.currentStep === 3, '工单推进至第 3 级 (财务部资金终审)');

  // 1.6 Step 3: 财务部资金终审核准
  const auditStep3 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${flow1.id}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    { action: 'pass', comment: '招商银行对公打款 2160 元已核验入账' },
  );
  assert(auditStep3.status === 200 || auditStep3.status === 201, 'Step 3 财务终审通过');
  assert(auditStep3.body.data.status === 'approved', '三级风控全流程完结终态为 approved');

  // 1.7 验证底层履约记账结果：Order 变为 paid 且记录 payTime
  const updatedOrder1 = await prisma.order.findUnique({ where: { id: order1Id } });
  assert(updatedOrder1.status === 'paid', 'Payment 履约策略生效：订单状态自动跃迁为 paid');
  assert(!!updatedOrder1.payTime, '订单已记录权威支付结算时间 payTime');

  // 1.8 终态时间轴审计验证
  const timelineFinal = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/financial/approvals/${flow1.id}/timeline`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(timelineFinal.status === 200, '终态时间轴拉取成功');
  assert(timelineFinal.body.data.status === 'approved', '时间轴反映 approved 终态');
  assert(timelineFinal.body.data.canAudit === false, '终结工单 canAudit: false');
  assert(timelineFinal.body.data.nodes.length === 3, '时间轴完整记录 3 个历史审批节点');
  assert(timelineFinal.body.data.nodes[0].stepName === '教学端考勤核实', '节点 1 步骤名准确');
  assert(timelineFinal.body.data.nodes[1].stepName === '校区校长行政复核', '节点 2 步骤名准确');
  assert(timelineFinal.body.data.nodes[2].stepName === '财务部资金终审', '节点 3 步骤名准确');

  // ============================================================================
  // [测试组 2] 退费策略 SPI 与课包资产原子回滚
  // ============================================================================
  console.log('\n--- [测试组 2] 退费策略 SPI 与课包资产原子回滚 ---');

  // 2.1 创建签约在读课包
  const enroll2 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: testStudent.id,
      courseId: testCourse.id,
      totalLessons: 15,
      pricePerLesson: 200,
      paymentMethod: 'alipay',
    },
  );
  assert(enroll2.status === 200 || enroll2.status === 201, `创建签约在读课包成功: ${JSON.stringify(enroll2.body)}`);
  assert(!!enroll2.body?.data?.packageId, '返回了有效课包ID');
  const pkg2Id = enroll2.body.data.packageId;

  // 2.2 发起退费异动
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
      packageId: pkg2Id,
      reasonCategory: '学业调整',
      reasonDetail: '测试审批驳回回滚',
    },
  );
  assert(refundReq.status === 200 || refundReq.status === 201, '发起退费异动成功');
  const refundFlowId = refundReq.body.data.approvalFlowId;
  const refundOrderId = refundReq.body.data.orderId;

  // 验证原课包已被置为 refunded 且课时清零
  const pkgBeforeAudit = await prisma.studentCoursePackage.findUnique({ where: { id: pkg2Id } });
  assert(pkgBeforeAudit.status === 'refunded', '课包预先置为 refunded 冻结');
  assert(pkgBeforeAudit.remainingLessons === 0, '课包可用正课已清零');

  // 2.3 驳回退费工单
  const rejectAudit = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${refundFlowId}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      action: 'reject',
      comment: '材料提供不合规，驳回退费申请！',
    },
  );
  assert(rejectAudit.status === 200 || rejectAudit.status === 201, '驳回请求成功返回');
  assert(rejectAudit.body.data.status === 'rejected', '审批单状态被确立为 rejected 终态');

  // 2.4 验证 RefundSettlementStrategy 逆向回滚：课包资产原路恢复
  const restoredPkg = await prisma.studentCoursePackage.findUnique({ where: { id: pkg2Id } });
  assert(restoredPkg.status === 'active', 'Refund 策略生效：课包状态权威恢复为 active');
  assert(restoredPkg.remainingLessons === 15, '课包 15 课时可用正课精确恢复原状');

  const rejectedOrder = await prisma.order.findUnique({ where: { id: refundOrderId } });
  assert(rejectedOrder.status === 'rejected', '关联退费订单自动标记为 rejected');

  // ============================================================================
  // [测试组 3] 钱包预存策略 SPI 结算与资金台账流水联动
  // ============================================================================
  console.log('\n--- [测试组 3] 钱包预存策略 SPI 结算与资金台账流水联动 ---');

  // 3.1 创建一笔钱包预存充值订单 (通过 Order 创建)
  const walletPrestoreOrder = await prisma.order.create({
    data: {
      campusId: testStudent.campusId,
      studentId: testStudent.id,
      orderNo: `ORD-PRESTORE-${Date.now()}`,
      orderType: 'wallet_recharge',
      status: 'unpaid',
      originalPrice: 888,
      discountAmount: 0,
      couponAmount: 0,
      receivableAmount: 888,
      actualAmount: 888,
      paymentMethod: 'wechat',
      creatorId: 'user-donghaichao',
      ownerId: 'user-donghaichao',
      channel: 'ground',
    },
  });

  // 记录学员充值前本金余额
  const walletBefore = await prisma.studentWallet.findUnique({ where: { studentId: testStudent.id } });
  const balanceBefore = walletBefore ? walletBefore.principalBalance : 0;

  // 3.2 挂载钱包预存审批工单
  const prestoreFlowRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals',
      method: 'POST',
      headers: authHeaders,
    },
    {
      orderId: walletPrestoreOrder.id,
      businessType: 'wallet_prestore',
      applicantName: '前台顾问李雷',
    },
  );
  assert(prestoreFlowRes.status === 200 || prestoreFlowRes.status === 201, '发起钱包预存审批工单成功');
  const prestoreFlowId = prestoreFlowRes.body.data.id;

  // 3.3 推进三级审批流直到终审通过
  await request(
    { hostname: HOST, port: PORT, path: `/api/financial/approvals/${prestoreFlowId}/audit`, method: 'POST', headers: authHeaders },
    { action: 'pass', comment: '核对充值意向' },
  );
  await request(
    { hostname: HOST, port: PORT, path: `/api/financial/approvals/${prestoreFlowId}/audit`, method: 'POST', headers: authHeaders },
    { action: 'pass', comment: '校长审批同意充值优惠' },
  );
  const finalPrestoreRes = await request(
    { hostname: HOST, port: PORT, path: `/api/financial/approvals/${prestoreFlowId}/audit`, method: 'POST', headers: authHeaders },
    { action: 'pass', comment: '财务确认微信已入账 888 元' },
  );
  assert(finalPrestoreRes.body.data.status === 'approved', '钱包预存工单终审通过');

  // 3.4 验证 WalletPrestoreStrategy 履约记账：本金增加 888 元且生成台账流水
  const walletAfter = await prisma.studentWallet.findUnique({ where: { studentId: testStudent.id } });
  assert(
    Math.abs(walletAfter.principalBalance - (balanceBefore + 888)) < 0.01,
    `WalletPrestore 策略生效：学员钱包本金精确入账 888 元 (${balanceBefore} -> ${walletAfter.principalBalance})`,
  );

  const ledgerRecord = await prisma.walletLedger.findFirst({
    where: { studentId: testStudent.id, orderNo: walletPrestoreOrder.orderNo },
  });
  assert(!!ledgerRecord, '自动生成对应的电子钱包资金台账流水 (WalletLedger)');
  assert(ledgerRecord.type === 'recharge', '流水类型为 recharge 充值');
  assert(ledgerRecord.amount === 888, '流水金额为 888 元');

  // ============================================================================
  // [测试组 4] 终态防篡改硬阻断屏障
  // ============================================================================
  console.log('\n--- [测试组 4] 终态防篡改硬阻断屏障 ---');

  // 4.1 对已 approved 工单二次审批拦截
  const tamperApproved = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${flow1.id}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    { action: 'pass', comment: '尝试二次通过' },
  );
  assert(tamperApproved.status === 400, '风控屏障生效：对已 approved 工单二次审批严格阻断 (HTTP 400)');
  assert(tamperApproved.body.message.includes('严禁二次篡改操作'), '提示文案明确指出终态防篡改');

  // 4.2 对已 rejected 工单二次审批拦截
  const tamperRejected = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${refundFlowId}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    { action: 'pass', comment: '尝试复活已驳回工单' },
  );
  assert(tamperRejected.status === 400, '风控屏障生效：对已 rejected 工单二次审批严格阻断 (HTTP 400)');

  // ============================================================================
  // [测试组 5] 单请求分块批处理 (Batch Audit)
  // ============================================================================
  console.log('\n--- [测试组 5] 单请求分块批处理 (Batch Audit) ---');

  // 5.1 创建 3 笔待批处理订单与审批流
  const batchFlowIds = [];
  for (let i = 0; i < 3; i++) {
    const enroll = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/students/enroll',
        method: 'POST',
        headers: authHeaders,
      },
      {
        studentId: testStudent.id,
        courseId: testCourse.id,
        totalLessons: 10,
        pricePerLesson: 150,
        paymentMethod: 'wechat',
      },
    );
    const flowRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/financial/approvals',
        method: 'POST',
        headers: authHeaders,
      },
      {
        orderId: enroll.body.data.orderId,
        businessType: 'payment',
        applicantName: `批量测试申请人_${i + 1}`,
      },
    );
    batchFlowIds.push(flowRes.body.data.id);
  }
  assert(batchFlowIds.length === 3, '成功创建 3 笔待批处理测试工单');

  // 5.2 单请求执行批量通过
  const batchPassRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals/batch-audit',
      method: 'POST',
      headers: authHeaders,
    },
    {
      approvalIds: batchFlowIds,
      action: 'pass',
      comment: '批量快速核准通过',
    },
  );
  assert(batchPassRes.status === 200 || batchPassRes.status === 201, 'POST /batch-audit 响应 200/201');
  assert(batchPassRes.body.data.total === 3, '批处理总数为 3');
  assert(batchPassRes.body.data.successCount === 3, '成功批处理推进 3 笔');
  assert(batchPassRes.body.data.failedCount === 0, '失败笔数为 0');
  assert(batchPassRes.body.data.items.length === 3, '回执包含 3 项逐笔明细');

  // 验证每个工单均已原子流转推进至第 2 步
  for (const fid of batchFlowIds) {
    const checkFlow = await prisma.approvalFlow.findUnique({ where: { id: fid } });
    assert(checkFlow.currentStep === 2, `工单 [${fid}] 已推进至第 2 步`);
  }

  // 5.3 混合批次容错验证 (包含 1 笔正常待审工单与 1 笔已终审工单)
  const mixedBatchRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals/batch-audit',
      method: 'POST',
      headers: authHeaders,
    },
    {
      approvalIds: [batchFlowIds[0], flow1.id], // flow1 处于 approved 终态
      action: 'pass',
      comment: '容错批处理测试',
    },
  );
  assert(mixedBatchRes.body.data.total === 2, '混合批处理总数为 2');
  assert(mixedBatchRes.body.data.successCount === 1, '正常待审单据成功推进 (successCount = 1)');
  assert(mixedBatchRes.body.data.failedCount === 1, '已终结单据记录失败 (failedCount = 1)');
  assert(mixedBatchRes.body.data.items[1].error.includes('终态'), '回执准确捕获已终结单据防篡改错误');

  // ============================================================================
  // [测试组 6] 批量驳回与全状态收敛
  // ============================================================================
  console.log('\n--- [测试组 6] 批量驳回与全状态收敛 ---');

  // 6.1 对剩余 2 笔批处理工单执行批量驳回
  const batchRejectRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals/batch-audit',
      method: 'POST',
      headers: authHeaders,
    },
    {
      approvalIds: [batchFlowIds[1], batchFlowIds[2]],
      action: 'reject',
      comment: '合规抽检不合格，批量驳回处理',
    },
  );
  assert(batchRejectRes.body.data.successCount === 2, '批量驳回 2 笔成功');

  const checkReject1 = await prisma.approvalFlow.findUnique({ where: { id: batchFlowIds[1] } });
  const checkReject2 = await prisma.approvalFlow.findUnique({ where: { id: batchFlowIds[2] } });
  assert(checkReject1.status === 'rejected', '工单 1 已置为 rejected');
  assert(checkReject2.status === 'rejected', '工单 2 已置为 rejected');

  console.log('\n================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项财务审批与履约深模块专项测试断言 100% 验证通过！`);
  // 清理临时测试学员及其关联记录
  try {
    await prisma.walletLedger.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.studentWallet.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.approvalNode.deleteMany({ where: { flow: { order: { studentId: testStudent.id } } } });
    await prisma.approvalFlow.deleteMany({ where: { order: { studentId: testStudent.id } } });
    await prisma.order.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.studentAbnormalMovement.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.studentCoursePackage.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.student.delete({ where: { id: testStudent.id } });
  } catch (cleanErr) {
    // 忽略清理异常
  }

  await prisma.$disconnect();
}

runTests().catch((err) => {
  console.error('测试运行异常失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
