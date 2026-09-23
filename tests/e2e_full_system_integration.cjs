#!/usr/bin/env node
/**
 * 盛通教育「一校教培系统」全业务闭环穿透端到端集成自动化测试套件
 * tests/e2e_full_system_integration.cjs
 * 
 * 覆盖 5 大核心业务模块的 9 大穿透链路闭环：
 * Step 1: 教研中心 (Curriculum) -> 创建全新标准化课程并跨校区授权
 * Step 2: 学员中心 (Student Center) -> 录入学员全景档案，选定新课程包签约开单
 * Step 3: 财务中心 (Financial Center) -> 订单流转进入财务审核，确认到账并生成营收流水
 * Step 4: 待分班调度 (Unassigned Pool) -> 签约学员自动进入待分班池，班级管理将其编入目标在读班级
 * Step 5: 教务排课看板 (Educational Admin) -> 安排网格排课课次，调用冲突防撞引擎验证教师/教室/学员占用情况
 * Step 6: 讲台考勤消课 (Attendance) -> 授课点名消课，学员课程包剩余课时精确真实扣减
 * Step 7: 反结课冲正机制 (Revert Lesson) -> 测试考勤反结课，扣减课时退还冲正回学员课包与防重复幂等性
 * Step 8: 异常退费多级审批 (Approval Flow) -> 提交学员退费审批（教学核实 -> 校长审批 -> 财务终审），终审通过后原订单负数冲正锁定
 * Step 9: 顶部校区动态穿透联动 (Tenant & Multi-Campus Scope) -> 动态切换 5 大校区上下文，验证所有模块数据作用域实时重载隔离
 * 
 * 零污染原则 (Zero-Pollution Invariant): 现场快照完全捕获与严格复原，确保不影响既有测试套件。
 */

const path = require('node:path');
const createJiti = require('jiti');

// 使用 jiti 安全解析生产 TypeScript 源码并建立路径别名
const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const mocks = jiti('../src/mocks/index.ts');

