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
  console.log('================================================================');
  console.log('拓视未来教育「一校教培系统」课消结算引擎（LessonSettlementEngine）');
  console.log('精准课包扣减、正赠课时明细、防重放反结课与看板聚合专项验证套件');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;
  function assert(condition, desc) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS [${passed}]: ${desc}`);
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
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
  const token = loginRes.body.data.accessToken;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const campus = await prisma.campus.findFirst({ where: { status: 'active' } });
  assert(!!campus, '数据库存在测试校区');

  const teacher = await prisma.user.findFirst({
    where: { campusId: campus.id, userRoles: { some: { role: { code: 'teacher' } } } },
  });
  assert(!!teacher, '校区存在授课讲师');

  const classroom = await prisma.classroom.findFirst({ where: { campusId: campus.id } });
  assert(!!classroom, '校区存在可用教学教室');

  const course = await prisma.course.findFirst({ where: { status: 'enabled' } }) || await prisma.course.findFirst();
  assert(!!course, '存在有效教学课程');

  const uniqueSuffix = Date.now().toString().slice(-6);

  // 2. 创建测试实体班级与学员
  const testClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `课消引擎测试班级-${uniqueSuffix}`,
      code: `CLS-SETTLE-${uniqueSuffix}`,
      capacity: 15,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-01-31'),
      status: 'in_progress',
    },
  });

  const testStudent = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `STU-SET-${uniqueSuffix}`,
      name: `测试学员-${uniqueSuffix}`,
      gender: 'male',
      phone: `139${uniqueSuffix}99`,
      status: 'in_class',
    },
  });

  // 3. 为学员创建两张同课程的不同课包 (用于验证精准课包扣减，彻底杜绝模糊匹配跨课包串账)
  // 课包 A: 10 课时 (正课 8, 赠课 2)
  const pkgA = await prisma.studentCoursePackage.create({
    data: {
      studentId: testStudent.id,
      courseId: course.id,
      classId: testClass.id,
      orderNo: `ORD-A-${uniqueSuffix}`,
      totalLessons: 10,
      remainingLessons: 10,
      consumedLessons: 0,
      bonusLessons: 2,
      pricePerLesson: 200,
      status: 'active',
    },
  });

  // 课包 B: 20 课时 (正课 20, 赠课 0)
  const pkgB = await prisma.studentCoursePackage.create({
    data: {
      studentId: testStudent.id,
      courseId: course.id,
      classId: testClass.id,
      orderNo: `ORD-B-${uniqueSuffix}`,
      totalLessons: 20,
      remainingLessons: 20,
      consumedLessons: 0,
      bonusLessons: 0,
      pricePerLesson: 220,
      status: 'active',
    },
  });

  // 4. 创建待上课的排课日程
  const testDate = '2026-10-14';
  const testSchedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: testDate,
      startTime: '14:00',
      endTime: '15:30',
      semanticType: 'regular',
      classType: 'formal',
      status: 'scheduled',
      laneIndex: 0,
    },
  });

  console.log('\n--- 阶段 1: 验证点名会话装配与花名册准备 ---');
  const sessionRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/schedules/${testSchedule.id}/roll-call-students`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(sessionRes.status === 200, '获取点名会话名单返回 200');
  assert(Array.isArray(sessionRes.body.data), '返回名单数据为数组');
  const foundStudent = sessionRes.body.data.find((s) => s.studentId === testStudent.id);
  assert(!!foundStudent, '会话名单中包含测试学员');
  assert(foundStudent.attendanceStatus === 'present', '默认出勤状态预置为 present (一键全勤态)');
  assert(foundStudent.packageId === pkgA.id || foundStudent.packageId === pkgB.id, '学员绑定有效课包 ID');

  console.log('\n--- 阶段 2: 验证精准课包扣减与实收/赠课明细核销 ---');
  // 显式指定扣减课包 B (20 课时)，验证课包 A (10 课时) 完好无损
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
          packageId: pkgB.id,
          status: 'present',
          deductLessons: 2,
          comment: '课消结算引擎精准扣减测试：扣减 2 课时',
          score: 95,
          rating: 'A',
        },
      ],
    },
  );
  assert(rollCallRes.status === 200 || rollCallRes.status === 201, '随堂点名消课结算请求成功');
  assert(rollCallRes.body.data.totalDeductedLessons === 2, '回执总扣减课时正确 (2 课时)');

  // 验证数据库底层课包扣减：课包 B 被精确扣减 2 课时，课包 A 零污染！
  const refreshedPkgB = await prisma.studentCoursePackage.findUnique({ where: { id: pkgB.id } });
  const refreshedPkgA = await prisma.studentCoursePackage.findUnique({ where: { id: pkgA.id } });
  assert(refreshedPkgB.remainingLessons === 18, '指定的课包 B 剩余课时精确递减 (20 - 2 = 18)');
  assert(refreshedPkgB.consumedLessons === 2, '指定的课包 B 已消耗课时精确递增为 2');
  assert(refreshedPkgA.remainingLessons === 10, '非指定的课包 A 完好无损 (依然为 10，杜绝串账！)');

  // 验证 AttendanceRecord 持久化
  const attRecord = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: testSchedule.id, studentId: testStudent.id },
  });
  assert(!!attRecord, '生成正式考勤流水记录 (AttendanceRecord)');
  assert(attRecord.packageId === pkgB.id, '考勤流水记录精准外键绑定课包 B');
  assert(attRecord.regularBurned === 2, '正课扣减明细记录为 2 课时');
  assert(attRecord.bonusBurned === 0, '赠课扣减明细记录为 0 课时');
  assert(attRecord.isReversed === false, '初始冲正标记为 false');

  // 验证日程生命周期迁至 completed
  const scheduleAfterSettle = await prisma.scheduleEvent.findUnique({ where: { id: testSchedule.id } });
  assert(scheduleAfterSettle.status === 'completed', '排课日程状态迁至 completed');
  assert(scheduleAfterSettle.semanticType === 'completed', '日程语义色彩转为盛通结课绿 completed');

  console.log('\n--- 阶段 3: 验证防重复点名结课拦截 ---');
  const duplicateSettleRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/attendances/roll-call',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: testSchedule.id,
      items: [{ studentId: testStudent.id, status: 'present' }],
    },
  );
  assert(duplicateSettleRes.status === 400, '已结课日程禁止重复点名消课 (400 强阻断)');

  console.log('\n--- 阶段 4: 验证授课工作台看板就绪聚合视图 ---');
  const workbenchRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/settlement/workbench?campusId=${campus.id}&date=${testDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(workbenchRes.status === 200, '获取工作台快照端点返回 200');
  const wbData = workbenchRes.body.data;
  assert(wbData.metrics.completedCount >= 1, '看板指标包含已结课次统计');
  assert(wbData.metrics.totalDeductedLessons >= 2, '看板指标包含累计消课课时统计');
  assert(Array.isArray(wbData.history), '返回会话级反结课台账历史列表');
  const historyItem = wbData.history.find((h) => h.scheduleEventId === testSchedule.id);
  assert(!!historyItem, '台账历史包含本次结课会话');
  assert(historyItem.presentCount === 1, '会话聚合出勤到课人数为 1');
  assert(historyItem.deductedLessonsTotal === 2, '会话聚合扣减总学时为 2');
  assert(historyItem.canRevert === true, '会话标记为可执行反结课冲正 (canRevert: true)');

  console.log('\n--- 阶段 5: 验证盛通反结课冲正机制 (原路原课包退还) ---');
  const reverseRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/schedules/${testSchedule.id}/reverse`,
      method: 'POST',
      headers: authHeaders,
    },
    { reason: '客诉核验后反结课冲正' },
  );
  assert(reverseRes.status === 200 || reverseRes.status === 201, '反结课冲正执行成功');
  assert(reverseRes.body.data.refundedLessons === 2, '冲正回执退还课时为 2');

  // 验证数据库底层回滚：退回当初的课包 B！
  const pkgBAfterReverse = await prisma.studentCoursePackage.findUnique({ where: { id: pkgB.id } });
  const pkgAAfterReverse = await prisma.studentCoursePackage.findUnique({ where: { id: pkgA.id } });
  assert(pkgBAfterReverse.remainingLessons === 20, '扣款的原课包 B 剩余课时原路退回 (18 + 2 = 20)');
  assert(pkgBAfterReverse.consumedLessons === 0, '原课包 B 已消耗课时回滚为 0');
  assert(pkgAAfterReverse.remainingLessons === 10, '课包 A 依然不受任何影响');

  // 验证考勤记录打上不可逆冲正标记与操作人审计痕迹
  const attRecordAfterReverse = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: testSchedule.id, studentId: testStudent.id },
  });
  assert(attRecordAfterReverse.isReversed === true, '考勤记录打上不可逆冲正标记 (isReversed: true)');
  assert(!!attRecordAfterReverse.reversedAt, '记录包含冲正时间戳');
  assert(attRecordAfterReverse.reversalReason === '客诉核验后反结课冲正', '记录包含冲正理由');

  // 验证排课日程回滚为 scheduled
  const scheduleAfterReverse = await prisma.scheduleEvent.findUnique({ where: { id: testSchedule.id } });
  assert(scheduleAfterReverse.status === 'scheduled', '排课日程状态回滚为 scheduled 待上课');
  assert(scheduleAfterReverse.semanticType === 'regular', '日程语义色彩恢复为常规蓝 regular');

  console.log('\n--- 阶段 6: 验证盛通防重放风控 (抵御二次反结课刷课攻击) ---');
  const replayAttackRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/schedules/${testSchedule.id}/reverse`,
      method: 'POST',
      headers: authHeaders,
    },
    { reason: '黑客尝试重放刷课' },
  );
  assert(replayAttackRes.status === 400, '防重放风控强拦截：已冲正日程严禁二次反结课 (400 拦截)');

  // 验证重放攻击拦截后，课包课时未被非法虚增
  const pkgBAfterReplay = await prisma.studentCoursePackage.findUnique({ where: { id: pkgB.id } });
  assert(pkgBAfterReplay.remainingLessons === 20, '防重放风控生效：课包剩余课时未被虚假增加 (仍为 20)');

  // 7. 测试数据现场安全清理
  await prisma.attendanceRecord.deleteMany({ where: { scheduleEventId: testSchedule.id } });
  await prisma.scheduleEvent.delete({ where: { id: testSchedule.id } });
  await prisma.studentCoursePackage.deleteMany({ where: { studentId: testStudent.id } });
  await prisma.student.delete({ where: { id: testStudent.id } });
  await prisma.class.delete({ where: { id: testClass.id } });

  console.log('\n================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项课消结算引擎领域模型、精准扣减与防重放风控断言 100% 通过！`);
  console.log('================================================================\n');

  await prisma.$disconnect();
}

runTests().catch(async (err) => {
  console.error('测试运行异常失败:', err);
  await prisma.$disconnect();
  process.exit(1);
});
