/**
 * 登录失败提示回归测试 (mini-program/src/utils/request.ts，小程序与网页家长端共用)
 * 登录接口返回 401 = 账号或密码错误：必须弹出后端原因，且不能当作「登录失效」重定向。
 * 其他接口返回 401 = 登录失效：清除 token 并回到登录页。
 * 运行方式：node tests/test_mp_login_error_toast.cjs
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
// 优先用小程序自己的 TypeScript；没装小程序依赖时 (例如 CI) 用仓库根目录的
const ts = require(require.resolve('typescript', {
  paths: [path.resolve(__dirname, '../mini-program'), path.resolve(__dirname, '..')],
}));

const src = fs
  .readFileSync(path.resolve(__dirname, '../mini-program/src/utils/request.ts'), 'utf8')
  .replace(/import\.meta\.env\.VITE_API_BASE_URL/g, "'http://test.local'");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;

const calls = { toast: [], reLaunch: [], removed: [] };
let nextResponse = null;
global.getCurrentPages = () => [{ route: 'pages/login/index' }];
global.uni = {
  getStorageSync: () => 'stale-token',
  removeStorageSync: (k) => calls.removed.push(k),
  showToast: (o) => calls.toast.push(o.title),
  reLaunch: (o) => calls.reLaunch.push(o.url),
  request: (o) => setTimeout(() => o.success(nextResponse), 0),
};
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { request } = mod.exports;

let passed = 0;
function check(cond, desc) {
  assert.ok(cond, `❌ ${desc}`);
  passed++;
  console.log(`  ✓ ${desc}`);
}
const reset = () => {
  calls.toast = [];
  calls.reLaunch = [];
  calls.removed = [];
};

(async () => {
  console.log('登录失败提示回归测试');

  for (const url of ['/api/parent/auth/login', '/api/auth/login']) {
    reset();
    nextResponse = { statusCode: 401, data: { code: 401, message: '手机号或密码不正确' } };
    const err = await request({ url, method: 'POST', data: {} }).catch((e) => e);
    check(calls.toast.includes('手机号或密码不正确'), `${url} 返回 401 时弹出后端原因「手机号或密码不正确」`);
    check(err instanceof Error && err.message === '手机号或密码不正确', `${url} 拒绝的错误携带后端原因`);
    check(calls.reLaunch.length === 0 && calls.removed.length === 0, `${url} 401 不当作登录失效 (不清 token、不重定向)`);
  }

  reset();
  nextResponse = { statusCode: 401, data: {} };
  await request({ url: '/api/parent/auth/login', method: 'POST', data: {} }).catch(() => undefined);
  check(calls.toast.includes('账号或密码不正确'), '登录接口 401 无 message 时使用兜底提示');

  reset();
  nextResponse = { statusCode: 429, data: { message: '密码错误次数过多，该手机号已暂时锁定' } };
  await request({ url: '/api/parent/auth/login', method: 'POST', data: {} }).catch(() => undefined);
  check(calls.toast.some((t) => t.includes('暂时锁定')), '账号锁定 (429) 时弹出锁定原因');

  reset();
  global.getCurrentPages = () => [{ route: 'package-parent/evaluations/index' }];
  nextResponse = { statusCode: 401, data: { message: 'Unauthorized' } };
  await request({ url: '/api/parent/me' }).catch(() => undefined);
  check(calls.removed.includes('token'), '其他接口 401 清除本地 token');
  check(calls.reLaunch.includes('/pages/login/index'), '其他接口 401 回到登录页');
  check(calls.toast.includes('登录已失效，请重新登录'), '其他接口 401 提示登录已失效');

  console.log(`\n🎉 全部 ${passed} 项断言通过`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
