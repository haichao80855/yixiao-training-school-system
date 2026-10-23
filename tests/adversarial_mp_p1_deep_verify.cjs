const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🔬 对抗挑战独立深层断言套件 — Phase 1 契约断言与产物校验');
console.log('================================================================================\n');

const repoRoot = path.resolve(__dirname, '..');
const distAppJsonPath = path.resolve(repoRoot, 'mini-program/dist/build/mp-weixin/app.json');
const srcDir = path.resolve(repoRoot, 'mini-program/src');

const report = {
  mainPages: false,
  subPackages: false,
  preloadRule: false,
  tabBar: false,
  vueSfcSizes: false,
  details: {}
};

// 1. 检查 app.json 存在性与主包 6 页
assert.ok(fs.existsSync(distAppJsonPath), `app.json 产物不存在: ${distAppJsonPath}`);
const appJson = JSON.parse(fs.readFileSync(distAppJsonPath, 'utf8'));

console.log('【检查项 1】主包页面是否存在且正确');
const expectedMainPages = [
  'pages/index/index',
  'pages/workbench/index',
  'pages/workbench/settings',
  'pages/ai/index',
  'pages/todo/index',
  'pages/my/index',
  'pages/login/index'
];
const missingMainPages = expectedMainPages.filter(p => !appJson.pages.includes(p));
if (missingMainPages.length === 0 && appJson.pages.length === expectedMainPages.length) {
  report.mainPages = true;
  console.log(`  ✅ 主包 ${expectedMainPages.length} 页全部存在且与配置严格一致`);
} else {
  console.error(`  ❌ 主包页面不符合预期: missing=[${missingMainPages}], actualLength=${appJson.pages.length}`);
}

// 2. 检查 4 大业务分包
console.log('\n【检查项 2】4 大业务分包是否完整配置');
// 家长端分包 package-parent 为家长门户新增（角色分包），业务分包仍为 4 大 + 家长端
const expectedSubPkgs = ['package-edu', 'package-student', 'package-finance', 'package-crm', 'package-parent'];
const actualSubPkgs = Array.isArray(appJson.subPackages) ? appJson.subPackages.map(s => s.root) : [];
const missingSubPkgs = expectedSubPkgs.filter(pkg => !actualSubPkgs.includes(pkg));
if (missingSubPkgs.length === 0 && actualSubPkgs.length === expectedSubPkgs.length) {
  report.subPackages = true;
  console.log('  ✅ 4 大业务分包 package-edu, package-student, package-finance, package-crm 完整配置');
} else {
  console.error(`  ❌ 业务分包缺失或异常: missing=[${missingSubPkgs}], actual=[${actualSubPkgs}]`);
}

// 3. 检查 preloadRule
console.log('\n【检查项 3】preloadRule 预下载规则配置');
const preloadRule = appJson.preloadRule || {};
const workbenchRule = preloadRule['pages/workbench/index'];
const todoRule = preloadRule['pages/todo/index'];

const isWorkbenchPreloadValid = workbenchRule && 
  workbenchRule.network === 'all' && 
  Array.isArray(workbenchRule.packages) && 
  workbenchRule.packages.includes('package-edu') && 
  workbenchRule.packages.includes('package-student');

const isTodoPreloadValid = todoRule && 
  todoRule.network === 'all' && 
  Array.isArray(todoRule.packages) && 
  todoRule.packages.includes('package-finance');

if (isWorkbenchPreloadValid && isTodoPreloadValid) {
  report.preloadRule = true;
  console.log('  ✅ preloadRule 正确输出且配置了 pages/workbench/index 与 pages/todo/index');
} else {
  console.error('  ❌ preloadRule 配置不合规:');
  console.error('     workbenchRule:', workbenchRule);
  console.error('     todoRule:', todoRule);
}

// 4. 检查 tabBar 5 个 Tab 配置
console.log('\n【检查项 4】tabBar 5 个 Tab 合规配置');
if (appJson.tabBar && Array.isArray(appJson.tabBar.list)) {
  const tabList = appJson.tabBar.list.map(t => t.pagePath);
  const expectedTabs = [
    'pages/index/index',
    'pages/workbench/index',
    'pages/ai/index',
    'pages/todo/index',
    'pages/my/index'
  ];
  const missingTabs = expectedTabs.filter(t => !tabList.includes(t));
  if (missingTabs.length === 0 && tabList.length === 5) {
    report.tabBar = true;
    console.log('  ✅ app.json 中 tabBar 5 个 Tab 合规配置');
  } else {
    console.error(`  ❌ tabBar Tab 缺失或数量不符: missing=[${missingTabs}], count=${tabList.length}`);
  }
} else {
  report.tabBar = false;
  console.error('  ❌ 编译产物 app.json 中完全缺少 "tabBar" 节点！当前 appJson.tabBar = ' + appJson.tabBar);
}

// 5. 检查物理 Vue SFC 文件体积 >= 500B
console.log('\n【检查项 5】物理 Vue SFC 文件体积 >= 500B (杜绝假空文件)');
function walkVueFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.resolve(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walkVueFiles(fullPath));
    } else if (item.endsWith('.vue')) {
      results.push({
        fullPath,
        relPath: path.relative(srcDir, fullPath),
        size: stat.size
      });
    }
  }
  return results;
}

const allVueFiles = walkVueFiles(srcDir);
const substandardFiles = allVueFiles.filter(f => f.size < 500);

if (substandardFiles.length === 0) {
  report.vueSfcSizes = true;
  console.log(`  ✅ 全部 ${allVueFiles.length} 个 Vue SFC 文件体积均 >= 500B`);
} else {
  report.vueSfcSizes = false;
  console.error(`  ❌ 发现 ${substandardFiles.length} 个 Vue 文件体积小于 500B（假空占位文件）:`);
  substandardFiles.forEach(f => {
    console.error(`     - ${f.relPath}: ${f.size}B (< 500B)`);
  });
}

console.log('\n================================================================================');
console.log('📊 最终对抗检验结果汇总:');
console.log('--------------------------------------------------------------------------------');
console.log(`1. 主包 6 页校验:       ${report.mainPages ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`2. 4 大业务分包配置:    ${report.subPackages ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`3. preloadRule 预下载:   ${report.preloadRule ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`4. app.json tabBar 配置: ${report.tabBar ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`5. Vue SFC 体积 >= 500B: ${report.vueSfcSizes ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('================================================================================\n');

if (!report.mainPages || !report.subPackages || !report.preloadRule || !report.tabBar || !report.vueSfcSizes) {
  console.error('💥 结论: 实证对抗校验失败！发现关键缺陷！');
  process.exit(1);
} else {
  console.log('🎉 结论: 实证对抗校验全部通过！');
  process.exit(0);
}
