const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
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

async function runTests() {
  console.log('================================================================================');
  console.log('学员专属课评矩阵与双端实时互通（StudentCentricEvaluationMatrix）全链路集成测试');
  console.log('验证：单学员多媒体资产私有化隔离、考勤状态前置免评门禁、双端权威评定状态同步');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;
  function assert(condition, desc) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS [${passed}]: ${desc}`);
    } else {
      console.error(`  ✗ FAIL [${total}]: ${desc}`);
      process.exit(1);
    }
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const HOST = '127.0.0.1';

  // 1. 超管登录
  const loginRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'donghaichao', password: '123456' },
  );
  assert(loginRes.status === 200 || loginRes.status === 201, '超管登录成功获取 Token');
  const token = loginRes.body?.data?.accessToken || loginRes.body?.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. 准备实体数据
  const campus = (await prisma.campus.findFirst({ where: { status: 'active' } })) || (await prisma.campus.findFirst());
  const teacher = (await prisma.user.findFirst({ where: { campusId: campus.id } })) || (await prisma.user.findFirst());
  const classroom = (await prisma.classroom.findFirst({ where: { campusId: campus.id } })) || (await prisma.classroom.findFirst());
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());

  const timestamp = Date.now().toString().slice(-6);
  const testClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `专属课评测试班-${timestamp}`,
      code: `CLS-SC-${timestamp}`,
      capacity: 10,
      currentStudentCount: 3,
      status: 'in_progress',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2027-06-30'),
    },
  });

  // 创建 3 名测试学员 (A: 绑定微信, B: 绑定微信, C: 请假未绑)
  const studentA = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `STU-SC-A-${timestamp}`,
      name: `学员A-${timestamp}`,
      gender: 'male',
      phone: `13800${timestamp.slice(0, 6)}`,
      wechatOpenId: `wx-openid-a-${timestamp}`,
    },
  });
  const studentB = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `STU-SC-B-${timestamp}`,
      name: `学员B-${timestamp}`,
      gender: 'male',
      phone: `13900${timestamp.slice(0, 6)}`,
      wechatOpenId: `wx-openid-b-${timestamp}`,
    },
  });
  const studentC = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `STU-SC-C-${timestamp}`,
      name: `学员C(请假)-${timestamp}`,
      gender: 'male',
      phone: `13700${timestamp.slice(0, 6)}`,
    },
  });

  for (const st of [studentA, studentB, studentC]) {
    await prisma.studentCoursePackage.create({
      data: {
        studentId: st.id,
        courseId: course.id,
        classId: testClass.id,
        status: 'active',
        totalLessons: 20,
        remainingLessons: 20,
      },
    });
  }

  // 创建排课日程
  const scheduleEvent = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-18',
      startTime: '10:00',
      endTime: '11:00',
      status: 'scheduled',
    },
  });

  // 随堂考勤落盘：学员 A 到课，学员 B 迟到，学员 C 请假
  await prisma.attendanceRecord.createMany({
    data: [
      {
        scheduleEventId: scheduleEvent.id,
        studentId: studentA.id,
        status: 'present',
        deductLessons: 1,
        operator: 'donghaichao',
      },
      {
        scheduleEventId: scheduleEvent.id,
        studentId: studentB.id,
        status: 'late',
        deductLessons: 1,
        operator: 'donghaichao',
      },
      {
        scheduleEventId: scheduleEvent.id,
        studentId: studentC.id,
        status: 'leave',
        deductLessons: 0,
        operator: 'donghaichao',
      },
    ],
  });

  console.log('\n--- [阶段 1: 课评工作台智能水化与请假免评门禁] ---');
  const hydrateRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/lesson-evaluations/workbench/${scheduleEvent.id}`,
    method: 'GET',
    headers: authHeaders,
  });

  if (hydrateRes.status !== 200) {
    console.log('hydrateRes failed:', hydrateRes.status, hydrateRes.body);
  }
  assert(hydrateRes.status === 200, '水化课评工作台接口返回 HTTP 200');
  const roster = hydrateRes.body?.data?.roster || [];
  assert(roster.length === 3, '水化返回全班 3 名学员名册');

  const itemA = roster.find((r) => r.studentId === studentA.id);
  const itemB = roster.find((r) => r.studentId === studentB.id);
  const itemC = roster.find((r) => r.studentId === studentC.id);

  console.log('itemC:', itemC);
  assert(itemA && itemA.attendanceStatus === 'present', '学员 A 考勤为 present 到课');
  assert(itemC && itemC.attendanceStatus === 'leave', '学员 C 考勤为 leave 请假');
  assert(itemC && itemC.isExempt === true, '【客诉防腐门禁生效】学员 C 自动标记为 isExempt=true 请假免评');
  assert(!itemA.isEvaluated && !itemB.isEvaluated, '初始状态下两端课评均处于未评价状态');

  console.log('\n--- [阶段 2: 录入学员专属实操视频与照片并发布] ---');
  const customVideoUrlA = 'https://cdn.yixiao.com/videos/student-a-drone-demo.mp4';
  const customPhotosA = ['https://cdn.yixiao.com/photos/student-a-p1.jpg', 'https://cdn.yixiao.com/photos/student-a-p2.jpg'];
  const customCommentA = '小明今天无人机穿越避障算法编写极其规范，展现了优秀的工程素养！';

  const customCommentB = '小华今天耐心排查了循环传感器故障，动手能力显著增强！';

  const commitRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/lesson-evaluations/commit',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: scheduleEvent.id,
      publish: true,
      dispatchStrategy: 'ATTENDED_ONLY',
      payload: {
        templateId: 'tmpl-common',
        templateName: '通用课评模板',
        lessonTitle: '无人机避障算法实战',
        studyContentHtml: '本节课重点掌握PID循迹与超声波测距算法',
        overallRating: 5.0,
        teacherComment: '全班教学进展顺利',
        studentOverrides: [
          {
            studentId: studentA.id,
            personalizedComment: customCommentA,
            rating: 5.0,
            performanceTag: '动手达人',
            videoUrl: customVideoUrlA,
            photos: customPhotosA,
            isEvaluated: true,
          },
          {
            studentId: studentB.id,
            personalizedComment: customCommentB,
            rating: 4.5,
            performanceTag: '逻辑缜密',
            isEvaluated: true,
          },
        ],
      },
    },
  );

  assert(commitRes.status === 200 || commitRes.status === 201, '课评提交发布成功 (HTTP 200)');

  console.log('\n--- [阶段 3: 数据库物理持久化断言与资产私有化] ---');
  const studentItemA = await prisma.lessonEvaluationStudentItem.findFirst({
    where: { studentId: studentA.id },
  });
  assert(!!studentItemA, '数据库落盘学员 A 的 LessonEvaluationStudentItem 实体');
  assert(studentItemA.isEvaluated === true, '学员 A 权威评定状态确认落盘为 isEvaluated=true');
  assert(studentItemA.videoUrl === customVideoUrlA, '学员 A 专属实操视频独立落盘');
  assert(studentItemA.comment === customCommentA, '学员 A 专属个性化评语独立落盘');
  const parsedPhotosA = JSON.parse(studentItemA.photos || '[]');
  assert(parsedPhotosA.length === 2 && parsedPhotosA[0] === customPhotosA[0], '学员 A 专属照片列表物理隔离存储');

  const studentItemB = await prisma.lessonEvaluationStudentItem.findFirst({
    where: { studentId: studentB.id },
  });
  assert(studentItemB && studentItemB.isEvaluated === true, '学员 B 权威评定状态确认为 isEvaluated=true');
  assert(!studentItemB.videoUrl, '【资产私有化核心断言】学员 B 绝无学员 A 的视频 URL，实现 100% 独立隔离！');

  console.log('\n--- [阶段 4: 双端实时互通一致性断言 (模拟移动端刷新查看)] ---');
  const secondHydrate = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/lesson-evaluations/workbench/${scheduleEvent.id}`,
    method: 'GET',
    headers: authHeaders,
  });

  assert(secondHydrate.status === 200, '二次水化接口调用正常');
  const secondRoster = secondHydrate.body?.data?.roster || [];
  const secondA = secondRoster.find((r) => r.studentId === studentA.id);
  const secondB = secondRoster.find((r) => r.studentId === studentB.id);
  const secondC = secondRoster.find((r) => r.studentId === studentC.id);

  assert(secondA && secondA.isEvaluated === true, '【移动端回显一致】学员 A 在新端查询即刻回显为 isEvaluated=true');
  assert(secondA.videoUrl === customVideoUrlA, '【移动端多媒体一致】学员 A 在新端准确带出其专属实操视频');
  assert(secondB && secondB.isEvaluated === true, '【移动端回显一致】学员 B 在新端查询即刻回显为 isEvaluated=true');
  assert(secondC && secondC.isExempt === true, '学员 C 始终保持 isExempt=true 请假免评');

  console.log('\n--- [阶段 5: 出站信箱与防客诉断言 (绝不向请假学员推送)] ---');
  const outboxMessages = await prisma.lessonEvaluationOutbox.findMany({
    where: { studentId: { in: [studentA.id, studentB.id, studentC.id] } },
  });

  const studentAOutbox = outboxMessages.find((m) => m.studentId === studentA.id);
  const studentBOutbox = outboxMessages.find((m) => m.studentId === studentB.id);
  const studentCOutbox = outboxMessages.find((m) => m.studentId === studentC.id);

  assert(!!studentAOutbox, '实到学员 A 成功排队出站微信推送');
  assert(!!studentBOutbox, '实到学员 B 成功排队出站微信推送');
  assert(!studentCOutbox, '【零客诉核心断言】请假学员 C 处于免评状态，严格杜绝向其家长发送任何微信通知！');

  console.log('\n--- [清理测试临时数据] ---');
  await prisma.lessonEvaluationOutbox.deleteMany({
    where: { studentId: { in: [studentA.id, studentB.id, studentC.id] } },
  });
  await prisma.lessonEvaluationRevision.deleteMany({
    where: { evaluation: { scheduleEventId: scheduleEvent.id } },
  });
  await prisma.lessonEvaluationStudentItem.deleteMany({
    where: { studentId: { in: [studentA.id, studentB.id, studentC.id] } },
  });
  await prisma.lessonEvaluation.deleteMany({
    where: { scheduleEventId: scheduleEvent.id },
  });
  await prisma.attendanceRecord.deleteMany({
    where: { scheduleEventId: scheduleEvent.id },
  });
  await prisma.scheduleEvent.delete({
    where: { id: scheduleEvent.id },
  });
  await prisma.studentCoursePackage.deleteMany({
    where: { studentId: { in: [studentA.id, studentB.id, studentC.id] } },
  });
  await prisma.class.delete({
    where: { id: testClass.id },
  });
  await prisma.student.deleteMany({
    where: { id: { in: [studentA.id, studentB.id, studentC.id] } },
  });

  console.log('  ✓ 测试数据已完全安全清理');

  console.log('\n================================================================================');
  console.log('🎉 恭喜！学员专属课评矩阵与双端实时互通全链路集成测试全部 PASS！');
  console.log('================================================================================');
}

runTests()
  .catch((e) => {
    console.error('测试执行异常:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