// 彩色终端打印
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function assert(condition, message) {
  totalChecks++;
  if (!condition) {
    failedChecks++;
    const err = new Error(message || 'Assertion failed');
    failures.push({ message, error: err });
    console.log(`    ${colors.red}✗ FAIL:${colors.reset} ${message}`);
    throw err;
  } else {
    passedChecks++;
    console.log(`    ${colors.green}✓ PASS:${colors.reset} ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  totalChecks++;
  if (actual !== expected) {
    failedChecks++;
    const err = new Error(`${message || 'Failed'}: Expected [${expected}] but received [${actual}]`);
    failures.push({ message, error: err });
    console.log(`    ${colors.red}✗ FAIL:${colors.reset} ${message} (Expected [${expected}], got [${actual}])`);
    throw err;
  } else {
    passedChecks++;
    console.log(`    ${colors.green}✓ PASS:${colors.reset} ${message} [${actual}]`);
  }
}

function assertDeepEqual(actual, expected, message) {
  totalChecks++;
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    failedChecks++;
    const err = new Error(`${message || 'Failed'}: Expected [${expectedStr}] but received [${actualStr}]`);
    failures.push({ message, error: err });
    console.log(`    ${colors.red}✗ FAIL:${colors.reset} ${message}`);
    throw err;
  } else {
    passedChecks++;
    console.log(`    ${colors.green}✓ PASS:${colors.reset} ${message}`);
  }
}

function assertThrows(fn, expectedSubstr, message) {
  totalChecks++;
  let threw = false;
  let errorMsg = '';
  try {
    fn();
  } catch (err) {
    threw = true;
    errorMsg = err.message || '';
    if (expectedSubstr && !errorMsg.includes(expectedSubstr)) {
      failedChecks++;
      const msg = `${message || 'Failed'}: Expected error containing [${expectedSubstr}] but got [${errorMsg}]`;
      failures.push({ message: msg, error: err });
      console.log(`    ${colors.red}✗ FAIL:${colors.reset} ${msg}`);
      throw new Error(msg);
    }
  }
  if (!threw) {
    failedChecks++;
    const msg = `${message || 'Failed'}: Expected function to throw an error, but it succeeded.`;
    failures.push({ message: msg, error: new Error(msg) });
    console.log(`    ${colors.red}✗ FAIL:${colors.reset} ${msg}`);
    throw new Error(msg);
  }
  passedChecks++;
  console.log(`    ${colors.green}✓ PASS:${colors.reset} ${message} (Successfully intercepted: "${errorMsg.substring(0, 50)}...")`);
}

// 现场 Mock 深度快照捕获 (Zero-Pollution Invariant)
const snapshotCourses = JSON.parse(JSON.stringify(mocks.MOCK_COURSES));
const snapshotStudents = JSON.parse(JSON.stringify(mocks.MOCK_STUDENTS));
const snapshotUnassigned = JSON.parse(JSON.stringify(mocks.MOCK_UNASSIGNED_STUDENTS));
const snapshotOrders = JSON.parse(JSON.stringify(mocks.MOCK_ORDERS_DATA));
const snapshotApprovals = JSON.parse(JSON.stringify(mocks.MOCK_APPROVAL_RECORDS));
const snapshotLedgers = JSON.parse(JSON.stringify(mocks.MOCK_LEDGER_RECORDS));
const snapshotClasses = JSON.parse(JSON.stringify(mocks.MOCK_CLASSES));
const snapshotClassrooms = JSON.parse(JSON.stringify(mocks.MOCK_CLASSROOMS));
const snapshotTeachers = JSON.parse(JSON.stringify(mocks.MOCK_TEACHERS));
const snapshotSchedules = JSON.parse(JSON.stringify(mocks.MOCK_SCHEDULE_EVENTS));
const snapshotAttendances = JSON.parse(JSON.stringify(mocks.MOCK_ATTENDANCE_RECORDS));

function restoreSnapshot() {
  mocks.MOCK_COURSES.length = 0;
  mocks.MOCK_COURSES.push(...JSON.parse(JSON.stringify(snapshotCourses)));

  mocks.MOCK_STUDENTS.length = 0;
  mocks.MOCK_STUDENTS.push(...JSON.parse(JSON.stringify(snapshotStudents)));

  mocks.MOCK_UNASSIGNED_STUDENTS.length = 0;
  mocks.MOCK_UNASSIGNED_STUDENTS.push(...JSON.parse(JSON.stringify(snapshotUnassigned)));

  mocks.MOCK_ORDERS_DATA.length = 0;
  mocks.MOCK_ORDERS_DATA.push(...JSON.parse(JSON.stringify(snapshotOrders)));

  mocks.MOCK_APPROVAL_RECORDS.length = 0;
  mocks.MOCK_APPROVAL_RECORDS.push(...JSON.parse(JSON.stringify(snapshotApprovals)));

  mocks.MOCK_LEDGER_RECORDS.length = 0;
  mocks.MOCK_LEDGER_RECORDS.push(...JSON.parse(JSON.stringify(snapshotLedgers)));

  mocks.MOCK_CLASSES.length = 0;
  mocks.MOCK_CLASSES.push(...JSON.parse(JSON.stringify(snapshotClasses)));

  mocks.MOCK_SCHEDULE_EVENTS.length = 0;
  mocks.MOCK_SCHEDULE_EVENTS.push(...JSON.parse(JSON.stringify(snapshotSchedules)));

  mocks.MOCK_ATTENDANCE_RECORDS.length = 0;
  mocks.MOCK_ATTENDANCE_RECORDS.push(...JSON.parse(JSON.stringify(snapshotAttendances)));
}

async function runFullSystemIntegration() {
  const startTime = Date.now();

  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}盛通教育「一校教培系统」全业务闭环穿透端到端集成验证 (Full System Integration)${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  try {
    // -------------------------------------------------------------------------
    // STEP 1: 教研中心 (Curriculum) -> 创建全新标准化课程并跨校区授权
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}【Step 1: 教研中心 -> 创建全新标准化课程并跨校区授权】${colors.reset}`);

    const newCourse = {
      id: 'CRS-INTEG-2026-AI',
      name: '『2026卓越探索』AI大模型与具身机器人高阶实操课',
      code: 'CRS-AI-ROBOT-01',
      cover: mocks.COURSE_COVERS.boutiqueScratch,
      category: '人工智能与机器人',
      attribute: 'regular',
      price: 320,
      totalLessons: 48,
      duration: 90,
      targetAudience: '小学4-6年级 / 初中',
      authorizedCampusIds: ['campus-bj-hq', 'campus-bj-hd', 'campus-bj-cy'], // 授权 HQ, 海淀, 朝阳
      status: 'enabled',
      description: '盛通教育2026重磅推出：深度结合大语言模型与机器人运动控制算法',
      units: [
        {
          id: 'unit-integ-01',
          title: '第1单元：机器人大模型感知与控制交互',
          lessons: [
            { id: 'les-integ-01', name: '第01讲：大模型与具身智能初体验', duration: 90 },
            { id: 'les-integ-02', name: '第02讲：视觉伺服抓取实战', duration: 90 }
          ]
        }
      ]
    };

    const savedCourse = mocks.saveCourse(newCourse);
    assert(savedCourse && savedCourse.id === 'CRS-INTEG-2026-AI', '标准课程成功录入教研中台');
    assert(mocks.MOCK_COURSES.some(c => c.id === 'CRS-INTEG-2026-AI'), '课程库持久化确认');

    // 跨校区授权渗透核验
    const hqCourses = mocks.getCoursesByCampus('campus-bj-hq');
    assert(hqCourses.some(c => c.id === 'CRS-INTEG-2026-AI'), '总部校区可查看并调用全量标准化新课程');

    const hdCourses = mocks.getCoursesByCampus('campus-bj-hd');
    assert(hdCourses.some(c => c.id === 'CRS-INTEG-2026-AI'), '海淀分校（已授权）成功获取该课程授权');

    const cyCourses = mocks.getCoursesByCampus('campus-bj-cy');
    assert(cyCourses.some(c => c.id === 'CRS-INTEG-2026-AI'), '朝阳校区（已授权）成功获取该课程授权');

    const yyCourses = mocks.getCoursesByCampus('campus-bj-yy');
    assert(!yyCourses.some(c => c.id === 'CRS-INTEG-2026-AI'), '远洋校区（未授权）严格不可见该课程');

    const wjCourses = mocks.getCoursesByCampus('campus-bj-wj');
    assert(!wjCourses.some(c => c.id === 'CRS-INTEG-2026-AI'), '望京校区（未授权）严格不可见该课程');

    // 课程启禁用流转
    mocks.toggleCourseStatus('CRS-INTEG-2026-AI', 'disabled');
    assertEqual(mocks.MOCK_COURSES.find(c => c.id === 'CRS-INTEG-2026-AI').status, 'disabled', '课程状态成功置为禁用');
    mocks.toggleCourseStatus('CRS-INTEG-2026-AI', 'enabled');
    assertEqual(mocks.MOCK_COURSES.find(c => c.id === 'CRS-INTEG-2026-AI').status, 'enabled', '课程状态重新激活生效');

    // -------------------------------------------------------------------------
    // STEP 2: 学员中心 (Student Center) -> 录入学员全景档案，选定新课程包签约开单
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}【Step 2: 学员中心 -> 录入学员全景档案，选定新课程包签约开单】${colors.reset}`);

    const newStudentData = {
      id: 'std-integ-888',
      name: '陆向东',
      studentNo: 'S990088',
      gender: 'male',
      age: 11,
      phone: '13811998877',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      status: 'potential',
      grade: '小学五年级',
      school: '中关村第二小学',
      publicSchool: '中关村第二小学',
      parentName: '陆国华',
      parentPhone: '13811998877',
      wechatBound: true,
      faceEntered: true,
      coursePackages: [],
      wallet: { principalBalance: 0, bonusBalance: 0, goldPoints: 0, ledger: [] }
    };

    const registeredStudent = mocks.addStudent(newStudentData);
    assert(registeredStudent && registeredStudent.id === 'std-integ-888', '新学员基础档案 360° 建档成功');
    assert(mocks.MOCK_STUDENTS.some(s => s.id === 'std-integ-888'), '学员库已录入新学员全景资料');

    // 选课签约开单：报名 40 正课 + 赠送 4 课时 = 44 课时，单价 320，优惠 1000 元，实收 11800 元
    const enrollResult = mocks.enrollStudent({
      studentId: 'std-integ-888',
      courseId: 'CRS-INTEG-2026-AI',
      lessonCount: 40,
      bonusLessons: 4,
      pricePerLesson: 320,
      discountAmount: 800,
      couponAmount: 200,
      actualAmount: 11800,
      paymentMethod: 'wechat',
      campusId: 'campus-bj-hd',
      operator: '海淀课程顾问王敏'
    });

    assert(enrollResult.success === true, `学员签约开单流转成功: ${enrollResult.message}`);
    assert(Boolean(enrollResult.packageId), `生成正式课程包 ID: ${enrollResult.packageId}`);
    assert(Boolean(enrollResult.orderNo), `生成业务签约单号: ${enrollResult.orderNo}`);

    // 核验学员状态与课包资产写入
    const activeStudent = mocks.getStudentById('std-integ-888');
    assertEqual(activeStudent.status, 'normal', '学员状态从潜客 (potential) 自动流转为在读 (normal)');
    assertEqual(activeStudent.coursePackages.length, 1, '学员名下已新增 1 个签约课包资产');

    const enrolledPkg = activeStudent.coursePackages[0];
    assertEqual(enrolledPkg.courseId, 'CRS-INTEG-2026-AI', '课包关联课程一致');
    assertEqual(enrolledPkg.totalLessons, 44, '课包总课时为 44 课时 (40正课 + 4赠课)');
    assertEqual(enrolledPkg.remainingLessons, 44, '初始剩余课时精确为 44 课时');
    assertEqual(enrolledPkg.consumedLessons, 0, '初始已消耗课时为 0');
    assertEqual(enrolledPkg.bonusLessons, 4, '赠送课时记录准确为 4 课时');
    assertEqual(enrolledPkg.pricePerLesson, 320, '正课单价记录准确为 320 元/课时');
    assertEqual(enrolledPkg.status, 'active', '课包状态为有效 active');

    // -------------------------------------------------------------------------
    // STEP 3: 财务中心 (Financial Center) -> 订单审核流转，确认到账并生成营收流水
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}【Step 3: 财务中心 -> 订单审核流转，确认到账并生成营收流水】${colors.reset}`);

    // 生成正式财务订单流水
    const newOrder = {
      id: `ord-integ-${Date.now()}`,
      orderNo: enrollResult.orderNo,
      studentId: 'std-integ-888',
      studentName: '陆向东',
      studentNo: 'S990088',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      courseId: 'CRS-INTEG-2026-AI',
      courseName: '『2026卓越探索』AI大模型与具身机器人高阶实操课',
      receivableAmount: 11800,
      actualAmount: 11800,
      discountAmount: 1000,
      paymentMethod: 'wechat',
      paymentChannel: 'wechat_pay',
      chargeType: 'regular',
      status: 'pending_payment',
      orderStatus: 'pending_payment',
      salesOwner: '海淀课程顾问王敏',
      submitter: '海淀课程顾问王敏',
      channel: 'offline_sign',
      invoiceStatus: 'unissued',
      isLocked: false,
      payTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    const persistedOrder = mocks.saveOrder(newOrder);
    assert(mocks.MOCK_ORDERS_DATA.some(o => o.orderNo === enrollResult.orderNo), '财务订单已写入财务中台订单池');

    // 提交三级收款审批流单据
    const paymentApproval = {
      id: `app-integ-pay-${Date.now()}`,
      approvalNo: `PAY-APP-${Date.now()}`,
      businessType: 'payment',
      title: '陆向东-AI大模型机器人课程签约收款审批',
      studentId: 'std-integ-888',
      studentName: '陆向东',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      amount: 11800,
      sourceId: persistedOrder.id,
      orderNo: persistedOrder.orderNo,
      currentStep: 1,
      totalSteps: 3,
      status: 'pending',
      timeline: [],
      createdAt: new Date().toISOString()
    };
    mocks.MOCK_APPROVAL_RECORDS.unshift(paymentApproval);

    // 三级审批流推进
    // 1级：教学课消核实
    const step1Res = mocks.processApprovalRecord(paymentApproval.id, 'pass', '教学主管李明', '课包课时与合同条款核验无误');
    assertEqual(step1Res.currentStep, 2, '第1级 [教学课消核实] 审批通过，流转至第2步');
    assertEqual(step1Res.status, 'pending', '单据处于待审核中');

    // 2级：分校校长审批
    const step2Res = mocks.processApprovalRecord(paymentApproval.id, 'pass', '海淀分校张校长', '同意开单入学');
    assertEqual(step2Res.currentStep, 3, '第2级 [分校校长审批] 审批通过，流转至第3步终审');

    // 3级：财务终审
    const step3Res = mocks.processApprovalRecord(paymentApproval.id, 'pass', '集团财务出纳王芳', '微信对公到账11800元，确认入账');
    assertEqual(step3Res.status, 'approved', '第3级 [财务终审] 办结通过，审批状态达成 approved');

    // 财务订单核销与凭证更新
    persistedOrder.status = 'paid';
    persistedOrder.orderStatus = 'paid';
    const voucherUpdatedOrder = mocks.updateOrderVoucher(persistedOrder.id, {
      transactionId: 'WX-PAY-20260922-9988',
      auditor: '集团财务出纳王芳',
      auditRemark: '微信商户单号入账核实完毕'
    });
    assertEqual(voucherUpdatedOrder.status, 'paid', '订单状态成功流转为已支付 (paid)');
    assertEqual(voucherUpdatedOrder.transactionId, 'WX-PAY-20260922-9988', '收款凭证流水号记录准确');

    // 生成收费流水明细
    mocks.MOCK_LEDGER_RECORDS.unshift({
      id: `led-integ-${Date.now()}`,
      orderNo: persistedOrder.orderNo,
      studentName: '陆向东',
      studentNo: 'S990088',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      type: 'tuition',
      amount: 11800,
      method: 'wechat',
      operator: '集团财务出纳王芳',
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      remark: 'AI大模型高阶实操课签约收款'
    });

    // 财务汇总小计横条 (Summary Strip) 与多校区核算
    const hdOrders = mocks.getOrdersByCampus('campus-bj-hd');
    assert(hdOrders.some(o => o.orderNo === enrollResult.orderNo), '海淀分校可查到该签约订单');

    // 财务防作废守卫核验：已支付订单禁止直接作废
    assertThrows(() => {
      mocks.voidOrder(persistedOrder.id);
    }, 'Cannot void a paid order', '财务风控守卫：已支付订单禁止直接作废 (必须走退费审批流)');

    // -------------------------------------------------------------------------
    // STEP 4: 待分班调度 -> 签约学员自动进入待分班池，班级管理将其编入目标在读班级
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}【Step 4: 待分班调度 -> 签约学员自动进入待分班池，编入目标在读班级】${colors.reset}`);

    // 验证签约学员已自动推入海淀校区待分班池
    const hdUnassignedList = mocks.getUnassignedStudents('campus-bj-hd');
    const unassignedItem = hdUnassignedList.find(u => u.studentId === 'std-integ-888');
    assert(Boolean(unassignedItem), '签约开单后学员自动推入待分班学员池 (MOCK_UNASSIGNED_STUDENTS)');
    assertEqual(unassignedItem.unassignedLessons, 44, '待分班池准确记录待排 44 课时');
    assertEqual(unassignedItem.campusId, 'campus-bj-hd', '待分班归属校区严格匹配海淀分校');

    // 验证其他分校区无法查到该学员 (校区隔离)
    const cyUnassignedList = mocks.getUnassignedStudents('campus-bj-cy');
    assert(!cyUnassignedList.some(u => u.studentId === 'std-integ-888'), '朝阳校区待分班池无海淀签约学员 (隔离生效)');

    // 在教务班级管理设立海淀目标在读班
    const targetClass = mocks.addClass({
      id: 'cls-hd-ai-01',
      name: '海淀AI机器人周日上午班',
      code: 'CLS-HD-AI-2026',
      courseId: 'CRS-INTEG-2026-AI',
      courseName: '『2026卓越探索』AI大模型与具身机器人高阶实操课',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      teacherId: 't-hd-001',
      teacherName: '赵金牌讲师',
      classroomId: 'room-hd-101',
      classroomName: '海淀AI创客实验室',
      capacity: 12,
      currentCount: 0,
      studentIds: [],
      status: 'active'
    });
    assert(targetClass && targetClass.id === 'cls-hd-ai-01', '海淀教务成功设立目标在读班级');

    // 执行分班编入班级
    const assignSuccess = mocks.assignClassToStudent('std-integ-888', targetClass.id, targetClass.name);
    assert(assignSuccess === true, '待分班调度池顺利执行分班绑定');

    // 校验分班后状态流转
    const postUnassignedList = mocks.getUnassignedStudents('campus-bj-hd');
    assert(!postUnassignedList.some(u => u.studentId === 'std-integ-888'), '分班完成后该学员已自动从待分班池移出');

    const assignedStudent = mocks.getStudentById('std-integ-888');
    const assignedPkg = assignedStudent.coursePackages.find(p => p.courseId === 'CRS-INTEG-2026-AI');
    assertEqual(assignedPkg.classId, 'cls-hd-ai-01', '学员课包资产已精准绑定目标班级 ID');
    assertEqual(assignedPkg.className, '海淀AI机器人周日上午班', '学员课包资产已精准绑定目标班级名称');

    // 更新班级花名册
    targetClass.studentIds.push(assignedStudent.id);
    targetClass.currentCount = targetClass.studentIds.length;
    assertEqual(targetClass.currentCount, 1, '班级名额计数器准确递增为 1 人');

    // -------------------------------------------------------------------------
    // STEP 5: 教务排课看板 (Educational Admin) -> 安排网格排课，防撞冲突引擎三维检测
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}【Step 5: 教务排课看板 -> 安排网格排课课次，三维动态防撞引擎检测】${colors.reset}`);

    // 先安排一节已有参照课次
    const baseScheduleEvent = {
      id: 'evt-hd-ref-001',
      classId: 'cls-hd-ref',
      className: '海淀既有班级',
      courseId: 'CRS-EXISTING',
      courseName: '既有课程',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      teacherId: 't-hd-001',
      teacherName: '赵金牌讲师',
      classroomId: 'room-hd-101',
      classroomName: '海淀AI创客实验室',
      date: '2026-09-27',
      startTime: '09:00',
      endTime: '10:30',
      studentIds: ['std-exist-01'],
      status: 'scheduled'
    };
    mocks.MOCK_SCHEDULE_EVENTS.push(baseScheduleEvent);

    // 1. 教师冲突防撞拦截 (同讲师在重叠时段排课)
    const teacherConflictPayload = {
      classId: 'cls-hd-ai-01',
      className: '海淀AI机器人周日上午班',
      teacherId: 't-hd-001', // 同一讲师
      teacherName: '赵金牌讲师',
      classroomId: 'room-hd-102', // 不同教室
      date: '2026-09-27',
      startTime: '10:00',
      endTime: '11:30', // 与 09:00-10:30 重叠 30 分钟
      studentIds: ['std-integ-888']
    };
    const tCollision = mocks.EducationalCollisionEngine.detectCollision(
      teacherConflictPayload,
      mocks.MOCK_SCHEDULE_EVENTS,
      mocks.MOCK_CLASSROOMS
    );
    assert(tCollision.hasConflict === true, '防撞引擎精准拦截讲师时间重叠冲突 (09:00-10:30 与 10:00-11:30)');
    assertEqual(tCollision.conflictType, 'TEACHER_CONFLICT', '冲突类型精准确诊为讲师冲突 (TEACHER_CONFLICT)');

    // 2. 教室冲突防撞拦截 (同教室在重叠时段被占用)
    const roomConflictPayload = {
      classId: 'cls-hd-ai-01',
      className: '海淀AI机器人周日上午班',
      teacherId: 't-hd-002', // 不同讲师
      teacherName: '钱副讲师',
      classroomId: 'room-hd-101', // 同一教室
      date: '2026-09-27',
      startTime: '09:30',
      endTime: '11:00',
      studentIds: ['std-integ-888']
    };
    const rCollision = mocks.EducationalCollisionEngine.detectCollision(
      roomConflictPayload,
      mocks.MOCK_SCHEDULE_EVENTS,
      mocks.MOCK_CLASSROOMS
    );
    assert(rCollision.hasConflict === true, '防撞引擎精准拦截教室时间重叠冲突 (09:30-11:00 与 09:00-10:30)');
    assertEqual(rCollision.conflictType, 'CLASSROOM_CONFLICT', '冲突类型精准确诊为教室冲突 (CLASSROOM_CONFLICT)');

    // 3. 学员并发排课冲突拦截
    const studentConflictPayload = {
      classId: 'cls-hd-other',
      className: '海淀奥数班',
      teacherId: 't-hd-003',
      classroomId: 'room-hd-103',
      date: '2026-09-27',
      startTime: '09:15',
      endTime: '10:45',
      studentIds: ['std-exist-01'] // 同一学员
    };
    const sCollision = mocks.EducationalCollisionEngine.detectCollision(
      studentConflictPayload,
      mocks.MOCK_SCHEDULE_EVENTS,
      mocks.MOCK_CLASSROOMS
    );
    assert(sCollision.hasConflict === true, '防撞引擎精准拦截学员并发排课时间重叠冲突');
    assertEqual(sCollision.conflictType, 'STUDENT_CONFLICT', '冲突类型精准确诊为学员并发冲突 (STUDENT_CONFLICT)');

    // 4. 营业时间窗口 (07:00-22:00) 边界与跨午夜阻断
    const earlyCheck = mocks.EducationalCollisionEngine.validateScheduleTimeWindow('06:30', '08:00');
    assert(earlyCheck.valid === false, '营业时间早于 07:00 被坚决阻断');

    const lateCheck = mocks.EducationalCollisionEngine.validateScheduleTimeWindow('21:30', '22:30');
    assert(lateCheck.valid === false, '营业时间晚于 22:00 跨时段被坚决阻断');

    // 移除参照课次，安排真实正式上课课次
    const refIdx = mocks.MOCK_SCHEDULE_EVENTS.findIndex(e => e.id === 'evt-hd-ref-001');
    if (refIdx >= 0) mocks.MOCK_SCHEDULE_EVENTS.splice(refIdx, 1);

    // 安排正式网格排课：2026-09-27 周日 09:00-10:30
    const formalEventPayload = {
      id: 'evt-hd-ai-001',
      classId: 'cls-hd-ai-01',
      className: '海淀AI机器人周日上午班',
      courseId: 'CRS-INTEG-2026-AI',
      courseName: '『2026卓越探索』AI大模型与具身机器人高阶实操课',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      teacherId: 't-hd-001',
      teacherName: '赵金牌讲师',
      classroomId: 'room-hd-101',
      classroomName: '海淀AI创客实验室',
      date: '2026-09-27',
      startTime: '09:00',
      endTime: '10:30',
      lessonNumber: 1,
      lessonTitle: '第01讲：大模型与具身智能初体验',
      studentIds: ['std-integ-888'],
      status: 'scheduled'
    };

    const scheduleRes = mocks.addScheduleEvent(formalEventPayload, false);
    assert(scheduleRes.success === true, '网格排课成功');
    assertEqual(scheduleRes.collision.hasConflict, false, '无时间与资源冲突');
    assertEqual(scheduleRes.event.semanticType, 'regular', '课次语义卡片类型为常规蓝色 (regular)');
    assert(mocks.MOCK_SCHEDULE_EVENTS.some(e => e.id === 'evt-hd-ai-001'), '课次成功持久化于 MOCK_SCHEDULE_EVENTS');

    // -------------------------------------------------------------------------
    // STEP 6: 讲台考勤消课 (Attendance) -> 授课点名消课，学员课包剩余课时真实扣减
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}【Step 6: 讲台考勤消课 -> 授课点名消课，学员课包剩余课时精确真实扣减】${colors.reset}`);

    // 点名消课前课包状态留样
    const studentBeforeRollCall = mocks.getStudentById('std-integ-888');
    const pkgBefore = studentBeforeRollCall.coursePackages.find(p => p.courseId === 'CRS-INTEG-2026-AI');
    assertEqual(pkgBefore.remainingLessons, 44, '消课前课包剩余课时严格为 44');
    assertEqual(pkgBefore.consumedLessons, 0, '消课前课包已消耗课时严格为 0');

    // 讲台点名消课：出勤 (present)，单次扣减 2 课时
    const rollCallRes = mocks.submitRollCall(
      'evt-hd-ai-001',
      [
        {
          studentId: 'std-integ-888',
          studentName: '陆向东',
          status: 'present',
          deductionLessons: 2,
          remark: '具身机器人感知控制实操达成优异，全勤到课'
        }
      ],
      '赵金牌讲师'
    );

    assert(rollCallRes.success === true, `授课点名消课结算成功: ${rollCallRes.message}`);
    assert(Boolean(rollCallRes.attendanceRecord), '生成正式考勤课消流水记录 (AttendanceRecord)');

    // 验证课次状态演进
    const scheduledEventAfter = mocks.MOCK_SCHEDULE_EVENTS.find(e => e.id === 'evt-hd-ai-001');
    assertEqual(scheduledEventAfter.status, 'completed', '课次日程状态更新为已完成 (completed)');
    assertEqual(scheduledEventAfter.semanticType, 'completed', '卡片语义更新为已结课绿色 (completed)');
    assertEqual(scheduledEventAfter.attendanceCount, 1, '实到出勤人数更新为 1');

    // 验证学员课包剩余课时真实扣减与已消耗累加
    const studentAfterRollCall = mocks.getStudentById('std-integ-888');
    const pkgAfter = studentAfterRollCall.coursePackages.find(p => p.courseId === 'CRS-INTEG-2026-AI');
    assertEqual(pkgAfter.remainingLessons, 42, '消课后课包剩余课时精确扣减为 42 课时 (44 - 2)');
    assertEqual(pkgAfter.consumedLessons, 2, '消课后课包已消耗课时精确递增为 2 课时 (0 + 2)');

    // 验证学员上课成长轨迹自动写入
    assert(studentAfterRollCall.learningRecords.length >= 1, '学员个人学习成长记录自动沉淀');
    const latestRecord = studentAfterRollCall.learningRecords[0];
    assertEqual(latestRecord.status, 'attended', '成长档案记录状态为 attended');
    assertEqual(latestRecord.teacher, '赵金牌讲师', '授课讲师信息准确记录');

    // 验证考勤记录明细已归档
    const attRec = mocks.MOCK_ATTENDANCE_RECORDS.find(r => r.scheduleEventId === 'evt-hd-ai-001');
    assert(Boolean(attRec), '考勤中台持久化考勤记录');
    assertEqual(attRec.isReversed, false, '初始考勤记录反结课标志为 false');
    assertEqual(attRec.deductedLessonsTotal, 2, '总扣减课时记录为 2 课时');

    // -------------------------------------------------------------------------
    // STEP 7: 反结课冲正机制 (Revert Lesson) -> 扣减课时原路退还冲正回学员课包与防重幂等
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}【Step 7: 反结课冲正机制 -> 扣减课时原路退还冲正回学员课包与防重幂等】${colors.reset}`);

    // 执行反结课冲正 (家长反馈调课补上，撤回误消课)
    const revertRes = mocks.revertAttendance(
      attRec.id,
      '家长反馈实操课补课调整申请反结课冲正',
      '海淀分校教务主管'
    );

    assert(revertRes.success === true, `反结课冲正执行成功: ${revertRes.message}`);

    // 验证考勤记录标记
    assertEqual(attRec.isReversed, true, '考勤记录状态标记为已冲正 (isReversed = true)');
    assertEqual(attRec.reversedBy, '海淀分校教务主管', '冲正操作人记录完整');
    assert(Boolean(attRec.reversedAt), '冲正审计时间截面记录完整');

    // 验证学员课包扣减课时原路全额退还
    const studentAfterRevert = mocks.getStudentById('std-integ-888');
    const pkgReverted = studentAfterRevert.coursePackages.find(p => p.courseId === 'CRS-INTEG-2026-AI');
    assertEqual(pkgReverted.remainingLessons, 44, '反结课后剩余课时原路冲正退还为 44 课时 (42 + 2)');
    assertEqual(pkgReverted.consumedLessons, 0, '反结课后已消耗课时精确还原为 0 课时 (2 - 2)');

    // 验证课次日程状态还原为 scheduled 待上
    assertEqual(scheduledEventAfter.status, 'scheduled', '课表日程课次状态自动复原为待上 (scheduled)');
    assertEqual(scheduledEventAfter.attendanceCount, 0, '课次签到人数清零');

    // 核心风控对抗：防重复反向刷课时幂等性守护 (Duplicate Reversal Prevention)
    const duplicateRevertRes = mocks.revertAttendance(attRec.id, '恶意重复冲正尝试', '黑客测试');
    assert(duplicateRevertRes.success === false, '对已冲正记录进行二次反结课被坚决阻断 (防重复冲正生效)');
    assert(duplicateRevertRes.message.includes('不可重复操作'), '拦截提示文案准确清晰');
    assertEqual(pkgReverted.remainingLessons, 44, '课包课时绝对守恒，未发生课时虚增漏洞');

    // -------------------------------------------------------------------------
    // STEP 8: 异常退费多级审批 (Approval Flow) -> 提交学员退费审批，终审后原订单负数冲正锁定
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}【Step 8: 异常退费多级审批 -> 提交学员退费审批，终审通过后原订单负数冲正锁定】${colors.reset}`);

    // 1. 学员因家庭搬迁发起退费异动
    // 课包当前状态：剩余 44 课时，含 4 赠课，40 正课。正课单价 320 元。
    // 盛通核心退费公式：可退金额 = (44 - 4) * 320 - 手续教材费 200 = 12600 元
    const refundMovementRes = mocks.applyAbnormalMovement({
      movementType: 'refund',
      studentId: 'std-integ-888',
      packageId: pkgReverted.packageId,
      reason: '学员家庭因工作外派迁出北京',
      deductionFee: 200,
      operator: '海淀教务主管'
    });

    assert(refundMovementRes.success === true, `退费异动核算成功: ${refundMovementRes.message}`);
    assertEqual(refundMovementRes.refundAmount, 12600, '依规计算应退金额严格为 12600.00 元 (赠送课时不折现并扣除教材工本费)');
    assertEqual(pkgReverted.status, 'refunded', '课包状态归档为已退费 (refunded)');
    assertEqual(pkgReverted.remainingLessons, 0, '退费后课包剩余课时清零');
    assertEqual(studentAfterRevert.status, 'dropped_out', '学员名下已无有效课包，状态翻转为已流失/退学 (dropped_out)');

    // 2. 提交财务中心退费三级审批单
    const refundApproval = {
      id: `app-integ-refund-${Date.now()}`,
      approvalNo: `REF-APP-${Date.now()}`,
      businessType: 'refund',
      title: '陆向东-AI大模型机器人课程退学退费审批',
      studentId: 'std-integ-888',
      studentName: '陆向东',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      amount: 12600,
      sourceId: persistedOrder.id,
      orderNo: persistedOrder.orderNo,
      currentStep: 1,
      totalSteps: 3,
      status: 'pending',
      timeline: [],
      createdAt: new Date().toISOString()
    };
    mocks.MOCK_APPROVAL_RECORDS.unshift(refundApproval);

    // 3. 推进退费三级审批流
    // 审批节点 1: 教学主管核实
    const rStep1 = mocks.processApprovalRecord(refundApproval.id, 'pass', '教学主任', '核实剩余课时无未结课消');
    assertEqual(rStep1.currentStep, 2, '退费审批流推进至第2步');

    // 审批节点 2: 校区校长审批
    const rStep2 = mocks.processApprovalRecord(refundApproval.id, 'pass', '海淀分校张校长', '核准退费申请');
    assertEqual(rStep2.currentStep, 3, '退费审批流推进至第3步终审');

    // 审批节点 3: 财务总监终审
    const rStep3 = mocks.processApprovalRecord(refundApproval.id, 'pass', '集团财务总监', '原路退款已划拨');
    assertEqual(rStep3.status, 'approved', '退费审批单终审办结完成');

    // 4. 业务联动反哺核验：关联的原订单是否被负数红字冲正且加锁
    const affectedOrder = mocks.MOCK_ORDERS_DATA.find(o => o.id === persistedOrder.id);
    assertEqual(affectedOrder.actualAmount, -12600, '原订单实际金额被原子级反哺更新为负数退款金额 -12600.00 元');
    assertEqual(affectedOrder.receivableAmount, -12600, '原订单应收金额同步被冲正为 -12600.00 元');
    assertEqual(affectedOrder.isLocked, true, '原订单已被财务账期安全锁定 (isLocked = true)');
    assert(affectedOrder.verifyRemark.includes('终审通过已执行退款'), '原订单财务批注记录退费审批单关联审计信息');

    // 5. 订单加锁防篡改防线核验
    assertThrows(() => {
      mocks.updateOrder({ id: affectedOrder.id, salesOwner: '黑产黑客' });
    }, 'Order is locked by finance closing cycle', '财务风控防线：已被锁定的退费订单禁止任何字段修改');

    // -------------------------------------------------------------------------
    // STEP 9: 顶部校区动态穿透联动 (Tenant & Multi-Campus Scope) -> 5大校区上下文隔离
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}【Step 9: 顶部校区动态穿透联动 -> 5大校区上下文数据作用域实时重载隔离】${colors.reset}`);

    const CAMPUS_HQ = 'campus-bj-hq';
    const CAMPUS_YY = 'campus-bj-yy';
    const CAMPUS_CY = 'campus-bj-cy';
    const CAMPUS_HD = 'campus-bj-hd';
    const CAMPUS_WJ = 'campus-bj-wj';

    const ALL_CAMPUSES = [CAMPUS_HQ, CAMPUS_YY, CAMPUS_CY, CAMPUS_HD, CAMPUS_WJ];
    const BRANCH_CAMPUSES = [CAMPUS_YY, CAMPUS_CY, CAMPUS_HD, CAMPUS_WJ];

    // 1. 学员中心多校区正交互斥隔离核验 (HQ: 6, YY: 4, CY: 4, HD: 4, WJ: 4)
    const hqStudents = mocks.getStudentsByCampus(CAMPUS_HQ);
    const yyStudents = mocks.getStudentsByCampus(CAMPUS_YY);
    const cyStudents = mocks.getStudentsByCampus(CAMPUS_CY);
    const hdStudents = mocks.getStudentsByCampus(CAMPUS_HD);
    const wjStudents = mocks.getStudentsByCampus(CAMPUS_WJ);

    assert(hqStudents.length >= 6, `总部校区归属学员数满足基线 (${hqStudents.length})`);
    assert(yyStudents.length >= 4, `远洋校区归属学员数满足基线 (${yyStudents.length})`);
    assert(cyStudents.length >= 4, `朝阳校区归属学员数满足基线 (${cyStudents.length})`);
    assert(hdStudents.length >= 4, `海淀分校归属学员数满足基线 (${hdStudents.length})`);
    assert(wjStudents.length >= 4, `望京校区归属学员数满足基线 (${wjStudents.length})`);

    // 校验任意校区查询返回的全部学员其 campusId 必须与目标校区 100% 严格一致
    for (const cid of ALL_CAMPUSES) {
      const list = mocks.getStudentsByCampus(cid);
      assert(list.every(s => s.campusId === cid), `校区 [${cid}] 学员列表严格 100% 归属于该校区`);
    }

    // 校验 5 大校区学员集合两两互不相交 (Disjoint Partition Invariant)
    const campusStudentSets = {};
    for (const cid of ALL_CAMPUSES) {
      campusStudentSets[cid] = new Set(mocks.getStudentsByCampus(cid).map(s => s.id));
    }
    for (let i = 0; i < ALL_CAMPUSES.length; i++) {
      for (let j = i + 1; j < ALL_CAMPUSES.length; j++) {
        const c1 = ALL_CAMPUSES[i];
        const c2 = ALL_CAMPUSES[j];
        const set1 = campusStudentSets[c1];
        const set2 = campusStudentSets[c2];
        let hasOverlap = false;
        for (const id of set1) {
          if (set2.has(id)) {
            hasOverlap = true;
            break;
          }
        }
        assertEqual(hasOverlap, false, `校区 [${c1}] 与 [${c2}] 学员集合严格互斥，交集为 0`);
      }
    }

    // 2. 统计看板 getCampusStats 动态多校区聚合核验
    for (const cid of ALL_CAMPUSES) {
      const stats = mocks.getCampusStats(cid);
      assert(stats.studentCount > 0, `校区 [${cid}] 统计看板正确统计学员总数 (${stats.studentCount})`);
      assert(stats.courseCount > 0, `校区 [${cid}] 统计看板正确统计授权课程数 (${stats.courseCount})`);
    }

    // 2. 教务排课日程与考勤多校区动态隔离核验
    for (const cid of ALL_CAMPUSES) {
      const events = mocks.getScheduleEvents({ campusId: cid });
      if (cid !== CAMPUS_HQ) {
        assert(events.every(e => e.campusId === cid), `分校区 [${cid}] 排课日程仅返回归属本校区的课次`);
      }
      const attendances = mocks.getAttendanceRecords(cid);
      if (cid !== CAMPUS_HQ) {
        assert(attendances.every(a => a.campusId === cid), `分校区 [${cid}] 考勤流水仅返回归属本校区的单据`);
      }
    }

    // 3. 班级、教室与讲师多校区动态隔离核验
    for (const cid of BRANCH_CAMPUSES) {
      const classes = mocks.getClasses({ campusId: cid });
      assert(classes.every(c => c.campusId === cid), `分校区 [${cid}] 班级资源完全物理隔离`);

      const classrooms = mocks.getClassrooms(cid);
      assert(classrooms.every(r => r.campusId === cid), `分校区 [${cid}] 教室场地完全物理隔离`);

      const teachers = mocks.getTeachers(cid);
      assert(teachers.every(t => t.campusId === cid), `分校区 [${cid}] 讲师师资完全物理隔离`);
    }

    // 4. 财务订单流水与多级审批多校区动态隔离核验
    for (const cid of BRANCH_CAMPUSES) {
      const orders = mocks.getOrdersByCampus(cid);
      assert(orders.every(o => mocks.isCampusMatch(o.campusId, cid)), `分校区 [${cid}] 财务订单流水严格隔离无泄漏`);

      const approvals = mocks.getApprovalRecords(cid);
      assert(approvals.every(a => mocks.isCampusMatch(a.campusId, cid)), `分校区 [${cid}] 财务审批单严格隔离无泄漏`);

      const ledgers = mocks.getLedgerRecords(cid);
      assert(ledgers.every(l => mocks.isCampusMatch(l.campusId, cid)), `分校区 [${cid}] 收费流水账本严格隔离无泄漏`);
    }

    // 5. 非法校区 ID 渗透攻击与安全防御
    const illegalIds = ['evil-injection', '<script>alert(1)</script>', '__proto__', 'UNKNOWN_CAMPUS_999'];
    for (const badId of illegalIds) {
      const badOrders = mocks.getOrdersByCampus(badId);
      assertEqual(badOrders.length, 0, `非法校区 [${badId}] 订单查询返回 0 项，安全阻断`);

      const badStudents = mocks.getStudents({ campusId: badId });
      assertEqual(badStudents.length, 0, `非法校区 [${badId}] 学员查询返回 0 项，安全阻断`);

      const badClasses = mocks.getClasses({ campusId: badId });
      assertEqual(badClasses.length, 0, `非法校区 [${badId}] 班级查询返回 0 项，安全阻断`);

      const badSchedules = mocks.getScheduleEvents({ campusId: badId });
      assertEqual(badSchedules.length, 0, `非法校区 [${badId}] 排课查询返回 0 项，安全阻断`);
    }

  } finally {
    // 彻底复原 Mock 数据现场快照 (Zero-Pollution Invariant)
    restoreSnapshot();
    console.log(`\n${colors.bold}${colors.green}【Zero-Pollution Invariant: 现场初始快照已 100% 幂等完整复原】${colors.reset}`);
  }

  const durationMs = Date.now() - startTime;
  console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}全系统业务链路穿透联调与全系统集成验证执行总结报告${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`  总断言检验项: ${colors.bold}${totalChecks}${colors.reset}`);
  console.log(`  通过校验项数: ${colors.green}${colors.bold}${passedChecks}${colors.reset}`);
  console.log(`  失败校验项数: ${failedChecks > 0 ? colors.red : colors.green}${colors.bold}${failedChecks}${colors.reset}`);
  console.log(`  集成耗时: ${durationMs}ms`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  if (failedChecks > 0) {
    console.error(`${colors.red}❌ 全系统业务链路穿透联调未完全通过，存在 ${failedChecks} 项异常。${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.bold}${colors.green}🎉 恭喜！跨 5 大业务模块 9 大核心穿透链路全部通过验证 (通过率 100.0%)！系统生产就绪。${colors.reset}\n`);
    process.exit(0);
  }
}

runFullSystemIntegration().catch(err => {
  console.error('Fatal integration error:', err);
  process.exit(1);
});
