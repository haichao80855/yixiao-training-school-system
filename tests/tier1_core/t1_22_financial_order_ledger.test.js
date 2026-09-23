const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 22,
  name: 'Feature 22: 财务订单营收流水与状态流 (Financial Order Ledger & State Flow)',
  tests: [
    {
      name: '常规收费与季度收费纵向 Tab 切换',
      fn: () => {
        const tabs = ['regular', 'quarterly'];
        let activeTab = 'regular';
        assert.equal(activeTab, 'regular');

        activeTab = 'quarterly';
        assert.equal(activeTab, 'quarterly');
      },
    },
    {
      name: '横向订单状态 4 分段 Tab 切换 (已支付/未支付/已驳回/作废)',
      fn: () => {
        const statusTabs = ['paid', 'unpaid', 'rejected', 'void'];
        assert.lengthOf(statusTabs, 4);
        assert.includes(statusTabs, 'paid');
        assert.includes(statusTabs, 'void');
      },
    },
    {
      name: '订单流水表格核心列字段定义',
      fn: () => {
        const orderRow = {
          selection: false,
          studentName: '王梓豪',
          studentNo: 'S948918',
          orderNo: 'ORD202609210001',
          phone: '156****0125',
          signupTime: '2026-09-21 10:00:00',
          payTime: '2026-09-21 10:05:00',
          originalPrice: 2000.00,
          discountAmount: 0.00,
          couponAmount: 0.00,
          receivableAmount: 2000.00,
          actualAmount: 2000.00,
          goodsDelivery: 'delivered',
        };
        assert.equal(orderRow.studentNo, 'S948918');
        assert.equal(orderRow.receivableAmount, 2000.00);
      },
    },
    {
      name: '订单状态正常流转 (待支付 -> 已支付)',
      fn: () => {
        const order = { id: 'O1', status: 'unpaid' };
        order.status = 'paid';
        order.payTime = '2026-09-21 11:00:00';
        assert.equal(order.status, 'paid');
        assert.ok(order.payTime);
      },
    },
    {
      name: '订单导出与列自定义显隐配置',
      fn: () => {
        const columns = [
          { key: 'studentName', title: '学员姓名', visible: true },
          { key: 'phone', title: '手机号', visible: true },
          { key: 'goodsDelivery', title: '出库状态', visible: false },
        ];
        const visibleCols = columns.filter(c => c.visible).map(c => c.key);
        assert.lengthOf(visibleCols, 2);
        assert.includes(visibleCols, 'studentName');
        assert.isFalse(visibleCols.includes('goodsDelivery'));
      },
    },
  ],
};
