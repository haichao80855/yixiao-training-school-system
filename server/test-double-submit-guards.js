/**
 * 防重复提交 (流畅度改进第 1 期)：资金和课时操作连点、重试、两人同时操作时只生效一次。
 *
 * - 充值：同一个幂等键并发两次，只记一笔账，第二次返回 replayed。
 * - 提现：两笔并发提现加起来超过本金时，只成功一笔，本金不会变成负数。
 * - 退费审批：同一级的两个「通过」同时到达，只推进一级；终审只执行一次。
 * - 点名消课：同一节课并发提交两次，只扣一次课时。
 * - 审批列表按校区限定，并返回各标签的数量；班级列表支持状态筛选和全量汇总。
 * - 任何接口都不返回 password 哈希。
 *
 * 需要后端：npm run test:server -- --file=double-submit
 */
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const { BASE_URL } = require('./test-utils/target');
const { ACCOUNTS, SEED_PASSWORD } = require('./test-utils/accounts');

const prisma = new PrismaClient();
let passed = 0;
function check(cond, desc, detail) {
  assert.ok(cond, `❌ ${desc}${detail !== undefined ? `：${JSON.stringify(detail).slice(0, 400)}` : ''}`);
  passed += 1;
  console.log(`  ✓ PASS [${passed}]: ${desc}`);
}

