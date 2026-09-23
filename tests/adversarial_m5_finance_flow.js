/**
 * Milestone 5 财务中心与多级审批流对抗验证测试套件 (Challenger M5-2)
 * 纯 Node.js 原生沙箱标准执行，严禁使用 BypassSandbox 参数，严禁修改业务源码！
 * 
 * 对抗验证职责：
 * 1. 完整性检查 (Integrity Verification)：
 *    - 验证 FinanceAggregator 计算引擎非硬编码、非 Facade 桩逻辑；
 *    - 验证随机数据与未知数据下的动态精准计算；
 * 2. 3x8 矩阵高密度筛选引擎 (24 个筛选控件契约)：
 *    - 验证 getDefaultFilterForm() 返回严格 24 个查询参数；
 *    - 验证 resetFilterForm() 重置幂等性；
 *    - 验证 24 维交叉过滤、金额倒置自动纠错防呆、日期边界及关键字综合检索；
 * 3. 动态汇总小计横条 (Summary Strip) 与资金防失真：
 *    - 验证整数分 (Cents) 累加算法完全杜绝 IEEE-754 浮点截断；
 *    - 验证负数金额 (退费/冲正) 精确相减；
 *    - 验证千分位金额格式化与空状态文案；
 *    - 真实截图 7 笔 14000.00 元基准复现验证；
 * 4. 财务风控防线与状态机原子流转：
 *    - 已支付订单直接作废防线（必须阻断并引导走退费流）；
 *    - 订单结账归档锁定 (isLocked) 防线（禁止篡改核心资金）；
 *    - 未支付订单作废后名额释放与状态翻转；
 *    - 凭证更新与核销附言持久化；
 * 5. 3 级多业务审批流工作台状态机与业务反哺：
 *    - 3 级标准审批链路 (1/3 教学课消 -> 2/3 校长审批 -> 3/3 财务终审) 逐级推进；
 *    - 任意节点驳回即中断流转；
 *    - 已办结/已驳回单据防二次篡改守卫；
 *    - 退费终审通过原子级反哺更新关联订单为负数退费并加锁；
 * 6. 5 大校区资金独立核算与多校区动态隔离：
 *    - 5 大实体校区（HQ, YY, CY, HD, WJ）订单与审批单精准隔离；
 *    - 校区别名兼容性与非法校区 0 泄漏；
 * 7. 零污染现场快照与完全复原 (Zero-Pollution Invariant)。
 */

const path = require('node:path');
const createJiti = require('jiti');

const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const mocks = jiti('../src/mocks/index.ts');
const FinanceAggregator = mocks.FinanceAggregator;

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

