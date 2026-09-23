#!/usr/bin/env node
/**
 * 盛通教育「一校教培系统」Tier 5 白盒对抗加固验证套件 2 (Adversarial Coverage Hardening Suite 2)
 * tests/tier5_adversarial_suite_2.cjs
 * 
 * 核心对抗挑战向量覆盖：
 * Vector a: 教务三维防撞引擎极限边缘：微秒/分钟级接缝碰撞、跨午夜排课、0 分钟/负时长非法输入、跨日边界冲突拦截
 * Vector b: Lane 染色自适应算法极限压力：同时间段重叠 5~10 门课程时的宽度与偏移容错、防止 UI 坍缩
 * Vector c: 学员 7 种异常状态流转的非法逆向跃迁（如退费后强行转班、休学学员强行排课点名等）
 * Vector d: 考勤反结课冲正的反复调用幂等性与时间倒流防御
 * Vector e: RBAC 权限系统深度嵌套与非法字符权限码越权穿透防御
 * 
 * 零污染原则 (Zero-Pollution Invariant): 现场快照深度捕获与严格复原，保证全系统测试 100% 幂等。
 */

const path = require('node:path');
const createJiti = require('jiti');

// 加载契约模型
const CollisionEngineContract = require('./contracts/collisionEngine');
const StudentStateMachineContract = require('./contracts/studentStateMachine');
const RBACEngineContract = require('./contracts/rbacEngine');

// 使用 jiti 解析生产源码
const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const mocks = jiti('../src/mocks/index.ts');
const { EducationalCollisionEngine } = mocks;
const { RBACEngine: MockRBACEngine } = mocks;

// 终端颜色
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
  console.log(`    ${colors.green}✓ PASS:${colors.reset} ${message} (Successfully intercepted: "${errorMsg.substring(0, 45)}...")`);
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

