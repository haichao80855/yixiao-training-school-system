/**
 * Milestone 5 多级审批状态机与校区隔离对抗测试套件 (Challenger M5-2)
 * 纯 Node.js 标准沙箱运行，零外部额外依赖，严禁使用 BypassSandbox
 * 
 * 挑战职责与验证矩阵：
 * 1. 多级审批状态机非法操作对抗：
 *    - 尝试对已终审通过 (approved) 或已驳回 (rejected) 的审批单再次执行 pass/reject，验证严格阻断抛错；
 *    - 尝试跳步审批 (如 step 1 越级由 step 3 审批、非法 step 0/4/-1)，验证节点流转与流转时间轴 (timeline) 完整性；
 *    - 尝试驳回操作，验证驳回后状态立即变为 rejected 并完整保留操作人与审核意见。
 * 2. 跨校区数据安全隔离对抗：
 *    - 验证总部校区是否能穿透查看全量 5 大校区 (总部、远洋、朝阳、海淀、望京) 订单；
 *    - 验证非总部校区 (远洋、朝阳、海淀、望京) 仅能查看本校区归属订单；
 *    - 尝试用非本部校区筛选其他校区订单 (参数篡改与注入攻击)，验证数据泄露防护为零泄漏。
 * 3. 订单作废风控与退费联动对抗：
 *    - 尝试作废已支付状态订单，验证安全拦截与业务规则；
 *    - 验证退费审批终审办结后是否正确反哺流水账本并冲正相关订单为负金额且锁定。
 * 4. 双轨引擎契约一致性验证 (tests/contracts/financeAggregator.js vs src/mocks/financial.ts)。
 * 5. 现场数据隔离与零污染复原 (Zero-Pollution Invariant)。
 */

const path = require('node:path');
const createJiti = require('jiti');

// 使用 jiti 安全解析生产 TypeScript 源码并支持 @ 别名
const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const financialMock = jiti('../src/mocks/financial.ts');
const ContractFinanceAggregator = require('./contracts/financeAggregator');

const {
  FinanceAggregator: TsFinanceAggregator,
  MOCK_ORDERS_DATA,
  MOCK_APPROVAL_RECORDS,
  MOCK_LEDGER_RECORDS,
  CAMPUS_CODE_MAP,
  isCampusMatch,
  getOrdersByCampus,
  saveOrder,
  voidOrder,
  updateOrder,
  updateOrderVoucher,
  getApprovalRecords,
  processApprovalRecord,
  getLedgerRecords
} = financialMock;

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
  }
}

