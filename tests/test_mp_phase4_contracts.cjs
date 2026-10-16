const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 运行微信小程序端阶段四（财务收支与审批流）契约测试');
console.log('======================================================');

// 1. 验证编译产物 app.json 中的 package-finance 路由挂载
const distAppJsonPath = path.resolve(__dirname, '../mini-program/dist/build/mp-weixin/app.json');
assert.ok(fs.existsSync(distAppJsonPath), '❌ 编译产物 app.json 不存在！');
const appJson = JSON.parse(fs.readFileSync(distAppJsonPath, 'utf8'));

const financeSubPkg = appJson.subPackages.find((s) => s.root === 'package-finance');
assert.ok(financeSubPkg, '❌ 缺少财务分包 package-finance 配置');

const expectedFinancePages = [
  'orders/index',
  'orders/detail',
  'approval/index',
  'approval/detail',
];

for (const p of expectedFinancePages) {
  assert.ok(financeSubPkg.pages.includes(p), `❌ package-finance 缺少页面: ${p}`);
}

console.log('✔ package-finance 路由挂载完整性校验通过 (4个核心页面全部正确注册)');

// 2. 验证 API 模块契约 (financeApi)
const financeApiPath = path.resolve(__dirname, '../mini-program/src/api/finance.ts');
assert.ok(fs.existsSync(financeApiPath), '❌ api/finance.ts 不存在');
const financeApiContent = fs.readFileSync(financeApiPath, 'utf8');

const expectedFinanceMethods = [
  'getOrders',
  'getOrderSummary',
  'getOrderById',
  'voidOrder',
  'lockOrder',
  'updateVoucher',
  'getApprovals',
  'getApprovalTimeline',
  'auditApproval',
  'batchAudit',
];

for (const m of expectedFinanceMethods) {
  assert.ok(financeApiContent.includes(m), `❌ financeApi 缺少方法: ${m}`);
}

console.log('✔ financeApi 核心订单与审批风控接口契约校验通过');

// 3. 验证订单列表管理页 (package-finance/orders/index.vue)
const orderListPage = path.resolve(__dirname, '../mini-program/src/package-finance/orders/index.vue');
const orderListContent = fs.readFileSync(orderListPage, 'utf8');

assert.ok(orderListContent.includes('summary-board-card'), '❌ 订单列表缺少顶部营收数据看板');
assert.ok(orderListContent.includes('board-metrics-row'), '❌ 订单列表缺少看板数据指标栏');
assert.ok(orderListContent.includes('filters-pills-bar'), '❌ 订单列表缺少横向类型与状态筛选条');
assert.ok(orderListContent.includes('order-record-card'), '❌ 订单列表缺少订单卡片组件');
assert.ok(orderListContent.includes('order-no-text'), '❌ 订单卡片缺少订单单号/流水号展示');
assert.ok(orderListContent.includes('handleCardClick'), '❌ 订单卡片缺少查看收据交互');
console.log('✔ 财务订单列表页看板、状态筛选与卡片流契约校验通过');

// 4. 验证电子收据详情页 (package-finance/orders/detail.vue)
const orderDetailPage = path.resolve(__dirname, '../mini-program/src/package-finance/orders/detail.vue');
const orderDetailContent = fs.readFileSync(orderDetailPage, 'utf8');

assert.ok(orderDetailContent.includes('receipt-card'), '❌ 电子收据缺少纸质收据背景卡片');
assert.ok(orderDetailContent.includes('seal-stamp'), '❌ 电子收据缺少官方财务公章');
assert.ok(orderDetailContent.includes('receipt-top-teeth'), '❌ 电子收据缺少防伪锯齿边效果');
assert.ok(orderDetailContent.includes('items-table'), '❌ 电子收据缺少购买项目与课时收费明细');
assert.ok(orderDetailContent.includes('paymentMethod'), '❌ 电子收据缺少支付方式展示');
assert.ok(orderDetailContent.includes('handleVoidOrder'), '❌ 电子收据缺少安全作废单据动作');
console.log('✔ 电子收据详情页 (防伪锯齿/财务印章/明细表格/作废) 契约校验通过');

// 5. 验证多级风控审批中心 (package-finance/approval/index.vue - 对齐截图 035)
const approvalIndexPage = path.resolve(__dirname, '../mini-program/src/package-finance/approval/index.vue');
const approvalIndexContent = fs.readFileSync(approvalIndexPage, 'utf8');

assert.ok(approvalIndexContent.includes('refund'), '❌ 审批中心缺少退费审批业务 Tab');
assert.ok(approvalIndexContent.includes('receipt'), '❌ 审批中心缺少收款审批业务 Tab');
assert.ok(approvalIndexContent.includes('transfer'), '❌ 审批中心缺少异动审批业务 Tab');
assert.ok(approvalIndexContent.includes('sub-status-bar'), '❌ 审批中心缺少待我审批/我发起的/已处理分栏');
assert.ok(approvalIndexContent.includes('handleApprove'), '❌ 审批中心缺少快速审批通过交互');
assert.ok(approvalIndexContent.includes('handleReject'), '❌ 审批中心缺少快速审批驳回交互');
console.log('✔ 审批中心页 (退费/收款/异动 3大Tab与2级分栏) 契约校验通过');

// 6. 验证审批详情与时间线 (package-finance/approval/detail.vue)
const approvalDetailPage = path.resolve(__dirname, '../mini-program/src/package-finance/approval/detail.vue');
const approvalDetailContent = fs.readFileSync(approvalDetailPage, 'utf8');

assert.ok(approvalDetailContent.includes('timeline-container'), '❌ 审批详情缺少时间线流转组件');
assert.ok(approvalDetailContent.includes('timeline-dot'), '❌ 审批详情缺少时间线节点指示点');
assert.ok(approvalDetailContent.includes('fixed-audit-bar'), '❌ 审批详情缺少底部固定审批操作栏');
assert.ok(approvalDetailContent.includes('handleApproveAction'), '❌ 审批详情缺少同意通过交互');
assert.ok(approvalDetailContent.includes('handleRejectAction'), '❌ 审批详情缺少驳回交互');
console.log('✔ 审批详情页 (多级流转时间线/审核操作栏) 契约校验通过');

console.log('======================================================');
console.log('🎉 阶段四：财务收支与审批流全契约自动化测试全部通过！');
console.log('======================================================');
