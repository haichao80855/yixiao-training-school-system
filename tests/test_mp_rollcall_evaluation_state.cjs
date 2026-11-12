/**
 * 课次详情 (小程序点名页) 的课评状态契约：GET /api/educational/fulfillment/workbench/:id
 *
 * 小程序课次详情按每个学员的 isEvaluated / hasPersonalEvaluation / isExempt 决定显示「写课评」还是「看学情」。
 * 本测试自建班级、学员、课包和排课 (不依赖任何已有数据)，结课后核对接口返回的每个学员状态：
 *   - 写了专属评语和照片的学员：已评价，且有专属课评
 *   - 同班只到课、没写专属内容的学员：没有专属课评 (回归：曾经一人推送后全班都显示为已推送)
 *   - 请假学员：免评
 * 测完按 ID 清理全部夹具。
 */
const assert = require('assert');
const http = require('http');
const { BASE_URL } = require('../server/test-utils/target');
const { SEED_PASSWORD, ACCOUNTS } = require('../server/test-utils/accounts');
const { PrismaClient } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();
let passed = 0;

function check(cond, desc) {
  assert.ok(cond, `❌ ${desc}`);
  passed += 1;
  console.log(`  ✓ PASS [${passed}]: ${desc}`);
}

function call(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE_URL + urlPath);
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { raw };
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('='.repeat(80));
  console.log('课次详情课评状态契约 (fulfillment workbench，自建夹具)');
  console.log('='.repeat(80));

  const login = await call('POST', '/api/auth/login', { account: ACCOUNTS.superAdmin, password: SEED_PASSWORD });
  const token = login.body?.data?.accessToken;
  check(Boolean(token), '超管登录成功');

  const campus = (await prisma.campus.findFirst({ where: { status: 'active' } })) || (await prisma.campus.findFirst());
  const teacher = (await prisma.user.findFirst({ where: { campusId: campus.id } })) || (await prisma.user.findFirst());
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());
  check(Boolean(campus && teacher && course), '测试库里有校区、老师和课程');

  const tag = `__t_${Date.now().toString(36)}`;
  const created = { classrooms: [], classes: [], students: [], packages: [], schedules: [] };

  try {
    const classroom = await prisma.classroom.create({ data: { campusId: campus.id, code: `CR-${tag}`, name: `课评状态教室${tag}` } });
    created.classrooms.push(classroom.id);
    const cls = await prisma.class.create({
      data: {
        campusId: campus.id,
        courseId: course.id,
        teacherId: teacher.id,
        classroomId: classroom.id,
        name: `课评状态测试班${tag}`,
        code: `CLS-${tag}`,
        capacity: 10,
        status: 'in_progress',
        startDate: new Date(Date.now() - 86400000 * 30),
        endDate: new Date(Date.now() + 86400000 * 180),
      },
    });
    created.classes.push(cls.id);

    const mkStudent = async (suffix) => {
      const s = await prisma.student.create({
        data: { campusId: campus.id, name: `课评状态${suffix}${tag}`, studentNo: `${tag}${suffix}`, gender: 'male', phone: '13800000000' },
      });
      created.students.push(s.id);
      const p = await prisma.studentCoursePackage.create({
        data: { studentId: s.id, courseId: course.id, classId: cls.id, totalLessons: 20, remainingLessons: 20, consumedLessons: 0, status: 'active' },
      });
      created.packages.push(p.id);
      return s;
    };
    const written = await mkStudent('A'); // 写了专属评语和照片
    const plain = await mkStudent('B'); // 只到课
    const onLeave = await mkStudent('C'); // 请假

    const schedule = await prisma.scheduleEvent.create({
      data: {
        campusId: campus.id,
        classId: cls.id,
        teacherId: teacher.id,
        classroomId: classroom.id,
        date: '2026-10-18',
        startTime: '10:00',
        endTime: '11:30',
        status: 'scheduled',
      },
    });
    created.schedules.push(schedule.id);

    const before = await call('GET', `/api/educational/fulfillment/workbench/${schedule.id}`, null, token);
    check(before.status === 200, '结课前工作台接口返回 200');
    const beforeStudents = before.body?.data?.students || [];
    check(beforeStudents.length === 3, `结课前返回班级 3 名学员 (实际 ${beforeStudents.length})`);
    check(beforeStudents.every((s) => s.isEvaluated === false && s.hasPersonalEvaluation === false), '结课前所有学员都显示「写课评」(未评价)');

    const fulfill = await call(
      'POST',
      '/api/educational/fulfillment/fulfill',
      {
        scheduleEventId: schedule.id,
        mode: 'FULL_SETTLE',
        lessonTitle: '第1讲 课评状态契约',
        studyContentHtml: '全班内容',
        overallRating: 5,
        teacherComment: '全班整体评语',
        anomalyOverrides: [
          {
            studentId: written.id,
            status: 'present',
            deductLessons: 1,
            rating: 5,
            personalizedComment: '学员 A 专属评语',
            photos: [`/uploads/${tag}/a.jpg`],
          },
          { studentId: onLeave.id, status: 'leave', deductLessons: 0 },
        ],
      },
      token,
    );
    check(fulfill.status === 201, `结课返回 201 (实际 ${fulfill.status})`);

    const after = await call('GET', `/api/educational/fulfillment/workbench/${schedule.id}`, null, token);
    check(after.status === 200, '结课后工作台接口返回 200');
    const byId = new Map((after.body?.data?.students || []).map((s) => [s.studentId, s]));
    const a = byId.get(written.id);
    const b = byId.get(plain.id);
    const c = byId.get(onLeave.id);
    check(a && b && c, '结课后三名学员都在返回结果里');

    check(a.recordedStatus === 'present' && b.recordedStatus === 'present' && c.recordedStatus === 'leave', '点名结果落库：A、B 到课，C 请假');
    check(a.isEvaluated === true && a.hasPersonalEvaluation === true, '学员 A 写了专属课评：已评价，显示「看学情」');
    check(a.currentComment === '学员 A 专属评语' && a.photos.length === 1, '学员 A 带出自己的评语和照片');
    check(b.hasPersonalEvaluation === false, '学员 B 没写专属内容：不算已推送专属课评 (不被 A 带成已推送)');
    check(!b.photos.length && b.currentComment !== '学员 A 专属评语', '学员 B 不会串到 A 的评语和照片');
    check(c.isExempt === true, '请假学员 C 为免评');
  } finally {
    // 结课发布课评时会给校区负责人发一条站内通知 (按课评 ID 去重)，先删掉
    const evaluations = await prisma.lessonEvaluation.findMany({ where: { scheduleEventId: { in: created.schedules } }, select: { id: true } });
    await prisma.staffNotification.deleteMany({
      where: { dedupeKey: { in: evaluations.map((e) => `evaluation_published:${e.id}`) } },
    });
    // 课评、课评学员条目、修订和推送队列都随排课级联删除
    await prisma.attendanceRecord.deleteMany({ where: { scheduleEventId: { in: created.schedules } } });
    await prisma.scheduleEvent.deleteMany({ where: { id: { in: created.schedules } } });
    await prisma.studentCoursePackage.deleteMany({ where: { id: { in: created.packages } } });
    await prisma.student.deleteMany({ where: { id: { in: created.students } } });
    await prisma.class.deleteMany({ where: { id: { in: created.classes } } });
    await prisma.classroom.deleteMany({ where: { id: { in: created.classrooms } } });
    await prisma.$disconnect();
    console.log('  · 测试夹具已按 ID 清理');
  }

  console.log(`\n🎉 课次详情课评状态契约 ${passed} 项全部通过\n`);
}

run().catch(async (err) => {
  console.error('测试失败:', err.message || err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
