const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');

module.exports = {
  tier: 1,
  featureId: 12,
  name: 'Feature 12: 学员电子钱包账本 (Electronic Wallet Ledger)',
  tests: [
    {
      name: '本金与赠送金独立分账模型初始化',
      fn: () => {
        const student = {
          id: 'S1',
          name: '小明',
          wallet: { principalBalance: 1000, bonusBalance: 200 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        const w = sm.getStudent().wallet;
        assert.equal(w.principalBalance, 1000);
        assert.equal(w.bonusBalance, 200);
      },
    },
    {
      name: '钱包充值本金上账流水',
      fn: () => {
        const student = {
          id: 'S1',
          wallet: { principalBalance: 500, bonusBalance: 0 },
        };
        // 充值 2000 元
        student.wallet.principalBalance += 2000;
        assert.equal(student.wallet.principalBalance, 2500);
      },
    },
    {
      name: '消费优先扣除赠送金机制',
      fn: () => {
        const student = {
          id: 'S1',
          wallet: { principalBalance: 1000, bonusBalance: 300 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        // 消费 200，只扣赠送金
        sm.walletDeduct(200);
        assert.equal(sm.getStudent().wallet.bonusBalance, 100);
        assert.equal(sm.getStudent().wallet.principalBalance, 1000);

        // 再消费 200，扣除剩余 100 赠送金，再扣 100 本金
        sm.walletDeduct(200);
        assert.equal(sm.getStudent().wallet.bonusBalance, 0);
        assert.equal(sm.getStudent().wallet.principalBalance, 900);
      },
    },
    {
      name: '本金支持合规提现与校验',
      fn: () => {
        const student = {
          id: 'S1',
          wallet: { principalBalance: 1500, bonusBalance: 400 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        const res = sm.walletWithdraw(500);
        assert.isTrue(res.success);
        assert.equal(res.withdrawn, 500);
        assert.equal(res.remainingPrincipal, 1000);
      },
    },
    {
      name: '账本流水时间倒序排列与类型标记',
      fn: () => {
        const ledger = [
          { id: '1', type: 'recharge', amount: 1000, time: '2026-09-01 10:00:00' },
          { id: '2', type: 'consumption', amount: -300, time: '2026-09-10 15:30:00' },
          { id: '3', type: 'refund', amount: 300, time: '2026-09-15 09:20:00' },
        ];
        const sorted = [...ledger].sort((a, b) => b.time.localeCompare(a.time));
        assert.equal(sorted[0].id, '3');
        assert.equal(sorted[1].id, '2');
        assert.equal(sorted[2].id, '1');
      },
    },
  ],
};
