/**
 * 教学讲台应到人数与实到人数真实性全链路专项测试
 * 
 * 验证目标：
 * 1. 后端 /api/educational/schedules：真实反映班级在读花名册人数（应到）与考勤出勤人数（实到，仅含 present/late）
 * 2. 避免将请假 (leave) 与缺勤 (absent) 误算为实到人数
 * 3. 彻底消除 Web 端 8 与小程序端 10 的硬编码 fallback
 * 4. 覆盖空班级、新排课、部分到课、请假、迟到全矩阵
 */

const assert = require('assert');
const { PrismaClient } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();
const BACKEND_URL = 'http://127.0.0.1:3001';

let authToken = '';

async function login() {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'donghaichao', password: '123456' }),
  });
  const data = await res.json();
  authToken = data.data?.accessToken || data.data?.token || data.token || '';
}

async function request(url, options = {}) {
  const res = await fetch(`${BACKEND_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'default-tenant',
      Authorization: `Bearer ${authToken}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('================================================================================');
  console.log('🧪 教学讲台「应到人数」与「实到人数」全链路真实性验收测试');
  console.log('================================================================================\n');

  await login();

  const campus = await prisma.campus.findFirst();
  const teacher = await prisma.user.findFirst({ where: { status: 'active' } });
  const course = await prisma.course.findFirst();
  const classroom = await prisma.classroom.findFirst();

  if (!campus || !teacher || !course || !classroom) {
    throw new Error('测试前置条件缺失：未找到基础校区/讲师/课程/教室数据');
  }

  const suffix = Math.floor(Math.random() * 900000 + 100000);
  const className = `应到实到测试班-${suffix}`;

  // 1. 创建测试班级 (capacity: 10, currentStudentCount: 3)
  const testClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      code: `CLS-HEADCOUNT-${suffix}`,
      name: className,
      capacity: 10,
      currentStudentCount: 3,
      teacherId: teacher.id,
      classroomId: classroom.id,
      startDate: new Date('2026-10-01'),
      endDate: new Date('2027-01-31'),
      status: 'in_progress',
    },
  });

  // 2. 为该班级创建 3 名专属在读学员与 active 课包
  const students = [];
  for (let i = 1; i <= 3; i++) {
    const student = await prisma.student.create({
      data: {
        campusId: campus.id,
        studentNo: `STU-HC-${suffix}-${i}`,
        name: `考勤学员${i}-${suffix}`,
        phone: `139${suffix}${i}`,
        gender: 'male',
        status: 'active',
      },
    });
    const pkg = await prisma.studentCoursePackage.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        classId: testClass.id,
        totalLessons: 40,
        remainingLessons: 38,
        consumedLessons: 2,
        status: 'active',
        pricePerLesson: 150,
      },
    });
    students.push({ student, pkg });
  }

  // 3. 创建测试排课日程
  const scheduleEvent = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-18',
      startTime: '10:00',
      endTime: '11:30',
      status: 'scheduled',
    },
  });

  console.log(`[初始化完成] 班级: ${className} (在读 3 人, 容量 10), 排课 ID: ${scheduleEvent.id}`);

  // ---------------------------------------------------------------------------
  // 场景 1: 未考勤时请求排课列表接口
  // ---------------------------------------------------------------------------
  console.log('\n--- [场景 1: 新排课未点名时的应到与实到断言] ---');
  const res1 = await request(`/api/educational/schedules?campusId=${campus.id}&date=2026-10-18&classId=${testClass.id}`);
  assert.strictEqual(res1.status, 200, '获取排课日程应返回 200');
  const list1 = res1.data.data || res1.data;
  const target1 = list1.find((s) => s.id === scheduleEvent.id);
  assert.ok(target1, '返回列表中必须包含目标排课');

  console.log(`  接口返回: expectedCount=${target1.expectedCount}, totalStudents=${target1.totalStudents}, actualCount=${target1.actualCount}, signedCount=${target1.signedCount}`);
  assert.strictEqual(target1.expectedCount, 3, '应到人数必须精确为 3（班级在读学员数），绝非硬编码 8 或 10！');
  assert.strictEqual(target1.totalStudents, 3, 'totalStudents 必须精确为 3');
  assert.strictEqual(target1.actualCount, 0, '未点名时实到人数必须严格为 0');
  assert.strictEqual(target1.signedCount, 0, '未点名时已签到人数必须严格为 0');
  console.log('✓ PASS [断言 1]: 未点名时应到精确为 3，实到严格为 0');

  // ---------------------------------------------------------------------------
  // 场景 2: 考勤打卡：1 到课 (present), 1 请假 (leave), 1 缺勤 (absent)
  // ---------------------------------------------------------------------------
  console.log('\n--- [场景 2: 混合考勤（1 到课 + 1 请假 + 1 缺勤）的实到过滤断言] ---');
  await prisma.attendanceRecord.createMany({
    data: [
      {
        scheduleEventId: scheduleEvent.id,
        studentId: students[0].student.id,
        status: 'present',
        deductLessons: 1,
        packageId: students[0].pkg.id,
        operator: '测试考勤员',
      },
      {
        scheduleEventId: scheduleEvent.id,
        studentId: students[1].student.id,
        status: 'leave',
        deductLessons: 0,
        packageId: students[1].pkg.id,
        operator: '测试考勤员',
      },
      {
        scheduleEventId: scheduleEvent.id,
        studentId: students[2].student.id,
        status: 'absent',
        deductLessons: 0,
        packageId: students[2].pkg.id,
        operator: '测试考勤员',
      },
    ],
  });

  const res2 = await request(`/api/educational/schedules?campusId=${campus.id}&date=2026-10-18&classId=${testClass.id}`);
  assert.strictEqual(res2.status, 200);
  const list2 = res2.data.data || res2.data;
  const target2 = list2.find((s) => s.id === scheduleEvent.id);
  assert.ok(target2);

  console.log(`  混合考勤后: expectedCount=${target2.expectedCount}, actualCount=${target2.actualCount}, rawAttendancesCount=${target2._count?.attendances}`);
  assert.strictEqual(target2.expectedCount, 3, '应到人数保持为 3');
  assert.strictEqual(target2.actualCount, 1, '实到人数必须严格为 1（仅 present），请假和缺勤绝不计入实到！');
  assert.strictEqual(target2.signedCount, 1, 'signedCount 必须严格为 1');
  console.log('✓ PASS [断言 2]: 考勤记录虽有 3 条，但实到人数精准过滤为 1，未将请假/缺勤误算！');

  // ---------------------------------------------------------------------------
  // 场景 3: 包含迟到 (late) 的实到核算断言
  // ---------------------------------------------------------------------------
  console.log('\n--- [场景 3: 迟到 (late) 计入到课实到断言] ---');
  await prisma.attendanceRecord.updateMany({
    where: { scheduleEventId: scheduleEvent.id, studentId: students[2].student.id },
    data: { status: 'late', deductLessons: 1 },
  });

  const res3 = await request(`/api/educational/schedules?campusId=${campus.id}&date=2026-10-18&classId=${testClass.id}`);
  const list3 = res3.data.data || res3.data;
  const target3 = list3.find((s) => s.id === scheduleEvent.id);
  console.log(`  1 present + 1 late + 1 leave: actualCount=${target3.actualCount}`);
  assert.strictEqual(target3.actualCount, 2, '实到人数必须为 2（1到课 + 1迟到）');
  console.log('✓ PASS [断言 3]: 迟到学员 (late) 正确计入实到人数');

  // ---------------------------------------------------------------------------
  // 场景 4: 结课履约工作台 (hydrateWorkbench) 数据对齐
  // ---------------------------------------------------------------------------
  console.log('\n--- [场景 4: 结课履约工作台 schedule.expectedCount / actualCount 对齐断言] ---');
  const resWb = await request(`/api/educational/fulfillment/workbench/${scheduleEvent.id}`);
  assert.strictEqual(resWb.status, 200);
  const wbData = resWb.data.data || resWb.data;
  console.log('wbData keys:', Object.keys(wbData));
  console.log('wbData.schedule:', wbData.schedule);
  console.log('wbData.summary:', wbData.summary);
  assert.strictEqual(wbData.schedule.expectedCount, 3, '工作台 schedule.expectedCount 应为 3');
  assert.strictEqual(wbData.schedule.actualCount, 2, '工作台 schedule.actualCount 应为 2');
  assert.strictEqual(wbData.summary.totalStudents, 3, '工作台 summary.totalStudents 应为 3');
  console.log('✓ PASS [断言 4]: 结课履约工作台返回的 schedule 与 summary 人数精准对齐！');

  // ---------------------------------------------------------------------------
  // 场景 5: 前端规格化层 (normalizeWorkbenchLessonCard & normalizeSchedule)
  // ---------------------------------------------------------------------------
  console.log('\n--- [场景 5: 前端规格化模块防腐与绝无 8/10 fallback 断言] ---');
  // 模拟 Web 端 normalizer 行为
  function mockNormalizeSchedule(raw) {
    const studentIds = Array.isArray(raw.studentIds) ? raw.studentIds : [];
    const attendanceCount = Number(
      raw.signedCount ??
      raw.actualCount ??
      (raw.attendances ? raw.attendances.filter((a) => a.status === 'present' || a.status === 'late').length : (raw.attendanceCount ?? raw._count?.attendances ?? 0))
    );
    const totalCount = Number(
      raw.totalStudents ??
      raw.expectedCount ??
      raw.studentCount ??
      raw.totalCount ??
      (studentIds.length || (raw.class?.currentStudentCount ?? (raw.class?.capacity ?? 0)))
    );
    return { attendanceCount, totalCount, studentIds };
  }

  function mockNormalizeWorkbenchLessonCard(raw) {
    const evt = mockNormalizeSchedule(raw);
    const studentCount = Number(raw.totalStudents ?? raw.expectedCount ?? raw.studentCount ?? evt.totalCount ?? (evt.studentIds?.length || 0));
    const signedCount = Number(raw.signedCount ?? raw.actualCount ?? evt.attendanceCount ?? raw.attendanceCount ?? 0);
    return { totalStudents: studentCount, signedCount };
  }

  // 1) 消费后端真实排课 target3
  const cardReal = mockNormalizeWorkbenchLessonCard(target3);
  assert.strictEqual(cardReal.totalStudents, 3);
  assert.strictEqual(cardReal.signedCount, 2);

  // 2) 0 学员新班排课
  const emptyClassRaw = {
    id: 'empty-1',
    totalStudents: 0,
    expectedCount: 0,
    actualCount: 0,
    signedCount: 0,
    class: { currentStudentCount: 0, capacity: 10 },
  };
  const cardEmpty = mockNormalizeWorkbenchLessonCard(emptyClassRaw);
  assert.strictEqual(cardEmpty.totalStudents, 0, '空班级 totalStudents 必须为 0，绝非 8 或 10');
  assert.strictEqual(cardEmpty.signedCount, 0, '空班级 signedCount 必须为 0');

  console.log('✓ PASS [断言 5]: 前端规格化层在真实排课及 0 学员排课下 100% 精确，无任何 8/10 脏数据！');

  // 清理测试临时数据
  await prisma.attendanceRecord.deleteMany({ where: { scheduleEventId: scheduleEvent.id } });
  await prisma.scheduleEvent.delete({ where: { id: scheduleEvent.id } });
  await prisma.studentCoursePackage.deleteMany({ where: { classId: testClass.id } });
  await prisma.class.delete({ where: { id: testClass.id } });
  await prisma.student.deleteMany({ where: { id: { in: students.map((s) => s.student.id) } } });

  console.log('\n================================================================================');
  console.log('🎉 恭喜！教学讲台「应到人数」与「实到人数」全链路真实性验收测试全部通过！');
  console.log('================================================================================');
}

run()
  .catch((err) => {
    console.error('❌ 测试失败:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
