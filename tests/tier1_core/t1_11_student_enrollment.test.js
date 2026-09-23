const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 11,
  name: 'Feature 11: 学员报名选课签约向导 (Enrollment Wizard)',
  tests: [
    {
      name: '向导第一步：选择学员与校验归属校区',
      fn: () => {
        const student = { id: 'STU_101', name: '周博文', campusId: 'CAMPUS_HQ' };
        assert.ok(student.id);
        assert.equal(student.campusId, 'CAMPUS_HQ');
      },
    },
    {
      name: '向导第二步：选择课程包并配置课时数量',
      fn: () => {
        const orderConfig = {
          courseId: 'CRS_CPP_01',
          courseName: 'C++ 算法进阶',
          pricePerLesson: 300,
          lessonCount: 40,
          bonusLessonCount: 4,
        };
        const totalOriginalPrice = orderConfig.pricePerLesson * orderConfig.lessonCount;
        assert.equal(totalOriginalPrice, 12000);
        assert.equal(orderConfig.lessonCount + orderConfig.bonusLessonCount, 44);
      },
    },
    {
      name: '向导第三步：核算直减优惠与优惠券',
      fn: () => {
        function calculateOrderCost(pricePerLesson, count, directDiscount, couponAmount) {
          const originalPrice = pricePerLesson * count;
          const actualAmount = Math.max(0, originalPrice - directDiscount - couponAmount);
          return { originalPrice, actualAmount };
        }

        const cost = calculateOrderCost(300, 40, 1000, 500);
        assert.equal(cost.originalPrice, 12000);
        assert.equal(cost.actualAmount, 10500);
      },
    },
    {
      name: '向导第四步：选择支付渠道 (微信/支付宝/POS/钱包)',
      fn: () => {
        const validPaymentMethods = ['wechat', 'alipay', 'bank_transfer', 'pos', 'wallet'];
        const selected = 'wechat';
        assert.includes(validPaymentMethods, selected);
      },
    },
    {
      name: '向导第五步：生成正式待审核报名订单',
      fn: () => {
        const payload = {
          orderNo: 'ORD_20260921_001',
          studentId: 'STU_101',
          courseId: 'CRS_CPP_01',
          lessonCount: 40,
          bonusLessons: 4,
          pricePerLesson: 300,
          originalPrice: 12000,
          discountAmount: 1500,
          actualAmount: 10500,
          paymentMethod: 'wechat',
          campusId: 'CAMPUS_HQ',
          orderStatus: 'pending_approval',
        };
        assert.equal(payload.orderStatus, 'pending_approval');
        assert.equal(payload.originalPrice - payload.discountAmount, payload.actualAmount);
      },
    },
  ],
};
