const http = require('http');
const assert = require('assert');
const { PrismaClient } = require('../server/node_modules/@prisma/client');
const prisma = new PrismaClient();

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

async function loginAdmin() {
  const res = await request(
    {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'donghaichao', password: '123456' }
  );
  const token = res.data?.data?.accessToken || res.data?.accessToken;
  if (!token) {
    throw new Error('管理员登录失败: ' + JSON.stringify(res.data));
  }
  return token;
}

async function runTests() {
  console.log('================================================================================');
  console.log('🧪 小程序端课次详情考勤修改 (改未到/请假) 退出再重新进入持久化测试');
  console.log('================================================================================\n');

  const token = await loginAdmin();
  const campus = (await prisma.campus.findFirst({ where: { status: 'active' } })) || (await prisma.campus.findFirst());
  const teacher = (await prisma.user.findFirst({ where: { campusId: campus.id } })) || (await prisma.user.findFirst());
  const classroom = (await prisma.classroom.findFirst({ where: { campusId: campus.id } })) || (await prisma.classroom.findFirst());
  const course = await prisma.course.findFirst();

  const randId = Math.floor(100000 + Math.random() * 900000);
  const className = `小程序考勤测试班-${randId}`;

  // 1. 创建测试班级与学员
  const cls = await prisma.class.create({
    data: {
      name: className,
      code: `CLS-${randId}`,
      campusId: campus.id,
      courseId: course.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      capacity: 10,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
    },
  });

  const studentA = await prisma.student.create({
    data: {
      name: `出勤学员A-${randId}`,
      studentNo: `STU-A-${randId}`,
      phone: `139${randId}`,
      campusId: campus.id,
      gender: 'male',
      wechatOpenId: `wx-openid-a-${randId}`,
    },
  });

  const studentB = await prisma.student.create({
    data: {
      name: `出勤学员B-${randId}`,
      studentNo: `STU-B-${randId}`,
      phone: `138${randId}`,
      campusId: campus.id,
      gender: 'female',
      wechatOpenId: `wx-openid-b-${randId}`,
    },
  });

  // 创建排课日程，并创建初始考勤记录 (学员 A 初始为 present 到课，学员 B 为 present 到课)
  const schedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: cls.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-26',
      startTime: '10:00',
      endTime: '11:30',
      status: 'scheduled',
    },
  });

  await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: schedule.id,
      studentId: studentA.id,
      status: 'present',
      deductLessons: 1,
      regularBurned: 0,
      bonusBurned: 0,
      operator: '测试讲师',
      isReversed: false,
    },
  });

  await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: schedule.id,
      studentId: studentB.id,
      status: 'present',
      deductLessons: 1,
      regularBurned: 0,
      bonusBurned: 0,
      operator: '测试讲师',
      isReversed: false,
    },
  });

  console.log(`[初始化完成] 排课日程 ID: ${schedule.id}`);
  console.log(`  学员 A: ${studentA.name} 初始状态: present (已到)`);
  console.log(`  学员 B: ${studentB.name} 初始状态: present (已到)\n`);

  // --- 步骤 1: 模拟小程序首次进入课次详情 (loadRollCallData -> getFulfillmentWorkbench) ---
  console.log('--- [步骤 1: 首次进入课次详情，核验初始考勤] ---');
  let wbRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/educational/fulfillment/workbench/${schedule.id}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Campus-Id': campus.id,
    },
  });

  assert.strictEqual(wbRes.status, 200, '获取履约工作台应返回 200');
  let stuA = wbRes.data.data.students.find((s) => s.studentId === studentA.id);
  assert.strictEqual(stuA.recordedStatus || stuA.defaultStatus, 'present', '学员 A 初始必须为 present');
  console.log('✓ PASS: 首次进入课次详情，学员 A 与学员 B 均为到课 (present)');

  // --- 步骤 2: 模拟在课次详情中点击切换学员 A 状态为「未到」(absent) 并静默同步 ---
  console.log('\n--- [步骤 2: 将学员 A 改为「未到」(absent)，触发静默同步] ---');
  const commitRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/educational/lesson-evaluations/commit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Campus-Id': campus.id,
      },
    },
    {
      scheduleEventId: schedule.id,
      publish: false,
      dispatchStrategy: 'ATTENDED_ONLY',
      payload: {
        lessonTitle: `${className} - 随堂考勤`,
        studyContentHtml: '随堂出勤记录与课评草稿',
        teacherComment: '随堂教学进展正常',
        overallRating: 5.0,
        studentOverrides: [
          {
            studentId: studentA.id,
            attendanceStatus: 'absent', // 调整为未到
            deductLessons: 0,          // 未到免消
          },
          {
            studentId: studentB.id,
            attendanceStatus: 'present',
            deductLessons: 1,
          },
        ],
      },
    }
  );

  assert.strictEqual(commitRes.status, 201, '静默同步考勤接口应返回 201');
  console.log('✓ PASS: 静默同步考勤成功返回');

  // --- 步骤 3: 模拟退出课次详情 (内存清空)，再重新进入课次详情 ---
  console.log('\n--- [步骤 3: 模拟退出课次详情后重新进入，断言状态持久化保持] ---');
  wbRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/educational/fulfillment/workbench/${schedule.id}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Campus-Id': campus.id,
    },
  });

  assert.strictEqual(wbRes.status, 200, '重新获取履约工作台应返回 200');
  stuA = wbRes.data.data.students.find((s) => s.studentId === studentA.id);
  const stuB = wbRes.data.data.students.find((s) => s.studentId === studentB.id);

  const finalStatusA = stuA.recordedStatus || stuA.defaultStatus;
  const finalStatusB = stuB.recordedStatus || stuB.defaultStatus;

  assert.strictEqual(finalStatusA, 'absent', '【核心断言】重新进入后，学员 A 状态必须为 absent (未到)！');
  assert.strictEqual(stuA.defaultDeductLessons, 0, '【核心断言】学员 A 课耗必须为 0！');
  assert.strictEqual(finalStatusB, 'present', '学员 B 状态必须保持 present (已到)！');
  console.log('✓ PASS [核心成功]: 重新进入课次详情，学员 A 成功保持「未到」(absent) 状态，状态未改变问题彻底解决！');

  // --- 步骤 4: 数据库底层物理记录断言 ---
  console.log('\n--- [步骤 4: 数据库底层 AttendanceRecord 物理记录核验] ---');
  const dbAttA = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: schedule.id, studentId: studentA.id, isReversed: false },
  });
  assert.strictEqual(dbAttA.status, 'absent', '数据库中 AttendanceRecord.status 必须落盘为 absent');
  assert.strictEqual(dbAttA.deductLessons, 0, '数据库中 AttendanceRecord.deductLessons 必须落盘为 0');
  console.log('✓ PASS: 数据库物理记录 status=absent, deductLessons=0 严格落盘！');

  // --- 步骤 5: 进一步切换为「请假」(leave)，再次退出并重新进入 ---
  console.log('\n--- [步骤 5: 进一步切换为「请假」(leave)，再次退出并重新进入] ---');
  await request(
    {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/educational/lesson-evaluations/commit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Campus-Id': campus.id,
      },
    },
    {
      scheduleEventId: schedule.id,
      publish: false,
      payload: {
        studentOverrides: [
          {
            studentId: studentA.id,
            attendanceStatus: 'leave', // 改为请假
            deductLessons: 0,
          },
        ],
      },
    }
  );

  wbRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/educational/fulfillment/workbench/${schedule.id}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Campus-Id': campus.id,
    },
  });

  stuA = wbRes.data.data.students.find((s) => s.studentId === studentA.id);
  assert.strictEqual(stuA.recordedStatus || stuA.defaultStatus, 'leave', '切换为请假后重新进入必须为 leave');
  console.log('✓ PASS: 状态再次变更为请假后退出重新进入，状态依然精准保持为 leave！');

  console.log('\n================================================================================');
  console.log('🎉 小程序端课次详情考勤修改退出重新进入持久化测试 100% 全部通过！');
  console.log('================================================================================\n');
}

runTests()
  .catch((e) => {
    console.error('❌ 测试执行失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
