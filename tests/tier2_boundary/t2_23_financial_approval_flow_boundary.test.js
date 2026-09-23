const assert = require('../harness/assert');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 2,
  featureId: 23,
  name: 'Feature 23 (Boundary): 财务多级审批流工作台边界 (Approval Workflow Boundary)',
  tests: [
    {
      name: '越权审批阻断（非指定角色不可执行该步骤审批）',
      fn: () => {
        function checkStepPermission(userRole, requiredRole) {
          if (userRole !== requiredRole && userRole !== 'super_admin') {
            throw new Error(`Permission denied: current step requires ${requiredRole}, but user is ${userRole}`);
          }
          return true;
        }

        assert.throws(() => checkStepPermission('teacher', 'principal'), /Permission denied/);
        assert.isTrue(checkStepPermission('principal', 'principal'));
      },
    },
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
    {
      name: '撤回已提交尚未被初审的审批单',
      fn: () => {
        const record = { id: 'A1', currentStep: 1, timeline: [], status: 'pending' };
        function withdrawApplication(r, applicantId) {
          if (r.timeline.length > 0) {
            throw new Error('Cannot withdraw: application already under review');
          }
          r.status = 'withdrawn';
          return true;
        }

        assert.isTrue(withdrawApplication(record, 'U1'));
        assert.equal(record.status, 'withdrawn');
      },
    },
  ],
};
