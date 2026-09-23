const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');

module.exports = {
  tier: 1,
  featureId: 13,
  name: 'Feature 13: 学员 7 分支异常状态机 (7-Branch Abnormal State Machine)',
  tests: [
    {
      name: '分支 1：转班 (Transfer Class) 正常流转',
      fn: () => {
        const student = {
          id: 'S1',
          status: 'normal',
          coursePackages: [
            { packageId: 'PKG_1', classId: 'CLASS_OLD', status: 'active', remainingLessons: 20 },
          ],
        };
        const sm = new StudentStateMachine(student);
        const res = sm.transferClass('PKG_1', 'CLASS_OLD', 'CLASS_NEW', 15, 10);
        assert.isTrue(res.success);
        assert.equal(sm.getStudent().coursePackages[0].classId, 'CLASS_NEW');
      },
    },
    {
      name: '分支 2：换课 (Change Course) 价值折算与新课包开立',
      fn: () => {
        const student = {
          id: 'S1',
          status: 'normal',
          wallet: { principalBalance: 100, bonusBalance: 0 },
          coursePackages: [
            { packageId: 'PKG_OLD', pricePerLesson: 200, remainingLessons: 10, totalLessons: 20, status: 'active' },
          ],
        };
        const sm = new StudentStateMachine(student);
        const newCourse = { id: 'CRS_NEW', name: 'Python进阶', pricePerLesson: 200 };
        // 10 课时 x 200 = 2000 原价值；新课购买 10 课时 x 200 = 2000；差额为 0
        const res = sm.changeCourse('PKG_OLD', newCourse, 10);
        assert.isTrue(res.success);
        assert.equal(res.diff, 0);
        assert.equal(sm.getStudent().coursePackages[0].status, 'completed');
        assert.equal(sm.getStudent().coursePackages[1].courseId, 'CRS_NEW');
      },
    },
    {
      name: '分支 3 & 4：停课休学与复课解冻联动 (Suspend & Resume)',
      fn: () => {
        const student = {
          id: 'S1',
          status: 'normal',
          coursePackages: [
            { packageId: 'PKG_1', status: 'active', expiryDate: '2026-10-01' },
          ],
        };
        const sm = new StudentStateMachine(student);
        // 停课 30 天
        const suspRes = sm.suspend(30);
        assert.isTrue(suspRes.success);
        assert.equal(sm.getStudent().status, 'suspended');
        assert.equal(sm.getStudent().coursePackages[0].status, 'frozen');
        assert.equal(sm.getStudent().coursePackages[0].expiryDate, '2026-10-31');

        // 复课
        const resumeRes = sm.resume();
        assert.isTrue(resumeRes.success);
        assert.equal(sm.getStudent().status, 'normal');
        assert.equal(sm.getStudent().coursePackages[0].status, 'active');
      },
    },
    {
      name: '分支 5 & 6：转校与转让 (Transfer Campus & Student)',
      fn: () => {
        const studentA = {
          id: 'S_A',
          campusId: 'CAMPUS_HQ',
          status: 'normal',
          wallet: { principalBalance: 500, bonusBalance: 0 },
          coursePackages: [{ packageId: 'PKG_A', status: 'active', remainingLessons: 10, totalLessons: 10 }],
        };
        const sm = new StudentStateMachine(studentA);

        // 转校至海淀校区
        const transCampus = sm.transferCampus('CAMPUS_HAIDIAN', ['CAMPUS_HQ', 'CAMPUS_HAIDIAN']);
        assert.isTrue(transCampus.success);
        assert.equal(sm.getStudent().campusId, 'CAMPUS_HAIDIAN');

        // 转让给学员 B
        const studentB = { id: 'S_B', coursePackages: [], wallet: { principalBalance: 0, bonusBalance: 0 } };
        const transStu = sm.transferStudent(studentB);
        assert.isTrue(transStu.success);
        assert.equal(studentB.wallet.principalBalance, 500);
        assert.lengthOf(studentB.coursePackages, 1);
      },
    },
    {
      name: '分支 7：退费 (Refund) 正常清算与课包注销',
      fn: () => {
        const student = {
          id: 'S1',
          status: 'normal',
          coursePackages: [
            {
              packageId: 'PKG_REF',
              totalLessons: 30,
              remainingLessons: 20,
              bonusLessons: 0,
              pricePerLesson: 200,
              status: 'active',
            },
          ],
        };
        const sm = new StudentStateMachine(student);
        const refRes = sm.refund('PKG_REF', 100); // 100元教材手续费
        assert.isTrue(refRes.success);
        // 剩余 20 课时 x 200 = 4000 - 100 = 3900
        assert.equal(refRes.refundAmount, 3900);
        assert.equal(sm.getStudent().coursePackages[0].status, 'refunded');
      },
    },
  ],
};
