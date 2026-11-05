/**
 * 网页教师端接口测试：数据范围只限本人、响应不含财务字段、结课与单学员课评语义、修改本人密码
 * 运行命令: node server/test-teacher-portal.js (可用 PORT 指定被测服务端口，默认 3001)
 */
const assert = require('assert');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = `http://127.0.0.1:${process.env.PORT || 3001}`;
const prisma = new PrismaClient();
const SUFFIX = Date.now().toString(36);
const PASSWORD = 'Teacher123';
const FINANCE_FIELD = /pricePerLesson|remainingAmount|walletBalance|principalBalance|bonusBalance|orderNo|"amount"|wallet|orders/i;

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`  ✓ [${passed}] ${message}`);
}

async function call(method, url, token, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data !== undefined ? json.data : json, raw: json };
}

async function login(account, password = PASSWORD) {
  const res = await call('POST', '/api/auth/login', null, { account, password });
  assert.ok(res.data?.accessToken, `账号 ${account} 应能登录`);
  return res.data.accessToken;
}

function localDate(offsetDays = 0) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

const created = { users: [], students: [], classes: [], classroom: null, course: null };

async function createTeacher(role, campusId, label) {
  const user = await prisma.user.create({
    data: {
      account: `tp_${label}_${SUFFIX}`,
      password: await bcrypt.hash(PASSWORD, 10),
      realName: `教师端测试${label}`,
      phone: `139${String(Date.now()).slice(-7)}${label === 'a' ? '1' : '2'}`.slice(0, 11),
      campusId,
      status: 'active',
      userRoles: { create: { roleId: role.id } },
    },
  });
  created.users.push(user.id);
  return user;
}

async function createStudentWithPackage(campusId, course, cls, name, remainingLessons) {
  const student = await prisma.student.create({
    data: {
      campusId,
      studentNo: `TP${SUFFIX}${created.students.length}`,
      name,
      gender: 'male',
      phone: '13800000000',
      parentName: `${name}家长`,
    },
  });
  created.students.push(student.id);
  const pkg = await prisma.studentCoursePackage.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      classId: cls.id,
      totalLessons: 20,
      remainingLessons,
      pricePerLesson: 321,
      orderNo: `ORDER-${SUFFIX}-${created.students.length}`,
      status: 'active',
    },
  });
  return { student, pkg };
}

async function createLesson(cls, teacherId, classroomId, date, startTime = '09:00') {
  return prisma.scheduleEvent.create({
    data: {
      campusId: cls.campusId,
      classId: cls.id,
      teacherId,
      classroomId,
      date,
      startTime,
      endTime: '10:30',
    },
  });
}

