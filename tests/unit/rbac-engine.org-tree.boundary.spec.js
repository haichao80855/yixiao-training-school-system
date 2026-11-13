import { describe, it } from 'vitest';
import assert from '../harness/assert.js';
import { RBACEngine } from '@/utils/rbacEngine';

const suite = {
  tier: 2,
  featureId: 24,
  name: 'Feature 24 (Boundary): 系统设置 5 级组织架构树边界 (Org Structure Boundary)',
  tests: [
    {
      name: '组织树含子节点删除阻断：删除含下级节点的部门抛出 HasChildNodesException 阻断',
      fn: () => {
        const tree = [
          {
            id: 'GRP_1',
            level: 1,
            type: 'group',
            name: '拓视未来教育集团',
            children: [
              {
                id: 'CAMPUS_HD',
                level: 3,
                type: 'campus',
                name: '海淀世纪金源校区',
                children: [
                  { id: 'DEPT_EDU', level: 4, type: 'department', name: '教学部', children: [] },
                ],
              },
            ],
          },
        ];

        // 尝试删除海淀校区（其下包含教学部子节点）
        assert.throws(() => {
          RBACEngine.validateNodeDeletion(tree, 'CAMPUS_HD');
        }, /HasChildNodesException/);
      },
    },
    {
      name: '根节点集团机构绝对禁止删除阻断',
      fn: () => {
        const tree = [
          {
            id: 'GRP_ROOT',
            level: 1,
            type: 'group',
            name: '拓视未来教育集团',
            children: [],
          },
        ];
        assert.throws(() => {
          RBACEngine.validateNodeDeletion(tree, 'GRP_ROOT');
        }, /Root organization group node cannot be deleted/);
      },
    },
    {
      name: '已绑定在职员工的岗位节点禁止直接删除',
      fn: () => {
        const tree = [
          {
            id: 'GRP',
            level: 1,
            children: [
              {
                id: 'POST_ACTIVE',
                level: 5,
                type: 'post',
                name: '资深教师岗',
                children: [],
                boundUserCount: 3, // 绑定了 3 名在职员工
              },
            ],
          },
        ];
        assert.throws(() => {
          RBACEngine.validateNodeDeletion(tree, 'POST_ACTIVE');
        }, /bound to 3 active employees/);
      },
    },
  ],
};

describe(suite.name, () => {
  for (const t of suite.tests) it(t.name, t.fn);
});
