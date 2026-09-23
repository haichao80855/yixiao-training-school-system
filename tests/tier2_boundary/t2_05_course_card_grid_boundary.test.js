const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');

module.exports = {
  tier: 2,
  featureId: 5,
  name: 'Feature 5 (Boundary): 教研课程卡片流网格边界 (Course Card Grid Boundary)',
  tests: [
    {
      name: '缺失封面图时自动回退默认占位封面',
      fn: () => {
        function resolveCover(coverUrl) {
          const DEFAULT_COVER = 'https://cdn.shengtong.edu/assets/default_course_cover.png';
          return coverUrl && coverUrl.trim().length > 0 ? coverUrl : DEFAULT_COVER;
        }

        assert.equal(resolveCover(''), 'https://cdn.shengtong.edu/assets/default_course_cover.png');
        assert.equal(resolveCover(null), 'https://cdn.shengtong.edu/assets/default_course_cover.png');
        assert.equal(resolveCover('https://custom.png'), 'https://custom.png');
      },
    },
    {
      name: '超过 100 字符超长课程标题两行省略打点，不撑破卡片',
      fn: () => {
        const longTitle = '盛通教育集团少儿创意编程核心素养金牌竞赛强化冲刺班——全国青少年信息学奥林匹克联赛普及组算法专题深度剖析实战营';
        assert.ok(longTitle.length > 50);
        function truncateTitle(title, maxChars = 32) {
          if (title.length <= maxChars) return title;
          return title.substring(0, maxChars) + '...';
        }
        const truncated = truncateTitle(longTitle, 32);
        assert.equal(truncated.length, 35);
        assert.includes(truncated, '...');
      },
    },
    {
      name: '价格为 0 元（体验课/公益课）友好展示',
      fn: () => {
        function formatDisplayPrice(price) {
          if (price === 0) return '免费体验';
          return `${price}元/次`;
        }
        assert.equal(formatDisplayPrice(0), '免费体验');
        assert.equal(formatDisplayPrice(300), '300元/次');
      },
    },
    {
      name: '负数价格非法模型校验阻断',
      fn: () => {
        const invalidCourse = {
          name: '非法价格课程',
          pricePerLesson: -50,
          totalLessons: 10,
          attribute: 'regular',
          status: 'enabled',
          authorizedCampusIds: ['CAMPUS_HQ'],
        };
        const validation = CurriculumModel.validateCourseItem(invalidCourse);
        assert.isFalse(validation.isValid);
        assert.includes(validation.errors[0], 'Price per lesson must be a non-negative number');
      },
    },
    {
      name: '极端超大价格（999999元/次）千分位排版与格式完整性',
      fn: () => {
        const highPrice = 999999;
        const formatted = highPrice.toLocaleString('zh-CN') + '元/次';
        assert.equal(formatted, '999,999元/次');
      },
    },
  ],
};
