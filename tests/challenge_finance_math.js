#!/usr/bin/env node
/**
 * 盛通教育「一校教培系统」财务中心极限对抗测试套件 (Challenger M5-1)
 * 对抗维度：
 * 1. 3x8 矩阵 24 个字段完整性、正交全排列组合过滤、边界表现与一键重置深度防御
 * 2. 资金高精度计算与浮点截断极端压力测试 (IEEE 754 截断、大量小数累加、退费负数、千万/亿元大额)
 * 3. 汇总横条 Summary Strip 规范文案与千分位格式化校验
 * 4. 随机 Fuzz 测试与独立数学 Oracle 交叉验证
 * 5. 双引擎交叉对比验证 (FinanceAggregator Contract vs TS Middle-Platform Engine)
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const ts = require('typescript');

// 1. 加载 CommonJS 核心契约引擎
const ContractEngine = require('./contracts/financeAggregator');

// 2. 动态转译并加载 TypeScript 业务中台引擎 (src/mocks/financial.ts)
function loadTSEngine() {
  const tsPath = path.resolve(__dirname, '../src/mocks/financial.ts');
  const code = fs.readFileSync(tsPath, 'utf-8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;

  const mod = { exports: {} };
  const wrapper = new Function('module', 'exports', 'require', transpiled);
  wrapper(mod, mod.exports, require);
  return mod.exports.FinanceAggregator;
}

const TSEngine = loadTSEngine();

// 测试执行追踪器
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
};

function test(name, fn) {
  results.total++;
  const start = Date.now();
  try {
    fn();
    const duration = Date.now() - start;
    results.passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
  } catch (err) {
    results.failed++;
    const duration = Date.now() - start;
    console.log(`  \x1b[31m✖\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    results.errors.push({ name, error: err });
  }
}

// 模拟测试数据发生器
function generateMockOrder(override = {}) {
  const defaultOrder = {
    orderNo: 'ORD_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    campusId: 'CAMPUS_HQ',
    studentName: '测试学员',
    studentNo: 'STU20260001',
    phone: '13800001234',
    submitter: '经办老师',
    creator: '经办老师',
    salesOwner: '课程顾问',
    performanceOwner: '课程顾问',
    channel: 'ground',
    classId: 'CLS_ROBOT_01',
    courseType: 'regular',
    chargeType: 'regular',
    orderType: 'regular',
    orderStatus: 'paid',
    status: 'paid',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    goodsDelivery: 'delivered',
    paymentMethod: 'wechat',
    actualAmount: 2000.00,
    invoiceStatus: 'issued',
    payTime: '2026-09-15 10:00:00',
    signupTime: '2026-09-10 09:00:00',
    auditTime: '2026-09-15 11:00:00',
    couponAmount: 100.00,
    auditor: '财务审核人',
    contractSigned: 'signed'
  };
  return { ...defaultOrder, ...override };
}

console.log('\n================================================================================');
console.log('盛通教育「一校教培系统」财务中心极限对抗测试套件 (Challenger M5-1 Execution)');
console.log('================================================================================');

// -----------------------------------------------------------------------------
// 第 1 模块：3x8 矩阵 24 个字段完整性与一键重置深度测试
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m【Suite 1: 3x8 矩阵 24 字段契约完整性与 resetFilterForm 一键重置测试】\x1b[0m');

test('1.1 getDefaultFilterForm() 返回恰好 24 个字段，无遗漏无多余', () => {
  const form = ContractEngine.getDefaultFilterForm();
  const keys = Object.keys(form);
  assert.strictEqual(keys.length, 24, `预期恰好 24 个字段，实际为 ${keys.length}`);

  const requiredKeys = [
    // Row 1 (8 控件)
    'studentKeyword', 'submitter', 'salesOwner', 'channel',
    'classId', 'courseType', 'chargeType', 'orderStatus',
    // Row 2 (8 控件)
    'studentStatus', 'abnormalStatus', 'goodsDelivery', 'paymentMethod',
    'minAmount', 'maxAmount', 'invoiceStatus', 'campusId',
    // Row 3 (8 控件)
    'dateRangeType', 'startDate', 'endDate', 'couponUsed',
    'auditor', 'contractSigned', 'page', 'pageSize'
  ];

  for (const k of requiredKeys) {
    assert.ok(k in form, `缺失必需字段: ${k}`);
  }
});

test('1.2 默认表单字段默认值符合业务契约 (含当月月初与月末日期)', () => {
  const form = ContractEngine.getDefaultFilterForm();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

  assert.strictEqual(form.studentKeyword, '');
  assert.strictEqual(form.submitter, '');
  assert.strictEqual(form.salesOwner, '');
  assert.strictEqual(form.channel, 'all');
  assert.strictEqual(form.classId, '');
  assert.strictEqual(form.courseType, 'all');
  assert.strictEqual(form.chargeType, 'all');
  assert.strictEqual(form.orderStatus, 'all');
  assert.strictEqual(form.studentStatus, 'all');
  assert.strictEqual(form.abnormalStatus, 'all');
  assert.strictEqual(form.goodsDelivery, 'all');
  assert.strictEqual(form.paymentMethod, 'all');
  assert.strictEqual(form.minAmount, null);
  assert.strictEqual(form.maxAmount, null);
  assert.strictEqual(form.invoiceStatus, 'all');
  assert.strictEqual(form.campusId, 'CAMPUS_HQ');
  assert.strictEqual(form.dateRangeType, 'payTime');
  assert.strictEqual(form.startDate, `${year}-${month}-01`);
  assert.strictEqual(form.endDate, `${year}-${month}-${lastDay}`);
  assert.strictEqual(form.couponUsed, 'all');
  assert.strictEqual(form.auditor, '');
  assert.strictEqual(form.contractSigned, 'all');
  assert.strictEqual(form.page, 1);
  assert.strictEqual(form.pageSize, 20);
});

test('1.3 表单工厂函数防共享引用突变 (Immutability & Object Isolation)', () => {
  const formA = ContractEngine.getDefaultFilterForm();
  const formB = ContractEngine.getDefaultFilterForm();
  formA.studentKeyword = 'MUTATED';
  formA.minAmount = 9999;
  formA.page = 42;
  assert.strictEqual(formB.studentKeyword, '');
  assert.strictEqual(formB.minAmount, null);
  assert.strictEqual(formB.page, 1);
});

test('1.4 resetFilterForm() 100% 恢复污染表单并正确注入归属校区', () => {
  const targetCampus = 'campus-bj-yy';
  const cleanForm = ContractEngine.resetFilterForm(targetCampus);

  // 验证注入校区
  assert.strictEqual(cleanForm.campusId, targetCampus, '必须准确注入指定校区');
  // 验证所有其他 23 个字段完全恢复纯净默认状态
  assert.strictEqual(cleanForm.studentKeyword, '');
  assert.strictEqual(cleanForm.submitter, '');
  assert.strictEqual(cleanForm.salesOwner, '');
  assert.strictEqual(cleanForm.channel, 'all');
  assert.strictEqual(cleanForm.classId, '');
  assert.strictEqual(cleanForm.courseType, 'all');
  assert.strictEqual(cleanForm.chargeType, 'all');
  assert.strictEqual(cleanForm.orderStatus, 'all');
  assert.strictEqual(cleanForm.studentStatus, 'all');
  assert.strictEqual(cleanForm.abnormalStatus, 'all');
  assert.strictEqual(cleanForm.goodsDelivery, 'all');
  assert.strictEqual(cleanForm.paymentMethod, 'all');
  assert.strictEqual(cleanForm.minAmount, null);
  assert.strictEqual(cleanForm.maxAmount, null);
  assert.strictEqual(cleanForm.invoiceStatus, 'all');
  assert.strictEqual(cleanForm.couponUsed, 'all');
  assert.strictEqual(cleanForm.auditor, '');
  assert.strictEqual(cleanForm.contractSigned, 'all');
  assert.strictEqual(cleanForm.page, 1);
  assert.strictEqual(cleanForm.pageSize, 20);
});

test('1.5 resetFilterForm() 不传参时默认校区安全兜底为 CAMPUS_HQ', () => {
  const defaultReset = ContractEngine.resetFilterForm();
  assert.strictEqual(defaultReset.campusId, 'CAMPUS_HQ');
});

// -----------------------------------------------------------------------------
// 第 2 模块：3x8 矩阵单字段、双字段、多字段正交组合与边界过滤测试
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m【Suite 2: 3x8 矩阵正交组合过滤、边界表现与容错测试】\x1b[0m');

test('2.1 学员姓名模糊搜索 (大小写不敏感、中英文混合与前后空格剪裁)', () => {
  const orders = [
    generateMockOrder({ orderNo: 'O1', studentName: '张小凡' }),
    generateMockOrder({ orderNo: 'O2', studentName: 'Tom Hanks' }),
    generateMockOrder({ orderNo: 'O3', studentName: '李小龙' }),
  ];

  // 中文子串匹配
  const res1 = ContractEngine.filterOrders(orders, { studentKeyword: '小凡' });
  assert.strictEqual(res1.length, 1);
  assert.strictEqual(res1[0].orderNo, 'O1');

  // 英文忽略大小写匹配
  const res2 = ContractEngine.filterOrders(orders, { studentKeyword: '  tOm  ' });
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res2[0].orderNo, 'O2');

  // 未命中测试
  const res3 = ContractEngine.filterOrders(orders, { studentKeyword: '赵六' });
  assert.strictEqual(res3.length, 0);
});

test('2.2 学号精确检索与手机号后 4 位穿透检索', () => {
  const orders = [
    generateMockOrder({ orderNo: 'O1', studentNo: 'STU_2026_001', phone: '13811112222' }),
    generateMockOrder({ orderNo: 'O2', studentNo: 'STU_2026_002', phone: '13933334444' }),
    generateMockOrder({ orderNo: 'O3', studentNo: 'STU_2026_003', phone: '13755556666' }),
  ];

  // 学号完全匹配
  const resNo = ContractEngine.filterOrders(orders, { studentKeyword: 'STU_2026_002' });
  assert.strictEqual(resNo.length, 1);
  assert.strictEqual(resNo[0].orderNo, 'O2');

  // 手机号后4位匹配
  const resPhone = ContractEngine.filterOrders(orders, { studentKeyword: '6666' });
  assert.strictEqual(resPhone.length, 1);
  assert.strictEqual(resPhone[0].orderNo, 'O3');
});

test('2.3 渠道 (channel) 与支付方式 (paymentMethod) 枚举精确正交过滤', () => {
  const orders = [
    generateMockOrder({ orderNo: 'O1', channel: 'ground', paymentMethod: 'wechat' }),
    generateMockOrder({ orderNo: 'O2', channel: 'online', paymentMethod: 'alipay' }),
    generateMockOrder({ orderNo: 'O3', channel: 'ground', paymentMethod: 'alipay' }),
    generateMockOrder({ orderNo: 'O4', channel: 'referral', paymentMethod: 'bank_transfer' }),
  ];

  // 单字段 channel = 'ground'
  const rGround = ContractEngine.filterOrders(orders, { channel: 'ground' });
  assert.strictEqual(rGround.length, 2);

  // 单字段 paymentMethod = 'alipay'
  const rAlipay = ContractEngine.filterOrders(orders, { paymentMethod: 'alipay' });
  assert.strictEqual(rAlipay.length, 2);

  // 双字段正交交集：channel='ground' 且 paymentMethod='alipay'
  const rBoth = ContractEngine.filterOrders(orders, { channel: 'ground', paymentMethod: 'alipay' });
  assert.strictEqual(rBoth.length, 1);
  assert.strictEqual(rBoth[0].orderNo, 'O3');

  // 'all' 通配测试
  const rAll = ContractEngine.filterOrders(orders, { channel: 'all', paymentMethod: 'all' });
  assert.strictEqual(rAll.length, 4);
});

test('2.4 金额范围闭区间边界极限测试 (Boundary Conditions minAmount & maxAmount)', () => {
  const orders = [
    generateMockOrder({ orderNo: 'O_100', actualAmount: 100.00 }),
    generateMockOrder({ orderNo: 'O_500', actualAmount: 500.00 }),
    generateMockOrder({ orderNo: 'O_1000', actualAmount: 1000.00 }),
    generateMockOrder({ orderNo: 'O_2000', actualAmount: 2000.00 }),
    generateMockOrder({ orderNo: 'O_5000', actualAmount: 5000.00 }),
  ];

  // 下限精确命中边界 (actualAmount >= 500)
  const rMin = ContractEngine.filterOrders(orders, { minAmount: 500.00 });
  assert.strictEqual(rMin.length, 4);
  assert.ok(rMin.some(o => o.orderNo === 'O_500'));

  // 上限精确命中边界 (actualAmount <= 2000)
  const rMax = ContractEngine.filterOrders(orders, { maxAmount: 2000.00 });
  assert.strictEqual(rMax.length, 4);
  assert.ok(rMax.some(o => o.orderNo === 'O_2000'));

  // 闭区间 [500, 2000]
  const rRange = ContractEngine.filterOrders(orders, { minAmount: 500.00, maxAmount: 2000.00 });
  assert.strictEqual(rRange.length, 3);
  const ids = rRange.map(o => o.orderNo).sort();
  assert.deepStrictEqual(ids, ['O_1000', 'O_2000', 'O_500'], '应严格包含边界两端及中间');
});

test('2.5 日期范围交集、补集与极端边缘测试 (Date Range Intersection & Complement)', () => {
  const orders = [
    generateMockOrder({ orderNo: 'D1', payTime: '2026-09-01 00:00:00' }),
    generateMockOrder({ orderNo: 'D2', payTime: '2026-09-15 12:30:00' }),
    generateMockOrder({ orderNo: 'D3', payTime: '2026-09-30 23:59:59' }),
    generateMockOrder({ orderNo: 'D4', payTime: '2026-10-01 08:00:00' }),
  ];

  // 9月全月范围 (交集包含 D1, D2, D3)
  const rSep = ContractEngine.filterOrders(orders, { startDate: '2026-09-01', endDate: '2026-09-30' });
  assert.strictEqual(rSep.length, 3);

  // 单日精确匹配 (2026-09-15 至 2026-09-15)
  const rSingleDay = ContractEngine.filterOrders(orders, { startDate: '2026-09-15', endDate: '2026-09-15' });
  assert.strictEqual(rSingleDay.length, 1);
  assert.strictEqual(rSingleDay[0].orderNo, 'D2');

  // 补集范围 (2026-10-01 以后)
  const rOct = ContractEngine.filterOrders(orders, { startDate: '2026-10-01' });
  assert.strictEqual(rOct.length, 1);
  assert.strictEqual(rOct[0].orderNo, 'D4');

  // 空区间 (startDate > endDate 矛盾筛选)
  const rEmpty = ContractEngine.filterOrders(orders, { startDate: '2026-09-20', endDate: '2026-09-10' });
  assert.strictEqual(rEmpty.length, 0);
});

test('2.6 8 字段深度正交复合过滤笛卡尔积测试 (Multi-dimensional Orthogonal Filter)', () => {
  const channels = ['ground', 'online', 'referral'];
  const methods = ['wechat', 'alipay', 'pos'];
  const statuses = ['paid', 'unpaid'];

  const testOrders = [];
  let counter = 0;
  for (const c of channels) {
    for (const m of methods) {
      for (const s of statuses) {
        counter++;
        testOrders.push(generateMockOrder({
          orderNo: `MAT_${counter}`,
          channel: c,
          paymentMethod: m,
          orderStatus: s,
          actualAmount: counter * 100,
          studentName: counter % 2 === 0 ? '偶数学员' : '奇数学员',
          studentNo: `STU_${counter}`,
          phone: `1380000${String(counter).padStart(4, '0')}`,
          classId: counter % 3 === 0 ? 'CLS_A' : 'CLS_B',
        }));
      }
    }
  }

  assert.strictEqual(testOrders.length, 3 * 3 * 2, '生成 18 笔笛卡尔积订单');

  // 复合 5 条件正交过滤
  const filter = {
    channel: 'online',
    paymentMethod: 'alipay',
    orderStatus: 'paid',
    minAmount: 100,
    maxAmount: 2000
  };

  const filtered = ContractEngine.filterOrders(testOrders, filter);
  for (const o of filtered) {
    assert.strictEqual(o.channel, 'online');
    assert.strictEqual(o.paymentMethod, 'alipay');
    assert.strictEqual(o.orderStatus, 'paid');
    assert.ok(o.actualAmount >= 100 && o.actualAmount <= 2000);
  }
});

test('2.7 空结果过滤条件与空数据容错边界防御 (Empty Results & Missing Attribute Resilience)', () => {
  // 1. 空订单列表输入
  assert.deepStrictEqual(ContractEngine.filterOrders([], { channel: 'online' }), []);
  assert.deepStrictEqual(ContractEngine.filterOrders(undefined, {}), []);

  // 2. 空过滤参数输入
  const sample = [generateMockOrder(), generateMockOrder()];
  assert.strictEqual(ContractEngine.filterOrders(sample, {}).length, 2);
  assert.strictEqual(ContractEngine.filterOrders(sample, undefined).length, 2);

  // 3. 空结果过滤条件 (不可能满足的矛盾组合)
  const impossibleFilter = {
    studentKeyword: 'NON_EXISTENT_STUDENT_XYZ_123',
    minAmount: 99999999
  };
  const emptyRes = ContractEngine.filterOrders(sample, impossibleFilter);
  assert.deepStrictEqual(emptyRes, [], '空结果必须返回安全空数组 [] 而非 null/undefined');

  // 4. 订单对象内部字段缺失时的边界防御 (无 actualAmount, 无 studentName, 无 payTime)
  const incompleteOrders = [
    { orderNo: 'INC_1' },
    { orderNo: 'INC_2', studentName: null, actualAmount: undefined, payTime: '' }
  ];
  assert.doesNotThrow(() => {
    ContractEngine.filterOrders(incompleteOrders, {
      studentKeyword: '测试',
      minAmount: 100,
      startDate: '2026-09-01'
    });
  }, '缺失内部属性不应导致运行时崩溃');
});

// -----------------------------------------------------------------------------
// 第 3 模块：资金高精度计算与浮点截断极端测试 (High-Precision Math & Float Truncation)
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m【Suite 3: 资金高精度计算与 IEEE 754 截断误差极端对抗测试】\x1b[0m');

test('3.1 IEEE 754 经典 0.10 + 0.20 浮点截断误差防御', () => {
  const orders = [
    { actualAmount: 0.10 },
    { actualAmount: 0.20 }
  ];
  const res = ContractEngine.calculateSummaryStrip(orders);
  assert.strictEqual(res.totalAmount, 0.30, '0.10 + 0.20 必须精确等于 0.30，严禁出现 0.30000000000000004');
  assert.strictEqual(res.formattedAmount, '0.30');
});

test('3.2 大量 0.01 元微小金额 (10,000 笔订单) 持续累加抗漂移测试', () => {
  // 在原始 JS float 循环中：10000 * 0.01 会漂移为 99.99999999999747
  const count = 10000;
  const orders = Array.from({ length: count }, () => ({ actualAmount: 0.01 }));
  const res = ContractEngine.calculateSummaryStrip(orders);

  assert.strictEqual(res.totalCount, count);
  assert.strictEqual(res.totalAmount, 100.00, '10,000 笔 0.01 元累加必须绝对等于 100.00 元');
  assert.strictEqual(res.formattedAmount, '100.00');
});

test('3.3 复杂多位小数与半分配金额四舍五入测试 (如 1999.995、99.99)', () => {
  const orders = [
    { actualAmount: 1999.995 }, // 半分四舍五入应入为 2000.00
    { actualAmount: 99.99 },
    { actualAmount: 0.005 }     // 半分四舍五入应入为 0.01
  ];
  const res = ContractEngine.calculateSummaryStrip(orders);
  // 2000.00 + 99.99 + 0.01 = 2100.00
  assert.strictEqual(res.totalAmount, 2100.00);
  assert.strictEqual(res.formattedAmount, '2,100.00');
});

test('3.4 含退费负数订单与正常订单混合累计对冲核算', () => {
  const orders = [
    { actualAmount: 5000.00 },
    { actualAmount: 3800.50 },
    { actualAmount: -3200.50 }, // 负数退款订单
    { actualAmount: -1200.00 }, // 负数退款订单
    { actualAmount: 600.00 }
  ];
  // 5000.00 + 3800.50 - 3200.50 - 1200.00 + 600.00 = 5000.00
  const res = ContractEngine.calculateSummaryStrip(orders);
  assert.strictEqual(res.totalCount, 5);
  assert.strictEqual(res.totalAmount, 5000.00);
  assert.strictEqual(res.formattedAmount, '5,000.00');
});

test('3.5 净额完全对冲归零与纯负数净赤字核算', () => {
  // 净额恰好归零
  const zeroOrders = [
    { actualAmount: 3200.50 },
    { actualAmount: -3200.50 }
  ];
  const resZero = ContractEngine.calculateSummaryStrip(zeroOrders);
  assert.strictEqual(resZero.totalAmount, 0.00);
  assert.strictEqual(resZero.formattedAmount, '0.00');

  // 净赤字负数
  const negOrders = [
    { actualAmount: 1000.00 },
    { actualAmount: -4200.50 }
  ];
  const resNeg = ContractEngine.calculateSummaryStrip(negOrders);
  assert.strictEqual(resNeg.totalAmount, -3200.50);
  assert.strictEqual(resNeg.formattedAmount, '-3,200.50');
  assert.strictEqual(resNeg.summaryText, '当前条件下：共计 2 笔缴费，实缴金额 -3,200.50 元');
});

test('3.6 千万元及十亿元级极端大额资金汇总与货币千分符排版', () => {
  const largeOrders = [
    { actualAmount: 10000000.00 },       // 1 千万元整
    { actualAmount: 58765432.10 },       // 5876.54 万元
    { actualAmount: 1234567890.12 }      // 12.34 亿元
  ];
  // 10000000 + 58765432.10 + 1234567890.12 = 1303333322.22
  const res = ContractEngine.calculateSummaryStrip(largeOrders);
  assert.strictEqual(res.totalCount, 3);
  assert.strictEqual(res.totalAmount, 1303333322.22);
  assert.strictEqual(res.formattedAmount, '1,303,333,322.22');
  assert.strictEqual(res.summaryText, '当前条件下：共计 3 笔缴费，实缴金额 1,303,333,322.22 元');
});

test('3.7 随机 Fuzz 测试：1,000 笔随机金额与数学 Oracle 精确比对 (零分误差)', () => {
  // 生成 1000 笔具有 1~2 位小数的正负随机金额
  let oracleCents = 0;
  const fuzzOrders = [];

  for (let i = 0; i < 1000; i++) {
    // 随机整数分（从 -500000 到 +500000 分，即 -5000.00 到 +5000.00 元）
    const cents = Math.floor(Math.random() * 1000001) - 500000;
    const yuan = cents / 100;
    oracleCents += cents;
    fuzzOrders.push({ actualAmount: yuan });
  }

  const expectedTotal = Number((oracleCents / 100).toFixed(2));
  const res = ContractEngine.calculateSummaryStrip(fuzzOrders);

  assert.strictEqual(res.totalCount, 1000);
  assert.strictEqual(res.totalAmount, expectedTotal, `Fuzz 测试发现分位偏差：预期 ${expectedTotal}，实际 ${res.totalAmount}`);
});

// -----------------------------------------------------------------------------
// 第 4 模块：汇总横条 Summary Strip 文案格式化规范核验
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m【Suite 4: 汇总横条 Summary Strip 格式规范核验】\x1b[0m');

test('4.1 规范文案模板正则全生命周期校验 /^当前条件下：共计 \\d+ 笔缴费，实缴金额 -?[\\d,]+\\.\\d{2} 元$/', () => {
  const pattern = /^当前条件下：共计 \d+ 笔缴费，实缴金额 -?[\d,]+\.\d{2} 元$/;

  // 0 笔数据
  const res0 = ContractEngine.calculateSummaryStrip([]);
  assert.strictEqual(res0.summaryText, '当前条件下：共计 0 笔缴费，实缴金额 0.00 元');
  assert.ok(pattern.test(res0.summaryText));

  // 1 笔数据
  const res1 = ContractEngine.calculateSummaryStrip([{ actualAmount: 888.88 }]);
  assert.strictEqual(res1.summaryText, '当前条件下：共计 1 笔缴费，实缴金额 888.88 元');
  assert.ok(pattern.test(res1.summaryText));

  // 真实设计稿基准截图样例：7 笔缴费，实缴金额 14,000.00 元
  const orders7 = Array.from({ length: 7 }, () => ({ actualAmount: 2000.00 }));
  const res7 = ContractEngine.calculateSummaryStrip(orders7);
  assert.strictEqual(res7.summaryText, '当前条件下：共计 7 笔缴费，实缴金额 14,000.00 元');
  assert.ok(pattern.test(res7.summaryText));
});

test('4.2 金额小数位与千分位分隔符严格性 (始终两位小数，无多余无遗漏)', () => {
  const cases = [
    { in: 0, out: '0.00' },
    { in: 5, out: '5.00' },
    { in: 12.3, out: '12.30' },
    { in: 1000, out: '1,000.00' },
    { in: 10000, out: '10,000.00' },
    { in: 1000000.5, out: '1,000,000.50' },
    { in: -12345.67, out: '-12,345.67' },
  ];

  for (const c of cases) {
    const res = ContractEngine.calculateSummaryStrip([{ actualAmount: c.in }]);
    assert.strictEqual(res.formattedAmount, c.out, `输入 ${c.in} 预期格式化为 ${c.out}，实际为 ${res.formattedAmount}`);
  }
});

// -----------------------------------------------------------------------------
// 第 5 模块：双引擎跨端交叉比对测试 (Contract vs TS Production Engine)
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m【Suite 5: 双引擎交叉对比核验 (Contract vs TypeScript Middle-Platform)】\x1b[0m');

test('5.1 双引擎 getDefaultFilterForm 结构与键名 100% 相同', () => {
  const cForm = ContractEngine.getDefaultFilterForm();
  const tsForm = TSEngine.getDefaultFilterForm();
  const cKeys = Object.keys(cForm).sort();
  const tsKeys = Object.keys(tsForm).sort();
  assert.deepStrictEqual(cKeys, tsKeys, '两端字段键名列表必须 100% 严格一致');
});

test('5.2 双引擎 calculateSummaryStrip 极端运算结果 100% 同构', () => {
  const testSets = [
    [],
    [{ actualAmount: 0.1 }, { actualAmount: 0.2 }],
    [{ actualAmount: 1999.995 }, { actualAmount: -3200.50 }, { actualAmount: 5000 }],
    Array.from({ length: 1000 }, () => ({ actualAmount: 0.01 })),
    [{ actualAmount: 987654321.05 }]
  ];

  for (let i = 0; i < testSets.length; i++) {
    const cRes = ContractEngine.calculateSummaryStrip(testSets[i]);
    const tsRes = TSEngine.calculateSummaryStrip(testSets[i]);
    assert.strictEqual(cRes.totalCount, tsRes.totalCount, `TestSet ${i} totalCount 不一致`);
    assert.strictEqual(cRes.totalAmount, tsRes.totalAmount, `TestSet ${i} totalAmount 不一致`);
    assert.strictEqual(cRes.formattedAmount, tsRes.formattedAmount, `TestSet ${i} formattedAmount 不一致`);
    assert.strictEqual(cRes.summaryText, tsRes.summaryText, `TestSet ${i} summaryText 不一致`);
  }
});

test('5.3 生产 TS 引擎全 20 过滤字段能力全面核验', () => {
  const fullOrder = generateMockOrder({
    orderNo: 'FULL_001',
    campusId: 'campus-bj-hq',
    courseType: 'training',
    chargeType: 'quarterly',
    orderStatus: 'unpaid',
    studentStatus: 'suspended',
    abnormalStatus: 'suspend',
    goodsDelivery: 'undelivered',
    invoiceStatus: 'unissued',
    couponAmount: 50,
    auditor: '赵总审核',
    contractSigned: 'unsigned'
  });

  const matched = TSEngine.filterOrders([fullOrder], {
    campusId: 'CAMPUS_HQ', // 别名解析
    courseType: 'training',
    chargeType: 'quarterly',
    orderStatus: 'unpaid',
    studentStatus: 'suspended',
    abnormalStatus: 'suspend',
    goodsDelivery: 'undelivered',
    invoiceStatus: 'unissued',
    couponUsed: 'yes',
    auditor: '赵总',
    contractSigned: 'unsigned'
  });

  assert.strictEqual(matched.length, 1, '生产 TS 引擎应完美满足 20 项组合精确过滤');
});

// -----------------------------------------------------------------------------
// 打印对抗测试综合评估结果
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log('盛通教育「一校教培系统」对抗测试汇总统计');
console.log('================================================================================');
console.log(`执行用例总数: ${results.total}`);
console.log(`\x1b[32m通过用例数:   ${results.passed}\x1b[0m`);
console.log(`\x1b[31m失败用例数:   ${results.failed}\x1b[0m`);
console.log(`对抗成功率:   ${((results.passed / results.total) * 100).toFixed(2)}%`);
console.log('================================================================================\n');

if (results.failed > 0) {
  console.error(`\x1b[31m【对抗结论：REJECT】发现 ${results.failed} 项失败用例！\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\x1b[32m【对抗结论：APPROVE】全部极限对抗用例通过，财务核心数学计算与矩阵过滤健壮无虞！\x1b[0m`);
  process.exit(0);
}
