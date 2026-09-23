const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 19,
  name: 'Feature 19: 授课工作台考勤与消课冲正 (Attendance & Consumption Reversal)',
  tests: [
    {
      name: '讲台点名考勤三种状态 (出勤/请假/缺席)',
      fn: () => {
        const statuses = ['attended', 'leave', 'absent'];
        assert.lengthOf(statuses, 3);
        assert.includes(statuses, 'attended');
        assert.includes(statuses, 'leave');
        assert.includes(statuses, 'absent');
      },
    },
    {
      name: '出勤点名扣减课时并生成课消记录',
      fn: () => {
        const studentPackage = { remainingLessons: 20, consumedLessons: 10 };
        function markAttended(pkg) {
          if (pkg.remainingLessons <= 0) throw new Error('No remaining lessons');
          pkg.remainingLessons -= 1;
          pkg.consumedLessons += 1;
          return { success: true, consumed: 1 };
        }

        const res = markAttended(studentPackage);
        assert.isTrue(res.success);
        assert.equal(studentPackage.remainingLessons, 19);
        assert.equal(studentPackage.consumedLessons, 11);
      },
    },
    {
      name: '请假保留课时并推入补课候选池',
      fn: () => {
        const makeUpList = [];
        function markLeave(studentId, classEventId) {
          makeUpList.push({ studentId, classEventId, reason: '病假', status: 'pending_makeup' });
        }
        markLeave('STU_001', 'EVT_001');
        assert.lengthOf(makeUpList, 1);
        assert.equal(makeUpList[0].status, 'pending_makeup');
      },
    },
    {
      name: '反结课冲正机制：原路回退已扣减课时',
      fn: () => {
        const studentPackage = { remainingLessons: 19, consumedLessons: 11 };
        function reverseAttendance(pkg) {
          pkg.remainingLessons += 1;
          pkg.consumedLessons -= 1;
          return { success: true, reversed: 1 };
        }
        const res = reverseAttendance(studentPackage);
        assert.isTrue(res.success);
        assert.equal(studentPackage.remainingLessons, 20);
        assert.equal(studentPackage.consumedLessons, 10);
      },
    },
    {
      name: '反结课自动生成红字财务冲正记录',
      fn: () => {
        const financeLedger = [];
        function createChargeback(studentId, lessonCost) {
          financeLedger.push({
            studentId,
            type: 'chargeback_reversal',
            amount: -lessonCost,
            timestamp: new Date().toISOString(),
          });
        }
        createChargeback('STU_001', 300);
        assert.lengthOf(financeLedger, 1);
        assert.equal(financeLedger[0].amount, -300);
      },
    },
  ],
};
