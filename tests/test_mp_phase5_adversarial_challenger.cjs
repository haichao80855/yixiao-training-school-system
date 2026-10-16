/**
 * Phase 5 移动端数学转换引擎、图表生成与数据归一化 对抗性实证测试套件
 * 
 * 专门针对：
 * 1. utils/chart.ts 极值、边界、退化几何图形与除以零保护
 * 2. SVG Data-URI 格式、# 转义为 %23、XML 结构合法性
 * 3. api/stats.ts 4 角色 Normalizer 的 null/undefined/畸形载荷防穿透与 0 值保留
 * 4. api/workbench.ts 8/8 极值边界、非空防线与去重状态机
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

console.log('================================================================================');
console.log('🛡️  Challenger Phase 5 — 数学转换引擎、图表生成与数据归一化 对抗性实证测试');
console.log('================================================================================\n');

let passCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
    throw err;
  }
}

// 模拟小程序的 uni/wx 运行时环境
const storage = {};
global.Page = function() {};
global.Component = function() {};
global.App = function() {};
global.getCurrentPages = function() { return []; };
global.getApp = function() { return {}; };
global.wx = global.uni = {
  getSystemInfoSync: () => ({ statusBarHeight: 20 }),
  getStorageSync: (k) => storage[k] || '',
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: (k) => { delete storage[k]; },
  showToast: () => {},
  request: () => {}
};

// 加载构建后的 utils/chart.js 与 api/stats.js
const miniProgRoot = path.resolve(__dirname, '../mini-program');
const chartModule = require(path.resolve(miniProgRoot, 'dist/build/mp-weixin/utils/chart.js'));
const statsModule = require(path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/stats.js'));
const workbenchDist = require(path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/workbench.js'));

// 另行加载源码 TS (避免生产打包 tree-shaking 影响对未被视图直接引用的公共工具函数的白盒验证)
const chartTsSource = fs.readFileSync(path.resolve(miniProgRoot, 'src/utils/chart.ts'), 'utf8');
const transpiledChart = ts.transpileModule(chartTsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const rawChartObj = {};
new Function('exports', 'require', transpiledChart)(rawChartObj, require);
const escapeSvgColor = rawChartObj.escapeSvgColor;

const wbTsSource = fs.readFileSync(path.resolve(miniProgRoot, 'src/api/workbench.ts'), 'utf8');
const transpiledWb = ts.transpileModule(wbTsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const workbenchModule = {};
new Function('exports', 'require', transpiledWb)(workbenchModule, require);

// -----------------------------------------------------------------------------
// 【DIMENSION 1】SVG Data-URI 生成与颜色转义对抗测试
// -----------------------------------------------------------------------------
console.log('----------------------------------------------------------------');
console.log('【维度 1】SVG Data-URI 转义与 XML 结构合法性校验');
console.log('----------------------------------------------------------------');

runTest('1.1 escapeSvgColor 对 # 转义与非法/边界色彩字符串保护', () => {
  assert.strictEqual(escapeSvgColor('#2F54EB'), '%232F54EB', 'Hex 色彩未转义 #');
  assert.strictEqual(escapeSvgColor('#FFF'), '%23FFF', '短 Hex 色彩未转义 #');
  assert.strictEqual(escapeSvgColor('rgba(47, 84, 235, 0.12)'), 'rgba(47, 84, 235, 0.12)', 'rgba 颜色被意外篡改');
  assert.strictEqual(escapeSvgColor(''), '', '空字符串未返回空');
  assert.strictEqual(escapeSvgColor(null), '', 'null 未安全返回空');
  assert.strictEqual(escapeSvgColor(undefined), '', 'undefined 未安全返回空');
  assert.strictEqual(escapeSvgColor('#123 #456'), '%23123 %23456', '多 # 字符串应全量转义');
});

runTest('1.2 矢量折线图与环形图 Data-URI 格式与零未转义 # 字符断言', () => {
  const lineRes = chartModule.transformLineSeries([
    { label: 'A', value: 100 },
    { label: 'B', value: 200 }
  ], { color: '#2F54EB', fillColor: 'rgba(47, 84, 235, 0.12)' });

  assert.ok(lineRes.svgDataUri.startsWith('data:image/svg+xml;utf8,'), 'Data-URI 前缀不符合规范');
  assert.strictEqual(lineRes.svgDataUri.includes('#'), false, 'Data-URI 中包含未转义的 # 字符');

  // 解码验证内部 XML
  const rawXml = decodeURIComponent(lineRes.svgDataUri.replace('data:image/svg+xml;utf8,', ''));
  assert.ok(rawXml.startsWith('<svg') && rawXml.endsWith('</svg>'), '解码后不是合法的 SVG 根元素');
  assert.ok(rawXml.includes('viewBox="0 0 340 180"'), 'SVG 缺少标准 viewBox');

  const donutRes = chartModule.transformDonutSlices([
    { label: '一', value: 50, color: '#13C2C2' },
    { label: '二', value: 50, color: '#FF4D4F' }
  ]);
  assert.ok(donutRes.svgDataUri.startsWith('data:image/svg+xml;utf8,'), 'Donut Data-URI 前缀不合法');
  assert.strictEqual(donutRes.svgDataUri.includes('#'), false, 'Donut Data-URI 存在未转义 #');
  const donutXml = decodeURIComponent(donutRes.svgDataUri.replace('data:image/svg+xml;utf8,', ''));
  assert.ok(donutXml.includes('<svg') && donutXml.includes('</svg>'), 'Donut SVG 结构不合法');
});

// -----------------------------------------------------------------------------
// 【DIMENSION 2】折线图 transformLineSeries 极值与除以零场景对抗测试
// -----------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【维度 2】折线图 transformLineSeries 极值与退化边界对抗测试');
console.log('----------------------------------------------------------------');

runTest('2.1 空数组、null 与 undefined 输入不崩溃且生成占位 SVG', () => {
  [null, undefined, []].forEach((emptyInput) => {
    const res = chartModule.transformLineSeries(emptyInput);
    assert.strictEqual(res.points.length, 0, '空数据 points 应为空数组');
    assert.strictEqual(res.pathD, '', '空数据 pathD 应为空');
    assert.strictEqual(res.areaPathD, '', '空数据 areaPathD 应为空');
    assert.strictEqual(res.min, 0);
    assert.strictEqual(res.max, 100);
    assert.ok(res.svgDataUri.includes('data:image/svg+xml'), '空数据仍应产出底线占位 SVG');
  });
});

runTest('2.2 单点极值 (series.length = 1) 避免 (N-1) 除以零与路径退化', () => {
  const single = chartModule.transformLineSeries([{ label: '唯一节点', value: 88 }]);
  assert.strictEqual(single.points.length, 1);
  assert.strictEqual(Number.isFinite(single.points[0].x), true, 'x 坐标必须为有限数');
  assert.strictEqual(Number.isFinite(single.points[0].y), true, 'y 坐标必须为有限数');
  assert.ok(single.pathD.startsWith('M') && single.pathD.includes('L'), '单点应退化绘制横向指示线');
  assert.strictEqual(single.pathD.includes('NaN'), false, 'pathD 不能包含 NaN');
  assert.strictEqual(single.areaPathD.includes('NaN'), false, 'areaPathD 不能包含 NaN');
});

runTest('2.3 全零数据与恒等数据 (min === max) 避免 range 除以零', () => {
  // 全零
  const allZeros = chartModule.transformLineSeries([
    { label: '01', value: 0 },
    { label: '02', value: 0 },
    { label: '03', value: 0 },
  ]);
  assert.strictEqual(allZeros.min, 0);
  assert.strictEqual(allZeros.max > 0, true, '全零时 max 应被自动垫高防止除以零');
  allZeros.points.forEach((p) => {
    assert.strictEqual(Number.isFinite(p.y), true, '坐标 y 必须为有限数字');
    assert.strictEqual(isNaN(p.y), false, '坐标 y 不能为 NaN');
  });
  assert.strictEqual(allZeros.pathD.includes('NaN'), false);

  // 全相等非零
  const allTens = chartModule.transformLineSeries([
    { label: '01', value: 50 },
    { label: '02', value: 50 },
  ]);
  assert.strictEqual(allTens.max > allTens.min, true, '恒等数据 range 必须大于 0');
  allTens.points.forEach((p) => {
    assert.strictEqual(Number.isFinite(p.y), true);
  });
});

runTest('2.4 负数、畸形非数值 (NaN/null/undefined/字符串) 数据防护', () => {
  const dirtyData = [
    { label: '正常', value: 20 },
    { label: '负数', value: -10 },
    { label: '非法字符串', value: 'invalid_number' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'NaN', value: NaN },
    { label: 'Infinity', value: Infinity },
  ];

  const res = chartModule.transformLineSeries(dirtyData);
  assert.strictEqual(res.points.length, dirtyData.length);
  res.points.forEach((p, idx) => {
    assert.strictEqual(Number.isFinite(p.x), true, `Index ${idx} x 坐标非有限数`);
    assert.strictEqual(Number.isFinite(p.y), true, `Index ${idx} y 坐标非有限数`);
    assert.strictEqual(isNaN(p.value), false, `Index ${idx} value 不能为 NaN`);
  });
  assert.strictEqual(res.pathD.includes('NaN'), false, 'pathD 包含 NaN');
  assert.strictEqual(res.svgDataUri.includes('NaN'), false, 'SVG 包含 NaN');
});

// -----------------------------------------------------------------------------
// 【DIMENSION 3】环形图 transformDonutSlices 极坐标与双半圆退化断言
// -----------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【维度 3】环形图 transformDonutSlices 极坐标与圆弧计算对抗测试');
console.log('----------------------------------------------------------------');

runTest('3.1 全零总和与负数切片避免 total=0 除以零，优雅退化为灰环', () => {
  const zeroDonut = chartModule.transformDonutSlices([
    { label: '项目A', value: 0 },
    { label: '项目B', value: -10 },
    { label: '项目C', value: 0 },
  ]);

  assert.strictEqual(zeroDonut.total, 0, '总额应为 0');
  zeroDonut.slices.forEach((s) => {
    assert.strictEqual(s.percentage, 0, '百分比应为 0');
    assert.strictEqual(s.formattedPercent, '0.0%');
    assert.strictEqual(s.pathD, '', '全零切片 pathD 应为空');
  });

  const xml = decodeURIComponent(zeroDonut.svgDataUri.replace('data:image/svg+xml;utf8,', ''));
  assert.ok(xml.includes('<circle'), '全零应生成底环 circle');
  assert.strictEqual(xml.includes('NaN'), false, '不能包含 NaN');
});

runTest('3.2 单一切片 100% 占比双半圆拼接完整环形 (避免起终点重合退化)', () => {
  const singleDonut = chartModule.transformDonutSlices([
    { label: '独占100%', value: 300, color: '#2F54EB' },
  ]);

  assert.strictEqual(singleDonut.total, 300);
  assert.strictEqual(singleDonut.slices[0].percentage, 100);
  assert.strictEqual(singleDonut.slices[0].formattedPercent, '100.0%');

  // 100% 环形必须包含双 A 弧指令以形成闭合圆环
  const pathD = singleDonut.slices[0].pathD;
  const aMatches = pathD.match(/ A /g) || [];
  assert.strictEqual(aMatches.length, 4, '双半圆外环+内环需包含 4 个 A 指令');
  assert.strictEqual(pathD.includes('NaN'), false, 'pathD 不能有 NaN');
});

runTest('3.3 多切片占比求和与零值切片穿透过滤', () => {
  const multiDonut = chartModule.transformDonutSlices([
    { label: 'A', value: 20 },
    { label: 'B', value: 0 },
    { label: 'C', value: 80 },
  ]);

  assert.strictEqual(multiDonut.total, 100);
  assert.strictEqual(multiDonut.slices[0].percentage, 20);
  assert.strictEqual(multiDonut.slices[1].percentage, 0);
  assert.strictEqual(multiDonut.slices[1].pathD, '', '0值切片不绘制 path');
  assert.strictEqual(multiDonut.slices[2].percentage, 80);

  const xml = decodeURIComponent(multiDonut.svgDataUri.replace('data:image/svg+xml;utf8,', ''));
  const pathCount = (xml.match(/<path /g) || []).length;
  assert.strictEqual(pathCount, 2, '仅有有效切片生成 <path>');
});

// -----------------------------------------------------------------------------
// 【DIMENSION 4】漏斗图与柱状图极端值与除以零测试
// -----------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【维度 4】漏斗图 transformFunnelSteps 与柱状图 transformBarSeries 对抗测试');
console.log('----------------------------------------------------------------');

runTest('4.1 漏斗图全零数据与前项为零转化率除以零保护', () => {
  const zerosFunnel = chartModule.transformFunnelSteps([
    { step: '阶段1', value: 0 },
    { step: '阶段2', value: 0 },
    { step: '阶段3', value: 10 },
  ]);

  assert.strictEqual(zerosFunnel.maxVal, 10);
  assert.strictEqual(zerosFunnel.steps[0].conversionRate, '100.0%');
  assert.strictEqual(zerosFunnel.steps[1].conversionRate, '0.0%', '前项为0时转化率应安全为0.0%而非Infinity');
  assert.strictEqual(zerosFunnel.steps[0].widthPct, 12, '保底最小宽度 12%');
});

runTest('4.2 柱状图空数据与全零高度百分比保底', () => {
  assert.strictEqual(chartModule.transformBarSeries(null).items.length, 0);
  assert.strictEqual(chartModule.transformBarSeries([]).items.length, 0);

  const zeroBar = chartModule.transformBarSeries([
    { label: '一', value: 0 },
    { label: '二', value: 0 },
  ]);
  assert.strictEqual(zeroBar.maxVal, 1);
  zeroBar.items.forEach((item) => {
    assert.strictEqual(item.heightPct, 4, '零值柱状图必须具备 4% 保底可见高度');
  });
});

// -----------------------------------------------------------------------------
// 【DIMENSION 5】api/stats.ts 4 角色 Normalizer 健壮性与 0 值保留测试
// -----------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【维度 5】api/stats.ts 4 角色 Normalizer 数据防穿透对抗测试');
console.log('----------------------------------------------------------------');

runTest('5.1 normalizeDashboardOverview 应对 null/undefined/空对象及 0 值保留', () => {
  const fromNull = statsModule.normalizeDashboardOverview(null, 'campus-01', '10月');
  assert.strictEqual(fromNull.campusId, 'campus-01');
  assert.strictEqual(fromNull.period, '10月');
  assert.strictEqual(typeof fromNull.lessonConsumptionAmount, 'number');
  assert.strictEqual(Number.isFinite(fromNull.lessonConsumptionAmount), true);
  assert.ok(Array.isArray(fromNull.consumptionTrend) && fromNull.consumptionTrend.length > 0);

  // 关键实证：真实 0 值必须被保留，不能被 ?? 缺省值意外覆盖！
  const zeroPayload = {
    lessonConsumptionAmount: 0,
    lessonConsumptionCount: 0,
    advanceReceiptAmount: 0,
    consumptionTrend: [],
  };
  const fromZero = statsModule.normalizeDashboardOverview(zeroPayload);
  assert.strictEqual(fromZero.lessonConsumptionAmount, 0, '真实 0 课耗金额被错误覆写为默认值');
  assert.strictEqual(fromZero.lessonConsumptionCount, 0, '真实 0 课耗数量被错误覆写');
  assert.strictEqual(fromZero.advanceReceiptAmount, 0, '真实 0 预收金额被错误覆写');
});

runTest('5.2 normalizeEduStats、FinanceStats、SalesStats 健壮性断言', () => {
  const edu = statsModule.normalizeEduStats(null);
  assert.strictEqual(typeof edu.registeredTotal, 'number');
  assert.ok(edu.studentBreakdown.regular > 0);

  const finance = statsModule.normalizeFinanceStats(null);
  assert.strictEqual(typeof finance.advanceTotalAmount, 'number');
  assert.strictEqual(typeof finance.confirmedRevenue, 'number');
  assert.ok(Array.isArray(finance.advanceSlices) && finance.advanceSlices.length >= 3);
  assert.ok(Array.isArray(finance.refundSlices) && finance.refundSlices.length >= 3);

  const sales = statsModule.normalizeSalesStats(null);
  assert.strictEqual(typeof sales.leadsTotal, 'number');
  assert.strictEqual(typeof sales.achievedRevenue, 'number');
  assert.ok(Array.isArray(sales.conversionFunnel) && sales.conversionFunnel.length >= 4);
});

// -----------------------------------------------------------------------------
// 【DIMENSION 6】api/workbench.ts 8/8 极值边界与持久化对抗测试
// -----------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【维度 6】api/workbench.ts 自定序边界与去重状态机对抗测试');
console.log('----------------------------------------------------------------');

runTest('6.1 常用功能边界：清空拦截 (不能 < 1) 与超限拦截 (不能 > 8)', () => {
  // 1. 测试清空拦截
  const emptyRes = workbenchModule.saveUserQuickActions([]);
  assert.strictEqual(emptyRes.success, false, '清空列表应返回失败');
  assert.ok(emptyRes.message.includes('1'), '应提示至少保留1个');

  // 2. 测试超限拦截 (>8)
  const nineItems = [
    { id: '1', name: '1', icon: '', bg: '', path: '', category: 'edu' },
    { id: '2', name: '2', icon: '', bg: '', path: '', category: 'edu' },
    { id: '3', name: '3', icon: '', bg: '', path: '', category: 'edu' },
    { id: '4', name: '4', icon: '', bg: '', path: '', category: 'edu' },
    { id: '5', name: '5', icon: '', bg: '', path: '', category: 'edu' },
    { id: '6', name: '6', icon: '', bg: '', path: '', category: 'edu' },
    { id: '7', name: '7', icon: '', bg: '', path: '', category: 'edu' },
    { id: '8', name: '8', icon: '', bg: '', path: '', category: 'edu' },
    { id: '9', name: '9', icon: '', bg: '', path: '', category: 'edu' },
  ];
  const overRes = workbenchModule.saveUserQuickActions(nineItems);
  assert.strictEqual(overRes.success, false, '9 项输入应被拒绝');
  assert.ok(overRes.message.includes('8'), '应提示最多8个');

  // 3. 测试重复 ID 拦截
  const dupItems = [
    { id: 'dup', name: 'A', icon: '', bg: '', path: '', category: 'edu' },
    { id: 'dup', name: 'B', icon: '', bg: '', path: '', category: 'edu' },
  ];
  const dupRes = workbenchModule.saveUserQuickActions(dupItems);
  assert.strictEqual(dupRes.success, false, '重复项应被拦截');
});

runTest('6.2 排序与持久化存取一致性断言', () => {
  const defaults = workbenchModule.getDefaultQuickActions();
  assert.strictEqual(defaults.length, 8, '默认快捷功能必须严格对齐 8 宫格');

  // 模拟持久化
  const saveRes = workbenchModule.saveUserQuickActions(defaults);
  assert.strictEqual(saveRes.success, true);
  const loaded = workbenchModule.getUserQuickActions();
  assert.strictEqual(loaded.length, 8);
  assert.strictEqual(loaded[0].id, defaults[0].id);

  // 模拟重排第一项和第二项
  const reordered = workbenchModule.reorderQuickActions(0, 1);
  assert.strictEqual(reordered[0].id, defaults[1].id, '重排后第 1 项应为原第 2 项');
  assert.strictEqual(reordered[1].id, defaults[0].id, '重排后第 2 项应为原第 1 项');
});

console.log('\n================================================================================');
console.log(`🎉 阶段五对抗性实证挑战套件全部通过！${passCount}/${totalCount} 项挑战断言 100% 验证成功！`);
console.log('================================================================================\n');
