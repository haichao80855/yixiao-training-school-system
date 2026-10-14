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
  console.log('学员学籍异动深模块（StudentMovementCoordinator）全功能深度验证套件');
  console.log('包含：零副作用仿真预演、7种异动流转、满班强阻断、盛通赠课防腐与审批闭环');
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
  const token = loginRes.body?.data?.accessToken || loginRes.body?.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 准备公共基础数据
  const campuses = await prisma.campus.findMany({ take: 2 });
  assert(campuses.length >= 2, '数据库存在至少两所测试校区');
  const campusA = campuses[0];
  const campusB = campuses[1];

  const courses = await prisma.course.findMany({
    where: { pricePerLesson: { gt: 0 } },
    take: 2,
  });
  assert(courses.length >= 2, '数据库存在至少两门不同收费标准课程');
  const courseA = courses[0];
  const courseB = courses[1];

  // 确保两门课程在 campusA 均已交付授权
  await prisma.courseCampusAuth.upsert({
    where: { courseId_campusId: { courseId: courseA.id, campusId: campusA.id } },
    update: {},
    create: { courseId: courseA.id, campusId: campusA.id },
  });
  await prisma.courseCampusAuth.upsert({
    where: { courseId_campusId: { courseId: courseB.id, campusId: campusA.id } },
    update: {},
    create: { courseId: courseB.id, campusId: campusA.id },
  });
  await prisma.courseCampusAuth.upsert({
    where: { courseId_campusId: { courseId: courseA.id, campusId: campusB.id } },
    update: {},
    create: { courseId: courseA.id, campusId: campusB.id },
  });

  const teacher = await prisma.user.findFirst();
  assert(!!teacher, '存在有效教师用户');

  const classroom = await prisma.classroom.findFirst();
  assert(!!classroom, '存在有效教室');

  const testSuffix = Date.now().toString().slice(-6);

  // ==========================================================================
  // 测试组 1: 零副作用仿真预演（Dry-Run Preview）与数据库零污染验证
  // ==========================================================================
  console.log('\n--- [测试组 1] 零副作用仿真预演（Dry-Run Preview）校验 ---');
  const studentDryRun = await prisma.student.create({
    data: {
      campusId: campusA.id,
      studentNo: `S_DRY_${testSuffix}`,
      name: `预演学员_${testSuffix}`,
      gender: 'male',
      phone: `139000${testSuffix}`,
      status: 'normal',
      wallet: {
        create: { principalBalance: 500, bonusBalance: 100 },
      },
      packages: {
        create: {
          courseId: courseA.id,
          totalLessons: 20,
          remainingLessons: 15,
          bonusLessons: 5,
          pricePerLesson: 100,
          status: 'active',
        },
      },
    },
    include: { packages: true, wallet: true },
  });
  const dryPkg = studentDryRun.packages[0];

  // 记录 DB 快照状态
  const countStudentsBefore = await prisma.student.count();
  const countPackagesBefore = await prisma.studentCoursePackage.count();
  const countWalletsBefore = await prisma.studentWallet.count();
  const countLedgersBefore = await prisma.walletLedger.count();
  const countOrdersBefore = await prisma.order.count();
  const countMovementsBefore = await prisma.studentAbnormalMovement.count();

  // 调用 preview 进行退费预演试算
  const previewRefundRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentDryRun.id}/movement/preview`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'refund',
      packageId: dryPkg.id,
      deductionFee: 100,
    },
  );
  assert(previewRefundRes.status === 200 || previewRefundRes.status === 201, '退费预演 HTTP 响应 200/201');
  const previewRefundData = previewRefundRes.body?.data || previewRefundRes.body;
  assert(previewRefundData.canExecute === true, '预演结果标明允许执行 (canExecute: true)');
  assert(previewRefundData.requiresApproval === true, '退费异动预演标记需三级审批流');
  // 15剩余 - 5赠课 = 10实付正课剩余; 10 * 100 = 1000 净值; 1000 - 100扣款 = 900
  assert(previewRefundData.financialImpact.refundableCashAmount === 900, '预演精准核算出实退金额 900 元');

  // 调用 preview 进行换课预演试算
  const previewChangeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentDryRun.id}/movement/preview`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'change_course',
      packageId: dryPkg.id,
      newCourseId: courseB.id,
      newLessons: 5,
    },
  );
  assert(previewChangeRes.status === 200 || previewChangeRes.status === 201, '换课预演 HTTP 响应 200/201');
  const previewChangeData = previewChangeRes.body?.data || previewChangeRes.body;
  assert(previewChangeData.canExecute === true, '换课预演标明允许执行');
  assert(previewChangeData.financialImpact.sourceResidualValue === 1000, '原课包扣除5节赠课后剩余10节正课净值 1000 元 (盛通赠课不折现)');

  // 严格断言预演后数据库 0 突变
  assert((await prisma.student.count()) === countStudentsBefore, '预演后 Student 记录数完全一致 (0新增)');
  assert((await prisma.studentCoursePackage.count()) === countPackagesBefore, '预演后 CoursePackage 记录数完全一致');
  assert((await prisma.studentWallet.count()) === countWalletsBefore, '预演后 StudentWallet 记录数完全一致');
  assert((await prisma.walletLedger.count()) === countLedgersBefore, '预演后 WalletLedger 记录数完全一致');
  assert((await prisma.order.count()) === countOrdersBefore, '预演后 Order 记录数完全一致');
  assert((await prisma.studentAbnormalMovement.count()) === countMovementsBefore, '预演后 Movement 审计记录完全一致');

  // ==========================================================================
  // 测试组 2: 转班异动（transfer_class）满班硬阻断与原子名额吞吐校验
  // ==========================================================================
  console.log('\n--- [测试组 2] 转班异动（transfer_class）满班阻断与名额吞吐校验 ---');
  const startDate = new Date();
  const endDate = new Date(Date.now() + 180 * 86400000);

  // 创建源班级（人数: 1，容量: 10）
  const classSrc = await prisma.class.create({
    data: {
      campusId: campusA.id,
      courseId: courseA.id,
      code: `CLS_SRC_${testSuffix}`,
      name: `源测试班级_${testSuffix}`,
      capacity: 10,
      currentStudentCount: 1,
      teacherId: teacher.id,
      classroomId: classroom.id,
      startDate,
      endDate,
    },
  });

  // 创建满额班级（人数: 2，容量: 2）
  const classFull = await prisma.class.create({
    data: {
      campusId: campusA.id,
      courseId: courseA.id,
      code: `CLS_FULL_${testSuffix}`,
      name: `满员测试班级_${testSuffix}`,
      capacity: 2,
      currentStudentCount: 2,
      teacherId: teacher.id,
      classroomId: classroom.id,
      startDate,
      endDate,
    },
  });

  // 创建目标空余班级（人数: 0，容量: 8）
  const classTarget = await prisma.class.create({
    data: {
      campusId: campusA.id,
      courseId: courseA.id,
      code: `CLS_TGT_${testSuffix}`,
      name: `目标空余班级_${testSuffix}`,
      capacity: 8,
      currentStudentCount: 0,
      teacherId: teacher.id,
      classroomId: classroom.id,
      startDate,
      endDate,
    },
  });

  // 创建测试学员分配在源班级
  const studentTransfer = await prisma.student.create({
    data: {
      campusId: campusA.id,
      studentNo: `S_TRF_${testSuffix}`,
      name: `转班学员_${testSuffix}`,
      gender: 'female',
      phone: `139001${testSuffix}`,
      status: 'normal',
      wallet: { create: { principalBalance: 0, bonusBalance: 0 } },
      packages: {
        create: {
          courseId: courseA.id,
          classId: classSrc.id,
          totalLessons: 30,
          remainingLessons: 25,
          pricePerLesson: 120,
          status: 'active',
        },
      },
    },
    include: { packages: true },
  });
  const trfPkg = studentTransfer.packages[0];

  // 1. 尝试转入满额班级 -> 预演应当被阻断
  const previewFullRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentTransfer.id}/movement/preview`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_class',
      packageId: trfPkg.id,
      toClassId: classFull.id,
    },
  );
  const previewFullData = previewFullRes.body?.data || previewFullRes.body;
  assert(previewFullData.canExecute === false, '转入满员班级预演被阻断 (canExecute: false)');
  assert(
    previewFullData.blockingIssues.some((i) => i.code === 'CLASS_CAPACITY_EXCEEDED'),
    '阻断码精准命中 CLASS_CAPACITY_EXCEEDED',
  );

  // 2. 尝试强制执行转入满员班级 -> 后端 HTTP 400 拦截
  const execFullRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentTransfer.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_class',
      packageId: trfPkg.id,
      toClassId: classFull.id,
    },
  );
  assert(execFullRes.status === 400, '向满额班级强制转班执行返回 400 Bad Request 强拦截');

  // 3. 正常转入目标空余班级
  const execTrfRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentTransfer.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_class',
      packageId: trfPkg.id,
      toClassId: classTarget.id,
      reasonCategory: '调整上课时段',
    },
  );
  assert(execTrfRes.status === 200 || execTrfRes.status === 201, '转班执行成功 HTTP 200/201');
  const execTrfData = execTrfRes.body?.data || execTrfRes.body;
  assert(execTrfData.success === true, '转班回执 success: true');

  // 校验班级容量原子变化: classSrc: 1 -> 0, classTarget: 0 -> 1
  const refreshedClassSrc = await prisma.class.findUnique({ where: { id: classSrc.id } });
  const refreshedClassTarget = await prisma.class.findUnique({ where: { id: classTarget.id } });
  const refreshedTrfPkg = await prisma.studentCoursePackage.findUnique({ where: { id: trfPkg.id } });

  assert(refreshedClassSrc.currentStudentCount === 0, '原班级在读人数原子递减 (-1: 1 -> 0)');
  assert(refreshedClassTarget.currentStudentCount === 1, '新班级在读人数原子递增 (+1: 0 -> 1)');
  assert(refreshedTrfPkg.classId === classTarget.id, '课包绑定的班级外键 classId 已精确更新为目标班级');

  // 校验审计快照落盘
  const trfMovementRecord = await prisma.studentAbnormalMovement.findFirst({
    where: { studentId: studentTransfer.id, type: 'transfer_class' },
  });
  assert(!!trfMovementRecord, '异动台账表成功落盘 transfer_class 审计记录');
  assert(trfMovementRecord.status === 'approved', '转班操作为实时生效 approved 状态');

  // ==========================================================================
  // 测试组 3: 换课异动（change_course）学费净值折算与钱包收支自动化
  // ==========================================================================
  console.log('\n--- [测试组 3] 换课异动（change_course）学费净值折算与钱包收支联动 ---');
  // 创建学员拥有原课包：剩余 10 课时 @ 100元 = 1000 元净值
  const studentChange = await prisma.student.create({
    data: {
      campusId: campusA.id,
      studentNo: `S_CHG_${testSuffix}`,
      name: `换课学员_${testSuffix}`,
      gender: 'male',
      phone: `139002${testSuffix}`,
      status: 'normal',
      wallet: { create: { principalBalance: 100, bonusBalance: 0 } },
      packages: {
        create: {
          courseId: courseA.id,
          totalLessons: 10,
          remainingLessons: 10,
          pricePerLesson: 100,
          status: 'active',
        },
      },
    },
    include: { packages: true, wallet: true },
  });
  const oldPkg = studentChange.packages[0];

  // 目标新课程设定：假设单价 120 元，拟购买 6 课时 = 总价 720 元
  // 原净值 1000 - 新总价 720 = 顺差 +280 元退入学员钱包本金
  await prisma.course.update({
    where: { id: courseB.id },
    data: { pricePerLesson: 120 },
  });

  const execChangeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentChange.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'change_course',
      packageId: oldPkg.id,
      newCourseId: courseB.id,
      newLessons: 6,
    },
  );
  assert(execChangeRes.status === 200 || execChangeRes.status === 201, '换课执行成功 HTTP 200/201');

  // 检验原课包已退费/归档，新课包已激活
  const refreshedOldPkg = await prisma.studentCoursePackage.findUnique({ where: { id: oldPkg.id } });
  assert(refreshedOldPkg.status === 'completed', '原课包状态置为 completed 完结归档');

  const newCreatedPkg = await prisma.studentCoursePackage.findFirst({
    where: { studentId: studentChange.id, courseId: courseB.id },
  });
  assert(!!newCreatedPkg, '目标新课程课包成功创建落地');
  assert(newCreatedPkg.remainingLessons === 6, '新课包可用课时数精确等于拟购课时 6 节');
  assert(newCreatedPkg.status === 'active', '新课包状态为 active');

  // 检验学员钱包余额与资金流水：原100 + 280 = 380 元
  const refreshedWallet = await prisma.studentWallet.findUnique({ where: { studentId: studentChange.id } });
  assert(refreshedWallet.principalBalance === 380, '换课顺差 +280 元已自动充值汇入电子钱包 (100 -> 380)');

  const changeLedger = await prisma.walletLedger.findFirst({
    where: { studentId: studentChange.id, type: 'recharge' },
    orderBy: { createdAt: 'desc' },
  });
  assert(!!changeLedger && changeLedger.amount === 280, '自动记录类型为 recharge 金额为 280 的钱包资金台账流水');

  // ==========================================================================
  // 测试组 4: 停课/复课（suspend/resume）生命周期冻结与课包到期日自动顺延
  // ==========================================================================
  console.log('\n--- [测试组 4] 停课/复课（suspend/resume）生命周期冻结与顺延 ---');
  const initialExpiry = new Date(Date.now() + 60 * 86400000);
  const studentSuspend = await prisma.student.create({
    data: {
      campusId: campusA.id,
      studentNo: `S_SUS_${testSuffix}`,
      name: `停复课学员_${testSuffix}`,
      gender: 'female',
      phone: `139003${testSuffix}`,
      status: 'normal',
      wallet: { create: { principalBalance: 0, bonusBalance: 0 } },
      packages: {
        create: {
          courseId: courseA.id,
          totalLessons: 20,
          remainingLessons: 20,
          pricePerLesson: 100,
          expiryDate: initialExpiry,
          status: 'active',
        },
      },
    },
    include: { packages: true },
  });
  const susPkg = studentSuspend.packages[0];

  // 1. 执行停课 30 天
  const execSuspendRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentSuspend.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'suspend',
      suspensionDays: 30,
      reasonCategory: '学业或家庭调整',
    },
  );
  assert(execSuspendRes.status === 200 || execSuspendRes.status === 201, '停课执行成功');

  const suspendedStudent = await prisma.student.findUnique({ where: { id: studentSuspend.id } });
  const suspendedPkg = await prisma.studentCoursePackage.findUnique({ where: { id: susPkg.id } });
  assert(suspendedStudent.status === 'suspended', '学员在读状态置为 suspended (停课休学)');
  assert(suspendedPkg.status === 'frozen', '在读课包已被自动冻结 (frozen)');

  // 2. 状态机互斥防腐校验：已停课学员禁止再发起转班
  const mutexRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentSuspend.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_class',
      packageId: susPkg.id,
      toClassId: classTarget.id,
    },
  );
  assert(mutexRes.status === 400, '休学期间禁止转班，状态机返回 400 阻断');

  // 3. 执行复课
  const execResumeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentSuspend.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'resume',
      reasonCategory: '期满返校',
    },
  );
  assert(execResumeRes.status === 200 || execResumeRes.status === 201, '复课执行成功');

  const resumedStudent = await prisma.student.findUnique({ where: { id: studentSuspend.id } });
  const resumedPkg = await prisma.studentCoursePackage.findUnique({ where: { id: susPkg.id } });
  assert(resumedStudent.status === 'normal', '学员状态恢复为 normal (正常在读)');
  assert(resumedPkg.status === 'active', '课包已成功解冻激活 (active)');

  // 校验有效期已顺延 30 天
  const diffDays = Math.round((resumedPkg.expiryDate.getTime() - initialExpiry.getTime()) / 86400000);
  assert(diffDays >= 29 && diffDays <= 31, `复课后课包有效期顺延天数精确契合 30 天 (实际偏移: ${diffDays} 天)`);

  // ==========================================================================
  // 测试组 5: 跨校区转校（transfer_campus）交付准入与校区归属原子变更
  // ==========================================================================
  console.log('\n--- [测试组 5] 跨校区转校（transfer_campus）交付准入与归属变更 ---');
  const studentCampus = await prisma.student.create({
    data: {
      campusId: campusA.id,
      studentNo: `S_CPS_${testSuffix}`,
      name: `转校学员_${testSuffix}`,
      gender: 'male',
      phone: `139004${testSuffix}`,
      status: 'normal',
      wallet: { create: { principalBalance: 50, bonusBalance: 0 } },
      packages: {
        create: {
          courseId: courseA.id,
          totalLessons: 10,
          remainingLessons: 8,
          pricePerLesson: 100,
          status: 'active',
        },
      },
    },
  });

  // 执行转入 campusB
  const execCampusRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentCampus.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_campus',
      targetCampusId: campusB.id,
      reasonCategory: '家庭搬迁/距离过远',
    },
  );
  assert(execCampusRes.status === 200 || execCampusRes.status === 201, '转校执行成功 HTTP 200/201');

  const refreshedCampusStudent = await prisma.student.findUnique({
    where: { id: studentCampus.id },
  });
  assert(refreshedCampusStudent.campusId === campusB.id, '学员所属校区已原子更新为 campusB');

  // ==========================================================================
  // 测试组 6: 学员资产转让（transfer_student）防自转互斥与课包资金过户
  // ==========================================================================
  console.log('\n--- [测试组 6] 学员资产转让（transfer_student）防自转与资产过户 ---');
  const studentFrom = await prisma.student.create({
    data: {
      campusId: campusA.id,
      studentNo: `S_FROM_${testSuffix}`,
      name: `出让人_${testSuffix}`,
      gender: 'male',
      phone: `139005${testSuffix}`,
      status: 'normal',
      wallet: { create: { principalBalance: 300, bonusBalance: 50 } },
      packages: {
        create: {
          courseId: courseA.id,
          totalLessons: 12,
          remainingLessons: 10,
          pricePerLesson: 100,
          status: 'active',
        },
      },
    },
    include: { packages: true, wallet: true },
  });

  const studentTo = await prisma.student.create({
    data: {
      campusId: campusA.id,
      studentNo: `S_TO_${testSuffix}`,
      name: `受让人_${testSuffix}`,
      gender: 'female',
      phone: `139006${testSuffix}`,
      status: 'normal',
      wallet: { create: { principalBalance: 50, bonusBalance: 0 } },
    },
    include: { wallet: true },
  });

  // 1. 尝试自转防腐拦截
  const selfTransferRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentFrom.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_student',
      targetStudentId: studentFrom.id,
    },
  );
  assert(selfTransferRes.status === 400, '禁止学员自身资产转让给自身 (HTTP 400 拦截)');

  // 2. 执行向 studentTo 转让
  const execTransferStudentRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentFrom.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_student',
      targetStudentId: studentTo.id,
      reasonCategory: '学业或家庭调整',
    },
  );
  assert(execTransferStudentRes.status === 200 || execTransferStudentRes.status === 201, '资产转让成功');

  const refreshedFrom = await prisma.student.findUnique({
    where: { id: studentFrom.id },
    include: { wallet: true, packages: true },
  });
  const refreshedTo = await prisma.student.findUnique({
    where: { id: studentTo.id },
    include: { wallet: true, packages: true },
  });

  assert(refreshedFrom.wallet.principalBalance === 0, '出让方钱包本金清零');
  assert(refreshedFrom.packages.length === 0, '出让方名下课包已全部过户移出 (当前持有 0 个课包)');

  assert(refreshedTo.wallet.principalBalance === 350, '受让方钱包本金精确合并 (+300: 50 -> 350)');
  assert(refreshedTo.packages.length >= 1, '受让方成功接收并激活过户课包');
  assert(refreshedTo.packages[0].remainingLessons === 10, '过户课包剩余 10 课时完整无损');

  // ==========================================================================
  // 测试组 7: 盛通退费（refund）赠课非折现追缴与三级审批流联动
  // ==========================================================================
  console.log('\n--- [测试组 7] 盛通退费（refund）赠课非折现追缴与三级审批流联动 ---');
  // 课包总 25 课时（含 5 赠课，实购 20 课时），单价 100 元
  // 消耗 3 课时正课，剩余 22 课时（17 课时正课 + 5 课时赠课）
  // 盛通退费规则：赠课严禁折现！实付剩余净值 = 17 * 100 = 1700 元
  // 扣除教材手续费 150 元，最终实退现金 = 1700 - 150 = 1550 元
  const studentRefund = await prisma.student.create({
    data: {
      campusId: campusA.id,
      studentNo: `S_RFD_${testSuffix}`,
      name: `盛通退费学员_${testSuffix}`,
      gender: 'male',
      phone: `139007${testSuffix}`,
      status: 'normal',
      wallet: { create: { principalBalance: 0, bonusBalance: 0 } },
      packages: {
        create: {
          courseId: courseA.id,
          totalLessons: 25,
          remainingLessons: 22,
          bonusLessons: 5,
          pricePerLesson: 100,
          status: 'active',
        },
      },
    },
    include: { packages: true },
  });
  const refundPkg = studentRefund.packages[0];

  const execRefundRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentRefund.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'refund',
      packageId: refundPkg.id,
      deductionFee: 150,
      reasonCategory: '学业或家庭调整',
    },
  );
  assert(execRefundRes.status === 200 || execRefundRes.status === 201, '盛通退费异动提交成功');
  const refundReceipt = execRefundRes.body?.data || execRefundRes.body;

  assert(refundReceipt.success === true, '退费回执 success: true');
  assert(
    refundReceipt.computedRefundAmount === 1550,
    '严格执行盛通公式: 实退金额 1550 元 (赠送5课时不折现，扣除手续费150元)',
  );
  assert(!!refundReceipt.orderId, '退费回执中返回有效财务退费订单 ID');

  // 校验订单与三级审批流在 DB 的落盘一致性
  const refundOrder = await prisma.order.findUnique({
    where: { id: refundReceipt.orderId },
    include: { approval: true },
  });
  assert(!!refundOrder, '财务订单表成功持久化退费工单');
  assert(refundOrder.actualAmount === -1550, '退费订单实付金额为负值 -1550 元');
  assert(refundOrder.status === 'unpaid', '订单初始状态处于 unpaid 待审核');

  assert(!!refundOrder.approval, '退费订单显式绑定三级审批流记录 (ApprovalFlow)');
  assert(refundOrder.approval.currentStep === 1, '审批流当前处于第 1 级 (教学核实)');
  assert(refundOrder.approval.totalSteps === 3, '审批流总计三级闭环 (1:教学 -> 2:校长 -> 3:财务)');
  assert(refundOrder.approval.businessType === 'refund', '审批业务类型标明 refund');

  // 校验课包状态已置为 refunded，剩余课时清零
  const refreshedRefundPkg = await prisma.studentCoursePackage.findUnique({
    where: { id: refundPkg.id },
  });
  assert(refreshedRefundPkg.status === 'refunded', '被退课包权威置为 refunded 终态');
  assert(refreshedRefundPkg.remainingLessons === 0, '课包可用剩余课时清零，防二次消费');

  // ==========================================================================
  // 清理临时测试数据
  // ==========================================================================
  console.log('\n--- [清理测试数据] 释放专项测试产生的临时测试记录 ---');
  try {
    const studentIds = [
      studentDryRun.id,
      studentTransfer.id,
      studentChange.id,
      studentSuspend.id,
      studentCampus.id,
      studentFrom.id,
      studentTo.id,
      studentRefund.id,
    ];
    await prisma.approvalFlow.deleteMany({ where: { order: { studentId: { in: studentIds } } } });
    await prisma.order.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.walletLedger.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentAbnormalMovement.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentCoursePackage.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentWallet.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.class.deleteMany({ where: { id: { in: [classSrc.id, classFull.id, classTarget.id] } } });
    console.log('✓ 测试数据清理完毕');
  } catch (err) {
    console.warn('⚠️ 清理测试数据时遇到非致命警告:', err.message);
  }

  console.log('\n================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项学员学籍异动深模块专项测试断言 100% 验证通过！`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ 测试运行异常中断:', err);
  process.exit(1);
});
