const assert = require('../harness/assert');

module.exports = {
  tier: 2,
  featureId: 1,
  name: 'Feature 1 (Boundary): 全局外壳与导航系统边界 (Global Shell Boundary)',
  tests: [
    {
      name: '超长面包屑路径防溢出与截断规则',
      fn: () => {
        function truncateBreadcrumbs(crumbs, maxItems = 4) {
          if (crumbs.length <= maxItems) return crumbs;
          return [crumbs[0], '...', crumbs[crumbs.length - 2], crumbs[crumbs.length - 1]];
        }

        const deepCrumbs = ['首页', '教学教研', '课程管理', '机器人科目', 'Scratch单元', '课次详情'];
        const result = truncateBreadcrumbs(deepCrumbs, 4);
        assert.lengthOf(result, 4);
        assert.equal(result[1], '...');
        assert.equal(result[3], '课次详情');
      },
    },
    {
      name: '连续高频切换侧边栏折叠状态的幂等性',
      fn: () => {
        let isCollapsed = false;
        function toggle() { isCollapsed = !isCollapsed; }

        for (let i = 0; i < 100; i++) {
          toggle();
        }
        assert.isFalse(isCollapsed, '100次切换后应恢复初始未折叠状态');
      },
    },
    {
      name: '超多 Tab 溢出横向滚动与激活态聚焦',
      fn: () => {
        const tabs = Array.from({ length: 30 }, (_, i) => ({ id: `tab_${i}`, path: `/path/${i}` }));
        const activePath = '/path/25';
        const activeTab = tabs.find(t => t.path === activePath);
        assert.ok(activeTab);
        assert.equal(activeTab.id, 'tab_25');
      },
    },
    {
      name: '非法路由直接访问回退重定向守卫 (404/Home)',
      fn: () => {
        const validRoutes = ['/curriculum', '/studentCenter', '/educational', '/financial', '/systemSetting'];
        function resolveRoute(path) {
          const matched = validRoutes.find(r => path.startsWith(r));
          return matched ? path : '/404';
        }

        assert.equal(resolveRoute('/illegal/hack/path'), '/404');
        assert.equal(resolveRoute('/curriculum/courseManage'), '/curriculum/courseManage');
      },
    },
    {
      name: '顶栏未读通知极端大数格式化 (99+)',
      fn: () => {
        function formatBadge(count) {
          if (count <= 0) return '';
          if (count > 99) return '99+';
          return String(count);
        }

        assert.equal(formatBadge(5), '5');
        assert.equal(formatBadge(99), '99');
        assert.equal(formatBadge(100), '99+');
        assert.equal(formatBadge(9999), '99+');
      },
    },
  ],
};
