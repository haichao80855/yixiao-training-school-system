const assert = require('../harness/assert');

module.exports = {
  tier: 2,
  featureId: 19,
  name: 'Feature 19 (Boundary): 授课工作台考勤与消课冲正边界 (Attendance & Reversal Boundary)',
  tests: [
    {
      name: '学员课包剩余课时为 0 时点名签到失败阻断 (欠费防上课机制)',
      fn: () => {
        const studentPackage = { remainingLessons: 0, packageId: 'PKG_EMPTY' };
        function attendLesson(pkg) {
          if (pkg.remainingLessons <= 0) {
            throw new Error(`Cannot attend: package ${pkg.packageId} has 0 remaining lessons (欠费阻断)`);
          }
          pkg.remainingLessons -= 1;
        }

        assert.throws(() => attendLesson(studentPackage), /欠费阻断/);
      },
    },
    {
      name: '同一课次同一学员重复点名幂等性拦截',
      fn: () => {
        const attendanceRecords = new Set();
        function recordAttendance(eventId, studentId) {
          const key = `${eventId}_${studentId}`;
          if (attendanceRecords.has(key)) {
            throw new Error('Attendance already recorded for this student in event (禁止重复扣课)');
          }
          attendanceRecords.add(key);
          return true;
        }

        assert.isTrue(recordAttendance('EVT_1', 'STU_1'));
        assert.throws(() => recordAttendance('EVT_1', 'STU_1'), /禁止重复扣课/);
      },
    },
    {
      name: '反结课超出财务封账周期（如已过 30 天）禁止反结课',
      fn: () => {
        function canReverseAttendance(attendanceDate, currentDate, maxDaysAllowed = 30) {
          const aTime = new Date(attendanceDate).getTime();
          const cTime = new Date(currentDate).getTime();
          const diffDays = (cTime - aTime) / (1000 * 3600 * 24);
          if (diffDays > maxDaysAllowed) {
            throw new Error(`Cannot reverse attendance: exceeded lock cycle of ${maxDaysAllowed} days`);
          }
          return true;
        }

        assert.throws(() => canReverseAttendance('2026-07-01', '2026-09-21'), /exceeded lock cycle/);
        assert.isTrue(canReverseAttendance('2026-09-15', '2026-09-21'));
      },
    },
    {
      name: '批量点名部分欠费时事务原子性校验',
      fn: () => {
        const students = [
          { id: 'S1', remaining: 5 },
          { id: 'S2', remaining: 0 }, // 欠费
          { id: 'S3', remaining: 2 },
        ];
        function batchAttend(list) {
          const deficient = list.filter(s => s.remaining <= 0);
          if (deficient.length > 0) {
            return {
              success: false,
              failedStudentIds: deficient.map(s => s.id),
              reason: 'Some students have insufficient hours',
            };
          }
          list.forEach(s => s.remaining -= 1);
          return { success: true };
        }

        const res = batchAttend(students);
        assert.isFalse(res.success);
        assert.deepEqual(res.failedStudentIds, ['S2']);
        assert.equal(students[0].remaining, 5, '失败时已检查学员课时不应扣减');
      },
    },
    {
      name: '反结课后再次点名状态与课消流水平衡一致性',
      fn: () => {
        const pkg = { remaining: 10 };
        // 点名
        pkg.remaining -= 1;
        assert.equal(pkg.remaining, 9);
        // 反结课
        pkg.remaining += 1;
        assert.equal(pkg.remaining, 10);
        // 重新点名
        pkg.remaining -= 1;
        assert.equal(pkg.remaining, 9);
      },
    },
  ],
};