console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}拓视未来教育「一校教培系统」Milestone 5 多级审批状态机与校区隔离对抗测试 (Challenger M5-2)${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

// 现场数据快照 (用于测试后 100% 零污染复原)
const ordersBackup = JSON.parse(JSON.stringify(MOCK_ORDERS_DATA));
const approvalsBackup = JSON.parse(JSON.stringify(MOCK_APPROVAL_RECORDS));
const ledgersBackup = JSON.parse(JSON.stringify(MOCK_LEDGER_RECORDS));

function restoreDataSnapshot() {
  MOCK_ORDERS_DATA.length = 0;
  for (const item of ordersBackup) {
    MOCK_ORDERS_DATA.push(JSON.parse(JSON.stringify(item)));
  }
  MOCK_APPROVAL_RECORDS.length = 0;
  for (const item of approvalsBackup) {
    MOCK_APPROVAL_RECORDS.push(JSON.parse(JSON.stringify(item)));
  }
  MOCK_LEDGER_RECORDS.length = 0;
  for (const item of ledgersBackup) {
    MOCK_LEDGER_RECORDS.push(JSON.parse(JSON.stringify(item)));
  }
}

// ============================================================================
// 1. 多级审批状态机非法操作对抗 (Multi-Tier Approval State Machine Adversarial)
// ============================================================================
console.log(`${colors.bold}${colors.blue}【第 1 阶段：多级审批状态机非法操作对抗】${colors.reset}`);

test('1.1 [非法终态再操作] 对已终审通过 (approved) 审批单再次执行 pass 必须抛错阻断', () => {
  const record = {
    id: 'ADV-APP-01',
    businessType: 'payment',
    currentStep: 3,
    status: 'approved',
    timeline: [
      { step: '总部财务终审', operator: '财务', comment: '已终审', time: '2026-09-20 12:00:00', status: 'passed' }
    ]
  };

  let threw = false;
  try {
    ContractFinanceAggregator.processApproval(record, 'pass', '黑客操作员', '恶意尝试二次通过');
  } catch (err) {
    threw = true;
    assert(err.message.includes('already finalized as: approved'), `错误提示不符: ${err.message}`);
  }
  assert(threw, '已终审通过的单据执行 pass 必须抛出异常阻断');
  assertEqual(record.status, 'approved', '单据状态未被篡改');
  assertEqual(record.timeline.length, 1, 'timeline 未受污染追加');
});

test('1.2 [非法终态再操作] 对已终审通过 (approved) 审批单再次执行 reject 必须抛错阻断', () => {
  const record = {
    id: 'ADV-APP-02',
    businessType: 'payment',
    currentStep: 3,
    status: 'approved',
    timeline: []
  };

  let threw = false;
  try {
    TsFinanceAggregator.processApproval(record, 'reject', '黑客操作员', '恶意尝试推翻终审');
  } catch (err) {
    threw = true;
    assert(err.message.includes('already finalized as: approved'), `错误提示不符: ${err.message}`);
  }
  assert(threw, '已终审通过的单据执行 reject 必须抛出异常阻断');
  assertEqual(record.status, 'approved', '单据状态未被篡改');
});

test('1.3 [非法终态再操作] 对已驳回 (rejected) 审批单再次执行 pass 必须抛错阻断', () => {
  const record = {
    id: 'ADV-APP-03',
    businessType: 'refund',
    currentStep: 1,
    status: 'rejected',
    timeline: [
      { step: '教学课消核实', operator: '主管', comment: '驳回重填', time: '2026-09-20 12:00:00', status: 'rejected' }
    ]
  };

  let threw = false;
  try {
    ContractFinanceAggregator.processApproval(record, 'pass', '黑客操作员', '恶意尝试复活已驳回单据');
  } catch (err) {
    threw = true;
    assert(err.message.includes('already finalized as: rejected'), `错误提示不符: ${err.message}`);
  }
  assert(threw, '已驳回单据执行 pass 必须抛出异常阻断');
  assertEqual(record.status, 'rejected', '单据状态保持 rejected');
  assertEqual(record.timeline.length, 1, 'timeline 未受污染');
});

test('1.4 [非法终态再操作] 对已驳回 (rejected) 审批单再次执行 reject 必须抛错阻断', () => {
  const record = {
    id: 'ADV-APP-04',
    businessType: 'refund',
    currentStep: 2,
    status: 'rejected',
    timeline: []
  };

  let threw = false;
  try {
    TsFinanceAggregator.processApproval(record, 'reject', '黑客操作员', '重复驳回攻击');
  } catch (err) {
    threw = true;
    assert(err.message.includes('already finalized as: rejected'), `错误提示不符: ${err.message}`);
  }
  assert(threw, '已驳回单据再次 reject 必须抛错阻断');
});

test('1.5 [越级跳步审批防御] Step 1 状态下单据由 Step 3 角色审批时，严格流转至 Step 2 而非跳至 Step 3 或直接终审', () => {
  const record = {
    id: 'ADV-APP-05',
    businessType: 'refund',
    currentStep: 1,
    status: 'pending',
    timeline: []
  };

  // 模拟操作者声称自己是财务总监 (Step 3)，尝试跳步直接审批
  const res = TsFinanceAggregator.processApproval(record, 'pass', '财务总监(伪造身份)', '越级审批');
  assert(res.success, '当前节点审批操作成功');
  assertEqual(res.finalStatus, 'pending', '单据不可越级直接终审，仍应为 pending');
  assertEqual(record.currentStep, 2, '当前步骤仅能递增至 Step 2 (校区校长审批)，不可越步跳至 3');
  assertEqual(record.timeline.length, 1, '流转节点严格记录 1 条');
  assertEqual(record.timeline[0].step, '教学课消核实', '时间轴真实记录为第一步节点');
  assertEqual(record.timeline[0].status, 'passed');
});

test('1.6 [非法步骤边界防御] 传入非法的 currentStep (0 / 4 / -1 / 99) 必须被严格抛错阻断', () => {
  const invalidSteps = [0, 4, -1, 99];
  for (const step of invalidSteps) {
    const record = {
      id: `ADV-APP-INV-${step}`,
      businessType: 'payment',
      currentStep: step,
      status: 'pending',
      timeline: []
    };
    let threw = false;
    try {
      ContractFinanceAggregator.processApproval(record, 'pass', '审计员', '测试非法步骤');
    } catch (err) {
      threw = true;
      assert(err.message.includes(`Invalid current step: ${step}`), `错误提示不符: ${err.message}`);
    }
    assert(threw, `步骤 ${step} 必须被严格抛错阻断`);
  }
});

test('1.7 [非法动作边界防御] 传入非法的 action (\'cancel\', \'delegate\', \'hold\', \'\') 必须严格抛错阻断', () => {
  const invalidActions = ['cancel', 'delegate', 'hold', ''];
  for (const action of invalidActions) {
    const record = {
      id: `ADV-APP-ACT-${action}`,
      businessType: 'payment',
      currentStep: 1,
      status: 'pending',
      timeline: []
    };
    let threw = false;
    try {
      TsFinanceAggregator.processApproval(record, action, '审计员', '测试非法动作');
    } catch (err) {
      threw = true;
      assert(err.message.includes(`Unknown approval action: ${action}`), `错误提示不符: ${err.message}`);
    }
    assert(threw, `动作 ${action} 必须被抛错阻断`);
  }
});

test('1.8 [逐级流转与时间轴审计完整性] 完整 3 级流转链路时间轴 (Timeline) 审计轨迹严格保真', () => {
  const record = {
    id: 'ADV-APP-AUDIT-01',
    businessType: 'refund',
    currentStep: 1,
    status: 'pending',
    timeline: []
  };

  // Step 1: 教学课消核实
  const step1 = TsFinanceAggregator.processApproval(record, 'pass', '张主管', '课消核实无误，剩余20课时');
  assertEqual(step1.finalStatus, 'pending');
  assertEqual(record.currentStep, 2);
  assertEqual(record.timeline.length, 1);
  assertEqual(record.timeline[0].step, '教学课消核实');
  assertEqual(record.timeline[0].operator, '张主管');
  assertEqual(record.timeline[0].comment, '课消核实无误，剩余20课时');
  assertEqual(record.timeline[0].status, 'passed');
  assert(Boolean(record.timeline[0].time), '时间戳不可为空');

  // Step 2: 校区校长审批
  const step2 = TsFinanceAggregator.processApproval(record, 'pass', '李校长', '同意退费申请');
  assertEqual(step2.finalStatus, 'pending');
  assertEqual(record.currentStep, 3);
  assertEqual(record.timeline.length, 2);
  assertEqual(record.timeline[1].step, '校区校长审批');
  assertEqual(record.timeline[1].operator, '李校长');
  assertEqual(record.timeline[1].status, 'passed');

  // Step 3: 总部财务终审
  const step3 = TsFinanceAggregator.processApproval(record, 'pass', '王财务总监', '退款执行办结');
  assertEqual(step3.finalStatus, 'approved');
  assertEqual(record.status, 'approved');
  assertEqual(record.timeline.length, 3);
  assertEqual(record.timeline[2].step, '总部财务终审');
  assertEqual(record.timeline[2].operator, '王财务总监');
  assertEqual(record.timeline[2].status, 'passed');
});

test('1.9 [驳回中断流转与责任人审计] 任意节点执行驳回，状态立即变为 rejected，并完整保留驳回原因与节点', () => {
  const stepsToTest = [
    { step: 1, name: '教学课消核实' },
    { step: 2, name: '校区校长审批' },
    { step: 3, name: '总部财务终审' }
  ];

  for (const item of stepsToTest) {
    const record = {
      id: `ADV-APP-REJ-${item.step}`,
      businessType: 'payment',
      currentStep: item.step,
      status: 'pending',
      timeline: []
    };

    const reason = `在节点[${item.name}]凭证异常，退回修改`;
    const res = TsFinanceAggregator.processApproval(record, 'reject', `风控官_${item.step}`, reason);
    assert(res.success, '驳回调用成功');
    assertEqual(res.finalStatus, 'rejected', '返回状态为 rejected');
    assertEqual(record.status, 'rejected', '记录状态立即变为 rejected');
    assertEqual(record.currentStep, item.step, '步骤停止推进，不递增');
    assertEqual(record.timeline.length, 1, '时间轴记录驳回条目');
    assertEqual(record.timeline[0].step, item.name, '驳回节点名称匹配');
    assertEqual(record.timeline[0].operator, `风控官_${item.step}`);
    assertEqual(record.timeline[0].comment, reason);
    assertEqual(record.timeline[0].status, 'rejected');

    // 验证驳回后无法再推进
    let threw = false;
    try {
      TsFinanceAggregator.processApproval(record, 'pass', '操作员', '尝试通过已驳回单');
    } catch {
      threw = true;
    }
    assert(threw, '驳回后该单据进入终态，无法再次 pass 推进');
  }
});


// ============================================================================
// 2. 跨校区数据安全隔离对抗 (Cross-Campus Data Security & Isolation Adversarial)
// ============================================================================
console.log(`\n${colors.bold}${colors.blue}【第 2 阶段：跨校区数据安全隔离对抗】${colors.reset}`);

test('2.1 [总部穿透能力] 总部校区标识 (campus-bj-hq / CAMPUS_HQ / HQ001 / all / 空) 穿透查看全量 5 大校区 28 笔订单', () => {
  const hqIdentifiers = ['campus-bj-hq', 'CAMPUS_HQ', 'HQ001', 'all', undefined, ''];
  const totalOrdersCount = MOCK_ORDERS_DATA.length;
  assertEqual(totalOrdersCount, 28, '全量订单基准总数应为 28 笔');

  for (const id of hqIdentifiers) {
    const orders = getOrdersByCampus(id);
    assertEqual(orders.length, 28, `总部标识 [${id}] 获取订单数必须为全量 28 笔`);

    // 验证确实包含 5 大校区中的每一个校区
    const campusIds = new Set(orders.map(o => o.campusId));
    assert(campusIds.has('campus-bj-hq'), '必须包含总部校区订单');
    assert(campusIds.has('campus-bj-yy'), '必须包含远洋校区订单');
    assert(campusIds.has('campus-bj-cy'), '必须包含朝阳校区订单');
    assert(campusIds.has('campus-bj-hd'), '必须包含海淀分校订单');
    assert(campusIds.has('campus-bj-wj'), '必须包含望京校区订单');
    assertEqual(campusIds.size, 5, '总部穿透必须覆盖全部 5 大校区');
  }
});

test('2.2 [非总部校区数据隔离] 远洋校区仅返回归属远洋订单，绝对不包含其他校区数据', () => {
  const yyIdentifiers = ['campus-bj-yy', 'CAMPUS_YUANYANG', 'YY002', '远洋校区'];
  for (const id of yyIdentifiers) {
    const yyOrders = getOrdersByCampus(id);
    assert(yyOrders.length > 0, `远洋校区订单不应为空 (标识: ${id})`);
    for (const ord of yyOrders) {
      assert(
        isCampusMatch(ord.campusId, 'campus-bj-yy'),
        `远洋校区越权泄露其他校区订单! 订单号: ${ord.orderNo}, 归属校区: ${ord.campusId}`
      );
    }
  }
});

test('2.3 [非总部校区数据隔离] 朝阳校区仅返回归属朝阳订单，绝无数据泄露', () => {
  const cyOrders = getOrdersByCampus('campus-bj-cy');
  assert(cyOrders.length > 0, '朝阳校区订单不应为空');
  for (const ord of cyOrders) {
    assert(
      isCampusMatch(ord.campusId, 'campus-bj-cy'),
      `朝阳校区越权泄露其他校区订单! 订单号: ${ord.orderNo}, 归属校区: ${ord.campusId}`
    );
  }
});

test('2.4 [非总部校区数据隔离] 海淀与望京校区均保持绝对独立隔离', () => {
  const hdOrders = getOrdersByCampus('campus-bj-hd');
  assert(hdOrders.length > 0, '海淀校区订单不应为空');
  for (const ord of hdOrders) {
    assert(isCampusMatch(ord.campusId, 'campus-bj-hd'), '海淀校区包含非海淀订单');
  }

  const wjOrders = getOrdersByCampus('campus-bj-wj');
  assert(wjOrders.length > 0, '望京校区订单不应为空');
  for (const ord of wjOrders) {
    assert(isCampusMatch(ord.campusId, 'campus-bj-wj'), '望京校区包含非望京订单');
  }
});

test('2.5 [筛选参数篡改越权对抗] 远洋校区环境下，攻击者在筛选矩阵中传入 campusId=\'campus-bj-hq\' (总部) 试图越权', () => {
  // 模拟远洋校区上下文加载的数据集 (仅限远洋)
  const scopedOrders = getOrdersByCampus('campus-bj-yy');
  
  // 攻击者篡改表单 filters.campusId 为总部
  const tamperedFilters = { campusId: 'campus-bj-hq' };
  const leakedOrders = TsFinanceAggregator.filterOrders(scopedOrders, tamperedFilters);

  assertEqual(leakedOrders.length, 0, '远洋校区过滤总部校区参数必须返回 0 条，数据泄露量严格为 0');
});

test('2.6 [筛选参数篡改越权对抗] 远洋校区环境下，攻击者在筛选矩阵中传入 campusId=\'campus-bj-cy\' (朝阳) 试图越权', () => {
  const scopedOrders = getOrdersByCampus('campus-bj-yy');
  const tamperedFilters = { campusId: 'campus-bj-cy' };
  const leakedOrders = TsFinanceAggregator.filterOrders(scopedOrders, tamperedFilters);

  assertEqual(leakedOrders.length, 0, '远洋校区过滤朝阳校区参数必须返回 0 条，跨分校横向越权拦截成功');
});

test('2.7 [恶意校区注入参数安全防御] 传入注入字符串 (SQL注入/脚本/通配符) 不崩溃且返回 0 条', () => {
  const maliciousInputs = [
    "' OR '1'='1",
    "campus-bj-yy' --",
    "<script>alert(1)</script>",
    "null",
    "undefined",
    "NON_EXISTENT_CAMPUS_999",
    "*"
  ];

  for (const input of maliciousInputs) {
    const orders = getOrdersByCampus(input);
    assertEqual(orders.length, 0, `恶意/非法校区标识 [${input}] 必须安全返回 0 条数据`);
  }
});

test('2.8 [审批单与流水账本多校区隔离] 远洋校区调用审批与账本接口严格隔离', () => {
  const yyApprovals = getApprovalRecords('campus-bj-yy');
  for (const a of yyApprovals) {
    assert(isCampusMatch(a.campusId, 'campus-bj-yy'), `审批单泄露跨校区数据: ${a.approvalNo}`);
  }

  const yyLedgers = getLedgerRecords('campus-bj-yy');
  for (const l of yyLedgers) {
    assert(isCampusMatch(l.campusId, 'campus-bj-yy'), `流水账本泄露跨校区数据: ${l.transNo}`);
  }

  // 总部校区可统筹查看全部
  const hqApprovals = getApprovalRecords('campus-bj-hq');
  assertEqual(hqApprovals.length, MOCK_APPROVAL_RECORDS.length, '总部应可查看全量审批单');

  const hqLedgers = getLedgerRecords('campus-bj-hq');
  assertEqual(hqLedgers.length, MOCK_LEDGER_RECORDS.length, '总部应可查看全量收费流水账本');
});


// ============================================================================
// 3. 订单作废风控与退费联动对抗 (Order Voiding & Refund Linkage Adversarial)
// ============================================================================
console.log(`\n${colors.bold}${colors.blue}【第 3 阶段：订单作废风控与退费联动对抗】${colors.reset}`);

test('3.1 [订单作废风控拦截] 尝试作废已支付 (paid) 状态订单必须被强力安全拦截，禁止直接作废', () => {
  // 挑选一笔已支付订单
  const paidOrder = MOCK_ORDERS_DATA.find(o => o.status === 'paid' && o.actualAmount > 0);
  assert(Boolean(paidOrder), '需存在已支付订单');

  let threw = false;
  try {
    voidOrder(paidOrder.id);
  } catch (err) {
    threw = true;
    assert(
      err.message.includes('Cannot void a paid order directly'),
      `错误文案不符预期: ${err.message}`
    );
    assert(
      err.message.includes('必须走退费流'),
      `未提示发起退费审批流: ${err.message}`
    );
  }
  assert(threw, '已支付订单调用 voidOrder 必须抛错拦截');
  assertEqual(paidOrder.status, 'paid', '订单状态不可被篡改');
  assertEqual(paidOrder.orderStatus, 'paid');
});

test('3.2 [未支付订单作废] 对未支付 (unpaid) 状态订单调用 voidOrder 允许正常作废', () => {
  // 临时构造一笔未支付订单放入
  const unpaidOrder = {
    id: 'ord-test-unpaid-01',
    orderNo: 'ORD_UNPAID_TEST_01',
    studentId: 'std-test-01',
    studentName: '测试学员',
    campusId: 'campus-bj-hq',
    status: 'unpaid',
    orderStatus: 'unpaid',
    actualAmount: 1800.00,
    receivableAmount: 1800.00,
    isLocked: false
  };
  MOCK_ORDERS_DATA.push(unpaidOrder);

  const res = voidOrder(unpaidOrder.id);
  assert(res === true, '作废未支付订单应返回 true');
  assertEqual(unpaidOrder.status, 'void', '订单状态应变更为 void');
  assertEqual(unpaidOrder.orderStatus, 'void');
});

test('3.3 [防重复作废状态机防御] 对已经作废 (void) 状态订单再次调用 voidOrder 必须抛错阻断', () => {
  const voidedOrder = {
    id: 'ord-test-voided-02',
    orderNo: 'ORD_VOIDED_TEST_02',
    campusId: 'campus-bj-hq',
    status: 'void',
    orderStatus: 'void',
    actualAmount: 0.00,
    isLocked: false
  };
  MOCK_ORDERS_DATA.push(voidedOrder);

  let threw = false;
  try {
    voidOrder(voidedOrder.id);
  } catch (err) {
    threw = true;
    assert(err.message.includes('Order is already voided'), `错误文案不符: ${err.message}`);
  }
  assert(threw, '重复作废已作废订单必须抛错阻断');
});

test('3.4 [不存在订单作废防御] 传入不存在的订单 ID 调用 voidOrder 抛出 Not found', () => {
  let threw = false;
  try {
    voidOrder('NON_EXISTENT_ORDER_RANDOM_UUID');
  } catch (err) {
    threw = true;
    assert(err.message.includes('Order not found'), `错误文案不符: ${err.message}`);
  }
  assert(threw, '不存在订单调用 voidOrder 必须抛出异常');
});

test('3.5 [退费审批终审反哺与流水冲正联动] 退费审批流 1-2 级不触碰订单，第 3 级终审办结原子级冲正订单金额并锁定', () => {
  // 1. 创建一笔已支付的正向订单
  const targetOrderId = 'ord-refund-linkage-target';
  const targetOrderNo = 'ORD_REFUND_TARGET_999';
  const originPaidAmount = 4800.00;

  const targetOrder = {
    id: targetOrderId,
    orderNo: targetOrderNo,
    studentId: 'std-refund-01',
    studentName: '王小童',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    receivableAmount: originPaidAmount,
    actualAmount: originPaidAmount,
    isLocked: false,
    verifyRemark: '初始微信支付成功'
  };
  MOCK_ORDERS_DATA.push(targetOrder);

  // 2. 创建一笔待审批的退费审批单 (退款金额 4800.00 元)
  const refundApprovalId = 'app-refund-linkage-test';
  const refundApprovalNo = 'APPR-REFUND-2026-999';
  const refundAmount = 4800.00;

  const refundApproval = {
    id: refundApprovalId,
    approvalNo: refundApprovalNo,
    businessType: 'refund',
    sourceId: targetOrderId,
    orderNo: targetOrderNo,
    applicantName: '陈学管',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    amount: refundAmount,
    status: 'pending',
    currentStep: 1, // 第 1 步
    timeline: []
  };
  MOCK_APPROVAL_RECORDS.push(refundApproval);

  // 3. 执行第 1 级审批 (教学主管通过)
  processApprovalRecord(refundApprovalId, 'pass', '主管张三', '课消核验无误');
  assertEqual(refundApproval.status, 'pending', '第 1 级通过后审批状态仍为 pending');
  assertEqual(refundApproval.currentStep, 2, '流转推进至第 2 步');
  assertEqual(targetOrder.actualAmount, originPaidAmount, '第 1 级未终审，订单金额绝不可提前扣减');
  assertEqual(targetOrder.isLocked, false, '订单未被锁定');

  // 4. 执行第 2 级审批 (分校校长通过)
  processApprovalRecord(refundApprovalId, 'pass', '校长李四', '同意退款');
  assertEqual(refundApproval.status, 'pending', '第 2 级通过后审批状态仍为 pending');
  assertEqual(refundApproval.currentStep, 3, '流转推进至第 3 步');
  assertEqual(targetOrder.actualAmount, originPaidAmount, '第 2 级未终审，订单金额依然保持原额');
  assertEqual(targetOrder.isLocked, false, '订单未被锁定');

  // 5. 执行第 3 级终审 (财务总监终审办结)
  processApprovalRecord(refundApprovalId, 'pass', '财务总监赵六', '出纳已原路退回微信');
  assertEqual(refundApproval.status, 'approved', '第 3 级通过后审批状态办结为 approved');
  assertEqual(refundApproval.timeline.length, 3, '时间轴完整记录 3 条节点');

  // 6. 验证订单反哺联动生效！
  assertEqual(targetOrder.actualAmount, -refundAmount, '订单实缴金额被精确冲正为负值 -4800.00');
  assertEqual(targetOrder.receivableAmount, -refundAmount, '订单应收金额被精确冲正为负值 -4800.00');
  assertEqual(targetOrder.isLocked, true, '订单被财务核销机制置为锁定 isLocked: true');
  assert(
    targetOrder.verifyRemark.includes(refundApprovalNo),
    `订单附言未包含退费单号: ${targetOrder.verifyRemark}`
  );
  assert(
    targetOrder.verifyRemark.includes('终审通过已执行退款'),
    `订单附言未记录退款执行: ${targetOrder.verifyRemark}`
  );

  // 7. 验证锁定后的冲正订单禁止再次被常规编辑修改！
  let threwUpdate = false;
  try {
    updateOrder({ id: targetOrderId, actualAmount: 9999.00 });
  } catch (err) {
    threwUpdate = true;
    assert(
      err.message.includes('Order is locked by finance closing cycle, modification prohibited'),
      `锁定期拦截报错不符: ${err.message}`
    );
  }
  assert(threwUpdate, '锁定后的退费冲正订单调用 updateOrder 必须被严格拦截抛错');
  assertEqual(targetOrder.actualAmount, -refundAmount, '拦截后金额未被篡改');
});

test('3.6 [动态汇总小计数学精度对抗] 冲正后的负金额订单参与汇总，实缴金额准确抵减且无浮点数截断', () => {
  // 构造包含正向订单与冲正退费订单的集合
  const mixedOrders = [
    { actualAmount: 2000.00 },
    { actualAmount: 3000.10 },
    { actualAmount: 0.20 },
    { actualAmount: -1500.30 }, // 冲正退费
    { actualAmount: 1000.00 }
  ];
  // 预期: 2000.00 + 3000.10 + 0.20 - 1500.30 + 1000.00 = 4500.00

  const summaryContract = ContractFinanceAggregator.calculateSummaryStrip(mixedOrders);
  const summaryTs = TsFinanceAggregator.calculateSummaryStrip(mixedOrders);

  assertEqual(summaryContract.totalCount, 5, '合同引擎统计笔数一致');
  assertEqual(summaryTs.totalCount, 5, 'TS 引擎统计笔数一致');

  assertEqual(summaryContract.totalAmount, 4500.00, '合同引擎精确计算总额');
  assertEqual(summaryTs.totalAmount, 4500.00, 'TS 引擎精确计算总额');

  assert(summaryContract.summaryText.includes('4,500.00 元'), '文案千分位对齐');
  assert(summaryTs.summaryText.includes('4,500.00 元'), '文案千分位对齐');
});


// ============================================================================
// 4. 双轨引擎契约完全一致性对抗 (Dual-Track Contract Alignment)
// ============================================================================
console.log(`\n${colors.bold}${colors.blue}【第 4 阶段：双轨引擎契约完全一致性对抗】${colors.reset}`);

test('4.1 [双轨契约对齐] 验证 tests/contracts/financeAggregator.js 与 src/mocks/financial.ts 默认表单完全一致', () => {
  const formContract = ContractFinanceAggregator.getDefaultFilterForm();
  const formTs = TsFinanceAggregator.getDefaultFilterForm();

  const keysContract = Object.keys(formContract).sort();
  const keysTs = Object.keys(formTs).sort();

  assertEqual(keysContract.length, 24, '契约表单恰好 24 项');
  assertEqual(keysTs.length, 24, 'TS 表单恰好 24 项');
  assertEqual(JSON.stringify(keysContract), JSON.stringify(keysTs), '表单 24 项字段完全一致');

  for (const key of keysContract) {
    assertEqual(formContract[key], formTs[key], `字段 [${key}] 默认值双轨对齐`);
  }
});

test('4.2 [双轨契约对齐] 验证 resetFilterForm 在指定校区时行为完全一致', () => {
  const resetContract = ContractFinanceAggregator.resetFilterForm('campus-bj-yy');
  const resetTs = TsFinanceAggregator.resetFilterForm('campus-bj-yy');

  assertEqual(resetContract.campusId, 'campus-bj-yy');
  assertEqual(resetTs.campusId, 'campus-bj-yy');
  assertEqual(JSON.stringify(resetContract), JSON.stringify(resetTs));
});

test('4.3 [双轨契约对齐] 验证截图 7 笔 14000.00 元基准订单在双轨汇总引擎下输出绝对一致', () => {
  const screenshotOrders = MOCK_ORDERS_DATA.slice(0, 7);
  const res1 = ContractFinanceAggregator.calculateSummaryStrip(screenshotOrders);
  const res2 = TsFinanceAggregator.calculateSummaryStrip(screenshotOrders);

  assertEqual(res1.totalCount, 7);
  assertEqual(res2.totalCount, 7);
  assertEqual(res1.totalAmount, 14000.00);
  assertEqual(res2.totalAmount, 14000.00);
  assertEqual(res1.formattedAmount, '14,000.00');
  assertEqual(res2.formattedAmount, '14,000.00');
  assertEqual(res1.summaryText, '当前条件下：共计 7 笔缴费，实缴金额 14,000.00 元');
  assertEqual(res2.summaryText, '当前条件下：共计 7 笔缴费，实缴金额 14,000.00 元');
});


// ============================================================================
// 5. 现场数据复原与全量基线守卫 (Zero-Pollution & Baseline Guard)
// ============================================================================
console.log(`\n${colors.bold}${colors.blue}【第 5 阶段：现场数据零污染复原与基线守卫】${colors.reset}`);

test('5.1 [现场数据零污染复原] 恢复全量 Mock 数据快照，杜绝污染既有自动化测试', () => {
  restoreDataSnapshot();
  assertEqual(MOCK_ORDERS_DATA.length, ordersBackup.length, '订单数据量复原');
  assertEqual(MOCK_APPROVAL_RECORDS.length, approvalsBackup.length, '审批单数据量复原');
  assertEqual(MOCK_LEDGER_RECORDS.length, ledgersBackup.length, '流水账本数据量复原');
});


// ============================================================================
// 测试结果汇总结算
// ============================================================================
console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}对抗测试套件执行完成汇报 (Challenger M5-2 Summary)${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`总对抗用例数: ${totalTests}`);
console.log(`${colors.green}通过用例数: ${passedTests}${colors.reset}`);
console.log(`${failedTests === 0 ? colors.green : colors.red}失败用例数: ${failedTests}${colors.reset}`);

if (failures.length > 0) {
  console.log(`\n${colors.red}【失败用例清单】:${colors.reset}`);
  for (const f of failures) {
    console.log(`- ${colors.red}${f.name}${colors.reset}: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log(`\n${colors.green}${colors.bold}★ 所有 22 项严密对抗测试 100% 通过！审批状态机、校区隔离与风控反哺无懈可击！★${colors.reset}\n`);
  process.exit(0);
}
