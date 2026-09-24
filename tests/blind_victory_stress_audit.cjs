#!/usr/bin/env node
/**
 * 拓视未来教育「一校教培系统」终局胜利法证独立盲测穿透套件
 * tests/blind_victory_stress_audit.cjs
 * 
 * 由 independent Victory Auditor (victory_auditor_2) 独立编写执行
 * 杜绝任何既有测试套件依赖，直击 5 大核心模块的中台底层逻辑与数学不变量
 */

const path = require('node:path');
const assert = require('node:assert');
const createJiti = require('jiti');

const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const CollisionContract = require('./contracts/collisionEngine');
const StudentContract = require('./contracts/studentStateMachine');
const FinanceContract = require('./contracts/financeAggregator');
const RBACContract = require('./contracts/rbacEngine');
const TenantContract = require('./contracts/tenantContext');

const { EducationalCollisionEngine } = jiti('../src/mocks/educational.ts');
const { FinanceAggregator, isCampusMatch } = jiti('../src/mocks/financial.ts');
const { RBACEngine } = jiti('../src/mocks/system.ts');
const { getCoursesByCampus, MOCK_COURSES } = jiti('../src/mocks/index.ts');
const studentMock = jiti('../src/mocks/student.ts');
const educationalMock = jiti('../src/mocks/educational.ts');
const financialMock = jiti('../src/mocks/financial.ts');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function check(desc, fn) {
  totalChecks++;
  try {
    fn();
    passedChecks++;
    console.log(`  [BLIND-PASS] ${desc}`);
  } catch (err) {
    failedChecks++;
    failures.push({ desc, error: err });
    console.error(`  [BLIND-FAIL] ${desc}: ${err.message}`);
  }
}

console.log('================================================================================');
console.log('开始独立胜利法证盲测穿透 (Independent Victory Audit Stress Test)');
console.log('================================================================================\n');

// -------------------------------------------------------------
// DIMENSION 1: 财务金额浮点数精度截断与 3x8 矩阵对抗
// -------------------------------------------------------------
console.log('【维度 1: 财务整数分运算、精度防漂移与审批流对抗】');

check('DIM1-01: 累加典型 IEEE-754 漂移浮点金额 (0.10, 0.20, 0.07)，验证分计算绝对精确', () => {
  const testOrders = [
    { id: '1', actualAmount: 0.10 },
    { id: '2', actualAmount: 0.20 },
    { id: '3', actualAmount: 0.07 },
    { id: '4', actualAmount: 19.99 },
    { id: '5', actualAmount: 100.01 }
  ];
  const summarySrc = FinanceAggregator.calculateSummaryStrip(testOrders);
  const summaryContract = FinanceContract.calculateSummaryStrip(testOrders);
  
  // 0.1 + 0.2 + 0.07 + 19.99 + 100.01 = 120.37
  assert.strictEqual(summarySrc.totalAmount, 120.37, 'Src mock 必须精确等于 120.37');
  assert.strictEqual(summaryContract.totalAmount, 120.37, 'Contract 必须精确等于 120.37');
  assert.strictEqual(summarySrc.formattedAmount, '120.37');
});

check('DIM1-02: 10,000 笔带奇数分订单高频累加，验证无累计截断误差', () => {
  const massiveOrders = Array.from({ length: 10000 }, (_, i) => ({
    id: `ord-${i}`,
    actualAmount: 19.99
  }));
  const res = FinanceAggregator.calculateSummaryStrip(massiveOrders);
  // 10000 * 19.99 = 199,900.00
  assert.strictEqual(res.totalAmount, 199900.00);
  assert.strictEqual(res.totalCount, 10000);
});

check('DIM1-03: 3x8 筛选矩阵重置必须严格恢复 24 个默认字段与当月第一天及末日', () => {
  const form = FinanceAggregator.getDefaultFilterForm();
  const keys = Object.keys(form);
  assert.strictEqual(keys.length, 24, `字段数必须严格为 24，当前为 ${keys.length}`);
  
  const resetForm = FinanceAggregator.resetFilterForm('campus-bj-hd');
  assert.strictEqual(resetForm.campusId, 'campus-bj-hd');
  assert.strictEqual(resetForm.page, 1);
  assert.strictEqual(resetForm.pageSize, 20);
});

