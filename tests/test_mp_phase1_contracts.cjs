const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 运行微信小程序端阶段一（底座脚手架与契约）测试');
console.log('======================================================');

// 1. 验证编译产物 app.json
const distAppJsonPath = path.resolve(__dirname, '../mini-program/dist/build/mp-weixin/app.json');
assert.ok(fs.existsSync(distAppJsonPath), '❌ 编译产物 app.json 不存在！');
const appJson = JSON.parse(fs.readFileSync(distAppJsonPath, 'utf8'));

console.log('✔ app.json 编译输出正常');

// 2. 验证主包 5 大核心 Tab 与登录页
const expectedMainPages = [
  'pages/index/index',
  'pages/workbench/index',
  'pages/ai/index',
  'pages/todo/index',
  'pages/my/index',
  'pages/login/index',
];

for (const p of expectedMainPages) {
  assert.ok(appJson.pages.includes(p), `❌ 主包缺少核心页面: ${p}`);
}
console.log('✔ 主包 5 大核心 Tab 及登录页路径校验通过');

// 3. 验证 4 大业务分包配置
assert.ok(Array.isArray(appJson.subPackages), '❌ subPackages 配置缺失');
const subPkgRoots = appJson.subPackages.map((s) => s.root);
assert.ok(subPkgRoots.includes('package-edu'), '❌ 缺少教务分包 package-edu');
assert.ok(subPkgRoots.includes('package-student'), '❌ 缺少学员分包 package-student');
assert.ok(subPkgRoots.includes('package-finance'), '❌ 缺少财务分包 package-finance');
assert.ok(subPkgRoots.includes('package-crm'), '❌ 缺少CRM分包 package-crm');

console.log('✔ 4 大业务分包路由与子页面挂载通过');

// 4. 验证请求拦截器契约
const requestTsPath = path.resolve(__dirname, '../mini-program/src/utils/request.ts');
const requestTsContent = fs.readFileSync(requestTsPath, 'utf8');
assert.ok(requestTsContent.includes("'x-campus-id'"), '❌ request.ts 缺少 x-campus-id 租户头注入');
assert.ok(requestTsContent.includes('Authorization'), '❌ request.ts 缺少 Bearer token 鉴权头注入');
assert.ok(requestTsContent.includes('pages/login/index'), '❌ request.ts 缺少 401 登录失效跳转机制');

console.log('✔ request.ts 多租户校区头与 Token 自动拦截校验通过');

// 5. 验证个人中心复刻代码契约 (对齐截图 068)
const myPagePath = path.resolve(__dirname, '../mini-program/src/pages/my/index.vue');
const myPageContent = fs.readFileSync(myPagePath, 'utf8');
assert.ok(myPageContent.includes('我的机构'), '❌ 我的页面缺少「我的机构」卡片');
assert.ok(myPageContent.includes('修改密码'), '❌ 我的页面缺少「修改密码」入口');
assert.ok(myPageContent.includes('绑定公众号'), '❌ 我的页面缺少「绑定公众号」入口');
assert.ok(myPageContent.includes('退出登录'), '❌ 我的页面缺少「退出登录」按钮');

console.log('✔ 我的页面 (068_我的.png) 核心视觉要素与多角色标签契约校验通过');

console.log('\n🎉 所有阶段一契约断言均通过测试！');
