import { describe, it } from 'vitest';
import assert from '../harness/assert.js';
import { EducationalCollisionEngine as CollisionEngine } from '@/utils/collisionEngine';

const suite = {
  tier: 1,
  featureId: 17,
  name: 'Feature 17: 教务四色语义排课卡片 Chip (Semantic Status Chips)',
  tests: [
    {
      name: '绿色 Chip：已上结课日程 (#F0F9EB, 边框 #67C23A)',
      fn: () => {
        const style = CollisionEngine.getSemanticChipStyle({ status: 'completed' });
        assert.equal(style.type, 'completed');
        assert.equal(style.background, 'var(--st-color-success-light, #F0F9EB)');
        assert.equal(style.borderColor, 'var(--st-color-success, #67C23A)');
        assert.equal(style.badge, '已上');
      },
    },
    {
      name: '红色 Chip：冲突日程 (#FEF0F0, 边框 #F56C6C)',
      fn: () => {
        const style = CollisionEngine.getSemanticChipStyle({ hasConflict: true });
        assert.equal(style.type, 'conflict');
        assert.equal(style.background, 'var(--st-color-danger-light, #FEF0F0)');
        assert.equal(style.borderColor, 'var(--st-color-danger, #F56C6C)');
        assert.equal(style.badge, '冲突');
      },
    },
    {
      name: '紫色 Chip：个人日程 (#F9F0FF, 边框 #722ED1)',
      fn: () => {
        const style = CollisionEngine.getSemanticChipStyle({ isPersonal: true });
        assert.equal(style.type, 'personal');
        assert.equal(style.background, 'var(--st-color-purple-light, #F9F0FF)');
        assert.equal(style.borderColor, 'var(--st-color-purple, #722ED1)');
        assert.equal(style.badge, '个人');
      },
    },
    {
      name: '蓝色 Chip：普通日常排课 (#ECF5FF, 边框 #409EFF)',
      fn: () => {
        const style = CollisionEngine.getSemanticChipStyle({ status: 'normal' });
        assert.equal(style.type, 'regular');
        assert.equal(style.background, 'var(--st-color-primary-light, #ECF5FF)');
        assert.equal(style.borderColor, 'var(--st-color-primary, #409EFF)');
        assert.equal(style.badge, '正');
      },
    },
  ],
};

describe(suite.name, () => {
  for (const t of suite.tests) it(t.name, t.fn);
});
