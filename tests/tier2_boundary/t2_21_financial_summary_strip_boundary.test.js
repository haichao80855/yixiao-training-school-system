const assert = require('../harness/assert');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 2,
  featureId: 21,
  name: 'Feature 21 (Boundary): 财务动态汇总横条实时统计边界 (Summary Metrics Boundary)',
  tests: [
    {
      name: '包含退费负数订单时的净营收准确核算',
      fn: () => {
        const orders = [
          { orderNo: 'ORD_1', actualAmount: 3000.00 },
          { orderNo: 'ORD_2', actualAmount: 5000.00 },
          { orderNo: 'ORD_REFUND', actualAmount: -1200.00 }, // 退款负数
        ];
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.equal(res.totalCount, 3);
        assert.equal(res.totalAmount, 6800.00);
        assert.includes(res.summaryText, '实缴金额 6,800.00 元');
      },
    },
    {
      name: '多位浮点数高精度求和（杜绝 IEEE 754 0.1+0.2 误差）',
      fn: () => {
        const orders = [
          { actualAmount: 0.10 },
          { actualAmount: 0.20 },
        ];
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.equal(res.totalAmount, 0.30);
      },
    },
    {
      name: '动态隐藏金额列时，汇总横条依然基于全量数据字段准确统计',
      fn: () => {
        const orders = [{ actualAmount: 1000 }, { actualAmount: 2000 }];
        // 前端列隐藏不影响聚合计算
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.equal(res.totalAmount, 3000);
      },
    },
    {
      name: '仅筛选出 1 笔订单时文本单复数与格式正确',
      fn: () => {
        const orders = [{ actualAmount: 888.88 }];
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.equal(res.totalCount, 1);
        assert.equal(res.totalAmount, 888.88);
        assert.equal(res.summaryText, '当前条件下：共计 1 笔缴费，实缴金额 888.88 元');
      },
    },
    {
      name: '极端大额上亿元资金汇总千分位排版不溢出',
      fn: () => {
        const orders = [{ actualAmount: 123456789.50 }];
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.equal(res.formattedAmount, '123,456,789.50');
      },
    },
  ],
};
