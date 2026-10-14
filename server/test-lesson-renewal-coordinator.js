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
  console.log('课消风控与续费决策协调器（LessonRenewalCoordinator）高可靠专项集成验证套件');
  console.log('覆盖：SSOT规则管道、多因子耗尽预测、停消休眠判定、班级消课指数、ACB财务硬阻断与开单闭环');
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

  // 3. 创建测试实体班级（限额 2 人，用于测试满员 CAS 准入预检）
  const testClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `续费风控测试班-${uniqueSuffix}`,
      code: `CLS-RENEW-${uniqueSuffix}`,
      capacity: 2,
      currentStudentCount: 0,
      status: 'in_progress',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
    },
  });
  assert(!!testClass.id, `成功创建测试班级 [${testClass.name}] (班容上限 2 人)`);

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

  const createdStudentIds = [];
  const createdPackageIds = [];

  try {
    // 4. 创建 4 名不同课消健康状态的学员
    // 学员 1：课时极度枯竭学员 (<= 4 课时，近期每周消课 2 讲)
    const stuCritical = await prisma.student.create({
      data: {
        studentNo: `STU-C-${uniqueSuffix}`,
        name: `紧急续约学员-${uniqueSuffix}`,
        gender: 'male',
        phone: `138111${uniqueSuffix.slice(-5)}`,
        campusId: campus.id,
        status: 'normal',
        wallet: {
          create: {
            principalBalance: 500,
            bonusBalance: 100,
          },
        },
      },
      include: { wallet: true },
    });
    createdStudentIds.push(stuCritical.id);

    const pkgCritical = await prisma.studentCoursePackage.create({
      data: {
        studentId: stuCritical.id,
        courseId: course.id,
        classId: testClass.id,
        totalLessons: 48,
        remainingLessons: 2, // 触发 <= 4 紧急底线
        consumedLessons: 46,
        pricePerLesson: 250,
        status: 'active',
      },
    });
    createdPackageIds.push(pkgCritical.id);

    // 为学员 1 制造过去 14 天内的考勤记录，计算消课流速
    const now = new Date();
    const d1 = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
    const d2 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    await prisma.attendanceRecord.createMany({
      data: [
        {
          scheduleEventId: testSchedule.id,
          studentId: stuCritical.id,
          status: 'present',
          deductLessons: 1,
          operator: '测试教务',
          createdAt: d1,
        },
        {
          scheduleEventId: testSchedule.id,
          studentId: stuCritical.id,
          status: 'present',
          deductLessons: 1,
          operator: '测试教务',
          createdAt: d2,
        },
      ],
    });

    // 学员 2：预警跟进学员 (<= 8 课时，剩余 6 课时)
    const stuWarning = await prisma.student.create({
      data: {
        studentNo: `STU-W-${uniqueSuffix}`,
        name: `预警跟进学员-${uniqueSuffix}`,
        gender: 'female',
        phone: `138222${uniqueSuffix.slice(-5)}`,
        campusId: campus.id,
        status: 'normal',
        wallet: {
          create: {
            principalBalance: 6000, // 足够全额钱包支付
            bonusBalance: 200,
          },
        },
      },
      include: { wallet: true },
    });
    createdStudentIds.push(stuWarning.id);

    const pkgWarning = await prisma.studentCoursePackage.create({
      data: {
        studentId: stuWarning.id,
        courseId: course.id,
        classId: testClass.id,
        totalLessons: 48,
        remainingLessons: 6, // 触发 4 < remaining <= 8 预警线
        consumedLessons: 42,
        pricePerLesson: 220,
        status: 'active',
      },
    });
    createdPackageIds.push(pkgWarning.id);

    // 为学员 2 插入 2 天前的最近考勤记录 (活跃正常上课)
    await prisma.attendanceRecord.create({
      data: {
        scheduleEventId: testSchedule.id,
        studentId: stuWarning.id,
        status: 'present',
        deductLessons: 1,
        operator: '测试教务',
        createdAt: d1,
      },
    });

    // 同步班级在读人数为 2 人（此时班级已满班！）
    await prisma.class.update({
      where: { id: testClass.id },
      data: { currentStudentCount: 2 },
    });

    // 学员 3：停消休眠学员 (剩余 20 课时，正常，但超过 20 天未消课)
    const stuDormant = await prisma.student.create({
      data: {
        studentNo: `STU-D-${uniqueSuffix}`,
        name: `停消休眠学员-${uniqueSuffix}`,
        gender: 'male',
        phone: `138333${uniqueSuffix.slice(-5)}`,
        campusId: campus.id,
        status: 'normal',
        wallet: {
          create: {
            principalBalance: 0,
            bonusBalance: 0,
          },
        },
      },
    });
    createdStudentIds.push(stuDormant.id);

    const pkgDormant = await prisma.studentCoursePackage.create({
      data: {
        studentId: stuDormant.id,
        courseId: course.id,
        totalLessons: 30,
        remainingLessons: 20, // 课时充沛 (> 8)
        consumedLessons: 10,
        pricePerLesson: 200,
        status: 'active',
      },
    });
    createdPackageIds.push(pkgDormant.id);

    // 给学员 3 插入 25 天前的考勤（触发 >= 14 天停消休眠流失预警）
    const dOld = new Date(now.getTime() - 25 * 24 * 3600 * 1000);
    await prisma.attendanceRecord.create({
      data: {
        scheduleEventId: testSchedule.id,
        studentId: stuDormant.id,
        status: 'present',
        deductLessons: 1,
        operator: '测试教务',
        createdAt: dOld,
      },
    });

    // 学员 4：退费防腐锁定学员 (持有 refunded 课包)
    const stuRefunded = await prisma.student.create({
      data: {
        studentNo: `STU-R-${uniqueSuffix}`,
        name: `退费锁定学员-${uniqueSuffix}`,
        gender: 'female',
        phone: `138444${uniqueSuffix.slice(-5)}`,
        campusId: campus.id,
        status: 'normal',
      },
    });
    createdStudentIds.push(stuRefunded.id);

    const pkgRefunded = await prisma.studentCoursePackage.create({
      data: {
        studentId: stuRefunded.id,
        courseId: course.id,
        totalLessons: 20,
        remainingLessons: 0,
        consumedLessons: 5,
        pricePerLesson: 200,
        status: 'refunded', // 已退费课包！
      },
    });
    createdPackageIds.push(pkgRefunded.id);

    console.log('\n--- 阶段一：单学员课消风控诊断 (GET /api/students/:id/renewal-risk) ---');

    // 5. 验证学员 1 (极度枯竭) 风控诊断
    const diagCriticalRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/${stuCritical.id}/renewal-risk`,
      method: 'GET',
      headers: authHeaders,
    });
    assert(diagCriticalRes.status === 200, '成功获取学员 1 课消风控诊断报告');
    const diagC = diagCriticalRes.body?.data || diagCriticalRes.body;
    assert(diagC.consumptionHealth.warningLevel === 'critical', '学员 1 剩余 2 课时，准确诊断为 critical (<= 4 SSOT 阈值)');
    assert(diagC.consumptionHealth.visualBadge.type === 'danger', '学员 1 权威徽标类型为 danger');
    assert(diagC.decision.renewalWindowOpen === true, '学员 1 续费窗口标记为已打开');
    assert(diagC.decision.advice === 'URGENT_RENEWAL', '学员 1 续费决策建议为 URGENT_RENEWAL');
    assert(diagC.consumptionHealth.weeklyBurnRate > 0, '基于近期考勤成功计算出周消课流速 weeklyBurnRate');
    assert(diagC.consumptionHealth.estimatedDepletionDays > 0, '成功推导出预计课时耗尽天数');

    // 6. 验证学员 2 (预警跟进) 风控诊断
    const diagWarningRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/${stuWarning.id}/renewal-risk`,
      method: 'GET',
      headers: authHeaders,
    });
    assert(diagWarningRes.status === 200, '成功获取学员 2 课消风控诊断报告');
    const diagW = diagWarningRes.body?.data || diagWarningRes.body;
    assert(diagW.consumptionHealth.warningLevel === 'warning', '学员 2 剩余 6 课时，准确诊断为 warning (<= 8 SSOT 阈值)');
    assert(diagW.consumptionHealth.visualBadge.type === 'warning', '学员 2 权威徽标类型为 warning');
    assert(diagW.decision.renewalWindowOpen === true, '学员 2 续费窗口标记为已打开');
    assert(diagW.decision.advice === 'WINDOW_OPEN', '学员 2 续费建议为 WINDOW_OPEN');

    // 7. 验证学员 3 (停消休眠) 风控诊断
    const diagDormantRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/${stuDormant.id}/renewal-risk`,
      method: 'GET',
      headers: authHeaders,
    });
    assert(diagDormantRes.status === 200, '成功获取学员 3 课消风控诊断报告');
    const diagD = diagDormantRes.body?.data || diagDormantRes.body;
    assert(diagD.consumptionHealth.warningLevel === 'normal', '学员 3 剩余 20 课时，课量维度正常');
    assert(diagD.consumptionHealth.inactiveDays >= 20, '准确判定停消停课天数 >= 20 天');
    assert(diagD.consumptionHealth.dormantRisk !== 'active', '准确捕获学员处于休眠流失状态 (dormantRisk)');
    assert(diagD.decision.advice === 'DORMANT_FOLLOWUP', '决策建议推导为 DORMANT_FOLLOWUP（流失召回与课量解耦独立看护）');

    // 8. 验证学员 4 (ACB 退费锁定) 风控诊断
    const diagRefundRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/${stuRefunded.id}/renewal-risk`,
      method: 'GET',
      headers: authHeaders,
    });
    assert(diagRefundRes.status === 200, '成功获取学员 4 课消风控诊断报告');
    const diagR = diagRefundRes.body?.data || diagRefundRes.body;
    assert(diagR.decision.isRefundLocked === true, '财务防腐屏障成功标记 isRefundLocked = true');
    assert(diagR.decision.advice === 'BLOCKED_REFUNDING', '建议为 BLOCKED_REFUNDING');

    console.log('\n--- 阶段二：校区大盘筛选与聚合看护 (GET /api/students/renewal/roster) ---');

    // 9. 校区全量大盘拉取
    const rosterRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/renewal/roster?keyword=${uniqueSuffix}`,
      method: 'GET',
      headers: authHeaders,
    });
    assert(rosterRes.status === 200, '成功拉取校区续费与课消风控大盘');
    const rosterData = rosterRes.body?.data || rosterRes.body;
    assert(rosterData.statistics.criticalCount >= 1, '校区统计准确包含极度枯竭学员数');
    assert(rosterData.statistics.warningCount >= 1, '校区统计准确包含预警跟进学员数');
    assert(rosterData.statistics.dormantCount >= 1, '校区统计准确包含停消休眠学员数');
    assert(rosterData.statistics.windowOpenCount >= 2, '校区统计准确汇总续费窗口打开总人数');

    // 10. 仅筛选停消休眠学员
    const dormantRosterRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/renewal/roster?keyword=${uniqueSuffix}&dormantOnly=true`,
      method: 'GET',
      headers: authHeaders,
    });
    const dormantRoster = dormantRosterRes.body?.data || dormantRosterRes.body;
    assert(dormantRoster.list.every((item) => item.consumptionHealth.dormantRisk !== 'active'), 'dormantOnly 过滤只返回停消休眠学员');

    // 11. 仅筛选紧急续约学员
    const criticalRosterRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/renewal/roster?keyword=${uniqueSuffix}&riskLevel=critical`,
      method: 'GET',
      headers: authHeaders,
    });
    const criticalRoster = criticalRosterRes.body?.data || criticalRosterRes.body;
    assert(criticalRoster.list.every((item) => item.consumptionHealth.warningLevel === 'critical'), 'riskLevel=critical 过滤只返回紧急学员');

    console.log('\n--- 阶段三：班级花名册学员健康视图 (GET /api/educational/classes/:id/roster-health) ---');

    // 12. 班级花名册消课健康度聚合与废除 <= 3 魔法数字
    const classHealthRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${testClass.id}/roster-health`,
      method: 'GET',
      headers: authHeaders,
    });
    assert(classHealthRes.status === 200, '成功获取班级花名册学员消课健康视图');
    const classHealth = classHealthRes.body?.data || classHealthRes.body;
    assert(classHealth.classId === testClass.id, '班级 ID 一致');
    assert(classHealth.capacity === 2, '班容上限为 2');
    assert(classHealth.currentStudentCount === 2, '当前在读人数为 2');
    assert(typeof classHealth.classHealthIndex === 'number' && classHealth.classHealthIndex <= 100, '班级综合健康指数计算自洽');
    assert(classHealth.roster.length === 2, '班级花名册包含 2 名学员');

    const criticalInClass = classHealth.roster.find((r) => r.studentId === stuCritical.id);
    assert(!!criticalInClass, '花名册中找到学员 1');
    assert(criticalInClass.warningLevel === 'critical', '学员 1 在班级视角统一保持 critical 评级（彻底消除了 <= 3 与 <= 4 冲突）');
    assert(criticalInClass.visualBadge.type === 'danger', '下发权威 visualBadge danger 标签');

    const warningInClass = classHealth.roster.find((r) => r.studentId === stuWarning.id);
    assert(!!warningInClass, '花名册中找到学员 2');
    assert(warningInClass.warningLevel === 'warning', '学员 2 在班级视角统一保持 warning 评级');

    console.log('\n--- 阶段四：一键生成续费开单智能预填草案 (POST /api/students/:id/renewal-draft) ---');

    // 13. 为学员 2 (钱包余额充沛，原班级已满员) 生成续费草案
    const draftRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: `/api/students/${stuWarning.id}/renewal-draft`,
        method: 'POST',
        headers: authHeaders,
      },
      {
        packageId: pkgWarning.id,
        customLessons: 20, // 指定续报 20 课时
      },
    );
    assert(draftRes.status === 200 || draftRes.status === 201, '成功为学员 2 一键生成智能续费草案');
    const draft = draftRes.body?.data || draftRes.body;
    assert(draft.draftId.startsWith('DRAFT-'), '生成合法格式 draftId');
    assert(draft.quote.courseId === course.id, '自动继承原课包课程');
    assert(draft.quote.pricePerLesson === pkgWarning.pricePerLesson, '自动继承并锁定原课包协议单价');
    assert(draft.quote.totalLessons === 20, '课时数为请求定制的 20 课时');
    assert(draft.quote.bonusLessons === 2, '老学员续约默认赠送 2 课时');
    assert(draft.quote.suggestedDiscount === 200, '自动应用老带新/续费优惠立减 ¥200');
    assert(draft.quote.actualPayAmount === 20 * pkgWarning.pricePerLesson - 200, '应收金额计算准确');
    assert(draft.quote.canUseWalletDeduction === true, '学员 2 钱包余额 ¥6000 充足，自动推荐电子钱包抵扣 (wallet)');
    assert(draft.quote.paymentMethod === 'wallet', '默认结算渠道智能匹配为 wallet');

    // 验证原班级满员 CAS 准入预检
    assert(draft.validation.isClassFull === true, 'CAS 准入成功预检出原班级当前已满员 (2/2 人)');
    assert(draft.quote.classId === null, '原班级满员时，草案班级自动置为 null 安全降级为待分班池以防超编');
    assert(typeof draft.validation.warningMessage === 'string' && draft.validation.warningMessage.includes('已达上限'), '包含明确的满班提示 warningMessage');
    assert(draft.enrollCommand.channel === 'renewal', 'enrollCommand 自动打标 channel=renewal');

    console.log('\n--- 阶段五：ACB 财务防腐硬阻断验证 ---');

    // 14. 尝试为持有退费课包的学员 4 生成续费草案（严禁被复活或续费）
    const blockedRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: `/api/students/${stuRefunded.id}/renewal-draft`,
        method: 'POST',
        headers: authHeaders,
      },
      {},
    );
    assert(blockedRes.status === 409, 'ACB 财务防腐屏障严格生效：针对已退费课包续费直接抛出 409 Conflict 阻断');
    assert(
      (blockedRes.body?.message || '').includes('财务防腐屏障'),
      '阻断信息包含权威说明「已被财务防腐屏障锁定」',
    );

    console.log('\n--- 阶段六：续费草案一键开单落盘闭环 (POST /api/students/enroll) ---');

    // 15. 直接消费生成的 enrollCommand 完成开单落盘
    const enrollRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/students/enroll',
        method: 'POST',
        headers: authHeaders,
      },
      draft.enrollCommand,
    );
    assert(enrollRes.status === 200 || enrollRes.status === 201, '直接消费草案 enrollCommand，开单接口成功落盘');
    const enrollResult = enrollRes.body?.data || enrollRes.body;
    assert(!!enrollResult.orderNo, `成功生成正式财务订单: ${enrollResult.orderNo}`);

    // 检查数据库：学员 2 是否产生新课包，且钱包是否正确扣减
    const updatedStu2 = await prisma.student.findUnique({
      where: { id: stuWarning.id },
      include: { packages: true, wallet: true },
    });
    assert(updatedStu2.packages.length === 2, '学员 2 名下课包增至 2 个（成功完成续费课包建档）');
    const newPkg = updatedStu2.packages.find((p) => p.id !== pkgWarning.id);
    assert(newPkg.totalLessons === 22, '新课包总课时包含赠课共 22 讲 (20正课 + 2赠课)');
    assert(newPkg.bonusLessons === 2, '新课包准确记录老学员续约赠送 2 课时');
    assert(newPkg.status === 'active', '新课包状态为 active');
    createdPackageIds.push(newPkg.id);

    console.log('\n================================================================================');
    console.log(`🎉 全部 ${total} 项课消风控与续费决策协调器断言 100% 绿色通过！`);
    console.log('================================================================================\n');
  } finally {
    // 数据清理
    try {
      await prisma.attendanceRecord.deleteMany({
        where: { studentId: { in: createdStudentIds } },
      });
      await prisma.order.deleteMany({
        where: { studentId: { in: createdStudentIds } },
      });
      await prisma.studentCoursePackage.deleteMany({
        where: { id: { in: createdPackageIds } },
      });
      await prisma.walletLedger.deleteMany({
        where: { studentId: { in: createdStudentIds } },
      });
      await prisma.studentWallet.deleteMany({
        where: { studentId: { in: createdStudentIds } },
      });
      await prisma.student.deleteMany({
        where: { id: { in: createdStudentIds } },
      });
      await prisma.scheduleEvent.delete({
        where: { id: testSchedule.id },
      }).catch(() => {});
      await prisma.class.delete({
        where: { id: testClass.id },
      });
    } catch (e) {
      console.warn('[Cleanup Warning]', e.message);
    }
    await prisma.$disconnect();
  }
}

runTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
