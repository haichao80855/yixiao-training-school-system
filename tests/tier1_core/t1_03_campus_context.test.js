const assert = require('../harness/assert');
const TenantContext = require('../contracts/tenantContext');

module.exports = {
  tier: 1,
  featureId: 3,
  name: 'Feature 3: 多校区上下文隔离中台 (Campus Context Middle Platform)',
  tests: [
    {
      name: '默认加载盛通总部校区上下文',
      fn: () => {
        const tenant = new TenantContext();
        const current = tenant.getCurrentCampus();
        assert.equal(current.id, 'CAMPUS_HQ');
        assert.isTrue(current.isHeadquarter);
        assert.equal(current.name, '盛通总部校区');
      },
    },
    {
      name: '切换至有效分校区并更新作用域',
      fn: () => {
        const tenant = new TenantContext();
        const target = tenant.setCampus('CAMPUS_HAIDIAN');
        assert.equal(target.id, 'CAMPUS_HAIDIAN');
        assert.equal(tenant.getCurrentCampus().id, 'CAMPUS_HAIDIAN');
      },
    },
    {
      name: '校区切换事件发布订阅通知机制',
      fn: () => {
        const tenant = new TenantContext();
        const events = [];
        const unsubscribe = tenant.subscribe(e => events.push(e));

        tenant.setCampus('CAMPUS_CHAOYANG');
        assert.lengthOf(events, 1);
        assert.equal(events[0].prevCampusId, 'CAMPUS_HQ');
        assert.equal(events[0].currentCampusId, 'CAMPUS_CHAOYANG');

        unsubscribe();
        tenant.setCampus('CAMPUS_HQ');
        assert.lengthOf(events, 1, '退订后不应继续接收事件');
      },
    },
    {
      name: '基于校区作用域过滤业务数据集',
      fn: () => {
        const tenant = new TenantContext();
        const courses = [
          { id: 'C1', name: 'Scratch', authorizedCampusIds: ['CAMPUS_HQ', 'CAMPUS_HAIDIAN'] },
          { id: 'C2', name: 'Python', authorizedCampusIds: ['CAMPUS_CHAOYANG'] },
          { id: 'C3', name: 'C++', authorizedCampusIds: ['CAMPUS_HAIDIAN'] },
        ];

        tenant.setCampus('CAMPUS_HAIDIAN');
        const visible = tenant.filterDataByCampusScope(courses);
        assert.lengthOf(visible, 2);
        assert.equal(visible[0].id, 'C1');
        assert.equal(visible[1].id, 'C3');
      },
    },
    {
      name: '全局公共数据不受校区过滤影响',
      fn: () => {
        const tenant = new TenantContext();
        const items = [
          { id: 'G1', name: '全国统一竞赛政策', isGlobal: true },
          { id: 'L1', name: '海淀专属优惠活动', campusId: 'CAMPUS_HAIDIAN' },
        ];

        tenant.setCampus('CAMPUS_CHAOYANG');
        const visible = tenant.filterDataByCampusScope(items);
        assert.lengthOf(visible, 1);
        assert.equal(visible[0].id, 'G1');
      },
    },
  ],
};
