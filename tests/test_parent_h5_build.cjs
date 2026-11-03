/**
 * 网页家长端 (mini-program uni-app H5 构建) 契约测试
 * 1) 部署路径：资源与路由均挂在 /parent/ 下
 * 2) 网页版只包含家长端：登录页 + package-parent，不含教职工页面与教职工登录入口
 * 运行方式：node tests/test_parent_h5_build.cjs (缺少构建产物时自动执行 npm run build:h5)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mpRoot = path.resolve(__dirname, '../mini-program');
const h5Dist = path.resolve(mpRoot, 'dist/build/h5');
const BASE = '/parent/';

const PARENT_ROUTES = [
  '/package-parent/evaluations/index',
  '/package-parent/evaluations/detail',
  '/package-parent/schedule/index',
  '/package-parent/courses/index',
  '/package-parent/courses/usage',
  '/package-parent/growth/index',
  '/package-parent/me/index',
];

let passed = 0;
function check(cond, desc) {
  assert.ok(cond, `❌ ${desc}`);
  passed++;
  console.log(`  ✓ ${desc}`);
}

console.log('================================================================');
console.log('网页家长端 H5 构建契约测试');
console.log('================================================================\n');

if (!fs.existsSync(path.join(h5Dist, 'index.html'))) {
  console.log('  · 未找到 H5 构建产物，执行 npm run build:h5 ...');
  execSync('npm run build:h5', { cwd: mpRoot, stdio: 'inherit' });
}

console.log('【1】manifest 路由与部署路径');
const manifest = JSON.parse(fs.readFileSync(path.join(mpRoot, 'src/manifest.json'), 'utf8'));
check(manifest.h5 && manifest.h5.publicPath === BASE, 'h5.publicPath 为 /parent/');
check(manifest.h5.router && manifest.h5.router.mode === 'history' && manifest.h5.router.base === BASE, 'h5 路由为 history 模式，base 为 /parent/');
check(manifest.locale === 'zh-Hans', '内置弹窗等 UI 固定为简体中文');

console.log('\n【2】index.html 资源路径');
const html = fs.readFileSync(path.join(h5Dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
check(refs.length > 0, `index.html 引用了 ${refs.length} 个构建资源`);
check(refs.every((r) => r.startsWith(`${BASE}assets/`)), '所有构建资源均位于 /parent/assets/ 下');
check(html.includes('viewport-fit=cover'), '启用 viewport-fit=cover 以适配 iPhone 安全区');

console.log('\n【3】网页版只包含家长端页面');
const jsFiles = fs.readdirSync(path.join(h5Dist, 'assets')).filter((f) => f.endsWith('.js'));
const entry = jsFiles.find((f) => /^index-.*\.js$/.test(f));
check(!!entry, `找到入口脚本 ${entry}`);
const entrySrc = fs.readFileSync(path.join(h5Dist, 'assets', entry), 'utf8');
const routes = [...new Set([...entrySrc.matchAll(/path:"(\/[^"]*)"/g)].map((m) => m[1]))].sort();
check(
  JSON.stringify(routes) === JSON.stringify(['/', ...PARENT_ROUTES].sort()),
  `注册路由为登录页 (/) + 7 个家长端页面 (实际: ${routes.join(', ')})`,
);
const allJs = jsFiles.map((f) => fs.readFileSync(path.join(h5Dist, 'assets', f), 'utf8')).join('\n');
for (const staff of ['package-edu/', 'package-finance/', 'package-student/', 'pages/workbench/', 'pages/todo/']) {
  check(!allJs.includes(staff), `网页包不含教职工页面 ${staff}`);
}
check(!allJs.includes('教职工登录') && !allJs.includes('微信快捷免密登录'), '登录页不含教职工登录与微信授权入口');

console.log(`\n🎉 全部 ${passed} 项断言通过`);
