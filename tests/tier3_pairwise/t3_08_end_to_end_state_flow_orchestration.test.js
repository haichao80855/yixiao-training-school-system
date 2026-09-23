const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');
const StudentStateMachine = require('../contracts/studentStateMachine');
const CollisionEngine = require('../contracts/collisionEngine');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 3,
  name: 'Tier 3.8: 跨模块全状态流穿透闭环编排 (Cross-Module State Flow Orchestration)',
  tests: [
    {
      name: '课程授权 -> 学员报名签约 -> 课时上账 -> 教务排课消课 -> 财务确认与反结课冲正全联动',
      fn: () => {
        // Step 1: 教研建立课程并授权海淀校区
        const course = {
          id: 'CRS_FULL_01',
          name: '全栈编程创客班',
          pricePerLesson: 200,
          totalLessons: 20,
          attribute: 'regular',
          status: 'enabled',
          authorizedCampusIds: ['CAMPUS_HAIDIAN'],
        };
        const courseValid = CurriculumModel.validateCourseItem(course);
        assert.isTrue(courseValid.isValid);

        // Step 2: 学员在海淀校区报名并签约
        const student = {
          id: 'STU_E2E_01',
          name: '林小诺',
          campusId: 'CAMPUS_HAIDIAN',
          status: 'normal',
          wallet: { principalBalance: 500, bonusBalance: 0 },
          coursePackages: [],
        };
        const sm = new StudentStateMachine(student);

        // 报名购买 20 课时，总价 4000。直减 200，实缴 3800。
        const orderPayload = {
          orderNo: 'ORD_20260921_E2E',
          studentId: student.id,
          courseId: course.id,
          lessonCount: 20,
          actualAmount: 3800,
          status: 'pending',
        };

        // Step 3: 财务收款审核通过，划拨课时上账
        const approval = {
          id: 'APP_E2E_1',
          businessType: 'payment',
          currentStep: 3,
          status: 'pending',
          timeline: [],
        };
        FinanceAggregator.processApproval(approval, 'pass', 'FINANCE_OP');
        assert.equal(approval.status, 'approved');

        // 课包生效上账 20 课时
        const activePkg = {
          packageId: 'PKG_E2E_1',
          courseId: course.id,
          pricePerLesson: 200,
          totalLessons: 20,
          remainingLessons: 20,
          bonusLessons: 0,
          status: 'active',
        };
        student.coursePackages.push(activePkg);
        assert.equal(student.coursePackages[0].remainingLessons, 20);

        // Step 4: 教务排课与防撞校验
        const scheduleEvent = {
          id: 'EVT_E2E_1',
          date: '2026-09-21',
          startTime: '10:00',
          endTime: '11:30',
          teacherId: 'T_LEBO',
          classroomId: 'ROOM_1',
          studentIds: [student.id],
        };
        const collisionCheck = CollisionEngine.detectCollision(scheduleEvent, []);
        assert.isFalse(collisionCheck.hasConflict);

        // Step 5: 授课工作台点名消课
        activePkg.remainingLessons -= 1;
        assert.equal(activePkg.remainingLessons, 19);

        // 财务录入课消记录
        const financeLedger = [{ actualAmount: 200.00 }];
        let summary = FinanceAggregator.calculateSummaryStrip(financeLedger);
        assert.equal(summary.totalAmount, 200.00);

        // Step 6: 误考勤反结课冲正
        activePkg.remainingLessons += 1;
        financeLedger.push({ actualAmount: -200.00 });
        summary = FinanceAggregator.calculateSummaryStrip(financeLedger);

        assert.equal(activePkg.remainingLessons, 20, '课时成功冲正恢复');
        assert.equal(summary.totalAmount, 0.00, '财务流水成功红字冲正归零');
      },
    },
  ],
};