check('DIM1-04: 审批流终态保护：对已审批或已驳回单据再次审批必须抛出异常', () => {
  const record = {
    id: 'app-001',
    businessType: 'refund',
    status: 'approved',
    currentStep: 3,
    timeline: []
  };
  assert.throws(() => {
    FinanceAggregator.processApproval(record, 'pass', '张三');
  }, /already finalized/i);

  const rejectedRecord = {
    id: 'app-002',
    businessType: 'payment',
    status: 'rejected',
    currentStep: 1,
    timeline: []
  };
  assert.throws(() => {
    FinanceAggregator.processApproval(rejectedRecord, 'reject', '李四');
  }, /already finalized/i);
});

check('DIM1-05: 审批流非法动作（如 delete/revoke）拦截', () => {
  const record = {
    id: 'app-003',
    businessType: 'payment',
    status: 'pending',
    currentStep: 1,
    timeline: []
  };
  assert.throws(() => {
    FinanceAggregator.processApproval(record, 'invalid_action', '王五');
  }, /Unknown approval action/i);
});

// -------------------------------------------------------------
// DIMENSION 2: 教务排课时间网格与三维防撞引擎极端对抗
// -------------------------------------------------------------
console.log('\n【维度 2: 教务排课 07:00-22:00 时间网格与三维冲突引擎对抗】');

check('DIM2-01: 倒流时段 (endTime <= startTime) 校验阻断', () => {
  assert.throws(() => {
    EducationalCollisionEngine.isOverlapping('10:00', '09:00', '09:30', '10:30');
  }, /End time must be strictly after start time/i);

  const res = EducationalCollisionEngine.validateScheduleTimeWindow('15:00', '15:00');
  assert.strictEqual(res.valid, false);
});

check('DIM2-02: 临界相接不冲突 [09:00, 10:00) 与 [10:00, 11:00) 判定为 false', () => {
  const overlap = EducationalCollisionEngine.isOverlapping('09:00', '10:00', '10:00', '11:00');
  assert.strictEqual(overlap, false, '首尾相接不应判定为冲突');
});

check('DIM2-03: 1分钟微小重叠 [09:00, 10:00) 与 [09:59, 10:30) 判定为 true 冲突', () => {
  const overlap = EducationalCollisionEngine.isOverlapping('09:00', '10:00', '09:59', '10:30');
  assert.strictEqual(overlap, true, '1分钟重叠必须识别为冲突');
});

check('DIM2-04: 视口越界拦截 (早于 07:00 或 晚于 22:00 或 跨午夜)', () => {
  const tooEarly = EducationalCollisionEngine.validateScheduleTimeWindow('06:59', '08:00');
  assert.strictEqual(tooEarly.valid, false);

  const tooLate = EducationalCollisionEngine.validateScheduleTimeWindow('21:00', '22:01');
  assert.strictEqual(tooLate.valid, false);

  const crossMidnight = EducationalCollisionEngine.validateScheduleTimeWindow('21:30', '23:30');
  assert.strictEqual(crossMidnight.valid, false);
});

check('DIM2-05: 教室物理容量超载 (Classroom Capacity Exceeded) 冲突检测', () => {
  const classrooms = [
    { id: 'room-vip', name: 'VIP室', capacity: 2 }
  ];
  const target = {
    date: '2026-09-21',
    startTime: '10:00',
    endTime: '11:00',
    classroomId: 'room-vip',
    studentIds: ['s1', 's2', 's3'] // 3人超限
  };
  const res = EducationalCollisionEngine.detectCollision(target, [], classrooms);
  assert.strictEqual(res.hasConflict, true);
  assert.strictEqual(res.conflictType, 'CLASSROOM_CAPACITY_EXCEEDED');
});

