const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');

module.exports = {
  tier: 2,
  featureId: 15,
  name: 'Feature 15 (Boundary): 教务 7x15 动态时间排课网格边界 (Time Grid Boundary)',
  tests: [
    {
      name: '跨午夜时段排课阻断：21:30 - 23:00 超过 22:00 视口抛错阻断',
      fn: () => {
        const check = CollisionEngine.validateScheduleTimeWindow('21:30', '23:00');
        assert.isFalse(check.valid);
        assert.includes(check.reason, 'cannot exceed 22:00');
      },
    },
    {
      name: '早于 07:00 开始的排课严格阻断抛错 (如 06:30 - 08:00)',
      fn: () => {
        const check = CollisionEngine.validateScheduleTimeWindow('06:30', '08:00');
        assert.isFalse(check.valid);
        assert.includes(check.reason, 'cannot be earlier than 07:00');
      },
    },
    {
      name: '排课时长为 0 或倒流（结束时间早于等于开始时间）严格阻断',
      fn: () => {
        const check1 = CollisionEngine.validateScheduleTimeWindow('10:00', '10:00');
        assert.isFalse(check1.valid);
        assert.includes(check1.reason, 'strictly after start time');

        const check2 = CollisionEngine.validateScheduleTimeWindow('10:00', '09:00');
        assert.isFalse(check2.valid);
        assert.includes(check2.reason, 'strictly after start time');
      },
    },
    {
      name: '时间格式非法输入拦截 (非数字、越界分钟等)',
      fn: () => {
        assert.throws(() => CollisionEngine.parseTimeToMinutes('25:00'), /Invalid time value/);
        assert.throws(() => CollisionEngine.parseTimeToMinutes('08:61'), /Invalid time value/);
        assert.throws(() => CollisionEngine.parseTimeToMinutes('invalid_time'), /Invalid time format/);
      },
    },
    {
      name: '极端超短排课（如仅 15 分钟 08:00-08:15）卡片高度计算与微排版适配',
      fn: () => {
        const check = CollisionEngine.validateScheduleTimeWindow('08:00', '08:15');
        assert.isTrue(check.valid);
        assert.equal(check.durationMinutes, 15);
      },
    },
  ],
};
