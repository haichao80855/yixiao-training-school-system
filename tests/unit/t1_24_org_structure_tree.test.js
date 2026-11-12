const assert = require('../harness/assert');
const RBACEngine = require('../helpers/load-ts.cjs')('src/utils/rbacEngine.ts').RBACEngine;

module.exports = {
  tier: 1,
  featureId: 24,
  name: 'Feature 24: 系统设置 5 级组织架构树 (5-Level Organizational Structure)',
  tests: [
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
  ],
};