check('DIM2-06: 讲师冲突、教室冲突、学员冲突同时爆发时的三维聚合报告', () => {
  const existing = [{
    id: 'evt-exist',
    date: '2026-09-21',
    startTime: '14:00',
    endTime: '15:30',
    teacherId: 't-001',
    classroomId: 'room-101',
    studentIds: ['std-001', 'std-002']
  }];
  const target = {
    date: '2026-09-21',
    startTime: '14:30',
    endTime: '16:00',
    teacherId: 't-001',
    classroomId: 'room-101',
    studentIds: ['std-002', 'std-003']
  };
  const res = EducationalCollisionEngine.detectCollision(target, existing);
  assert.strictEqual(res.hasConflict, true);
  assert.strictEqual(res.teacherConflict, true);
  assert.strictEqual(res.classroomConflict, true);
  assert.deepStrictEqual(res.studentConflicts, ['std-002']);
  assert.strictEqual(res.conflicts.length, 3);
});

// -------------------------------------------------------------
// DIMENSION 3: 学员 7 分支异常状态机与复杂退费公式对抗
// -------------------------------------------------------------
console.log('\n【维度 3: 学员 7 分支异常状态机与多退少补公式对抗】');

check('DIM3-01: 停课学员禁止转班，已结业学员禁止停课', () => {
  const student = {
    id: 's-test',
    status: 'suspended',
    coursePackages: [{ packageId: 'pkg-1', status: 'frozen', remainingLessons: 10, totalLessons: 20 }],
    wallet: { principalBalance: 100, bonusBalance: 0 }
  };
  const sm = new StudentContract(student);
  assert.throws(() => {
    sm.transferClass('pkg-1', 'cls-a', 'cls-b', 20, 10);
  }, /Cannot transfer class while student is suspended/i);

  student.status = 'dropped_out';
  const sm2 = new StudentContract(student);
  assert.throws(() => {
    sm2.suspend(30);
  }, /Cannot suspend dropped out student/i);
});

check('DIM3-02: 目标班级满班上限阻断 (currentCount >= capacity)', () => {
  const student = {
    id: 's-test',
    status: 'normal',
    coursePackages: [{ packageId: 'pkg-1', status: 'active', remainingLessons: 10, totalLessons: 20 }],
    wallet: { principalBalance: 100, bonusBalance: 0 }
  };
  const sm = new StudentContract(student);
  assert.throws(() => {
    sm.transferClass('pkg-1', 'cls-a', 'cls-b', 16, 16); // 16/16 满班
  }, /capacity exceeded/i);
});

check('DIM3-03: 换课差额精确计算：低价换高价补缴，高价换低价退入钱包本金', () => {
  const student = {
    id: 's-test',
    status: 'normal',
    coursePackages: [{ packageId: 'pkg-1', status: 'active', remainingLessons: 10, pricePerLesson: 300, totalLessons: 20 }],
    wallet: { principalBalance: 0, bonusBalance: 0 }
  };
  const sm = new StudentContract(student);
  // 原课剩余价值: 10 * 300 = 3000
  // 拟购新课: 10 课时 * 200 = 2000
  // 差额: +1000 -> 进钱包本金
  const res = sm.changeCourse('pkg-1', { id: 'c-new', name: '新课', pricePerLesson: 200 }, 10);
  assert.strictEqual(res.diff, 1000);
  assert.strictEqual(res.walletCredited, 1000);
  assert.strictEqual(sm.getStudent().wallet.principalBalance, 1000);
  assert.strictEqual(sm.getStudent().coursePackages[0].status, 'completed');
  assert.strictEqual(sm.getStudent().coursePackages[1].status, 'active');
});

check('DIM3-04: 盛通退费赠课追回与折现防腐公式校验', () => {
  // 场景 A: 购买20正课，赠送5课时(总25)，单价200。已上3课时(剩余22课时)。
  // 正课还剩 22 - 5 = 17 课时。赠课不折现！
  // 退费 = 17 * 200 = 3400 元。扣手续费 100 -> 3300 元。
  const studentA = {
    id: 's-refund-a',
    coursePackages: [{
      packageId: 'pkg-a',
      totalLessons: 25,
      bonusLessons: 5,
      remainingLessons: 22,
      pricePerLesson: 200,
      status: 'active'
    }],
    wallet: { principalBalance: 0, bonusBalance: 0 }
  };
  const smA = new StudentContract(studentA);
  const resA = smA.refund('pkg-a', 100);
  assert.strictEqual(resA.refundAmount, 3300);

  // 场景 B: 购买20正课，赠送5课时(总25)，单价200。已上22课时(剩余3课时)。
  // 已消耗课时 22 > 购买正课 20，超额消耗了 2 节赠课！
  // 按照商业规则，已消费赠课按正课单价补扣: 2 * 200 = 400 元。
  // 剩余正课已为 0，退款 = 0 元。
  const studentB = {
    id: 's-refund-b',
    coursePackages: [{
      packageId: 'pkg-b',
      totalLessons: 25,
      bonusLessons: 5,
      remainingLessons: 3,
      pricePerLesson: 200,
      status: 'active'
    }],
    wallet: { principalBalance: 0, bonusBalance: 0 }
  };
  const smB = new StudentContract(studentB);
  const resB = smB.refund('pkg-b', 0);
  assert.strictEqual(resB.refundAmount, 0);
});

