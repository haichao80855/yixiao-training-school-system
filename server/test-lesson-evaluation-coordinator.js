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
  console.log('课评工作台协调器（LessonEvaluationCoordinator）全链路闭环与推送专项集成验证');
  console.log('覆盖：极简流线水化、草稿暂存、正式发布、SHA-256防篡改指纹、考勤双向原子渗透、');
  console.log('      ADR-0005学情雷达激活、Transactional Outbox信箱派发、跨校区风控隔离');
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

  // 1. 登录系统获取凭证
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

  // 2. 准备基础依赖实体
  const campus = await prisma.campus.findFirst({ where: { status: 'active' } }) || await prisma.campus.findFirst();
  assert(!!campus, '数据库存在有效测试校区');

  const otherCampus = await prisma.campus.findFirst({
    where: { id: { not: campus.id } }
  });

  const teacher = await prisma.user.findFirst({
    where: { campusId: campus.id, userRoles: { some: { role: { code: 'teacher' } } } },
  }) || await prisma.user.findFirst();
  assert(!!teacher, '校区存在授课讲师');

  const classroom = await prisma.classroom.findFirst({ where: { campusId: campus.id } }) || await prisma.classroom.findFirst();
  assert(!!classroom, '校区存在测试教室');

  // 寻找或创建一个 Scratch 课程，以便验证大纲智能水化
  let course = await prisma.course.findFirst({ where: { subject: 'scratch' } });
  if (!course) {
    course = await prisma.course.findFirst({ where: { status: 'enabled' } }) || await prisma.course.findFirst();
  }
  assert(!!course, '存在有效测试课程');

  const uniqueSuffix = Date.now().toString().slice(-6);

  // 3. 创建测试班级
  const testClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `课评协调器测试班-${uniqueSuffix}`,
      code: `CLS-EVAL-${uniqueSuffix}`,
      capacity: 10,
      currentStudentCount: 2,
      status: 'in_progress',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2027-06-30'),
    },
  });
  assert(!!testClass.id, `成功创建测试班级 [${testClass.name}]`);

  // 4. 创建两名学员：学员A绑定微信公众号，学员B未绑定微信
  const studentA = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `S_EVAL_A_${uniqueSuffix}`,
      name: `课评学员A-已绑微信-${uniqueSuffix}`,
      gender: 'male',
      phone: `138${Date.now().toString().slice(-8)}`,
      wechatOpenId: `wx_mock_open_id_eval_a_${uniqueSuffix}`,
      status: 'normal',
    },
  });
  const studentB = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `S_EVAL_B_${uniqueSuffix}`,
      name: `课评学员B-未绑微信-${uniqueSuffix}`,
      gender: 'female',
      phone: `139${Date.now().toString().slice(-8)}`,
      wechatOpenId: null,
      status: 'normal',
    },
  });
  assert(!!studentA.id && !!studentB.id, '成功创建测试学员A(已绑微信)与学员B(未绑微信)');

  // 5. 创建课包以便支持学情雷达与消课
  const testPkgA = await prisma.studentCoursePackage.create({
    data: {
      studentId: studentA.id,
      courseId: course.id,
      classId: testClass.id,
      totalLessons: 20,
      remainingLessons: 18,
      consumedLessons: 2,
      bonusLessons: 0,
      status: 'active',
    },
  });

  // 6. 创建排课日程并写入 2 条已有点名考勤
  const testSchedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-14',
      startTime: '14:00',
      endTime: '15:30',
      status: 'scheduled',
      semanticType: 'regular',
      classType: 'formal',
    },
  });
  assert(!!testSchedule.id, `成功创建测试排课日程 (ID: ${testSchedule.id})`);

  // 插入考勤记录：A 到课，B 缺勤
  const recordA = await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: testSchedule.id,
      studentId: studentA.id,
      packageId: testPkgA.id,
      status: 'present',
      deductLessons: 1,
      comment: '初始随堂评语',
      rating: 'A',
      score: 80,
      operator: '任课教师',
    },
  });
  const recordB = await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: testSchedule.id,
      studentId: studentB.id,
      status: 'absent',
      deductLessons: 0,
      comment: null,
      rating: null,
      score: null,
      operator: '任课教师',
    },
  });
  assert(!!recordA.id && !!recordB.id, '成功为排课预置学员A(到课)与学员B(缺勤)随堂考勤记录');

  // ===========================================================================
  // 测试用例 1: 极简工作台流线智能水化 (hydrateEvaluation)
  // ===========================================================================
  console.log('\n--- [Test Phase 1] 极简工作台流线智能水化 (hydrateEvaluation) ---');
  const hydrateRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/lesson-evaluations/workbench/${testSchedule.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(hydrateRes.status === 200, '工作台水化接口返回 200 OK');
  const hydrated = hydrateRes.body?.data || hydrateRes.body;
  assert(hydrated.schedule.id === testSchedule.id, '水化返回的日程 ID 准确匹配');
  assert(hydrated.evaluation.isExisting === false, '首次打开课评返回 isExisting === false (未落盘草稿)');
  assert(typeof hydrated.evaluation.studyContentHtml === 'string' && hydrated.evaluation.studyContentHtml.length > 0, '课评内容自动水化出课程大纲知识点');
  assert(Array.isArray(hydrated.roster) && hydrated.roster.length === 2, '花名册准确水化出 2 名参课学员');

  const rosterA = hydrated.roster.find((r) => r.studentId === studentA.id);
  const rosterB = hydrated.roster.find((r) => r.studentId === studentB.id);
  assert(rosterA && rosterA.attendanceStatus === 'present' && rosterA.isWechatBound === true, '学员A水化画像识别: 到课状态 present, 绑定微信 true');
  assert(rosterB && rosterB.attendanceStatus === 'absent' && rosterB.isWechatBound === false, '学员B水化画像识别: 缺勤状态 absent, 绑定微信 false');
  assert(hydrated.summary.totalEnrolled === 2 && hydrated.summary.attendedCount === 1 && hydrated.summary.wechatBoundCount === 1, '花名册统计透视汇总指标准确');

  // ===========================================================================
  // 测试用例 2: 暂存草稿 (Commit Draft) 与信箱静默保护
  // ===========================================================================
  console.log('\n--- [Test Phase 2] 暂存草稿 (Commit Draft) 与信箱静默保护 ---');
  const draftPayload = {
    scheduleEventId: testSchedule.id,
    campusId: campus.id,
    publish: false,
    payload: {
      lessonTitle: '图形化克隆体与粒子效果设计实战',
      studyContentHtml: '<p>本堂课深入探索克隆体的生命周期管理与坐标映射算法。</p>',
      overallRating: 5,
      teacherComment: '全体学员课堂纪律优良，踊跃参与互动探索',
      videoUrl: 'https://cdn.example.com/videos/lesson-1014.mp4',
      photoList: [
        'https://cdn.example.com/photos/shot-1.jpg',
        'https://cdn.example.com/photos/shot-2.jpg',
      ],
      studentOverrides: [
        {
          studentId: studentA.id,
          rating: 5,
          personalizedComment: '学员A思维敏捷，不仅完成了粒子爆炸，还自主添加了重力加速度衰减！',
        },
        {
          studentId: studentB.id,
          rating: 3,
          personalizedComment: '因事缺课，课后请参照讲义自主练习。',
        },
      ],
    },
  };

  const draftRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/lesson-evaluations/commit',
      method: 'POST',
      headers: authHeaders,
    },
    draftPayload,
  );
  assert(draftRes.status === 200 || draftRes.status === 201, '暂存草稿接口调用成功');
  const draftReceipt = draftRes.body?.data || draftRes.body;
  assert(draftReceipt.status === 'draft', '回执状态为 draft');
  assert(draftReceipt.scheduleEventId === testSchedule.id, '回执关联日程 ID 准确匹配');

  // 校验数据库中 LessonEvaluation 状态
  const evalInDb = await prisma.lessonEvaluation.findUnique({
    where: { scheduleEventId: testSchedule.id },
    include: { studentItems: true, revisions: true, outboxMessages: true },
  });
  assert(!!evalInDb && evalInDb.status === 'draft', '数据库 LessonEvaluation 正确持久化且状态为 draft');
  assert(evalInDb.studentItems.length === 2, '数据库准确持久化 2 项学员个性化评语');
  assert(evalInDb.revisions.length === 0, '草稿态未产生不可变发布修订快照');
  assert(evalInDb.outboxMessages.length === 0, '草稿状态严格保持出站信箱为空，杜绝打扰家长');

  // ===========================================================================
  // 测试用例 3: 正式发布、不可变 SHA-256 数据指纹与排课状态更新
  // ===========================================================================
  console.log('\n--- [Test Phase 3] 正式发布、SHA-256 不可变指纹与排课关联 ---');
  const publishPayload = {
    ...draftPayload,
    publish: true,
    dispatchStrategy: 'ATTENDED_ONLY', // 仅推送给到课学员
    payload: {
      ...draftPayload.payload,
      lessonTitle: '图形化克隆体与粒子效果设计实战（正式版）',
      studentOverrides: [
        {
          studentId: studentA.id,
          rating: 5,
          personalizedComment: '学员A思维极其敏捷，不仅完成了粒子爆炸，还自主添加了重力加速度衰减！表现评级 A+。',
        },
        {
          studentId: studentB.id,
          rating: 3,
          personalizedComment: '缺席请按回放补课。',
        },
      ],
    },
  };

  const publishRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/lesson-evaluations/commit',
      method: 'POST',
      headers: authHeaders,
    },
    publishPayload,
  );
  assert(publishRes.status === 200 || publishRes.status === 201, '正式发布课评调用成功');
  const publishReceipt = publishRes.body?.data || publishRes.body;
  assert(publishReceipt.status === 'published', '回执状态为 published');
  assert(publishReceipt.revisionNumber === 1, '首次发布生成修订快照版本号 1');
  assert(
    typeof publishReceipt.fingerprint === 'string' &&
      /^[a-f0-9]{64}$/.test(publishReceipt.fingerprint),
    `正确计算并返回 64 位 SHA-256 不可变数据指纹 [${publishReceipt.fingerprint.slice(0, 16)}...]`,
  );

  // 校验排课日程上级联关联
  const scheduleAfterPublish = await prisma.scheduleEvent.findUnique({
    where: { id: testSchedule.id },
    include: { evaluation: true },
  });
  assert(
    scheduleAfterPublish?.evaluation?.status === 'published',
    '排课日程通过级联外键准确关联至 published 课评',
  );

  // ===========================================================================
  // 测试用例 4: 考勤双向原子渗透与激活 ADR-0005 学情雷达
  // ===========================================================================
  console.log('\n--- [Test Phase 4] 考勤双向原子渗透与 ADR-0005 学情雷达激活 ---');
  const attAfterSync = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: testSchedule.id, studentId: studentA.id },
  });
  assert(!!attAfterSync, '查得学员A的随堂考勤记录');
  assert(
    attAfterSync.comment ===
      '学员A思维极其敏捷，不仅完成了粒子爆炸，还自主添加了重力加速度衰减！表现评级 A+。',
    '考勤记录评语 (comment) 成功被课评原子写回',
  );
  assert(attAfterSync.rating === 'A+', '考勤记录等第 rating 正确写回为 A+');
  assert(attAfterSync.score === 98, '考勤记录百分制 score 自动折算写回为 98');

  // 调用学情成长投影接口验证真实数据激活
  const portfolioRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/students/${studentA.id}/learning-portfolio`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(portfolioRes.status === 200, '读取学员 360° 学情成长档案接口返回 200 OK');
  const portfolio = portfolioRes.body?.data || portfolioRes.body;
  assert(
    Array.isArray(portfolio.timeline) && portfolio.timeline.length > 0,
    '学情雷达成长足迹时间轴列表非空',
  );
  const foundComment = portfolio.timeline.find((c) =>
    c.comment.includes('重力加速度衰减'),
  );
  assert(!!foundComment, '学情档案足迹成功投影出课评最新评语，杜绝了空白降级！');
  assert(
    portfolio.growthSummary?.radar?.averageScore === 98,
    '学情五维雷达评分准确关联随堂折算得分 98 分',
  );
  assert(
    portfolio.growthSummary?.ratingDistribution?.aPlusCount >= 1,
    '学情等第分布准确记录 A+ 卓越表现',
  );

  // ===========================================================================
  // 测试用例 5: 事务性出站信箱 (Transactional Outbox) 派发
  // ===========================================================================
  console.log('\n--- [Test Phase 5] 事务性出站信箱与通知派发 ---');
  const outboxes = await prisma.lessonEvaluationOutbox.findMany({
    where: { evaluationId: evalInDb.id },
  });
  assert(outboxes.length === 1, '根据 strategy: ATTENDED_ONLY，精准为到课且已绑微信的学员A生成 1 条出站记录');
  const outboxA = outboxes[0];
  assert(outboxA.studentId === studentA.id, '出站记录归属学员A');
  assert(outboxA.recipientTarget === studentA.wechatOpenId, '出站记录目标微信 OpenID 正确无误');
  assert(outboxA.channel === 'wechat_template', '通知通道为微信公众号模板消息');
  assert(
    outboxA.status === 'sent' || outboxA.status === 'pending',
    `出站信箱状态为 [${outboxA.status}] (MockAdapter 派发)`,
  );

  // ===========================================================================
  // 测试用例 6: 详情再次水化回填一致性验证
  // ===========================================================================
  console.log('\n--- [Test Phase 6] 详情再次水化回填一致性验证 ---');
  const rehydrateRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/lesson-evaluations/workbench/${testSchedule.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(rehydrateRes.status === 200, '二次请求课评水化接口正常');
  const rehydrated = rehydrateRes.body?.data || rehydrateRes.body;
  assert(rehydrated.evaluation.isExisting === true, '二次打开识别为已存在课评 (isExisting: true)');
  assert(rehydrated.evaluation.status === 'published', '状态保持为 published');
  assert(rehydrated.evaluation.videoUrl === 'https://cdn.example.com/videos/lesson-1014.mp4', '视频链接持久化一致');
  assert(rehydrated.evaluation.photoList.length === 2, '相册照片数组一致');

  // ===========================================================================
  // 测试用例 7: 跨校区隔离风控与异常阻断
  // ===========================================================================
  console.log('\n--- [Test Phase 7] 跨校区隔离风控与已取消排课保护 ---');
  if (otherCampus) {
    // 创建一个从属于 otherCampus 的日程
    const otherSchedule = await prisma.scheduleEvent.create({
      data: {
        campusId: otherCampus.id,
        classId: testClass.id,
        teacherId: teacher.id,
        classroomId: classroom.id,
        date: '2026-10-15',
        startTime: '10:00',
        endTime: '11:30',
        status: 'scheduled',
      },
    });

    // 模拟非超管/携带原校区 campusId 访问该异构日程
    const crossCampusRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/educational/lesson-evaluations/commit',
        method: 'POST',
        headers: {
          ...authHeaders,
          // 模拟指定当前校区为原 campus.id
          'X-Campus-Id': campus.id,
        },
      },
      {
        scheduleEventId: otherSchedule.id,
        campusId: campus.id, // 与 otherSchedule.campusId 不一致
        publish: false,
        payload: { lessonTitle: '越权课评测试', studyContentHtml: '<p>test</p>' },
      },
    );
    // 超管 token 在某些体系下可越权，但我们内部校验了 schedule.campusId !== command.campusId
    assert(
      crossCampusRes.status === 400 || crossCampusRes.status === 403 || crossCampusRes.body?.code === 403,
      '跨校区越权篡改课评被安全阻断',
    );

    await prisma.scheduleEvent.delete({ where: { id: otherSchedule.id } });
    console.log('  ✓ 跨校区风控探测通过');
  } else {
    console.log('  - 单校区环境，跳过物理跨校区测试');
  }

  // 测试已取消日程保护
  const cancelledSchedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-16',
      startTime: '10:00',
      endTime: '11:30',
      status: 'cancelled',
    },
  });

  const cancelledRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/lesson-evaluations/workbench/${cancelledSchedule.id}`,
      method: 'GET',
      headers: authHeaders,
    },
  );
  assert(
    cancelledRes.status === 400 || cancelledRes.body?.statusCode === 400,
    '对已取消排课打开课评被严格拒绝 (ScheduleCancelledException)',
  );
  await prisma.scheduleEvent.delete({ where: { id: cancelledSchedule.id } });

  // ===========================================================================
  // 测试数据安全清理
  // ===========================================================================
  console.log('\n--- 清理测试临时数据 ---');
  await prisma.lessonEvaluationOutbox.deleteMany({ where: { evaluationId: evalInDb.id } });
  await prisma.lessonEvaluationRevision.deleteMany({ where: { evaluationId: evalInDb.id } });
  await prisma.lessonEvaluationStudentItem.deleteMany({ where: { evaluationId: evalInDb.id } });
  await prisma.lessonEvaluation.deleteMany({ where: { id: evalInDb.id } });
  await prisma.attendanceRecord.deleteMany({ where: { scheduleEventId: testSchedule.id } });
  await prisma.scheduleEvent.deleteMany({ where: { id: testSchedule.id } });
  await prisma.studentCoursePackage.deleteMany({ where: { id: testPkgA.id } });
  await prisma.student.deleteMany({ where: { id: { in: [studentA.id, studentB.id] } } });
  await prisma.class.deleteMany({ where: { id: testClass.id } });
  console.log('✓ 测试数据已完全安全清理');

  console.log(`\n================================================================================`);
  console.log(`🎉 恭喜！课评工作台协调器全部 ${total} 项核心领域断言 100% 绿色通过！`);
  console.log(`================================================================================\n`);
}

runTests()
  .catch((e) => {
    console.error('测试运行异常:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
