const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');

module.exports = {
  tier: 1,
  featureId: 18,
  name: 'Feature 18: 教务三维动态冲突检测引擎 (3D Collision Detection Engine)',
  tests: [
    {
      name: '教师时间维度重叠冲突检测',
      fn: () => {
        const existing = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:30', teacherId: 'T_ZHANG' },
        ];
        const target = {
          date: '2026-09-21',
          startTime: '10:00',
          endTime: '11:30',
          teacherId: 'T_ZHANG',
        };
        const res = CollisionEngine.detectCollision(target, existing);
        assert.isTrue(res.hasConflict);
        assert.equal(res.conflicts[0].type, 'TEACHER_CONFLICT');
      },
    },
    {
      name: '物理教室占用维度重叠冲突检测',
      fn: () => {
        const existing = [
          { id: 'E1', date: '2026-09-21', startTime: '14:00', endTime: '15:30', classroomId: 'ROOM_1' },
        ];
        const target = {
          date: '2026-09-21',
          startTime: '14:30',
          endTime: '16:00',
          classroomId: 'ROOM_1',
        };
        const res = CollisionEngine.detectCollision(target, existing);
        assert.isTrue(res.hasConflict);
        assert.equal(res.conflicts[0].type, 'CLASSROOM_CONFLICT');
      },
    },
    {
      name: '学员排课冲突检测 (同一学员不可同时在两班)',
      fn: () => {
        const existing = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:30', studentIds: ['STU_A', 'STU_B'] },
        ];
        const target = {
          date: '2026-09-21',
          startTime: '09:30',
          endTime: '11:00',
          studentIds: ['STU_B', 'STU_C'],
        };
        const res = CollisionEngine.detectCollision(target, existing);
        assert.isTrue(res.hasConflict);
        assert.equal(res.conflicts[0].type, 'STUDENT_CONFLICT');
        assert.includes(res.conflicts[0].studentIds, 'STU_B');
      },
    },
    {
      name: '编辑课次时支持 excludeEventId 豁免自身',
      fn: () => {
        const existing = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:30', teacherId: 'T_ZHANG' },
        ];
        const target = {
          excludeEventId: 'E1',
          date: '2026-09-21',
          startTime: '09:00',
          endTime: '10:30',
          teacherId: 'T_ZHANG',
        };
        const res = CollisionEngine.detectCollision(target, existing);
        assert.isFalse(res.hasConflict);
      },
    },
    {
      name: '无冲突合规排课验证通过',
      fn: () => {
        const existing = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:00', teacherId: 'T_ZHANG', classroomId: 'R1', studentIds: ['S1'] },
        ];
        const target = {
          date: '2026-09-21',
          startTime: '10:00',
          endTime: '11:00',
          teacherId: 'T_ZHANG', // 串行紧邻
          classroomId: 'R2',
          studentIds: ['S2'],
        };
        const res = CollisionEngine.detectCollision(target, existing);
        assert.isFalse(res.hasConflict);
      },
    },
  ],
};
