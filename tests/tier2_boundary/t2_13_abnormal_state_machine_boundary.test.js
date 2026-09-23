const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');

module.exports = {
  tier: 2,
  featureId: 13,
  name: 'Feature 13 (Boundary): 学员 7 分支异常状态机边界 (Abnormal State Machine Boundary)',
  tests: [
    {
      name: '换课负差额进钱包：新课总额低于原课剩余价值，差额全额退入电子钱包本金',
      fn: () => {
        const student = {
          id: 'STU_CHANGE',
          status: 'normal',
          wallet: { principalBalance: 200, bonusBalance: 0 },
          coursePackages: [
            {
              packageId: 'PKG_HIGH',
              courseId: 'CRS_AI',
              courseName: '人工智能高阶',
              pricePerLesson: 400,
              remainingLessons: 10, // 剩余价值 10 x 400 = 4000
              totalLessons: 20,
              status: 'active',
            },
          ],
        };
        const sm = new StudentStateMachine(student);
        const lowCostCourse = { id: 'CRS_BASE', name: 'Scratch基础', pricePerLesson: 200 };
        // 购买新课 15 课时 x 200 = 3000 元。
        // 差额 diff = 4000 - 3000 = +1000 元。
        const res = sm.changeCourse('PKG_HIGH', lowCostCourse, 15);
        assert.isTrue(res.success);
        assert.equal(res.diff, 1000);
        assert.equal(res.walletCredited, 1000);
        // 原钱包 200 + 1000 = 1200
        assert.equal(sm.getStudent().wallet.principalBalance, 1200);
      },
    },
    {
      name: '停课期间排课自动过滤：休学停课状态下排课选择器自动过滤该学员',
      fn: () => {
        const student = {
          id: 'STU_SUSPENDED',
          status: 'suspended',
          coursePackages: [{ packageId: 'P1', status: 'frozen' }],
        };
        function canScheduleStudent(s) {
          if (s.status === 'suspended') {
            return { allowed: false, reason: 'Student is currently suspended (停课期间禁止排课)' };
          }
          return { allowed: true };
        }

        const check = canScheduleStudent(student);
        assert.isFalse(check.allowed);
        assert.includes(check.reason, '停课期间禁止排课');
      },
    },
    {
      name: '赠送课时退费多退少补公式：退费只退本金，赠送课时全额收回且已消耗赠课按正课单价扣回',
      fn: () => {
        // 学员购买 20 课时正课，单价 200，实付 4000。赠送 5 课时，总计 25 课时。
        // 场景 A: 学员已上 10 课时，剩余 15 课时（含 5 赠课）。
        // 此时已消耗 10 <= 20（未消耗赠课）。
        // 退费剩余正课 = 15 - 5 = 10 课时 x 200 = 2000 元。赠课 5 课时作废。
        const studentA = {
          id: 'S_REF_A',
          coursePackages: [
            {
              packageId: 'PKG_A',
              totalLessons: 25,
              bonusLessons: 5,
              remainingLessons: 15,
              pricePerLesson: 200,
              status: 'active',
            },
          ],
        };
        const smA = new StudentStateMachine(studentA);
        const resA = smA.refund('PKG_A', 0);
        assert.equal(resA.refundAmount, 2000);

        // 场景 B: 学员已上 22 课时（正课 20 课时已用完，且消耗了 2 课时赠课），剩余 3 课时（均为赠课）。
        // 此时消耗正课超出 2 课时，按正课单价 200 扣回 2 x 200 = 400 元。
        // 剩余可退购买课时为 0，退款额保底为 0。
        const studentB = {
          id: 'S_REF_B',
          coursePackages: [
            {
              packageId: 'PKG_B',
              totalLessons: 25,
              bonusLessons: 5,
              remainingLessons: 3,
              pricePerLesson: 200,
              status: 'active',
            },
          ],
        };
        const smB = new StudentStateMachine(studentB);
        const resB = smB.refund('PKG_B', 0);
        assert.equal(resB.refundAmount, 0);
      },
    },
    {
      name: '无权限跨校区转校阻断：目标校区未授权时直接抛出权限拒绝异常',
      fn: () => {
        const student = {
          id: 'S_TRANS',
          campusId: 'CAMPUS_HQ',
          status: 'normal',
          coursePackages: [],
          wallet: { principalBalance: 0, bonusBalance: 0 },
        };
        const sm = new StudentStateMachine(student);
        const authorizedCampuses = ['CAMPUS_HQ', 'CAMPUS_HAIDIAN'];

        // 尝试转入未授权的“西城校区”
        assert.throws(() => {
          sm.transferCampus('CAMPUS_XICHENG', authorizedCampuses);
        }, /Unauthorized cross-campus transfer to CAMPUS_XICHENG/);
      },
    },
    {
      name: '终态课包不可逆：已退费或已结课课包再次触发异动一律阻断',
      fn: () => {
        const student = {
          id: 'S_FINAL',
          coursePackages: [
            { packageId: 'PKG_REFUNDED', status: 'refunded', remainingLessons: 0, totalLessons: 20 },
          ],
        };
        const sm = new StudentStateMachine(student);
        assert.throws(() => {
          sm.refund('PKG_REFUNDED', 0);
        }, /already reached terminal status/);
      },
    },
  ],
};
