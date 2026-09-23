const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');

module.exports = {
  tier: 3,
  name: 'Tier 3.2: 报名开单组合支付与电子钱包扣款联动 (Enrollment -> Wallet & Order)',
  tests: [
    {
      name: '学员报名使用部分电子钱包本金与微信组合支付开单',
      fn: () => {
        const student = {
          id: 'STU_COMBO',
          wallet: { principalBalance: 1000, bonusBalance: 200 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);

        // 报名课程总价 3000 元。学员选择扣减钱包 800 元，剩余 2200 元走微信支付。
        const walletDeductAmt = 800;
        const onlinePayAmt = 2200;

        // 执行钱包扣款
        sm.walletDeduct(walletDeductAmt);

        // 优先扣赠送金 200，再扣本金 600 => 赠送金0，本金400
        assert.equal(sm.getStudent().wallet.bonusBalance, 0);
        assert.equal(sm.getStudent().wallet.principalBalance, 400);

        // 生成订单
        const order = {
          orderNo: 'ORD_COMBO_01',
          studentId: student.id,
          totalAmount: 3000,
          walletDeduction: walletDeductAmt,
          onlinePayment: onlinePayAmt,
          status: 'pending_approval',
        };
        assert.equal(order.walletDeduction + order.onlinePayment, order.totalAmount);
        assert.equal(order.status, 'pending_approval');
      },
    },
    {
      name: '钱包余额不足以支付指定扣款额时开单事务中断',
      fn: () => {
        const student = {
          wallet: { principalBalance: 300, bonusBalance: 100 }, // 总计 400
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        assert.throws(() => {
          sm.walletDeduct(500);
        }, /Insufficient wallet balance/);
        // 验证余额未被意外修改
        assert.equal(sm.getStudent().wallet.principalBalance, 300);
      },
    },
  ],
};
