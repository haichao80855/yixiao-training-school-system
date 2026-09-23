const assert = require('../harness/assert');
const RBACEngine = require('../contracts/rbacEngine');

module.exports = {
  tier: 2,
  featureId: 25,
  name: 'Feature 25 (Boundary): 系统设置 4 级细粒度 RBAC 矩阵边界 (RBAC Matrix Boundary)',
  tests: [
    {
      name: '权限树半选 Indeterminate 联动：四级深层树中单按钮勾选导致祖先级联半选',
      fn: () => {
        // 构建 4 级树：系统 -> 模块 -> 页面 -> 按钮
        const tree = {
          id: 'sys_finance',
          checked: false,
          indeterminate: false,
          children: [
            {
              id: 'mod_order',
              checked: false,
              indeterminate: false,
              children: [
                {
                  id: 'page_order_list',
                  checked: false,
                  indeterminate: false,
                  children: [
                    { id: 'btn_export', checked: true }, // 仅勾选导出按钮
                    { id: 'btn_delete', checked: false },
                  ],
                },
              ],
            },
          ],
        };

        // 触发自底向上半选联动更新
        RBACEngine.updateTreeCheckState(tree);

        // 页面节点：1开1关 => checked=false, indeterminate=true
        assert.isFalse(tree.children[0].children[0].checked);
        assert.isTrue(tree.children[0].children[0].indeterminate);

        // 模块节点：其下有半选页面 => checked=false, indeterminate=true
        assert.isFalse(tree.children[0].checked);
        assert.isTrue(tree.children[0].indeterminate);

        // 系统根节点：其下有半选模块 => checked=false, indeterminate=true
        assert.isFalse(tree.checked);
        assert.isTrue(tree.indeterminate);
      },
    },
    {
      name: '全选子树联动：父节点全选或取消勾选时全子树递归级联',
      fn: () => {
        const subtree = {
          id: 'root',
          checked: false,
          children: [
            { id: 'c1', checked: false, children: [{ id: 'gc1', checked: false }] },
            { id: 'c2', checked: false, children: [] },
          ],
        };

        // 勾选父节点
        RBACEngine.setSubtreeChecked(subtree, true);
        assert.isTrue(subtree.checked);
        assert.isTrue(subtree.children[0].checked);
        assert.isTrue(subtree.children[0].children[0].checked);
        assert.isTrue(subtree.children[1].checked);

        // 取消勾选父节点
        RBACEngine.setSubtreeChecked(subtree, false);
        assert.isFalse(subtree.checked);
        assert.isFalse(subtree.children[0].children[0].checked);
      },
    },
    {
      name: '超级管理员统配符 "*" 绕过一切细粒度权限校验',
      fn: () => {
        const adminPerms = ['*'];
        assert.isTrue(RBACEngine.hasPermission(adminPerms, 'any:arbitrary:action'));
        assert.isTrue(RBACEngine.hasPermission(adminPerms, 'order:dangerous_delete'));
      },
    },
    {
      name: '无权限用户访问受限接口返回 403 阻断',
      fn: () => {
        const userPerms = ['student:view'];
        function authorize(action) {
          if (!RBACEngine.hasPermission(userPerms, action)) {
            throw new Error('403 Forbidden: User lacks required permission');
          }
          return true;
        }

        assert.isTrue(authorize('student:view'));
        assert.throws(() => authorize('financial:refund:approve'), /403 Forbidden/);
      },
    },
    {
      name: '数据范围“仅本部门”与“仅本人”精准切分隔离',
      fn: () => {
        const items = [
          { id: '1', departmentId: 'DEP_A', ownerId: 'U_1' },
          { id: '2', departmentId: 'DEP_A', ownerId: 'U_2' },
          { id: '3', departmentId: 'DEP_B', ownerId: 'U_3' },
        ];
        const deptUser = { departmentId: 'DEP_A', id: 'U_1', dataScope: 'department' };
        const deptResult = RBACEngine.filterByDataScope(deptUser, items);
        assert.lengthOf(deptResult, 2);

        const selfUser = { departmentId: 'DEP_A', id: 'U_1', dataScope: 'self' };
        const selfResult = RBACEngine.filterByDataScope(selfUser, items);
        assert.lengthOf(selfResult, 1);
        assert.equal(selfResult[0].id, '1');
      },
    },
  ],
};
