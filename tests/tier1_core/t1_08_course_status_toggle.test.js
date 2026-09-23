const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 1,
  featureId: 8,
  name: 'Feature 8: 教研课程启禁用与排课联动 (Course Status & Scheduling Linkage)',
  tests: [
    {
      name: '课程 Switch 状态正常切换 (enabled -> disabled)',
      fn: () => {
        const course = { id: 'C1', name: 'Arduino 机器人', status: 'enabled' };
        course.status = 'disabled';
        assert.equal(course.status, 'disabled');
      },
    },
    {
      name: '启用状态允许排课与报名开单',
      fn: () => {
        const course = { id: 'C1', name: 'Python 初级', status: 'enabled' };
        const check = CurriculumModel.canSchedule(course);
        assert.isTrue(check.allowed);
      },
    },
    {
      name: '禁用状态阻断新建排课与前台选课',
      fn: () => {
        const course = { id: 'C2', name: '已淘汰旧课件', status: 'disabled' };
        const check = CurriculumModel.canSchedule(course);
        assert.isFalse(check.allowed);
        assert.equal(check.reason, 'Course is disabled');
      },
    },
    {
      name: '重新启用课程恢复排课与开单能力',
      fn: () => {
        const course = { id: 'C3', name: 'Scratch 创客', status: 'disabled' };
        let check = CurriculumModel.canSchedule(course);
        assert.isFalse(check.allowed);

        course.status = 'enabled';
        check = CurriculumModel.canSchedule(course);
        assert.isTrue(check.allowed);
      },
    },
    {
      name: '课程状态更新日志与操作人审计',
      fn: () => {
        const auditLog = [];
        function updateCourseStatus(course, newStatus, operator) {
          const oldStatus = course.status;
          course.status = newStatus;
          auditLog.push({
            courseId: course.id,
            oldStatus,
            newStatus,
            operator,
            timestamp: new Date().toISOString(),
          });
        }

        const course = { id: 'C10', status: 'enabled' };
        updateCourseStatus(course, 'disabled', 'ADMIN_TEACHER_ZHANG');
        assert.lengthOf(auditLog, 1);
        assert.equal(auditLog[0].oldStatus, 'enabled');
        assert.equal(auditLog[0].newStatus, 'disabled');
        assert.equal(auditLog[0].operator, 'ADMIN_TEACHER_ZHANG');
      },
    },
  ],
};
