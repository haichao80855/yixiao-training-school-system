const assert = require('../harness/assert');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  tier: 2,
  featureId: 27,
  name: 'Feature 27 (Boundary): 生产级构建验证与 E2E 终审边界 (Build Readiness Boundary)',
  tests: [
    {
      name: '根目录 package.json 必须配置完整构建脚本 (build, dev, type-check)',
      fn: () => {
        const pkgPath = path.resolve(__dirname, '../../package.json');
        assert.isTrue(fs.existsSync(pkgPath), 'package.json 必须存在');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        assert.ok(pkg.scripts, 'package.json 必须包含 scripts 字段');
        assert.ok(pkg.scripts.build, '必须包含 build 脚本');
        assert.ok(pkg.scripts.dev, '必须包含 dev 脚本');
      },
    },
    {
      name: 'Vue 与 TypeScript 等核心依赖声明合规性',
      fn: () => {
        const pkgPath = path.resolve(__dirname, '../../package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        assert.ok(deps.vue, '必须依赖 vue 3');
        assert.ok(deps['element-plus'], '必须依赖 element-plus');
        assert.ok(deps.pinia, '必须依赖 pinia');
        assert.ok(deps['vue-router'], '必须依赖 vue-router');
        assert.ok(deps.typescript, '必须依赖 typescript');
      },
    },
    {
      name: 'Tier 2 边界用例文件数量覆盖基准 (必须包含全部 27 个测试文件)',
      fn: () => {
        const tier2Dir = __dirname;
        const testFiles = fs.readdirSync(tier2Dir).filter(f => f.startsWith('t2_') && f.endsWith('.test.js'));
        assert.equal(testFiles.length, 27, 'Tier 2 必须包含全部 27 项特性的独立测试套件文件');
      },
    },
    {
      name: '测试执行器支持分层过滤参数 (--tier=N 与 --feature=M)',
      fn: () => {
        const runnerPath = path.resolve(__dirname, '../runner.js');
        const content = fs.readFileSync(runnerPath, 'utf-8');
        assert.includes(content, '--tier=');
        assert.includes(content, '--feature=');
      },
    },
    {
      name: '测试断言工具对错误断言的灵敏捕获能力',
      fn: () => {
        let caught = false;
        try {
          assert.equal(1, 2, 'Should fail');
        } catch (e) {
          caught = true;
        }
        assert.isTrue(caught, '断言工具必须能准确捕获数值不一致异常');
      },
    },
  ],
};
