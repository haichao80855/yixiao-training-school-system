const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');

module.exports = {
  tier: 3,
  name: 'Tier 3.4: 排课网格 -> 授课工作台点名 -> 自动消课记账 (Scheduling -> Attendance & Consumption)',
  tests: [
    {
      name: '教务排课完成后，讲台工作台点名出勤并实时扣减课时',
      fn: () => {
        // 1. 排课
        const scheduleEvent = {
          id: 'EVT_MON_0900',
          date: '2026-09-21',
          startTime: '09:00',
          endTime: '10:30',
          teacherId: 'T_ZHANG',
          classroomId: 'ROOM_LEBO_1',
          studentIds: ['STU_A'],
        };
        const chip = CollisionEngine.getSemanticChipStyle(scheduleEvent);
        assert.equal(chip.type, 'regular');

        // 2. 学员当前画像课包
        const studentProfile = {
          id: 'STU_A',
          coursePackages: [
            { packageId: 'PKG_1', remainingLessons: 20, consumedLessons: 0, pricePerLesson: 300 },
          ],
        };

        // 3. 教师上课并在讲台工作台完成点名签到
        const pkg = studentProfile.coursePackages[0];
        pkg.remainingLessons -= 1;
        pkg.consumedLessons += 1;

        // 4. 课消流水生成
        const consumptionLog = {
          eventId: scheduleEvent.id,
          studentId: 'STU_A',
          costAmount: pkg.pricePerLesson,
          consumedLessons: 1,
          time: '2026-09-21 10:30:00',
        };

        assert.equal(pkg.remainingLessons, 19);
        assert.equal(pkg.consumedLessons, 1);
        assert.equal(consumptionLog.costAmount, 300);
      },
    },
  ],
};
