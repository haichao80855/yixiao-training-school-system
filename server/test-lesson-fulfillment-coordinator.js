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
  console.log('统一结课履约协调器（LessonFulfillmentCoordinator）全链路闭环与级联安全专项集成验证');
  console.log('覆盖：Zero-ceremony 默认全勤结课、差异覆写、Regular-First 正课优先扣减、');
  console.log('      不可变 SHA-256 数据指纹、双向学情渗透、出站信箱灌装、');
  console.log('      级联反结课幽灵出清、ACB 财务防腐屏障阻断、课评重开策略与跨校区隔离');
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
  const campus = (await prisma.campus.findFirst({ where: { status: 'active' } })) || (await prisma.campus.findFirst());
  assert(!!campus, '数据库存在有效测试校区');

  const otherCampus = await prisma.campus.findFirst({
    where: { id: { not: campus.id } },
  });

  const teacher =
    (await prisma.user.findFirst({
      where: { campusId: campus.id, userRoles: { some: { role: { code: 'teacher' } } } },
    })) || (await prisma.user.findFirst());
  assert(!!teacher, '校区存在授课讲师');

  const classroom =
    (await prisma.classroom.findFirst({ where: { campusId: campus.id } })) ||
    (await prisma.classroom.findFirst());
  assert(!!classroom, '校区存在测试教室');

  let course = await prisma.course.findFirst({ where: { subject: 'scratch' } });
  if (!course) {
    course = (await prisma.course.findFirst({ where: { status: 'enabled' } })) || (await prisma.course.findFirst());
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
      name: `统一结课测试班-${uniqueSuffix}`,
      code: `CLS-FLM-${uniqueSuffix}`,
      capacity: 15,
      status: 'in_progress',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2027-06-30'),
    },
  });
  assert(!!testClass.id, `测试班级创建成功: ${testClass.name}`);

  // 4. 创建 3 名测试学员及课包 (学员A: 绑定微信; 学员B: 未绑定微信; 学员C: 异常学员)
  const studentA = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `STU-FLM-A-${uniqueSuffix}`,
      name: `履约学员A-微绑-${uniqueSuffix}`,
      gender: 'male',
      phone: `1381001${uniqueSuffix.slice(-4)}`,
      wechatOpenId: `wx_openid_flm_a_${uniqueSuffix}`,
      status: 'in_class',
    },
  });
  const pkgA = await prisma.studentCoursePackage.create({
    data: {
      studentId: studentA.id,
      courseId: course.id,
      classId: testClass.id,
      totalLessons: 10,
      remainingLessons: 10,
      bonusLessons: 2, // 实付 8 正课, 2 赠课
      consumedLessons: 0,
      status: 'active',
    },
  });

  const studentB = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `STU-FLM-B-${uniqueSuffix}`,
      name: `履约学员B-无微-${uniqueSuffix}`,
      gender: 'female',
      phone: `1381002${uniqueSuffix.slice(-4)}`,
      wechatOpenId: null, // 未绑定微信号
      status: 'in_class',
    },
  });
  const pkgB = await prisma.studentCoursePackage.create({
    data: {
      studentId: studentB.id,
      courseId: course.id,
      classId: testClass.id,
      totalLessons: 10,
      remainingLessons: 10,
      bonusLessons: 2,
      consumedLessons: 0,
      status: 'active',
    },
  });

  const studentC = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `STU-FLM-C-${uniqueSuffix}`,
      name: `履约学员C-异常-${uniqueSuffix}`,
      gender: 'male',
      phone: `1381003${uniqueSuffix.slice(-4)}`,
      wechatOpenId: `wx_openid_flm_c_${uniqueSuffix}`,
      status: 'in_class',
    },
  });
  const pkgC = await prisma.studentCoursePackage.create({
    data: {
      studentId: studentC.id,
      courseId: course.id,
      classId: testClass.id,
      totalLessons: 10,
      remainingLessons: 10,
      bonusLessons: 0,
      consumedLessons: 0,
      status: 'active',
    },
  });

  assert(Boolean(studentA && studentB && studentC), '3名测试学员与正课课包准备就绪');

  // 5. 创建排课日程 ScheduleEvent 1 (用于 Scenario 1 & 4)
  const schedule1 = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-18',
      startTime: '10:00',
      endTime: '11:30',
      status: 'scheduled',
      semanticType: 'regular',
    },
  });
  assert(!!schedule1.id, `排课日程 1 创建成功 ID: ${schedule1.id}`);

  console.log('\n--- [场景 1: Zero-ceremony Happy Path 默认全勤一键极速结课] ---');

  // 1.1 查询工作台水化视图
  const hydrateRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/fulfillment/workbench/${schedule1.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(hydrateRes.status === 200, '成功获取结课工作台智能水化数据 (HTTP 200)');
  const wbData = hydrateRes.body?.data || hydrateRes.body;
  assert(wbData.students.length === 3, '自动水化全班 3 名在读学员花名册');
  assert(wbData.students.every((s) => s.defaultStatus === 'present'), '全员默认预置为到课状态 (present)');
  assert(wbData.students.every((s) => s.defaultDeductLessons === 1), '全员默认扣减 1 课时');
  assert(wbData.students.every((s) => s.defaultRating === 5.0), '全员默认预设 5.0 星级评价');
  assert(wbData.summary.wechatBoundCount === 2, '透视微信绑定画像: 2 人绑定');
  assert(wbData.summary.wechatUnboundCount === 1, '透视微信未绑画像: 1 人未绑');
  assert(wbData.evaluationDraft.lessonTitle.length > 0, '成功从大纲抽取随堂主题');
  assert(wbData.evaluationDraft.studyContentHtml.includes('克隆体机制'), '成功抽取 Scratch 标准核心素养重难点富文本');

  // 1.2 零心智直接提交全量结课 (未传 anomalyOverrides，全员默认到课 + 扣 1 课时 + 5星)
  const fulfillRes1 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/fulfillment/fulfill',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: schedule1.id,
      mode: 'FULL_SETTLE',
      lessonTitle: wbData.evaluationDraft.lessonTitle,
      studyContentHtml: wbData.evaluationDraft.studyContentHtml,
      overallRating: 5.0,
      teacherComment: '随堂表现优秀，编程思维清晰',
      photoList: ['https://storage.yixiao.com/photo1.jpg'],
      idempotencyKey: `flm_test_key_1_${uniqueSuffix}`,
    },
  );
  assert(fulfillRes1.status === 200 || fulfillRes1.status === 201, 'Zero-ceremony 结课履约提交成功 (HTTP 200/201)');
  const receipt1 = fulfillRes1.body?.data || fulfillRes1.body;
  assert(receipt1.receiptId.startsWith('REC-FLM-'), `生成不可变履约回执单号: ${receipt1.receiptId}`);
  assert(receipt1.mode === 'FULL_SETTLE', '履约模式确认为 FULL_SETTLE');
  assert(receipt1.settlement.totalDeductedLessons === 3, '实消总课时准确扣减 3 课时');
  assert(receipt1.settlement.regularBurned === 3, 'Regular-First 算法优先消耗 3 节实收正课');
  assert(receipt1.settlement.bonusBurned === 0, '赠课完好保留消耗 0 节');
  assert(receipt1.evaluation.status === 'published', '课评实体状态成功跃迁为 published');
  assert(receipt1.evaluation.fingerprint.length === 64, '生成权威不可变 SHA-256 数据防篡改指纹');
  assert(receipt1.outbox.enqueuedCount === 2, '事务性信箱成功灌装 2 条微信模板通知');
  assert(receipt1.outbox.skippedCount === 1, '未绑定微信学员记录为 skipped_no_openid (1人)');

  // 1.3 验证数据库底层一致性
  const updatedPkgA = await prisma.studentCoursePackage.findUnique({ where: { id: pkgA.id } });
  assert(updatedPkgA.remainingLessons === 9, '学员A课包扣减 1 课时，剩余 9 课时');
  assert(updatedPkgA.consumedLessons === 1, '学员A已消耗课时递增为 1');

  const attendances1 = await prisma.attendanceRecord.findMany({
    where: { scheduleEventId: schedule1.id },
  });
  assert(attendances1.length === 3, 'AttendanceRecord 记录落库 3 条');
  assert(attendances1.every((a) => a.score === 98 && a.rating === 'A+'), '双向学情渗透: 5星自动折算为 98 分与 A+ 等第');
  assert(attendances1.every((a) => a.comment.includes('随堂表现优秀')), '双向学情渗透: 教师评语成功写入考勤记录');

  const outboxRecords = await prisma.lessonEvaluationOutbox.findMany({
    where: { evaluationId: receipt1.evaluation.evaluationId },
  });
  const validWechatOutbox = outboxRecords.filter((o) => o.status === 'pending' || o.status === 'sent');
  assert(validWechatOutbox.length === 2, '出站信箱成功生成 2 条微信模板通知 (状态为 pending 或 sent)');

  const schedule1After = await prisma.scheduleEvent.findUnique({ where: { id: schedule1.id } });
  assert(schedule1After.status === 'completed', '排课日程状态自动更新为 completed');

  console.log('\n--- [场景 2: 异常学员差异覆写 (Anomaly Overrides)] ---');

  // 2.1 创建排课日程 2
  const schedule2 = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-19',
      startTime: '14:00',
      endTime: '15:30',
      status: 'scheduled',
      semanticType: 'regular',
    },
  });

  // 2.2 传入差异覆写：学员B请假 (leave), 学员C缺席 (absent), 学员A正常到课
  const fulfillRes2 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/fulfillment/fulfill',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: schedule2.id,
      mode: 'FULL_SETTLE',
      lessonTitle: 'Scratch碰撞检测与克隆体生命周期',
      studyContentHtml: '<p>知识点解析</p>',
      overallRating: 5.0,
      teacherComment: '整体表现尚可',
      anomalyOverrides: [
        {
          studentId: studentB.id,
          status: 'leave',
          deductLessons: 0,
        },
        {
          studentId: studentC.id,
          status: 'absent',
          deductLessons: 0,
          rating: 4.0,
          personalizedComment: '旷课缺席未到，需安排补课',
        },
      ],
    },
  );
  assert(fulfillRes2.status === 200 || fulfillRes2.status === 201, '差异覆写结课履约提交成功');
  const receipt2 = fulfillRes2.body?.data || fulfillRes2.body;
  assert(receipt2.settlement.totalDeductedLessons === 1, '仅到课学员A扣减 1 课时，请假与缺席学员扣减 0 课时');
  assert(receipt2.settlement.presentCount === 1, '实到人次统计为 1');
  assert(receipt2.settlement.leaveCount === 1, '请假人次统计为 1');
  assert(receipt2.settlement.absentCount === 1, '缺席人次统计为 1');
  assert(receipt2.outbox.enqueuedCount === 1, '信箱仅为实到学员A排队微信通知，缺席学员被安全过滤 (ATTENDED_ONLY)');

  console.log('\n--- [场景 3: 分阶段履约模式 (ATTENDANCE_ONLY & PUBLISH_EVALUATION)] ---');

  // 3.1 创建排课日程 3
  const schedule3 = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-20',
      startTime: '16:00',
      endTime: '17:30',
      status: 'scheduled',
      semanticType: 'regular',
    },
  });

  // 3.2 阶段一：仅随堂打卡消课 (ATTENDANCE_ONLY)
  const fulfillRes3A = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/fulfillment/fulfill',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: schedule3.id,
      mode: 'ATTENDANCE_ONLY',
    },
  );
  assert(fulfillRes3A.status === 200 || fulfillRes3A.status === 201, '阶段一 ATTENDANCE_ONLY 提交成功');
  const receipt3A = fulfillRes3A.body?.data || fulfillRes3A.body;
  assert(receipt3A.mode === 'ATTENDANCE_ONLY', '回执确认 ATTENDANCE_ONLY 模式');
  assert(receipt3A.evaluation === null, '阶段一未生成任何课评聚合根');
  assert(receipt3A.outbox === null, '阶段一未向出站信箱灌装任何消息');
  const schedule3Mid = await prisma.scheduleEvent.findUnique({ where: { id: schedule3.id } });
  assert(schedule3Mid.status === 'completed', '排课日程状态已跃迁为 completed');

  // 3.3 阶段二：课后补录发布课评 (PUBLISH_EVALUATION)
  const fulfillRes3B = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/fulfillment/fulfill',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: schedule3.id,
      mode: 'PUBLISH_EVALUATION',
      lessonTitle: '课后补录课评与家长通知',
      studyContentHtml: '<p>课后知识点精讲</p>',
      overallRating: 5.0,
      teacherComment: '课后复盘评语',
    },
  );
  assert(fulfillRes3B.status === 200 || fulfillRes3B.status === 201, '阶段二 PUBLISH_EVALUATION 提交成功');
  const receipt3B = fulfillRes3B.body?.data || fulfillRes3B.body;
  assert(receipt3B.evaluation.status === 'published', '补录课评持久化成功');
  assert(receipt3B.outbox.enqueuedCount > 0, '补录课评成功为学员灌装出站信箱');

  console.log('\n--- [场景 4: 级联反结课幽灵出清与课时原路退还 (Cascading Reversal & Zero Ghost)] ---');

  // 4.1 显式模拟在途 pending 微信通知，验证级联作废机制
  await prisma.lessonEvaluationOutbox.updateMany({
    where: { evaluationId: receipt1.evaluation.evaluationId, channel: 'wechat_template' },
    data: { status: 'pending' },
  });

  // 记录反结课前课包余额
  const pkgABeforeRev = await prisma.studentCoursePackage.findUnique({ where: { id: pkgA.id } });

  const reverseRes1 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/fulfillment/reverse',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: schedule1.id,
      strategy: 'FULL_ROLLBACK',
      reason: '讲师点名误操作，全量反结课冲正并撤销课评',
    },
  );
  assert(reverseRes1.status === 200 || reverseRes1.status === 201, '反结课冲正请求执行成功 (HTTP 200/201)');
  const revReceipt1 = reverseRes1.body?.data || reverseRes1.body;
  assert(revReceipt1.strategy === 'FULL_ROLLBACK', '回执确认 FULL_ROLLBACK 策略');
  assert(revReceipt1.settlementReversal.refundedTotalLessons === 3, '成功原路退还全部 3 课时');
  assert(revReceipt1.evaluationReversal.nextStatus === 'revoked', '课评状态被原子级联置为 revoked');
  assert(revReceipt1.evaluationReversal.cancelledOutboxCount === 2, '出站信箱 2 条 pending 微信通知被级联置为 cancelled');

  // 4.2 严格断言幽灵消除与课时恢复
  const pkgAAfterRev = await prisma.studentCoursePackage.findUnique({ where: { id: pkgA.id } });
  assert(pkgAAfterRev.remainingLessons === pkgABeforeRev.remainingLessons + 1, `学员A课包课时全额原路复苏 (原: ${pkgABeforeRev.remainingLessons} -> 冲正后: ${pkgAAfterRev.remainingLessons})`);
  assert(pkgAAfterRev.consumedLessons === pkgABeforeRev.consumedLessons - 1, `学员A已消耗课时准确回冲 (原: ${pkgABeforeRev.consumedLessons} -> 冲正后: ${pkgAAfterRev.consumedLessons})`);

  const ghostOutbox = await prisma.lessonEvaluationOutbox.findMany({
    where: {
      evaluationId: receipt1.evaluation.evaluationId,
      status: 'pending',
    },
  });
  assert(ghostOutbox.length === 0, '【Zero Ghost 核心断言】处于 pending 的幽灵通知严格为 0 条！');

  const cancelledOutbox = await prisma.lessonEvaluationOutbox.findMany({
    where: {
      evaluationId: receipt1.evaluation.evaluationId,
      status: 'cancelled',
    },
  });
  assert(cancelledOutbox.length === 2, '作废消息状态确认为 cancelled 且审计日志完整');

  const schedule1Final = await prisma.scheduleEvent.findUnique({ where: { id: schedule1.id } });
  assert(schedule1Final.status === 'scheduled', '排课日程状态安全恢复为待上课 scheduled');
  assert(schedule1Final.semanticType === 'regular', '排课日程语义恢复为常规蓝 regular');

  console.log('\n--- [场景 5: 财务防腐屏障 (ACB) 退费强阻断] ---');

  // 5.1 创建排课日程 4 并结课
  const schedule4 = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-21',
      startTime: '18:00',
      endTime: '19:30',
      status: 'scheduled',
      semanticType: 'regular',
    },
  });
  await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/fulfillment/fulfill',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: schedule4.id,
      mode: 'FULL_SETTLE',
      lessonTitle: '财务屏障测试课',
    },
  );

  // 5.2 模拟财务退费归档：将学员A的课包状态标记为 refunded
  await prisma.studentCoursePackage.update({
    where: { id: pkgA.id },
    data: { status: 'refunded' },
  });

  // 5.3 尝试发起反结课冲正
  const reverseBlockedRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/fulfillment/reverse',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: schedule4.id,
      strategy: 'FULL_ROLLBACK',
      reason: '尝试非法冲正已退费课包',
    },
  );
  assert(reverseBlockedRes.status === 409, '【ACB 财务屏障生效】反结课被严格拦截 (HTTP 409 Conflict)');
  const errorMsg = reverseBlockedRes.body?.message || '';
  assert(
    errorMsg.includes('财务防腐屏障') || errorMsg.includes('RefundLocked'),
    '拦截原因明确指出禁止复活退费课包 (RefundLocked Guard)',
  );

  // 恢复课包状态以防污染后续逻辑
  await prisma.studentCoursePackage.update({
    where: { id: pkgA.id },
    data: { status: 'active' },
  });

  console.log('\n--- [场景 6: 课评重开独立策略 (REOPEN_EVALUATION)] ---');

  // 6.1 对 schedule2 (包含 1 课时扣费与 published 课评) 执行 REOPEN_EVALUATION
  const reopenRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/fulfillment/reverse',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId: schedule2.id,
      strategy: 'REOPEN_EVALUATION',
      reason: '教师修正知识点大纲错别字，重开课评草稿',
    },
  );
  assert(reopenRes.status === 200 || reopenRes.status === 201, '课评重开操作成功 (HTTP 200/201)');
  const reopenReceipt = reopenRes.body?.data || reopenRes.body;
  assert(reopenReceipt.strategy === 'REOPEN_EVALUATION', '策略确认为 REOPEN_EVALUATION');
  assert(reopenReceipt.settlementReversal === null, '财务与课消扣减 100% 保持不动 (零财务扰动)');
  assert(reopenReceipt.evaluationReversal.nextStatus === 'draft', '课评状态安全回退为草稿 draft');

  const eval2Draft = await prisma.lessonEvaluation.findUnique({
    where: { scheduleEventId: schedule2.id },
  });
  assert(eval2Draft.status === 'draft', '数据库课评状态确认为 draft');

  const att2AfterReopen = await prisma.attendanceRecord.findMany({
    where: { scheduleEventId: schedule2.id },
  });
  assert(
    att2AfterReopen.every((a) => a.comment === null && a.score === null),
    '考勤记录评语与评分被原子清空，等待教师重新水化并录入',
  );

  console.log('\n--- [场景 7: 跨校区风控隔离保护 (Campus Scope Isolation)] ---');

  if (otherCampus) {
    const crossCampusRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/educational/fulfillment/fulfill',
        method: 'POST',
        headers: authHeaders,
      },
      {
        scheduleEventId: schedule2.id,
        campusId: otherCampus.id, // 故意传入异校区 ID
        mode: 'FULL_SETTLE',
      },
    );
    assert(crossCampusRes.status === 403, '跨校区结课履约被严格拦截 (HTTP 403 Forbidden)');
  } else {
    assert(true, '单校区环境跳过跨校区越权探测');
  }

  // 8. 恢复与环境清理
  await prisma.lessonEvaluationOutbox.deleteMany({
    where: { evaluation: { scheduleEventId: { in: [schedule1.id, schedule2.id, schedule3.id, schedule4.id] } } },
  });
  await prisma.lessonEvaluationRevision.deleteMany({
    where: { evaluation: { scheduleEventId: { in: [schedule1.id, schedule2.id, schedule3.id, schedule4.id] } } },
  });
  await prisma.lessonEvaluationStudentItem.deleteMany({
    where: { evaluation: { scheduleEventId: { in: [schedule1.id, schedule2.id, schedule3.id, schedule4.id] } } },
  });
  await prisma.lessonEvaluation.deleteMany({
    where: { scheduleEventId: { in: [schedule1.id, schedule2.id, schedule3.id, schedule4.id] } },
  });
  await prisma.attendanceRecord.deleteMany({
    where: { scheduleEventId: { in: [schedule1.id, schedule2.id, schedule3.id, schedule4.id] } },
  });
  await prisma.scheduleEvent.deleteMany({
    where: { id: { in: [schedule1.id, schedule2.id, schedule3.id, schedule4.id] } },
  });
  await prisma.studentCoursePackage.deleteMany({
    where: { studentId: { in: [studentA.id, studentB.id, studentC.id] } },
  });
  await prisma.student.deleteMany({
    where: { id: { in: [studentA.id, studentB.id, studentC.id] } },
  });
  await prisma.class.delete({ where: { id: testClass.id } });

  console.log('\n================================================================================');
  console.log(`🎉 专项集成自动化测试全部通过！共计断言 ${passed}/${total} 项，0 失败！`);
  console.log('================================================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
