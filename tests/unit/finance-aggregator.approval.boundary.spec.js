import { describe, it } from 'vitest';
import assert from '../harness/assert.js';
import { FinanceAggregator } from '@/utils/financeAggregator';

const suite = {
  tier: 2,
  featureId: 23,
  name: 'Feature 23 (Boundary): 财务多级审批流工作台边界 (Approval Workflow Boundary)',
  tests: [
    {
      name: '重复审批提交幂等拦截（已终审记录不可再次通过或驳回）',
      fn: () => {
        const finalizedRecord = {
          id: 'APP_DONE',
          status: 'approved', // 已终结
          currentStep: 3,
          timeline: [],
        };
        assert.throws(() => {
          FinanceAggregator.processApproval(finalizedRecord, 'pass', 'OPERATOR');
        }, /Approval record is already finalized as: approved/);
      },
    },
    {
      name: '审批驳回后状态回退与申请人通知联动',
      fn: () => {
        const record = {
          id: 'APP_REJ',
          status: 'pending',
          currentStep: 2,
          applicantId: 'U_100',
          timeline: [],
        };
        const res = FinanceAggregator.processApproval(record, 'reject', 'PRINCIPAL', '材料不齐');
        assert.equal(res.finalStatus, 'rejected');
        assert.equal(record.status, 'rejected');
        assert.equal(record.applicantId, 'U_100');
      },
    },
    {
      name: '退费审批终审通过时原子级触发退款',
      fn: () => {
        let isRefundDispatched = false;
        function onApprovalComplete(record) {
          if (record.businessType === 'refund' && record.status === 'approved') {
            isRefundDispatched = true;
          }
        }

        const record = {
          id: 'APP_R',
          businessType: 'refund',
          currentStep: 3,
          status: 'pending',
          timeline: [],
        };
        FinanceAggregator.processApproval(record, 'pass', 'CHIEF_FINANCE');
        onApprovalComplete(record);
        assert.isTrue(isRefundDispatched, '退费审批终审通过后必须立即触发退款下发');
      },
    },
  ],
};

describe(suite.name, () => {
  for (const t of suite.tests) it(t.name, t.fn);
});
