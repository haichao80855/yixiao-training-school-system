/**
 * npm run test:all 的入口。
 *
 * 以前这里自己维护一份测试清单，还会直接复用 3001 上的开发服务器 (写开发库)，并且漏掉了后来新增的后端测试。
 * 现在统一交给 tests/isolated-env.cjs：临时库 + 随机端口的后端，运行 tests/suites.json 里登记的全部测试。
 * 额外参数原样透传，例如：npm run test:all -- --group=资金
 */
const path = require('path');
const { spawnSync } = require('child_process');

const r = spawnSync(process.execPath, [path.join(__dirname, 'isolated-env.cjs'), '--scope=all', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
