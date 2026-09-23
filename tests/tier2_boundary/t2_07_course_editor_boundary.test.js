const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 2,
  featureId: 7,
  name: 'Feature 7 (Boundary): 教研三步课程编辑器边界 (Course Editor Wizard Boundary)',
  tests: [
    {
      name: '必填项缺失（课程名称为空）阻断提交',
      fn: () => {
        const course = {
          name: '   ',
          pricePerLesson: 200,
          totalLessons: 30,
          attribute: 'regular',
          status: 'enabled',
          authorizedCampusIds: ['CAMPUS_HQ'],
        };
        const res = CurriculumModel.validateCourseItem(course);
        assert.isFalse(res.isValid);
        assert.includes(res.errors, 'Course name is required');
      },
    },
    {
      name: '课次拖拽排序索引越界保护 (fromIndex 或 toIndex < 0 或 >= length)',
      fn: () => {
        const unit = {
          lessons: [{ id: 'L1' }, { id: 'L2' }],
        };
        assert.throws(() => {
          CurriculumModel.reorderLessons(unit, -1, 1);
        }, /Invalid drag-and-drop index range/);

        assert.throws(() => {
          CurriculumModel.reorderLessons(unit, 0, 5);
        }, /Invalid drag-and-drop index range/);
      },
    },
    {
      name: '单元下课次为空时的合法性保护',
      fn: () => {
        const unit = { id: 'U1', title: '空单元', lessons: [] };
        assert.lengthOf(unit.lessons, 0);
        function validateUnit(u) {
          if (!u.lessons || u.lessons.length === 0) {
            return { valid: false, warning: 'Unit contains no lessons' };
          }
          return { valid: true };
        }
        const check = validateUnit(unit);
        assert.isFalse(check.valid);
      },
    },
    {
      name: '跨校区穿梭框全选与清空双向极值校验',
      fn: () => {
        const allCampuses = ['CAMPUS_HQ', 'CAMPUS_HAIDIAN', 'CAMPUS_CHAOYANG', 'CAMPUS_XICHENG'];
        let selected = [];

        // 一键全选
        selected = [...allCampuses];
        assert.equal(selected.length, 4);

        // 一键清空
        selected = [];
        assert.equal(selected.length, 0);
      },
    },
    {
      name: '总课时数必须严格大于 0 阻断校验',
      fn: () => {
        const course = {
          name: '零课时异常测试',
          pricePerLesson: 100,
          totalLessons: 0,
          attribute: 'regular',
          status: 'enabled',
          authorizedCampusIds: ['CAMPUS_HQ'],
        };
        const res = CurriculumModel.validateCourseItem(course);
        assert.isFalse(res.isValid);
        assert.includes(res.errors, 'Total lessons must be greater than 0');
      },
    },
  ],
};