check('DIM3-05: 钱包提现限制：仅允许本金提现，赠送金禁止提现', () => {
  const student = {
    id: 's-wallet',
    wallet: { principalBalance: 500, bonusBalance: 200 }
  };
  const sm = new StudentContract(student);
  assert.throws(() => {
    sm.walletWithdraw(600); // 试图提取多于本金的金额
  }, /Cannot withdraw more than principal balance/i);

  const res = sm.walletWithdraw(300);
  assert.strictEqual(res.remainingPrincipal, 200);
  assert.strictEqual(sm.getStudent().wallet.bonusBalance, 200);
});

// -------------------------------------------------------------
// DIMENSION 4: 组织架构树级联完整性与 RBAC 4 级权限矩阵
// -------------------------------------------------------------
console.log('\n【维度 4: 5 级组织树级联约束与 RBAC 半选联动】');

check('DIM4-01: 组织根节点禁止删除', () => {
  const tree = [
    { id: 'org-root', name: '盛通集团', level: 1, type: 'group', children: [] }
  ];
  assert.throws(() => {
    RBACEngine.validateNodeDeletion(tree, 'org-root');
  }, /Root organization group node cannot be deleted/i);
});

check('DIM4-02: 包含下级子节点的部门禁止删除 (HasChildNodesException)', () => {
  const tree = [
    {
      id: 'campus-1',
      name: '海淀校区',
      level: 3,
      type: 'campus',
      children: [
        { id: 'dept-1', name: '教学部', level: 4, type: 'dept', children: [] }
      ]
    }
  ];
  assert.throws(() => {
    RBACEngine.validateNodeDeletion(tree, 'campus-1');
  }, /HasChildNodesException/i);
});

check('DIM4-03: 关联活跃在职员工的岗位禁止删除', () => {
  const tree = [
    { id: 'post-1', name: '高级讲师岗', level: 5, type: 'post', boundUserCount: 5, children: [] }
  ];
  assert.throws(() => {
    RBACEngine.validateNodeDeletion(tree, 'post-1');
  }, /currently bound to 5 active employees/i);
});

check('DIM4-04: 无子节点且无员工绑定的叶子节点允许合规删除', () => {
  const tree = [
    { id: 'post-empty', name: '临时测试岗', level: 5, type: 'post', boundUserCount: 0, children: [] }
  ];
  const res = RBACEngine.validateNodeDeletion(tree, 'post-empty');
  assert.strictEqual(res.canDelete, true);
});

check('DIM4-05: RBAC 4 级权限树半选联动 (Indeterminate) 状态递归计算', () => {
  // 构造 3 层权限树：Module -> Page -> Button1, Button2
  const rootNode = {
    id: 'm-edu',
    name: '教务模块',
    children: [
      {
        id: 'p-schedule',
        name: '排课看板',
        children: [
          { id: 'b-add', name: '新增排课', checked: true },
          { id: 'b-del', name: '删除排课', checked: false }
        ]
      }
    ]
  };

  RBACEngine.updateTreeCheckState(rootNode);
  const pageNode = rootNode.children[0];

  assert.strictEqual(pageNode.checked, false, '子按钮部分选中，页面节点不应全选');
  assert.strictEqual(pageNode.indeterminate, true, '子按钮部分选中，页面节点必须为 indeterminate');
  assert.strictEqual(rootNode.checked, false, '模块节点不应全选');
  assert.strictEqual(rootNode.indeterminate, true, '模块节点必须为 indeterminate');

  // 将 Button2 也勾选 -> 触发全选
  pageNode.children[1].checked = true;
  RBACEngine.updateTreeCheckState(rootNode);
  assert.strictEqual(pageNode.checked, true, '全部子按钮勾选，页面节点必须全选');
  assert.strictEqual(pageNode.indeterminate, false);
  assert.strictEqual(rootNode.checked, true, '全部子节点勾选，模块节点必须全选');
  assert.strictEqual(rootNode.indeterminate, false);
});

