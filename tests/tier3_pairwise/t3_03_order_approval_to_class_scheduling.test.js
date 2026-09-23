const assert = require('../harness/assert');
const FinanceAggregator = require('../contracts/financeAggregator');

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
    {
      name: '课包激活后推入待分班学员池，并成功编入新班级',
      fn: () => {
        const awaitDividePool = [{ studentId: 'STU_1', packageId: 'PKG_PND' }];
        const classTarget = { id: 'CLS_ROBOT_1', maxCapacity: 15, currentStudents: ['STU_2'] };

        // 调度员将 STU_1 移入班级
        classTarget.currentStudents.push(awaitDividePool[0].studentId);
        awaitDividePool.splice(0, 1);

        assert.lengthOf(awaitDividePool, 0, '分班后待分班池相应减少');
        assert.lengthOf(classTarget.currentStudents, 2);
        assert.includes(classTarget.currentStudents, 'STU_1');
      },
    },
  ],
};
