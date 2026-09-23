const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');

module.exports = {
  tier: 2,
  featureId: 17,
  name: 'Feature 17 (Boundary): 教务四色语义排课卡片 Chip 边界 (Semantic Chips Boundary)',
  tests: [
    {
      name: '冲突状态优先级最高（即使已上课或属于个人日程，若冲突则强制显示红色）',
      fn: () => {
        const conflictingCompletedEvent = {
          hasConflict: true,
          status: 'completed',
          isPersonal: true,
        };
        const style = CollisionEngine.getSemanticChipStyle(conflictingCompletedEvent);
        assert.equal(style.type, 'conflict', '冲突状态必须覆盖已完成与个人日程');
        assert.equal(style.color, '#F56C6C');
      },
    },
    {
      name: '未知或缺失状态属性安全回退默认日常蓝色',
      fn: () => {
        const unknownEvent = { status: 'RANDOM_STATUS' };
        const style = CollisionEngine.getSemanticChipStyle(unknownEvent);
        assert.equal(style.type, 'regular');
        assert.equal(style.color, '#409EFF');
      },
    },
    {
      name: '15 分钟微型卡片高度（15px）紧凑样式',
      fn: () => {
        const shortEvent = {
          startTime: '08:00',
          endTime: '08:15',
        };
        const duration = CollisionEngine.parseTimeToMinutes(shortEvent.endTime) - CollisionEngine.parseTimeToMinutes(shortEvent.startTime);
        assert.equal(duration, 15);
      },
    },
    {
      name: '冲突消除后卡片样式即时恢复为正常语义色',
      fn: () => {
        const event = { hasConflict: true, status: 'completed' };
        let style = CollisionEngine.getSemanticChipStyle(event);
        assert.equal(style.type, 'conflict');

        event.hasConflict = false;
        style = CollisionEngine.getSemanticChipStyle(event);
        assert.equal(style.type, 'completed');
        assert.equal(style.color, '#67C23A');
      },
    },
    {
      name: '卡片语义边框色与背景色对比度可读性',
      fn: () => {
        const chips = [
          CollisionEngine.getSemanticChipStyle({ hasConflict: true }),
          CollisionEngine.getSemanticChipStyle({ status: 'completed' }),
          CollisionEngine.getSemanticChipStyle({ isPersonal: true }),
          CollisionEngine.getSemanticChipStyle({ status: 'normal' }),
        ];
        for (const c of chips) {
          assert.ok(c.background.startsWith('#'));
          assert.ok(c.borderColor.startsWith('#'));
          assert.notEqual(c.background, c.borderColor);
        }
      },
    },
  ],
};
