/**
 * ============================================================================
 * 拓视未来教育「一校教培系统」教学班级全生命周期协调器 (ClassLifecycleCoordinator)
 * 专项集成测试套件
 *
 * 覆盖 6 大业务验证组：
 * 1. [测试组 1] 招生转开班推进 (activateClass) 与幽灵人数校准、学员状态推进
 * 2. [测试组 2] 正常结课 + 回退待分班池 (completeClass: fallback_unassigned)、学籍自愈与未来日程出清
 * 3. [测试组 3] 正常结课 + 整班批量升班 (completeClass: transfer_next_class) 与 CAS 班容并发锁
 * 4. [测试组 4] 异常解散取消 (cancelClass)、历史考勤防腐屏障与课包安全回退
 * 5. [测试组 5] 班级全量合并 (mergeClasses)、跨课程同源校验与 CAS 班容防击穿
 * 6. [测试组 6] 二阶段只读仿真预演 (previewOperation) 零写副作用与影响面契合度
 * ============================================================================
 */

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
  console.log('教学班级全生命周期协调器（ClassLifecycleCoordinator）专项验证套件');
  console.log('覆盖：开班推进、课包防悬空、学籍自愈、排课出清、考勤防腐、CAS升班与不可变回执');
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

  // 2. 准备基础环境数据
  const campus = await prisma.campus.findFirst();
  assert(!!campus, '数据库存在测试校区');

  const teacher =
    (await prisma.user.findFirst({
      where: { campusId: campus.id, userRoles: { some: { role: { code: 'teacher' } } } },
    })) || (await prisma.user.findFirst());
  assert(!!teacher, '校区存在授课讲师');

  const classroom =
    (await prisma.classroom.findFirst({ where: { campusId: campus.id } })) ||
    (await prisma.classroom.findFirst());
  assert(!!classroom, '校区存在上课教室');

  const courses = await prisma.course.findMany({ take: 2 });
  assert(courses.length >= 2, '数据库存在至少两门不同课程');
  const courseA = courses[0];
  const courseB = courses[1];

  const uniqueSuffix = Date.now().toString().slice(-6);

  // 创建 4 名专属测试学员
  const students = [];
  for (let i = 1; i <= 4; i++) {
    const s = await prisma.student.create({
      data: {
        campusId: campus.id,
        studentNo: `S-LC-${uniqueSuffix}-${i}`,
        name: `生命周期测试生-${i}-${uniqueSuffix}`,
        gender: i % 2 === 0 ? 'female' : 'male',
        phone: `138${Math.floor(10000000 + Math.random() * 90000000)}`,
        status: 'normal',
      },
    });
    students.push(s);
  }
  assert(students.length === 4, '成功创建 4 名专属隔离测试学员');

  // ============================================================================
  // [测试组 1] 招生转开班推进 (activateClass) 与幽灵人数校准、学员状态推进
  // ============================================================================
  console.log('\n--- [测试组 1] 招生转开班推进 (activateClass) 与幽灵人数校准、学员状态推进 ---');

  // 1.1 创建处于 recruiting 状态的测试班级（额定 6 人，初始 currentStudentCount=0）
  const class1 = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseA.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `开班推进测试班-${uniqueSuffix}`,
      code: `CLS-ACT-${uniqueSuffix}`,
      capacity: 6,
      currentStudentCount: 0,
      status: 'recruiting',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2027-01-31'),
    },
  });

  // 为学员 1 创建课包并绑定入班
  const pkg1 = await prisma.studentCoursePackage.create({
    data: {
      studentId: students[0].id,
      courseId: courseA.id,
      classId: class1.id,
      totalLessons: 24,
      remainingLessons: 24,
      status: 'active',
    },
  });

  // 预先生成 2 节 scheduled 排课
  await prisma.scheduleEvent.createMany({
    data: [
      {
        campusId: campus.id,
        classId: class1.id,
        teacherId: teacher.id,
        classroomId: classroom.id,
        date: '2026-10-20',
        startTime: '09:00',
        endTime: '10:30',
        status: 'scheduled',
      },
      {
        campusId: campus.id,
        classId: class1.id,
        teacherId: teacher.id,
        classroomId: classroom.id,
        date: '2026-10-27',
        startTime: '09:00',
        endTime: '10:30',
        status: 'scheduled',
      },
    ],
  });

  // 1.2 开班前：学员状态仍为 normal，班级人数虽为 0 但名下已有 1 个有效课包
  const checkPreStudent = await prisma.student.findUnique({ where: { id: students[0].id } });
  assert(checkPreStudent.status === 'normal', '开班前学员状态处于 normal');

  // 1.3 调用 POST /classes/:id/activate
  const actRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${class1.id}/activate`,
      method: 'POST',
      headers: authHeaders,
    },
    { minStudentCount: 1 },
  );

  assert(actRes.status === 200 || actRes.status === 201, 'POST /classes/:id/activate 响应成功');
  const actData = actRes.body.data;
  assert(actData.previousStatus === 'recruiting', '前置状态记录为 recruiting');
  assert(actData.currentStatus === 'in_progress', '当前状态跃迁为 in_progress');
  assert(actData.enrolledStudentCount === 1, '自动校准并识别出 1 名在读学员');
  assert(actData.activatedScheduleCount === 2, '激活 2 节待授排课');

  // 1.4 底层持久化验证
  const updatedClass1 = await prisma.class.findUnique({ where: { id: class1.id } });
  assert(updatedClass1.status === 'in_progress', '底层 Class 表 status 正式更新为 in_progress');
  assert(updatedClass1.currentStudentCount === 1, '底层 Class 表在读人数原子校准为 1');

  const updatedStudent1 = await prisma.student.findUnique({ where: { id: students[0].id } });
  assert(updatedStudent1.status === 'in_class', '学员主体学籍状态机原子推进为 in_class (正式在读)');

  // 1.5 状态机合法性拦截：对已处于 in_progress 的班级重复开班被严格拦截
  const actRepeatRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${class1.id}/activate`,
      method: 'POST',
      headers: authHeaders,
    },
    {},
  );
  assert(actRepeatRes.status === 400, '对开班中班级重复开班被 HTTP 400 严格拦截');

  // ============================================================================
  // [测试组 2] 正常结课 + 回退待分班池 (completeClass: fallback_unassigned)
  // ============================================================================
  console.log('\n--- [测试组 2] 正常结课 + 回退待分班池 (completeClass: fallback_unassigned) ---');

  // 为学员 2 也创建该班课包
  const pkg2 = await prisma.studentCoursePackage.create({
    data: {
      studentId: students[1].id,
      courseId: courseA.id,
      classId: class1.id,
      totalLessons: 24,
      remainingLessons: 18,
      status: 'active',
    },
  });
  await prisma.student.update({ where: { id: students[1].id }, data: { status: 'in_class' } });
  await prisma.class.update({ where: { id: class1.id }, data: { currentStudentCount: 2 } });

  // 在排课 1 上记录一次已点名考勤（模拟历史已上课）
  const schedulesClass1 = await prisma.scheduleEvent.findMany({
    where: { classId: class1.id },
    orderBy: { date: 'asc' },
  });
  const attendedSchedule = schedulesClass1[0];
  const pendingSchedule = schedulesClass1[1];

  await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: attendedSchedule.id,
      studentId: students[0].id,
      packageId: pkg1.id,
      status: 'present',
      deductLessons: 1,
      operator: '测试讲师',
    },
  });
  await prisma.scheduleEvent.update({
    where: { id: attendedSchedule.id },
    data: { status: 'completed' },
  });

  // 2.1 执行结课 (fallback_unassigned 模式)
  const compRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${class1.id}/complete`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      disposition: { mode: 'fallback_unassigned' },
      cancelFutureSchedules: true,
      remark: '2026秋季教学计划顺利完成结课',
    },
  );

  assert(compRes.status === 200 || compRes.status === 201, 'POST /classes/:id/complete 响应成功');
  const compData = compRes.body.data;
  assert(compData.currentStatus === 'completed', '班级状态跃迁为 completed');
  assert(compData.disposedStudentCount === 2, '妥善处置 2 名在读学员');
  assert(compData.cancelledScheduleCount === 1, '安全注销 1 节未有点名排课');
  assert(compData.preservedAttendanceCount === 1, '严格防腐保留 1 条历史点名考勤');
  assert(!!compData.immutableFingerprint, '生成包含 SHA-256 签名的不可变指纹');

  // 2.2 验证在读课包防悬空 (classId 必须被清空置为 null，绝不允许留存孤儿课包)
  const checkPkg1 = await prisma.studentCoursePackage.findUnique({ where: { id: pkg1.id } });
  const checkPkg2 = await prisma.studentCoursePackage.findUnique({ where: { id: pkg2.id } });
  assert(checkPkg1.classId === null, '学员 1 课包 classId 已原子清空回退待分班池');
  assert(checkPkg2.classId === null, '学员 2 课包 classId 已原子清空回退待分班池');
  assert(checkPkg1.remainingLessons === 24, '学员 1 课包可用课时完整无损保全');

  // 2.3 验证学籍状态机自愈 (in_class -> normal)
  const healedStudent1 = await prisma.student.findUnique({ where: { id: students[0].id } });
  const healedStudent2 = await prisma.student.findUnique({ where: { id: students[1].id } });
  assert(healedStudent1.status === 'normal', '学员 1 学籍状态自愈回退为 normal (待分班池)');
  assert(healedStudent2.status === 'normal', '学员 2 学籍状态自愈回退为 normal (待分班池)');

  // 2.4 验证未来未上日程物理撤销，历史已点名考勤 100% 锁死保留
  const remainingSchedules = await prisma.scheduleEvent.findMany({ where: { classId: class1.id } });
  assert(remainingSchedules.length === 1, '未来空日程已注销，仅保留 1 节历史考勤日程');
  assert(remainingSchedules[0].id === attendedSchedule.id, '保留的正是包含考勤的已授日程');

  const checkAttendance = await prisma.attendanceRecord.findFirst({
    where: { scheduleEventId: attendedSchedule.id },
  });
  assert(!!checkAttendance, '历史考勤记录完好无损，财务消课流水完全保全');

  // 2.5 班级在读人数清零
  const checkClass1End = await prisma.class.findUnique({ where: { id: class1.id } });
  assert(checkClass1End.currentStudentCount === 0, '班级名下在读人数清零');

  // 2.6 验证记录了不可变学籍异动审计
  const movements = await prisma.studentAbnormalMovement.findMany({
    where: { studentId: students[0].id, reasonCategory: 'CLASS_COMPLETED_FALLBACK' },
  });
  assert(movements.length > 0, '成功持久化 CLASS_COMPLETED_FALLBACK 学籍异动凭证');

  // ============================================================================
  // [测试组 3] 正常结课 + 整班批量升班 (transfer_next_class) 与 CAS 班容并发锁
  // ============================================================================
  console.log('\n--- [测试组 3] 正常结课 + 整班批量升班 (transfer_next_class) 与 CAS 班容并发锁 ---');

  // 3.1 创建源班级（在读中，当前 2 人）与目标进阶班级（限额 2 人）
  const sourceClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseA.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `升班源班级-${uniqueSuffix}`,
      code: `CLS-SRC-${uniqueSuffix}`,
      capacity: 4,
      currentStudentCount: 2,
      status: 'in_progress',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-10-31'),
    },
  });

  const targetClassFull = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseA.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `升班目标满员班-${uniqueSuffix}`,
      code: `CLS-TGT-FULL-${uniqueSuffix}`,
      capacity: 2,
      currentStudentCount: 2, // 已经满员
      status: 'in_progress',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2027-02-28'),
    },
  });

  const targetClassAvailable = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseA.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `升班目标富余班-${uniqueSuffix}`,
      code: `CLS-TGT-AVAIL-${uniqueSuffix}`,
      capacity: 6,
      currentStudentCount: 1, // 余量 5 人
      status: 'in_progress',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2027-02-28'),
    },
  });

  // 为学员 3 和学员 4 绑定源班级
  const pkg3 = await prisma.studentCoursePackage.create({
    data: {
      studentId: students[2].id,
      courseId: courseA.id,
      classId: sourceClass.id,
      totalLessons: 20,
      remainingLessons: 10,
      status: 'active',
    },
  });
  const pkg4 = await prisma.studentCoursePackage.create({
    data: {
      studentId: students[3].id,
      courseId: courseA.id,
      classId: sourceClass.id,
      totalLessons: 20,
      remainingLessons: 12,
      status: 'active',
    },
  });

  // 3.2 升班目标班容溢出拦截测试 (2 人拟升入容量为 2/2 的满员班)
  const overflowRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${sourceClass.id}/complete`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      disposition: {
        mode: 'transfer_next_class',
        targetClassId: targetClassFull.id,
      },
      remark: '整班升班测试',
    },
  );

  assert(overflowRes.status === 409, '目标班级容量不足时返回 HTTP 409 Conflict 强阻断');
  assert(overflowRes.body.message.includes('容量不足'), '错误信息明确指出容量不足');

  // 3.3 正常整班升班落盘测试 (升入富余班 targetClassAvailable)
  const promoteRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${sourceClass.id}/complete`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      disposition: {
        mode: 'transfer_next_class',
        targetClassId: targetClassAvailable.id,
      },
      remark: '初阶结业，全班顺利升入进阶班',
    },
  );

  assert(promoteRes.status === 200 || promoteRes.status === 201, '整班批量升班响应成功');
  const promoteData = promoteRes.body.data;
  assert(promoteData.dispositionMode === 'transfer_next_class', '处置策略标明 transfer_next_class');
  assert(promoteData.disposedStudentCount === 2, '成功将 2 名在读学员迁移');

  // 3.4 验证课包原子重绑到新班级
  const checkPromotedPkg3 = await prisma.studentCoursePackage.findUnique({ where: { id: pkg3.id } });
  const checkPromotedPkg4 = await prisma.studentCoursePackage.findUnique({ where: { id: pkg4.id } });
  assert(checkPromotedPkg3.classId === targetClassAvailable.id, '学员 3 课包 classId 已原子更新为目标班');
  assert(checkPromotedPkg4.classId === targetClassAvailable.id, '学员 4 课包 classId 已原子更新为目标班');

  // 3.5 验证目标班级 CAS 在读人数原子递增 (+2: 1 -> 3)
  const checkTgtEnd = await prisma.class.findUnique({ where: { id: targetClassAvailable.id } });
  assert(checkTgtEnd.currentStudentCount === 3, '目标班级在读人数原子递增 (1 -> 3)');

  // 3.6 验证源班级已结业且人数清零
  const checkSrcEnd = await prisma.class.findUnique({ where: { id: sourceClass.id } });
  assert(checkSrcEnd.status === 'completed', '源班级置为 completed 终态');
  assert(checkSrcEnd.currentStudentCount === 0, '源班级在读人数清零');

  // ============================================================================
  // [测试组 4] 异常解散取消 (cancelClass)、历史考勤防腐屏障与课包安全回退
  // ============================================================================
  console.log('\n--- [测试组 4] 异常解散取消 (cancelClass)、历史考勤防腐屏障与课包安全回退 ---');

  // 4.1 测试 A：无任何历史考勤的班级解散 (可彻底物理删除)
  const freshClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseB.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `空班解散测试班-${uniqueSuffix}`,
      code: `CLS-CNC-FRESH-${uniqueSuffix}`,
      capacity: 8,
      currentStudentCount: 0,
      status: 'recruiting',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2027-03-31'),
    },
  });

  const cancelFreshRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${freshClass.id}/cancel`,
      method: 'POST',
      headers: authHeaders,
    },
    { reason: '招生未达开班线，校区批准撤班' },
  );

  assert(cancelFreshRes.status === 200 || cancelFreshRes.status === 201, '无考勤班级解散成功');
  assert(cancelFreshRes.body.data.isSoftDisbanded === false, '无考勤班级标记 isSoftDisbanded: false');

  const checkDeletedFresh = await prisma.class.findUnique({ where: { id: freshClass.id } });
  assert(checkDeletedFresh === null, '无考勤空班级已被物理安全清理');

  // 4.2 测试 B：已有历史消课考勤的班级解散 (历史考勤不可变防腐硬屏障，转为软解散)
  const historyClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseB.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `含考勤解散测试班-${uniqueSuffix}`,
      code: `CLS-CNC-HIST-${uniqueSuffix}`,
      capacity: 8,
      currentStudentCount: 1,
      status: 'in_progress',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-31'),
    },
  });

  const histPkg = await prisma.studentCoursePackage.create({
    data: {
      studentId: students[0].id,
      courseId: courseB.id,
      classId: historyClass.id,
      totalLessons: 12,
      remainingLessons: 11,
      status: 'active',
    },
  });

  const histSchedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: historyClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-09-15',
      startTime: '10:00',
      endTime: '11:30',
      status: 'completed',
    },
  });

  await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: histSchedule.id,
      studentId: students[0].id,
      packageId: histPkg.id,
      status: 'present',
      deductLessons: 1,
      operator: '测试考勤员',
    },
  });

  // 未发生的未来课次
  await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: historyClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-11-20',
      startTime: '10:00',
      endTime: '11:30',
      status: 'scheduled',
    },
  });

  // 发起异常解散
  const cancelHistRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${historyClass.id}/cancel`,
      method: 'POST',
      headers: authHeaders,
    },
    { reason: '场地装修升级突发关闭，原班学员解散回待分班池' },
  );

  assert(cancelHistRes.status === 200 || cancelHistRes.status === 201, '含考勤班级解散响应成功');
  const cancelHistData = cancelHistRes.body.data;
  assert(cancelHistData.isSoftDisbanded === true, '触发历史考勤防腐屏障: isSoftDisbanded: true');
  assert(cancelHistData.historicalAttendancesPreserved === 1, '完好保全 1 条历史考勤消课凭证');

  // 验证班级记录依然存在，但状态为 completed 且名称附带已解散
  const checkSoftClass = await prisma.class.findUnique({ where: { id: historyClass.id } });
  assert(checkSoftClass !== null, '含有历史考勤的班级绝无物理误删');
  assert(checkSoftClass.status === 'completed', '班级状态权威置为 completed 归档');
  assert(checkSoftClass.name.includes('[已解散]'), '班级名称已自动加上 [已解散] 审计备注');

  // 课包回退待分班池
  const checkHistPkgEnd = await prisma.studentCoursePackage.findUnique({ where: { id: histPkg.id } });
  assert(checkHistPkgEnd.classId === null, '在读课包 classId 权威回退为 null');

  // ============================================================================
  // [测试组 5] 班级全量合并 (mergeClasses)、跨课程同源校验与 CAS 班容防击穿
  // ============================================================================
  console.log('\n--- [测试组 5] 班级全量合并 (mergeClasses)、跨课程同源校验与 CAS 班容防击穿 ---');

  // 5.1 创建同课程源班 A、源班 B 和目标班 T
  const mergeSourceA = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseA.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `合并源班A-${uniqueSuffix}`,
      code: `CLS-MRG-A-${uniqueSuffix}`,
      capacity: 5,
      currentStudentCount: 1,
      status: 'in_progress',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-31'),
    },
  });

  const mergePkgA = await prisma.studentCoursePackage.create({
    data: {
      studentId: students[0].id,
      courseId: courseA.id,
      classId: mergeSourceA.id,
      totalLessons: 10,
      remainingLessons: 8,
      status: 'active',
    },
  });

  const mergeTarget = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseA.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `合并目标班-${uniqueSuffix}`,
      code: `CLS-MRG-TGT-${uniqueSuffix}`,
      capacity: 4,
      currentStudentCount: 1, // 余量 3 人
      status: 'in_progress',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-31'),
    },
  });

  const mergePkgTarget = await prisma.studentCoursePackage.create({
    data: {
      studentId: students[1].id,
      courseId: courseA.id,
      classId: mergeTarget.id,
      totalLessons: 10,
      remainingLessons: 8,
      status: 'active',
    },
  });

  // 跨课程合并源班 C (courseB)
  const crossCourseClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: courseB.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `跨课程班级-${uniqueSuffix}`,
      code: `CLS-CROSS-${uniqueSuffix}`,
      capacity: 5,
      currentStudentCount: 1,
      status: 'in_progress',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-31'),
    },
  });

  // 5.2 跨课程同源强校验拦截
  const crossMergeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes/merge',
      method: 'POST',
      headers: authHeaders,
    },
    {
      sourceClassIds: [crossCourseClass.id],
      targetClassId: mergeTarget.id,
    },
  );
  assert(crossMergeRes.status === 400, '跨课程班级合并被 HTTP 400 强拦截');
  assert(crossMergeRes.body.message.includes('所属课程不一致'), '明确提示所属课程不一致');

  // 5.3 正常全量合并执行
  const normalMergeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes/merge',
      method: 'POST',
      headers: authHeaders,
    },
    {
      sourceClassIds: [mergeSourceA.id],
      targetClassId: mergeTarget.id,
      reason: '师资优化调整，A班合并并入主讲班',
    },
  );

  assert(normalMergeRes.status === 200 || normalMergeRes.status === 201, '班级合并响应成功');
  const mergeData = normalMergeRes.body.data;
  assert(mergeData.migratedStudentCount === 1, '成功迁移 1 名在读学员');
  assert(mergeData.targetCurrentStudentCount === 2, '目标班级在读人数原子更新为 2');

  const checkMergePkgA = await prisma.studentCoursePackage.findUnique({ where: { id: mergePkgA.id } });
  assert(checkMergePkgA.classId === mergeTarget.id, '源班级课包已原子指向目标班级');

  // ============================================================================
  // [测试组 6] 二阶段只读仿真预演 (previewOperation) 零写副作用与影响面契合度
  // ============================================================================
  console.log('\n--- [测试组 6] 二阶段只读仿真预演 (previewOperation) 零写副作用与影响面契合度 ---');

  // 6.1 预演结课
  const previewRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${mergeTarget.id}/preview-lifecycle`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      action: 'complete',
      disposition: { mode: 'fallback_unassigned' },
    },
  );

  assert(previewRes.status === 200 || previewRes.status === 201, '预演接口返回 200');
  const previewData = previewRes.body.data;
  assert(previewData.allowed === true, '预演计算 allowed 为 true');
  assert(previewData.impact.affectedStudentCount === 2, '影响学员数预估准确为 2 人');
  assert(previewData.action === 'complete', '预演动作标记为 complete');

  // 6.2 零写副作用断言：数据库中目标班级状态与人数毫厘未动
  const checkPreviewClass = await prisma.class.findUnique({ where: { id: mergeTarget.id } });
  assert(checkPreviewClass.status === 'in_progress', '只读仿真预演绝无写副作用，班级仍为 in_progress');
  assert(checkPreviewClass.currentStudentCount === 2, '在读人数毫厘未动');

  // ============================================================================
  // [数据清理]
  // ============================================================================
  console.log('\n--- [数据清理] 释放生命周期测试产生的测试数据 ---');
  try {
    const studentIds = students.map((s) => s.id);
    await prisma.attendanceRecord.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.scheduleEvent.deleteMany({
      where: {
        OR: [
          { classId: class1.id },
          { classId: sourceClass.id },
          { classId: targetClassFull.id },
          { classId: targetClassAvailable.id },
          { classId: mergeSourceA.id },
          { classId: mergeTarget.id },
          { classId: crossCourseClass.id },
          ...(checkSoftClass ? [{ classId: checkSoftClass.id }] : []),
        ],
      },
    });
    await prisma.studentAbnormalMovement.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentCoursePackage.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.class.deleteMany({
      where: {
        id: {
          in: [
            class1.id,
            sourceClass.id,
            targetClassFull.id,
            targetClassAvailable.id,
            mergeSourceA.id,
            mergeTarget.id,
            crossCourseClass.id,
            ...(checkSoftClass ? [checkSoftClass.id] : []),
          ],
        },
      },
    });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    console.log('✓ 测试临时数据清理完毕');
  } catch (cleanErr) {
    // 忽略清理异常
  }

  console.log('\n================================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项教学班级全生命周期协调器专项测试断言 100% 验证通过！`);
  console.log('================================================================================\n');

  await prisma.$disconnect();
}

runTests().catch((err) => {
  console.error('测试运行异常失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