// -------------------------------------------------------------
// DIMENSION 5: 多校区上下文数据流隔离与零污染核查
// -------------------------------------------------------------
console.log('\n【维度 5: 多校区物理上下文隔离与数据渗透防御】');

check('DIM5-01: 校区 ID 规范映射与别名互认', () => {
  assert.strictEqual(isCampusMatch('campus-bj-hq', 'CAMPUS_HQ'), true);
  assert.strictEqual(isCampusMatch('campus-bj-yy', 'YY002'), true);
  assert.strictEqual(isCampusMatch('campus-bj-cy', 'campus-bj-cy'), true);
  assert.strictEqual(isCampusMatch('campus-bj-hd', 'campus-bj-yy'), false);
});

check('DIM5-02: 跨校区数据无缝过滤，未授权校区课程不向分校区暴露', () => {
  const allCourses = MOCK_COURSES;
  const yyCourses = getCoursesByCampus('campus-bj-yy');
  
  for (const c of yyCourses) {
    assert.strictEqual(c.authorizedCampusIds.includes('campus-bj-yy'), true, `课程 ${c.name} 必须包含远洋校区授权`);
  }
  
  // 验证总课程数 >= 分校区课程数
  assert.ok(allCourses.length >= yyCourses.length);
});

check('DIM5-03: SQL 注入与特殊字符校区 ID 穿透安全防线', () => {
  const attackInputs = ["' OR '1'='1", '../../etc/passwd', '${7*7}', '\x00null'];
  for (const bad of attackInputs) {
    const students = studentMock.getStudents({ campusId: bad });
    assert.strictEqual(students.length, 0, `注入攻击 [${bad}] 必须返回空列表`);
    
    const orders = financialMock.getOrdersByCampus(bad);
    assert.strictEqual(orders.length, 0, `注入攻击 [${bad}] 订单必须返回空列表`);
  }
});

// -------------------------------------------------------------
// DIMENSION 6: 极端边界不变式与深度防御穿透 (Advanced Invariant Stress)
// -------------------------------------------------------------
console.log('\n【维度 6: 极端边界不变式、算法高压与深度防御】');

check('DIM6-01: Lane 分流自适应算法：5个重叠课次在 maxLanes=4 下安全降级，分配索引在 0~3 之间', () => {
  const overlapping5 = [
    { id: 'e1', date: '2026-09-21', startTime: '09:00', endTime: '11:00' },
    { id: 'e2', date: '2026-09-21', startTime: '09:15', endTime: '10:45' },
    { id: 'e3', date: '2026-09-21', startTime: '09:30', endTime: '11:30' },
    { id: 'e4', date: '2026-09-21', startTime: '09:45', endTime: '11:15' },
    { id: 'e5', date: '2026-09-21', startTime: '10:00', endTime: '11:00' },
  ];
  const allocated = EducationalCollisionEngine.allocateLanes(overlapping5, 4);
  assert.strictEqual(allocated.length, 5);
  for (const item of allocated) {
    assert.ok(item.laneIndex >= 0 && item.laneIndex < 4, `Lane 必须在 0~3 之间，实际为 ${item.laneIndex}`);
    assert.ok(item.totalLanes <= 4, `TotalLanes 最大不超过 4，实际为 ${item.totalLanes}`);
  }
});

