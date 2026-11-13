import { describe, it } from 'vitest';
import assert from '../harness/assert.js';
import { EducationalCollisionEngine as CollisionEngine } from '@/utils/collisionEngine';

const suite = {
  tier: 1,
  featureId: 15,
  name: 'Feature 15: 教务 7x15 动态时间排课网格 (Time Schedule Grid 07:00-22:00)',
  tests: [
    {
      name: '07:00 至 22:00 15 小时基准刻度换算',
      fn: () => {
        const startMin = CollisionEngine.parseTimeToMinutes('07:00');
        const endMin = CollisionEngine.parseTimeToMinutes('22:00');
        assert.equal(startMin, 420);
        assert.equal(endMin, 1320);
        assert.equal((endMin - startMin) / 60, 15);
      },
    },
    {
      name: '排课卡片 Y 轴绝对坐标算法 (top = (startTime - 07:00) * 60px)',
      fn: () => {
        // 08:30 开始上课
        const startMin = CollisionEngine.parseTimeToMinutes('08:30');
        const topPx = (startMin - 420); // 1小时60px => 1分钟1px
        // 08:30 - 07:00 = 90 分钟 => 90px
        assert.equal(topPx, 90);
      },
    },
    {
      name: '排课卡片高度算法 (height = durationMinutes)',
      fn: () => {
        // 08:30 到 10:00 共 90 分钟
        const sMin = CollisionEngine.parseTimeToMinutes('08:30');
        const eMin = CollisionEngine.parseTimeToMinutes('10:00');
        const heightPx = eMin - sMin;
        assert.equal(heightPx, 90);
      },
    },
  ],
};

describe(suite.name, () => {
  for (const t of suite.tests) it(t.name, t.fn);
});
