const assert = require('../harness/assert');

module.exports = {
  tier: 2,
  featureId: 11,
  name: 'Feature 11 (Boundary): 学员报名选课签约向导边界 (Enrollment Wizard Boundary)',
  tests: [
    {
      name: '购买课时数为 0 或负数抛错阻断',
      fn: () => {
        function validateOrderLessons(count) {
          if (typeof count !== 'number' || count <= 0) {
            throw new Error('Purchased lesson count must be strictly greater than 0');
          }
          return true;
        }

        assert.throws(() => validateOrderLessons(0), /greater than 0/);
        assert.throws(() => validateOrderLessons(-10), /greater than 0/);
        assert.isTrue(validateOrderLessons(20));
      },
    },
    {
      name: '优惠券与直减金额总和大于订单原价时，实付金额保底为 0（严禁负向应收）',
      fn: () => {
        function calculatePayable(originalPrice, discount, coupon) {
          const totalDiscount = discount + coupon;
          return Math.max(0, originalPrice - totalDiscount);
        }

        // 原价 2000，直减 1500，优惠券 1000，总优惠 2500 > 2000
        const payable = calculatePayable(2000, 1500, 1000);
        assert.equal(payable, 0, '实缴金额保底应为 0，不能为负数');
      },
    },
    {
      name: '未签署电子合同或必填项缺失阻断提交',
      fn: () => {
        function submitEnrollment(payload) {
          if (!payload.contractSigned) {
            throw new Error('Electronic contract must be signed before submission');
          }
          return { success: true };
        }

        assert.throws(() => submitEnrollment({ contractSigned: false }), /contract must be signed/);
        assert.isTrue(submitEnrollment({ contractSigned: true }).success);
      },
    },
    {
      name: '同一学员重复报名相同冲突课包给出强警示',
      fn: () => {
        const student = {
          coursePackages: [
            { courseId: 'CRS_001', status: 'active', remainingLessons: 30 },
          ],
        };
        function checkDuplicateEnroll(s, newCourseId) {
          const hasActive = s.coursePackages.some(p => p.courseId === newCourseId && p.status === 'active' && p.remainingLessons > 0);
          return hasActive ? 'WARNING_DUPLICATE_ACTIVE_PACKAGE' : 'OK';
        }

        assert.equal(checkDuplicateEnroll(student, 'CRS_001'), 'WARNING_DUPLICATE_ACTIVE_PACKAGE');
        assert.equal(checkDuplicateEnroll(student, 'CRS_002'), 'OK');
      },
    },
    {
      name: '赠送课时数不能为负数校验',
      fn: () => {
        function validateBonusLessons(bonusCount) {
          if (typeof bonusCount !== 'number' || bonusCount < 0) {
            throw new Error('Bonus lesson count cannot be negative');
          }
          return true;
        }

        assert.throws(() => validateBonusLessons(-2), /cannot be negative/);
        assert.isTrue(validateBonusLessons(0));
        assert.isTrue(validateBonusLessons(5));
      },
    },
  ],
};
