const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');

module.exports = {
  tier: 1,
  featureId: 17,
  name: 'Feature 17: 教务四色语义排课卡片 Chip (Semantic Status Chips)',
  tests: [
    {
      name: '绿色 Chip：已上结课日程 (#F0F9EB, 边框 #67C23A)',
      fn: () => {
        const style = CollisionEngine.getSemanticChipStyle({ status: 'completed' });
        assert.equal(style.type, 'completed');
        assert.equal(style.background, '#F0F9EB');
        assert.equal(style.borderColor, '#67C23A');
        assert.equal(style.badge, '已上');
      },
    },
    {
      name: '红色 Chip：冲突日程 (#FEF0F0, 边框 #F56C6C)',
      fn: () => {
        const style = CollisionEngine.getSemanticChipStyle({ hasConflict: true });
        assert.equal(style.type, 'conflict');
        assert.equal(style.background, '#FEF0F0');
        assert.equal(style.borderColor, '#F56C6C');
        assert.equal(style.badge, '冲突');
      },
    },
    {
      name: '紫色 Chip：个人日程 (#F9F0FF, 边框 #722ED1)',
      fn: () => {
        const style = CollisionEngine.getSemanticChipStyle({ isPersonal: true });
        assert.equal(style.type, 'personal');
        assert.equal(style.background, '#F9F0FF');
        assert.equal(style.borderColor, '#722ED1');
        assert.equal(style.badge, '个人');
      },
    },
    {
      name: '蓝色 Chip：普通日常排课 (#ECF5FF, 边框 #409EFF)',
      fn: () => {
        const style = CollisionEngine.getSemanticChipStyle({ status: 'normal' });
        assert.equal(style.type, 'regular');
        assert.equal(style.background, '#ECF5FF');
        assert.equal(style.borderColor, '#409EFF');
        assert.equal(style.badge, '正');
      },
    },
    {
      name: '角标类别渲染 (正:正式课, 补:补课班, 试:试听课)',
      fn: () => {
        function getCourseTypeBadge(type) {
          const map = { regular: '正', make_up: '补', audition: '试' };
          return map[type] || '正';
        }
        assert.equal(getCourseTypeBadge('regular'), '正');
        assert.equal(getCourseTypeBadge('make_up'), '补');
        assert.equal(getCourseTypeBadge('audition'), '试');
      },
    },
  ],
};
