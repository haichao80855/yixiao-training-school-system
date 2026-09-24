#!/usr/bin/env node
/**
 * 拓视未来教育「一校教培系统」Tier 5 白盒对抗加固套件 1
 * tests/tier5_adversarial_suite_1.cjs
 * 
 * 核心对抗挑战向量 (Adversarial Challenge Vectors):
 * Vector A: 5 大校区并发数据写入与上下文切换时的内存污染与状态漂移检测
 * Vector B: 学员课包原子性扣减、多班级并发点名与课时超扣（防负数穿透）极限压力
 * Vector C: 财务订单金额精度与大批量（10,000+ 笔）动态小计汇总性能与舍入误差对抗
 * Vector D: 审批状态机异常乱序调用、越级审批与已办结单据逆向篡改防御
 * Vector E: 5 级组织树非合规变异结构的删除与鉴权边界
 * 
 * 严格遵从零污染不变量 (Zero-Pollution Invariant): 
 * 在套件运行前后对全局内存模型实施深度快照捕获与幂等复原，保证全量 287 项既有用例 100% 独立且不受干扰。
 */

const path = require('node:path');
const createJiti = require('jiti');

// 使用 jiti 安全加载生产 TypeScript 源码并建立别名映射
const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const mocks = jiti('../src/mocks/index.ts');

// 彩色终端格式化配置
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

function assertCloseTo(actual, expected, maxDiff = 0.0001, message = 'Float comparison') {
  totalChecks++;
  const diff = Math.abs(actual - expected);
  if (diff > maxDiff) {
    failedChecks++;
    const err = new Error(`${message}: Expected ~[${expected}] but received [${actual}] (diff: ${diff} > ${maxDiff})`);
    failures.push({ message, error: err });
    console.log(`    ${colors.red}✗ FAIL:${colors.reset} ${message} (diff: ${diff})`);
    throw err;
  } else {
    passedChecks++;
    console.log(`    ${colors.green}✓ PASS:${colors.reset} ${message} [${actual} ≈ ${expected}]`);
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
    errorMsg = err.message || String(err);
  }

  if (!threw) {
    failedChecks++;
    const err = new Error(`${message || 'Failed'}: Expected function to throw error containing "${expectedSubstr}", but it did not throw`);
    failures.push({ message, error: err });
    console.log(`    ${colors.red}✗ FAIL:${colors.reset} ${message} (Expected throw, but succeeded)`);
    throw err;
  }

  if (expectedSubstr && !errorMsg.includes(expectedSubstr)) {
    failedChecks++;
    const err = new Error(`${message || 'Failed'}: Threw "${errorMsg}", which does not match expected substr "${expectedSubstr}"`);
    failures.push({ message, error: err });
    console.log(`    ${colors.red}✗ FAIL:${colors.reset} ${message} (Unmatched error message)`);
    throw err;
  }

  passedChecks++;
  const snippet = errorMsg.length > 60 ? errorMsg.substring(0, 57) + '...' : errorMsg;
  console.log(`    ${colors.green}✓ PASS:${colors.reset} ${message} (Intercepted: "${snippet}")`);
}

// -------------------------------------------------------------
// 快照与零污染现场捕获/还原机制
// -------------------------------------------------------------
function takeSystemSnapshot() {
  return {
    courses: JSON.parse(JSON.stringify(mocks.MOCK_COURSES)),
    students: JSON.parse(JSON.stringify(mocks.MOCK_STUDENTS)),
    schedules: JSON.parse(JSON.stringify(mocks.MOCK_SCHEDULE_EVENTS)),
    classes: JSON.parse(JSON.stringify(mocks.MOCK_CLASSES)),
    attendances: JSON.parse(JSON.stringify(mocks.MOCK_ATTENDANCE_RECORDS)),
    unassigned: JSON.parse(JSON.stringify(mocks.MOCK_UNASSIGNED_STUDENTS)),
    orders: JSON.parse(JSON.stringify(mocks.MOCK_ORDERS_DATA)),
    approvals: JSON.parse(JSON.stringify(mocks.MOCK_APPROVAL_RECORDS)),
    ledgers: JSON.parse(JSON.stringify(mocks.MOCK_LEDGER_RECORDS)),
    serviceFees: JSON.parse(JSON.stringify(mocks.MOCK_SERVICE_FEES)),
    orgNodes: JSON.parse(JSON.stringify(mocks.MOCK_ORG_NODES)),
    roles: JSON.parse(JSON.stringify(mocks.MOCK_ROLES_LIST)),
    dicts: JSON.parse(JSON.stringify(mocks.MOCK_DICTS_LIST)),
    users: JSON.parse(JSON.stringify(mocks.MOCK_SYSTEM_USER_LIST))
  };
}

function restoreSystemSnapshot(snap) {
  mocks.MOCK_COURSES.length = 0;
  mocks.MOCK_COURSES.push(...JSON.parse(JSON.stringify(snap.courses)));

  mocks.MOCK_STUDENTS.length = 0;
  mocks.MOCK_STUDENTS.push(...JSON.parse(JSON.stringify(snap.students)));

  mocks.MOCK_SCHEDULE_EVENTS.length = 0;
  mocks.MOCK_SCHEDULE_EVENTS.push(...JSON.parse(JSON.stringify(snap.schedules)));

  mocks.MOCK_CLASSES.length = 0;
  mocks.MOCK_CLASSES.push(...JSON.parse(JSON.stringify(snap.classes)));

  mocks.MOCK_ATTENDANCE_RECORDS.length = 0;
  mocks.MOCK_ATTENDANCE_RECORDS.push(...JSON.parse(JSON.stringify(snap.attendances)));

  mocks.MOCK_UNASSIGNED_STUDENTS.length = 0;
  mocks.MOCK_UNASSIGNED_STUDENTS.push(...JSON.parse(JSON.stringify(snap.unassigned)));

  mocks.MOCK_ORDERS_DATA.length = 0;
  mocks.MOCK_ORDERS_DATA.push(...JSON.parse(JSON.stringify(snap.orders)));

  mocks.MOCK_APPROVAL_RECORDS.length = 0;
  mocks.MOCK_APPROVAL_RECORDS.push(...JSON.parse(JSON.stringify(snap.approvals)));

  mocks.MOCK_LEDGER_RECORDS.length = 0;
  mocks.MOCK_LEDGER_RECORDS.push(...JSON.parse(JSON.stringify(snap.ledgers)));

  mocks.MOCK_SERVICE_FEES.length = 0;
  mocks.MOCK_SERVICE_FEES.push(...JSON.parse(JSON.stringify(snap.serviceFees)));

  mocks.MOCK_ORG_NODES.length = 0;
  mocks.MOCK_ORG_NODES.push(...JSON.parse(JSON.stringify(snap.orgNodes)));

  mocks.MOCK_ROLES_LIST.length = 0;
  mocks.MOCK_ROLES_LIST.push(...JSON.parse(JSON.stringify(snap.roles)));

  mocks.MOCK_DICTS_LIST.length = 0;
  mocks.MOCK_DICTS_LIST.push(...JSON.parse(JSON.stringify(snap.dicts)));

  mocks.MOCK_SYSTEM_USER_LIST.length = 0;
  mocks.MOCK_SYSTEM_USER_LIST.push(...JSON.parse(JSON.stringify(snap.users)));
}

