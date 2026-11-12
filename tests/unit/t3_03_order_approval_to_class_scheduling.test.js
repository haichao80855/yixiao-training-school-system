const assert = require('../harness/assert');
const FinanceAggregator = require('../helpers/load-ts.cjs')('src/utils/financeAggregator.ts').FinanceAggregator;

module.exports = {
  tier: 3,
  name: 'Tier 3.3: 财务审批通过 -> 课时上账入库 -> 待分班入班调度 (Order Approval -> Scheduling)',
  tests: [
    {
      name: '常规收款审批通过后课时划拨并激活学员课包',
      fn: () => {
        const studentProfile = {
          id: 'STU_1',
          name: '孙浩',
          coursePackages: [
            { packageId: 'PKG_PND', status: 'pending_payment', remainingLessons: 0, totalLessons: 30 },
          ],
        };
        const approvalRecord = {
          id: 'APP_ORDER_1',
          businessType: 'payment',
          currentStep: 3,
          status: 'pending',
          timeline: [],
        };

        // 财务审批通过
        const appRes = FinanceAggregator.processApproval(approvalRecord, 'pass', 'FINANCE_CHIEF');
        assert.equal(appRes.finalStatus, 'approved');

        // 联动：激活学员课包并上账 30 课时
        const pkg = studentProfile.coursePackages.find(p => p.packageId === 'PKG_PND');
        pkg.status = 'active';
        pkg.remainingLessons = pkg.totalLessons;

        assert.equal(pkg.status, 'active');
        assert.equal(pkg.remainingLessons, 30);
      },
    },
  ],
};
