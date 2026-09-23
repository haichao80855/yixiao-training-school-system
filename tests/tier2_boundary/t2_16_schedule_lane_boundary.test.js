const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');

module.exports = {
  tier: 2,
  featureId: 16,
  name: 'Feature 16 (Boundary): 教务排课 Lane 自适应并列算法边界 (Schedule Lane Boundary)',
  tests: [
    {
      name: '排课时间 1 分钟重叠碰撞：09:00-10:00 与 09:59-10:30 精准判定碰撞并分 Lane',
      fn: () => {
        // 09:00-10:00 (540-600) 与 09:59-10:30 (599-630)
        // max(540, 599)=599 < min(600, 630)=600 => 重叠 1 分钟！
        const isOverlap = CollisionEngine.isOverlapping('09:00', '10:00', '09:59', '10:30');
        assert.isTrue(isOverlap, '重叠 1 分钟必须判定为冲突');

        const events = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:00' },
          { id: 'E2', date: '2026-09-21', startTime: '09:59', endTime: '10:30' },
        ];
        const lanes = CollisionEngine.allocateLanes(events);
        assert.lengthOf(lanes, 2);
        assert.equal(lanes[0].laneIndex, 0);
        assert.equal(lanes[1].laneIndex, 1);
        assert.equal(lanes[0].style.width, '50%');
        assert.equal(lanes[1].style.width, '50%');
      },
    },
    {
      name: '边界临界相接：09:00-10:00 与 10:00-11:00 判定为串行不碰撞且复用同一 Lane',
      fn: () => {
        // max(540, 600)=600, min(600, 660)=600 => 600 < 600 为 false！
        const isOverlap = CollisionEngine.isOverlapping('09:00', '10:00', '10:00', '11:00');
        assert.isFalse(isOverlap, '边界相接半开半闭区间不应判定为重叠');

        const events = [
          { id: 'E1', date: '2026-09-21', startTime: '09:00', endTime: '10:00' },
          { id: 'E2', date: '2026-09-21', startTime: '10:00', endTime: '11:00' },
        ];
        const lanes = CollisionEngine.allocateLanes(events);
        assert.lengthOf(lanes, 2);
        assert.equal(lanes[0].laneIndex, 0);
        assert.equal(lanes[1].laneIndex, 0);
        assert.equal(lanes[0].style.width, '100%');
        assert.equal(lanes[1].style.width, '100%');
      },
    },
    {
      name: '超过 4 列极大重叠时的上限收敛保护',
      fn: () => {
        const events = Array.from({ length: 6 }, (_, i) => ({
          id: `E_${i + 1}`,
          date: '2026-09-21',
          startTime: '09:00',
          endTime: '11:00',
        }));
        const lanes = CollisionEngine.allocateLanes(events, 4);
        assert.lengthOf(lanes, 6);
        // 所有课次的最大可用 laneIndex 不超过 3 (即 4 列)
        for (const l of lanes) {
          assert.ok(l.laneIndex <= 3);
          assert.equal(l.style.width, '25%');
        }
      },
    },
    {
      name: '完全乱序输入的课次能够自适应正确拓扑排序',
      fn: () => {
        const events = [
          { id: 'E3', date: '2026-09-21', startTime: '14:00', endTime: '15:00' },
          { id: 'E1', date: '2026-09-21', startTime: '08:00', endTime: '09:00' },
          { id: 'E2', date: '2026-09-21', startTime: '10:00', endTime: '11:00' },
        ];
        const lanes = CollisionEngine.allocateLanes(events);
        assert.lengthOf(lanes, 3);
        // 各自独立成行
        assert.equal(lanes[0].style.top, '60px'); // 08:00 (480-420=60)
        assert.equal(lanes[1].style.top, '180px'); // 10:00 (600-420=180)
        assert.equal(lanes[2].style.top, '420px'); // 14:00 (840-420=420)
      },
    },
    {
      name: '完全嵌套课次（包含大课套小课）多列分流',
      fn: () => {
        const events = [
          { id: 'BIG', date: '2026-09-21', startTime: '09:00', endTime: '12:00' },
          { id: 'SMALL', date: '2026-09-21', startTime: '10:00', endTime: '11:00' },
        ];
        const lanes = CollisionEngine.allocateLanes(events);
        assert.lengthOf(lanes, 2);
        assert.equal(lanes[0].laneIndex, 0);
        assert.equal(lanes[1].laneIndex, 1);
      },
    },
  ],
};
