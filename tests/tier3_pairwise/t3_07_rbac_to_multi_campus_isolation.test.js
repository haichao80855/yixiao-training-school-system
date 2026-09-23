const assert = require('../harness/assert');
const RBACEngine = require('../contracts/rbacEngine');
const TenantContext = require('../contracts/tenantContext');

module.exports = {
  tier: 3,
  name: 'Tier 3.7: RBAC 角色权限与多校区数据隔离穿透 (RBAC -> Multi-Campus Scope)',
  tests: [
    {
      name: '分校教务角色登录：锁定当前校区且禁止越权查看财务模块与他校数据',
      fn: () => {
        // 用户定义
        const branchTeacherUser = {
          id: 'USER_HD_01',
          name: '海淀讲师小赵',
          campusId: 'CAMPUS_HAIDIAN',
          dataScope: 'campus',
          permissions: ['curriculum:view', 'educational:schedule:view', 'educational:workbench:attend'],
        };

        // 1. 模块可见性鉴权
        assert.isTrue(RBACEngine.hasPermission(branchTeacherUser.permissions, 'educational:schedule:view'));
        assert.isFalse(RBACEngine.hasPermission(branchTeacherUser.permissions, 'financial:order:view'));

        // 2. 租户上下文锁定
        const tenant = new TenantContext({ currentCampusId: branchTeacherUser.campusId });
        assert.equal(tenant.getCurrentCampus().id, 'CAMPUS_HAIDIAN');

        // 3. 数据过滤：仅能看到海淀校区排课与学员
        const allStudents = [
          { id: 'S1', campusId: 'CAMPUS_HQ' },
          { id: 'S2', campusId: 'CAMPUS_HAIDIAN' },
          { id: 'S3', campusId: 'CAMPUS_CHAOYANG' },
        ];
        const visibleStudents = RBACEngine.filterByDataScope(branchTeacherUser, allStudents);
        assert.lengthOf(visibleStudents, 1);
        assert.equal(visibleStudents[0].id, 'S2');
      },
    },
  ],
};
