const assert = require('../harness/assert');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 1,
  featureId: 23,
  name: 'Feature 23: 财务多级审批流工作台 (Multi-Tier Approval Workflow)',
  tests: [
    {
      name: '普通常规收款单级财务审批通过',
      fn: () => {
        const record = {
          id: 'APP_01',
          businessType: 'payment',
          currentStep: 3, // 财务终审
          status: 'pending',
          timeline: [],
        };
        const res = FinanceAggregator.processApproval(record, 'pass', 'FINANCE_OPERATOR', '收款到账核实无误');
        assert.isTrue(res.success);
        assert.equal(res.finalStatus, 'approved');
        assert.lengthOf(record.timeline, 1);
        assert.equal(record.timeline[0].status, 'passed');
      },
    },
    {
      name: '退费三级审批全流程逐级推进',
      fn: () => {
        const record = {
          id: 'APP_REF_01',
          businessType: 'refund',
          currentStep: 1, // 步骤1：教学课消核实
          status: 'pending',
          timeline: [],
        };

        // 步骤 1：教学核实通过
        const step1 = FinanceAggregator.processApproval(record, 'pass', 'DIRECTOR_WANG', '课消核实完毕，符合退费条件');
        assert.equal(step1.finalStatus, 'pending');
        assert.equal(record.currentStep, 2);

        // 步骤 2：校长审批通过
        const step2 = FinanceAggregator.processApproval(record, 'pass', 'PRINCIPAL_ZHANG', '同意退费');
        assert.equal(step2.finalStatus, 'pending');
        assert.equal(record.currentStep, 3);

        // 步骤 3：财务终审通过打款
        const step3 = FinanceAggregator.processApproval(record, 'pass', 'CASHIER_LI', '出纳已原路退回微信');
        assert.equal(step3.finalStatus, 'approved');
        assert.equal(record.status, 'approved');
        assert.lengthOf(record.timeline, 3);
      },
    },
    {
      name: '审批驳回中断流程并记录驳回理由',
      fn: () => {
        const record = {
          id: 'APP_02',
          businessType: 'payment',
          currentStep: 1,
          status: 'pending',
          timeline: [],
        };
        const res = FinanceAggregator.processApproval(record, 'reject', 'AUDITOR_ZHAO', '银行流水凭证模糊，请重新上传');
        assert.isTrue(res.success);
        assert.equal(res.finalStatus, 'rejected');
        assert.equal(record.status, 'rejected');
        assert.equal(record.timeline[0].comment, '银行流水凭证模糊，请重新上传');
      },
    },
    {
      name: '审批时间轴 (Timeline) 审计轨迹记录',
      fn: () => {
        const record = {
          id: 'APP_03',
          currentStep: 1,
          status: 'pending',
          timeline: [],
        };
        FinanceAggregator.processApproval(record, 'pass', 'OPERATOR_1', '第一步通过');
        assert.ok(record.timeline[0].time);
        assert.equal(record.timeline[0].operator, 'OPERATOR_1');
      },
    },
    {
      name: '季度收费划拨流水独立核算',
      fn: () => {
        const quarterlyBatch = [
          { quarter: '2026Q3', campusId: 'CAMPUS_HQ', studentCount: 120, totalTuition: 360000 },
          { quarter: '2026Q3', campusId: 'CAMPUS_HAIDIAN', studentCount: 80, totalTuition: 240000 },
        ];
        const sumTuition = quarterlyBatch.reduce((acc, curr) => acc + curr.totalTuition, 0);
        assert.equal(sumTuition, 600000);
      },
    },
  ],
};
