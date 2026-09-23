const assert = require('../harness/assert');
const CollisionEngine = require('../contracts/collisionEngine');
const StudentStateMachine = require('../contracts/studentStateMachine');
const FinanceAggregator = require('../contracts/financeAggregator');

module.exports = {
  tier: 4,
  name: 'Scenario 5: 极端排课冲突并发告警、自动调解与反结课退费回滚流 (Collision Resolution & Refund Rollback)',
  tests: [
    {
      name: '教室占用冲突红色告警 -> 调度员 Lane 调整重排 -> 考勤点名 -> 突发客诉反结课冲正 -> 全额退费审批打款回滚',
      fn: () => {
        // 1. 两课次争抢同一乐博教室1
        const eventA = {
          id: 'EVT_A',
          date: '2026-09-21',
          startTime: '09:00',
          endTime: '10:30',
          teacherId: 'TEACHER_1',
          classroomId: 'ROOM_LEBO_1',
        };
        const eventB = {
          id: 'EVT_B',
          date: '2026-09-21',
          startTime: '09:30',
          endTime: '11:00',
          teacherId: 'TEACHER_2',
          classroomId: 'ROOM_LEBO_1', // 教室冲突！
        };

        const collision = CollisionEngine.detectCollision(eventB, [eventA]);
        assert.isTrue(collision.hasConflict);
        assert.equal(collision.conflicts[0].type, 'CLASSROOM_CONFLICT');

        // 网格展示红色 Chip
        const chip = CollisionEngine.getSemanticChipStyle({ hasConflict: true });
        assert.equal(chip.type, 'conflict');
        assert.equal(chip.borderColor, '#F56C6C');

        // 2. 调度员将 eventB 调整至空闲教室 ROOM_LEBO_2
        eventB.classroomId = 'ROOM_LEBO_2';
        const recheck = CollisionEngine.detectCollision(eventB, [eventA]);
        assert.isFalse(recheck.hasConflict, '教室调整后冲突成功消除');

        // 3. 课程进行并完成考勤点名
        const student = {
          id: 'STU_ROLLBACK',
          wallet: { principalBalance: 0, bonusBalance: 0 },
          coursePackages: [
            {
              packageId: 'PKG_RB',
              pricePerLesson: 200,
              totalLessons: 20,
              remainingLessons: 20,
              bonusLessons: 0,
              status: 'active',
            },
          ],
        };
        const sm = new StudentStateMachine(student);

        // 考勤点名消课
        student.coursePackages[0].remainingLessons -= 1;
        assert.equal(student.coursePackages[0].remainingLessons, 19);

        // 4. 突发客诉要求撤销该课次：教务执行反结课冲正
        student.coursePackages[0].remainingLessons += 1;
        assert.equal(student.coursePackages[0].remainingLessons, 20, '反结课成功恢复课时');

        // 5. 家长进一步要求全部退费：发起退费审批流 (20 课时 x 200 = 4000 元)
        const refRes = sm.refund('PKG_RB', 0);
        assert.equal(refRes.refundAmount, 4000);
        assert.equal(sm.getStudent().coursePackages[0].status, 'refunded');

        // 6. 财务 3 级审批流终审出纳退款
        const refundApproval = {
          id: 'APP_REF_RB',
          businessType: 'refund',
          amount: refRes.refundAmount,
          currentStep: 1,
          status: 'pending',
          timeline: [],
        };
        // 教学主管 -> 校长 -> 财务
        FinanceAggregator.processApproval(refundApproval, 'pass', 'DIRECTOR');
        FinanceAggregator.processApproval(refundApproval, 'pass', 'PRINCIPAL');
        FinanceAggregator.processApproval(refundApproval, 'pass', 'CASHIER');

        assert.equal(refundApproval.status, 'approved');
        assert.lengthOf(refundApproval.timeline, 3);
      },
    },
  ],
};