async function api(token, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function login(role) {
  const res = await api('', 'POST', '/api/auth/login', { account: ACCOUNTS[role], password: SEED_PASSWORD });
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

const ok = (r) => r.status === 200 || r.status === 201;
const tag = `防重${Date.now().toString(36)}`;

async function run() {
  console.log('防重复提交：资金与课时操作只生效一次');
  const principal = await login('principal');
  const admin = await login('superAdmin');
  const campusId = principal.user.campusId;
  const studentIds = [];
  const scheduleIds = [];
  const idemKeys = [];

  const newStudent = async () => {
    const res = await api(principal.token, 'POST', '/api/students', { name: `${tag}${studentIds.length}`, gender: 'female', phone: '13600000000', campusId });
    assert.ok(ok(res), `建学员失败 ${JSON.stringify(res.body)}`);
    studentIds.push(res.body.data.id);
    return res.body.data.id;
  };

  try {
    // ---------------- 充值：同一幂等键并发两次 ----------------
    const s1 = await newStudent();
    const rechargeKey = `${tag}-recharge`;
    idemKeys.push(`wallet-recharge:${rechargeKey}`);
    const recharges = await Promise.all([1, 2].map(() => api(principal.token, 'POST', `/api/students/${s1}/wallet/recharge`, { amount: 300, bonus: 20, idempotencyKey: rechargeKey })));
    check(recharges.every(ok), '同一幂等键的两次充值都返回成功 (不让用户看到报错)', recharges.map((r) => r.status));
    check(recharges.filter((r) => r.body.data.replayed).length === 1, '其中一次标记为重放 (replayed)，没有重复执行', recharges.map((r) => r.body.data));
    const ledgers = await prisma.walletLedger.findMany({ where: { studentId: s1, type: 'recharge' } });
    check(ledgers.length === 1, `只记了一笔充值流水 (实际 ${ledgers.length} 笔)`);
    let wallet = await prisma.studentWallet.findUnique({ where: { studentId: s1 } });
    check(wallet.principalBalance === 300 && wallet.bonusBalance === 20, '本金 300、赠送 20，没有翻倍', wallet);

    const replayLater = await api(principal.token, 'POST', `/api/students/${s1}/wallet/recharge`, { amount: 300, bonus: 20, idempotencyKey: rechargeKey });
    check(ok(replayLater) && replayLater.body.data.replayed === true, '事后用同一个键重试，也只返回第一次的结果');

    // ---------------- 提现：两笔并发，总额超过本金 ----------------
    const withdrawKeys = [`${tag}-w1`, `${tag}-w2`];
    idemKeys.push(...withdrawKeys.map((k) => `wallet-withdraw:${k}`));
    const withdraws = await Promise.all(withdrawKeys.map((k) => api(principal.token, 'POST', `/api/students/${s1}/wallet/withdraw`, { amount: 200, idempotencyKey: k })));
    check(withdraws.filter(ok).length === 1, `两笔各 200 的提现 (本金 300) 只成功一笔`, withdraws.map((r) => [r.status, r.body?.message]));
    check(withdraws.some((r) => r.status === 400), '另一笔返回 400 (余额不足)');
    wallet = await prisma.studentWallet.findUnique({ where: { studentId: s1 } });
    check(wallet.principalBalance === 100, `本金剩 100，没有变成负数 (实际 ${wallet.principalBalance})`);

    // ---------------- 点名消课：同一节课并发两次 ----------------
    const cls = await prisma.class.findFirst({ where: { campusId, status: { not: 'completed' } } });
    const s2 = await newStudent();
    const enroll = await api(principal.token, 'POST', '/api/students/enroll', { studentId: s2, courseId: cls.courseId, totalLessons: 10, pricePerLesson: 200, paymentMethod: 'wechat' });
    check(ok(enroll), '报名生成课包', enroll.body);
    const packageId = enroll.body.data.packageId;
    await prisma.studentCoursePackage.update({ where: { id: packageId }, data: { classId: cls.id } });
    const before = await prisma.studentCoursePackage.findUnique({ where: { id: packageId } });
    const schedule = await prisma.scheduleEvent.create({
      data: { campusId, classId: cls.id, teacherId: cls.teacherId, classroomId: cls.classroomId, date: '2020-03-02', startTime: '09:00', endTime: '10:30' },
    });
    scheduleIds.push(schedule.id);
    const rollCallBody = { scheduleEventId: schedule.id, items: [{ studentId: s2, packageId, status: 'present', deductLessons: 1 }] };
    const rollCalls = await Promise.all([1, 2].map(() => api(principal.token, 'POST', '/api/educational/attendances/roll-call', rollCallBody)));
    check(rollCalls.filter(ok).length === 1, '同一节课并发点名两次，只成功一次', rollCalls.map((r) => [r.status, r.body?.message]));
    const after = await prisma.studentCoursePackage.findUnique({ where: { id: packageId } });
    check(before.remainingLessons - after.remainingLessons === 1, `只扣了 1 课时 (实际扣 ${before.remainingLessons - after.remainingLessons})`);
    check((await prisma.attendanceRecord.count({ where: { scheduleEventId: schedule.id } })) === 1, '只生成一条上课记录');

    // ---------------- 退费审批：每一级并发两个「通过」 ----------------
    const refund = await api(principal.token, 'POST', `/api/student/${s2}/movement`, { type: 'refund', packageId, reasonCategory: '学业调整', reasonDetail: '防重复回归' });
    check(refund.status === 201 && refund.body.data.approvalFlowId, '发起退费，生成审批单', refund.body);
    const flowId = refund.body.data.approvalFlowId;
    const startFlow = await prisma.approvalFlow.findUnique({ where: { id: flowId } });
    for (let step = startFlow.currentStep; step <= startFlow.totalSteps; step += 1) {
      const audits = await Promise.all([1, 2].map(() => api(admin.token, 'POST', `/api/financial/approvals/${flowId}/audit`, { action: 'pass', comment: `第 ${step} 级` })));
      check(audits.filter(ok).length === 1, `第 ${step} 级同时到达两个「通过」，只生效一个`, audits.map((r) => [r.status, r.body?.message]));
      check(audits.some((r) => r.status === 409), `另一个返回 409，提示已被处理`);
    }
    const flow = await prisma.approvalFlow.findUnique({ where: { id: flowId }, include: { nodes: true } });
    check(flow.status === 'approved', '审批单最终为已通过', flow.status);
    check(flow.nodes.length === startFlow.totalSteps - startFlow.currentStep + 1, `审批记录每级一条 (共 ${flow.nodes.length} 条)，没有重复`);
    const pkgAfterRefund = await prisma.studentCoursePackage.findUnique({ where: { id: packageId } });
    check(pkgAfterRefund.status === 'refunded', '终审只执行了一次退费结算，课包为已退费', pkgAfterRefund.status);

    // ---------------- 列表：审批按校区、班级按状态 ----------------
    const approvals = await api(principal.token, 'GET', '/api/financial/approvals?pageSize=100');
    check(ok(approvals), '执行校长可以查看审批列表');
    const orderIds = approvals.body.data.list.map((a) => a.orderId).filter(Boolean);
    const foreign = await prisma.order.count({ where: { id: { in: orderIds }, campusId: { not: campusId } } });
    check(foreign === 0, `审批列表只有本校区的单据 (其他校区 ${foreign} 张)`);
    check(approvals.body.data.businessCounts && approvals.body.data.statusCounts, '审批列表返回各业务类型和状态的数量', Object.keys(approvals.body.data));

    const recruiting = await api(principal.token, 'GET', '/api/educational/classes?status=recruiting&pageSize=100');
    check(recruiting.body.data.list.every((c) => c.status === 'recruiting'), '班级列表按状态筛选生效');
    check(recruiting.body.data.summary && typeof recruiting.body.data.summary.totalStudents === 'number', '班级列表返回全部符合条件班级的汇总', recruiting.body.data.summary);

    // ---------------- 出参不含密码哈希 ----------------
    const detail = await api(principal.token, 'GET', `/api/educational/classes/${cls.id}`);
    check(ok(detail) && !JSON.stringify(detail.body).includes('"password"'), '班级详情 (带老师、班主任信息) 不返回 password 字段');
    const attendances = await api(principal.token, 'GET', `/api/educational/attendances?scheduleEventId=${schedule.id}`);
    check(!JSON.stringify(attendances.body).includes('"password"'), '上课记录不返回 password 字段');

    console.log(`\n🎉 防重复提交 ${passed} 项检查通过\n`);
  } finally {
    const orders = await prisma.order.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } });
    const flows = await prisma.approvalFlow.findMany({ where: { orderId: { in: orders.map((o) => o.id) } }, select: { id: true } });
    await prisma.approvalNode.deleteMany({ where: { approvalFlowId: { in: flows.map((f) => f.id) } } });
    await prisma.approvalFlow.deleteMany({ where: { id: { in: flows.map((f) => f.id) } } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.scheduleEvent.deleteMany({ where: { id: { in: scheduleIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: { in: idemKeys } } });
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('测试失败:', err.message || err);
  process.exit(1);
});
