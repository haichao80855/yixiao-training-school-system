const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');

module.exports = {
  tier: 2,
  featureId: 18,
  name: 'Feature 18 (Boundary): 教务三维冲突检测引擎边界 (3D Collision Engine Boundary)',
  tests: [
    {
      name: '批量排课时部分学员存在冲突返回冲突学员列表及具体课次',
      fn: () => {
        const existing = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:30', studentIds: ['S1', 'S2'] },
        ];
        const target = {
          date: '2026-09-21',
          startTime: '09:30',
          endTime: '11:00',
          studentIds: ['S2', 'S3', 'S4'], // S2 冲突，S3 和 S4 不冲突
        };
        const res = CollisionEngine.detectCollision(target, existing);
        assert.isTrue(res.hasConflict);
        assert.equal(res.conflicts[0].type, 'STUDENT_CONFLICT');
        assert.deepEqual(res.conflicts[0].studentIds, ['S2']);
      },
    },
    {
      name: '物理教室容纳上限与排课学生数校验（超额抛出容量冲突）',
      fn: () => {
        const classrooms = {
          ROOM_SMALL: { id: 'ROOM_SMALL', name: '小创客微教室', capacity: 6 },
        };
        const target = {
          date: '2026-09-21',
          startTime: '10:00',
          endTime: '11:30',
          classroomId: 'ROOM_SMALL',
          studentIds: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'], // 7 人超容
        };
        const res = CollisionEngine.detectCollision(target, [], classrooms);
        assert.isTrue(res.hasConflict);
        assert.equal(res.conflictType, 'CLASSROOM_CAPACITY_EXCEEDED');
      },
    },
    {
      name: '不同日期的排课无论时段如何均不产生时间冲突',
      fn: () => {
        const existing = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:30', teacherId: 'T1' },
        ];
        const target = {
          date: '2026-09-22', // 次日
          startTime: '09:00',
          endTime: '10:30',
          teacherId: 'T1',
        };
        const res = CollisionEngine.detectCollision(target, existing);
        assert.isFalse(res.hasConflict);
      },
    },
    {
      name: '毫秒级高密度大规模课次冲突核验耗时 (< 50ms)',
      fn: () => {
        // 生成 300 节已有课次
        const existing = Array.from({ length: 300 }, (_, i) => ({
          id: `EVT_${i}`,
          date: '2026-09-21',
          startTime: '08:00',
          endTime: '09:00',
          teacherId: `TEACHER_${i % 20}`,
          classroomId: `ROOM_${i % 10}`,
          studentIds: [`STU_${i % 50}`],
        }));

        const target = {
          date: '2026-09-21',
          startTime: '08:30',
          endTime: '09:30',
          teacherId: 'TEACHER_1',
          classroomId: 'ROOM_2',
          studentIds: ['STU_999'],
        };

        const t0 = Date.now();
        const res = CollisionEngine.detectCollision(target, existing);
        const cost = Date.now() - t0;
        assert.isTrue(res.hasConflict);
        assert.ok(cost < 50, `300节课防撞检测耗时应小于 50ms，实际耗时 ${cost}ms`);
      },
    },
    {
      name: '历史已结课课次免除冲突阻断',
      fn: () => {
        const existing = [
          { id: 'E_OLD', date: '2026-09-21', startTime: '09:00', endTime: '10:00', teacherId: 'T1', isArchived: true },
        ];
        function detectWithArchivedExemption(tgt, list) {
          const activeList = list.filter(e => !e.isArchived);
          return CollisionEngine.detectCollision(tgt, activeList);
        }

        const target = { date: '2026-09-21', startTime: '09:00', endTime: '10:00', teacherId: 'T1' };
        const res = detectWithArchivedExemption(target, existing);
        assert.isFalse(res.hasConflict);
      },
    },
  ],
};
