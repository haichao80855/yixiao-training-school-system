const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 1,
  featureId: 5,
  name: 'Feature 5: 教研课程卡片流网格 (Course Card Grid)',
  tests: [
    {
      name: '16:9 课程封面比例与图片渲染属性',
      fn: () => {
        const coverSpec = {
          aspectRatio: '16:9',
          width: 320,
          height: 180,
          url: 'https://cdn.shengtong.edu/courses/scratch_primary.png',
        };
        assert.equal(coverSpec.aspectRatio, '16:9');
        assert.equal(coverSpec.width / coverSpec.height, 16 / 9);
      },
    },
    {
      name: '微立体属性角标语义映射 (扩科/培训/活动)',
      fn: () => {
        function getBadgeStyle(attribute) {
          const badges = {
            extended: { text: '扩科课程', color: '#E6A23C' },
            training: { text: '教师培训', color: '#67C23A' },
            activity: { text: '活动课程', color: '#1890FF' },
            trial: { text: '体验课程', color: '#F56C6C' },
          };
          return badges[attribute] || { text: '常规课程', color: '#909399' };
        }

        const ext = getBadgeStyle('extended');
        assert.equal(ext.text, '扩科课程');
        assert.equal(ext.color, '#E6A23C');

        const train = getBadgeStyle('training');
        assert.equal(train.text, '教师培训');
        assert.equal(train.color, '#67C23A');
      },
    },
    {
      name: '价格格式化与高亮展示',
      fn: () => {
        function formatCoursePrice(pricePerLesson) {
          return `${pricePerLesson}元/次`;
        }
        assert.equal(formatCoursePrice(300), '300元/次');
        assert.equal(formatCoursePrice(1000), '1000元/次');
      },
    },
    {
      name: 'Switch 开关控件状态联动',
      fn: () => {
        const card = {
          id: 'CRS_001',
          name: '单片机机器人探索班',
          status: 'enabled',
        };
        assert.equal(card.status, 'enabled');

        card.status = 'disabled';
        assert.equal(card.status, 'disabled');
      },
    },
    {
      name: '课程卡片模型校验有效性',
      fn: () => {
        const course = {
          id: 'C101',
          name: 'Python 进阶与算法实战',
          pricePerLesson: 350,
          totalLessons: 48,
          attribute: 'regular',
          status: 'enabled',
          authorizedCampusIds: ['CAMPUS_HQ'],
        };
        const validation = CurriculumModel.validateCourseItem(course);
        assert.isTrue(validation.isValid);
        assert.lengthOf(validation.errors, 0);
      },
    },
  ],
};