check('DIM6-02: 完全无重叠的时段课次应 100% 复用 Lane 0', () => {
  const serialEvents = [
    { id: 's1', date: '2026-09-21', startTime: '08:00', endTime: '09:00' },
    { id: 's2', date: '2026-09-21', startTime: '09:00', endTime: '10:00' },
    { id: 's3', date: '2026-09-21', startTime: '10:00', endTime: '11:00' },
  ];
  const allocated = EducationalCollisionEngine.allocateLanes(serialEvents, 4);
  assert.strictEqual(allocated.length, 3);
  for (const item of allocated) {
    assert.strictEqual(item.laneIndex, 0, `串行课次必须全部复用 Lane 0，实际为 ${item.laneIndex}`);
  }
});

check('DIM6-03: 极端单分钟时段边界：07:00-07:01 与 21:59-22:00 均为合法视口', () => {
  const res1 = EducationalCollisionEngine.validateScheduleTimeWindow('07:00', '07:01');
  assert.strictEqual(res1.valid, true);
  assert.strictEqual(res1.durationMinutes, 1);

  const res2 = EducationalCollisionEngine.validateScheduleTimeWindow('21:59', '22:00');
  assert.strictEqual(res2.valid, true);
  assert.strictEqual(res2.durationMinutes, 1);
});

check('DIM6-04: 学员转让至空白学员 profile 时，安全初始化课包与钱包结构', () => {
  const sourceStudent = {
    id: 's-src',
    coursePackages: [{ packageId: 'pkg-init', status: 'active', remainingLessons: 10, totalLessons: 10 }],
    wallet: { principalBalance: 200, bonusBalance: 50 }
  };
  const targetStudent = {
    id: 's-tgt'
    // 未初始化 coursePackages 和 wallet
  };
  const sm = new StudentContract(sourceStudent);
  const res = sm.transferStudent(targetStudent);
  assert.strictEqual(res.success, true);
  assert.strictEqual(targetStudent.wallet.principalBalance, 200);
  assert.strictEqual(targetStudent.wallet.bonusBalance, 50);
  assert.strictEqual(targetStudent.coursePackages.length, 1);
  assert.strictEqual(sm.getStudent().wallet.principalBalance, 0);
  assert.strictEqual(sm.getStudent().wallet.bonusBalance, 0);
  assert.strictEqual(sm.getStudent().coursePackages[0].remainingLessons, 0);
});

check('DIM6-05: 课包重复退费拦截 (terminal status guard)', () => {
  const student = {
    id: 's-term',
    coursePackages: [{ packageId: 'pkg-term', status: 'refunded', remainingLessons: 0, totalLessons: 10 }],
    wallet: { principalBalance: 0, bonusBalance: 0 }
  };
  const sm = new StudentContract(student);
  assert.throws(() => {
    sm.refund('pkg-term', 0);
  }, /terminal status/i);
});

check('DIM6-06: 换课拟购课时 <= 0 时强制抛错阻断', () => {
  const student = {
    id: 's-change',
    coursePackages: [{ packageId: 'pkg-c', status: 'active', remainingLessons: 5, pricePerLesson: 200, totalLessons: 10 }],
    wallet: { principalBalance: 0, bonusBalance: 0 }
  };
  const sm = new StudentContract(student);
  assert.throws(() => {
    sm.changeCourse('pkg-c', { id: 'c-x', name: '课', pricePerLesson: 200 }, 0);
  }, /greater than 0/i);
});

check('DIM6-07: 跨校区转校时目标校区未在授权列表中强制阻断', () => {
  const student = {
    id: 's-trans',
    campusId: 'campus-bj-hq',
    status: 'normal',
    coursePackages: [],
    wallet: { principalBalance: 0, bonusBalance: 0 }
  };
  const sm = new StudentContract(student);
  assert.throws(() => {
    sm.transferCampus('campus-bj-secret', ['campus-bj-yy', 'campus-bj-cy']);
  }, /Unauthorized cross-campus transfer/i);
});

check('DIM6-08: 跨校区转校时目标校区与当前校区相同抛出异常', () => {
  const student = {
    id: 's-trans-same',
    campusId: 'campus-bj-hq',
    status: 'normal',
    coursePackages: [],
    wallet: { principalBalance: 0, bonusBalance: 0 }
  };
  const sm = new StudentContract(student);
  assert.throws(() => {
    sm.transferCampus('campus-bj-hq', ['campus-bj-hq', 'campus-bj-yy']);
  }, /cannot be identical/i);
});

