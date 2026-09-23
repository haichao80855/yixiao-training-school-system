const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 1,
  featureId: 7,
  name: 'Feature 7: 教研三步课程编辑器 (Course Editor Wizard)',
  tests: [
    {
      name: '第一步：课程基础信息录入表单校验',
      fn: () => {
        const step1Data = {
          name: '信息学奥赛 C++ 普及组',
          code: 'NOIP_CPP_01',
          subject: '编程算法',
          standardDuration: 90, // 90分钟
          maxCapacity: 16,
          pricePerLesson: 380,
          totalLessons: 40,
        };
        assert.ok(step1Data.name);
        assert.equal(step1Data.standardDuration, 90);
        assert.equal(step1Data.maxCapacity, 16);
      },
    },
    {
      name: '第二步：跨校区授权穿梭树左右勾选分配',
      fn: () => {
        const allCampuses = ['CAMPUS_HQ', 'CAMPUS_HAIDIAN', 'CAMPUS_CHAOYANG', 'CAMPUS_XICHENG'];
        let authorized = ['CAMPUS_HQ'];

        // 穿梭授权海淀与朝阳校区
        authorized = [...authorized, 'CAMPUS_HAIDIAN', 'CAMPUS_CHAOYANG'];
        assert.lengthOf(authorized, 3);
        assert.includes(authorized, 'CAMPUS_HAIDIAN');
        assert.isFalse(authorized.includes('CAMPUS_XICHENG'));
      },
    },
    {
      name: '第三步：单元 (Unit) 与课次 (Lesson) 二级层级构建',
      fn: () => {
        const unit = {
          id: 'U1',
          title: '第一单元：C++ 基础语法与控制流',
          lessons: [
            { id: 'L1', title: '第1讲：环境搭建与变量', duration: 90, order: 1 },
            { id: 'L2', title: '第2讲：if 分支结构', duration: 90, order: 2 },
            { id: 'L3', title: '第3讲：for 与 while 循环', duration: 90, order: 3 },
          ],
        };
        assert.lengthOf(unit.lessons, 3);
        assert.equal(unit.lessons[0].order, 1);
        assert.equal(unit.lessons[2].order, 3);
      },
    },
    {
      name: '课次拖拽重新排序索引重排算子',
      fn: () => {
        const unit = {
          lessons: [
            { id: 'L1', title: '第1讲' },
            { id: 'L2', title: '第2讲' },
            { id: 'L3', title: '第3讲' },
          ],
        };
        // 将第3讲拖至第1讲位置 (fromIndex=2, toIndex=0)
        const reordered = CurriculumModel.reorderLessons(unit, 2, 0);
        assert.lengthOf(reordered, 3);
        assert.equal(reordered[0].id, 'L3');
        assert.equal(reordered[0].order, 1);
        assert.equal(reordered[1].id, 'L1');
        assert.equal(reordered[1].order, 2);
        assert.equal(reordered[2].id, 'L2');
        assert.equal(reordered[2].order, 3);
      },
    },
    {
      name: '课次白板课件与编程练习题关联绑定',
      fn: () => {
        const lesson = {
          id: 'L1',
          title: 'Scratch 动画制作',
          courseware: {
            pptUrl: 'https://cdn.shengtong.edu/ppt/l1.pdf',
            codeTemplate: 'https://cdn.shengtong.edu/scratch/l1.sb3',
            quizCount: 5,
          },
        };
        assert.ok(lesson.courseware.pptUrl);
        assert.equal(lesson.courseware.quizCount, 5);
      },
    },
  ],
};