async function run() {
  const teacherRole = await prisma.role.findUnique({ where: { code: 'teacher' } });
  assert.ok(teacherRole, '数据库需要已存在 teacher 角色 (先运行 prisma:seed)');
  const campus = await prisma.campus.findFirst({ orderBy: { createdAt: 'asc' } });
  const classroom = await prisma.classroom.create({
    data: { campusId: campus.id, code: `TP-${SUFFIX}`, name: `教师端测试教室${SUFFIX}`, capacity: 20 },
  });
  created.classroom = classroom.id;
  const course = await prisma.course.findFirst();
  assert.ok(course, '数据库需要已存在课程 (先运行 prisma:seed)');

  const teacherA = await createTeacher(teacherRole, campus.id, 'a');
  const teacherB = await createTeacher(teacherRole, campus.id, 'b');

  const makeClass = (teacherId, label) =>
    prisma.class.create({
      data: {
        campusId: campus.id,
        courseId: course.id,
        code: `TP-${label}-${SUFFIX}`,
        name: `教师端测试班${label}-${SUFFIX}`,
        teacherId,
        classroomId: classroom.id,
        startDate: new Date(),
        status: 'in_progress',
      },
    });
  const classA = await makeClass(teacherA.id, 'A');
  const classB = await makeClass(teacherB.id, 'B');
  created.classes.push(classA.id, classB.id);

  const low = await createStudentWithPackage(campus.id, course, classA, '课时少', 3);
  const normal = await createStudentWithPackage(campus.id, course, classA, '课时够', 15);
  const absent = await createStudentWithPackage(campus.id, course, classA, '常缺勤', 12);
  const other = await createStudentWithPackage(campus.id, course, classB, '别班学员', 10);

  const today = localDate();
  const lessonToday = await createLesson(classA, teacherA.id, classroom.id, today);
  await createLesson(classA, teacherA.id, classroom.id, localDate(-2));
  const lessonOtherTeacher = await createLesson(classB, teacherB.id, classroom.id, today);

  const tokenA = await login(teacherA.account);
  const tokenB = await login(teacherB.account);

  console.log('\n--- 权限与数据范围 ---');
  assert.strictEqual((await call('GET', '/api/teacher-portal/overview')).status, 401);
  ok('未登录不能访问教师端接口');

  const adminOnly = await call('GET', '/api/students', tokenA);
  assert.strictEqual(adminOnly.status, 403);
  ok('教师角色未被放开校区级学员接口 (含财务字段)');

  const classes = await call('GET', '/api/teacher-portal/classes', tokenA);
  assert.strictEqual(classes.status, 200);
  assert.deepStrictEqual(classes.data.map((c) => c.id), [classA.id]);
  ok('班级列表只有本人班级');

  assert.strictEqual((await call('GET', `/api/teacher-portal/classes/${classB.id}`, tokenA)).status, 404);
  ok('不能查看他人班级详情');

  const students = await call('GET', '/api/teacher-portal/students', tokenA);
  assert.strictEqual(students.data.total, 3);
  assert.ok(!students.data.list.some((s) => s.id === other.student.id));
  ok('学员列表只有本人班级学员');

  assert.strictEqual((await call('GET', `/api/teacher-portal/students/${other.student.id}`, tokenA)).status, 404);
  ok('不能查看他人班级学员详情');

  const searched = await call('GET', `/api/teacher-portal/students?keyword=${encodeURIComponent('课时少')}`, tokenA);
  assert.deepStrictEqual(searched.data.list.map((s) => s.id), [low.student.id]);
  ok('学员搜索生效');

  const fakeTeacherParam = await call('GET', `/api/teacher-portal/classes?teacherId=${teacherB.id}`, tokenA);
  assert.deepStrictEqual(fakeTeacherParam.data.map((c) => c.id), [classA.id]);
  ok('传 teacherId 参数不能越权');

  console.log('\n--- 响应不含财务 / 销售字段 ---');
  const payloads = [
    students,
    classes,
    await call('GET', `/api/teacher-portal/classes/${classA.id}`, tokenA),
    await call('GET', `/api/teacher-portal/students/${low.student.id}`, tokenA),
    await call('GET', '/api/teacher-portal/warnings', tokenA),
    await call('GET', '/api/teacher-portal/overview', tokenA),
    await call('GET', '/api/teacher-portal/evaluations', tokenA),
  ];
  for (const res of payloads) {
    assert.strictEqual(res.status, 200);
    assert.ok(!FINANCE_FIELD.test(JSON.stringify(res.data)), `响应含财务字段: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  ok('7 个教师端查询接口都不含财务字段');

  console.log('\n--- 待办统计 ---');
  const overview = await call('GET', '/api/teacher-portal/overview', tokenA);
  assert.strictEqual(overview.data.todayLessonCount, 1);
  assert.strictEqual(overview.data.todayPendingCount, 1);
  assert.strictEqual(overview.data.overdueLessonCount, 1);
  ok('今日待上与逾期未结课统计正确');

  console.log('\n--- 结课消课：只扣课时，不产生课评 ---');
  const settle = await call('POST', '/api/educational/fulfillment/fulfill', tokenA, {
    scheduleEventId: lessonToday.id,
    mode: 'ATTENDANCE_ONLY',
    anomalyOverrides: [
      { studentId: low.student.id, status: 'present', deductLessons: 1 },
      { studentId: normal.student.id, status: 'leave', deductLessons: 0 },
      { studentId: absent.student.id, status: 'absent', deductLessons: 0 },
    ],
  });
  assert.ok([200, 201].includes(settle.status), JSON.stringify(settle.raw));
  assert.strictEqual(settle.data.settlement.totalDeductedLessons, 1);
  assert.strictEqual(await prisma.lessonEvaluation.count({ where: { scheduleEventId: lessonToday.id } }), 0);
  const attendance = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: lessonToday.id, studentId: low.student.id },
  });
  assert.strictEqual(attendance.comment, null, '不应写入教研模板评语');
  assert.strictEqual((await prisma.studentCoursePackage.findUnique({ where: { id: low.pkg.id } })).remainingLessons, 2);
  ok('仅到课学员扣课，未生成课评，考勤未写入模板评语');

  const pending = await call('GET', `/api/teacher-portal/evaluations?startDate=${today}&endDate=${today}&status=pending`, tokenA);
  assert.deepStrictEqual(pending.data.items.map((i) => i.studentId), [low.student.id]);
  ok('待写课评只含到课学员，请假 / 缺勤不计入');

  console.log('\n--- 单学员推送：不串到同班其他学员 ---');
  const publish = await call('POST', '/api/educational/fulfillment/fulfill', tokenA, {
    scheduleEventId: lessonToday.id,
    mode: 'PUBLISH_EVALUATION',
    targetStudentId: low.student.id,
    lessonTitle: '教师端测试课评',
    teacherComment: '老师已完成本节课的课堂点评',
    studyContentHtml: '本节课学习循环结构',
    photoList: [],
    overallRating: 4,
    anomalyOverrides: [
      { studentId: low.student.id, status: 'present', deductLessons: 1, personalizedComment: '进步很大', rating: 4, photos: [], videoUrl: '', isEvaluated: true },
    ],
  });
  assert.ok([200, 201].includes(publish.status), JSON.stringify(publish.raw));

  const workbench = await call('GET', `/api/educational/fulfillment/workbench/${lessonToday.id}`, tokenA);
  const row = (id) => workbench.data.students.find((s) => s.studentId === id);
  assert.strictEqual(row(low.student.id).currentComment, '进步很大');
  assert.strictEqual(row(low.student.id).recordedStatus, 'present');
  assert.strictEqual(row(normal.student.id).recordedStatus, 'leave', '推送不能改动其他学员考勤');
  assert.strictEqual(row(normal.student.id).hasPersonalEvaluation, false);
  assert.strictEqual(workbench.data.evaluationDraft.studyContentHtml, '本节课学习循环结构');
  assert.strictEqual((await prisma.studentCoursePackage.findUnique({ where: { id: low.pkg.id } })).remainingLessons, 2);
  ok('推送后评语归属正确，未重复扣课，同班学员不受影响');

  const pushed = await call('GET', `/api/teacher-portal/evaluations?startDate=${today}&endDate=${today}`, tokenA);
  assert.strictEqual(pushed.data.metrics.pushedCount, 1);
  assert.strictEqual(pushed.data.metrics.pendingCount, 0);
  ok('课评管理统计同步');

  console.log('\n--- 已结课后修改考勤：按差额调整课时 ---');
  await call('POST', '/api/educational/lesson-evaluations/commit', tokenA, {
    scheduleEventId: lessonToday.id,
    publish: false,
    payload: { studentOverrides: [{ studentId: normal.student.id, attendanceStatus: 'present', deductLessons: 1 }] },
  });
  assert.strictEqual((await prisma.studentCoursePackage.findUnique({ where: { id: normal.pkg.id } })).remainingLessons, 14);
  const afterEdit = await prisma.lessonEvaluation.findUnique({ where: { scheduleEventId: lessonToday.id } });
  assert.strictEqual(afterEdit.status, 'published');
  assert.strictEqual(afterEdit.studyContent, '本节课学习循环结构');
  ok('请假改到课后扣 1 课时，已发布课评内容不变');

  console.log('\n--- 学员预警 ---');
  for (const offset of [-5, -3]) {
    const lesson = await createLesson(classA, teacherA.id, classroom.id, localDate(offset), '14:00');
    await prisma.attendanceRecord.create({
      data: { scheduleEventId: lesson.id, studentId: absent.student.id, status: 'absent', deductLessons: 0, operator: 'test' },
    });
  }
  // 今天那节也是缺勤，共连续 3 次
  const warnings = await call('GET', '/api/teacher-portal/warnings', tokenA);
  const lowWarning = warnings.data.items.find((i) => i.studentId === low.student.id && i.type === 'low_lessons');
  assert.ok(lowWarning);
  assert.strictEqual(lowWarning.level, 'urgent');
  const absenceWarning = warnings.data.items.find((i) => i.studentId === absent.student.id && i.type === 'absence');
  assert.ok(absenceWarning, '连续缺勤学员应进入预警');
  assert.strictEqual(absenceWarning.level, 'urgent');
  assert.ok(!warnings.data.items.some((i) => i.studentId === other.student.id));
  ok('课时不足与连续缺勤预警正确，且不含他人学员');

  const warningsB = await call('GET', '/api/teacher-portal/warnings', tokenB);
  assert.ok(!warningsB.data.items.some((i) => [low, normal, absent].some((s) => s.student.id === i.studentId)));
  ok('另一位老师看不到这些预警');

  assert.strictEqual((await call('GET', `/api/educational/fulfillment/workbench/${lessonOtherTeacher.id}`, tokenA)).status, 404);
  const mySchedules = await call('GET', `/api/educational/schedules?teacherId=${teacherB.id}`, tokenA);
  assert.ok(!mySchedules.data.some((s) => s.id === lessonOtherTeacher.id));
  ok('不能打开或查询他人课次');

  console.log('\n--- 修改本人密码 ---');
  const wrongOld = await call('POST', '/api/auth/change-password', tokenA, { oldPassword: 'wrong-Pass1', newPassword: 'NewPass123' });
  assert.strictEqual(wrongOld.status, 400, '原密码错误应为 400，401 会把老师踢回登录页');
  const weak = await call('POST', '/api/auth/change-password', tokenA, { oldPassword: PASSWORD, newPassword: '123456' });
  assert.strictEqual(weak.status, 400);
  const same = await call('POST', '/api/auth/change-password', tokenA, { oldPassword: PASSWORD, newPassword: PASSWORD });
  assert.strictEqual(same.status, 400);
  ok('原密码错误、弱密码、与原密码相同都被拒绝');

  const change = await call('POST', '/api/auth/change-password', tokenA, { oldPassword: PASSWORD, newPassword: 'NewPass123' });
  assert.ok([200, 201].includes(change.status), JSON.stringify(change.raw));
  assert.ok(await login(teacherA.account, 'NewPass123'));
  assert.strictEqual((await call('POST', '/api/auth/login', null, { account: teacherA.account, password: PASSWORD })).status, 401);
  ok('修改成功：新密码可登录，旧密码失效');

  console.log(`\n全部 ${passed} 项断言通过\n`);
}

async function cleanup() {
  const studentIds = created.students;
  const classIds = created.classes;
  await prisma.lessonEvaluationOutbox.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.lessonEvaluation.deleteMany({ where: { classId: { in: classIds } } });
  await prisma.attendanceRecord.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.scheduleEvent.deleteMany({ where: { classId: { in: classIds } } });
  await prisma.studentCoursePackage.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.class.deleteMany({ where: { id: { in: classIds } } });
  if (created.classroom) await prisma.classroom.delete({ where: { id: created.classroom } });
  await prisma.userRole.deleteMany({ where: { userId: { in: created.users } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
}

run()
  .catch((err) => {
    console.error('测试失败:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((err) => console.error('清理测试数据失败:', err.message));
    await prisma.$disconnect();
  });
