/**
 * tests/test_mp_no_mock_fallback.cjs
 *
 * 数据库是唯一真值源：小程序读接口失败时必须把错误交给页面，不得回落到内置假数据。
 * 全程用桩代替 wx.request，不连接任何后端。依赖 mini-program 的 mp-weixin 编译产物。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mpRoot = path.resolve(__dirname, '../mini-program');
const compiled = (name) => path.join(mpRoot, 'dist/build/mp-weixin/api', `${name}.js`);
const readSrc = (rel) => fs.readFileSync(path.join(mpRoot, 'src', rel), 'utf8');

global.Page = global.Page || function () {};
global.Component = global.Component || function () {};
global.App = global.App || function () {};
global.getCurrentPages = global.getCurrentPages || function () { return []; };
global.getApp = global.getApp || function () { return {}; };

let respond = () => {};
global.wx = global.uni = {
  getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375, platform: 'devtools' }),
  getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 24, right: 368, bottom: 56, left: 281 }),
  getStorageSync: (k) => (k === 'token' ? 'stub-token' : ''),
  setStorageSync: () => {},
  removeStorageSync: () => {},
  showToast: () => {},
  showModal: () => {},
  reLaunch: () => {},
  request: (opts) => respond(opts),
};

const forbidden = (opts) => opts.success({ statusCode: 403, data: { message: '缺少 financial:orderManagement 功能权限' } });
const networkDown = (opts) => opts.fail({ errMsg: 'request:fail connection refused' });
const ok = (data) => (opts) => opts.success({ statusCode: 200, data });

const { financeApi } = require(compiled('finance'));
const { catalogApi } = require(compiled('catalog'));
const { classApi } = require(compiled('class'));
const { eduApi } = require(compiled('edu'));

const readers = [
  ['financeApi.getOrders', () => financeApi.getOrders()],
  ['financeApi.getOrderSummary', () => financeApi.getOrderSummary({})],
  ['financeApi.getOrderById', () => financeApi.getOrderById('ord-01')],
  ['financeApi.getApprovals', () => financeApi.getApprovals()],
  ['financeApi.getApprovalDetail', () => financeApi.getApprovalDetail('appr-01')],
  ['catalogApi.getCourses', () => catalogApi.getCourses()],
  ['classApi.getClassDetail', () => classApi.getClassDetail('cls-01')],
  ['eduApi.getFulfillmentWorkbench', () => eduApi.getFulfillmentWorkbench('sch-01')],
];

async function main() {
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {};
  console.error = () => {};

  for (const [name, call] of readers) {
    respond = forbidden;
    await assert.rejects(call(), (e) => e.statusCode === 403, `${name} 遇 403 应向页面抛出原始错误`);
    respond = networkDown;
    await assert.rejects(call(), (e) => /request:fail/.test(e.errMsg), `${name} 断网时应抛出原始错误`);
  }
  console.log(`✔ ${readers.length} 个读接口在 403 / 断网时都抛错，不返回内置数据`);

  // 空响应不能被补成假数据
  respond = ok(null);
  await assert.rejects(financeApi.getOrderById('ord-01'), /未找到/);
  await assert.rejects(financeApi.getApprovalDetail('appr-01'), /未找到/);
  await assert.rejects(classApi.getClassDetail('cls-01'), /未找到/);
  await assert.rejects(eduApi.getFulfillmentWorkbench('sch-01'), /未找到/);
  console.log('✔ 详情接口返回空响应时报「未找到」');

  // 真实的空结果保持为空
  respond = ok({ list: [], total: 0 });
  assert.deepStrictEqual(await financeApi.getOrders(), { list: [], total: 0 });
  assert.deepStrictEqual(await financeApi.getApprovals(), { list: [], total: 0 });
  assert.deepStrictEqual(await catalogApi.getCourses(), []);
  respond = ok({});
  const emptySummary = await financeApi.getOrderSummary({});
  assert.strictEqual(emptySummary.todayPaidAmount, 0);
  assert.strictEqual(emptySummary.monthOrderCount, 0);
  assert.deepStrictEqual(await catalogApi.getGoods(), [], '后端没有物品目录时不展示虚构商品');
  console.log('✔ 空结果不被替换成内置数据');

  // 审批详情的业务字段来自后端响应；尚无审批节点时时间线为空
  respond = ok({
    flowId: 'flow-real-1',
    orderNo: 'ORD-REAL-1',
    businessType: 'refund',
    status: 'pending',
    currentStep: 1,
    totalSteps: 3,
    applicantName: '真实申请人',
    createdAt: '2026-11-01T08:00:00.000Z',
    nodes: [],
    order: {
      orderNo: 'ORD-REAL-1',
      actualAmount: 888,
      remark: '真实退费原因',
      student: { name: '真实学员' },
      package: { course: { name: '真实课程' } },
    },
  });
  const detail = await financeApi.getApprovalDetail('flow-real-1');
  assert.strictEqual(detail.id, 'flow-real-1');
  assert.strictEqual(detail.studentName, '真实学员');
  assert.strictEqual(detail.courseName, '真实课程');
  assert.strictEqual(detail.amount, 888);
  assert.strictEqual(detail.reason, '真实退费原因');
  assert.strictEqual(detail.applicantName, '真实申请人');
  assert.deepStrictEqual(detail.timeline, []);
  assert.strictEqual(detail.accountNo, undefined, '后端未返回银行账号时不得补假账号');
  console.log('✔ 审批详情只使用后端响应，不混入内置数据');

  console.warn = originalWarn;
  console.error = originalError;

  // 源码与页面
  const apiSources = ['finance', 'catalog', 'class', 'edu'].map((n) => [n, readSrc(`api/${n}.ts`)]);
  for (const [name, source] of apiSources) {
    assert.ok(!/MOCK_[A-Z]+/.test(source), `api/${name}.ts 仍有 MOCK_ 常量`);
    assert.ok(!/高保真|离线容灾|内置数据/.test(source), `api/${name}.ts 仍有回落逻辑`);
  }
  for (const [page, needle] of [
    ['package-finance/orders/index.vue', 'subject="订单"'],
    ['package-finance/orders/detail.vue', 'subject="该订单"'],
    ['package-finance/approval/index.vue', 'subject="审批单"'],
    ['package-finance/approval/detail.vue', 'subject="该审批单"'],
    ['package-edu/class/detail.vue', 'subject="该班级"'],
    ['package-edu/lecture/roll-call.vue', 'subject="该课次"'],
  ]) {
    const source = readSrc(page);
    assert.ok(source.includes('<LoadErrorState') && source.includes(needle), `${page} 缺少加载失败状态`);
    assert.ok(!/ord-01|appr-01|S950014|董御|郑扶摇|冯老师|李校长/.test(source), `${page} 仍内置假业务数据`);
  }
  assert.ok(!/todayPaidAmount:\s*4992/.test(readSrc('package-finance/orders/index.vue')), '订单页汇总不得有假初始值');
  console.log('✔ 源码无假数据常量，6 个页面都有加载失败状态');

  const { classifyLoadError } = loadClassifier();
  assert.strictEqual(classifyLoadError({ statusCode: 403 }), 'forbidden');
  assert.strictEqual(classifyLoadError({ statusCode: 500 }), 'failed');
  assert.strictEqual(classifyLoadError({ errMsg: 'request:fail' }), 'failed');
  console.log('✔ 403 显示无权限，其他失败显示可重试');

  console.log('\n✅ test_mp_no_mock_fallback 全部通过');
}

// loadError.ts 只有类型标注和一个纯函数，去掉类型后直接求值
function loadClassifier() {
  const js = readSrc('utils/loadError.ts')
    .replace(/export type .*\n/, '')
    .replace('export function classifyLoadError(error: any): LoadErrorKind', 'function classifyLoadError(error)');
  return new Function(`${js}\nreturn { classifyLoadError };`)();
}

main().catch((e) => {
  console.error('❌ test_mp_no_mock_fallback 失败:', e);
  process.exit(1);
});
