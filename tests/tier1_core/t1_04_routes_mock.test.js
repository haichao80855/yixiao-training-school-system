const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 4,
  name: 'Feature 4: 全局路由与 Mock 骨架 (Routes & Mock Skeleton)',
  tests: [
    {
      name: '教研模块 /curriculum/* 路由表覆盖完整性',
      fn: () => {
        const curriculumRoutes = [
          '/curriculum/courseManage',
          '/curriculum/additionalCourse',
          '/curriculum/editorCourse',
          '/curriculum/publicMaterial',
        ];
        assert.lengthOf(curriculumRoutes, 4);
        assert.includes(curriculumRoutes, '/curriculum/courseManage');
        assert.includes(curriculumRoutes, '/curriculum/editorCourse');
      },
    },
    {
      name: '学员模块 /studentCenter/* 路由表覆盖完整性',
      fn: () => {
        const studentRoutes = [
          '/studentCenter/allStudent',
          '/studentCenter/awaitDivideClass',
          '/studentCenter/studentDetails',
          '/studentCenter/studentEnroll',
          '/studentCenter/electronicPurse',
          '/studentCenter/studentAbnormal',
        ];
        assert.lengthOf(studentRoutes, 6);
        assert.includes(studentRoutes, '/studentCenter/allStudent');
        assert.includes(studentRoutes, '/studentCenter/studentAbnormal');
      },
    },
    {
      name: '教务模块 /educational/* 路由表覆盖完整性',
      fn: () => {
        const eduRoutes = [
          '/educational/workbench',
          '/educational/timeClassSchedule',
          '/educational/classroomCalendar',
          '/educational/teacherCalendar',
          '/educational/classManagement',
          '/educational/classSalesRecord',
        ];
        assert.lengthOf(eduRoutes, 6);
        assert.includes(eduRoutes, '/educational/timeClassSchedule');
        assert.includes(eduRoutes, '/educational/classManagement');
      },
    },
    {
      name: '财务模块 /financial/* 路由表覆盖完整性',
      fn: () => {
        const financeRoutes = [
          '/financial/orderManagement',
          '/financial/studentApproval',
          '/financial/proceedsCheck',
          '/financial/refundApproval',
          '/financial/studentInvoice',
        ];
        assert.lengthOf(financeRoutes, 5);
        assert.includes(financeRoutes, '/financial/orderManagement');
        assert.includes(financeRoutes, '/financial/refundApproval');
      },
    },
    {
      name: '系统设置 /systemSetting/* 路由表覆盖完整性',
      fn: () => {
        const sysRoutes = [
          '/systemSetting/organizationalStructure',
          '/systemSetting/employeeManagement',
          '/systemSetting/permissionGroupManagement',
          '/systemSetting/functionManage',
          '/systemSetting/serveManage',
        ];
        assert.lengthOf(sysRoutes, 5);
        assert.includes(sysRoutes, '/systemSetting/organizationalStructure');
        assert.includes(sysRoutes, '/systemSetting/permissionGroupManagement');
      },
    },
  ],
};
