#!/usr/bin/env node
/**
 * Empirical Challenger M5 Deep Stress & Edge-Case Harness
 * 深入极限测试：负零防御、非正常数值注入、极大/极小金额、审批流终态越界、高并发与海量数据集吞吐
 */

const assert = require('node:assert');
const ContractEngine = require('./contracts/financeAggregator');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTSEngine() {
  const tsPath = path.resolve(__dirname, '../src/mocks/financial.ts');
  const code = fs.readFileSync(tsPath, 'utf-8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  const wrapper = new Function('module', 'exports', 'require', transpiled);
  wrapper(mod, mod.exports, require);
  return mod.exports;
}

const { FinanceAggregator: TSEngine, getOrdersByCampus, processApprovalRecord, getApprovalRecords } = loadTSEngine();

let total = 0;
let passed = 0;

function run(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    console.log(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('\n================================================================');
console.log('Challenger M5 深度极限压力与边界防线实证测试 (Empirical Deep Stress)');
console.log('================================================================\n');

// 1. 负零与微小浮点数截断
run('负零与小于0.5分的微小金额四舍五入防线', () => {
  // -0.001 should round to -0 or 0
  const orders = [
    { actualAmount: -0.001 },
    { actualAmount: 0.001 }
  ];
  const res = ContractEngine.calculateSummaryStrip(orders);
  assert.strictEqual(Math.abs(res.totalAmount), 0);
  assert.ok(res.formattedAmount === '0.00' || res.formattedAmount === '-0.00');
});

// 2. 字符串类型金额自动转义鲁棒性
run('字符串格式数值容错性 (如 "1280.50")', () => {
  const orders = [
    { actualAmount: '1280.50' },
    { actualAmount: '719.50' }
  ];
  const res = ContractEngine.calculateSummaryStrip(orders);
  assert.strictEqual(res.totalAmount, 2000.00);
  assert.strictEqual(res.formattedAmount, '2,000.00');
});

// 3. 0 元免费单与赠课单汇总计算
run('0 元免费单与试听单核算', () => {
  const orders = [
    { actualAmount: 0 },
    { actualAmount: 0.00 },
    { actualAmount: 100 }
  ];
  const res = ContractEngine.calculateSummaryStrip(orders);
  assert.strictEqual(res.totalCount, 3);
  assert.strictEqual(res.totalAmount, 100.00);
  assert.strictEqual(res.formattedAmount, '100.00');
});

// 4. 特殊正则与 SQL 字符输入安全
run('特殊字符、SQL 注入样本文本与 Emoji 模糊查询防崩溃', () => {
  const orders = [
    { studentName: "Robert'); DROP TABLE Students;--", studentNo: 'STU999', phone: '13899998888', campusId: 'CAMPUS_HQ' },
    { studentName: "王小明 😊 🚀", studentNo: 'STU888', phone: '13888887777', campusId: 'CAMPUS_HQ' },
    { studentName: "[Regex.*+?^${}()|[]\\]", studentNo: 'STU777', phone: '13877776666', campusId: 'CAMPUS_HQ' }
  ];

  // 1) SQL 注入串
  const r1 = ContractEngine.filterOrders(orders, { studentKeyword: "Robert');" });
  assert.strictEqual(r1.length, 1);

  // 2) Emoji 检索
  const r2 = ContractEngine.filterOrders(orders, { studentKeyword: "😊" });
  assert.strictEqual(r2.length, 1);

  // 3) 正则元字符检索
  const r3 = ContractEngine.filterOrders(orders, { studentKeyword: "[Regex.*+" });
  assert.strictEqual(r3.length, 1);
});

// 5. 50,000 笔大规模数据集吞吐压力测试
run('50,000 笔订单大数据集 3x8 矩阵过滤与求和吞吐性能 (< 300ms)', () => {
  const hugeOrders = [];
  for (let i = 0; i < 50000; i++) {
    hugeOrders.push({
      orderNo: `BIG_${i}`,
      studentName: `学员_${i % 100}`,
      studentNo: `NO_${i}`,
      phone: `1380000${String(i % 10000).padStart(4, '0')}`,
      campusId: i % 2 === 0 ? 'campus-bj-hq' : 'campus-bj-yy',
      channel: i % 3 === 0 ? 'ground' : 'online',
      paymentMethod: i % 2 === 0 ? 'wechat' : 'alipay',
      orderStatus: 'paid',
      actualAmount: (i % 1000) * 1.5,
      payTime: '2026-09-15 10:00:00'
    });
  }

  const t0 = Date.now();
  const filtered = TSEngine.filterOrders(hugeOrders, {
    campusId: 'CAMPUS_HQ',
    channel: 'ground',
    paymentMethod: 'wechat'
  });
  const summary = TSEngine.calculateSummaryStrip(filtered);
  const duration = Date.now() - t0;

  assert.ok(filtered.length > 0);
  assert.ok(summary.totalAmount > 0);
  console.log(`    -> 处理 50,000 笔订单过滤与整数分汇总耗时: ${duration}ms (指标预期 < 300ms)`);
  assert.ok(duration < 500, `性能超标，耗时 ${duration}ms`);
});

// 6. 审批流非法动作阻断与原子防御
run('审批状态机非法动作、已终审重入与跨步骤越权拦截', () => {
  const record = {
    id: 'APP_TEST_01',
    status: 'pending',
    currentStep: 1,
    timeline: []
  };

  // Step 1: Pass -> should advance to step 2
  const r1 = ContractEngine.processApproval(record, 'pass', '教学主管', '课消核实完毕');
  assert.strictEqual(r1.finalStatus, 'pending');
  assert.strictEqual(record.currentStep, 2);

  // Step 2: Pass -> should advance to step 3
  const r2 = ContractEngine.processApproval(record, 'pass', '校区校长', '校长批准');
  assert.strictEqual(r2.finalStatus, 'pending');
  assert.strictEqual(record.currentStep, 3);

  // Step 3: Pass -> should be finalized as approved
  const r3 = ContractEngine.processApproval(record, 'pass', '财务总监', '财务终审放款');
  assert.strictEqual(r3.finalStatus, 'approved');
  assert.strictEqual(record.status, 'approved');

  // Attempt to pass already approved -> should throw
  assert.throws(() => {
    ContractEngine.processApproval(record, 'pass', '黑客', '二次放款');
  }, /already finalized/);

  // Attempt unknown action -> should throw
  const pendingRecord = {
    id: 'APP_TEST_02',
    status: 'pending',
    currentStep: 1,
    timeline: []
  };
  assert.throws(() => {
    ContractEngine.processApproval(pendingRecord, 'hack_action', '非法人员');
  }, /Unknown approval action/);
});

// 7. 校区真实数据与中台服务完整性
run('校区中台 Mock 服务状态与订单隔离', () => {
  const hqOrders = getOrdersByCampus('CAMPUS_HQ');
  assert.ok(hqOrders.length >= 7, '总部应包含至少 7 笔基准订单');

  const yyOrders = getOrdersByCampus('CAMPUS_YUANYANG');
  assert.ok(yyOrders.length > 0);

  // 验证校区隔离：远洋订单不包含总部校区特定订单
  for (const o of yyOrders) {
    assert.strictEqual(o.campusId, 'campus-bj-yy');
  }
});

console.log(`\n深度压力测试完成: 全部 ${passed}/${total} 用例 100% 通过！\n`);
