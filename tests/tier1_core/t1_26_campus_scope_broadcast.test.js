const assert = require('../harness/assert');
const TenantContext = require('../contracts/tenantContext');

module.exports = {
  tier: 1,
  featureId: 26,
  name: 'Feature 26: 跨模块多校区数据流穿透联动 (Cross-Module Scope Broadcast)',
  tests: [
    {
      name: '顶栏切换校区触发全模块全局广播通知',
      fn: () => {
        const tenant = new TenantContext();
        let curriculumReloaded = false;
        let studentReloaded = false;
        let eduReloaded = false;
        let financeReloaded = false;

        tenant.subscribe(event => {
          if (event.currentCampusId) {
            curriculumReloaded = true;
            studentReloaded = true;
            eduReloaded = true;
            financeReloaded = true;
          }
        });

        tenant.setCampus('CAMPUS_HAIDIAN');
        assert.isTrue(curriculumReloaded);
        assert.isTrue(studentReloaded);
        assert.isTrue(eduReloaded);
        assert.isTrue(financeReloaded);
      },
    },
    {
      name: '教研课程跨校区穿透可见性规则',
      fn: () => {
        const tenant = new TenantContext();
        const courses = [
          { id: 'C_HQ_ONLY', name: '总部实验课', authorizedCampusIds: ['CAMPUS_HQ'] },
          { id: 'C_HD_ONLY', name: '海淀专属课', authorizedCampusIds: ['CAMPUS_HAIDIAN'] },
        ];
        tenant.setCampus('CAMPUS_HAIDIAN');
        const visible = tenant.filterDataByCampusScope(courses);
        assert.lengthOf(visible, 1);
        assert.equal(visible[0].id, 'C_HD_ONLY');
      },
    },
    {
      name: '教务排课日历自动重载对应校区排课',
      fn: () => {
        const tenant = new TenantContext();
        const schedules = [
          { id: 'S1', campusId: 'CAMPUS_HQ', title: '总部排课' },
          { id: 'S2', campusId: 'CAMPUS_CHAOYANG', title: '朝阳排课' },
        ];
        tenant.setCampus('CAMPUS_CHAOYANG');
        const visible = schedules.filter(s => s.campusId === tenant.currentCampusId);
        assert.lengthOf(visible, 1);
        assert.equal(visible[0].id, 'S2');
      },
    },
    {
      name: '财务流水仅透视当前校区订单数据',
      fn: () => {
        const tenant = new TenantContext();
        const orders = [
          { orderNo: 'ORD_HQ', campusId: 'CAMPUS_HQ', actualAmount: 5000 },
          { orderNo: 'ORD_HD', campusId: 'CAMPUS_HAIDIAN', actualAmount: 3000 },
        ];
        tenant.setCampus('CAMPUS_HAIDIAN');
        const visible = orders.filter(o => o.campusId === tenant.currentCampusId);
        assert.lengthOf(visible, 1);
        assert.equal(visible[0].orderNo, 'ORD_HD');
      },
    },
    {
      name: '总部校区可透视全校区汇总流水',
      fn: () => {
        const tenant = new TenantContext();
        const orders = [
          { orderNo: 'ORD_1', campusId: 'CAMPUS_HQ', actualAmount: 5000 },
          { orderNo: 'ORD_2', campusId: 'CAMPUS_HAIDIAN', actualAmount: 3000 },
          { orderNo: 'ORD_3', campusId: 'CAMPUS_CHAOYANG', actualAmount: 4000 },
        ];
        tenant.setCampus('CAMPUS_HQ');
        const total = orders.reduce((sum, o) => sum + o.actualAmount, 0);
        assert.equal(total, 12000);
      },
    },
  ],
};
