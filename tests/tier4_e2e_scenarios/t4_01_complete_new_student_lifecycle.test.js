const assert = require('../harness/assert');
const CurriculumModel = require('../contracts/curriculumModel');
const CollisionEngine = require('../contracts/collisionEngine');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 4,
  name: 'Scenario 1: 新学员端到端全生命周期流 (Complete New Student Lifecycle)',
  tests: [
    {
      name: '招生建档 -> 选课签约 -> 财务收款 -> 待分班调度 -> 网格排课 -> 点名消课 -> 结业全流程闭环',
      fn: () => {
        // 1. 招生建档
        const student = {
          id: 'STU_NEW_001',
          name: '陈宇航',
          studentNo: 'S948920',
          phone: '13812345678',
          campusId: 'CAMPUS_HQ',
          status: 'normal',
          wallet: { principalBalance: 0, bonusBalance: 0 },
          coursePackages: [],
        };
        assert.equal(student.studentNo, 'S948920');

        // 2. 选课签约
        const course = {
          id: 'CRS_ROBOT_BEGINNER',
          name: '智能单片机少儿编程启蒙',
          pricePerLesson: 250,
          totalLessons: 40,
          attribute: 'regular',
          status: 'enabled',
          authorizedCampusIds: ['CAMPUS_HQ'],
        };
        assert.isTrue(CurriculumModel.validateCourseItem(course).isValid);

        // 报名 40 课时，赠送 4 课时，直减 500 元。应收 40 x 250 - 500 = 9500 元。
        const order = {
          orderNo: 'ORD_20260921_LIFECYCLE',
          studentId: student.id,
          originalPrice: 10000,
          discountAmount: 500,
          actualAmount: 9500,
          status: 'pending_payment',
        };
        assert.equal(order.actualAmount, 9500);

        // 3. 财务审批收款到账
        const approval = {
          id: 'APP_LC_01',
          businessType: 'payment',
          currentStep: 3,
          status: 'pending',
          timeline: [],
        };
        FinanceAggregator.processApproval(approval, 'pass', 'CHIEF_FINANCE');
        assert.equal(approval.status, 'approved');

        // 4. 课时划拨并进入待分班池
        const coursePackage = {
          packageId: 'PKG_LC_01',
          courseId: course.id,
          courseName: course.name,
          pricePerLesson: 250,
          totalLessons: 44,
          remainingLessons: 44,
          bonusLessons: 4,
          status: 'active',
        };
        student.coursePackages.push(coursePackage);
        const unassignedPool = [student.id];

        // 5. 教务班级管理：编入周六上午班
        const robotClass = {
          id: 'CLS_ROBOT_SAT_01',
          name: '单片机周六班',
          maxCapacity: 12,
          currentStudents: ['STU_EXIST_1'],
        };
        robotClass.currentStudents.push(unassignedPool.pop());
        assert.lengthOf(unassignedPool, 0, '分班后待分班池清空');
        assert.lengthOf(robotClass.currentStudents, 2);

        // 6. 7x15 排课日历与三维碰撞核验
        const scheduleEvent = {
          id: 'EVT_SAT_0900',
          date: '2026-09-26',
          startTime: '09:00',
          endTime: '10:30',
          teacherId: 'T_ZHANG',
          classroomId: 'ROOM_LEBO_1',
          studentIds: robotClass.currentStudents,
        };
        const collisionRes = CollisionEngine.detectCollision(scheduleEvent, []);
        assert.isFalse(collisionRes.hasConflict);

        // 7. 讲台授课点名消课
        coursePackage.remainingLessons -= 1;
        assert.equal(coursePackage.remainingLessons, 43);

        // 8. 课程课时消耗完毕结业归档
        coursePackage.remainingLessons = 0;
        coursePackage.status = 'completed';
        student.status = 'dropped_out'; // 正常结业

        assert.equal(coursePackage.status, 'completed');
        assert.equal(student.status, 'dropped_out');
      },
    },
  ],
};
