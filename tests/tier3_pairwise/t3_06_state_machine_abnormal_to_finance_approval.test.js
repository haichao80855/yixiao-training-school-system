const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 3,
  name: 'Tier 3.6: 学员异动申请 -> 财务审批流闭环 (Abnormal State -> Finance Approval)',
  tests: [
    {
      name: '学员退费申请生成多级审批流，终审后课包注销与资金划拨',
      fn: () => {
        // 1. 学员名下课包
        const student = {
          id: 'STU_ABN_1',
          status: 'normal',
          wallet: { principalBalance: 0, bonusBalance: 0 },
          coursePackages: [
            {
              packageId: 'PKG_TARGET',
              pricePerLesson: 250,
              totalLessons: 40,
              remainingLessons: 30, // 剩余价值 30 x 250 = 7500
              bonusLessons: 0,
              status: 'active',
            },
          ],
        };
        const sm = new StudentStateMachine(student);

        // 2. 状态机核算退费金额
        const refundCalc = sm.refund('PKG_TARGET', 200); // 扣除200元材料工本费
        assert.equal(refundCalc.refundAmount, 7300);

        // 3. 生成退费审批单
        const approval = {
          id: 'APP_REF_1001',
          businessType: 'refund',
          amount: refundCalc.refundAmount,
          currentStep: 1,
          status: 'pending',
          timeline: [],
        };

        // 步骤1：教学主管核查课消无误通过
        FinanceAggregator.processApproval(approval, 'pass', 'DIRECTOR');
        assert.equal(approval.currentStep, 2);

        // 步骤2：校长批准
        FinanceAggregator.processApproval(approval, 'pass', 'PRINCIPAL');
        assert.equal(approval.currentStep, 3);

        // 步骤3：财务出纳终审打款
        FinanceAggregator.processApproval(approval, 'pass', 'FINANCE');
        assert.equal(approval.status, 'approved');

        // 4. 课包确认置为终态
        assert.equal(sm.getStudent().coursePackages[0].status, 'refunded');
        assert.equal(sm.getStudent().coursePackages[0].remainingLessons, 0);
      },
    },
  ],
};
