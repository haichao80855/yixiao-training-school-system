/**
 * 接口查询范围 (流畅度改进第 2 期)：数据再多也只取需要的那部分。
 * - 点名工作台快照：历史台账按课次分页，返回总数；
 * - 排课接口：不带日期、不指定班级时只取最近 31 天到未来 62 天；指定班级仍返回全部；
 * - 按天计数接口与排课明细一致；
 * - 老师端结课用同一个幂等键重放：返回已有结果，不再扣一次课时。
 *
 * 需要后端：npm run test:server -- --file=query-bounds
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
const day = (offset) => new Date(Date.now() + 8 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);

async function run() {
  console.log('接口查询范围：分页、默认日期窗口、计数、重放');
  const login = await api('', 'POST', '/api/auth/login', { account: ACCOUNTS.principal, password: SEED_PASSWORD });
  const token = login.body.data.accessToken;
  const campusId = login.body.data.user.campusId;
  const tag = `__t_${Date.now().toString(36)}`;
  const course = await prisma.course.findFirst();
  const teacher = await prisma.user.findFirst({ where: { account: ACCOUNTS.teacher } });
  const classroom = await prisma.classroom.create({ data: { campusId, code: `CR-${tag}`, name: `范围教室${tag}` } });
  const cls = await prisma.class.create({
    data: { campusId, courseId: course.id, teacherId: teacher.id, classroomId: classroom.id, name: `范围班${tag}`, code: `CLS-${tag}`, startDate: new Date(), status: 'in_progress' },
  });
  const student = await prisma.student.create({ data: { campusId, name: `范围学员${tag}`, studentNo: tag, gender: 'male', phone: '13800000000' } });
  const pkg = await prisma.studentCoursePackage.create({ data: { studentId: student.id, courseId: course.id, classId: cls.id, totalLessons: 30, remainingLessons: 30, status: 'active' } });
  const mkEvent = (date, status = 'scheduled') =>
    prisma.scheduleEvent.create({ data: { campusId, classId: cls.id, teacherId: teacher.id, classroomId: classroom.id, date, startTime: '18:00', endTime: '19:00', status } });

  const past = [];
  let today = { id: '' };
  try {
    // 3 节已上课 (带上课记录)、1 节 200 天前、1 节今天待上
    for (const offset of [-3, -2, -1]) {
      const ev = await mkEvent(day(offset), 'completed');
      await prisma.attendanceRecord.create({ data: { scheduleEventId: ev.id, studentId: student.id, status: 'present', deductLessons: 1, packageId: pkg.id, operator: 'test' } });
      past.push(ev);
    }
    const old = await mkEvent(day(-200), 'completed');
    today = await mkEvent(day(0));

    // ---------- 工作台快照分页 ----------
    const page1 = await api(token, 'GET', `/api/educational/settlement/workbench?classId=${cls.id}&historyPageSize=2`);
    check(page1.status === 200, '工作台快照可用', page1.body);
    check(page1.body.data.historyTotal === 3 && page1.body.data.history.length === 2, `历史台账按课次分页：共 3 节，第 1 页 2 节`, [page1.body.data.historyTotal, page1.body.data.history.length]);
    check(page1.body.data.history[0].date === day(-1), '历史按上课日期倒序，最近的一节在前');
    const page2 = await api(token, 'GET', `/api/educational/settlement/workbench?classId=${cls.id}&historyPageSize=2&historyPage=2`);
    check(page2.body.data.history.length === 1 && page2.body.data.history[0].date === day(-3), '第 2 页是剩下最早的那一节');
    check(page1.body.data.metrics.totalDeductedLessons === 3, `累计课消按数据库汇总：3 课时 (实际 ${page1.body.data.metrics.totalDeductedLessons})`);

    // ---------- 排课默认窗口 ----------
    const noDate = await api(token, 'GET', '/api/educational/schedules');
    const noDateIds = new Set(noDate.body.data.map((e) => e.id));
    check(noDateIds.has(today.id) && !noDateIds.has(old.id), '不带日期时只返回最近的排课，200 天前的不返回');
    const byClass = await api(token, 'GET', `/api/educational/schedules?classId=${cls.id}`);
    check(byClass.body.data.some((e) => e.id === old.id), '指定班级时仍返回这个班的全部排课');

    // ---------- 按天计数 ----------
    const counts = await api(token, 'GET', `/api/educational/schedules/counts?startDate=${day(-3)}&endDate=${day(0)}`);
    const detail = await api(token, 'GET', `/api/educational/schedules?startDate=${day(-3)}&endDate=${day(0)}`);
    const expected = {};
    for (const e of detail.body.data) expected[e.date] = (expected[e.date] || 0) + 1;
    const got = Object.fromEntries(counts.body.data.map((c) => [c.date, c.total]));
    check(JSON.stringify(got) === JSON.stringify(expected), '按天计数与排课明细一致', { got, expected });
    const bad = await api(token, 'GET', '/api/educational/schedules/counts?startDate=x&endDate=y');
    check(bad.status === 400, '计数接口校验日期格式');

    // ---------- 老师端结课重放 ----------
    const key = `${tag}-settle`;
    const body = { scheduleEventId: today.id, mode: 'FULL_SETTLE', anomalyOverrides: [{ studentId: student.id, status: 'present', deductLessons: 1 }], idempotencyKey: key };
    const first = await api(token, 'POST', '/api/educational/fulfillment/fulfill', body);
    check(first.status === 201 || first.status === 200, '第一次结课成功', first.body);
    const afterFirst = (await prisma.studentCoursePackage.findUnique({ where: { id: pkg.id } })).remainingLessons;
    const replay = await api(token, 'POST', '/api/educational/fulfillment/fulfill', body);
    check(replay.status === 201 || replay.status === 200, '同一个幂等键重放返回成功', replay.body);
    const afterReplay = (await prisma.studentCoursePackage.findUnique({ where: { id: pkg.id } })).remainingLessons;
    check(afterReplay === afterFirst, `重放没有再扣课时 (重放前 ${afterFirst}，重放后 ${afterReplay})`);
    check((await prisma.attendanceRecord.count({ where: { scheduleEventId: today.id } })) === 1, '重放没有新增上课记录');

    console.log(`\n🎉 接口查询范围 ${passed} 项检查通过\n`);
  } finally {
    const evals = await prisma.lessonEvaluation.findMany({ where: { scheduleEvent: { classId: cls.id } }, select: { id: true } });
    const evalIds = evals.map((e) => e.id);
    await prisma.lessonEvaluationOutbox.deleteMany({ where: { evaluationId: { in: evalIds } } }).catch(() => {});
    await prisma.lessonEvaluationRevision.deleteMany({ where: { evaluationId: { in: evalIds } } }).catch(() => {});
    await prisma.lessonEvaluationStudentItem.deleteMany({ where: { evaluationId: { in: evalIds } } }).catch(() => {});
    await prisma.lessonEvaluation.deleteMany({ where: { id: { in: evalIds } } }).catch(() => {});
    // 结课产生的站内通知：去重键里带课次或学员 id
    const refs = [today.id, student.id, ...evalIds, ...past.map((e) => e.id)].filter(Boolean);
    await prisma.staffNotification.deleteMany({ where: { OR: refs.map((id) => ({ dedupeKey: { contains: id } })) } });
    await prisma.student.deleteMany({ where: { id: student.id } });
    await prisma.class.deleteMany({ where: { id: cls.id } });
    await prisma.classroom.deleteMany({ where: { id: classroom.id } });
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('测试失败:', err.message || err);
  process.exit(1);
});
