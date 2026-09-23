const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 2,
  featureId: 6,
  name: 'Feature 6 (Boundary): 教研胶囊过滤器与搜索边界 (Capsule Filter Boundary)',
  tests: [
    {
      name: '多维度条件交集无匹配数据时返回空数组并保证不报错',
      fn: () => {
        const courses = [
          { id: '1', grade: 'kindergarten', attribute: 'trial', status: 'enabled' },
        ];
        const res = CurriculumModel.filterCourses(courses, {
          grade: 'middle_school',
          attribute: 'regular',
        });
        assert.lengthOf(res, 0);
      },
    },
    {
      name: '搜索关键字包含 SQL 注入与特殊符号时安全过滤',
      fn: () => {
        const courses = [
          { id: '1', name: 'C++ 语法入门', code: 'CPP_01' },
        ];
        const maliciousQueries = ["' OR '1'='1", '"; DROP TABLE courses; --', '<script>alert(1)</script>', '.*'];
        for (const q of maliciousQueries) {
          assert.doesNotThrow(() => {
            const res = CurriculumModel.filterCourses(courses, { keyword: q });
            assert.lengthOf(res, 0);
          });
        }
      },
    },
    {
      name: '搜索词前后多余空格自动清洗去除',
      fn: () => {
        const courses = [
          { id: '1', name: 'Python 趣味编程', code: 'PY_01' },
        ];
        const res = CurriculumModel.filterCourses(courses, { keyword: '   Python   ' });
        assert.lengthOf(res, 1);
        assert.equal(res[0].id, '1');
      },
    },
    {
      name: '无效状态枚举参数安全降级',
      fn: () => {
        const courses = [
          { id: '1', status: 'enabled', name: 'Scratch' },
        ];
        // 传入非法状态 'UNKNOWN_STATUS'
        const res = CurriculumModel.filterCourses(courses, { status: 'UNKNOWN_STATUS' });
        assert.lengthOf(res, 0);
      },
    },
    {
      name: '胶囊过滤器全部重置为 all 恢复初始全量列表',
      fn: () => {
        const courses = [
          { id: '1', grade: 'kindergarten' },
          { id: '2', grade: 'primary_low' },
          { id: '3', grade: 'middle_school' },
        ];
        const res = CurriculumModel.filterCourses(courses, { grade: 'all', attribute: 'all', status: 'all' });
        assert.lengthOf(res, 3);
      },
    },
  ],
};
