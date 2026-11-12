/**
 * 老学员续费并入原班 + 班级名额按学员计 专项验证
 *
 * 覆盖：
 * - 续报同一课程不传班级，新课包自动并入原班，班级人数不变，满员也能续费
 * - 报读预检返回将并入的班级
 * - 班级课程与报读课程不一致时拒绝
 * - 点名名单 / 课评名单 / 班级详情 / 班级花名册 同一学员只出现一次，余额取合计
 * - 点名先扣最早的课包
 * - 退掉续费课包后学员仍在班，名额不释放
 * - 转班把学员在原班的所有课包一起转走，两边人数各变 1
 *
 * 需要在 PORT (默认 3001) 上运行的后端，会写入数据库。
 */
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = '127.0.0.1';

function request(method, path, headers, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port: PORT, path, method, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

let passed = 0;
function assert(condition, desc, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS [${passed}]: ${desc}`);
  } else {
    console.error(`  ✗ FAIL: ${desc}`, detail !== undefined ? JSON.stringify(detail) : '');
    process.exit(1);
  }
}
const ok = (res) => res.status === 200 || res.status === 201;
const dataOf = (res) => (res.body && res.body.data !== undefined ? res.body.data : res.body);

async function main() {
  console.log('================================================================');
  console.log('老学员续费并入原班 / 班级名额按学员计 专项验证');
  console.log('================================================================\n');

  const login = await request('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, {
    account: 'donghaichao',
    password: '123456',
  });
  assert(ok(login), '超管登录成功');
  const token = login.body?.data?.accessToken || login.body?.token;
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const campus = await prisma.campus.findFirst();
  const courses = await prisma.course.findMany({ where: { pricePerLesson: { gt: 0 } }, take: 2 });
  const course = courses[0];
  const otherCourse = courses[1];
  const classroom = await prisma.classroom.findFirst();
  const teacher = await prisma.user.findFirst();
  assert(!!campus && !!course && !!otherCourse && !!classroom && !!teacher, '测试基础数据齐备');

  const tag = Date.now().toString(36).toUpperCase();
  const now = new Date();
  const future = new Date(Date.now() + 90 * 86400000);
  const mkClass = (suffix, capacity) =>
    prisma.class.create({
      data: {
        campusId: campus.id,
        courseId: course.id,
        classroomId: classroom.id,
        teacherId: teacher.id,
        code: `CLS-RNW-${suffix}-${tag}`,
        name: `续费并班测试-${suffix}-${tag}`,
        capacity,
        currentStudentCount: 0,
        startDate: now,
        endDate: future,
        status: 'in_progress',
      },
    });
  const classA = await mkClass('A', 2);
  const classB = await mkClass('B', 10);
  const mkStudent = (n) =>
    prisma.student.create({
      data: {
        campusId: campus.id,
        studentNo: `RNW${tag}${n}`,
        name: `续费并班学员${n}-${tag}`,
        gender: 'male',
        phone: `139${String(Date.now()).slice(-7)}${n}`.slice(0, 11),
        status: 'normal',
      },
    });
  const stu = await mkStudent(1);
  const filler = await mkStudent(2);

  const enroll = (body) =>
    request('POST', '/api/students/enroll', H, {
      courseId: course.id,
      totalLessons: 10,
      bonusLessons: 0,
      pricePerLesson: course.pricePerLesson,
      paymentMethod: 'wechat',
      ...body,
    });
  const countOf = async (id) => (await prisma.class.findUnique({ where: { id } })).currentStudentCount;

  console.log('\n--- 场景一：首次报读入班 ---');
  const first = await enroll({ studentId: stu.id, classId: classA.id });
  assert(ok(first), '首次报读指定班级成功', first.body);
  assert(dataOf(first).renewalMerged === false, '首次报读不算续费');
  assert((await countOf(classA.id)) === 1, '班级 A 人数 = 1');

  const mismatch = await enroll({ studentId: filler.id, classId: classA.id, courseId: otherCourse.id, pricePerLesson: otherCourse.pricePerLesson });
  assert(mismatch.status === 400, '报读课程与班级课程不一致时拒绝 (400)', mismatch.body);

  const fill = await enroll({ studentId: filler.id, classId: classA.id });
  assert(ok(fill), '另一名学员入班，班级 A 满员');
  assert((await countOf(classA.id)) === 2, '班级 A 人数 = 2 (已满)');

  console.log('\n--- 场景二：报读预检 ---');
  const preview = await request('GET', `/api/students/${stu.id}/enroll-preview?courseId=${course.id}`, H);
  assert(ok(preview), '报读预检返回 200', preview.body);
  assert(dataOf(preview).isRenewal === true, '预检识别为续费');
  assert(dataOf(preview).classId === classA.id, '预检返回将并入班级 A');
  assert(dataOf(preview).remainingLessons === 10, '预检返回当前剩余 10 课时');
  const previewNew = await request('GET', `/api/students/${stu.id}/enroll-preview?courseId=${otherCourse.id}`, H);
  assert(dataOf(previewNew).isRenewal === false && dataOf(previewNew).classId === null, '其他课程预检不是续费');

  console.log('\n--- 场景三：满员班老学员续费并入原班 ---');
  const renew = await enroll({ studentId: stu.id });
  assert(ok(renew), '班级满员时老学员续费仍成功', renew.body);
  assert(dataOf(renew).renewalMerged === true, '回执标明续费并入原班');
  assert(dataOf(renew).classId === classA.id, '新课包自动挂到班级 A');
  assert((await countOf(classA.id)) === 2, '班级 A 人数仍为 2，没有多算');

  const renewExplicit = await enroll({ studentId: stu.id, classId: classA.id });
  assert(ok(renewExplicit) && dataOf(renewExplicit).renewalMerged === true, '显式指定原班续费同样并入');
  assert((await countOf(classA.id)) === 2, '班级 A 人数仍为 2');

  const pkgs = await prisma.studentCoursePackage.findMany({
    where: { studentId: stu.id },
    orderBy: { createdAt: 'asc' },
  });
  assert(pkgs.length === 3 && pkgs.every((p) => p.classId === classA.id), '学员 3 个课包都在班级 A，各自独立');
  const unassigned = await prisma.studentCoursePackage.count({ where: { studentId: stu.id, classId: null } });
  assert(unassigned === 0, '学员没有进入待分班');

  console.log('\n--- 场景四：名单去重与先扣最早课包 ---');
  const schedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: classA.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-20',
      startTime: '09:00',
      endTime: '10:30',
      semanticType: 'regular',
      classType: 'formal',
      status: 'scheduled',
      laneIndex: 0,
    },
  });
  const rc = await request('GET', `/api/educational/schedules/${schedule.id}/roll-call-students`, H);
  assert(ok(rc), '点名名单返回 200');
  const rcRows = dataOf(rc).filter((r) => r.studentId === stu.id);
  assert(rcRows.length === 1, '点名名单中续费学员只出现一次', rcRows.length);
  assert(rcRows[0].packageId === pkgs[0].id, '点名默认课包为最早的课包');
  assert(rcRows[0].remainingLessons === 30, '点名名单剩余课时为三个课包合计 30');

  const wb = await request('GET', `/api/educational/fulfillment/workbench/${schedule.id}`, H);
  assert(ok(wb), '上课工作台返回 200', wb.body);
  const wbStudents = dataOf(wb).students || [];
  const wbRows = wbStudents.filter((r) => r.studentId === stu.id);
  assert(wbRows.length === 1 && wbRows[0].remainingLessons === 30, '上课工作台续费学员一行、余额合计 30');

  const evalWb = await request('GET', `/api/educational/lesson-evaluations/workbench/${schedule.id}`, H);
  assert(ok(evalWb), '课评工作台返回 200');
  const roster = dataOf(evalWb).roster || dataOf(evalWb).students || [];
  assert(roster.filter((r) => r.studentId === stu.id).length === 1, '课评名单续费学员只出现一次');

  const rollCall = await request('POST', '/api/educational/attendances/roll-call', H, {
    scheduleEventId: schedule.id,
    items: [
      { studentId: stu.id, packageId: rcRows[0].packageId, status: 'present', deductLessons: 1 },
      { studentId: filler.id, status: 'present', deductLessons: 1 },
    ],
  });
  assert(ok(rollCall), '点名结算成功', rollCall.body);
  const after = await prisma.studentCoursePackage.findMany({ where: { studentId: stu.id }, orderBy: { createdAt: 'asc' } });
  assert(after[0].remainingLessons === 9, '扣的是最早的课包 (10 → 9)');
  assert(after[1].remainingLessons === 10 && after[2].remainingLessons === 10, '续费课包未被扣');

  const detail = await request('GET', `/api/educational/classes/${classA.id}`, H);
  const detailRows = (dataOf(detail).studentPackages || []).filter((p) => p.studentId === stu.id);
  assert(detailRows.length === 1, '班级详情续费学员只出现一次');
  assert(detailRows[0].remainingLessons === 29 && detailRows[0].packageCount === 3, '班级详情课时合计 29、课包数 3');

  const rosterRes = await request('GET', `/api/educational/roster/class/${classA.id}`, H);
  const rosterRows = (dataOf(rosterRes).students || []).filter((r) => r.studentId === stu.id);
  assert(rosterRows.length === 1 && rosterRows[0].remainingLessons === 29, '班级花名册续费学员一行、余额合计 29');

  const list = await request('GET', `/api/educational/classes?keyword=${encodeURIComponent(classA.code)}&pageSize=50`, H);
  const listItem = (dataOf(list).list || []).find((c) => c.id === classA.id);
  if (listItem) {
    assert(listItem.enrolledCount === 2, '班级列表报读人数按学员去重 = 2', listItem.enrolledCount);
  }

  console.log('\n--- 场景五：退掉续费课包，学员仍在班 ---');
  const refund = await request('POST', `/api/students/${stu.id}/movement`, H, {
    type: 'refund',
    packageId: after[2].id,
    reasonCategory: '续费退费测试',
  });
  assert(ok(refund), '退掉第三个 (续费) 课包成功', refund.body);
  assert((await countOf(classA.id)) === 2, '学员还有在读课包，班级 A 名额不释放 (仍为 2)');

  console.log('\n--- 场景六：转班把学员整体转走 ---');
  const transfer = await request('POST', `/api/students/${stu.id}/movement`, H, {
    type: 'transfer_class',
    packageId: after[0].id,
    toClassId: classB.id,
    reasonCategory: '续费并班测试',
  });
  assert(ok(transfer), '转班成功', transfer.body);
  assert((await countOf(classA.id)) === 1, '班级 A 人数 2 → 1');
  assert((await countOf(classB.id)) === 1, '班级 B 人数 0 → 1');
  const moved = await prisma.studentCoursePackage.findMany({
    where: { studentId: stu.id, status: { in: ['active', 'frozen', 'completed'] } },
  });
  assert(moved.length === 2 && moved.every((p) => p.classId === classB.id), '学员两个在读课包都转入班级 B');

  console.log(`\n全部 ${passed} 项通过`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
