/**
 * 盛通教育「一校教培系统」测试结果报告器 (Reporter)
 */

class TestReporter {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  record(testCase) {
    // testCase: { tier, featureId, suiteName, testName, durationMs, passed, error }
    this.results.push(testCase);
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const duration = Date.now() - this.startTime;

    const byTier = {};
    for (const r of this.results) {
      if (!byTier[r.tier]) {
        byTier[r.tier] = { total: 0, passed: 0, failed: 0 };
      }
      byTier[r.tier].total++;
      if (r.passed) byTier[r.tier].passed++;
      else byTier[r.tier].failed++;
    }

    const byFeature = {};
    for (const r of this.results) {
      if (r.featureId !== undefined) {
        if (!byFeature[r.featureId]) {
          byFeature[r.featureId] = { total: 0, passed: 0, failed: 0 };
        }
        byFeature[r.featureId].total++;
        if (r.passed) byFeature[r.featureId].passed++;
        else byFeature[r.featureId].failed++;
      }
    }

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0%',
      durationMs: duration,
      byTier,
      byFeature,
    };
  }

  printConsoleReport() {
    const summary = this.getSummary();
    const RESET = '\x1b[0m';
    const GREEN = '\x1b[32m';
    const RED = '\x1b[31m';
    const YELLOW = '\x1b[33m';
    const CYAN = '\x1b[36m';
    const BOLD = '\x1b[1m';

    console.log('\n' + '='.repeat(80));
    console.log(`${BOLD}${CYAN}盛通教育「一校教培系统」E2E 自动化测试执行报告 (Dual-Track Test Suite)${RESET}`);
    console.log('='.repeat(80));

    // Print tier summaries
    console.log(`\n${BOLD}【分层覆盖统计 (Tier Breakdown)】${RESET}`);
    const tierNames = {
      1: 'Tier 1: 核心功能覆盖 (Core Feature Coverage, 27 Features)',
      2: 'Tier 2: 边界与极端场景覆盖 (Boundary, Collision & Negative)',
      3: 'Tier 3: 跨模块组合与状态机流转 (Pairwise State Transitions)',
      4: 'Tier 4: 真实教培全场景业务链路 (E2E Business Lifecycles)',
    };

    for (let t = 1; t <= 4; t++) {
      const stats = summary.byTier[t] || { total: 0, passed: 0, failed: 0 };
      const statusColor = stats.failed === 0 && stats.total > 0 ? GREEN : stats.failed > 0 ? RED : YELLOW;
      const tName = tierNames[t] || `Tier ${t}`;
      console.log(
        `  ${statusColor}[${tName}]${RESET}: ` +
        `总计 ${stats.total} 用例 | 通过 ${stats.passed} | 失败 ${stats.failed} | ` +
        `通过率 ${stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0}%`
      );
    }

    // Failures details
    const failures = this.results.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log(`\n${BOLD}${RED}【失败用例明细 (Failed Tests: ${failures.length})】${RESET}`);
      failures.forEach((f, idx) => {
        console.log(`  ${idx + 1}. [Tier ${f.tier}] ${f.suiteName} > ${f.testName}`);
        console.log(`     ${RED}Error: ${f.error ? f.error.message : 'Unknown error'}${RESET}`);
        if (f.error && f.error.stack) {
          const stackLine = f.error.stack.split('\n')[1] || '';
          console.log(`     ${CYAN}Stack: ${stackLine.trim()}${RESET}`);
        }
      });
    }

    console.log('\n' + '-'.repeat(80));
    const overallColor = summary.failed === 0 && summary.total > 0 ? GREEN : RED;
    console.log(
      `${BOLD}测试总结: 总用例数 ${summary.total} | ${GREEN}通过: ${summary.passed}${RESET} | ` +
      `${summary.failed > 0 ? RED : RESET}失败: ${summary.failed}${RESET} | ` +
      `${overallColor}综合通过率: ${summary.passRate}${RESET} | 耗时: ${summary.durationMs}ms`
    );
    console.log('='.repeat(80) + '\n');
  }
}

module.exports = TestReporter;