check('DIM6-09: 财务筛选矩阵逗号分隔多班级匹配', () => {
  const orders = [
    { id: 'o1', classId: 'cls-101', actualAmount: 100 },
    { id: 'o2', classId: 'cls-102', actualAmount: 200 },
    { id: 'o3', classId: 'cls-103', actualAmount: 300 }
  ];
  const filtered = FinanceAggregator.filterOrders(orders, { classId: 'cls-101,cls-103' });
  assert.strictEqual(filtered.length, 2);
  assert.deepStrictEqual(filtered.map(o => o.id), ['o1', 'o3']);
});

check('DIM6-10: 财务筛选矩阵金额输入防呆容错 (minAmount > maxAmount 时自动纠正为有效区间)', () => {
  const orders = [
    { id: 'o1', actualAmount: 50 },  // 低于 200
    { id: 'o2', actualAmount: 500 }, // 处于 200~1000
    { id: 'o3', actualAmount: 1500 } // 高于 1000
  ];
  // 传入 min 1000, max 200，系统智能翻转为 [200, 1000]，仅匹配 o2
  const filtered = FinanceAggregator.filterOrders(orders, { minAmount: 1000, maxAmount: 200 });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, 'o2');
});

check('DIM6-11: RBAC 数据权限范围隔离 (department 级别)', () => {
  const user = { dataScope: 'department', departmentId: 'dept-qa' };
  const items = [
    { id: '1', departmentId: 'dept-qa' },
    { id: '2', departmentId: 'dept-dev' },
    { id: '3', departmentId: 'dept-qa' }
  ];
  const filtered = RBACEngine.filterByDataScope(user, items);
  assert.strictEqual(filtered.length, 2);
  assert.deepStrictEqual(filtered.map(i => i.id), ['1', '3']);
});

check('DIM6-12: RBAC 数据权限范围隔离 (self 个人级别)', () => {
  const user = { dataScope: 'self', id: 'usr-99' };
  const items = [
    { id: '1', ownerId: 'usr-99' },
    { id: '2', ownerId: 'usr-88' }
  ];
  const filtered = RBACEngine.filterByDataScope(user, items);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, '1');
});

check('DIM6-13: RBAC 数据权限范围隔离 (all 全部放行)', () => {
  const user = { dataScope: 'all' };
  const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
  const filtered = RBACEngine.filterByDataScope(user, items);
  assert.strictEqual(filtered.length, 3);
});

check('DIM6-14: RBAC 权限通配符 * 与 admin:all 任意权限直通', () => {
  assert.strictEqual(RBACEngine.hasPermission(['*'], 'curriculum:course:delete'), true);
  assert.strictEqual(RBACEngine.hasPermission(['admin:all'], 'finance:order:refund'), true);
  assert.strictEqual(RBACEngine.hasPermission(['curriculum:course:view'], 'curriculum:course:delete'), false);
  assert.strictEqual(RBACEngine.hasPermission(['curriculum:course:view'], 'curriculum:course:view'), true);
});

check('DIM6-15: 跨校区学员数据互斥性验证：CY 学员不可由 WJ 校区过滤获取', () => {
  const cyStudents = studentMock.getStudents({ campusId: 'campus-bj-cy' });
  const wjStudents = studentMock.getStudents({ campusId: 'campus-bj-wj' });
  const cyIds = new Set(cyStudents.map(s => s.id));
  const overlap = wjStudents.some(s => cyIds.has(s.id));
  assert.strictEqual(overlap, false, '朝阳校区与望京校区学员集合交集必须为 0');
});

console.log('\n================================================================================');
console.log('盲测穿透执行总结');
console.log('================================================================================');
console.log(`  总盲测断言数: ${totalChecks}`);
console.log(`  成功通过项数: ${passedChecks}`);
console.log(`  失败异常项数: ${failedChecks}`);
console.log('================================================================================\n');

if (failedChecks > 0) {
  console.error(`❌ 独立盲测失败，存在 ${failedChecks} 项异常。`);
  process.exit(1);
} else {
  console.log(`🎉 恭喜！全部 ${totalChecks} 项独立盲测穿透用例 100% 通过！系统底层中台逻辑极其坚固、真实、零作弊。`);
  process.exit(0);
}

