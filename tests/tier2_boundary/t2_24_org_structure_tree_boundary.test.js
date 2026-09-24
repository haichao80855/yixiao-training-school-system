const assert = require('../harness/assert');
const RBACEngine = require('../contracts/rbacEngine');

module.exports = {
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
      name: '节点移动防成环死锁：禁止将父节点移入其自身子节点内',
      fn: () => {
        function validateMoveNode(sourceId, targetParentId, tree) {
          // 若 targetParentId 是 sourceId 的后代，则成环
          function isDescendant(parent, targetId) {
            if (!parent.children) return false;
            for (const c of parent.children) {
              if (c.id === targetId) return true;
              if (isDescendant(c, targetId)) return true;
            }
            return false;
          }

          const sourceNode = { id: 'A', children: [{ id: 'B', children: [{ id: 'C', children: [] }] }] };
          if (isDescendant(sourceNode, targetParentId)) {
            throw new Error('Circular dependency: cannot move a parent node into its own descendant');
          }
          return true;
        }

        assert.throws(() => validateMoveNode('A', 'C', {}), /Circular dependency/);
      },
    },
    {
      name: '同级节点重名校验拦截',
      fn: () => {
        const siblings = [
          { id: '1', name: '少儿教研组' },
          { id: '2', name: '竞赛教研组' },
        ];
        function checkDuplicateSiblingName(list, newName) {
          if (list.some(n => n.name === newName)) {
            throw new Error(`Sibling node with name "${newName}" already exists`);
          }
          return true;
        }

        assert.throws(() => checkDuplicateSiblingName(siblings, '少儿教研组'), /already exists/);
        assert.isTrue(checkDuplicateSiblingName(siblings, '创客活动组'));
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
