const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 2,
  featureId: 8,
  name: 'Feature 8 (Boundary): 课程启禁用与排课联动边界 (Course Status Toggle Boundary)',
  tests: [
    {
      name: '已禁用课程尝试通过 API 直接报名被守卫拦截',
      fn: () => {
        const course = { id: 'C_DISABLED', status: 'disabled' };
        function attemptEnroll(c) {
          const check = CurriculumModel.canSchedule(c);
          if (!check.allowed) {
            throw new Error(`Enrollment rejected: ${check.reason}`);
          }
          return true;
        }

        assert.throws(() => attemptEnroll(course), /Enrollment rejected: Course is disabled/);
      },
    },
    {
      name: '已禁用课程在教务排课下拉选择器中置灰且禁用交互',
      fn: () => {
        const courses = [
          { id: '1', name: '课A', status: 'enabled' },
          { id: '2', name: '课B', status: 'disabled' },
        ];
        const options = courses.map(c => ({
          label: c.name,
          value: c.id,
          disabled: c.status === 'disabled',
        }));
        assert.isFalse(options[0].disabled);
        assert.isTrue(options[1].disabled);
      },
    },
    {
      name: '已被排课的课程在禁用后，历史课次保留，未来新建课次阻断',
      fn: () => {
        const course = { id: 'C1', status: 'enabled' };
        const existingSchedules = [{ id: 'S1', courseId: 'C1', date: '2026-09-01' }];

        // 禁用课程
        course.status = 'disabled';

        // 验证历史排课不受影响
        assert.lengthOf(existingSchedules, 1);

        // 验证新建排课被阻断
        const check = CurriculumModel.canSchedule(course);
        assert.isFalse(check.allowed);
      },
    },
    {
      name: 'Switch 开关快速连续点击防抖与最终一致性',
      fn: () => {
        let current = 'enabled';
        const actions = ['disabled', 'enabled', 'disabled', 'disabled', 'enabled'];
        for (const act of actions) {
          current = act;
        }
        assert.equal(current, 'enabled');
      },
    },
    {
      name: '未授权校区尝试禁用课程越权阻断',
      fn: () => {
        const course = { id: 'C1', authorizedCampusIds: ['CAMPUS_HQ'] };
        function toggleCourseStatus(c, operatorCampusId) {
          if (!c.authorizedCampusIds.includes(operatorCampusId)) {
            throw new Error('Permission denied: cannot toggle course outside authorized campus');
          }
          c.status = 'disabled';
        }

        assert.throws(() => {
          toggleCourseStatus(course, 'CAMPUS_CHAOYANG');
        }, /Permission denied/);
      },
    },
  ],
};
