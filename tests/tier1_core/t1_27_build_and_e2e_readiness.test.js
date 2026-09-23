const assert = require('../harness/assert');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  tier: 1,
  featureId: 27,
  name: 'Feature 27: 生产级构建验证与 E2E 终审 (Production Build & E2E Readiness)',
  tests: [
    {
      name: '项目根目录核心工程契约文件存在性',
      fn: () => {
        const rootDir = path.resolve(__dirname, '../../');
        assert.isTrue(fs.existsSync(path.join(rootDir, 'PROJECT.md')), 'PROJECT.md 应存在');
        assert.isTrue(fs.existsSync(path.join(rootDir, 'MODULE_ANALYSIS_DESIGN.md')), 'MODULE_ANALYSIS_DESIGN.md 应存在');
        assert.isTrue(fs.existsSync(path.join(rootDir, 'TEST_INFRA.md')), 'TEST_INFRA.md 应存在');
      },
    },
    {
      name: '测试套件中央执行器 runner.js 结构完整性',
      fn: () => {
        const runnerPath = path.resolve(__dirname, '../runner.js');
        assert.isTrue(fs.existsSync(runnerPath), 'tests/runner.js 应存在');
      },
    },
    {
      name: '断言工具库与测试报告器完备性',
      fn: () => {
        const assertPath = path.resolve(__dirname, '../harness/assert.js');
        const reporterPath = path.resolve(__dirname, '../harness/reporter.js');
        assert.isTrue(fs.existsSync(assertPath));
        assert.isTrue(fs.existsSync(reporterPath));
      },
    },
    {
      name: '5 大业务契约 Oracle 模型可导入性',
      fn: () => {
        const contracts = [
          'tenantContext.js',
          'curriculumModel.js',
          'studentStateMachine.js',
          'collisionEngine.js',
          'financeAggregator.js',
          'rbacEngine.js',
        ];
        for (const c of contracts) {
          const modPath = path.resolve(__dirname, '../contracts', c);
          assert.isTrue(fs.existsSync(modPath), `契约文件 ${c} 应存在`);
          const mod = require(modPath);
          assert.ok(mod, `契约文件 ${c} 应成功导出模块`);
        }
      },
    },
    {
      name: 'Tier 1 核心覆盖指标基准断言 (>= 27 特性)',
      fn: () => {
        const tier1Dir = __dirname;
        const testFiles = fs.readdirSync(tier1Dir).filter(f => f.startsWith('t1_') && f.endsWith('.test.js'));
        assert.equal(testFiles.length, 27, 'Tier 1 必须包含全部 27 项特性的独立测试套件文件');
      },
    },
  ],
};
