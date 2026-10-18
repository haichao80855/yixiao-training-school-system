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
  console.log('🧪 课评工作台考勤调整 (请假免评) 暂存草稿与回显全生命周期测试');
  console.log('================================================================================\n');

  const token = await loginAdmin();
  const campus = (await prisma.campus.findFirst({ where: { status: 'active' } })) || (await prisma.campus.findFirst());
  const teacher = (await prisma.user.findFirst({ where: { campusId: campus.id } })) || (await prisma.user.findFirst());
  const classroom = (await prisma.classroom.findFirst({ where: { campusId: campus.id } })) || (await prisma.classroom.findFirst());

  const randId = Math.floor(100000 + Math.random() * 900000);
  const className = `考勤草稿测试班-${randId}`;

  // 1. 创建测试班级与学员
  const course = await prisma.course.findFirst();
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
      name: `测试学员A-${randId}`,
      studentNo: `STU-A-${randId}`,
      phone: `139${randId}`,
      campusId: campus.id,
      gender: 'male',
      wechatOpenId: `wx-openid-a-${randId}`,
    },
  });

  const studentB = await prisma.student.create({
    data: {
      name: `测试学员B-${randId}`,
      studentNo: `STU-B-${randId}`,
      phone: `138${randId}`,
      campusId: campus.id,
      gender: 'male',
      wechatOpenId: `wx-openid-b-${randId}`,
    },
  });

  // 创建学员课包
  const pkgA = await prisma.studentCoursePackage.create({
    data: {
      studentId: studentA.id,
      courseId: course.id,
      classId: cls.id,
      totalLessons: 20,
      remainingLessons: 20,
      consumedLessons: 0,
      bonusLessons: 2,
      status: 'active',
    },
  });

  const pkgB = await prisma.studentCoursePackage.create({
    data: {
      studentId: studentB.id,
      courseId: course.id,
      classId: cls.id,
      totalLessons: 20,
      remainingLessons: 20,
      consumedLessons: 0,
      bonusLessons: 2,
      status: 'active',
    },
  });

  // 创建排课日程，并创建初始点名考勤 (学员 A 到课，学员 B 到课)
  const schedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: cls.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-25',
      startTime: '14:00',
      endTime: '15:30',
      status: 'scheduled',
    },
  });

  const attA = await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: schedule.id,
      studentId: studentA.id,
      packageId: pkgA.id,
      status: 'present',
      deductLessons: 1,
      regularBurned: 1,
      bonusBurned: 0,
      operator: '测试教师',
      isReversed: false,
    },
  });

  const attB = await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: schedule.id,
      studentId: studentB.id,
      packageId: pkgB.id,
      status: 'present',
      deductLessons: 1,
      regularBurned: 1,
      bonusBurned: 0,
      operator: '测试教师',
      isReversed: false,
    },
  });

  console.log(`[初始化完成] 排课日程 ID: ${schedule.id}`);
  console.log(`  学员 A: ${studentA.name} 初始考勤: present`);
  console.log(`  学员 B: ${studentB.name} 初始考勤: present\n`);

  // --- 步骤 1: 首次打开课评工作台 (getEvaluationWorkbench) ---
  console.log('--- [步骤 1: 首次打开课评工作台] ---');
  let wbRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/educational/lesson-evaluations/workbench/${schedule.id}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Campus-Id': campus.id,
    },
  });

  assert.strictEqual(wbRes.status, 200, '获取课评工作台应返回 200');
  const roster1 = wbRes.data.data.roster;
  const sA1 = roster1.find((s) => s.studentId === studentA.id);
  const sB1 = roster1.find((s) => s.studentId === studentB.id);

  assert.strictEqual(sA1.attendanceStatus, 'present', '学员 A 初始状态应为 present');
  assert.strictEqual(sA1.deductLessons, 1, '学员 A 初始扣减课时应为 1');
  assert.strictEqual(sA1.isExempt, false, '学员 A 初始不应免评');
  console.log('✓ PASS: 首次水化名册，学员 A 与学员 B 均为到课 (present)');

  // --- 步骤 2: 将学员 A 调整为「请假」，点击「暂存全班草稿」 ---
  console.log('\n--- [步骤 2: 将学员 A 调整为「请假」，暂存全班草稿] ---');
  const commitPayloadDraft = {
    scheduleEventId: schedule.id,
    publish: false, // 暂存全班草稿
    dispatchStrategy: 'ATTENDED_ONLY',
    payload: {
      templateId: 'tmpl-common',
      templateName: '通用课评模板',
      lessonTitle: `${className} - 图形编程逻辑`,
      studyContentHtml: '今天进行了图形化循环控制与逻辑分支的学习。',
      overallRating: 5,
      teacherComment: '全班上课专注',
      studentOverrides: [
        {
          studentId: studentA.id,
          attendanceStatus: 'leave', // 关键操作：调整为请假
          deductLessons: 0,          // 请假免消
          personalizedComment: '该同学今天请假，系统自动免评',
          rating: 5,
          performanceTag: '请假免评',
          photos: [],
          videoUrl: '',
          isEvaluated: false,
        },
        {
          studentId: studentB.id,
          attendanceStatus: 'present',
          deductLessons: 1,
          personalizedComment: '学员 B 课堂表现积极，算法思路开阔！',
          rating: 5,
          performanceTag: '逻辑标兵',
          photos: [],
          videoUrl: '',
          isEvaluated: true,
        },
      ],
    },
  };

  const draftRes = await request(
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
    commitPayloadDraft
  );

  assert.strictEqual(draftRes.status, 201, '暂存草稿接口应返回 201');
  assert.strictEqual(draftRes.data.data.status, 'draft', '返回回执状态应为 draft');
  console.log('✓ PASS: 暂存全班草稿成功返回回执');

  // --- 步骤 3: 再次点击该课评，验证回显数据 ---
  console.log('\n--- [步骤 3: 再次打开课评工作台，验证回显数据] ---');
  wbRes = await request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/educational/lesson-evaluations/workbench/${schedule.id}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Campus-Id': campus.id,
    },
  });

  assert.strictEqual(wbRes.status, 200, '再次获取课评工作台应返回 200');
  const roster2 = wbRes.data.data.roster;
  const sA2 = roster2.find((s) => s.studentId === studentA.id);
  const sB2 = roster2.find((s) => s.studentId === studentB.id);

  assert.strictEqual(sA2.attendanceStatus, 'leave', '【核心断言】学员 A 再次打开时必须保持 leave (请假)！');
  assert.strictEqual(sA2.deductLessons, 0, '【核心断言】学员 A 扣减课时必须为 0！');
  assert.strictEqual(sA2.isExempt, true, '【核心断言】学员 A 必须为 isExempt=true (免评)！');
  assert.strictEqual(sB2.attendanceStatus, 'present', '学员 B 必须保持 present (到课)！');
  assert.strictEqual(sB2.deductLessons, 1, '学员 B 扣减课时必须为 1！');
  console.log('✓ PASS [核心通过]: 再次打开课评，学员 A 准确保持「请假」状态与免评标记，绝无倒退回「到课」！');

  // --- 步骤 4: 数据库底层 AttendanceRecord 断言 ---
  console.log('\n--- [步骤 4: 数据库底层物理记录断言] ---');
  const dbAttA = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: schedule.id, studentId: studentA.id, isReversed: false },
  });
  const dbAttB = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: schedule.id, studentId: studentB.id, isReversed: false },
  });

  assert.strictEqual(dbAttA.status, 'leave', '数据库中学员 A 的 AttendanceRecord.status 必须为 leave');
  assert.strictEqual(dbAttA.deductLessons, 0, '数据库中学员 A 的 deductLessons 必须为 0');
  assert.strictEqual(dbAttB.status, 'present', '数据库中学员 B 的 AttendanceRecord.status 必须为 present');
  console.log('✓ PASS: 数据库 AttendanceRecord 物理状态与草稿严格同步落盘！');

  // --- 步骤 5: 正式发布并推送微信，验证 ATTENDED_ONLY 策略断言 ---
  console.log('\n--- [步骤 5: 正式发布课评，验证 ATTENDED_ONLY 过滤请假学员] ---');
  const commitPayloadPublish = {
    ...commitPayloadDraft,
    publish: true, // 正式发布
  };

  const publishRes = await request(
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
    commitPayloadPublish
  );

  assert.strictEqual(publishRes.status, 201, '正式发布接口应返回 201');
  const receipt = publishRes.data.data;
  assert.strictEqual(receipt.status, 'published', '发布回执状态应为 published');
  assert.strictEqual(receipt.dispatchResult.outboxEnqueuedCount, 1, '应仅向到课的学员 B 微信推送，请假学员 A 自动免推');
  console.log('✓ PASS: 微信推送准确过滤请假学员，仅向到课学员推送！');

  console.log('\n================================================================================');
  console.log('🎉 课评考勤调整 (请假免评) 暂存草稿、回显与发布全生命周期测试 100% 全部通过！');
  console.log('================================================================================\n');
}

runTests()
  .catch((e) => {
    console.error('❌ 测试执行失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
