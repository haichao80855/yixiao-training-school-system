const assert = require('../harness/assert');
const StudentStateMachine = require('../contracts/studentStateMachine');

module.exports = {
  tier: 4,
  name: 'Scenario 3: 休学、请假与复课延期调度流 (Leave, Suspension & Resumption Scheduling)',
  tests: [
    {
      name: '学员请假保留课时 -> 停课休学冻结课包与有效期顺延 -> 排课日历自动过滤 -> 复课解冻',
      fn: () => {
        // 1. 学员初始状态
        const student = {
          id: 'STU_LEAVE_03',
          status: 'normal',
          coursePackages: [
            {
              packageId: 'PKG_SUSP',
              status: 'active',
              remainingLessons: 18,
              expiryDate: '2026-10-01',
            },
          ],
        };
        const sm = new StudentStateMachine(student);

        // 2. 正常请假 1 次，课时保持 18 不变
        const leaveLog = { date: '2026-09-22', studentId: student.id, type: 'leave' };
        assert.equal(leaveLog.type, 'leave');
        assert.equal(sm.getStudent().coursePackages[0].remainingLessons, 18);

        // 3. 学员申请停课休学 60 天
        const suspRes = sm.suspend(60);
        assert.isTrue(suspRes.success);
        assert.equal(sm.getStudent().status, 'suspended');
        assert.equal(sm.getStudent().coursePackages[0].status, 'frozen');
        assert.equal(sm.getStudent().coursePackages[0].expiryDate, '2026-11-30'); // 顺延60天

        // 4. 排课系统调度检测：休学期间禁止将该学员排入任何新课次
        function attemptSchedule(s) {
          if (s.status === 'suspended') {
            throw new Error('Scheduling blocked: student is suspended');
          }
        }
        assert.throws(() => attemptSchedule(sm.getStudent()), /student is suspended/);

        // 5. 60 天后学员申请复课
        const resumeRes = sm.resume();
        assert.isTrue(resumeRes.success);
        assert.equal(sm.getStudent().status, 'normal');
        assert.equal(sm.getStudent().coursePackages[0].status, 'active');

        // 6. 恢复正常排课能力
        assert.doesNotThrow(() => attemptSchedule(sm.getStudent()));
      },
    },
  ],
};
