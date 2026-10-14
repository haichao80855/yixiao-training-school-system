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
  console.log('学情成长投影深模块（LearningGrowthProjector）高可靠专项集成验证套件');
  console.log('覆盖：随堂点名消课原子性、财务防腐屏障 (ACB) 退费强阻断、权威学情投影、五维雷达与 SSOT 预警');
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

  // 1. 登录超管获取 Token
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

  // 2. 准备基础数据
  const campus = await prisma.campus.findFirst({ where: { status: 'active' } }) || await prisma.campus.findFirst();
  assert(!!campus, '数据库存在测试校区');

  const teacher = await prisma.user.findFirst({
    where: { campusId: campus.id, userRoles: { some: { role: { code: 'teacher' } } } },
  }) || await prisma.user.findFirst();
  assert(!!teacher, '校区存在授课讲师');

  const classroom = await prisma.classroom.findFirst({ where: { campusId: campus.id } }) || await prisma.classroom.findFirst();
  assert(!!classroom, '校区存在上课教室');

  const course = await prisma.course.findFirst({ where: { status: 'enabled' } }) || await prisma.course.findFirst();
  assert(!!course, '存在有效授课课程');

  const uniqueSuffix = Date.now().toString().slice(-6);

  // 3. 创建测试实体班级与学员
  const testClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `学情深模块测试班-${uniqueSuffix}`,
      code: `CLS-GROWTH-${uniqueSuffix}`,
      capacity: 10,
      currentStudentCount: 0,
      status: 'in_progress',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
    },
  });
  assert(!!testClass.id, `成功创建测试班级 [${testClass.name}]`);

  const studentNo = `S${Date.now().toString().slice(-6)}`;
  const testStudent = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo,
      name: `学情测试学员-${uniqueSuffix}`,
      gender: 'male',
      phone: `138${Date.now().toString().slice(-8)}`,
      status: 'normal',
    },
  });
  assert(!!testStudent.id, `成功创建测试学员 [${testStudent.name}]`);

  // 4. 创建签约课包：实缴 16 课时，赠送 4 课时，总计 20 课时
  const testPkg = await prisma.studentCoursePackage.create({
    data: {
      studentId: testStudent.id,
      courseId: course.id,
      classId: testClass.id,
      totalLessons: 20,
      remainingLessons: 20,
      consumedLessons: 0,
      bonusLessons: 4,
      status: 'active',
    },
  });
  assert(!!testPkg.id, '成功创建测试学员课包 (实缴 16，赠送 4，总计 20 课时)');

  // 5. 创建实体排课日程
  const testSchedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-14',
      startTime: '10:00',
      endTime: '11:30',
      status: 'scheduled',
      semanticType: 'regular',
      classType: 'formal',
    },
  });
  assert(!!testSchedule.id, '成功创建排课日程 (ID: ' + testSchedule.id + ')');

  // ===========================================================================
  // 测试环节 1: 随堂点名消课工步 (settleRollCall) 与 正课优先扣减 (Regular-First)
  // ===========================================================================
  console.log('\n--- [Test Phase 1] 随堂点名消课工步与 Regular-First 正赠课时扣减 ---');

  const rollCallRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/attendances/roll-call',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: testSchedule.id,
      items: [
        {
          studentId: testStudent.id,
          status: 'present',
          deductLessons: 2,
          comment: '逻辑清晰，算法思维活跃，当堂实操表现卓越',
          score: 95,
          rating: 'A+',
        },
      ],
    },
  );
  assert(rollCallRes.status === 200 || rollCallRes.status === 201, '随堂点名消课接口响应成功');

  // 校验数据库考勤落库
  const attendanceInDb = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: testSchedule.id, studentId: testStudent.id },
  });
  assert(!!attendanceInDb, '考勤记录正确落盘数据库');
  assert(attendanceInDb.score === 95, '考勤测验打分 95 正确记录');
  assert(attendanceInDb.rating === 'A+', '考勤综合评级 A+ 正确记录');
  assert(attendanceInDb.regularBurned === 2 && attendanceInDb.bonusBurned === 0, '符合正课优先原则: 优先消耗实缴正课 2 课时');
  assert(attendanceInDb.isReversed === false, '考勤记录初始状态 isReversed === false');

  // 校验课包余额
  const pkgAfterRollCall = await prisma.studentCoursePackage.findUnique({
    where: { id: testPkg.id },
  });
  assert(pkgAfterRollCall.remainingLessons === 18, '课包剩余课时正确扣减为 18 课时');
  assert(pkgAfterRollCall.consumedLessons === 2, '课包已消耗课时正确递增为 2 课时');

  // ===========================================================================
  // 测试环节 2: 权威学情成长档案画像投影 (projectLearningPortfolio)
  // ===========================================================================
  console.log('\n--- [Test Phase 2] 学员 360° 学情成长档案画像投影验证 ---');

  const portfolioRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/students/${testStudent.id}/learning-portfolio`,
      method: 'GET',
      headers: authHeaders,
    },
  );
  assert(portfolioRes.status === 200, '学情成长画像只读投影端点返回 200 OK');
  const portfolio = portfolioRes.body?.data || portfolioRes.body;
  assert(portfolio.studentInfo?.id === testStudent.id, '学情画像准确匹配学员基本信息');
  assert(Array.isArray(portfolio.timeline) && portfolio.timeline.length === 1, '学情时间轴 timeline 正确折叠 1 条随堂节点');
  assert(Array.isArray(portfolio.learningRecords) && portfolio.learningRecords.length === 1, '向下兼容别名 learningRecords 长度完全一致 (彻底消除假降级)');
  
  const timelineItem = portfolio.timeline[0];
  assert(timelineItem.score === 95, '学情时间轴节点得分 95');
  assert(timelineItem.rating === 'A+', '学情时间轴节点评级 A+');
  assert(timelineItem.teacherName === teacher.realName, `学情时间轴展示真实讲师实名 [${teacher.realName}]`);
  assert(timelineItem.classroomName === classroom.name, `学情时间轴展示真实教室 [${classroom.name}]`);

  // 校验五维能力雷达
  const radar = portfolio.growthSummary?.radar;
  assert(!!radar, '五维能力星级雷达正确计算生成');
  assert(radar.averageScore === 95, '五维能力雷达综合均分准确折算为 95');

  // 校验单一真值源 (SSOT) 课消健康度
  const health = portfolio.consumptionHealth;
  assert(!!health, '课消健康度单一真值源 SSOT 成功导出');
  assert(health.weeklyBurnRate >= 0, '周均消课速率计算正常');
  assert(health.warningLevel === 'normal', '18 课时判定为健康充裕 normal 级别');

  // 校验学员中心全景画像接口是否自动透出学情资产
  const profileRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${testStudent.id}/profile`,
      method: 'GET',
      headers: authHeaders,
    },
  );
  assert(profileRes.status === 200, '学员详情全景 profile 端点返回 200 OK');
  const profile = profileRes.body?.data || profileRes.body;
  assert(Array.isArray(profile.learningRecords) && profile.learningRecords.length === 1, '学员 Profile 中的 learningRecords 直接包含真实学情 (不再恒空)');
  assert(profile.growthRadar?.averageScore === 95, '学员 Profile 中的五维雷达 growthRadar 正常透出');
  assert(profile.consumptionHealth?.warningLevel === 'normal', '学员 Profile 中的消课健康度 consumptionHealth 统一对齐');

  // ===========================================================================
  // 测试环节 3: 核心财务防腐屏障 (ACB) 退费锁定强制阻断 (RefundLocked Guard)
  // ===========================================================================
  console.log('\n--- [Test Phase 3] 财务防腐屏障 (ACB) 退费课包锁定强阻断验证 ---');

  // 模拟业务场景：学员家长办理退费，财务已审核通过，课包被标记为 refunded
  await prisma.studentCoursePackage.update({
    where: { id: testPkg.id },
    data: { status: 'refunded' },
  });

  // 尝试反结课冲正已退费课包所属日程
  const reverseBlockedRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/schedules/${testSchedule.id}/reverse`,
      method: 'POST',
      headers: authHeaders,
    },
    { reason: '教师误操作点名，尝试反结课' },
  );

  assert(
    reverseBlockedRes.status === 409 || reverseBlockedRes.status === 400 || (reverseBlockedRes.body?.message && reverseBlockedRes.body.message.includes('退费')),
    '反结课冲正遭遇已退费课包，触发财务防腐屏障 (ACB) 强阻断 (409 Conflict / 业务拦截)',
  );

  // 严格断言课包状态：绝未被恶意或误复活为 active
  const pkgAfterBlocked = await prisma.studentCoursePackage.findUnique({
    where: { id: testPkg.id },
  });
  assert(pkgAfterBlocked.status === 'refunded', '防腐风控生效：已退费课包状态保持 refunded，绝对没有非法复活！');

  // ===========================================================================
  // 测试环节 4: 正常课包反结课冲正与防重放 (Anti-Replay)
  // ===========================================================================
  console.log('\n--- [Test Phase 4] 正常课包反结课冲正工步与防重放幂等校验 ---');

  // 将课包状态调整为正常 active
  await prisma.studentCoursePackage.update({
    where: { id: testPkg.id },
    data: { status: 'active' },
  });

  // 执行反结课冲正
  const reverseSuccessRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/schedules/${testSchedule.id}/reverse`,
      method: 'POST',
      headers: authHeaders,
    },
    { reason: '教师调课排错，教务主管审核反结课' },
  );
  assert(reverseSuccessRes.status === 200 || reverseSuccessRes.status === 201, '正常课包反结课冲正成功');

  // 校验数据库课时原路退还
  const pkgAfterReversed = await prisma.studentCoursePackage.findUnique({
    where: { id: testPkg.id },
  });
  assert(pkgAfterReversed.remainingLessons === 20, '2 课时精准原路退还，课包恢复为 20 课时');
  assert(pkgAfterReversed.consumedLessons === 0, '已消耗课时正确回滚为 0');

  // 校验考勤记录冲正标记
  const attendanceAfterReversed = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: testSchedule.id, studentId: testStudent.id },
  });
  assert(attendanceAfterReversed.isReversed === true, '考勤记录标记 isReversed === true');
  assert(!!attendanceAfterReversed.reversedAt, '记录反结课时间戳');

  // 防重放测试：对同一日程再次反结课，必须拒绝
  const replayRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/schedules/${testSchedule.id}/reverse`,
      method: 'POST',
      headers: authHeaders,
    },
    { reason: '重复反结课尝试' },
  );
  assert(
    replayRes.status === 400 || (replayRes.body?.message && replayRes.body.message.includes('未找到可冲正')),
    '防重放安全机制：重复反结课被拦截拒绝 (HTTP 400)',
  );

  // 反结课后学情画像只读投影中，冲正记录被清晰标记且不计入有效出勤
  const portfolioAfterReverseRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/students/${testStudent.id}/learning-portfolio`,
      method: 'GET',
      headers: authHeaders,
    },
  );
  const portfolioAfterRev = portfolioAfterReverseRes.body?.data || portfolioAfterReverseRes.body;
  assert(portfolioAfterRev.growthSummary.totalAttendedSessions === 0, '冲正后的课次从有效出勤总次数中排除');

  // ===========================================================================
  // 测试环节 5: 消课流失预警单一真值源 (SSOT) 阶梯阈值校验
  // ===========================================================================
  console.log('\n--- [Test Phase 5] 消课流失预警阶梯阈值 (urgent <= 4, warning <= 8) 验证 ---');

  // 模拟剩余 8 课时 -> warning
  await prisma.studentCoursePackage.update({
    where: { id: testPkg.id },
    data: { remainingLessons: 8 },
  });
  const portWarning = (await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/students/${testStudent.id}/learning-portfolio`,
      method: 'GET',
      headers: authHeaders,
    },
  )).body?.data || (await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/students/${testStudent.id}/learning-portfolio`,
      method: 'GET',
      headers: authHeaders,
    },
  )).body;
  assert(portWarning.consumptionHealth?.warningLevel === 'warning', '剩余 8 课时准确触发 warning 预警级别');
  assert(portWarning.consumptionHealth?.renewalWindowOpen === true, '剩余 8 课时准确判定进入续费跟进黄金窗口');

  // 模拟剩余 3 课时 -> urgent
  await prisma.studentCoursePackage.update({
    where: { id: testPkg.id },
    data: { remainingLessons: 3 },
  });
  const portUrgent = (await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/students/${testStudent.id}/learning-portfolio`,
      method: 'GET',
      headers: authHeaders,
    },
  )).body?.data || (await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/students/${testStudent.id}/learning-portfolio`,
      method: 'GET',
      headers: authHeaders,
    },
  )).body;
  assert(portUrgent.consumptionHealth?.warningLevel === 'urgent', '剩余 3 课时准确触发 urgent 紧急续费级别');

  // ===========================================================================
  // 数据清理
  // ===========================================================================
  console.log('\n--- 清理测试临时数据 ---');
  await prisma.attendanceRecord.deleteMany({ where: { scheduleEventId: testSchedule.id } });
  await prisma.scheduleEvent.deleteMany({ where: { id: testSchedule.id } });
  await prisma.studentCoursePackage.deleteMany({ where: { id: testPkg.id } });
  await prisma.student.deleteMany({ where: { id: testStudent.id } });
  await prisma.class.deleteMany({ where: { id: testClass.id } });
  console.log('✓ 测试数据已完全安全清理');

  console.log(`\n================================================================================`);
  console.log(`🎉 恭喜！学情成长投影深模块全部 ${total} 项核心风控与学情断言 100% 绿色通过！`);
  console.log(`================================================================================\n`);
}

runTests()
  .catch((e) => {
    console.error('测试运行异常:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
