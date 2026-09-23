const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');

module.exports = {
  tier: 1,
  featureId: 16,
  name: 'Feature 16: 教务排课 Lane 自适应并列算法 (Schedule Lane Allocation)',
  tests: [
    {
      name: '单个课次独占单列 (Lane 0, width 100%)',
      fn: () => {
        const events = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:30' },
        ];
        const res = CollisionEngine.allocateLanes(events);
        assert.lengthOf(res, 1);
        assert.equal(res[0].laneIndex, 0);
        assert.equal(res[0].style.width, '100%');
        assert.equal(res[0].style.left, '0%');
      },
    },
    {
      name: '两个重叠课次均分双列 (Lane 0 & 1, width 50%)',
      fn: () => {
        const events = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:30' },
          { id: 'E2', date: '2026-09-21', startTime: '09:30', endTime: '11:00' },
        ];
        const res = CollisionEngine.allocateLanes(events);
        assert.lengthOf(res, 2);
        assert.equal(res[0].style.width, '50%');
        assert.equal(res[1].style.width, '50%');
        assert.equal(res[0].style.left, '0%');
        assert.equal(res[1].style.left, '50%');
      },
    },
    {
      name: '三个重叠课次均分三列 (Lane 0, 1, 2, width 33.33%)',
      fn: () => {
        const events = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '11:00' },
          { id: 'E2', date: '2026-09-21', startTime: '09:30', endTime: '11:00' },
          { id: 'E3', date: '2026-09-21', startTime: '10:00', endTime: '11:30' },
        ];
        const res = CollisionEngine.allocateLanes(events);
        assert.lengthOf(res, 3);
        assert.equal(res[0].style.width, '33.33%');
        assert.equal(res[1].style.width, '33.33%');
        assert.equal(res[2].style.width, '33.33%');
      },
    },
    {
      name: '先后串行课次不重叠时复用 Lane 0',
      fn: () => {
        const events = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:00' },
          { id: 'E2', date: '2026-09-21', startTime: '10:00', endTime: '11:00' },
        ];
        const res = CollisionEngine.allocateLanes(events);
        assert.lengthOf(res, 2);
        assert.equal(res[0].laneIndex, 0);
        assert.equal(res[1].laneIndex, 0);
        assert.equal(res[0].style.width, '100%');
        assert.equal(res[1].style.width, '100%');
      },
    },
    {
      name: '最大 Lane 数量上限为 4 列约束',
      fn: () => {
        const events = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '11:00' },
          { id: 'E2', date: '2026-09-21', startTime: '09:00', endTime: '11:00' },
          { id: 'E3', date: '2026-09-21', startTime: '09:00', endTime: '11:00' },
          { id: 'E4', date: '2026-09-21', startTime: '09:00', endTime: '11:00' },
        ];
        const res = CollisionEngine.allocateLanes(events, 4);
        assert.lengthOf(res, 4);
        assert.equal(res[0].style.width, '25%');
        assert.equal(res[3].laneIndex, 3);
      },
    },
  ],
};
