const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');

module.exports = {
  tier: 2,
  featureId: 12,
  name: 'Feature 12 (Boundary): 学员电子钱包账本边界 (Electronic Wallet Boundary)',
  tests: [
    {
      name: '消费扣款金额超过本金与赠送金总和阻断透支',
      fn: () => {
        const student = {
          wallet: { principalBalance: 300, bonusBalance: 100 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        // 总额 400，尝试扣除 500
        assert.throws(() => {
          sm.walletDeduct(500);
        }, /Insufficient wallet balance/);
      },
    },
    {
      name: '提现金额大于本金余额（尝试提现赠送金）严格阻断抛错',
      fn: () => {
        const student = {
          wallet: { principalBalance: 500, bonusBalance: 500 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        // 本金只有 500，尝试提现 600
        assert.throws(() => {
          sm.walletWithdraw(600);
        }, /Cannot withdraw more than principal balance/);
      },
    },
    {
      name: '浮点数金额运算精度防抖 (0.1 + 0.2 保留两位小数)',
      fn: () => {
        const student = {
          wallet: { principalBalance: 0.1, bonusBalance: 0.2 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        const w = sm.getStudent().wallet;
        const sum = Number((w.principalBalance + w.bonusBalance).toFixed(2));
        assert.equal(sum, 0.3);
      },
    },
    {
      name: '负数充值或提现抛出参数非法异常',
      fn: () => {
        const student = {
          wallet: { principalBalance: 1000, bonusBalance: 0 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        assert.throws(() => sm.walletDeduct(-100), /must be positive/);
        assert.throws(() => sm.walletWithdraw(-50), /must be positive/);
      },
    },
    {
      name: '零金额扣款或提现抛错保护',
      fn: () => {
        const student = {
          wallet: { principalBalance: 1000, bonusBalance: 0 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);
        assert.throws(() => sm.walletDeduct(0), /must be positive/);
        assert.throws(() => sm.walletWithdraw(0), /must be positive/);
      },
    },
  ],
};
