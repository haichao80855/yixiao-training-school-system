const assert = require('../harness/assert');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 3,
  name: 'Tier 3.5: 考勤反结课冲正 -> 课时回退 -> 财务红字冲正联动 (Attendance Reversal -> Chargeback)',
  tests: [
    {
      name: '教务反结课将误扣课时退回学员，财务自动生成红字负流水并重算汇总',
      fn: () => {
        // 初始状态：学员已被误扣 1 课时，剩余 19 课时
        const studentPackage = { remainingLessons: 19, consumedLessons: 1, pricePerLesson: 300 };

        // 财务已有 1 条 300 元正向课消收入
        const financeLedger = [
          { orderNo: 'REV_01', type: 'class_sales', actualAmount: 300.00 },
        ];
        let summary = FinanceAggregator.calculateSummaryStrip(financeLedger);
        assert.equal(summary.totalAmount, 300.00);

        // 教务发起“反结课冲正”
        studentPackage.remainingLessons += 1;
        studentPackage.consumedLessons -= 1;

        // 财务录入红字冲正单 -300.00
        financeLedger.push({
          orderNo: 'REV_01_REV',
          type: 'class_sales_reversal',
          actualAmount: -300.00,
        });

        // 验证学员课时恢复
        assert.equal(studentPackage.remainingLessons, 20);
        assert.equal(studentPackage.consumedLessons, 0);

        // 验证财务汇总自动轧平为 0.00 元
        summary = FinanceAggregator.calculateSummaryStrip(financeLedger);
        assert.equal(summary.totalCount, 2);
        assert.equal(summary.totalAmount, 0.00);
      },
    },
  ],
};
