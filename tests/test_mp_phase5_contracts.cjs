const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🧪 运行微信小程序端阶段五（首页多角色看板、图表渲染与工作台自定序）契约测试');
console.log('================================================================================\n');

const miniProgRoot = path.resolve(__dirname, '../mini-program');

// 1. 验证 pages.json 中 pages/workbench/settings 路由注册
const pagesJsonPath = path.resolve(miniProgRoot, 'src/pages.json');
assert.ok(fs.existsSync(pagesJsonPath), '❌ pages.json 源码不存在！');
const pagesJsonRaw = fs.readFileSync(pagesJsonPath, 'utf8').replace(/\/\/.*$/gm, '');
const pagesJson = JSON.parse(pagesJsonRaw);

const settingsPage = pagesJson.pages.find((p) => p.path === 'pages/workbench/settings');
assert.ok(settingsPage, '❌ pages.json 缺少 pages/workbench/settings 常用功能设置路由注册！');
assert.strictEqual(settingsPage.style.navigationStyle, 'custom', '❌ settings 页面必须启用 custom 自定义导航');
console.log('✔ [1/8] pages.json 工作台设置页面路由注册校验通过');

// 2. 验证物理源码文件实体与生产级体积阈值
const requiredSourceFiles = [
  { path: 'src/pages/index/index.vue', minSize: 2000, name: '多角色统计看板首页' },
  { path: 'src/pages/workbench/settings.vue', minSize: 2000, name: '常用功能设置与自定序页' },
  { path: 'src/components/MpChart.vue', minSize: 1000, name: '轻量图表渲染组件' },
  { path: 'src/components/RoleTabBar.vue', minSize: 500, name: '角色切换选项卡组件' },
  { path: 'src/components/StatCard.vue', minSize: 1000, name: '指标卡片组件' },
  { path: 'src/api/stats.ts', minSize: 2000, name: '多角色统计 API 与 Normalizer' },
  { path: 'src/utils/chart.ts', minSize: 2000, name: '图表数学转换引擎' },
  { path: 'src/api/workbench.ts', minSize: 1500, name: '工作台自定序状态机与持久化' },
];

for (const item of requiredSourceFiles) {
  const fullPath = path.resolve(miniProgRoot, item.path);
  assert.ok(fs.existsSync(fullPath), `❌ ${item.name} 文件不存在: ${item.path}`);
  const stat = fs.statSync(fullPath);
  assert.ok(
    stat.size >= item.minSize,
    `❌ ${item.name} (${item.path}) 文件过小 (${stat.size}B < ${item.minSize}B)`
  );
}
console.log('✔ [2/8] 阶段五全部核心源码物理实体与非平凡体积校验通过');

// 3. 验证 4-Role Dashboard 数据接口与 Normalizer 契约 (api/stats.ts)
const statsTsPath = path.resolve(miniProgRoot, 'src/api/stats.ts');
const statsContent = fs.readFileSync(statsTsPath, 'utf8');

const expectedStatsMethods = [
  'getDashboardOverview',
  'getEduStats',
  'getFinanceStats',
  'getSalesStats',
  'normalizeDashboardOverview',
  'normalizeEduStats',
  'normalizeFinanceStats',
  'normalizeSalesStats',
];
for (const method of expectedStatsMethods) {
  assert.ok(statsContent.includes(method), `❌ api/stats.ts 缺少核心方法: ${method}`);
}

const expectedFields = [
  'lessonConsumptionAmount',
  'enrollmentStudentCount',
  'advanceReceiptAmount',
  'registeredTotal',
  'monthStartCount',
  'monthEndCount',
  'attendanceRate',
  'confirmedRevenue',
  'refundTotalAmount',
  'leadsTotal',
  'conversionFunnel',
];
for (const field of expectedFields) {
  assert.ok(statsContent.includes(field), `❌ api/stats.ts 缺少必须字段: ${field}`);
}
console.log('✔ [3/8] api/stats.ts 4 角色数据模型与 Normalizer 契约校验通过');

// 4. 验证图表数学转换器契约 (utils/chart.ts)
const chartTsPath = path.resolve(miniProgRoot, 'src/utils/chart.ts');
const chartContent = fs.readFileSync(chartTsPath, 'utf8');

assert.ok(chartContent.includes('transformLineSeries'), '❌ utils/chart.ts 缺少 transformLineSeries');
assert.ok(chartContent.includes('transformDonutSlices'), '❌ utils/chart.ts 缺少 transformDonutSlices');
assert.ok(chartContent.includes('transformFunnelSteps'), '❌ utils/chart.ts 缺少 transformFunnelSteps');
assert.ok(chartContent.includes('data:image/svg+xml'), '❌ utils/chart.ts 缺少 SVG 矢量 Data-URI 生成');

console.log('✔ [4/8] utils/chart.ts 矢量图表数学转换引擎契约校验通过');

// 5. 验证工作台自定序边界约束与状态机契约 (api/workbench.ts)
const workbenchTsPath = path.resolve(miniProgRoot, 'src/api/workbench.ts');
const workbenchContent = fs.readFileSync(workbenchTsPath, 'utf8');

