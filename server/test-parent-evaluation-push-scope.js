/**
 * 课评推送范围：老师只给一位学员推送课评时，同班其他学员的家长看不到这节课的课评。
 *
 * 回归：课评聚合根一节课只有一条，单人推送也会把它置为 published；
 * 家长端原来只看「整节课已发布」，于是同班所有到课学员的家长都出现了这节课的课评和未读角标。
 * 现在以出站信箱为准：推送过这位学员才可见。全班发布后，全班到课学员仍然都能看到。
 *
 * 需要后端：npm run test:server -- --file=parent-evaluation-push-scope
 */
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const { BASE_URL } = require('./test-utils/target');
const { SEED_PASSWORD, ACCOUNTS } = require('./test-utils/accounts');

const prisma = new PrismaClient();
const RUN = Date.now().toString().slice(-6);
const PHONE_A = `1772${RUN}1`.slice(0, 11);
const PHONE_B = `1773${RUN}2`.slice(0, 11);
const created = { students: [], event: null };

let passed = 0;
function ok(cond, desc, detail) {
  assert.ok(cond, `❌ ${desc}${detail !== undefined ? `：${JSON.stringify(detail).slice(0, 300)}` : ''}`);
  passed += 1;
  console.log(`  ✅ ${desc}`);
}

async function api(token, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json && json.data !== undefined ? json.data : json };
}

async function parentLogin(phone) {
  const res = await api('', 'POST', '/api/parent/auth/login', { phone, password: phone.slice(-6) });
  ok([200, 201].includes(res.status), `家长 ${phone.slice(-4)} 登录`, res.data);
  return res.data.accessToken;
}

/** 家长视角：这节课的课评是否可见 (课评流、详情、未读数、课表标记、相册、成长概览) */
async function parentView(token, studentId, eventId, date) {
  const base = `/api/parent/students/${studentId}`;
  const feed = await api(token, 'GET', `${base}/evaluations`);
  const item = (feed.data?.items || []).find((i) => i.scheduleEventId === eventId);
  const detail = await api(token, 'GET', `${base}/evaluations/${eventId}`);
  const schedule = await api(token, 'GET', `${base}/schedule?from=${date}&to=${date}`);
  const lesson = (schedule.data?.lessons || []).find((l) => l.scheduleEventId === eventId);
  const summary = await api(token, 'GET', `${base}/growth/summary`);
  return {
    inFeed: !!item,
    feedHasEvaluation: !!item?.evaluation,
    detailStatus: detail.status,
    unreadCount: feed.data?.unreadCount,
    evaluationReady: lesson?.evaluationReady,
    summaryEvaluations: summary.data?.evaluations,
  };
}