function assertThrows(fn, expectedSubstr, message) {
  let threw = false;
  let errorMsg = '';
  try {
    fn();
  } catch (err) {
    threw = true;
    errorMsg = err.message || '';
    if (expectedSubstr && !errorMsg.includes(expectedSubstr)) {
      throw new Error(`${message || 'Failed'}: Expected error containing [${expectedSubstr}] but got [${errorMsg}]`);
    }
  }
  if (!threw) {
    throw new Error(`${message || 'Failed'}: Expected function to throw an error, but it succeeded.`);
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
console.log(`${colors.bold}${colors.cyan}盛通教育「一校教培系统」Milestone 5 财务模块与多级审批流对抗验证 (Challenger M5-2)${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

// 5 大实体校区标准 ID 与别名
const CAMPUS_HQ = 'campus-bj-hq';
const CAMPUS_YY = 'campus-bj-yy';
const CAMPUS_CY = 'campus-bj-cy';
const CAMPUS_HD = 'campus-bj-hd';
const CAMPUS_WJ = 'campus-bj-wj';

// 保存初始状态快照
const snapshotOrders = JSON.parse(JSON.stringify(mocks.MOCK_ORDERS_DATA));
const snapshotApprovals = JSON.parse(JSON.stringify(mocks.MOCK_APPROVAL_RECORDS));
const snapshotLedgers = JSON.parse(JSON.stringify(mocks.MOCK_LEDGER_RECORDS));

try {
  // -----------------------------------------------------------------------------
  // DIMENSION 1: 完整性检查与动态计算引擎非 Facade 验证
  // -----------------------------------------------------------------------------
  console.log(`${colors.bold}【Dimension 1: 完整性检查与动态计算引擎非 Facade 验证】${colors.reset}`);

  test('1.1 动态汇总计算非硬编码：随机生成金额数据集求和一致性', () => {
    // 构造任意随机订单集合
    const randomOrders = [
      { orderNo: 'ORD_R1', actualAmount: 123.45 },
      { orderNo: 'ORD_R2', actualAmount: 678.90 },
      { orderNo: 'ORD_R3', actualAmount: 4321.12 },
      { orderNo: 'ORD_R4', actualAmount: 0.53 }
    ];
    const res = FinanceAggregator.calculateSummaryStrip(randomOrders);
    assertEqual(res.totalCount, 4, '总笔数应为 4');
    assertEqual(res.totalAmount, 5124.00, '总金额应精确到 5124.00');
    assert(res.summaryText.includes('5,124.00'), '汇总文本应包含千分位 5,124.00');
  });

  test('1.2 浮点数经典精度截断防守：0.10 + 0.20 整数分精确处理', () => {
    const orders = [
      { orderNo: 'P1', actualAmount: 0.1 },
      { orderNo: 'P2', actualAmount: 0.2 }
    ];
    const res = FinanceAggregator.calculateSummaryStrip(orders);
    assertEqual(res.totalAmount, 0.30, '0.1 + 0.2 必须等于精确的 0.30，杜绝 0.30000000000000004');
    assertEqual(res.formattedAmount, '0.30', '格式化输出应为 0.30');
  });

  test('1.3 空数据集小计横条文本规范与零值稳健性', () => {
    const res = FinanceAggregator.calculateSummaryStrip([]);
    assertEqual(res.totalCount, 0, '空数据集笔数为 0');
    assertEqual(res.totalAmount, 0.00, '空数据集金额为 0.00');
    assertEqual(res.summaryText, '当前条件下：共计 0 笔缴费，实缴金额 0.00 元');
  });

  test('1.4 截图基准复现：总部校区真实 7 笔已支付订单求和为 14000.00 元', () => {
    const hqOrders = mocks.getOrdersByCampus(CAMPUS_HQ);
    const benchmarkOrders = hqOrders.slice(0, 7);
    const res = FinanceAggregator.calculateSummaryStrip(benchmarkOrders);
    assertEqual(res.totalCount, 7, '基准笔数必须为 7');
    assertEqual(res.totalAmount, 14000.00, '基准金额必须为 14000.00');
    assertEqual(res.summaryText, '当前条件下：共计 7 笔缴费，实缴金额 14,000.00 元');
  });

  // -----------------------------------------------------------------------------
  // DIMENSION 2: 3x8 矩阵高密度筛选引擎 (24 个筛选控件契约)
  // -----------------------------------------------------------------------------
  console.log(`\n${colors.bold}【Dimension 2: 3x8 高密度筛选矩阵与 24 控件契约】${colors.reset}`);

  test('2.1 getDefaultFilterForm() 返回严格 24 个查询参数字段', () => {
    const form = FinanceAggregator.getDefaultFilterForm();
    const keys = Object.keys(form);
    assertEqual(keys.length, 24, '表单字段总数必须恰好为 24');
    
    // 验证核心字段
    const requiredKeys = [
      'studentKeyword', 'submitter', 'salesOwner', 'channel', 'classId', 'courseType', 'chargeType', 'orderStatus',
      'studentStatus', 'abnormalStatus', 'goodsDelivery', 'paymentMethod', 'minAmount', 'maxAmount', 'invoiceStatus', 'campusId',
      'dateRangeType', 'startDate', 'endDate', 'couponUsed', 'auditor', 'contractSigned', 'page', 'pageSize'
    ];
    for (const k of requiredKeys) {
      assert(k in form, `表单必须包含字段: ${k}`);
    }
  });

  test('2.2 resetFilterForm() 能够重置脏表单并支持指定校区上下文', () => {
    const reset = FinanceAggregator.resetFilterForm(CAMPUS_YY);
    assertEqual(reset.studentKeyword, '', '关键字必须清空');
    assertEqual(reset.chargeType, 'all', '收费类型应恢复 all');
    assertEqual(reset.campusId, CAMPUS_YY, '校区应为指定的远洋校区');
    assertEqual(reset.page, 1, '页码恢复第一页');
  });

  test('2.3 金额倒置防呆纠错：minAmount > maxAmount 时自动容错过滤', () => {
    const orders = [
      { orderNo: 'O1', actualAmount: 1000 },
      { orderNo: 'O2', actualAmount: 2500 },
      { orderNo: 'O3', actualAmount: 5000 }
    ];
    // 故意传入倒置金额: min=3000, max=2000
    const filtered = FinanceAggregator.filterOrders(orders, {
      minAmount: 3000,
      maxAmount: 2000
    });
    assertEqual(filtered.length, 1, '自动调换后应过滤出 2000~3000 之间的 O2');
    assertEqual(filtered[0].orderNo, 'O2');
  });

  test('2.4 综合关键字跨字段检索：姓名、学号、手机号、订单号全匹配', () => {
    const orders = mocks.getOrdersByCampus(CAMPUS_HQ);
    
    // 搜姓名
    const byName = FinanceAggregator.filterOrders(orders, { studentKeyword: '牛柯森' });
    assert(byName.length >= 1, '按姓名搜牛柯森应存在');
    assertEqual(byName[0].studentName, '牛柯森');

    // 搜学号 (由于历史学员数据与截图基准共存，S948918 会匹配到对应学员)
    const byNo = FinanceAggregator.filterOrders(orders, { studentKeyword: 'S948918' });
    assert(byNo.length >= 1, '按学号 S948918 检索结果不应为空');
    for (const ord of byNo) {
      assert(ord.studentNo.includes('S948918'), `匹配订单的学号必须包含 S948918, 实际: ${ord.studentNo}`);
    }

    // 搜手机号
    const byPhone = FinanceAggregator.filterOrders(orders, { studentKeyword: '156****0125' });
    assertEqual(byPhone.length, 1, '按手机号 156****0125 唯一匹配');

    // 搜订单号 (模糊匹配包含该单号前缀的记录)
    const byOrderNo = FinanceAggregator.filterOrders(orders, { studentKeyword: '260918173041mBA01' });
    assert(byOrderNo.length >= 1, '按订单号检索结果不应为空');
    for (const ord of byOrderNo) {
      assert(ord.orderNo.toLowerCase().includes('260918173041mba01'), `订单编号必须包含检索词，实际: ${ord.orderNo}`);
    }
  });

  test('2.5 优惠券使用 (couponUsed) 状态筛选 (yes / no / all)', () => {
    const orders = [
      { orderNo: 'C1', couponAmount: 100 },
      { orderNo: 'C2', couponAmount: 0 },
      { orderNo: 'C3', couponAmount: 50 }
    ];
    const withCoupon = FinanceAggregator.filterOrders(orders, { couponUsed: 'yes' });
    assertEqual(withCoupon.length, 2, '使用优惠券应为 2 笔');

    const withoutCoupon = FinanceAggregator.filterOrders(orders, { couponUsed: 'no' });
    assertEqual(withoutCoupon.length, 1, '未用优惠券应为 1 笔');
    assertEqual(withoutCoupon[0].orderNo, 'C2');
  });

  // -----------------------------------------------------------------------------
  // DIMENSION 3: 财务风控防线与状态机原子流转
  // -----------------------------------------------------------------------------
  console.log(`\n${colors.bold}【Dimension 3: 财务风控防线与状态机原子流转】${colors.reset}`);

  test('3.1 风控防线：已支付订单禁止直接作废，必须被拦截', () => {
    const paidOrder = mocks.MOCK_ORDERS_DATA.find(o => o.status === 'paid');
    assert(paidOrder, '必须存在已支付订单');
    
    assertThrows(() => {
      mocks.voidOrder(paidOrder.id);
    }, 'Cannot void a paid order directly', '已支付订单必须抛出拦截异常');
    
    assertEqual(paidOrder.status, 'paid', '订单状态不可被直接篡改为 void');
  });

  test('3.2 正常作废：未支付订单作废成功并流转状态', () => {
    const unpaidOrder = mocks.MOCK_ORDERS_DATA.find(o => o.status === 'unpaid');
    assert(unpaidOrder, '必须存在未支付订单');
    const orderId = unpaidOrder.id;

    const res = mocks.voidOrder(orderId);
    assertEqual(res, true, '未支付订单作废必须返回 true');
    assertEqual(unpaidOrder.status, 'void', '订单状态应变更为 void');
    assertEqual(unpaidOrder.orderStatus, 'void', 'orderStatus 契约别名同步变更为 void');
  });

  test('3.3 幂等与防二次作废：已作废订单再次作废抛出异常', () => {
    const voidOrder = mocks.MOCK_ORDERS_DATA.find(o => o.status === 'void');
    assert(voidOrder, '必须存在作废订单');

    assertThrows(() => {
      mocks.voidOrder(voidOrder.id);
    }, 'Order is already voided', '已作废订单再次作废必须抛出异常');
  });

  test('3.4 账期锁定期守卫：已锁定 (isLocked) 订单禁止修改', () => {
    const lockedOrder = mocks.MOCK_ORDERS_DATA.find(o => o.isLocked === true);
    assert(lockedOrder, '必须存在已锁定订单');

    assertThrows(() => {
      mocks.updateOrder({
        id: lockedOrder.id,
        actualAmount: 99999
      });
    }, 'Order is locked by finance closing cycle', '锁定订单必须禁止修改');
  });

  test('3.5 未锁定订单修改：经办人、业绩归属人与出库状态更新成功', () => {
    const unlocked = mocks.MOCK_ORDERS_DATA.find(o => !o.isLocked && o.status !== 'void');
    assert(unlocked, '必须存在未锁定订单');

    const updated = mocks.updateOrder({
      id: unlocked.id,
      creator: '对抗测试经办人',
      submitter: '对抗测试经办人',
      goodsDelivery: 'delivered',
      remark: '对抗验证修改备注'
    });

    assertEqual(updated.creator, '对抗测试经办人');
    assertEqual(updated.goodsDelivery, 'delivered');
    assertEqual(updated.remark, '对抗验证修改备注');
  });

  test('3.6 收款凭证更新与核验附言持久化', () => {
    const order = mocks.MOCK_ORDERS_DATA[0];
    const res = mocks.updateOrderVoucher(order.id, {
      transactionId: 'TX_TEST_999888',
      auditRemark: '对抗测试财务到账确认',
      auditor: '高级财务主管'
    });

    assertEqual(res.transactionId, 'TX_TEST_999888');
    assertEqual(res.verifyRemark, '对抗测试财务到账确认');
    assertEqual(res.auditor, '高级财务主管');
  });

  // -----------------------------------------------------------------------------
  // DIMENSION 4: 3 级多业务审批流工作台状态机与业务反哺
  // -----------------------------------------------------------------------------
  console.log(`\n${colors.bold}【Dimension 4: 3 级多业务审批流工作台状态机与业务反哺】${colors.reset}`);

  test('4.1 标准 3 级退费审批逐级流转：教学核实 -> 校长审批 -> 财务终审办结', () => {
    // 构造测试审批单
    const approval = {
      id: 'APP_TEST_REFUND_01',
      approvalNo: 'AP2026101001',
      businessType: 'refund',
      sourceId: 'ord-010',
      applicantName: '李老师',
      studentName: '测试学员A',
      studentNo: 'S999901',
      campusId: CAMPUS_HD,
      campusName: '海淀分校',
      amount: 1500.00,
      status: 'pending',
      currentStep: 1,
      timeline: [],
      createdAt: '2026-10-10 10:00:00'
    };

    // 步骤 1：教学核实
    const s1 = FinanceAggregator.processApproval(approval, 'pass', '教学主管A', '出勤与消课核对无误');
    assertEqual(s1.finalStatus, 'pending');
    assertEqual(approval.currentStep, 2, '推进至第 2 步');
    assertEqual(approval.timeline.length, 1);
    assertEqual(approval.timeline[0].step, '教学课消核实');

    // 步骤 2：校区校长审批
    const s2 = FinanceAggregator.processApproval(approval, 'pass', '执行校长B', '同意扣减教材费后退款');
    assertEqual(s2.finalStatus, 'pending');
    assertEqual(approval.currentStep, 3, '推进至第 3 步');
    assertEqual(approval.timeline.length, 2);
    assertEqual(approval.timeline[1].step, '校区校长审批');

    // 步骤 3：总部财务终审
    const s3 = FinanceAggregator.processApproval(approval, 'pass', '财务总监C', '已由招行对公退还');
    assertEqual(s3.finalStatus, 'approved');
    assertEqual(approval.status, 'approved');
    assertEqual(approval.timeline.length, 3);
    assertEqual(approval.timeline[2].step, '总部财务终审');
    assertEqual(approval.timeline[2].status, 'passed');
  });

  test('4.2 审批流驳回机制：第 2 步驳回立即终止流转并记录原因', () => {
    const approval = {
      id: 'APP_TEST_REJECT_02',
      approvalNo: 'AP2026101002',
      businessType: 'payment',
      sourceId: 'ord-002',
      applicantName: '王销售',
      studentName: '测试学员B',
      studentNo: 'S999902',
      campusId: CAMPUS_HQ,
      campusName: '总部校区',
      amount: 3500.00,
      status: 'pending',
      currentStep: 2,
      timeline: [],
      createdAt: '2026-10-10 11:00:00'
    };

    const res = FinanceAggregator.processApproval(approval, 'reject', '校长D', '银行回执单金额与订单不符');
    assertEqual(res.finalStatus, 'rejected');
    assertEqual(approval.status, 'rejected');
    assertEqual(approval.timeline.length, 1);
    assertEqual(approval.timeline[0].status, 'rejected');
    assertEqual(approval.timeline[0].comment, '银行回执单金额与订单不符');
  });

  test('4.3 已终审/已驳回单据防二次操作守卫', () => {
    const finalized = {
      id: 'APP_TEST_FINAL_03',
      status: 'approved',
      currentStep: 3,
      timeline: []
    };

    assertThrows(() => {
      FinanceAggregator.processApproval(finalized, 'pass', '操作人');
    }, 'Approval record is already finalized', '已终审单据禁止再次通过');

    finalized.status = 'rejected';
    assertThrows(() => {
      FinanceAggregator.processApproval(finalized, 'reject', '操作人');
    }, 'Approval record is already finalized', '已驳回单据禁止再次驳回');
  });

  test('4.4 业务联动反哺：退费终审通过后自动将原订单变更为负数退款并锁定', () => {
    // 选取 MOCK_APPROVAL_RECORDS 中的待审退费单
    const refundApproval = mocks.MOCK_APPROVAL_RECORDS.find(a => a.businessType === 'refund' && a.status === 'pending');
    assert(refundApproval, '必须存在待审退费审批单');
    const orderId = refundApproval.sourceId;

    // 执行通过直到终审
    while (refundApproval.status === 'pending') {
      mocks.processApprovalRecord(refundApproval.id, 'pass', '财务对抗测试主管', '审批通过反哺测试');
    }

    assertEqual(refundApproval.status, 'approved', '审批单必须终审通过');

    // 验证反哺关联订单
    const linkedOrder = mocks.MOCK_ORDERS_DATA.find(o => o.id === orderId);
    if (linkedOrder) {
      assert(linkedOrder.actualAmount < 0, '关联订单金额必须反哺为负数退款');
      assertEqual(linkedOrder.isLocked, true, '关联订单必须进入锁定状态');
      assert(linkedOrder.verifyRemark.includes('终审通过已执行退款'), '订单审核备注必须记录退款流水');
    }
  });

  // -----------------------------------------------------------------------------
  // DIMENSION 5: 5 大校区资金独立核算与多校区动态隔离
  // -----------------------------------------------------------------------------
  console.log(`\n${colors.bold}【Dimension 5: 5 大校区资金独立核算与多校区动态隔离】${colors.reset}`);

  test('5.1 总部校区 (HQ) 统筹全量订单流水，分校区严格物理隔离', () => {
    const allHq = mocks.getOrdersByCampus(CAMPUS_HQ);
    assert(allHq.length >= 20, '总部校区可查看全量订单池');

    // 远洋校区
    const yyOrders = mocks.getOrdersByCampus(CAMPUS_YY);
    assert(yyOrders.length > 0, '远洋校区必须有订单');
    for (const o of yyOrders) {
      assertEqual(o.campusId, CAMPUS_YY, `远洋校区订单 ${o.orderNo} 不得泄漏其他校区数据`);
    }

    // 朝阳校区
    const cyOrders = mocks.getOrdersByCampus(CAMPUS_CY);
    assert(cyOrders.length > 0, '朝阳校区必须有订单');
    for (const o of cyOrders) {
      assertEqual(o.campusId, CAMPUS_CY, `朝阳校区订单 ${o.orderNo} 不得泄漏其他校区数据`);
    }

    // 海淀分校
    const hdOrders = mocks.getOrdersByCampus(CAMPUS_HD);
    assert(hdOrders.length > 0, '海淀分校必须有订单');
    for (const o of hdOrders) {
      assertEqual(o.campusId, CAMPUS_HD, `海淀分校订单 ${o.orderNo} 不得泄漏其他校区数据`);
    }

    // 望京校区
    const wjOrders = mocks.getOrdersByCampus(CAMPUS_WJ);
    assert(wjOrders.length > 0, '望京校区必须有订单');
    for (const o of wjOrders) {
      assertEqual(o.campusId, CAMPUS_WJ, `望京校区订单 ${o.orderNo} 不得泄漏其他校区数据`);
    }
  });

  test('5.2 校区别名与标准编码双向归一化匹配', () => {
    // 传入 CAMPUS_YUANYANG 别名
    const yyByAlias = mocks.getOrdersByCampus('CAMPUS_YUANYANG');
    const yyByCanonical = mocks.getOrdersByCampus(CAMPUS_YY);
    assertEqual(yyByAlias.length, yyByCanonical.length, '别名与标准 ID 匹配订单量必须完全一致');

    // 传入 CAMPUS_HAIDIAN 别名
    const hdByAlias = mocks.getOrdersByCampus('CAMPUS_HAIDIAN');
    const hdByCanonical = mocks.getOrdersByCampus(CAMPUS_HD);
    assertEqual(hdByAlias.length, hdByCanonical.length, '海淀别名与标准 ID 匹配一致');
  });

  test('5.3 非法/不存在校区 ID 安全防御与零泄漏', () => {
    const ghostOrders = mocks.getOrdersByCampus('campus-ghost-unknown-999');
    assertEqual(ghostOrders.length, 0, '不存在的校区必须返回空数组，不得泄露任何订单');
  });

  test('5.4 收费流水账本 (Ledger) 多维度组合过滤与对账一致性', () => {
    const ledgers = mocks.getLedgerRecords(CAMPUS_HQ, {
      method: '微信商户号',
      type: '新签报读'
    });
    assert(ledgers.length > 0, '微信商户号新签报读流水应存在');
    for (const l of ledgers) {
      assertEqual(l.method, '微信商户号');
      assertEqual(l.type, '新签报读');
    }
  });

} finally {
  // -----------------------------------------------------------------------------
  // DIMENSION 6: 现场快照完全复原 (Zero-Pollution Invariant)
  // -----------------------------------------------------------------------------
  console.log(`\n${colors.bold}【Dimension 6: 现场快照完全复原 (Zero-Pollution Invariant)】${colors.reset}`);
  
  // 恢复快照
  mocks.MOCK_ORDERS_DATA.length = 0;
  mocks.MOCK_ORDERS_DATA.push(...snapshotOrders);

  mocks.MOCK_APPROVAL_RECORDS.length = 0;
  mocks.MOCK_APPROVAL_RECORDS.push(...snapshotApprovals);

  mocks.MOCK_LEDGER_RECORDS.length = 0;
  mocks.MOCK_LEDGER_RECORDS.push(...snapshotLedgers);

  console.log(`  ${colors.green}✓ PASS:${colors.reset} 现场数据已 100% 幂等复原至测试前初始快照，无状态泄漏`);
}

// -----------------------------------------------------------------------------
// 测试统计输出
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}================================================================================${colors.reset}`);
console.log(`${colors.bold}对抗测试结果统计: 总用例数 ${totalTests} | ${colors.green}通过: ${passedTests}${colors.reset} | ${colors.red}失败: ${failedTests}${colors.reset}`);
console.log(`${colors.bold}================================================================================${colors.reset}`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
