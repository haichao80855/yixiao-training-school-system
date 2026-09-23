const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 1,
  featureId: 6,
  name: 'Feature 6: 教研胶囊过滤器与搜索 (Capsule Filter & Search)',
  tests: [
    {
      name: '按适用年级胶囊标签精准过滤',
      fn: () => {
        const courses = [
          { id: '1', grade: 'kindergarten', name: '幼儿启蒙积木' },
          { id: '2', grade: 'primary_low', name: 'Scratch 基础' },
          { id: '3', grade: 'primary_high', name: 'Python 趣味编程' },
        ];
        const res = CurriculumModel.filterCourses(courses, { grade: 'primary_low' });
        assert.lengthOf(res, 1);
        assert.equal(res[0].id, '2');
      },
    },
    {
      name: '按课程属性胶囊标签多维过滤',
      fn: () => {
        const courses = [
          { id: '1', attribute: 'regular', name: '常规班' },
          { id: '2', attribute: 'extended', name: '扩科班' },
          { id: '3', attribute: 'activity', name: '创客营' },
        ];
        const res = CurriculumModel.filterCourses(courses, { attribute: 'extended' });
        assert.lengthOf(res, 1);
        assert.equal(res[0].id, '2');
      },
    },
    {
      name: '按课程状态（启用/禁用）过滤',
      fn: () => {
        const courses = [
          { id: '1', status: 'enabled', name: 'C++ CSP 竞赛班' },
          { id: '2', status: 'disabled', name: '已下架旧课程' },
        ];
        const enabled = CurriculumModel.filterCourses(courses, { status: 'enabled' });
        assert.lengthOf(enabled, 1);
        assert.equal(enabled[0].name, 'C++ CSP 竞赛班');

        const disabled = CurriculumModel.filterCourses(courses, { status: 'disabled' });
        assert.lengthOf(disabled, 1);
        assert.equal(disabled[0].name, '已下架旧课程');
      },
    },
    {
      name: '模糊搜索名称与课程编码匹配',
      fn: () => {
        const courses = [
          { id: '1', code: 'CRS_ROBOT_01', name: '单片机创客基础' },
          { id: '2', code: 'CRS_PY_02', name: 'Python 人工智能入门' },
        ];
        const res1 = CurriculumModel.filterCourses(courses, { keyword: '单片机' });
        assert.lengthOf(res1, 1);
        assert.equal(res1[0].id, '1');

        const res2 = CurriculumModel.filterCourses(courses, { keyword: 'CRS_PY' });
        assert.lengthOf(res2, 1);
        assert.equal(res2[0].id, '2');
      },
    },
    {
      name: '复合多维度组合筛选交集结果',
      fn: () => {
        const courses = [
          { id: '1', grade: 'primary_high', attribute: 'regular', status: 'enabled', name: 'Python日常班' },
          { id: '2', grade: 'primary_high', attribute: 'extended', status: 'enabled', name: 'Python扩科班' },
          { id: '3', grade: 'middle_school', attribute: 'regular', status: 'enabled', name: 'C++中学班' },
        ];
        const res = CurriculumModel.filterCourses(courses, {
          grade: 'primary_high',
          attribute: 'regular',
          status: 'enabled',
        });
        assert.lengthOf(res, 1);
        assert.equal(res[0].id, '1');
      },
    },
  ],
};
