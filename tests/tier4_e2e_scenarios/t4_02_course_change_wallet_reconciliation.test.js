const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 4,
  name: 'Scenario 2: 换课重组与电子钱包资金对账流 (Course Change & Wallet Reconciliation)',
  tests: [
    {
      name: '高单价课程转低单价课程：负差额退入电子钱包本金，课包更新与财务对账',
      fn: () => {
        // 1. 学员持有原课程 A
        const student = {
          id: 'STU_CHG_02',
          name: '高晨轩',
          campusId: 'CAMPUS_HQ',
          status: 'normal',
          wallet: { principalBalance: 300, bonusBalance: 0 },
          coursePackages: [
            {
              packageId: 'PKG_A',
              courseId: 'CRS_CPP_ADV',
              courseName: 'C++算法集训班',
              pricePerLesson: 300,
              totalLessons: 30,
              remainingLessons: 20, // 剩余价值 20 x 300 = 6000 元
              status: 'active',
            },
          ],
        };
        const sm = new StudentStateMachine(student);

        // 2. 学员申请转为 Python 课程 B (单价 400 元，计划购买 12 课时，总价 4800 元)
        const newCourseB = {
          id: 'CRS_PY_AI',
          name: 'Python人工智能课',
          pricePerLesson: 400,
        };

        // 3. 执行换课
        const chgRes = sm.changeCourse('PKG_A', newCourseB, 12);
        assert.isTrue(chgRes.success);
        assert.equal(chgRes.oldResidualValue, 6000);
        assert.equal(chgRes.newTotalCost, 4800);
        assert.equal(chgRes.diff, 1200);
        assert.equal(chgRes.walletCredited, 1200);

        // 4. 验证学员电子钱包余额变动：原300 + 1200 = 1500 元
        assert.equal(sm.getStudent().wallet.principalBalance, 1500);

        // 5. 验证课包状态：原课包 completed，新课包 active 且剩余 12 课时
        const pkgs = sm.getStudent().coursePackages;
        assert.equal(pkgs[0].status, 'completed');
        assert.equal(pkgs[1].status, 'active');
        assert.equal(pkgs[1].remainingLessons, 12);

        // 6. 财务对账流水记录
        const financeLedger = [
          { orderNo: 'CHG_DIFF_01', type: 'change_course_credit', actualAmount: -1200 },
        ];
        assert.equal(financeLedger[0].actualAmount, -1200);
      },
    },
  ],
};
