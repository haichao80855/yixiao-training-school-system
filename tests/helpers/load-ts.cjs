/**
 * 直接加载 src/ 下的真实 TypeScript 模块给 Node 测试用 (不打包、不启动 Vite)。
 *
 * 用仓库根目录的 typescript 把 .ts 转成 CommonJS 后执行；只支持相对路径导入和 `@/` 别名，
 * 适合 src/utils 这类不依赖 Vue / 浏览器的纯函数模块。
 *
 *   const { FinanceAggregator } = loadTs('src/utils/financeAggregator.ts')
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');
const cache = new Map();

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // 第三方包交给 Node 自己解析
  for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`load-ts: 找不到 ${spec} (来自 ${path.relative(ROOT, fromFile)})`);
}

function loadFile(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  cache.set(file, mod);
  const localRequire = (spec) => {
    const resolved = resolveImport(spec, file);
    if (!resolved) return require(require.resolve(spec, { paths: [path.dirname(file), ROOT] }));
    return resolved.endsWith('.ts') ? loadFile(resolved) : require(resolved);
  };
  const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', outputText);
  wrapper(mod.exports, localRequire, mod, file, path.dirname(file));
  return mod.exports;
}

module.exports = function loadTs(relPath) {
  return loadFile(path.join(ROOT, relPath));
};
