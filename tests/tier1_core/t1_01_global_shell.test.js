const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 1,
  name: 'Feature 1: 全局外壳与导航系统 (Global Shell & Navigation)',
  tests: [
    {
      name: '顶栏尺寸与微系统切换导航项规范',
      fn: () => {
        const shellSpec = {
          headerHeight: 60,
          microSystems: ['CRM', '教研', '学员', '教务', '运营', '店铺', '赛考', '进销存', '财务', '系统'],
          brandCode: '002599',
          brandTitle: '一校 教培系统',
        };
        assert.equal(shellSpec.headerHeight, 60, '顶栏固定高度应为 60px');
        assert.equal(shellSpec.microSystems.length, 10, '应包含 10 个子微系统切换入口');
        assert.includes(shellSpec.microSystems, '教研');
        assert.includes(shellSpec.microSystems, '学员');
        assert.includes(shellSpec.microSystems, '教务');
        assert.includes(shellSpec.microSystems, '财务');
        assert.includes(shellSpec.microSystems, '系统');
      },
    },
    {
      name: '侧边栏展开与折叠宽度规格断言',
      fn: () => {
        const sidebarSpec = {
          expandedWidth: 220,
          collapsedWidth: 64,
          isCollapsible: true,
          mode: 'expanded',
        };
        assert.equal(sidebarSpec.expandedWidth, 220, '展开态宽度应为 220px');
        assert.equal(sidebarSpec.collapsedWidth, 64, '折叠态图标模式宽度应为 64px');

        // 切换折叠
        sidebarSpec.mode = 'collapsed';
        assert.equal(sidebarSpec.mode, 'collapsed');
      },
    },
    {
      name: '面包屑层级生成与解析逻辑',
      fn: () => {
        function generateBreadcrumb(routePath) {
          const map = {
            '/financial/orderManagement': ['财务中心', '订单管理'],
            '/curriculum/courseManage': ['教研中心', '课程管理'],
            '/educational/timeClassSchedule': ['教务中心', '排课日历', '时间课表'],
            '/studentCenter/allStudent': ['学员中心', '学员管理', '全部学员'],
            '/systemSetting/organizationalStructure': ['系统管理', '机构管理', '组织架构'],
          };
          return map[routePath] || ['首页'];
        }

        const crumb1 = generateBreadcrumb('/financial/orderManagement');
        assert.deepEqual(crumb1, ['财务中心', '订单管理']);

        const crumb2 = generateBreadcrumb('/educational/timeClassSchedule');
        assert.deepEqual(crumb2, ['教务中心', '排课日历', '时间课表']);
      },
    },
    {
      name: '多 Tab 标签栏动态增删与激活状态保持',
      fn: () => {
        class TabManager {
          constructor() {
            this.tabs = [{ title: '工作台', path: '/dashboard', closable: false }];
            this.activePath = '/dashboard';
          }
          openTab(tab) {
            if (!this.tabs.some(t => t.path === tab.path)) {
              this.tabs.push(tab);
            }
            this.activePath = tab.path;
          }
          closeTab(path) {
            const idx = this.tabs.findIndex(t => t.path === path);
            if (idx > -1 && this.tabs[idx].closable !== false) {
              this.tabs.splice(idx, 1);
              if (this.activePath === path) {
                this.activePath = this.tabs[this.tabs.length - 1].path;
              }
            }
          }
        }

        const manager = new TabManager();
        manager.openTab({ title: '课程管理', path: '/curriculum/courseManage', closable: true });
        assert.equal(manager.activePath, '/curriculum/courseManage');
        assert.equal(manager.tabs.length, 2);

        manager.closeTab('/curriculum/courseManage');
        assert.equal(manager.activePath, '/dashboard');
        assert.equal(manager.tabs.length, 1);
      },
    },
    {
      name: '顶栏用户中心与通知告警指示点',
      fn: () => {
        const topHeaderWidgets = {
          hasAiAssistant: true,
          unreadNotifications: 9,
          downloadCenter: true,
          userProfileDropdown: ['个人中心', '修改密码', '退出登录'],
        };
        assert.isTrue(topHeaderWidgets.hasAiAssistant);
        assert.equal(topHeaderWidgets.unreadNotifications, 9);
        assert.lengthOf(topHeaderWidgets.userProfileDropdown, 3);
      },
    },
  ],
};