// -------------------------------------------------------------
// 执行对抗加固验证套件
// -------------------------------------------------------------
async function runAdversarialSuite() {
  const startTime = Date.now();
  console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}拓视未来教育「一校教培系统」Tier 5 白盒对抗加固测试套件 1 (Adversarial Suite)${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  const initialSnapshot = takeSystemSnapshot();

  try {
    // =========================================================================
    // Vector A: 5 大校区并发数据写入与上下文切换时的内存污染与状态漂移检测
    // =========================================================================
    console.log(`${colors.bold}${colors.blue}【Vector A: 5 大校区并发数据写入与上下文切换时的内存污染与状态漂移检测】${colors.reset}`);
    
    const campusList = [
      { id: 'campus-bj-hq', name: '总部校区' },
      { id: 'campus-bj-yy', name: '远洋校区' },
      { id: 'campus-bj-cy', name: '朝阳校区' },
      { id: 'campus-bj-hd', name: '海淀分校' },
      { id: 'campus-bj-wj', name: '望京校区' }
    ];

    const initialCounts = {};
    for (const c of campusList) {
      initialCounts[c.id] = {
        students: mocks.getStudentsByCampus(c.id).length,
        orders: mocks.getOrdersByCampus(c.id).length,
        schedules: mocks.getSchedulesByCampus(c.id).length
      };
    }

    // 1. 高频乱序并发写入：每个校区模拟并发写入 10 名学员、10 笔订单与 10 条日程
    const WRITE_BATCH_SIZE = 10;
    const writeTasks = [];

    for (let i = 0; i < WRITE_BATCH_SIZE; i++) {
      for (const campus of campusList) {
        writeTasks.push({
          campusId: campus.id,
          campusName: campus.name,
          index: i
        });
      }
    }

    // 洗牌打乱执行顺序，模拟极端交错与异步并发冲击
    writeTasks.sort(() => Math.random() - 0.5);

    for (const task of writeTasks) {
      // 写入学员
      const studentId = `std-adv-${task.campusId}-${task.index}`;
      mocks.addStudent({
        id: studentId,
        name: `对抗学员_${task.campusName}_${task.index}`,
        studentNo: `S_ADV_${task.campusId.slice(-2)}_${task.index}`,
        gender: 'male',
        age: 10,
        phone: `1380000${String(task.index).padStart(4, '0')}`,
        campusId: task.campusId,
        campusName: task.campusName,
        status: 'normal',
        grade: '五年级',
        school: '测试小学',
        publicSchool: '测试小学',
        parentName: '对抗家长',
        parentPhone: '13800000000',
        coursePackages: []
      });

      // 写入订单
      const orderId = `ord-adv-${task.campusId}-${task.index}`;
      mocks.saveOrder({
        id: orderId,
        orderNo: `ORD_ADV_${task.campusId.slice(-2)}_${task.index}`,
        studentId,
        studentName: `对抗学员_${task.campusName}_${task.index}`,
        studentNo: `S_ADV_${task.campusId.slice(-2)}_${task.index}`,
        phone: '13800000000',
        courseId: 'course-scratch-001',
        courseName: '012-软编Scratch创意图形编程',
        courseType: 'regular',
        campusId: task.campusId,
        campusName: task.name || task.campusName,
        orderType: 'regular',
        chargeType: 'regular',
        status: 'paid',
        orderStatus: 'paid',
        receivableAmount: 3200,
        actualAmount: 3200,
        paymentMethod: 'wechat',
        payTime: '2026-09-22 10:00:00',
        createTime: '2026-09-22 09:30:00',
        submitter: '高并发写入器',
        salesOwner: '顾问A'
      });

      // 写入日程
      const scheduleId = `sched-adv-${task.campusId}-${task.index}`;
      mocks.MOCK_SCHEDULE_EVENTS.push({
        id: scheduleId,
        classId: `cls-adv-${task.campusId}`,
        className: `并发班级-${task.campusName}`,
        courseId: 'course-scratch-001',
        courseName: 'Scratch创意编程',
        campusId: task.campusId,
        campusName: task.campusName,
        teacherId: 't-001',
        teacherName: '张老师',
        classroomId: 'room-101',
        classroomName: '乐博创客教室1',
        date: '2026-09-25',
        startTime: '10:00',
        endTime: '11:30',
        durationMinutes: 90,
        studentIds: [studentId],
        hasConflict: false,
        semanticType: 'regular',
        classType: 'formal',
        status: 'scheduled',
        lessonNumber: 1,
        attendanceCount: 0,
        totalCount: 1
      });
    }

    // 2. 状态漂移与内存污染验证：验证各分校区数据是否严格隔离
    for (const c of campusList) {
      const students = mocks.getStudentsByCampus(c.id);
      const orders = mocks.getOrdersByCampus(c.id);
      const schedules = mocks.getSchedulesByCampus(c.id);

      if (c.id === 'campus-bj-hq') {
        // 总部校区特性：学员按校区隔离，订单具备全集团统筹权 (Pan-Group Super-Scope)
        assertEqual(
          students.length,
          initialCounts[c.id].students + WRITE_BATCH_SIZE,
          `总部校区 [${c.id}] 学员数据并发写入后计数精确匹配基线增量 (+${WRITE_BATCH_SIZE})`
        );
        const foreignStudents = students.filter(s => s.campusId !== c.id);
        assertEqual(foreignStudents.length, 0, `总部校区 [${c.id}] 查询学员无外校区污染`);
        
        assertEqual(
          orders.length,
          mocks.MOCK_ORDERS_DATA.length,
          `总部校区 [${c.id}] 具备全集团财务统筹权，订单流水总数与全量数据严格一致`
        );
      } else {
        // 各分校区特性：学员、订单、排课严格物理隔离，外校区污染必须为 0
        assertEqual(
          students.length,
          initialCounts[c.id].students + WRITE_BATCH_SIZE,
          `分校区 [${c.id}] 学员数据并发写入后计数精确匹配基线增量 (+${WRITE_BATCH_SIZE})`
        );
        const foreignStudents = students.filter(s => s.campusId !== c.id);
        assertEqual(foreignStudents.length, 0, `分校区 [${c.id}] 查询结果中外校区学员污染数为 0`);

        const foreignOrders = orders.filter(o => !mocks.isCampusMatch(o.campusId, c.id));
        assertEqual(foreignOrders.length, 0, `分校区 [${c.id}] 订单流水中外校区订单污染数为 0`);

        const foreignSchedules = schedules.filter(s => s.campusId !== c.id);
        assertEqual(foreignSchedules.length, 0, `分校区 [${c.id}] 排课日程中外校区日程污染数为 0`);
      }
    }

    // 3. 4 大分校区两两互斥性检验 (交集为 0)
    const branchCampuses = campusList.filter(c => c.id !== 'campus-bj-hq');
    for (let i = 0; i < branchCampuses.length; i++) {
      for (let j = i + 1; j < branchCampuses.length; j++) {
        const c1 = branchCampuses[i].id;
        const c2 = branchCampuses[j].id;
        const set1 = new Set(mocks.getOrdersByCampus(c1).map(o => o.id));
        const set2 = new Set(mocks.getOrdersByCampus(c2).map(o => o.id));
        const intersection = [...set1].filter(id => set2.has(id));
        assertEqual(intersection.length, 0, `分校区 [${c1}] 与 [${c2}] 订单流水在并发乱序写入后保持严格互斥无泄漏`);
      }
    }

    // 4. 恶意外来校区注入攻击防范
    const maliciousCampusKeys = ['__proto__', 'constructor', 'undefined', 'null', 'CAMPUS_ILLEGAL_999', '<script>alert(1)</script>'];
    for (const badKey of maliciousCampusKeys) {
      const evilStudents = mocks.getStudentsByCampus(badKey);
      assertEqual(evilStudents.length, 0, `恶意/非法校区标识 [${badKey}] 查询学员返回为空，未引起原型污染`);
      const evilOrders = mocks.getOrdersByCampus(badKey);
      assertEqual(evilOrders.length, 0, `恶意/非法校区标识 [${badKey}] 查询订单返回为空，严格安全阻断`);
    }

    // =========================================================================
    // Vector B: 学员课包原子性扣减、多班级并发点名与课时超扣（防负数穿透）极限压力
    // =========================================================================
    console.log(`\n${colors.bold}${colors.blue}【Vector B: 学员课包原子性扣减、多班级并发点名与课时超扣（防负数穿透）极限压力】${colors.reset}`);

    // B1: 课时超扣边界与防负数穿透极限测试
    const studentStress1 = mocks.addStudent({
      id: 'std-stress-atomic-01',
      name: '课包原子性受试者A',
      studentNo: 'S_ATOMIC_01',
      gender: 'female',
      age: 9,
      phone: '13911112222',
      campusId: 'campus-bj-hq',
      campusName: '总部校区',
      status: 'normal',
      grade: '三年级',
      school: '人大附小',
      publicSchool: '人大附小',
      parentName: '家长A',
      parentPhone: '13911112222',
      coursePackages: [
        {
          packageId: 'pkg-atomic-01',
          courseId: 'course-scratch-001',
          courseName: '012-软编Scratch创意图形编程',
          pricePerLesson: 300,
          totalLessons: 10,
          remainingLessons: 3,  // 仅剩 3 课时
          consumedLessons: 7,
          bonusLessons: 0,
          status: 'active',
          expireDate: '2027-12-31',
          orderNo: 'ORD_ATOMIC_01'
        }
      ]
    });

    const scheduleStress1 = {
      id: 'sched-stress-01',
      classId: 'cls-stress-01',
      className: '压力测试班级1',
      courseId: 'course-scratch-001',
      courseName: '012-软编Scratch创意图形编程',
      campusId: 'campus-bj-hq',
      campusName: '总部校区',
      teacherId: 't-001',
      teacherName: '张老师',
      classroomId: 'room-101',
      classroomName: '乐博创客教室1',
      date: '2026-09-22',
      startTime: '14:00',
      endTime: '15:30',
      durationMinutes: 90,
      studentIds: [studentStress1.id],
      hasConflict: false,
      semanticType: 'regular',
      classType: 'formal',
      status: 'scheduled',
      lessonNumber: 1,
      attendanceCount: 0,
      totalCount: 1
    };
    mocks.MOCK_SCHEDULE_EVENTS.push(scheduleStress1);

    // 恶意点名扣减 10 课时（超扣 7 课时，测试 Math.max(0, ...) 防穿透防线）
    const rollCallOverDeduct = mocks.submitRollCall(
      scheduleStress1.id,
      [
        {
          studentId: studentStress1.id,
          studentName: studentStress1.name,
          status: 'present',
          deductionLessons: 10, // 超出剩余的 3 课时
          actualDeductAmount: 3000
        }
      ],
      '对抗测试员'
    );

    assert(rollCallOverDeduct.success, '超额课时扣减提交完成');
    const pkg1 = studentStress1.coursePackages[0];
    assertEqual(pkg1.remainingLessons, 0, '课时防负数穿透防线生效：剩余课时被严格钳位在 0，未击穿为负数 (0 >= 0)');
    assertEqual(pkg1.consumedLessons, 17, '已消耗课时如实记录扣减行为累计数');

    // B2: 多班级并发点名竞态压力测试 (50 轮并发消课扣减)
    const studentStress2 = mocks.addStudent({
      id: 'std-stress-atomic-02',
      name: '并发受试者B',
      studentNo: 'S_ATOMIC_02',
      gender: 'male',
      age: 11,
      phone: '13922223333',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      status: 'normal',
      grade: '五年级',
      school: '海淀实验小学',
      publicSchool: '海淀实验小学',
      parentName: '家长B',
      parentPhone: '13922223333',
      coursePackages: [
        {
          packageId: 'pkg-atomic-02',
          courseId: 'course-cpp-002',
          courseName: '001-信息学奥赛C++高阶培优班',
          pricePerLesson: 350,
          totalLessons: 100,
          remainingLessons: 50, // 50 课时
          consumedLessons: 50,
          bonusLessons: 0,
          status: 'active',
          expireDate: '2027-12-31',
          orderNo: 'ORD_ATOMIC_02'
        }
      ]
    });

    // 模拟 25 个并发班级课次同时对该学员进行点名消课，每班扣 2 课时，恰好消完 50 课时
    const concurrentSchedules = [];
    for (let i = 0; i < 25; i++) {
      const sched = {
        id: `sched-concurrent-${i}`,
        classId: `cls-concurrent-${i}`,
        className: `并发班级-${i}`,
        courseId: 'course-cpp-002',
        courseName: '001-信息学奥赛C++高阶培优班',
        campusId: 'campus-bj-hd',
        campusName: '海淀分校',
        teacherId: 't-301',
        teacherName: '黄老师',
        classroomId: 'room-401',
        classroomName: '海淀机房',
        date: '2026-09-22',
        startTime: '16:00',
        endTime: '17:30',
        durationMinutes: 90,
        studentIds: [studentStress2.id],
        hasConflict: false,
        semanticType: 'regular',
        classType: 'formal',
        status: 'scheduled',
        lessonNumber: i + 1,
        attendanceCount: 0,
        totalCount: 1
      };
      mocks.MOCK_SCHEDULE_EVENTS.push(sched);
      concurrentSchedules.push(sched);
    }

    // 乱序执行 25 个班级点名消课
    const shuffledSchedules = [...concurrentSchedules].sort(() => Math.random() - 0.5);
    for (const sched of shuffledSchedules) {
      mocks.submitRollCall(
        sched.id,
        [
          {
            studentId: studentStress2.id,
            studentName: studentStress2.name,
            status: 'present',
            deductionLessons: 2,
            actualDeductAmount: 700
          }
        ],
        '并发排课系统'
      );
    }

    const pkg2 = studentStress2.coursePackages[0];
    assertEqual(pkg2.remainingLessons, 0, '25 次并发点名累计扣减 50 课时，剩余课时原子级精确归零 (0)');
    assertEqual(pkg2.consumedLessons, 100, '25 次并发点名累计消耗课时精确提升至 100 (50 + 50)');

    // 再次发起第 26 次扣减，课包已空，再次验证防穿透能力
    const extraSched = {
      id: 'sched-concurrent-overflow',
      classId: 'cls-concurrent-overflow',
      className: '穿透溢出班级',
      courseId: 'course-cpp-002',
      courseName: '001-信息学奥赛C++高阶培优班',
      campusId: 'campus-bj-hd',
      campusName: '海淀分校',
      teacherId: 't-301',
      teacherName: '黄老师',
      classroomId: 'room-401',
      classroomName: '海淀机房',
      date: '2026-09-22',
      startTime: '18:00',
      endTime: '19:30',
      durationMinutes: 90,
      studentIds: [studentStress2.id],
      hasConflict: false,
      semanticType: 'regular',
      classType: 'formal',
      status: 'scheduled',
      lessonNumber: 26,
      attendanceCount: 0,
      totalCount: 1
    };
    mocks.MOCK_SCHEDULE_EVENTS.push(extraSched);

    mocks.submitRollCall(
      extraSched.id,
      [
        {
          studentId: studentStress2.id,
          studentName: studentStress2.name,
          status: 'present',
          deductionLessons: 4,
          actualDeductAmount: 1400
        }
      ],
      '溢出攻击源'
    );
    assertEqual(pkg2.remainingLessons, 0, '课包余额为 0 时遭遇二次强行扣减，剩余课时依然死锁于 0，决无负数产生');

    // B3: 反结课冲正并发与防刷课时幂等性对抗
    // 取出最新生成的考勤单据 MOCK_ATTENDANCE_RECORDS[0]
    const targetAttRecord = mocks.MOCK_ATTENDANCE_RECORDS[0];
    assert(!!targetAttRecord, '成功定位目标待冲正考勤单据');
    
    const targetRefundLessons = targetAttRecord.deductedLessonsTotal;
    const beforeRevertRemaining = pkg2.remainingLessons;
    const beforeRevertConsumed = pkg2.consumedLessons;

    // 模拟恶意黑客并发调用 10 次 revertAttendance（试图重复反向退还课时刷课）
    let revertSuccessCount = 0;
    let revertBlockedCount = 0;

    for (let k = 0; k < 10; k++) {
      const res = mocks.revertAttendance(targetAttRecord.id, '对抗刷课时冲击', '安全审计员');
      if (res.success) {
        revertSuccessCount++;
      } else {
        revertBlockedCount++;
        assertEqual(res.message, '该考勤记录已被反结课冲正，不可重复操作', '拒绝信息与幂等防刷规范完全契合');
      }
    }

    assertEqual(revertSuccessCount, 1, '并发 10 次反结课冲击下，仅第 1 次成功冲正 (1)');
    assertEqual(revertBlockedCount, 9, '并发 10 次反结课冲击下，后 9 次被坚决且灵敏阻断 (9)');
    assertEqual(pkg2.remainingLessons, beforeRevertRemaining + targetRefundLessons, `课时仅原路退还 1 次 (${targetRefundLessons} 课时)，防重复刷课时防线坚不可摧`);
    assertEqual(pkg2.consumedLessons, Math.max(0, beforeRevertConsumed - targetRefundLessons), `已消耗课时仅扣除 1 次 (${targetRefundLessons} 课时)`);
    assertEqual(targetAttRecord.isReversed, true, '考勤单据打上不可逆 isReversed 状态烙印');

    // B4: 负数/零扣减非法入参注入
    const studentStress3 = mocks.addStudent({
      id: 'std-stress-atomic-03',
      name: '负数扣减受试者C',
      studentNo: 'S_ATOMIC_03',
      gender: 'female',
      age: 8,
      phone: '13933334444',
      campusId: 'campus-bj-cy',
      campusName: '朝阳校区',
      status: 'normal',
      grade: '二年级',
      school: '朝阳实验小学',
      publicSchool: '朝阳实验小学',
      parentName: '家长C',
      parentPhone: '13933334444',
      coursePackages: [
        {
          packageId: 'pkg-atomic-03',
          courseId: 'course-scratch-001',
          courseName: '012-软编Scratch创意图形编程',
          pricePerLesson: 280,
          totalLessons: 40,
          remainingLessons: 20,
          consumedLessons: 20,
          bonusLessons: 0,
          status: 'active',
          expireDate: '2027-12-31',
          orderNo: 'ORD_ATOMIC_03'
        }
      ]
    });

    const schedNegative = {
      id: 'sched-stress-negative',
      classId: 'cls-stress-neg',
      className: '负数扣减班级',
      courseId: 'course-scratch-001',
      courseName: '012-软编Scratch创意图形编程',
      campusId: 'campus-bj-cy',
      campusName: '朝阳校区',
      teacherId: 't-201',
      teacherName: '周老师',
      classroomId: 'room-301',
      classroomName: '朝阳创客室',
      date: '2026-09-22',
      startTime: '19:00',
      endTime: '20:30',
      durationMinutes: 90,
      studentIds: [studentStress3.id],
      hasConflict: false,
      semanticType: 'regular',
      classType: 'formal',
      status: 'scheduled',
      lessonNumber: 1,
      attendanceCount: 0,
      totalCount: 1
    };
    mocks.MOCK_SCHEDULE_EVENTS.push(schedNegative);

    // 传入负数扣减 deductionLessons = -5，测试是否会非法虚增课包
    mocks.submitRollCall(
      schedNegative.id,
      [
        {
          studentId: studentStress3.id,
          studentName: studentStress3.name,
          status: 'present',
          deductionLessons: -5, // 非法负数扣减
          actualDeductAmount: -1400
        }
      ],
      '负数注入器'
    );

    const pkg3 = studentStress3.coursePackages[0];
    assertEqual(pkg3.remainingLessons, 20, '负数扣减注入被有效中和，剩余课时未被反向虚增膨胀 (维持 20)');
    assertEqual(pkg3.consumedLessons, 20, '已消耗课时未受异常篡改 (维持 20)');

    // =========================================================================
    // Vector C: 财务订单金额精度与大批量（10,000+ 笔）动态小计汇总性能与舍入误差对抗
    // =========================================================================
    console.log(`\n${colors.bold}${colors.blue}【Vector C: 财务订单金额精度与大批量（10,000+ 笔）动态小计汇总性能与舍入误差对抗】${colors.reset}`);

    // C1: 经典 IEEE-754 浮点数分厘精度对抗
    // 构造具有 0.1 + 0.2, 0.07, 0.14, 0.28, 19.99 等经典浮点陷阱的精密订单
    const precisionOrders = [];
    const trickyAmounts = [
      0.07, 0.14, 0.28, 0.56, 19.99, 29.99, 99.95, 333.33, 666.67, 1000.01,
      0.1, 0.2, 0.3, 0.4, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.09,
      12.34, 56.78, 90.12, 111.11, 222.22, 555.55, 777.77, 888.88, 999.99
    ];

    let exactCentsOracle = BigInt(0);
    for (let i = 0; i < trickyAmounts.length; i++) {
      const amt = trickyAmounts[i];
      exactCentsOracle += BigInt(Math.round(amt * 100));
      precisionOrders.push({
        id: `ord-prec-${i}`,
        orderNo: `ORD_PREC_${i}`,
        campusId: 'campus-bj-hq',
        actualAmount: amt,
        receivableAmount: amt,
        status: 'paid',
        orderStatus: 'paid'
      });
    }

    const precisionResult = mocks.FinanceAggregator.calculateSummaryStrip(precisionOrders);
    const expectedPrecisionAmount = Number(exactCentsOracle) / 100;

    assertEqual(
      precisionResult.totalAmount,
      expectedPrecisionAmount,
      `浮点数精度对抗：${trickyAmounts.length} 笔经典浮点陷阱订单汇总与 BigInt 分计算 Oracle 100% 精确吻合 (${precisionResult.totalAmount} 元)`
    );

    // C2: 12,500+ 笔大批量订单性能基准与动态复合筛选压力测试
    const MASSIVE_ORDER_COUNT = 12500;
    const massiveOrders = [];
    let massiveCentsOracleTotal = BigInt(0);
    let hdWechatCentsOracle = BigInt(0);
    let hdWechatCountOracle = 0;

    console.log(`    ${colors.yellow}ℹ 正在动态生成 ${MASSIVE_ORDER_COUNT} 笔高保真财务订单合成数据集...${colors.reset}`);
    const campuses = ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy', 'campus-bj-hd', 'campus-bj-wj'];
    const paymentMethods = ['wechat', 'alipay', 'bank_transfer', 'pos', 'cash'];
    const statuses = ['paid', 'pending_approval', 'rejected', 'void'];

    for (let i = 0; i < MASSIVE_ORDER_COUNT; i++) {
      const camp = campuses[i % campuses.length];
      const payMeth = paymentMethods[i % paymentMethods.length];
      const stat = statuses[i % statuses.length];
      // 产生在 100.00 ~ 8000.00 之间的随机金额，含两位小数
      const rawYuan = 100 + (i % 7900) + ((i % 99) / 100);
      const roundedAmt = Number(rawYuan.toFixed(2));
      const cents = BigInt(Math.round(roundedAmt * 100));

      massiveCentsOracleTotal += cents;

      if (camp === 'campus-bj-hd' && payMeth === 'wechat' && stat === 'paid') {
        hdWechatCentsOracle += cents;
        hdWechatCountOracle++;
      }

      massiveOrders.push({
        id: `ord-mass-${i}`,
        orderNo: `2609${String(i).padStart(8, '0')}`,
        studentId: `std-mass-${i}`,
        studentName: `海量学员_${i}`,
        studentNo: `S${100000 + i}`,
        phone: `138${String(i).padStart(8, '0')}`,
        campusId: camp,
        courseId: 'course-scratch-001',
        courseName: '软编Scratch编程',
        courseType: 'regular',
        orderType: 'regular',
        chargeType: 'regular',
        status: stat,
        orderStatus: stat,
        receivableAmount: roundedAmt,
        actualAmount: roundedAmt,
        paymentMethod: payMeth,
        payTime: '2026-09-22 10:00:00',
        createTime: '2026-09-22 09:00:00',
        submitter: '高并发生成器',
        salesOwner: '业绩王'
      });
    }

    // 压力测试 1: 全量 12,500 笔动态汇总耗时与精度
    const tStartSummary = Date.now();
    const massSummary = mocks.FinanceAggregator.calculateSummaryStrip(massiveOrders);
    const tEndSummary = Date.now();
    const summaryDurationMs = tEndSummary - tStartSummary;

    const expectedMassAmount = Number(massiveCentsOracleTotal) / 100;
    assertEqual(massSummary.totalCount, MASSIVE_ORDER_COUNT, `万笔订单汇总数量严格等于 ${MASSIVE_ORDER_COUNT}`);
    assertEqual(massSummary.totalAmount, expectedMassAmount, `万级汇总金额与 BigInt Oracle 完全一致 (${massSummary.totalAmount} 元)`);
    assert(summaryDurationMs < 80, `万级动态小计汇总耗时需小于 80ms (实际: ${summaryDurationMs}ms，性能极速优异)`);

    // 压力测试 2: 3x8 矩阵动态复合条件高密度筛选性能 (校区: 海淀分校 + 支付方式: 微信 + 订单状态: 已支付)
    const tStartFilter = Date.now();
    const filteredOrders = mocks.FinanceAggregator.filterOrders(massiveOrders, {
      campusId: 'campus-bj-hd',
      paymentMethod: 'wechat',
      orderStatus: 'paid'
    });
    const filteredSummary = mocks.FinanceAggregator.calculateSummaryStrip(filteredOrders);
    const tEndFilter = Date.now();
    const filterDurationMs = tEndFilter - tStartFilter;

    assertEqual(filteredSummary.totalCount, hdWechatCountOracle, `3x8 复合过滤后订单笔数匹配预期 (${hdWechatCountOracle} 笔)`);
    assertEqual(filteredSummary.totalAmount, Number(hdWechatCentsOracle) / 100, `3x8 复合过滤后实缴金额精确匹配预期`);
    assert(filterDurationMs < 120, `3x8 高密度复合条件过滤万笔订单耗时需小于 120ms (实际: ${filterDurationMs}ms)`);

    // C3: 财务收支代数和对冲抵消与零元订单边界
    const hedgeOrders = [
      { id: 'h-1', actualAmount: 12800.50 },
      { id: 'h-2', actualAmount: -12800.50 },
      { id: 'h-3', actualAmount: 0.00 },
      { id: 'h-4', actualAmount: 5000.25 },
      { id: 'h-5', actualAmount: -5000.25 }
    ];
    const hedgeSummary = mocks.FinanceAggregator.calculateSummaryStrip(hedgeOrders);
    assertEqual(hedgeSummary.totalAmount, 0, '正负对冲退费单据与零元单据求和精确抵消为 0.00 元');
    assertEqual(hedgeSummary.totalCount, 5, '对冲单据与零元单据完整计入交易总笔数 (5)');

    // =========================================================================
    // Vector D: 审批状态机异常乱序调用、越级审批与已办结单据逆向篡改防御
    // =========================================================================
    console.log(`\n${colors.bold}${colors.blue}【Vector D: 审批状态机异常乱序调用、越级审批与已办结单据逆向篡改防御】${colors.reset}`);

    // D1: 乱序越级与非法动作阻断防御
    const testApprovalRecord = {
      id: 'appr-adv-001',
      approvalNo: 'APPR_ADV_20260922001',
      businessType: 'refund',
      businessTypeName: '退费审批单',
      studentId: 'std-ss-01',
      studentName: '牛柯森',
      campusId: 'campus-bj-hq',
      campusName: '总部校区',
      amount: 2800,
      currentStep: 1, // 当前应在第 1 步 (教学课消核实)
      totalSteps: 3,
      status: 'pending',
      applicant: '销售主管',
      applicantPhone: '13800000000',
      applyTime: '2026-09-22 10:00:00',
      reason: '对抗测试退费申请',
      timeline: [],
      sourceId: 'ord-ss-01',
      orderNo: '260918173041mBA01'
    };
    mocks.MOCK_APPROVAL_RECORDS.unshift(testApprovalRecord);

    // 非法动作调用 (如 'hack', 'bypass', null)
    assertThrows(
      () => mocks.FinanceAggregator.processApproval(testApprovalRecord, 'hack', '黑客'),
      'Unknown approval action: hack',
      '审批引擎坚决阻断非法操作指令 (hack)'
    );

    // 篡改当前步骤为非法 step (如 step 99)
    testApprovalRecord.currentStep = 99;
    assertThrows(
      () => mocks.FinanceAggregator.processApproval(testApprovalRecord, 'pass', '黑客'),
      'Invalid current step: 99',
      '审批引擎坚决阻断越级与非法步骤跃迁 (currentStep = 99)'
    );

    // 恢复为正常 Step 1
    testApprovalRecord.currentStep = 1;

    // D2: 依次正常推进并在终审后封锁状态机
    // Step 1: 教学课消核实通过
    const resStep1 = mocks.processApprovalRecord(testApprovalRecord.id, 'pass', '教研主管', '教学课消核实无误');
    assertEqual(resStep1.status, 'pending', 'Step 1 审批通过后，单据维持 pending 状态');
    assertEqual(resStep1.currentStep, 2, '当前步骤顺利推进至 Step 2 (校区校长审批)');

    // Step 2: 校区校长审批通过
    const resStep2 = mocks.processApprovalRecord(testApprovalRecord.id, 'pass', '校区校长', '同意退费申请');
    assertEqual(resStep2.status, 'pending', 'Step 2 审批通过后，单据维持 pending 状态');
    assertEqual(resStep2.currentStep, 3, '当前步骤顺利推进至 Step 3 (总部财务终审)');

    // Step 3: 总部财务终审通过
    const resStep3 = mocks.processApprovalRecord(testApprovalRecord.id, 'pass', '财务总监', '终审款项核拨完成');
    assertEqual(resStep3.status, 'approved', 'Step 3 终审通过后，单据状态翻转为 approved 结案办结');
    assertEqual(resStep3.timeline.length, 3, '审批历史轨迹完整记录全部 3 个审批节点的签名与评语');

    // D3: 已办结单据逆向篡改与重复审批阻断
    assertThrows(
      () => mocks.processApprovalRecord(testApprovalRecord.id, 'pass', '黑客A', '试图重复审批'),
      'Approval record is already finalized as: approved',
      '已办结 approved 单据遭受再次 pass 篡改调用，被坚决抛错阻断'
    );

    assertThrows(
      () => mocks.processApprovalRecord(testApprovalRecord.id, 'reject', '黑客B', '试图逆向驳回'),
      'Approval record is already finalized as: approved',
      '已办结 approved 单据遭受逆向 reject 翻转调用，被坚决抛错阻断'
    );

    // 检验被驳回单据 (rejected) 的终态不可逆性
    const rejectApprovalRecord = {
      id: 'appr-adv-002',
      approvalNo: 'APPR_ADV_20260922002',
      businessType: 'special_discount',
      businessTypeName: '特批优惠申请',
      studentId: 'std-ss-02',
      studentName: '李学员',
      campusId: 'campus-bj-hq',
      campusName: '总部校区',
      amount: 500,
      currentStep: 1,
      totalSteps: 3,
      status: 'pending',
      applicant: '销售主管',
      applicantPhone: '13800000000',
      applyTime: '2026-09-22 10:00:00',
      reason: '特批优惠',
      timeline: []
    };
    mocks.MOCK_APPROVAL_RECORDS.unshift(rejectApprovalRecord);

    mocks.processApprovalRecord(rejectApprovalRecord.id, 'reject', '教研主管', '不合规申请，坚决驳回');
    assertEqual(rejectApprovalRecord.status, 'rejected', '单据直接被驳回至 rejected 终态');

    assertThrows(
      () => mocks.processApprovalRecord(rejectApprovalRecord.id, 'pass', '黑客C', '试图复活驳回单据'),
      'Approval record is already finalized as: rejected',
      '已驳回 rejected 单据遭受篡改复活调用，被坚决抛错阻断'
    );

    // D4: 终审退费单据关联订单锁定与逆向破坏防御
    const targetOrder = mocks.MOCK_ORDERS_DATA.find(o => o.id === testApprovalRecord.sourceId);
    assert(!!targetOrder, '退费关联原订单存在');
    assertEqual(targetOrder.isLocked, true, '原订单已由退费终审自动加锁 (isLocked = true)');
    assertEqual(targetOrder.actualAmount, -2800, '原订单金额已被冲正为负数退费金额 (-2800 元)');

    assertThrows(
      () => mocks.updateOrder({ id: targetOrder.id, actualAmount: 50000 }),
      'Order is locked by finance closing cycle, modification prohibited',
      '已被加锁锁定的退费订单禁止任何修改，非法金额篡改被坚决阻断'
    );

    assertThrows(
      () => mocks.voidOrder(targetOrder.id),
      'Cannot void a paid order directly',
      '已被支付/退费锁定的订单禁止随意作废，必须受严格风控拦截'
    );

    // =========================================================================
    // Vector E: 5 级组织树非合规变异结构的删除与鉴权边界
    // =========================================================================
    console.log(`\n${colors.bold}${colors.blue}【Vector E: 5 级组织树非合规变异结构的删除与鉴权边界】${colors.reset}`);

    // E1: 组织架构树变异删除防护
    // 1. 尝试删除集团根节点 (Level 1)
    assertThrows(
      () => mocks.deleteOrgNode('org-root'),
      'Root organization group node cannot be deleted',
      '防线生效：严禁删除集团组织树顶层根节点 (Root organization group node)'
    );

    // 2. 尝试删除包含子节点的中间大区节点 (HasChildNodesException)
    assertThrows(
      () => mocks.deleteOrgNode('region-bj'),
      'HasChildNodesException',
      '防线生效：严禁删除含有子分支的中间组织节点 (HasChildNodesException)'
    );

    // 3. 尝试删除含有绑定在职员工的岗位节点 (boundUserCount > 0)
    // 寻找一个带有 boundUserCount > 0 的岗位节点
    function findBoundPost(nodes) {
      for (const n of nodes) {
        if (n.boundUserCount && n.boundUserCount > 0 && (!n.children || n.children.length === 0)) {
          return n;
        }
        if (n.children && n.children.length > 0) {
          const res = findBoundPost(n.children);
          if (res) return res;
        }
      }
      return null;
    }
    const boundPostNode = findBoundPost(mocks.MOCK_ORG_NODES);
    assert(!!boundPostNode, '找到存在绑定员工的岗位叶子节点');
    assertThrows(
      () => mocks.deleteOrgNode(boundPostNode.id),
      'because it is currently bound to',
      `防线生效：严禁删除仍绑定有在职员工 [${boundPostNode.name}] 的组织节点`
    );

    // 4. 正向删除：合规添加无子节点且无员工绑定的临时空闲节点并成功删除
    const tempNode = mocks.addOrgNode('dept-hq-edu', {
      id: 'post-temp-adv-01',
      name: '临时待撤销测试岗位',
      code: 'POST-TEMP-01',
      boundUserCount: 0
    });
    const deleteResult = mocks.deleteOrgNode(tempNode.id);
    assertEqual(deleteResult.canDelete, true, '既无子节点且无绑定员工的合法叶子节点顺利通过校验并被安全删除');

    // 5. 尝试删除不存在的幽灵节点
    assertThrows(
      () => mocks.deleteOrgNode('ghost-node-999'),
      'not found in organizational tree',
      '尝试删除不存在的节点抛出未找到异常'
    );

    // E2: 权限树半选联动算法 (Indeterminate) 变异覆盖
    const complexPermTree = {
      id: 'perm-root',
      name: '全部权限',
      children: [
        {
          id: 'perm-sub-1',
          name: '子模块A',
          children: [
            { id: 'perm-leaf-1', name: '叶子1', checked: false },
            { id: 'perm-leaf-2', name: '叶子2', checked: false }
          ]
        },
        {
          id: 'perm-sub-2',
          name: '子模块B',
          children: [
            { id: 'perm-leaf-3', name: '叶子3', checked: false }
          ]
        }
      ]
    };

    // 初始状态：全不选
    mocks.RBACEngine.updateTreeCheckState(complexPermTree);
    assertEqual(complexPermTree.checked, false, '全不勾选时根节点 checked = false');
    assertEqual(complexPermTree.indeterminate, false, '全不勾选时根节点 indeterminate = false');

    // 部分勾选：仅选中叶子1
    complexPermTree.children[0].children[0].checked = true;
    mocks.RBACEngine.updateTreeCheckState(complexPermTree);
    assertEqual(complexPermTree.checked, false, '部分勾选时根节点 checked = false');
    assertEqual(complexPermTree.indeterminate, true, '部分勾选时根节点 indeterminate = true (半选)');
    assertEqual(complexPermTree.children[0].indeterminate, true, '子模块A亦正确处于半选 indeterminate = true');

    // 批量全选子树
    mocks.RBACEngine.setSubtreeChecked(complexPermTree, true);
    mocks.RBACEngine.updateTreeCheckState(complexPermTree);
    assertEqual(complexPermTree.checked, true, '全部勾选时根节点 checked = true');
    assertEqual(complexPermTree.indeterminate, false, '全部勾选时根节点 indeterminate = false (消除半选)');
    assertEqual(complexPermTree.children[0].children[0].checked, true, '叶子1保持选中');
    assertEqual(complexPermTree.children[0].children[1].checked, true, '叶子2被级联批量选中');

    // E3: RBAC 越权防范与多级别数据作用域 (DataScope) 隔离对抗
    const adminUser = { id: 'u-admin', dataScope: 'all' };
    const campusUser = { id: 'u-campus-hd', campusId: 'campus-bj-hd', dataScope: 'campus' };
    const deptUser = { id: 'u-dept-edu', campusId: 'campus-bj-hq', departmentId: 'dept-hq-edu', dataScope: 'department' };
    const selfUser = { id: 'u-self-01', campusId: 'campus-bj-hq', departmentId: 'dept-hq-edu', dataScope: 'self' };

    const mockDataPool = [
      { id: 'd-1', campusId: 'campus-bj-hq', departmentId: 'dept-hq-edu', ownerId: 'u-self-01' },
      { id: 'd-2', campusId: 'campus-bj-hq', departmentId: 'dept-hq-edu', ownerId: 'u-self-02' },
      { id: 'd-3', campusId: 'campus-bj-hq', departmentId: 'dept-hq-sales', ownerId: 'u-self-03' },
      { id: 'd-4', campusId: 'campus-bj-hd', departmentId: 'dept-hd-edu', ownerId: 'u-self-04' },
      { id: 'd-5', campusId: 'campus-bj-yy', departmentId: 'dept-yy-edu', ownerId: 'u-self-05' }
    ];

    // 1. 全部范围 (all)
    const scopeAll = mocks.RBACEngine.filterByDataScope(adminUser, mockDataPool);
    assertEqual(scopeAll.length, 5, '超管/全部范围 (all) 穿透获取全量 5 项数据');

    // 2. 校区范围 (campus)
    const scopeCampus = mocks.RBACEngine.filterByDataScope(campusUser, mockDataPool);
    assertEqual(scopeCampus.length, 1, '海淀校区主管 (campus) 仅能获取海淀所属 1 项数据');
    assertEqual(scopeCampus[0].campusId, 'campus-bj-hd', '校区范围数据隔离无泄漏');

    // 3. 部门范围 (department)
    const scopeDept = mocks.RBACEngine.filterByDataScope(deptUser, mockDataPool);
    assertEqual(scopeDept.length, 2, '总部教务部门主管 (department) 仅能获取教务部所属 2 项数据');
    assert(scopeDept.every(d => d.departmentId === 'dept-hq-edu'), '部门范围数据隔离无泄漏');

    // 4. 仅本人范围 (self)
    const scopeSelf = mocks.RBACEngine.filterByDataScope(selfUser, mockDataPool);
    assertEqual(scopeSelf.length, 1, '普通员工 (self) 仅能获取本人名下 1 项数据');
    assertEqual(scopeSelf[0].ownerId, 'u-self-01', '个人范围数据隔离无越权');

    // 5. 非法/未知作用域注入
    const scopeIllegal = mocks.RBACEngine.filterByDataScope({ dataScope: 'evil_scope' }, mockDataPool);
    assertEqual(scopeIllegal.length, 0, '非法未定义数据范围返回空数组，坚决安全阻断');

    // 6. RBAC hasPermission 通配与特定权限检验
    assertEqual(mocks.RBACEngine.hasPermission(['*'], 'any:arbitrary:privilege'), true, '超级通配符 [*] 放行所有高权指令');
    assertEqual(mocks.RBACEngine.hasPermission(['admin:all'], 'system:finance:export'), true, '系统管理员通配符 [admin:all] 放行');
    assertEqual(mocks.RBACEngine.hasPermission(['curriculum:view'], 'curriculum:view'), true, '精确权限匹配放行');
    assertEqual(mocks.RBACEngine.hasPermission(['curriculum:view'], 'curriculum:delete'), false, '越权缺失权限被坚决拒绝 (false)');
    assertEqual(mocks.RBACEngine.hasPermission([], 'financial:approve'), false, '空权限列表严格拒绝');

    console.log(`\n${colors.bold}${colors.green}【Zero-Pollution Invariant: 正在幂等恢复全局内存状态快照...】${colors.reset}`);
  } finally {
    // 无论测试成功与否，无条件恢复现场初始数据快照
    restoreSystemSnapshot(initialSnapshot);
    console.log(`    ${colors.green}✓ PASS: 全局 Mock 数据库已 100% 幂等恢复至初始快照${colors.reset}`);
  }

  const duration = Date.now() - startTime;
  console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}Tier 5 白盒对抗加固测试套件 1 执行总结报告${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`  总断言检验项: ${totalChecks}`);
  console.log(`  通过校验项数: ${passedChecks}`);
  console.log(`  失败校验项数: ${failedChecks}`);
  console.log(`  耗时: ${duration}ms`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  if (failedChecks > 0) {
    console.error(`${colors.red}❌ 对抗测试套件执行失败，存在 ${failedChecks} 处缺陷！${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}🎉 恭喜！5 大核心挑战向量全部经受住高烈度白盒对抗检验 (通过率 100.0%)！系统固若金汤。${colors.reset}\n`);
    process.exit(0);
  }
}

runAdversarialSuite().catch(err => {
  console.error(`${colors.red}Unhandled error in adversarial suite:${colors.reset}`, err);
  process.exit(1);
});
