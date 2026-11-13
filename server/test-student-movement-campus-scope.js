/**
 * 学员异动的校区范围 (回归)：执行校长能给本校区学员办理退费、停课、复课，
 * 但仍然不能给其他校区的学员办理任何异动。
 *
 * 2026-11-13 修复前：执行校长等按校区限定的账号办理任何异动都返回 500
 * (数据权限中间件给没有 campusId 字段的 StudentAbnormalMovement 注入了 campusId)。
 * 以前的异动测试都用集团超管，所以没有发现；这里专门用执行校长。
 *
 * 需要后端：npm run test:server -- --file=movement-campus
 */
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const { BASE_URL } = require('./test-utils/target');
const { ACCOUNTS, SEED_PASSWORD } = require('./test-utils/accounts');

const prisma = new PrismaClient();
let passed = 0;
function check(cond, desc, detail) {
  assert.ok(cond, `❌ ${desc}${detail !== undefined ? `：${JSON.stringify(detail).slice(0, 300)}` : ''}`);
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

async function run() {
  console.log('学员异动的校区范围 (执行校长)');
  const principal = await login('principal');
  const admin = await login('superAdmin');
  const ownCampus = principal.user.campusId;
  const otherCampus = (await prisma.campus.findFirst({ where: { id: { not: ownCampus }, status: 'active' } })).id;
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());
  const studentIds = [];

  const newStudent = async (token, campusId) => {
    const res = await api(token, 'POST', '/api/students', { name: `异动范围${Date.now().toString(36)}`, gender: 'male', phone: '13500000000', campusId });
    studentIds.push(res.body.data.id);
    const enroll = await api(token, 'POST', '/api/students/enroll', { studentId: res.body.data.id, courseId: course.id, totalLessons: 10, pricePerLesson: 200, paymentMethod: 'wechat' });
    return { id: res.body.data.id, packageId: enroll.body.data.packageId };
  };

  try {
    // 本校区：退费
    const a = await newStudent(principal.token, ownCampus);
    const preview = await api(principal.token, 'POST', `/api/student/${a.id}/movement/preview`, { type: 'refund', packageId: a.packageId, reasonCategory: '学业调整' });
    check(preview.status === 200 || preview.status === 201, '执行校长可以预览本校区学员的退费', preview.body);
    const refund = await api(principal.token, 'POST', `/api/student/${a.id}/movement`, { type: 'refund', packageId: a.packageId, reasonCategory: '学业调整', reasonDetail: '范围回归' });
    check(refund.status === 201, '执行校长可以给本校区学员发起退费 (修复前 500)', refund.body);
    check(Boolean(refund.body.data.approvalFlowId), '退费生成了审批单');

    // 本校区：停课 → 复课 (复课会查上一条停课记录)
    const b = await newStudent(principal.token, ownCampus);
    const suspend = await api(principal.token, 'POST', `/api/student/${b.id}/movement`, { type: 'suspend', reasonCategory: '家庭原因', reasonDetail: '范围回归' });
    check(suspend.status === 201, '执行校长可以给本校区学员办理停课', suspend.body);
    const resume = await api(principal.token, 'POST', `/api/student/${b.id}/movement`, { type: 'resume', reasonCategory: '恢复上课', reasonDetail: '范围回归' });
    check(resume.status === 201, '执行校长可以给本校区学员办理复课 (会读取上一条停课记录)', resume.body);
    const movements = await prisma.studentAbnormalMovement.findMany({ where: { studentId: b.id }, orderBy: { createdAt: 'asc' } });
    check(movements.map((m) => m.type).join(',') === 'suspend,resume', '异动记录按顺序落库：停课、复课', movements.map((m) => m.type));

    // 其他校区：仍然不能办理 (查不到学员)，且不能是 500
    const c = await newStudent(admin.token, otherCampus);
    const cross = await api(principal.token, 'POST', `/api/student/${c.id}/movement`, { type: 'suspend', reasonCategory: '家庭原因', reasonDetail: '跨校区' });
    check(cross.status === 404 || cross.status === 403, `执行校长不能给其他校区学员办理异动 (返回 ${cross.status})`, cross.body);
    const crossPreview = await api(principal.token, 'POST', `/api/student/${c.id}/movement/preview`, { type: 'suspend', reasonCategory: '家庭原因' });
    check(crossPreview.status === 404 || crossPreview.status === 403, `执行校长也不能预览其他校区学员的异动 (返回 ${crossPreview.status})`);
    check((await prisma.studentAbnormalMovement.count({ where: { studentId: c.id } })) === 0, '其他校区学员没有产生任何异动记录');

    console.log(`\n🎉 学员异动校区范围 ${passed} 项检查通过\n`);
  } finally {
    // 学员删除时课包、钱包、异动记录级联删除；订单和审批按学员清理
    const orders = await prisma.order.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } });
    const flows = await prisma.approvalFlow.findMany({ where: { orderId: { in: orders.map((o) => o.id) } }, select: { id: true } });
    await prisma.approvalNode.deleteMany({ where: { approvalFlowId: { in: flows.map((f) => f.id) } } });
    await prisma.approvalFlow.deleteMany({ where: { id: { in: flows.map((f) => f.id) } } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('测试失败:', err.message || err);
  process.exit(1);
});