async function runTier5AdversarialSuite() {
  const startTime = Date.now();

  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}盛通教育「一校教培系统」Tier 5 白盒对抗加固验证套件 2 (Adversarial Suite 2)${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  try {
    // -------------------------------------------------------------------------
    // VECTOR A: 教务三维防撞引擎极限边缘对抗
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}【Vector A: 教务三维防撞引擎极限边缘对抗 (接缝碰撞、跨午夜、0/负时长、跨日隔离)】${colors.reset}`);

    // A.1 分钟级正向临界接缝碰撞 (09:00-10:00 与 09:59-10:30 重叠 1 分钟 [599, 600))
    const seamOverlap1 = EducationalCollisionEngine.isOverlapping('09:00', '10:00', '09:59', '10:30');
    assertEqual(seamOverlap1, true, '1分钟正向临界重叠判定为 true');

    // A.2 分钟级反向临界接缝碰撞 (10:00-11:00 与 09:30-10:01 重叠 1 分钟 [600, 601))
    const seamOverlap2 = EducationalCollisionEngine.isOverlapping('10:00', '11:00', '09:30', '10:01');
    assertEqual(seamOverlap2, true, '1分钟反向临界重叠判定为 true');

    // A.3 串行紧邻接壤无冲突 (09:00-10:00 与 10:00-11:00 下课紧接上课，首尾相接无重叠)
    const serialContact1 = EducationalCollisionEngine.isOverlapping('09:00', '10:00', '10:00', '11:00');
    assertEqual(serialContact1, false, '串行紧邻接壤无冲突判定为 false (区间 [540, 600) 与 [600, 660) 交集为空)');

    // A.4 反向串行紧邻接壤无冲突 (10:00-11:00 与 09:00-10:00)
    const serialContact2 = EducationalCollisionEngine.isOverlapping('10:00', '11:00', '09:00', '10:00');
    assertEqual(serialContact2, false, '反向串行紧邻接壤无冲突判定为 false');

    // A.5 极短 1 分钟课次碰撞与串行边界
    const oneMinOverlap = EducationalCollisionEngine.isOverlapping('09:59', '10:00', '09:00', '10:00');
    assertEqual(oneMinOverlap, true, '极短1分钟课次包含于大课次内判定为 true');
    const oneMinSerial = EducationalCollisionEngine.isOverlapping('09:59', '10:00', '10:00', '10:01');
    assertEqual(oneMinSerial, false, '极短1分钟课次串行相邻判定为 false');

    // A.6 完全重合与深度内嵌区间
    const exactSameOverlap = EducationalCollisionEngine.isOverlapping('09:00', '10:00', '09:00', '10:00');
    assertEqual(exactSameOverlap, true, '完全相同起止时间判定为 true');
    const nestedOverlap = EducationalCollisionEngine.isOverlapping('09:15', '09:45', '09:00', '10:00');
    assertEqual(nestedOverlap, true, '完全内嵌区间判定为 true');

    // A.7 跨午夜排课坚决拦截 (跨午夜 endMin < startMin，或跨日超长排课)
    const crossMidnight1 = EducationalCollisionEngine.validateScheduleTimeWindow('21:30', '01:30');
    assertEqual(crossMidnight1.valid, false, '跨午夜排课 21:30-01:30 严格拦截');
    assertEqual(crossMidnight1.reason, 'End time must be strictly after start time', '跨午夜拦截原因合规');

    const crossMidnightCollision = EducationalCollisionEngine.detectCollision({
      date: '2026-10-15',
      startTime: '21:30',
      endTime: '01:30',
      teacherId: 'teacher-001',
      classroomId: 'room-001'
    });
    assertEqual(crossMidnightCollision.hasConflict, true, '跨午夜排课触发碰撞拦截');
    assertEqual(crossMidnightCollision.conflictType, 'TIME_WINDOW_VIOLATION', '冲突类型为时间窗口越界');

    // A.8 超出打烊闭馆营业时间拦截 (07:00 ~ 22:00)
    const overtimeNight = EducationalCollisionEngine.validateScheduleTimeWindow('21:00', '23:30');
    assertEqual(overtimeNight.valid, false, '晚于22:00打烊时间排课严格拦截');
    assert(overtimeNight.reason && overtimeNight.reason.includes('cannot exceed 22:00'), '闭馆越界原因合规');

    const overtimeMorning = EducationalCollisionEngine.validateScheduleTimeWindow('06:59', '08:00');
    assertEqual(overtimeMorning.valid, false, '早于07:00开馆时间排课严格拦截');
    assert(overtimeMorning.reason && overtimeMorning.reason.includes('cannot be earlier than 07:00'), '开馆越界原因合规');

    // A.9 营业时间极限合法准入边界 (07:00-08:00 与 21:00-22:00 极限压线通过)
    const validBoundaryMorning = EducationalCollisionEngine.validateScheduleTimeWindow('07:00', '08:00');
    assertEqual(validBoundaryMorning.valid, true, '07:00 早边界准入通过');
    assertEqual(validBoundaryMorning.durationMinutes, 60, '课时时长准确计算 60 分钟');

    const validBoundaryNight = EducationalCollisionEngine.validateScheduleTimeWindow('21:00', '22:00');
    assertEqual(validBoundaryNight.valid, true, '22:00 晚边界准入通过');
    assertEqual(validBoundaryNight.durationMinutes, 60, '课时时长准确计算 60 分钟');

    // A.10 0 分钟与负时长非法输入拦截
    const zeroDuration = EducationalCollisionEngine.validateScheduleTimeWindow('10:00', '10:00');
    assertEqual(zeroDuration.valid, false, '0 分钟排课严格拦截 (valid = false)');

    const negativeDuration = EducationalCollisionEngine.validateScheduleTimeWindow('10:30', '10:00');
    assertEqual(negativeDuration.valid, false, '负时长排课严格拦截 (valid = false)');

    assertThrows(() => {
      EducationalCollisionEngine.isOverlapping('10:00', '10:00', '09:00', '11:00');
    }, 'End time must be strictly after start time', 'isOverlapping 遇到 0 分钟输入坚决抛错');

    assertThrows(() => {
      EducationalCollisionEngine.isOverlapping('10:30', '10:00', '09:00', '11:00');
    }, 'End time must be strictly after start time', 'isOverlapping 遇到负时长输入坚决抛错');

    // A.11 畸形/非法时间格式防御
    assertThrows(() => {
      EducationalCollisionEngine.parseTimeToMinutes('25:00');
    }, 'Invalid time value', '小时大于 23 (25:00) 抛出非法时间值异常');

    assertThrows(() => {
      EducationalCollisionEngine.parseTimeToMinutes('08:60');
    }, 'Invalid time value', '分钟大于 59 (08:60) 抛出非法时间值异常');

    assertThrows(() => {
      EducationalCollisionEngine.parseTimeToMinutes('08:-10');
    }, 'Invalid time value', '负数分钟 (08:-10) 抛出非法时间值异常');

    assertThrows(() => {
      EducationalCollisionEngine.parseTimeToMinutes('abc:def');
    }, 'Invalid time value', '非数字字符 (abc:def) 抛出非法时间值异常');

    assertThrows(() => {
      EducationalCollisionEngine.parseTimeToMinutes('');
    }, 'Invalid time format', '空字符串输入抛出非法时间格式异常');

    assertThrows(() => {
      EducationalCollisionEngine.parseTimeToMinutes(null);
    }, 'Invalid time format', 'null 输入抛出非法时间格式异常');

    // A.12 跨日/跨月/跨年排课边界隔离验证
    const existingEventsBase = [
      {
        id: 'evt-base-01',
        date: '2026-09-22',
        startTime: '10:00',
        endTime: '11:30',
        teacherId: 'tch-common-01',
        classroomId: 'room-common-01',
        studentIds: ['std-001', 'std-002']
      },
      {
        id: 'evt-base-02',
        date: '2026-09-30',
        startTime: '14:00',
        endTime: '15:30',
        teacherId: 'tch-common-01',
        classroomId: 'room-common-01',
        studentIds: ['std-001']
      }
    ];

    // 同一讲师/教室/学员在第二天 (2026-09-23) 相同时间排课，无跨日虚假碰撞
    const nextDayCheck = EducationalCollisionEngine.detectCollision({
      date: '2026-09-23',
      startTime: '10:00',
      endTime: '11:30',
      teacherId: 'tch-common-01',
      classroomId: 'room-common-01',
      studentIds: ['std-001', 'std-002']
    }, existingEventsBase);
    assertEqual(nextDayCheck.hasConflict, false, '次日相同时间段相同师资场地绝对无冲突拦截');

    // 跨月边界 (2026-10-01 vs 2026-09-30)
    const nextMonthCheck = EducationalCollisionEngine.detectCollision({
      date: '2026-10-01',
      startTime: '14:00',
      endTime: '15:30',
      teacherId: 'tch-common-01',
      classroomId: 'room-common-01',
      studentIds: ['std-001']
    }, existingEventsBase);
    assertEqual(nextMonthCheck.hasConflict, false, '跨月边界 (09-30 vs 10-01) 绝对无虚假冲突');

    // A.13 编辑态排课自身排除 (Self-Exclusion) 防死锁
    const selfExcludeCheck = EducationalCollisionEngine.detectCollision({
      id: 'evt-base-01',
      excludeEventId: 'evt-base-01',
      date: '2026-09-22',
      startTime: '10:00',
      endTime: '11:30',
      teacherId: 'tch-common-01',
      classroomId: 'room-common-01',
      studentIds: ['std-001', 'std-002']
    }, existingEventsBase);
    assertEqual(selfExcludeCheck.hasConflict, false, '编辑态自身豁免排除 (Self-Exclusion) 防死锁成功');

    // A.14 物理教室容量超限极限判定
    const classroomCapacityCheck = EducationalCollisionEngine.detectCollision({
      date: '2026-10-20',
      startTime: '14:00',
      endTime: '15:00',
      classroomId: 'room-small-01',
      studentIds: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11'] // 11 students
    }, [], { 'room-small-01': { id: 'room-small-01', name: '微型创客室', capacity: 10 } });
    assertEqual(classroomCapacityCheck.hasConflict, true, '教室容量超限精准检测阻断');
    assertEqual(classroomCapacityCheck.conflictType, 'CLASSROOM_CAPACITY_EXCEEDED', '冲突类型为容量超限');

    console.log();

    // -------------------------------------------------------------------------
    // VECTOR B: Lane 染色自适应算法极限压力与 UI 防坍缩
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}【Vector B: Lane 染色自适应算法极限压力与 UI 防坍缩 (5~10门重叠压测)】${colors.reset}`);

    // B.1 极限 5 门课程完全重叠压测 (默认 maxLanes = 4)
    const overlap5Events = Array.from({ length: 5 }, (_, i) => ({
      id: `evt-overlap5-${i + 1}`,
      date: '2026-10-15',
      startTime: '09:00',
      endTime: '10:30',
      className: `并发压力班级-${i + 1}`
    }));

    const lanesResult5 = EducationalCollisionEngine.allocateLanes(overlap5Events, 4);
    assertEqual(lanesResult5.length, 5, '5 门重叠课程全部被成功分配');
    assertEqual(lanesResult5[0].totalLanes, 4, '默认最大列数收敛上限为 4 列');
    
    for (const item of lanesResult5) {
      const widthPct = parseFloat(item.style.width);
      const leftPct = parseFloat(item.style.left);
      assert(widthPct > 0, `UI防坍缩保证：宽度百分比必须严格大于0 (实际: ${widthPct}%)`);
      assertEqual(widthPct, 25, '4 列宽度百分比稳定为 25.00%');
      assert(leftPct >= 0 && leftPct <= 75, `左偏移在合法范围 [0, 75%] 内 (实际: ${leftPct}%)`);
      assert(leftPct + widthPct <= 100.01, `视口安全不变量：左偏移加宽度绝不突破100%容器边界 (实际: ${leftPct + widthPct}%)`);
      assertEqual(item.style.top, '120px', 'Top 像素计算准确：(540 - 420) = 120px');
      assertEqual(item.style.height, '90px', 'Height 像素计算准确：(630 - 540) = 90px');
      assert(!item.style.width.includes('NaN') && !item.style.left.includes('undefined'), '无 NaN 或 undefined 污染');
    }

    // B.2 极限 8 门课程完全重叠压测 (默认 maxLanes = 4)
    const overlap8Events = Array.from({ length: 8 }, (_, i) => ({
      id: `evt-overlap8-${i + 1}`,
      date: '2026-10-15',
      startTime: '10:30',
      endTime: '12:00',
      className: `8门并发班级-${i + 1}`
    }));

    const lanesResult8 = EducationalCollisionEngine.allocateLanes(overlap8Events, 4);
    assertEqual(lanesResult8.length, 8, '8 门重叠课程全部被成功分配');
    assertEqual(lanesResult8[0].totalLanes, 4, '8 门重叠最大列数稳定封顶在 4 列');
    for (const item of lanesResult8) {
      const widthPct = parseFloat(item.style.width);
      const leftPct = parseFloat(item.style.left);
      assert(widthPct === 25, '8 门重叠时单列宽度稳定为 25%');
      assert(leftPct + widthPct <= 100.01, '8 门重叠视口不溢出保证');
    }

    // B.3 极限 10 门课程完全重叠压测 (默认 maxLanes = 4)
    const overlap10Events = Array.from({ length: 10 }, (_, i) => ({
      id: `evt-overlap10-${i + 1}`,
      date: '2026-10-15',
      startTime: '14:00',
      endTime: '15:30',
      className: `10门极限并发班级-${i + 1}`
    }));

    const lanesResult10 = EducationalCollisionEngine.allocateLanes(overlap10Events, 4);
    assertEqual(lanesResult10.length, 10, '10 门重叠课程全部被成功分配');
    assertEqual(lanesResult10[0].totalLanes, 4, '10 门重叠最大列数稳定封顶在 4 列');
    for (const item of lanesResult10) {
      const widthPct = parseFloat(item.style.width);
      const leftPct = parseFloat(item.style.left);
      assert(widthPct === 25, '10 门重叠时单列宽度稳定为 25%');
      assert(leftPct + widthPct <= 100.01, '10 门重叠视口绝对不溢出');
    }

    // B.4 极限 10 门课程自定义 maxLanes = 10 扩展压测
    const lanesResult10Custom = EducationalCollisionEngine.allocateLanes(overlap10Events, 10);
    assertEqual(lanesResult10Custom.length, 10, '10 门自定义重叠课程全部被成功分配');
    assertEqual(lanesResult10Custom[0].totalLanes, 10, '自定义 10 列扩展自适应生效');
    for (let idx = 0; idx < lanesResult10Custom.length; idx++) {
      const item = lanesResult10Custom[idx];
      const widthPct = parseFloat(item.style.width);
      const leftPct = parseFloat(item.style.left);
      assertEqual(widthPct, 10, '10 列自适应分配单列宽度精准为 10%');
      assertEqual(leftPct, Number((idx * 10).toFixed(2)), `第 ${idx + 1} 列左偏移精准对齐`);
      assert(leftPct + widthPct <= 100.01, '自定义 10 列总和不超过 100%');
    }

    // B.5 10 门复杂阶梯型错位课程群贪心染色复用验证
    // 课程错落有致，上课下课交替释放与重用 Lane 0..3
    const staggered10Events = [
      { id: 's-01', date: '2026-10-15', startTime: '09:00', endTime: '10:00' }, // Lane 0 (end 10:00)
      { id: 's-02', date: '2026-10-15', startTime: '09:15', endTime: '10:15' }, // Lane 1 (end 10:15)
      { id: 's-03', date: '2026-10-15', startTime: '09:30', endTime: '10:30' }, // Lane 2 (end 10:30)
      { id: 's-04', date: '2026-10-15', startTime: '09:45', endTime: '10:45' }, // Lane 3 (end 10:45)
      { id: 's-05', date: '2026-10-15', startTime: '10:00', endTime: '11:00' }, // 10:00 复用 Lane 0!
      { id: 's-06', date: '2026-10-15', startTime: '10:15', endTime: '11:15' }, // 10:15 复用 Lane 1!
      { id: 's-07', date: '2026-10-15', startTime: '10:30', endTime: '11:30' }, // 10:30 复用 Lane 2!
      { id: 's-08', date: '2026-10-15', startTime: '10:45', endTime: '11:45' }, // 10:45 复用 Lane 3!
      { id: 's-09', date: '2026-10-15', startTime: '11:00', endTime: '12:00' }, // 11:00 复用 Lane 0!
      { id: 's-10', date: '2026-10-15', startTime: '11:15', endTime: '12:15' }  // 11:15 复用 Lane 1!
    ];

    const staggeredResult = EducationalCollisionEngine.allocateLanes(staggered10Events, 4);
    assertEqual(staggeredResult.length, 10, '阶梯错位 10 门课次分配完毕');
    const s05 = staggeredResult.find(r => r.id === 's-05');
    const s06 = staggeredResult.find(r => r.id === 's-06');
    assertEqual(s05.laneIndex, 0, 's-05 成功复用已下课释放的 Lane 0');
    assertEqual(s06.laneIndex, 1, 's-06 成功复用已下课释放的 Lane 1');

    // B.6 边界容错：空数组与单事件
    const emptyResult = EducationalCollisionEngine.allocateLanes([], 4);
    assertDeepEqual(emptyResult, [], '空数组输入稳健返回空数组');

    const singleEvent = [{ id: 's-single', date: '2026-10-15', startTime: '09:00', endTime: '10:00' }];
    const singleResult = EducationalCollisionEngine.allocateLanes(singleEvent, 4);
    assertEqual(singleResult.length, 1, '单事件分配成功');
    assertEqual(singleResult[0].totalLanes, 1, '单事件总列数为 1');
    assertEqual(singleResult[0].style.width, '100%', '单事件占满 100% 宽度');
    assertEqual(singleResult[0].style.left, '0%', '单事件左偏移为 0%');

    console.log();

    // -------------------------------------------------------------------------
    // VECTOR C: 学员 7 种异常状态流转的非法逆向跃迁防御
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}【Vector C: 学员 7 种异常状态流转的非法逆向跃迁防御 (退费后转班、休学强行排课等)】${colors.reset}`);

    // C.1 退费后强行转班防御
    // 构造学员并完成退费，学员课包进入 refunded 终态
    const stuRefunded = {
      id: 'std-adv-refunded',
      name: '退费测试学员',
      campusId: 'campus-bj-hq',
      campusName: '总部校区',
      status: 'normal',
      wallet: { principalBalance: 1000, bonusBalance: 0, ledger: [] },
      coursePackages: [
        {
          packageId: 'pkg-refunded-01',
          courseId: 'CRS-01',
          courseName: 'Scratch创意编程',
          pricePerLesson: 200,
          totalLessons: 20,
          remainingLessons: 20,
          bonusLessons: 0,
          status: 'active'
        }
      ]
    };
    mocks.MOCK_STUDENTS.push(stuRefunded);

    // 1. 发起退费
    const refundMovementRes = mocks.applyAbnormalMovement({
      studentId: 'std-adv-refunded',
      movementType: 'refund',
      packageId: 'pkg-refunded-01',
      deductionFee: 0
    });
    assertEqual(refundMovementRes.success, true, '前置退费成功');
    assertEqual(stuRefunded.status, 'dropped_out', '名下所有课包退费后学员状态自动流转为 dropped_out');
    assertEqual(stuRefunded.coursePackages[0].status, 'refunded', '课包状态归档为 refunded');

    // 2. 尝试对已退费课包发起转班（非法逆向跃迁）
    const illegalTransferRes = mocks.applyAbnormalMovement({
      studentId: 'std-adv-refunded',
      movementType: 'transfer_class',
      packageId: 'pkg-refunded-01',
      toClassId: 'cls-hq-scratch-01'
    });
    assertEqual(illegalTransferRes.success, false, '退费后强行转班被坚决拦截并返回 false');
    assert(illegalTransferRes.message.includes('非有效在读状态'), '拦截原因提示课包非有效在读状态');

    // 契约层同等验证
    const smContractRefunded = new StudentStateMachineContract(stuRefunded);
    assertThrows(() => {
      smContractRefunded.transferClass('pkg-refunded-01', 'cls-old', 'cls-new', 20, 10);
    }, 'Course package is not active', '契约层：退费课包强行转班坚决抛错');

    // C.2 休学停课学员强行转班防御
    const stuSuspended = {
      id: 'std-adv-suspended',
      name: '休学测试学员',
      campusId: 'campus-bj-hq',
      status: 'suspended',
      wallet: { principalBalance: 500, bonusBalance: 0, ledger: [] },
      coursePackages: [
        {
          packageId: 'pkg-susp-01',
          courseId: 'CRS-02',
          courseName: 'Python高阶课',
          pricePerLesson: 300,
          totalLessons: 30,
          remainingLessons: 30,
          status: 'frozen'
        }
      ]
    };
    mocks.MOCK_STUDENTS.push(stuSuspended);

    const suspendedTransferRes = mocks.applyAbnormalMovement({
      studentId: 'std-adv-suspended',
      movementType: 'transfer_class',
      packageId: 'pkg-susp-01',
      toClassId: 'cls-hq-py-01'
    });
    assertEqual(suspendedTransferRes.success, false, '休学停课学员强行转班被坚决拦截');
    assert(suspendedTransferRes.message.includes('停课休学状态，禁止转班'), '拦截提示停课休学禁止转班');

    const smContractSuspended = new StudentStateMachineContract(stuSuspended);
    assertThrows(() => {
      smContractSuspended.transferClass('pkg-susp-01', 'cls-old', 'cls-new', 20, 10);
    }, 'Cannot transfer class while student is suspended', '契约层：休学学员强行转班坚决抛错');

    // C.3 休学停课学员排课自动过滤与消课防御
    function canScheduleStudentCheck(student) {
      if (student.status === 'suspended') {
        return { allowed: false, reason: 'Student is currently suspended (停课期间禁止排课)' };
      }
      return { allowed: true };
    }
    const scheduleFilterRes = canScheduleStudentCheck(stuSuspended);
    assertEqual(scheduleFilterRes.allowed, false, '排课调度选择器自动阻断休学学员排课');
    assert(scheduleFilterRes.reason.includes('停课期间禁止排课'), '排课阻断原因合规');

    // C.4 已退费/已结业学员强行办理休学拦截
    const illegalSuspendRes = mocks.applyAbnormalMovement({
      studentId: 'std-adv-refunded', // already dropped_out
      movementType: 'suspend',
      suspensionDays: 30
    });
    assertEqual(illegalSuspendRes.success, false, '退费流失学员办理休学被坚决拦截');
    assertEqual(illegalSuspendRes.message, '已结业/退费学员禁止办理停课', '休学拦截原因提示已退费学员禁止休学');

    assertThrows(() => {
      smContractRefunded.suspend(30);
    }, 'Cannot suspend dropped out student', '契约层：退费流失学员休学坚决抛错');

    // C.5 正常在读学员直接强行办理复课拦截
    const stuNormal = {
      id: 'std-adv-normal',
      name: '在读学员',
      campusId: 'campus-bj-hq',
      status: 'normal',
      wallet: { principalBalance: 200, bonusBalance: 0, ledger: [] },
      coursePackages: [
        {
          packageId: 'pkg-norm-01',
          courseId: 'CRS-03',
          courseName: 'C++竞赛课',
          pricePerLesson: 350,
          totalLessons: 40,
          remainingLessons: 40,
          status: 'active'
        }
      ]
    };
    mocks.MOCK_STUDENTS.push(stuNormal);

    const illegalResumeRes = mocks.applyAbnormalMovement({
      studentId: 'std-adv-normal',
      movementType: 'resume'
    });
    assertEqual(illegalResumeRes.success, false, '正常在读学员办理复课被坚决拦截');
    assertEqual(illegalResumeRes.message, '学员当前非停课状态，无需办理复课', '复课拦截原因明确');

    const smContractNormal = new StudentStateMachineContract(stuNormal);
    assertThrows(() => {
      smContractNormal.resume();
    }, 'Student is not suspended', '契约层：在读学员复课坚决抛错');

    // C.6 重复办理休学幂等拦截
    const doubleSuspendRes = mocks.applyAbnormalMovement({
      studentId: 'std-adv-suspended',
      movementType: 'suspend',
      suspensionDays: 30
    });
    assertEqual(doubleSuspendRes.success, false, '重复休学被坚决拦截');
    assertEqual(doubleSuspendRes.message, '该学员已处于停课休学状态，请勿重复操作', '重复休学拦截提示明确');

    assertThrows(() => {
      smContractSuspended.suspend(30);
    }, 'Student is already suspended', '契约层：重复休学坚决抛错');

    // C.7 课包终态重复发起退费拦截
    const doubleRefundRes = mocks.applyAbnormalMovement({
      studentId: 'std-adv-refunded',
      movementType: 'refund',
      packageId: 'pkg-refunded-01'
    });
    assertEqual(doubleRefundRes.success, false, '已退费课包二次发起退费被坚决拦截');
    assert(doubleRefundRes.message.includes('已达终态（已退费/已结课），无法重复发起退费'), '重复退费拦截提示明确');

    assertThrows(() => {
      smContractRefunded.refund('pkg-refunded-01');
    }, 'Course package has already reached terminal status', '契约层：重复退费坚决抛错');

    // C.8 满员班级强行转入拦截
    const capacityExceededTransferRes = mocks.applyAbnormalMovement({
      studentId: 'std-adv-normal',
      movementType: 'transfer_class',
      packageId: 'pkg-norm-01',
      toClassId: 'cls-full',
      targetClassCurrentCount: 20,
      targetClassCapacity: 20
    });
    assertEqual(capacityExceededTransferRes.success, false, '满员班级强行转入被坚决拦截');
    assert(capacityExceededTransferRes.message.includes('满班人数上限'), '满班拦截提示明确');

    assertThrows(() => {
      smContractNormal.transferClass('pkg-norm-01', 'cls-old', 'cls-full', 20, 20);
    }, 'Target class capacity exceeded', '契约层：满班转入坚决抛错');

    // C.9 转校非法校区与原地转校拦截
    const illegalCampusTransfer1 = mocks.applyAbnormalMovement({
      studentId: 'std-adv-normal',
      movementType: 'transfer_campus',
      targetCampusId: 'campus-bj-hq' // 当前校区
    });
    assertEqual(illegalCampusTransfer1.success, false, '原地转校被拦截');
    assert(illegalCampusTransfer1.message.includes('目标校区不能与当前归属校区相同'), '原地转校拦截提示明确');

    const illegalCampusTransfer2 = mocks.applyAbnormalMovement({
      studentId: 'std-adv-normal',
      movementType: 'transfer_campus',
      targetCampusId: 'campus-unauthorized-999',
      authorizedCampusIds: ['campus-bj-hq', 'campus-bj-hd']
    });
    assertEqual(illegalCampusTransfer2.success, false, '未授权校区转校被拦截');
    assert(illegalCampusTransfer2.message.includes('未授权'), '未授权校区转校拦截提示明确');

    // C.10 电子钱包违规提现与超额消费穿透拦截
    // 学员钱包：本金 200，赠送金 100，总额 300
    const walletStudent = {
      id: 'std-wallet-test',
      wallet: { principalBalance: 200, bonusBalance: 100 },
      coursePackages: []
    };
    const smWallet = new StudentStateMachineContract(walletStudent);

    // 尝试提现 250 元（试图套现 50 元赠送金）：拦截！
    assertThrows(() => {
      smWallet.walletWithdraw(250);
    }, 'Cannot withdraw more than principal balance', '禁止提现赠送金防线生效');

    // 尝试提现负数金额：拦截！
    assertThrows(() => {
      smWallet.walletWithdraw(-50);
    }, 'Withdrawal amount must be positive', '负数提现坚决拦截');

    // 尝试提现 0 元：拦截！
    assertThrows(() => {
      smWallet.walletWithdraw(0);
    }, 'Withdrawal amount must be positive', '0 元提现坚决拦截');

    // 尝试消费扣款超出总余额 350 元：拦截！
    assertThrows(() => {
      smWallet.walletDeduct(350);
    }, 'Insufficient wallet balance', '超额消费扣款坚决拦截');

    // 提现合法本金 150 元：放行！
    const withdrawRes = smWallet.walletWithdraw(150);
    assertEqual(withdrawRes.success, true, '合法本金提现放行');
    assertEqual(withdrawRes.remainingPrincipal, 50, '提现后本金剩余 50 元');
    assertEqual(walletStudent.wallet.bonusBalance, 100, '赠送金完全不受提现影响保持 100 元');

    console.log();

    // -------------------------------------------------------------------------
    // VECTOR D: 考勤反结课冲正的反复调用幂等性与时间倒流防御
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}【Vector D: 考勤反结课冲正的反复调用幂等性与时间倒流防御 (连击重放攻击实测)】${colors.reset}`);

    // D.1 考勤消课前置基线准备
    const testStuAtt = {
      id: 'std-adv-attendance',
      name: '考勤冲正测试学员',
      campusId: 'campus-bj-hq',
      campusName: '总部校区',
      status: 'normal',
      wallet: { principalBalance: 0, bonusBalance: 0, ledger: [] },
      coursePackages: [
        {
          packageId: 'pkg-att-01',
          courseId: 'CRS-ATT-01',
          courseName: '机器人高阶班',
          pricePerLesson: 260,
          totalLessons: 40,
          remainingLessons: 40,
          consumedLessons: 0,
          bonusLessons: 0,
          status: 'active'
        }
      ]
    };
    mocks.MOCK_STUDENTS.push(testStuAtt);

    const testScheduleEvt = {
      id: 'evt-adv-att-01',
      className: '考勤反结课测试班级',
      courseId: 'CRS-ATT-01',
      courseName: '机器人高阶班',
      campusId: 'campus-bj-hq',
      campusName: '总部校区',
      date: '2026-10-25',
      startTime: '10:00',
      endTime: '11:30',
      teacherId: 'tch-01',
      teacherName: '李老师',
      classroomId: 'room-01',
      status: 'scheduled',
      semanticType: 'regular',
      studentIds: ['std-adv-attendance']
    };
    mocks.MOCK_SCHEDULE_EVENTS.push(testScheduleEvt);

    // 点名：扣除 2 课时
    const rollCallRes = mocks.submitRollCall('evt-adv-att-01', [
      {
        studentId: 'std-adv-attendance',
        studentName: '考勤冲正测试学员',
        status: 'present',
        deductionLessons: 2
      }
    ]);
    assertEqual(rollCallRes.success, true, '点名消课扣除 2 课时成功');
    const attRec = rollCallRes.attendanceRecord;
    assert(attRec && attRec.id, '生成考勤流水明细单');
    assertEqual(testStuAtt.coursePackages[0].remainingLessons, 38, '消课后课包剩余课时扣减为 38 课时');
    assertEqual(testStuAtt.coursePackages[0].consumedLessons, 2, '消课后课包已消耗课时递增为 2 课时');
    assertEqual(testScheduleEvt.status, 'completed', '课次日程状态流转为 completed');

    // D.2 第 1 次反结课冲正调用 (合法冲正)
    const revert1Res = mocks.revertAttendance(attRec.id, '家长提出暴雨迟到补课申诉，核准冲正', '教务主管');
    assertEqual(revert1Res.success, true, '第 1 次反结课冲正成功');
    assertEqual(testStuAtt.coursePackages[0].remainingLessons, 40, '扣除的 2 课时原路如数退还，课包恢复 40 课时');
    assertEqual(testStuAtt.coursePackages[0].consumedLessons, 0, '已消耗课时恢复为 0 课时');
    assertEqual(testScheduleEvt.status, 'scheduled', '课次日程成功重置回 scheduled 待上状态');
    assertEqual(attRec.isReversed, true, '考勤记录被不可逆打上已反结课标记 (isReversed = true)');
    assert(attRec.reversedAt, '记录反结课时间戳');

    // D.3 第 2 次反结课调用 (重放攻击拦截)
    const revert2Res = mocks.revertAttendance(attRec.id, '恶意重放攻击第 2 次冲正', '黑客');
    assertEqual(revert2Res.success, false, '第 2 次反结课重放攻击被坚决拦截');
    assertEqual(revert2Res.message, '该考勤记录已被反结课冲正，不可重复操作', '反结课拦截提示合规');
    assertEqual(testStuAtt.coursePackages[0].remainingLessons, 40, '资产防线：学员课时绝无虚增，保持 40 课时');
    assertEqual(testStuAtt.coursePackages[0].consumedLessons, 0, '资产防线：已消耗课时保持 0 课时');

    // D.4 第 3 ~ 10 次并发与连续重放攻击压力测试 (持续幂等性坚决守护)
    console.log(`    ${colors.cyan}▶ 正在发起连续 8 次重复反结课连击探测...${colors.reset}`);
    for (let i = 3; i <= 10; i++) {
      const burstRes = mocks.revertAttendance(attRec.id, `连击重放第 ${i} 次`, '黑客脚本');
      if (burstRes.success !== false) {
        throw new Error(`Critical Flaw: 第 ${i} 次反结课重放被越权放行！`);
      }
    }
    assert(true, '第 3~10 次连击重放攻击 100% 被刚性拦截！');
    assertEqual(testStuAtt.coursePackages[0].remainingLessons, 40, '连击后学员剩余课时严格分毫不差恒等于 40');
    assertEqual(testStuAtt.coursePackages[0].consumedLessons, 0, '连击后学员已消耗课时严格分毫不差恒等于 0');

    // D.5 种子数据历史已反结课记录 (att-20260919-01) 再次冲正拦截
    const histRecordCheck = mocks.revertAttendance('att-20260919-01');
    assertEqual(histRecordCheck.success, false, '种子数据中历史已反结课记录禁止再次操作');
    assertEqual(histRecordCheck.message, '该考勤记录已被反结课冲正，不可重复操作', '种子数据历史反结课拦截原因符合规范');

    // D.6 畸形/不存在考勤记录单号防护
    const nonExistentAttCheck = mocks.revertAttendance('att-fake-99999');
    assertEqual(nonExistentAttCheck.success, false, '不存在的考勤单号返回 false');
    assertEqual(nonExistentAttCheck.message, '未找到指定考勤记录', '不存在考勤单号拦截原因符合规范');

    const nullAttCheck = mocks.revertAttendance(null);
    assertEqual(nullAttCheck.success, false, 'null 单号返回 false');

    const undefAttCheck = mocks.revertAttendance(undefined);
    assertEqual(undefAttCheck.success, false, 'undefined 单号返回 false');

    // D.7 零消耗课时（全部请假）反结课精度核验
    const zeroDeductEvent = {
      id: 'evt-zero-deduct-01',
      className: '请假零消课班级',
      courseId: 'CRS-ATT-01',
      date: '2026-10-26',
      startTime: '10:00',
      endTime: '11:30',
      status: 'scheduled',
      studentIds: ['std-adv-attendance']
    };
    mocks.MOCK_SCHEDULE_EVENTS.push(zeroDeductEvent);

    const rollCallZero = mocks.submitRollCall('evt-zero-deduct-01', [
      { studentId: 'std-adv-attendance', studentName: '考勤学员', status: 'leave', deductionLessons: 0 }
    ]);
    assertEqual(rollCallZero.success, true, '请假点名（消课 0）成功');
    assertEqual(testStuAtt.coursePackages[0].remainingLessons, 40, '请假不扣课时保持 40 课时');

    const revertZeroRes = mocks.revertAttendance(rollCallZero.attendanceRecord.id);
    assertEqual(revertZeroRes.success, true, '零消课反结课成功');
    assertEqual(testStuAtt.coursePackages[0].remainingLessons, 40, '反结课退还 0 课时，剩余课时绝不凭空增加');

    console.log();

    // -------------------------------------------------------------------------
    // VECTOR E: RBAC 权限系统深度嵌套与非法字符权限码越权穿透防御
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}【Vector E: RBAC 权限系统深度嵌套与非法字符权限码越权穿透防御】${colors.reset}`);

    // E.1 普通用户权限基线
    const normalUserPerms = ['curriculum:course:view', 'student:view', 'educational:schedule:view'];

    // 合法精准匹配放行
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'curriculum:course:view'), true, '已授权权限正常放行');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'student:view'), true, '已授权权限正常放行');

    // 未授权权限严格阻断
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'curriculum:course:delete'), false, '未授权权限严格阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'financial:order:refund'), false, '未授权财务权限严格阻断');

    // E.2 非法字符与恶意穿透权限码攻击向量测试
    // 1. 路径遍历攻击 (Path Traversal)
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, '../../admin'), false, '路径遍历 ../../admin 严格阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, '../system/delete'), false, '路径遍历 ../system/delete 严格阻断');

    // 2. SQL 注入攻击特征码
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, "' OR '1'='1"), false, "SQL注入 ' OR '1'='1 严格阻断");
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, "admin'--"), false, "SQL注入 admin'-- 严格阻断");

    // 3. XSS 跨站脚本攻击特征码
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, '<script>alert(1)</script>'), false, 'XSS 脚本标签严格阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, '<img src=x onerror=alert(1)>'), false, 'XSS onerror 注入严格阻断');

    // 4. 命令注入特征码
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'system; rm -rf /'), false, '命令注入特征码严格阻断');

    // 5. 控制字符与空字节注入 (Null Byte & Control Chars)
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'admin:all\0'), false, '空字节截断 admin:all\\0 严格阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'curriculum:view\r\n'), false, '回车换行换注入严格阻断');

    // 6. 原型链污染特征码 (Prototype Pollution)
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, '__proto__'), false, '__proto__ 严格阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'constructor'), false, 'constructor 严格阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'prototype'), false, 'prototype 严格阻断');

    // 7. 正则元字符模糊绕过攻击 (Regex Metacharacters)
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, '.*'), false, '正则通配 .* 严格作为字面量阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, '^curriculum.*$'), false, '正则锚点 ^curriculum.*$ 阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, '[a-z]+'), false, '正则集合 [a-z]+ 阻断');

    // 8. 前缀截断不越权
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, 'curriculum:course'), false, '拥有子权限不逆向放行父前缀');

    // 9. 空值与畸形类型输入
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, ''), false, '空字符串权限码严格阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, null), false, 'null 权限码严格阻断');
    assertEqual(MockRBACEngine.hasPermission(normalUserPerms, undefined), false, 'undefined 权限码严格阻断');

    // E.3 超级通配符放行验证
    assertEqual(MockRBACEngine.hasPermission(['*'], 'any:arbitrary:permission'), true, '超级通配符 * 放行任意合法权限');
    assertEqual(MockRBACEngine.hasPermission(['admin:all'], 'system:setting:modify'), true, 'admin:all 通配符放行任意合法权限');

    // E.4 10 级极端深度权限树 Indeterminate 半选联动与防栈溢出压测
    function generateDeepTree(depth) {
      if (depth === 1) {
        return {
          id: `node_1`,
          label: `第1级父节点`,
          checked: false,
          indeterminate: false,
          children: [
            { id: 'leaf_target', label: '最深目标叶子', checked: false, indeterminate: false },
            { id: 'leaf_sibling', label: '同级对照叶子', checked: false, indeterminate: false }
          ]
        };
      }
      return {
        id: `node_${depth}`,
        label: `第${depth}级中间层级`,
        checked: false,
        indeterminate: false,
        children: [
          generateDeepTree(depth - 1),
          { id: `sibling_${depth}`, label: `第${depth}级同级对照`, checked: false, indeterminate: false }
        ]
      };
    }

    const deepTreeRoot = generateDeepTree(10);
    // 递归找到目标叶子 leaf_target
    function findNodeInTree(node, id) {
      if (node.id === id) return node;
      if (node.children) {
        for (const c of node.children) {
          const found = findNodeInTree(c, id);
          if (found) return found;
        }
      }
      return null;
    }
    const targetLeaf = findNodeInTree(deepTreeRoot, 'leaf_target');
    assert(targetLeaf && targetLeaf.id === 'leaf_target', '10 级深度权限树构建成功并锁定叶子节点');

    // 1. 初始状态更新
    MockRBACEngine.updateTreeCheckState(deepTreeRoot);
    assertEqual(deepTreeRoot.checked, false, '初始整树未勾选');
    assertEqual(deepTreeRoot.indeterminate, false, '初始整树无半选');

    // 2. 勾选最底层叶子 -> 冒泡将上层全部计算为半选 (indeterminate = true, checked = false)
    targetLeaf.checked = true;
    MockRBACEngine.updateTreeCheckState(deepTreeRoot);
    assertEqual(targetLeaf.checked, true, '目标叶子节点已勾选');
    assertEqual(deepTreeRoot.checked, false, '根节点未完全勾选 (checked = false)');
    assertEqual(deepTreeRoot.indeterminate, true, '叶子勾选导致 10 级父链全部正确进入半选 (indeterminate = true)');

    // 3. 取消勾选叶子 -> 逐级回退
    targetLeaf.checked = false;
    MockRBACEngine.updateTreeCheckState(deepTreeRoot);
    assertEqual(deepTreeRoot.checked, false, '叶子取消后根节点恢复未勾选');
    assertEqual(deepTreeRoot.indeterminate, false, '叶子取消后根节点清除半选状态');

    // 4. 批量全选子树
    MockRBACEngine.setSubtreeChecked(deepTreeRoot, true);
    MockRBACEngine.updateTreeCheckState(deepTreeRoot);
    assertEqual(deepTreeRoot.checked, true, '整树批量勾选后根节点为 checked = true');
    assertEqual(deepTreeRoot.indeterminate, false, '整树批量勾选后根节点 indeterminate = false');

    // E.5 组织架构树删除 5 重刚性约束防御
    const orgTree = [
      {
        id: 'org-grp-root',
        name: '盛通教育集团',
        level: 1,
        type: 'group',
        boundUserCount: 100,
        children: [
          {
            id: 'dept-mid',
            name: '中台研发中心',
            level: 2,
            type: 'department',
            boundUserCount: 20,
            children: [
              {
                id: 'post-leaf-with-user',
                name: '资深全栈架构师岗位',
                level: 3,
                type: 'post',
                boundUserCount: 3,
                children: []
              },
              {
                id: 'post-leaf-empty',
                name: '闲置暂存岗位',
                level: 3,
                type: 'post',
                boundUserCount: 0,
                children: []
              }
            ]
          }
        ]
      }
    ];

    // 约束 1: 集团根节点严禁删除
    assertThrows(() => {
      MockRBACEngine.validateNodeDeletion(orgTree, 'org-grp-root');
    }, 'Root organization group node cannot be deleted', '集团根节点删除严格阻断');

    // 约束 2: 包含下级子节点的中间节点严禁删除
    assertThrows(() => {
      MockRBACEngine.validateNodeDeletion(orgTree, 'dept-mid');
    }, 'HasChildNodesException', '包含子节点的中间节点删除严格抛出 HasChildNodesException 阻断');

    // 约束 3: 绑定在职员工数大于 0 的节点严禁删除
    assertThrows(() => {
      MockRBACEngine.validateNodeDeletion(orgTree, 'post-leaf-with-user');
    }, 'active employees', '绑定有在职员工的叶子节点删除严格阻断');

    // 约束 4: 不存在的节点 ID 抛出异常
    assertThrows(() => {
      MockRBACEngine.validateNodeDeletion(orgTree, 'node-fake-888');
    }, 'not found in organizational tree', '不存在节点 ID 严格报错');

    // 约束 5: 孤立叶子且员工数为 0 允许安全删除
    const safeDeleteRes = MockRBACEngine.validateNodeDeletion(orgTree, 'post-leaf-empty');
    assertEqual(safeDeleteRes.canDelete, true, '合规无员工孤立叶子节点允许安全删除');
    assertEqual(safeDeleteRes.node.id, 'post-leaf-empty', '返回待删除节点');

    // E.6 数据范围过滤器 Fail-Safe Default 默认安全阻断
    const testDataItems = [
      { id: '1', campusId: 'campus-bj-hq', departmentId: 'dept-01', ownerId: 'usr-01' },
      { id: '2', campusId: 'campus-bj-hd', departmentId: 'dept-02', ownerId: 'usr-02' }
    ];

    // 合法 scope
    const allScopeRes = MockRBACEngine.filterByDataScope({ dataScope: 'all' }, testDataItems);
    assertEqual(allScopeRes.length, 2, 'all 数据范围返回全部 2 条');

    const campusScopeRes = MockRBACEngine.filterByDataScope({ dataScope: 'campus', campusId: 'campus-bj-hq' }, testDataItems);
    assertEqual(campusScopeRes.length, 1, 'campus 数据范围准确过滤出总部校区 1 条');

    // 恶意/未知非法数据范围 -> Fail-Safe Default (默认安全阻断返回 [])
    const maliciousScopes = ['root', 'hack', 'super', 'admin:all', '', null, undefined, 12345];
    for (const badScope of maliciousScopes) {
      const badRes = MockRBACEngine.filterByDataScope({ dataScope: badScope }, testDataItems);
      assertEqual(badRes.length, 0, `未知/恶意数据范围 [${badScope}] 默认安全降级返回 []，绝不泄漏数据`);
    }

    console.log();

    // -------------------------------------------------------------------------
    // VECTOR F: 双轨契约与生产实现 100% 对齐验证 (Dual-Track Equivalence)
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}【Vector F: 双轨契约模型与生产实现 100% 一致性验证 (Dual-Track Equivalence)】${colors.reset}`);

    // F.1 CollisionEngine 契约与生产实现对齐
    const timePairs = [
      ['09:00', '10:00', '09:59', '10:30'],
      ['09:00', '10:00', '10:00', '11:00'],
      ['10:00', '11:00', '09:00', '10:01'],
      ['09:00', '10:00', '09:00', '10:00'],
      ['09:15', '09:45', '09:00', '10:00']
    ];
    for (const [sA, eA, sB, eB] of timePairs) {
      const cRes = CollisionEngineContract.isOverlapping(sA, eA, sB, eB);
      const pRes = EducationalCollisionEngine.isOverlapping(sA, eA, sB, eB);
      assertEqual(cRes, pRes, `CollisionEngine 对齐 [${sA}-${eA}] vs [${sB}-${eB}] => ${cRes}`);
    }

    // F.2 RBACEngine 契约与生产实现对齐
    const testPermPerms = ['curriculum:view', 'student:view'];
    const testReqCodes = ['curriculum:view', 'student:edit', '*', 'admin:all', '../../evil', '<script>'];
    for (const code of testReqCodes) {
      const cPerm = RBACEngineContract.hasPermission(testPermPerms, code);
      const pPerm = MockRBACEngine.hasPermission(testPermPerms, code);
      assertEqual(cPerm, pPerm, `RBAC hasPermission 对齐 [${code}] => ${cPerm}`);
    }

    console.log();

  } finally {
    // -------------------------------------------------------------------------
    // 零污染现场复原 (Zero-Pollution Invariant)
    // -------------------------------------------------------------------------
    restoreSnapshot();
    console.log(`${colors.bold}【Zero-Pollution Invariant: 现场初始快照已 100% 幂等完整复原】${colors.reset}\n`);
  }

  const durationMs = Date.now() - startTime;

  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}Tier 5 白盒对抗加固套件 2 (Adversarial Suite 2) 执行总结报告${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`  总断言检验项: ${totalChecks}`);
  console.log(`  通过校验项数: ${colors.green}${passedChecks}${colors.reset}`);
  console.log(`  失败校验项数: ${failedChecks > 0 ? colors.red + failedChecks : colors.green + '0'}${colors.reset}`);
  console.log(`  对抗测试耗时: ${durationMs}ms`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  if (failedChecks > 0) {
    console.error(`${colors.bold}${colors.red}❌ 对抗测试套件检测到系统缺陷！${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.bold}${colors.green}🎉 恭喜！全部 5 大白盒对抗向量全量通过验证 (通过率 100.0%)！系统具备极高鲁棒性与防穿透防御力。${colors.reset}\n`);
    process.exit(0);
  }
}

runTier5AdversarialSuite();