async function run() {
  console.log('课评推送范围：单人推送只让这位学员的家长看到');

  const staff = await api('', 'POST', '/api/auth/login', { account: ACCOUNTS.principal, password: SEED_PASSWORD });
  const staffToken = staff.data?.accessToken || staff.data?.token;
  ok(!!staffToken, '执行校长登录', staff.data);

  const cls = await prisma.class.findFirst({ where: { campusId: 'campus-bj-hq' } });
  if (!cls) throw new Error('缺少总部校区班级，请先执行 npm run prisma:seed');

  const mk = (suffix, name, phone) =>
    prisma.student.create({
      data: { studentNo: `PS${RUN}${suffix}`, name, gender: 'male', campusId: 'campus-bj-hq', status: 'normal', phone, phoneNormalized: phone },
    });
  const a = await mk('A', '推送范围甲', PHONE_A);
  const b = await mk('B', '推送范围乙', PHONE_B);
  created.students.push(a.id, b.id);

  // 已结课课次，两人都到课
  const date = '2026-10-28';
  const event = await prisma.scheduleEvent.create({
    data: {
      campusId: 'campus-bj-hq',
      classId: cls.id,
      teacherId: cls.teacherId,
      classroomId: cls.classroomId,
      date,
      startTime: '09:00',
      endTime: '10:30',
      status: 'completed',
    },
  });
  created.event = event.id;
  for (const s of [a, b]) {
    await prisma.attendanceRecord.create({
      data: { scheduleEventId: event.id, studentId: s.id, status: 'present', deductLessons: 0, operator: 'test' },
    });
  }

  // 与老师手机端「推送给家长」相同的请求：只推送学员甲
  const single = await api(staffToken, 'POST', '/api/educational/fulfillment/fulfill', {
    scheduleEventId: event.id,
    mode: 'PUBLISH_EVALUATION',
    targetStudentId: a.id,
    lessonTitle: '推送范围测试课评',
    teacherComment: '老师已完成本节课的课堂点评',
    studyContentHtml: '本节课学习循环结构',
    photoList: [],
    overallRating: 5,
    anomalyOverrides: [
      { studentId: a.id, status: 'present', deductLessons: 0, personalizedComment: '甲同学专属评语', rating: 5, photos: [], videoUrl: '', isEvaluated: true },
    ],
    source: 'web-teacher',
    idempotencyKey: `push-scope-${RUN}-single`,
  });
  ok([200, 201].includes(single.status), '单人推送成功', single.data);

  const tokenA = await parentLogin(PHONE_A);
  const tokenB = await parentLogin(PHONE_B);

  const viewA = await parentView(tokenA, a.id, event.id, date);
  ok(viewA.feedHasEvaluation && viewA.detailStatus === 200, '被推送学员的家长能看到课评与详情', viewA);
  ok(viewA.unreadCount === 1 && viewA.evaluationReady === true && viewA.summaryEvaluations === 1, '被推送学员：未读 1、课表标记就绪、成长概览计 1 篇', viewA);

  const viewB = await parentView(tokenB, b.id, event.id, date);
  ok(viewB.inFeed && !viewB.feedHasEvaluation, '同班未被推送学员：课评流里只有出勤，没有课评', viewB);
  ok(viewB.detailStatus === 404, '同班未被推送学员：课评详情 404', viewB);
  ok(viewB.unreadCount === 0 && viewB.evaluationReady === false && viewB.summaryEvaluations === 0, '同班未被推送学员：无未读、课表不标记、成长概览不计数', viewB);

  // 全班发布：同班到课学员都能看到
  const classWide = await api(staffToken, 'POST', '/api/educational/fulfillment/fulfill', {
    scheduleEventId: event.id,
    mode: 'PUBLISH_EVALUATION',
    lessonTitle: '推送范围测试课评',
    teacherComment: '全班表现稳定',
    studyContentHtml: '本节课学习循环结构',
    photoList: [],
    overallRating: 5,
    dispatchStrategy: 'ATTENDED_ONLY',
    anomalyOverrides: [],
    idempotencyKey: `push-scope-${RUN}-class`,
  });
  ok([200, 201].includes(classWide.status), '全班发布成功', classWide.data);
  const viewB2 = await parentView(tokenB, b.id, event.id, date);
  ok(viewB2.feedHasEvaluation && viewB2.detailStatus === 200 && viewB2.unreadCount === 1, '全班发布后，同班学员的家长也能看到课评', viewB2);
}

async function cleanup() {
  if (created.event) {
    const evals = await prisma.lessonEvaluation.findMany({ where: { scheduleEventId: created.event }, select: { id: true } });
    const evalIds = evals.map((e) => e.id);
    await prisma.staffNotification.deleteMany({ where: { dedupeKey: { in: evalIds.map((id) => `evaluation_published:${id}`) } } });
    await prisma.lessonEvaluation.deleteMany({ where: { id: { in: evalIds } } }); // 条目、修订、出站信箱级联删除
    await prisma.parentReadState.deleteMany({ where: { scheduleEventId: created.event } });
    await prisma.attendanceRecord.deleteMany({ where: { scheduleEventId: created.event } });
    await prisma.scheduleEvent.deleteMany({ where: { id: created.event } });
  }
  await prisma.parentAccount.deleteMany({ where: { phone: { in: [PHONE_A, PHONE_B] } } });
  await prisma.student.deleteMany({ where: { id: { in: created.students } } });
}

run()
  .then(() => console.log(`\n全部通过 (${passed} 项)`))
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('清理失败:', e.message));
    await prisma.$disconnect();
  });
