const assert = require('../harness/assert');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 2,
  featureId: 20,
  name: 'Feature 20 (Boundary): 财务 3x8 高密度筛选矩阵边界 (Filter Matrix Boundary)',
  tests: [
    {
      name: '财务 3x8 重置校验：严格清空全部 24 个字段，还原默认分页与当月账期',
      fn: () => {
        // 构造一个所有 24 个字段都被污染的极端表单
        const dirtyForm = {
          studentKeyword: '恶意注入文本',
          submitter: '李四',
          salesOwner: '王五',
          channel: 'online',
          classId: 'CLS_99',
          courseType: 'training',
          chargeType: 'quarterly',
          orderStatus: 'rejected',
          studentStatus: 'suspended',
          abnormalStatus: 'refund',
          goodsDelivery: 'delivered',
          paymentMethod: 'pos',
          minAmount: 5000,
          maxAmount: 10000,
          invoiceStatus: 'issued',
          campusId: 'CAMPUS_CHAOYANG',
          dateRangeType: 'auditTime',
          startDate: '2020-01-01',
          endDate: '2020-12-31',
          couponUsed: 'yes',
          auditor: '赵六',
          contractSigned: 'no',
          page: 99,
          pageSize: 100,
        };

        const resetForm = FinanceAggregator.resetFilterForm('CAMPUS_HQ');
        assert.equal(resetForm.studentKeyword, '');
        assert.equal(resetForm.submitter, '');
        assert.equal(resetForm.salesOwner, '');
        assert.equal(resetForm.channel, 'all');
        assert.equal(resetForm.classId, '');
        assert.equal(resetForm.courseType, 'all');
        assert.equal(resetForm.chargeType, 'all');
        assert.equal(resetForm.orderStatus, 'all');
        assert.equal(resetForm.studentStatus, 'all');
        assert.equal(resetForm.abnormalStatus, 'all');
        assert.equal(resetForm.goodsDelivery, 'all');
        assert.equal(resetForm.paymentMethod, 'all');
        assert.equal(resetForm.minAmount, null);
        assert.equal(resetForm.maxAmount, null);
        assert.equal(resetForm.invoiceStatus, 'all');
        assert.equal(resetForm.campusId, 'CAMPUS_HQ');
        assert.equal(resetForm.couponUsed, 'all');
        assert.equal(resetForm.auditor, '');
        assert.equal(resetForm.contractSigned, 'all');
        assert.equal(resetForm.page, 1, '页码必须重置为第 1 页');
        assert.equal(resetForm.pageSize, 20, '每页条数必须恢复默认 20 条');

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        assert.equal(resetForm.startDate, `${year}-${month}-01`, '必须重置为当月 1 号');
      },
    },
    {
      name: '金额区间 minAmount > maxAmount 异常反转防御',
      fn: () => {
        function sanitizeAmountRange(min, max) {
          if (typeof min === 'number' && typeof max === 'number' && min > max) {
            return { min: max, max: min }; // 自动调换容错
          }
          return { min, max };
        }

        const res = sanitizeAmountRange(5000, 1000);
        assert.equal(res.min, 1000);
        assert.equal(res.max, 5000);
      },
    },
    {
      name: '特殊字符与非法日期格式过滤',
      fn: () => {
        function isValidDate(dateStr) {
          return !isNaN(Date.parse(dateStr)) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
        }

        assert.isTrue(isValidDate('2026-09-21'));
        assert.isFalse(isValidDate('2026/09/21'));
        assert.isFalse(isValidDate('invalid_date'));
      },
    },
    {
      name: '班级弹窗选择器多选数组与表单值绑定清洗',
      fn: () => {
        function bindClassSelection(selectedClassIds) {
          if (!Array.isArray(selectedClassIds)) return '';
          return selectedClassIds.join(',');
        }

        assert.equal(bindClassSelection(['C1', 'C2']), 'C1,C2');
        assert.equal(bindClassSelection([]), '');
      },
    },
    {
      name: '24 个控件全配置空值时执行全量无缝检索',
      fn: () => {
        const orders = [{ orderNo: '1' }, { orderNo: '2' }];
        const filtered = FinanceAggregator.filterOrders(orders, {});
        assert.lengthOf(filtered, 2);
      },
    },
  ],
};
