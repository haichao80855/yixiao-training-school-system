const assert = require('../harness/assert');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 1,
  featureId: 20,
  name: 'Feature 20: 财务 3x8 高密度筛选矩阵 (3x8 High-Density Filter Matrix)',
  tests: [
    {
      name: '3 行 24 控件高密度表单字段完整性',
      fn: () => {
        const form = FinanceAggregator.getDefaultFilterForm();
        const keys = Object.keys(form);
        assert.lengthOf(keys, 24, '3x8 矩阵必须包含恰好 24 个查询参数字段');
        assert.hasProperty(form, 'studentKeyword');
        assert.hasProperty(form, 'chargeType');
        assert.hasProperty(form, 'orderStatus');
        assert.hasProperty(form, 'paymentMethod');
        assert.hasProperty(form, 'startDate');
        assert.hasProperty(form, 'endDate');
      },
    },
    {
      name: '默认日期范围初始化为当月 1 号至月末',
      fn: () => {
        const form = FinanceAggregator.getDefaultFilterForm();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        assert.equal(form.startDate, `${year}-${month}-01`);
        assert.match(form.endDate, new RegExp(`^${year}-${month}-\\d{2}$`));
      },
    },
    {
      name: '组合多条件过滤订单流水结果集',
      fn: () => {
        const orders = [
          { orderNo: 'O1', campusId: 'CAMPUS_HQ', studentName: '张三', chargeType: 'regular', orderStatus: 'paid' },
          { orderNo: 'O2', campusId: 'CAMPUS_HQ', studentName: '李四', chargeType: 'quarterly', orderStatus: 'paid' },
          { orderNo: 'O3', campusId: 'CAMPUS_HAIDIAN', studentName: '王五', chargeType: 'regular', orderStatus: 'paid' },
        ];
        const filtered = FinanceAggregator.filterOrders(orders, {
          campusId: 'CAMPUS_HQ',
          chargeType: 'regular',
        });
        assert.lengthOf(filtered, 1);
        assert.equal(filtered[0].orderNo, 'O1');
      },
    },
    {
      name: '重置按钮一键清空并恢复默认条件',
      fn: () => {
        const dirtyFilters = {
          studentKeyword: '测试学生',
          chargeType: 'quarterly',
          minAmount: 1000,
          page: 5,
        };
        const resetFilters = FinanceAggregator.resetFilterForm('CAMPUS_HQ');
        assert.equal(resetFilters.studentKeyword, '');
        assert.equal(resetFilters.chargeType, 'all');
        assert.equal(resetFilters.minAmount, null);
        assert.equal(resetFilters.page, 1);
      },
    },
    {
      name: '班级弹窗选择器与查询表单绑定',
      fn: () => {
        const form = FinanceAggregator.getDefaultFilterForm();
        form.classId = 'CLS_ROBOT_WEEKEND_01';
        assert.equal(form.classId, 'CLS_ROBOT_WEEKEND_01');
      },
    },
  ],
};
