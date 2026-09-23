/**
 * Milestone 4 排课矩阵与点名消课反结课链路对抗验证测试套件 (Challenger M4-2)
 * 纯 Node.js 原生沙箱标准执行，严禁使用 BypassSandbox 参数，严禁修改业务源码！
 * 
 * 对抗验证职责：
 * 1. 授课点名消课扣减课时真实闭环测试：
 *    - 模拟调用 submitRollCall：验证到课学员课包真实扣减剩余课时、递增已消耗课时并生成学习轨迹记录；
 *    - 请假学员不扣减课时；
 *    - 混合出勤（到课/迟到/请假/旷课）差异化课消与课次实到统计；
 *    - 极端测试：课包剩余 0 课时时的消课防下溢处理；
 *    - 负向入参防御（不存在课次、无课包学员）。
 * 2. 反结课冲正机制闭环测试：
 *    - 模拟调用 revertAttendance：验证已扣减的课时是否原路返还冲正回学员课包；
 *    - 考勤记录状态是否准确变更为 isReversed: true，并记录冲正审计时间、操作人与原因；
 *    - 关联排课课次状态与考勤计数精确复原为待上 (scheduled) 状态；
 *    - 对已反结课记录进行二次重复反结课时的防重复幂等性测试（课时防虚增幂等性守护）；
 *    - 历史已反结课记录再次冲正拦截；
 *    - 负向单号防护。
 * 3. 批量排课与防撞冲突引擎对抗验证：
 *    - 模拟按周连续批量排课 (batchScheduleClass)，验证周期日期推进与 lessonNumber 递增；
 *    - 冲突课次精准被标识或拦截 (forceIfConflict 开关)；
 *    - 三维防撞（讲师、教室、学员）与教室容量超限精准诊断；
 *    - 早07:00/晚22:00时间窗口边界与跨午夜阻断；
 *    - Lane 染色自适应并列多列排布与百分比坐标计算。
 * 4. 多校区上下文联动与数据动态隔离测试：
 *    - 验证 5 大校区（HQ, YY, CY, HD, WJ）在排课、考勤、班级、教室、讲师层面的精确动态隔离；
 *    - 非法/注入校区 ID 安全防御与零泄漏。
 * 5. 测试数据现场隔离与状态幂等复原 (Zero-Pollution Invariant)：
 *    - 现场全量快照捕获与完全复原，确保不污染 runner.js 既有 287 项用例。
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

// 终端颜色输出辅助
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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Failed'}: Expected [${expected}] but received [${actual}]`);
  }
}

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ${colors.green}✓ PASS:${colors.reset} ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err });
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} ${name}`);
    console.log(`    ${colors.yellow}Error: ${err.message}${colors.reset}`);
    console.log(`    ${colors.yellow}Stack: ${err.stack}${colors.reset}`);
  }
}

console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}盛通教育「一校教培系统」Milestone 4 排课矩阵与点名消课反结课链路对抗验证 (Challenger M4-2)${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

// 5 大实体校区常量
const CAMPUS_HQ = 'campus-bj-hq';  // 总部校区
const CAMPUS_YY = 'campus-bj-yy';  // 远洋校区
const CAMPUS_CY = 'campus-bj-cy';  // 朝阳校区
const CAMPUS_HD = 'campus-bj-hd';  // 海淀分校
const CAMPUS_WJ = 'campus-bj-wj';  // 望京校区

const BRANCH_CAMPUSES = [CAMPUS_YY, CAMPUS_CY, CAMPUS_HD, CAMPUS_WJ];

// 保存初始 Mock 数据深拷贝快照以供测试后精确复原
const snapshotStudents = JSON.parse(JSON.stringify(mocks.MOCK_STUDENTS));
const snapshotScheduleEvents = JSON.parse(JSON.stringify(mocks.MOCK_SCHEDULE_EVENTS));
const snapshotAttendanceRecords = JSON.parse(JSON.stringify(mocks.MOCK_ATTENDANCE_RECORDS));
const snapshotClasses = JSON.parse(JSON.stringify(mocks.MOCK_CLASSES));

// -----------------------------------------------------------------------------
// DIMENSION 1: 授课点名消课扣减课时真实闭环测试
// -----------------------------------------------------------------------------
console.log(`${colors.bold}【Dimension 1: 授课点名消课扣减课时真实闭环测试】${colors.reset}`);

test('1.1 到课学员 (present) 课包真实扣减剩余课时、递增已消耗课时并生成学习轨迹', () => {
  // 选取一位具备有效课包的测试学员
  const stu = mocks.MOCK_STUDENTS.find(s => s.coursePackages && s.coursePackages.length > 0);
  assert(stu, '必须存在初始学员');
  const pkg = stu.coursePackages[0];
  const initialRemaining = pkg.remainingLessons;
  const initialConsumed = pkg.consumedLessons || 0;
  const initialRecordsCount = (stu.learningRecords || []).length;

  // 创建排课课次
  const scheduleRes = mocks.addScheduleEvent({
    className: '对抗点名测试班级A',
    courseId: pkg.courseId,
    courseName: pkg.courseName,
    campusId: CAMPUS_HQ,
    teacherId: 't-001',
    teacherName: '张老师',
    classroomId: 'room-101',
    date: '2026-10-15',
    startTime: '09:00',
    endTime: '10:30',
    studentIds: [stu.id],
    lessonNumber: 5,
    lessonTitle: '第5讲：对抗消课实操'
  }, true);

  assertEqual(scheduleRes.success, true, '创建排课课次必须成功');
  const eventId = scheduleRes.event.id;

  // 调用 submitRollCall 进行点名消课
  const rollCallRes = mocks.submitRollCall(eventId, [
    {
      studentId: stu.id,
      studentName: stu.name,
      status: 'present',
      deductionLessons: 1,
      remark: '课堂表现优异，完美完成任务'
    }
  ], '对抗测试学管');

  assertEqual(rollCallRes.success, true, '点名消课必须返回 success: true');
  assert(rollCallRes.attendanceRecord, '必须生成考勤记录');
  assertEqual(rollCallRes.attendanceRecord.deductedLessonsTotal, 1, '总扣减课时必须为 1');
  assertEqual(rollCallRes.attendanceRecord.presentCount, 1, '到课人数应为 1');

  // 验证学员课包资产真实扣减与递增
  assertEqual(pkg.remainingLessons, initialRemaining - 1, '学员剩余课时必须精确扣减 1');
  assertEqual(pkg.consumedLessons, initialConsumed + 1, '学员已消耗课时必须精确递增 1');

  // 验证学习轨迹记录真实生成
  assert(stu.learningRecords && stu.learningRecords.length === initialRecordsCount + 1, '学员学习轨迹必须新增 1 条');
  const latestRecord = stu.learningRecords[0];
  assertEqual(latestRecord.courseName, pkg.courseName, '学习轨迹中课程名匹配');
  assertEqual(latestRecord.teacher, '张老师', '学习轨迹中讲师匹配');
  assertEqual(latestRecord.status, 'attended', '学习轨迹中状态标记为 attended');
  assertEqual(latestRecord.comment, '课堂表现优异，完美完成任务', '学习轨迹中评语匹配');

  // 验证课次状态流转
  const updatedEvt = mocks.MOCK_SCHEDULE_EVENTS.find(e => e.id === eventId);
  assert(updatedEvt, '课次应存在');
  assertEqual(updatedEvt.status, 'completed', '课次状态必须变更为 completed');
  assertEqual(updatedEvt.semanticType, 'completed', '语义类型必须变更为 completed');
  assertEqual(updatedEvt.attendanceCount, 1, '课次实到人数必须记录为 1');
});

test('1.2 请假学员 (leave) 与旷课学员 (absent 且 0 扣减) 课时绝对守恒核验', () => {
  const stu = mocks.MOCK_STUDENTS[1];
  assert(stu && stu.coursePackages && stu.coursePackages.length > 0, '测试学员应具备课包');
  const pkg = stu.coursePackages[0];
  const initialRemaining = pkg.remainingLessons;
  const initialConsumed = pkg.consumedLessons || 0;
  const initialRecordsCount = (stu.learningRecords || []).length;

  const scheduleRes = mocks.addScheduleEvent({
    className: '请假课时守恒测试班级',
    courseId: pkg.courseId,
    courseName: pkg.courseName,
    campusId: CAMPUS_HQ,
    teacherId: 't-002',
    teacherName: '李老师',
    classroomId: 'room-102',
    date: '2026-10-16',
    startTime: '14:00',
    endTime: '15:30',
    studentIds: [stu.id]
  }, true);

  const eventId = scheduleRes.event.id;

  // 模拟请假学员点名：status: 'leave', deductionLessons: 0
  const rollCallRes = mocks.submitRollCall(eventId, [
    {
      studentId: stu.id,
      studentName: stu.name,
      status: 'leave',
      deductionLessons: 0,
      remark: '因流感请假'
    }
  ], '对抗测试学管');

  assertEqual(rollCallRes.success, true);
  assertEqual(rollCallRes.attendanceRecord.leaveCount, 1, '请假人数应为 1');
  assertEqual(rollCallRes.attendanceRecord.presentCount, 0, '到课人数应为 0');
  assertEqual(rollCallRes.attendanceRecord.deductedLessonsTotal, 0, '请假总扣减课时应为 0');

  // 验证学员课包绝对守恒，不得产生任何虚假扣除
  assertEqual(pkg.remainingLessons, initialRemaining, '请假学员剩余课时必须保持守恒不变');
  assertEqual(pkg.consumedLessons, initialConsumed, '请假学员已消耗课时必须保持守恒不变');
  assertEqual((stu.learningRecords || []).length, initialRecordsCount, '扣课时为0时不应写入消课学习记录');
});

test('1.3 混合出勤（到课/迟到/请假/旷课）四态同堂点名与差异化消课统计', () => {
  // 准备 4 位学员
  const students = mocks.MOCK_STUDENTS.slice(0, 4);
  assertEqual(students.length, 4, '需要 4 位基线学员');

  const sPresent = students[0];
  const sLate = students[1];
  const sLeave = students[2];
  const sAbsent = students[3];

  const pkgPresent = sPresent.coursePackages[0];
  const pkgLate = sLate.coursePackages[0];
  const pkgLeave = sLeave.coursePackages[0];
  const pkgAbsent = sAbsent.coursePackages[0];

  const beforeRemainingP = pkgPresent.remainingLessons;
  const beforeRemainingL = pkgLate.remainingLessons;
  const beforeRemainingLev = pkgLeave.remainingLessons;
  const beforeRemainingAbs = pkgAbsent.remainingLessons;

  const scheduleRes = mocks.addScheduleEvent({
    className: '混合出勤多学员点名班级',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    campusId: CAMPUS_HQ,
    teacherId: 't-001',
    teacherName: '张老师',
    classroomId: 'room-101',
    date: '2026-10-17',
    startTime: '10:00',
    endTime: '11:30',
    studentIds: students.map(s => s.id)
  }, true);

  const eventId = scheduleRes.event.id;

  const attendances = [
    { studentId: sPresent.id, studentName: sPresent.name, status: 'present', deductionLessons: 1, remark: '准时' },
    { studentId: sLate.id, studentName: sLate.name, status: 'late', deductionLessons: 1, remark: '迟到10分钟' },
    { studentId: sLeave.id, studentName: sLeave.name, status: 'leave', deductionLessons: 0, remark: '家事请假' },
    { studentId: sAbsent.id, studentName: sAbsent.name, status: 'absent', deductionLessons: 0, remark: '无故未到' }
  ];

  const rollCallRes = mocks.submitRollCall(eventId, attendances, '授课主教');
  assertEqual(rollCallRes.success, true);
  const rec = rollCallRes.attendanceRecord;

  // 验证考勤四态统计指标
  assertEqual(rec.totalStudents, 4, '应到总人数应为 4');
  assertEqual(rec.presentCount, 1, '到课人数应为 1');
  assertEqual(rec.lateCount, 1, '迟到人数应为 1');
  assertEqual(rec.leaveCount, 1, '请假人数应为 1');
  assertEqual(rec.absentCount, 1, '旷课人数应为 1');
  assertEqual(rec.deductedLessonsTotal, 2, '共计扣减课时应为 2 (到课1 + 迟到1)');

  // 验证实到课次统计 (present + late)
  const evt = mocks.MOCK_SCHEDULE_EVENTS.find(e => e.id === eventId);
  assertEqual(evt.attendanceCount, 2, '课次实到人数应为 presentCount + lateCount = 2');

  // 验证各学员课包扣减情况
  assertEqual(pkgPresent.remainingLessons, beforeRemainingP - 1, '到课学员扣 1 课时');
  assertEqual(pkgLate.remainingLessons, beforeRemainingL - 1, '迟到学员扣 1 课时');
  assertEqual(pkgLeave.remainingLessons, beforeRemainingLev, '请假学员课时守恒');
  assertEqual(pkgAbsent.remainingLessons, beforeRemainingAbs, '旷课且0消课学员课时守恒');
});

test('1.4 极端测试：课包剩余 0 课时学员强制消课防下溢守恒 (Underflow Protection)', () => {
  // 构造一位剩余 0 课时的学员课包
  const testStudent = mocks.addStudent({
    name: '0课时极端对抗学员',
    campusId: CAMPUS_HQ,
    coursePackages: [{
      packageId: 'pkg-zero-lessons-test',
      courseId: 'course-scratch-001',
      courseName: '012-软编Scratch创意图形编程',
      totalLessons: 20,
      remainingLessons: 0, // 初始已无剩余课时
      consumedLessons: 20,
      status: 'active'
    }]
  });

  const scheduleRes = mocks.addScheduleEvent({
    className: '0课时消课压力测试课次',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    campusId: CAMPUS_HQ,
    teacherId: 't-001',
    classroomId: 'room-101',
    date: '2026-10-18',
    startTime: '16:00',
    endTime: '17:30',
    studentIds: [testStudent.id]
  }, true);

  const rollCallRes = mocks.submitRollCall(scheduleRes.event.id, [
    {
      studentId: testStudent.id,
      studentName: testStudent.name,
      status: 'present',
      deductionLessons: 1
    }
  ]);

  assertEqual(rollCallRes.success, true);
  const pkg = testStudent.coursePackages[0];

  // 验证底线保护：Math.max(0, 0 - 1) 严密防止剩余课时变为 -1
  assertEqual(pkg.remainingLessons, 0, '课包剩余课时必须被下限 0 截断保护，严防变成负数资产漏洞');
  assertEqual(pkg.consumedLessons, 21, '已消耗课时可如实记录增加');
  assertEqual(rollCallRes.attendanceRecord.studentAttendances[0].remainingLessonsBefore, 0);
  assertEqual(rollCallRes.attendanceRecord.studentAttendances[0].remainingLessonsAfter, 0);
});

test('1.5 授课点名负向边界拦截：不存在的 scheduleEventId 安全阻断', () => {
  const fakeRes = mocks.submitRollCall('evt-ghost-non-existent-99999', [
    { studentId: 'std-001', studentName: '张小萌', status: 'present', deductionLessons: 1 }
  ]);
  assertEqual(fakeRes.success, false, '对不存在课次点名必须返回 false');
  assertEqual(fakeRes.message, '排课课次不存在', '返回合规阻断提示');
});

// -----------------------------------------------------------------------------
// DIMENSION 2: 反结课冲正机制闭环测试与幂等性对抗
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 2: 反结课冲正机制闭环测试与幂等性对抗】${colors.reset}`);

test('2.1 反结课冲正：已扣减课时原路全额返还冲正回学员课包与课次状态复原', () => {
  // 建立一个刚消课完成的真实业务场景
  const stu = mocks.getStudentById('std-001');
  assert(stu && stu.coursePackages && stu.coursePackages.length > 0, '基线学员必须存在');
  const pkg = stu.coursePackages[0];
  const initialRemaining = pkg.remainingLessons;
  const initialConsumed = pkg.consumedLessons;

  // 1. 排课并点名消课 1 课时
  const addRes = mocks.addScheduleEvent({
    className: '反结课冲正链路验证课次',
    courseId: pkg.courseId,
    courseName: pkg.courseName,
    campusId: CAMPUS_HQ,
    teacherId: 't-001',
    classroomId: 'room-101',
    date: '2026-10-19',
    startTime: '09:00',
    endTime: '10:30',
    studentIds: [stu.id]
  }, true);

  const rollRes = mocks.submitRollCall(addRes.event.id, [
    { studentId: stu.id, studentName: stu.name, status: 'present', deductionLessons: 1 }
  ], '前台老师');
  assertEqual(rollRes.success, true);
  assertEqual(pkg.remainingLessons, initialRemaining - 1);
  assertEqual(pkg.consumedLessons, initialConsumed + 1);

  const attRecordId = rollRes.attendanceRecord.id;

  // 2. 发起反结课冲正
  const revertRes = mocks.revertAttendance(attRecordId, '家长申诉上课未到，教务审批冲正', '教务处主任');
  assertEqual(revertRes.success, true, '反结课冲正必须返回 success: true');
  assert(revertRes.record, '必须返回被冲正的考勤记录');

  // 验证课包资产原路返还
  assertEqual(pkg.remainingLessons, initialRemaining, '已扣减课时必须 100% 原路返还回剩余课时');
  assertEqual(pkg.consumedLessons, initialConsumed, '已消耗课时必须 100% 原路回退扣减');

  // 验证考勤记录状态
  const rec = revertRes.record;
  assertEqual(rec.isReversed, true, '考勤记录 isReversed 必须置为 true');
  assertEqual(rec.reversedBy, '教务处主任', '冲正操作人必须精准记录');
  assertEqual(rec.reversalReason, '家长申诉上课未到，教务审批冲正', '冲正原因必须完整记录');
  assert(typeof rec.reversedAt === 'string' && rec.reversedAt.length > 0, '冲正时间戳必须存在');

  // 验证关联课次状态复原
  const evt = mocks.MOCK_SCHEDULE_EVENTS.find(e => e.id === addRes.event.id);
  assertEqual(evt.status, 'scheduled', '课次状态必须恢复为 scheduled 待上状态');
  assertEqual(evt.attendanceCount, 0, '课次出勤计数必须恢复为 0');
});

test('2.2 反结课防重复冲正幂等性测试 (Duplicate Reversal Prevention)：粉碎“反向刷课时”漏洞', () => {
  // 获取一条刚刚已反结课成功的考勤记录
  const reversedRecords = mocks.MOCK_ATTENDANCE_RECORDS.filter(r => r.isReversed);
  assert(reversedRecords.length > 0, '系统中应存在已反结课记录');
  const targetRecord = reversedRecords[0];

  // 记录受影响学员的当前课包课时
  const attItem = targetRecord.studentAttendances.find(a => a.deductionLessons > 0);
  assert(attItem, '考勤记录中应存在曾扣课时的学员');
  const student = mocks.MOCK_STUDENTS.find(s => s.id === attItem.studentId);
  const pkg = student.coursePackages.find(p => p.courseId === targetRecord.courseId) || student.coursePackages[0];
  const beforeRemaining = pkg.remainingLessons;
  const beforeConsumed = pkg.consumedLessons;

  // 对已反结课记录发起第二次反结课调用（攻击场景：重放请求或连击）
  const duplicateRevertRes = mocks.revertAttendance(targetRecord.id, '恶意重复反结课尝试', '黑客测试');

  assertEqual(duplicateRevertRes.success, false, '重复反结课必须被坚决拦截并返回 false');
  assertEqual(duplicateRevertRes.message, '该考勤记录已被反结课冲正，不可重复操作', '必须返回合规错误信息');

  // 极其严密断言：学员课包剩余课时绝对不能二次增加！
  assertEqual(pkg.remainingLessons, beforeRemaining, '安全防线：重复反结课绝对禁止虚增剩余课时！');
  assertEqual(pkg.consumedLessons, beforeConsumed, '安全防线：重复反结课绝对禁止篡改已消耗课时！');
});

test('2.3 种子数据历史已反结课记录 (att-20260919-01) 再次冲正拦截', () => {
  const histRecord = mocks.MOCK_ATTENDANCE_RECORDS.find(r => r.id === 'att-20260919-01');
  assert(histRecord, '种子历史反结课记录应存在');
  assertEqual(histRecord.isReversed, true, '种子记录初始为已冲正');

  const res = mocks.revertAttendance('att-20260919-01');
  assertEqual(res.success, false, '历史已冲正记录禁止再次操作');
  assertEqual(res.message, '该考勤记录已被反结课冲正，不可重复操作');
});

test('2.4 反结课负向单号防护：不存在的考勤记录 ID 安全拦截', () => {
  const fakeRes = mocks.revertAttendance('att-non-existent-88888');
  assertEqual(fakeRes.success, false);
  assertEqual(fakeRes.message, '未找到指定考勤记录');
});

test('2.5 包含请假学员的混合考勤记录反结课：仅退还实扣课时，请假课时不变', () => {
  const s1 = mocks.getStudentById('std-001');
  const s2 = mocks.getStudentById('std-002');
  assert(s1 && s2, '基线学员必须存在');
  const pkg1 = s1.coursePackages[0];
  const pkg2 = s2.coursePackages[0];

  const s1InitRemaining = pkg1.remainingLessons;
  const s2InitRemaining = pkg2.remainingLessons;

  // 排课
  const addRes = mocks.addScheduleEvent({
    className: '混合反结课测试班级',
    courseId: 'course-scratch-001',
    campusId: CAMPUS_HQ,
    date: '2026-10-20',
    startTime: '10:00',
    endTime: '11:30',
    studentIds: [s1.id, s2.id]
  }, true);

  // 点名：s1 到课扣1，s2 请假扣0
  const rollRes = mocks.submitRollCall(addRes.event.id, [
    { studentId: s1.id, studentName: s1.name, status: 'present', deductionLessons: 1 },
    { studentId: s2.id, studentName: s2.name, status: 'leave', deductionLessons: 0 }
  ]);
  assertEqual(rollRes.success, true);
  assertEqual(pkg1.remainingLessons, s1InitRemaining - 1);
  assertEqual(pkg2.remainingLessons, s2InitRemaining); // 请假未扣

  // 反结课
  const revRes = mocks.revertAttendance(rollRes.attendanceRecord.id);
  assertEqual(revRes.success, true);

  // 验证：s1 返还 1 课时恢复，s2 请假原本为 0 课时绝对不得被错误“返还”虚增
  assertEqual(pkg1.remainingLessons, s1InitRemaining, '实扣课时学员得到退还');
  assertEqual(pkg2.remainingLessons, s2InitRemaining, '请假学员课时绝不发生虚增');
});

// -----------------------------------------------------------------------------
// DIMENSION 3: 批量排课与防撞冲突引擎对抗验证
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 3: 批量排课与防撞冲突引擎对抗验证】${colors.reset}`);

test('3.1 连续按周规律批量排课 (batchScheduleClass)：自动周次推进与冲突标记', () => {
  // 选择总部 Scratch 班级
  const targetClass = mocks.MOCK_CLASSES.find(c => c.campusId === CAMPUS_HQ);
  assert(targetClass, '总部班级必须存在');

  const beforeEventsCount = mocks.MOCK_SCHEDULE_EVENTS.length;

  // 执行批量排课：连续排 4 周，每周六 14:00-16:00
  const batchRes = mocks.batchScheduleClass(targetClass.id, {
    startDate: '2026-11-07',
    startTime: '14:00',
    endTime: '16:00',
    repeatCount: 4,
    forceIfConflict: true
  });

  assertEqual(batchRes.success, true, '批量排课调用必须返回 true');
  assertEqual(batchRes.createdEvents.length, 4, '必须成功生成 4 节课次');

  const created = batchRes.createdEvents;
  // 验证 7 天步长连续递增
  assertEqual(created[0].date, '2026-11-07');
  assertEqual(created[1].date, '2026-11-14');
  assertEqual(created[2].date, '2026-11-21');
  assertEqual(created[3].date, '2026-11-28');

  // 验证 lessonNumber 与课次标题按序推进
  const startLesson = (targetClass.completedLessons || 0) + 1;
  assertEqual(created[0].lessonNumber, startLesson);
  assertEqual(created[1].lessonNumber, startLesson + 1);
  assertEqual(created[2].lessonNumber, startLesson + 2);
  assertEqual(created[3].lessonNumber, startLesson + 3);

  // 验证全量事件列表已真实写入
  assertEqual(mocks.MOCK_SCHEDULE_EVENTS.length, beforeEventsCount + 4);
});

test('3.2 排课防撞引擎三维冲突检测：教师冲突、教室冲突、学员并发排课冲突', () => {
  const engine = mocks.EducationalCollisionEngine;
  const baseEvent = {
    id: 'base-collision-evt-1',
    date: '2026-11-15',
    startTime: '10:00',
    endTime: '11:30',
    teacherId: 't-collision-1',
    classroomId: 'room-collision-1',
    studentIds: ['stu-col-1', 'stu-col-2']
  };

  // 1. 教师重叠冲突 (同一天重叠时段 10:30-12:00，同一教师)
  const teacherClash = engine.detectCollision({
    date: '2026-11-15',
    startTime: '10:30',
    endTime: '12:00',
    teacherId: 't-collision-1',
    classroomId: 'room-diff-2',
    studentIds: ['stu-diff-3']
  }, [baseEvent]);
  assertEqual(teacherClash.hasConflict, true, '教师重叠必须判冲突');
  assertEqual(teacherClash.teacherConflict, true);

  // 2. 教室占用冲突 (同一天重叠时段，同一教室)
  const roomClash = engine.detectCollision({
    date: '2026-11-15',
    startTime: '10:30',
    endTime: '12:00',
    teacherId: 't-diff-2',
    classroomId: 'room-collision-1',
    studentIds: ['stu-diff-3']
  }, [baseEvent]);
  assertEqual(roomClash.hasConflict, true, '教室占用必须判冲突');
  assertEqual(roomClash.classroomConflict, true);

  // 3. 学员重叠冲突 (同一天重叠时段，包含相同学员 stu-col-2)
  const stuClash = engine.detectCollision({
    date: '2026-11-15',
    startTime: '10:30',
    endTime: '12:00',
    teacherId: 't-diff-3',
    classroomId: 'room-diff-3',
    studentIds: ['stu-col-2', 'stu-diff-4']
  }, [baseEvent]);
  assertEqual(stuClash.hasConflict, true, '学员分身排课必须判冲突');
  assert(stuClash.studentConflicts && stuClash.studentConflicts.includes('stu-col-2'));
});

test('3.3 教室容量超限阻断 (CLASSROOM_CAPACITY_EXCEEDED)', () => {
  const engine = mocks.EducationalCollisionEngine;
  // 模拟 VIP 教室容量为 4
  const classrooms = {
    'room-vip-test': { id: 'room-vip-test', name: 'VIP室', capacity: 4 }
  };

  // 安排 5 位学员排入
  const capClash = engine.detectCollision({
    date: '2026-11-15',
    startTime: '14:00',
    endTime: '15:00',
    classroomId: 'room-vip-test',
    studentIds: ['s1', 's2', 's3', 's4', 's5']
  }, [], classrooms);

  assertEqual(capClash.hasConflict, true);
  assertEqual(capClash.conflictType, 'CLASSROOM_CAPACITY_EXCEEDED', '容量超限类型必须精确');
  assert(capClash.reason.includes('capacity is 4, but 5 students assigned'));
});

test('3.4 forceIfConflict = false 时冲突课次坚决被拦截，forceIfConflict = true 时允许排入打标', () => {
  // 先排一个既有课次
  const baseRes = mocks.addScheduleEvent({
    date: '2026-11-20',
    startTime: '09:00',
    endTime: '10:30',
    teacherId: 't-001',
    classroomId: 'room-101'
  }, true);
  assert(baseRes.success);

  // 尝试插入完全重叠课次，forceIfConflict = false
  const conflictAttempt = mocks.addScheduleEvent({
    date: '2026-11-20',
    startTime: '09:30',
    endTime: '11:00',
    teacherId: 't-001', // 同一教师冲突！
    classroomId: 'room-102'
  }, false);

  assertEqual(conflictAttempt.success, false, 'forceIfConflict为false时冲突课次必须被坚决拦截');
  assert(conflictAttempt.message.includes('检测到排课冲突'), '返回冲突提示');

  // forceIfConflict = true 时允许排入但打上冲突标记
  const forceRes = mocks.addScheduleEvent({
    date: '2026-11-20',
    startTime: '09:30',
    endTime: '11:00',
    teacherId: 't-001',
    classroomId: 'room-102'
  }, true);

  assertEqual(forceRes.success, true, 'forceIfConflict为true时允许作为冲突日程生成');
  assertEqual(forceRes.event.hasConflict, true, '必须打上 hasConflict 标记');
  assertEqual(forceRes.event.semanticType, 'conflict', '芯片语义必须标为 conflict');
});

test('3.5 营业时间窗口 (07:00-22:00) 边界与倒置/跨午夜硬阻断', () => {
  const engine = mocks.EducationalCollisionEngine;

  // 1. 07:00 之前开始
  const earlyCheck = engine.validateScheduleTimeWindow('06:30', '08:00');
  assertEqual(earlyCheck.valid, false, '早于07:00必须阻断');

  // 2. 晚于 22:00 结束
  const lateCheck = engine.validateScheduleTimeWindow('21:00', '22:30');
  assertEqual(lateCheck.valid, false, '晚于22:00必须阻断');

  // 3. 时间倒置 (结束时间早于开始时间)
  const invertedCheck = engine.validateScheduleTimeWindow('15:00', '14:00');
  assertEqual(invertedCheck.valid, false, '时间倒置必须阻断');

  // 4. 正确时段
  const validCheck = engine.validateScheduleTimeWindow('09:00', '10:30');
  assertEqual(validCheck.valid, true);
  assertEqual(validCheck.durationMinutes, 90);
});

test('3.6 Lane 自适应染色算法：多列并排贪心分配与百分比坐标计算', () => {
  const engine = mocks.EducationalCollisionEngine;
  // 4 节重叠课次
  const events = [
    { id: 'E1', date: '2026-11-25', startTime: '09:00', endTime: '11:00' },
    { id: 'E2', date: '2026-11-25', startTime: '09:30', endTime: '11:00' },
    { id: 'E3', date: '2026-11-25', startTime: '10:00', endTime: '11:30' },
    { id: 'E4', date: '2026-11-25', startTime: '10:15', endTime: '12:00' }
  ];

  const allocated = engine.allocateLanes(events, 4);
  assertEqual(allocated.length, 4, '全量 4 个事件均应计算布局');

  // 验证 4 条独立并列 Lane
  const laneIndices = allocated.map(a => a.laneIndex);
  assertEqual(laneIndices[0], 0);
  assertEqual(laneIndices[1], 1);
  assertEqual(laneIndices[2], 2);
  assertEqual(laneIndices[3], 3);

  // 验证每列宽度为 25% (100 / 4)
  for (let i = 0; i < 4; i++) {
    assertEqual(allocated[i].style.width, '25%');
    assertEqual(allocated[i].style.left, `${i * 25}%`);
  }
});

// -----------------------------------------------------------------------------
// DIMENSION 4: 多校区上下文联动与数据动态隔离测试
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 4: 多校区上下文联动与数据动态隔离测试】${colors.reset}`);

test('4.1 课表日程 (getScheduleEvents) 校区上下文过滤与隔离', () => {
  for (const campusId of BRANCH_CAMPUSES) {
    const events = mocks.getScheduleEvents({ campusId });
    assert(events.length > 0, `分校区 [${campusId}] 应有基线排课课次`);
    for (const evt of events) {
      assertEqual(
        evt.campusId,
        campusId,
        `数据穿透漏洞：校区 [${campusId}] 的课表列表中泄露了归属 [${evt.campusId}] 的课次 [${evt.id}: ${evt.className}]`
      );
    }
  }
});

test('4.2 考勤记录 (getAttendanceRecords) 校区上下文精确隔离', () => {
  // 远洋校区应有考勤记录
  const yyRecords = mocks.getAttendanceRecords(CAMPUS_YY);
  assert(yyRecords.length > 0, '远洋校区应有考勤记录');
  for (const r of yyRecords) {
    assertEqual(r.campusId, CAMPUS_YY, '远洋校区考勤记录 campusId 必须为 YY');
  }

  // 总部校区应有考勤记录
  const hqRecords = mocks.getAttendanceRecords(CAMPUS_HQ);
  assert(hqRecords.length > 0, '总部校区应包含考勤记录');
});

test('4.3 班级管理 (getClasses)、教室 (getClassrooms) 与讲师 (getTeachers) 校区动态隔离', () => {
  for (const campusId of BRANCH_CAMPUSES) {
    const classes = mocks.getClasses({ campusId });
    for (const cls of classes) {
      assertEqual(cls.campusId, campusId, `班级数据泄露：[${cls.id}] 归属 [${cls.campusId}] 出现在 [${campusId}] 列表中`);
    }

    const classrooms = mocks.getClassrooms(campusId);
    for (const room of classrooms) {
      assertEqual(room.campusId, campusId, `教室数据泄露：[${room.id}] 归属 [${room.campusId}] 出现在 [${campusId}] 列表中`);
    }

    const teachers = mocks.getTeachers(campusId);
    for (const t of teachers) {
      assertEqual(t.campusId, campusId, `讲师数据泄露：[${t.id}] 归属 [${t.campusId}] 出现在 [${campusId}] 列表中`);
    }
  }
});

test('4.4 非法/未知校区 ID 渗透攻击：严格返回空列表，绝对零数据泄漏', () => {
  const evilCampusIds = [
    'campus-fake-id-999',
    'campus-bj-yy\' OR \'1\'=\'1',
    '<script>alert("xss")</script>',
    '   ',
    'null',
    'undefined',
    '__proto__',
    'constructor'
  ];

  for (const evilId of evilCampusIds) {
    const evts = mocks.getScheduleEvents({ campusId: evilId });
    assertEqual(evts.length, 0, `排课泄露防御失败：未知校区 [${evilId}] 泄露了 ${evts.length} 条课次`);

    const atts = mocks.getAttendanceRecords(evilId);
    assertEqual(atts.length, 0, `考勤泄露防御失败：未知校区 [${evilId}] 泄露了 ${atts.length} 条记录`);

    const classes = mocks.getClasses({ campusId: evilId });
    assertEqual(classes.length, 0, `班级泄露防御失败：未知校区 [${evilId}] 泄露了 ${classes.length} 条班级`);

    const rooms = mocks.getClassrooms(evilId);
    assertEqual(rooms.length, 0, `教室泄露防御失败：未知校区 [${evilId}] 泄露了 ${rooms.length} 间教室`);

    const teachers = mocks.getTeachers(evilId);
    assertEqual(teachers.length, 0, `讲师泄露防御失败：未知校区 [${evilId}] 泄露了 ${teachers.length} 位讲师`);
  }
});

// -----------------------------------------------------------------------------
// DIMENSION 5: 测试数据现场隔离与状态幂等复原 (Zero-Pollution Invariant)
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 5: 测试数据现场隔离与状态幂等复原】${colors.reset}`);

test('5.1 现场 Mock 数据快照彻底复原 (Zero-Pollution Invariant)', () => {
  // 恢复 MOCK_STUDENTS
  mocks.MOCK_STUDENTS.length = 0;
  snapshotStudents.forEach(item => mocks.MOCK_STUDENTS.push(item));

  // 恢复 MOCK_SCHEDULE_EVENTS
  mocks.MOCK_SCHEDULE_EVENTS.length = 0;
  snapshotScheduleEvents.forEach(item => mocks.MOCK_SCHEDULE_EVENTS.push(item));

  // 恢复 MOCK_ATTENDANCE_RECORDS
  mocks.MOCK_ATTENDANCE_RECORDS.length = 0;
  snapshotAttendanceRecords.forEach(item => mocks.MOCK_ATTENDANCE_RECORDS.push(item));

  // 恢复 MOCK_CLASSES
  mocks.MOCK_CLASSES.length = 0;
  snapshotClasses.forEach(item => mocks.MOCK_CLASSES.push(item));

  assertEqual(mocks.MOCK_STUDENTS.length, snapshotStudents.length, '学员快照长度恢复');
  assertEqual(mocks.MOCK_SCHEDULE_EVENTS.length, snapshotScheduleEvents.length, '课表快照长度恢复');
  assertEqual(mocks.MOCK_ATTENDANCE_RECORDS.length, snapshotAttendanceRecords.length, '考勤快照长度恢复');
  assertEqual(mocks.MOCK_CLASSES.length, snapshotClasses.length, '班级快照长度恢复');
});

// -----------------------------------------------------------------------------
// 执行结果汇总报告
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}对抗验证测试执行总结报告: 总用例数: ${totalTests} | 通过: ${passedTests} | 失败: ${failedTests} | 通过率: ${(passedTests / totalTests * 100).toFixed(2)}%${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

if (failedTests > 0) {
  console.log(`${colors.red}${colors.bold}❌ 存在 ${failedTests} 项失败用例，请查阅失败堆栈进行阻断判定：${colors.reset}`);
  failures.forEach(f => {
    console.log(`  - [${f.name}]: ${f.error.message}`);
  });
  process.exit(1);
} else {
  console.log(`${colors.green}${colors.bold}🎉 全部 5 大维度 21 项对抗与穿透测试用例 100% 通过！${colors.reset}`);
  console.log(`${colors.green}点名消课扣减课时真实闭环，请假课时严格守恒，0课时下溢防御健全，反结课原路退还冲正且防重复幂等性坚固，批量排课与多校区动态隔离无懈可击。${colors.reset}\n`);
  process.exit(0);
}