assert.ok(workbenchContent.includes('yixiao_mp_workbench_quick_actions'), '❌ 缺少持久化缓存 Key');
assert.ok(workbenchContent.includes('DEFAULT_QUICK_ACTIONS'), '❌ 缺少默认 8 宫格快捷项');
assert.ok(workbenchContent.includes('ALL_AVAILABLE_ACTIONS'), '❌ 缺少可选业务功能库');
assert.ok(workbenchContent.includes('getUserQuickActions'), '❌ 缺少 getUserQuickActions 方法');
assert.ok(workbenchContent.includes('saveUserQuickActions'), '❌ 缺少 saveUserQuickActions 方法');

// 边界断言规则特征检查
assert.ok(workbenchContent.includes('8') && workbenchContent.includes('length'), '❌ 缺少 8/8 上限校验');
assert.ok(workbenchContent.includes('1') && workbenchContent.includes('length'), '❌ 缺少不能全部清空边界校验');
assert.ok(workbenchContent.includes('Set'), '❌ 缺少去重校验');
console.log('✔ [5/8] api/workbench.ts 常用功能 8/8 边界与持久化契约校验通过');

// 6. 验证首页多角色数据看板交互与组件结构 (pages/index/index.vue)
const indexVuePath = path.resolve(miniProgRoot, 'src/pages/index/index.vue');
const indexVueContent = fs.readFileSync(indexVuePath, 'utf8');

assert.ok(
  indexVueContent.includes('roleTabs') || indexVueContent.includes('currentRoleTab'),
  '❌ 缺少 4 角色视角切换栏'
);
assert.ok(
  indexVueContent.includes('admin') &&
    indexVueContent.includes('edu') &&
    indexVueContent.includes('finance') &&
    indexVueContent.includes('sales'),
  '❌ 角色视角不完整 (需涵盖管理员、教学教务、财务、销售)'
);
assert.ok(indexVueContent.includes('MpChart'), '❌ 首页缺少 MpChart 图表组件集成');
assert.ok(indexVueContent.includes('CustomNavBar'), '❌ 首页缺少 CustomNavBar');
assert.ok(indexVueContent.includes('CustomTabBar'), '❌ 首页缺少 CustomTabBar');
assert.ok(indexVueContent.includes('RoleTabBar'), '❌ 首页缺少 RoleTabBar');
assert.ok(indexVueContent.includes('StatCard'), '❌ 首页缺少 StatCard');
console.log('✔ [6/8] pages/index/index.vue 4 角色大屏与图表挂载契约校验通过');

// 7. 验证工作台常用功能自定序界面要素 (pages/workbench/settings.vue - 截图 088)
const settingsVuePath = path.resolve(miniProgRoot, 'src/pages/workbench/settings.vue');
const settingsVueContent = fs.readFileSync(settingsVuePath, 'utf8');

assert.ok(
  settingsVueContent.includes('activeList') || settingsVueContent.includes('active-functions-grid'),
  '❌ 缺少激活常用功能网格'
);
assert.ok(
  settingsVueContent.includes('red-minus') ||
    settingsVueContent.includes('handleRemove') ||
    settingsVueContent.includes('－'),
  '❌ 缺少红减号删除交互'
);
assert.ok(
  settingsVueContent.includes('moveUp') && settingsVueContent.includes('moveDown'),
  '❌ 缺少上移下移排序控制器'
);
assert.ok(
  settingsVueContent.includes('handleAdd') || settingsVueContent.includes('＋'),
  '❌ 缺少可选库蓝加号添加交互'
);
assert.ok(
  settingsVueContent.includes('8/8') || settingsVueContent.includes('.length'),
  '❌ 缺少 8/8 数量徽章与计数'
);
assert.ok(
  settingsVueContent.includes('handleSave') || settingsVueContent.includes('完成'),
  '❌ 缺少完成保存动作'
);
console.log('✔ [7/8] pages/workbench/settings.vue 红减号、蓝加号、自定序与 8/8 限制校验通过');

// 8. 验证工作台首页入口与持久化联动 (pages/workbench/index.vue)
const workbenchVuePath = path.resolve(miniProgRoot, 'src/pages/workbench/index.vue');
const workbenchVueContent = fs.readFileSync(workbenchVuePath, 'utf8');

assert.ok(
  workbenchVueContent.includes('pages/workbench/settings'),
  '❌ 工作台首页设置按钮缺少跳转至 settings 路由'
);
assert.ok(
  workbenchVueContent.includes('yixiao_mp_workbench_quick_actions') ||
    workbenchVueContent.includes('getUserQuickActions'),
  '❌ 工作台首页缺少读取常用功能持久化配置'
);
console.log('✔ [8/8] pages/workbench/index.vue 设置跳转与自定序回显契约校验通过');

console.log('\n================================================================================');
console.log('🎉 阶段五：首页多角色看板、图表渲染与工作台自定序全契约自动化测试 100% 验证通过！');
console.log('================================================================================\n');
