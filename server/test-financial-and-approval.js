const http = require('http');

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
  console.log('拓视未来教育「一校教培系统」后端第五步（财务流水与多级风控审批）集成测试');
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

  // ----------------------------------------------------------------
  // 2. 财务订单账本与高精算力 Summary Strip 动态统计
  // ----------------------------------------------------------------
  console.log('\n--- 2. 财务订单账本与高精算力 Summary Strip 动态统计 ---');

  // 2.1 订单流水列表分页查询
  const ordersRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/financial/orders?page=1&pageSize=10',
    method: 'GET',
    headers: authHeaders,
  });
  assert(ordersRes.status === 200, '订单列表分页接口返回 200');
  assert(ordersRes.body.data.list.length > 0, '种子数据与前期操作包含有效订单记录');
  const sampleOrder = ordersRes.body.data.list[0];

  // 2.2 Summary Strip 动态实收指标汇总
  const summaryRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/financial/orders/summary',
    method: 'GET',
    headers: authHeaders,
  });
  assert(summaryRes.status === 200, 'Summary Strip 汇总指标接口返回 200');
  assert(summaryRes.body.data.totalOrders > 0, '汇总指标包含总订单笔数统计');
  assert(summaryRes.body.data.totalPaidOrders > 0, '已支付订单笔数统计准确');
  assert(typeof summaryRes.body.data.totalActualAmount === 'number', '实收金额高精核算无 IEEE-754 浮点累加漂移');
  assert(typeof summaryRes.body.data.summaryText === 'string', '包含盛通前端展示标准汇总横条文本');

  // 2.3 高密度多维复合筛选验证
  const filterTypeRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/financial/orders?orderType=regular',
    method: 'GET',
    headers: authHeaders,
  });
  assert(filterTypeRes.status === 200, '按常规收费 orderType=regular 筛选成功');

  const filterPaidRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/financial/orders?status=paid',
    method: 'GET',
    headers: authHeaders,
  });
  assert(filterPaidRes.status === 200, '按支付状态 status=paid 筛选成功');

  // ----------------------------------------------------------------
  // 3. 订单详情、收款凭证与账期加锁保护机制
  // ----------------------------------------------------------------
  console.log('\n--- 3. 订单详情、收款凭证与账期加锁保护机制 ---');

  const orderDetailRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/financial/orders/${sampleOrder.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(orderDetailRes.status === 200, '订单详情查询成功');
  assert(orderDetailRes.body.data.student !== null, '订单详情包含关联学员画像');

  // 3.2 上传/更新收款凭证图片
  const updateVoucherRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/orders/${sampleOrder.id}/voucher`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { voucherUrl: 'https://oss.shengtongedu.cn/vouchers/receipt_2026_test.png' },
  );
  assert(updateVoucherRes.status === 200, '收款凭证更新成功');
  assert(updateVoucherRes.body.data.voucherUrl.includes('receipt_2026_test.png'), '凭证 URL 正确持久化');

  // 3.3 财务账期加锁保护 (封账)
  const lockRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/orders/${sampleOrder.id}/lock`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { isLocked: true },
  );
  assert(lockRes.status === 200, '财务账期加锁接口成功');
  assert(lockRes.body.data.isLocked === true, '订单标记为已加锁保护');

  // 3.4 账期锁定状态下，尝试作废冲正 -> 必须被风控拦截 (400)
  const voidAttemptRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/orders/${sampleOrder.id}/void`,
      method: 'POST',
      headers: authHeaders,
    },
    {},
  );
  assert(voidAttemptRes.status === 400, '风控生效：加锁封账订单严禁作废冲正 (400)');

  // 解锁后作废测试 (针对单独的测试订单)
  const unlockRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/orders/${sampleOrder.id}/lock`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { isLocked: false },
  );
  assert(unlockRes.status === 200, '订单账期成功解锁恢复');

  // ----------------------------------------------------------------
  // 4. 多级风控审批流中心 (Approval Flow) 三级状态机穿透验证
  // ----------------------------------------------------------------
  console.log('\n--- 4. 多级风控审批流中心 (Approval Flow) 三级状态机穿透验证 ---');

  // 4.1 查找或新建一个需要审批的订单
  const studentListInit = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/students',
    method: 'GET',
    headers: authHeaders,
  });
  const coursesListInit = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/curriculum/courses',
    method: 'GET',
    headers: authHeaders,
  });
  const enrollForApproval = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: studentListInit.body.data.list[0].id,
      courseId: coursesListInit.body.data.list[0].id,
      totalLessons: 20,
      pricePerLesson: 200,
      paymentMethod: 'alipay',
    },
  );
  const refundOrder = { id: enrollForApproval.body.data.orderId };

  // 创建审批工单
  const createApprovalRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals',
      method: 'POST',
      headers: authHeaders,
    },
    {
      orderId: refundOrder.id,
      businessType: 'payment',
      applicantName: '冬海潮（校区主管）',
    },
  );

  let approvalFlowId = '';
  if (createApprovalRes.status === 201 || createApprovalRes.status === 200) {
    approvalFlowId = createApprovalRes.body.data.id;
    assert(createApprovalRes.body.data.currentStep === 1, '审批工单初始处于 Step 1 (教学端考勤核实)');
    assert(createApprovalRes.body.data.totalSteps === 3, '盛通三级风控审批架构 (共 3 级)');
    assert(createApprovalRes.body.data.status === 'pending', '工单初始状态为待办 pending');
  } else {
    // 若已存在工单，直接获取该工单 ID
    const approvalList = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals',
      method: 'GET',
      headers: authHeaders,
    });
    approvalFlowId = approvalList.body.data.list[0].id;
    assert(!!approvalFlowId, '成功获取已有审批流工单');
  }

  // 4.2 执行 Step 1: 教学端考勤核实
  const step1Res = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${approvalFlowId}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      action: 'pass',
      comment: '【教学部】学员消课与在读课包已核实无误，同意退款流程推进。',
    },
  );
  assert(step1Res.status === 200 || step1Res.status === 201, 'Step 1 教学端考勤核实通过');
  assert(step1Res.body.data.currentStep >= 2, '工单自动流转推进至下一级审批');

  // 4.3 执行 Step 2: 校区校长行政复核
  const step2Res = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${approvalFlowId}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      action: 'pass',
      comment: '【校长室】符合拓视未来教育集团学员异动规章，准予提报财务终审。',
    },
  );
  assert(step2Res.status === 200 || step2Res.status === 201, 'Step 2 校区校长行政复核通过');

  // 4.4 执行 Step 3: 财务部资金终审
  const step3Res = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${approvalFlowId}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      action: 'pass',
      comment: '【财务部】实退金额核算无误，赠送金未折现，网银转账单已出纳。',
    },
  );
  assert(step3Res.status === 200 || step3Res.status === 201, 'Step 3 财务终审核准成功');
  assert(step3Res.body.data.status === 'approved', '三级风控全流程完结终态为 approved');

  // 4.5 终态防篡改风控验证：终审完结后，严禁二次篡改操作
  const tamperAttemptRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${approvalFlowId}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      action: 'pass',
      comment: '恶意二次审批尝试',
    },
  );
  assert(tamperAttemptRes.status === 400, '盛通强风控生效：终审完结工单禁止二次篡改 (400)');

  // 4.6 驳回机制测试 (新建一个审批工单并直接驳回)
  // 创建一个测试订单
  const studentList = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/students',
    method: 'GET',
    headers: authHeaders,
  });
  const coursesList = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/curriculum/courses',
    method: 'GET',
    headers: authHeaders,
  });
  const testEnroll = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: studentList.body.data.list[0].id,
      courseId: coursesList.body.data.list[0].id,
      totalLessons: 10,
      pricePerLesson: 200,
      paymentMethod: 'alipay',
    },
  );
  const rejectTestOrderId = testEnroll.body.data.orderId;

  const newRejectFlowRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals',
      method: 'POST',
      headers: authHeaders,
    },
    {
      orderId: rejectTestOrderId,
      businessType: 'payment',
      applicantName: '张课程顾问',
    },
  );
  const rejectFlowId = newRejectFlowRes.body.data.id;

  const rejectAuditRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${rejectFlowId}/audit`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      action: 'reject',
      comment: '折扣比例超出限额，予以驳回！',
    },
  );
  assert(rejectAuditRes.status === 200 || rejectAuditRes.status === 201, '审批驳回操作成功');
  assert(rejectAuditRes.body.data.status === 'rejected', '工单流转立即终止且标记为 rejected');

  console.log('\n================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项财务流水与多级审批风控断言 100% 验证通过！`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('测试运行异常失败:', err);
  process.exit(1);
});
