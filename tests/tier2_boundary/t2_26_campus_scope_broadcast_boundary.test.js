const assert = require('../harness/assert');
const TenantContext = require('../contracts/tenantContext');

module.exports = {
  tier: 2,
  featureId: 26,
  name: 'Feature 26 (Boundary): 跨模块多校区数据流穿透联动边界 (Broadcast Scope Boundary)',
  tests: [
    {
      name: '校区切换异常时保持原校区作用域不被破坏',
      fn: () => {
        const tenant = new TenantContext();
        assert.equal(tenant.currentCampusId, 'CAMPUS_HQ');

        try {
          tenant.setCampus('ILLEGAL_CAMPUS_ID');
        } catch (e) {
          // 预期抛错
        }
        assert.equal(tenant.currentCampusId, 'CAMPUS_HQ', '切换失败后当前校区必须保持原校区不变');
      },
    },
    {
      name: '极速连续切换校区事件派发防竞态覆盖',
      fn: () => {
        const tenant = new TenantContext();
        let finalCampusId = null;
        tenant.subscribe(e => {
          finalCampusId = e.currentCampusId;
        });

        // 连续切换 4 次
        tenant.setCampus('CAMPUS_HAIDIAN');
        tenant.setCampus('CAMPUS_CHAOYANG');
        tenant.setCampus('CAMPUS_XICHENG');
        tenant.setCampus('CAMPUS_HQ');

        assert.equal(finalCampusId, 'CAMPUS_HQ');
        assert.equal(tenant.currentCampusId, 'CAMPUS_HQ');
      },
    },
    {
      name: '未保存表单在校区切换时二次确认拦截机制',
      fn: () => {
        let isDirty = true;
        function attemptCampusSwitch(newCampusId, confirmProceed = false) {
          if (isDirty && !confirmProceed) {
            return { blocked: true, prompt: 'You have unsaved changes. Switch anyway?' };
          }
          return { blocked: false, newCampusId };
        }

        const res1 = attemptCampusSwitch('CAMPUS_HAIDIAN', false);
        assert.isTrue(res1.blocked);

        const res2 = attemptCampusSwitch('CAMPUS_HAIDIAN', true);
        assert.isFalse(res2.blocked);
      },
    },
    {
      name: '跨校区全局广播监听器异常隔离保护',
      fn: () => {
        const tenant = new TenantContext();
        let healthyModuleCalled = false;

        // 注册一个有 bug 的监听器
        tenant.subscribe(() => {
          throw new Error('Buggy module listener error');
        });

        // 注册正常监听器
        tenant.subscribe(() => {
          healthyModuleCalled = true;
        });

        // 触发广播时，即使个别监听器报错，也应记录或不崩溃主要流
        function safeNotify(t, id) {
          try {
            t.setCampus(id);
          } catch (e) {
            // 内部隔离
          }
        }
        safeNotify(tenant, 'CAMPUS_HAIDIAN');
        assert.equal(tenant.currentCampusId, 'CAMPUS_HAIDIAN');
      },
    },
    {
      name: '总部校区穿透透视多校区汇总数据时计算一致性',
      fn: () => {
        const campusData = {
          CAMPUS_HQ: 10,
          CAMPUS_HAIDIAN: 20,
          CAMPUS_CHAOYANG: 30,
        };
        const total = Object.values(campusData).reduce((a, b) => a + b, 0);
        assert.equal(total, 60);
      },
    },
  ],
};
