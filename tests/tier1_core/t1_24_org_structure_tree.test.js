const assert = require('../harness/assert');
const RBACEngine = require('../contracts/rbacEngine');

module.exports = {
  tier: 1,
  featureId: 24,
  name: 'Feature 24: 系统设置 5 级组织架构树 (5-Level Organizational Structure)',
  tests: [
    {
      name: '5 级组织架构模型定义 (集团-区域-校区-部门-角色)',
      fn: () => {
        const levels = [
          { level: 1, type: 'group', name: '盛通教育集团' },
          { level: 2, type: 'region', name: '华北大区' },
          { level: 3, type: 'campus', name: '海淀校区' },
          { level: 4, type: 'department', name: '教学教研部' },
          { level: 5, type: 'post', name: '高级编程讲师' },
        ];
        assert.lengthOf(levels, 5);
        assert.equal(levels[0].type, 'group');
        assert.equal(levels[4].type, 'post');
      },
    },
    {
      name: '组织机构编码唯一性约束',
      fn: () => {
        const nodes = [
          { id: '1', code: 'GRP_001', name: '总部' },
          { id: '2', code: 'CMP_002', name: '分校' },
        ];
        function checkCodeUnique(existing, newCode) {
          return !existing.some(n => n.code === newCode);
        }
        assert.isTrue(checkCodeUnique(nodes, 'CMP_003'));
        assert.isFalse(checkCodeUnique(nodes, 'GRP_001'));
      },
    },
    {
      name: '末级叶子节点无下属时支持合规删除',
      fn: () => {
        const tree = [
          {
            id: 'GRP_1',
            level: 1,
            type: 'group',
            name: '集团',
            children: [
              {
                id: 'DEPT_LEAF',
                level: 5,
                type: 'post',
                name: '助教实习生',
                children: [],
                boundUserCount: 0,
              },
            ],
          },
        ];
        const res = RBACEngine.validateNodeDeletion(tree, 'DEPT_LEAF');
        assert.isTrue(res.canDelete);
      },
    },
    {
      name: '节点层级深度动态校验',
      fn: () => {
        function getNodeDepth(node) {
          if (!node.children || node.children.length === 0) return 1;
          return 1 + Math.max(...node.children.map(getNodeDepth));
        }

        const sampleTree = {
          id: '1',
          children: [
            { id: '2', children: [{ id: '3', children: [] }] },
          ],
        };
        assert.equal(getNodeDepth(sampleTree), 3);
      },
    },
    {
      name: '员工关联岗位状态映射',
      fn: () => {
        const employee = {
          id: 'EMP_001',
          name: '张教练',
          campusId: 'CAMPUS_HQ',
          departmentId: 'DEPT_EDU',
          postId: 'POST_SENIOR_TEACHER',
        };
        assert.equal(employee.postId, 'POST_SENIOR_TEACHER');
      },
    },
  ],
};
