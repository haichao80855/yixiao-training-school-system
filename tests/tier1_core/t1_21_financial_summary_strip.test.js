const assert = require('../harness/assert');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 1,
  featureId: 21,
  name: 'Feature 21: 财务动态汇总横条实时统计 (Summary Metrics Strip)',
  tests: [
    {
      name: '订单数量实时累加汇总',
      fn: () => {
        const orders = [
          { orderNo: '1', actualAmount: 2000 },
          { orderNo: '2', actualAmount: 3000 },
          { orderNo: '3', actualAmount: 5000 },
        ];
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.equal(res.totalCount, 3);
      },
    },
    {
      name: '实收总金额精确求和计算',
      fn: () => {
        const orders = [
          { orderNo: '1', actualAmount: 1400.50 },
          { orderNo: '2', actualAmount: 2600.25 },
          { orderNo: '3', actualAmount: 999.25 },
        ];
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.equal(res.totalAmount, 5000.00);
      },
    },
    {
      name: '空结果集小计横条文本格式规范',
      fn: () => {
        const res = FinanceAggregator.calculateSummaryStrip([]);
        assert.equal(res.totalCount, 0);
        assert.equal(res.totalAmount, 0.00);
        assert.equal(res.summaryText, '当前条件下：共计 0 笔缴费，实缴金额 0.00 元');
      },
    },
    {
      name: '真实截图样例小计文本完全匹配 (7 笔缴费，实缴 14000.00 元)',
      fn: () => {
        // 模拟 7 笔每笔 2000 元的订单
        const orders = Array.from({ length: 7 }, (_, i) => ({
          orderNo: `ORD_${i + 1}`,
          actualAmount: 2000.00,
        }));
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.equal(res.totalCount, 7);
        assert.equal(res.totalAmount, 14000.00);
        assert.equal(res.summaryText, '当前条件下：共计 7 笔缴费，实缴金额 14,000.00 元');
      },
    },
    {
      name: '千分位金额格式化渲染 (如 14,000.00)',
      fn: () => {
        const orders = [{ orderNo: '1', actualAmount: 1234567.89 }];
        const res = FinanceAggregator.calculateSummaryStrip(orders);
        assert.includes(res.formattedAmount, '1,234,567.89');
      },
    },
  ],
};
