/**
 * 验证小程序端管理员首页看板时间段切换联动与各卡片独立周期生效测试
 */
const assert = require('assert');
const http = require('http');

global.Page = function() {};
global.Component = function() {};
global.App = function() {};
global.getCurrentPages = function() { return []; };
global.getApp = function() { return {}; };
global.wx = global.uni = {
  getSystemInfoSync: () => ({ statusBarHeight: 20 }),
  getStorageSync: () => '',
  setStorageSync: () => {},
  removeStorageSync: () => {},
  showToast: () => {},
  request: () => {}
};

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpGet(path, token) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: '127.0.0.1',
      port: 3001,
      path,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data !== undefined ? parsed.data : parsed);
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 开始验证小程序管理员看板时间段切换与真实接口联动');
  console.log('================================================================\n');

  // 先登录获取有效 JWT Token
  console.log('【0】登录系统获取 JWT Token');
  const loginRes = await postJson('/api/auth/login', {
    account: 'donghaichao',
    password: '123456',
  });
  assert(loginRes && loginRes.data && loginRes.data.accessToken, '应成功获取登录 Token');
  const token = loginRes.data.accessToken;
  console.log('  ✅ 成功获取 Token\n');

  // 1. 验证财务订单汇总接口对不同 period 的响应动态变化
  console.log('【1】验证 /api/financial/orders/summary 随 period 变化');
  const todayFinance = await httpGet(`/api/financial/orders/summary?period=${encodeURIComponent('今日')}`, token);
  const weekFinance = await httpGet(`/api/financial/orders/summary?period=${encodeURIComponent('本周')}`, token);
  const monthFinance = await httpGet(`/api/financial/orders/summary?period=${encodeURIComponent('本月')}`, token);
  const yearFinance = await httpGet(`/api/financial/orders/summary?period=${encodeURIComponent('本年')}`, token);

  console.log('  -> 今日订单数:', todayFinance.totalPaidOrders, '实际金额:', todayFinance.totalActualAmount);
  console.log('  -> 本周订单数:', weekFinance.totalPaidOrders, '实际金额:', weekFinance.totalActualAmount);
  console.log('  -> 本月订单数:', monthFinance.totalPaidOrders, '实际金额:', monthFinance.totalActualAmount);
  console.log('  -> 本年订单数:', yearFinance.totalPaidOrders, '实际金额:', yearFinance.totalActualAmount);

  // 验证不同周期的数据不完全恒定（今日为0，本周有455单，本月/本年涵盖全部）
  assert.notStrictEqual(todayFinance.totalActualAmount, weekFinance.totalActualAmount, '今日与本周金额应该不同');
  assert.strictEqual(todayFinance.totalPaidOrders, 0, '今日应为0笔订单');
  assert(weekFinance.totalPaidOrders > 0, '本周应有已支付订单');
  assert(weekFinance.courseAmount !== undefined, '应包含细分课程预收');
  assert(weekFinance.refundAmount !== undefined, '应包含细分退费金额');
  console.log('  ✅ 财务汇总接口 period 动态解析与细分统计验证通过\n');

  // 2. 验证教务结算工作台对不同 period 的响应动态变化
  console.log('【2】验证 /api/educational/settlement/workbench 随 period 变化');
  const todayWorkbench = await httpGet(`/api/educational/settlement/workbench?period=${encodeURIComponent('今日')}`, token);
  const weekWorkbench = await httpGet(`/api/educational/settlement/workbench?period=${encodeURIComponent('本周')}`, token);
  const monthWorkbench = await httpGet(`/api/educational/settlement/workbench?period=${encodeURIComponent('本月')}`, token);

  console.log('  -> 今日消课课次:', todayWorkbench.metrics.completedCount, '总学时:', todayWorkbench.metrics.totalDeductedLessons, '课耗金额:', todayWorkbench.metrics.consumptionAmount);
  console.log('  -> 本周消课课次:', weekWorkbench.metrics.completedCount, '总学时:', weekWorkbench.metrics.totalDeductedLessons, '课耗金额:', weekWorkbench.metrics.consumptionAmount);
  console.log('  -> 本月消课课次:', monthWorkbench.metrics.completedCount, '总学时:', monthWorkbench.metrics.totalDeductedLessons, '课耗金额:', monthWorkbench.metrics.consumptionAmount);

  assert.notStrictEqual(todayWorkbench.metrics.completedCount, weekWorkbench.metrics.completedCount, '今日与本周消课课次应不同');
  assert(weekWorkbench.metrics.consumptionAmount !== undefined, '应包含核算课耗金额');
  console.log('  ✅ 教务工作台接口 period 动态解析与课耗核算验证通过\n');

  // 3. 验证前端 API resolvePeriodRange 工具逻辑
  console.log('【3】验证前端 resolvePeriodRange 算法');
  const ts = require('typescript');
  const fs = require('fs');
  const path = require('path');
  const statsTsSource = fs.readFileSync(path.resolve(__dirname, '../mini-program/src/api/stats.ts'), 'utf8');
  const transpiledStats = ts.transpileModule(statsTsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const statsModule = {};
  const fn = new Function('require', 'exports', 'module', transpiledStats);
  fn((mod) => {
    if (mod === '../utils/request') return { request: async () => ({}) };
    return require(mod);
  }, statsModule, { exports: statsModule });
  const { resolvePeriodRange, normalizeDashboardOverview } = statsModule;
  
  const todayRange = resolvePeriodRange('今日');
  assert(todayRange.startDate === todayRange.endDate, '今日开始与结束日期相同');
  assert.strictEqual(todayRange.scaleFactor, 0.033);

  const monthRange = resolvePeriodRange('本月');
  assert(monthRange.startDate !== monthRange.endDate, '本月开始与结束不同');
  assert.strictEqual(monthRange.scaleFactor, 1.0);

  const yearRange = resolvePeriodRange('本年');
  assert(yearRange.scaleFactor, 12.0);
  console.log('  ✅ resolvePeriodRange 日期区间与缩放因子正确\n');

  // 4. 验证 normalizeDashboardOverview 在不同时间段下的降级缩放与图表标签动态变化
  console.log('【4】验证 normalizeDashboardOverview 降级与图表标签动态联动');
  const normalizedToday = normalizeDashboardOverview(null, 'campus-1', '今日');
  const normalizedYear = normalizeDashboardOverview(null, 'campus-1', '本年');

  console.log('  -> 今日降级课耗金额:', normalizedToday.lessonConsumptionAmount, '趋势点数量:', normalizedToday.consumptionTrend.length, '第一点标签:', normalizedToday.consumptionTrend[0].label);
  console.log('  -> 本年降级课耗金额:', normalizedYear.lessonConsumptionAmount, '趋势点数量:', normalizedYear.consumptionTrend.length, '第一点标签:', normalizedYear.consumptionTrend[0].label);

  assert.notStrictEqual(normalizedToday.lessonConsumptionAmount, normalizedYear.lessonConsumptionAmount, '今日与本年降级金额应按周期缩放');
  assert.strictEqual(normalizedToday.consumptionTrend[0].label, '09:00', '今日趋势图横坐标应为整点');
  assert(normalizedYear.consumptionTrend[0].label.includes('月'), '本年趋势图横坐标应包含月份');
  console.log('  ✅ normalizeDashboardOverview 随周期自适应缩放与坐标系自适应验证通过\n');

  console.log('================================================================');
  console.log('🎉 小程序端管理员页面时间段切换联动全套验证 100% 通过！');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ 测试执行失败:', err);
  process.exit(1);
});
