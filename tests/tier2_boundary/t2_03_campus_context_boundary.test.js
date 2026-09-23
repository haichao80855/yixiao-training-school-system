const assert = require('../harness/assert');
const TenantContext = require('../contracts/tenantContext');

module.exports = {
  tier: 2,
  featureId: 3,
  name: 'Feature 3 (Boundary): 多校区上下文隔离中台边界 (Campus Context Boundary)',
  tests: [
    {
      name: '切换至不存在或未授权的校区 ID 抛出异常阻断',
      fn: () => {
        const tenant = new TenantContext();
        assert.throws(() => {
          tenant.setCampus('CAMPUS_INVALID_999');
        }, /Unauthorized or invalid campus ID/);
      },
    },
    {
      name: '空校区 ID 传入抛错保护',
      fn: () => {
        const tenant = new TenantContext();
        assert.throws(() => {
          tenant.setCampus('');
        }, /Campus ID cannot be empty/);
      },
    },
    {
      name: '跨校区数据访问越权过滤验证',
      fn: () => {
        const tenant = new TenantContext();
        const sensitiveContracts = [
          { id: 'SEC_1', campusId: 'CAMPUS_HQ', confidential: true },
          { id: 'SEC_2', campusId: 'CAMPUS_HAIDIAN', confidential: true },
        ];

        tenant.setCampus('CAMPUS_CHAOYANG');
        const accessible = tenant.filterDataByCampusScope(sensitiveContracts);
        assert.lengthOf(accessible, 0, '朝阳校区绝不可看到海淀或总部的机密合同');
      },
    },
    {
      name: '连续高频切换校区事件通知顺序一致性',
      fn: () => {
        const tenant = new TenantContext();
        const history = [];
        tenant.subscribe(e => history.push(e.currentCampusId));

        tenant.setCampus('CAMPUS_HAIDIAN');
        tenant.setCampus('CAMPUS_CHAOYANG');
        tenant.setCampus('CAMPUS_HQ');

        assert.lengthOf(history, 3);
        assert.equal(history[0], 'CAMPUS_HAIDIAN');
        assert.equal(history[1], 'CAMPUS_CHAOYANG');
        assert.equal(history[2], 'CAMPUS_HQ');
        assert.equal(tenant.getCurrentCampus().id, 'CAMPUS_HQ');
      },
    },
    {
      name: '校区列表数据结构完备性与总部校区唯一性校验',
      fn: () => {
        const tenant = new TenantContext();
        const hqs = tenant.campuses.filter(c => c.isHeadquarter);
        assert.lengthOf(hqs, 1, '全系统只能且必须有 1 个盛通总部校区');
        assert.equal(hqs[0].id, 'CAMPUS_HQ');
      },
    },
  ],
};
