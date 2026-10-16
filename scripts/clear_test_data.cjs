const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../server/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function clearTestData() {
  console.log('🚀 开始清除测试数据（同学、班级、老师、上课数据），保留管理员数据...');

  // 1. 获取管理员 ID 列表以供校验
  const adminUsers = await prisma.user.findMany({
    where: {
      account: { in: ['donghaichao', 'donghaichao_lead'] },
    },
    select: { id: true, account: true, realName: true },
  });

  const adminIds = adminUsers.map((u) => u.id);
  console.log('🛡️ 将严格保留的管理员账号:', adminUsers);

  if (adminIds.length === 0) {
    throw new Error('未检测到管理员账号 (donghaichao)，中止操作以防误删！');
  }

  // 2. 事务内按拓扑依赖顺序清理业务数据
  const result = await prisma.$transaction(async (tx) => {
    // 2.1 课评出站消息与子项
    const delOutbox = await tx.lessonEvaluationOutbox.deleteMany({});
    const delEvalStudentItems = await tx.lessonEvaluationStudentItem.deleteMany({});
    const delEvalRevisions = await tx.lessonEvaluationRevision.deleteMany({});
    const delEvaluations = await tx.lessonEvaluation.deleteMany({});

    // 2.2 考勤与上课排课
    const delAttendances = await tx.attendanceRecord.deleteMany({});
    const delSchedules = await tx.scheduleEvent.deleteMany({});

    // 2.3 考级/竞赛服务费
    const delServiceFees = await tx.serviceFeeRecord.deleteMany({});

    // 2.4 审批与订单
    const delApprovalNodes = await tx.approvalNode.deleteMany({});
    const delApprovalFlows = await tx.approvalFlow.deleteMany({});
    const delOrders = await tx.order.deleteMany({});

    // 2.5 学员异动、课包、钱包流水与钱包
    const delAbnormals = await tx.studentAbnormalMovement.deleteMany({});
    const delPackages = await tx.studentCoursePackage.deleteMany({});
    const delLedgers = await tx.walletLedger.deleteMany({});
    const delWallets = await tx.studentWallet.deleteMany({});

    // 2.6 班级与学员
    const delClasses = await tx.class.deleteMany({});
    const delStudents = await tx.student.deleteMany({});

    // 2.7 清理非管理员用户（老师/其他测试员工）
    const delUserRoles = await tx.userRole.deleteMany({
      where: {
        userId: { notIn: adminIds },
      },
    });
    const delUsers = await tx.user.deleteMany({
      where: {
        id: { notIn: adminIds },
      },
    });

    return {
      delEvaluations: delEvaluations.count,
      delAttendances: delAttendances.count,
      delSchedules: delSchedules.count,
      delOrders: delOrders.count,
      delPackages: delPackages.count,
      delClasses: delClasses.count,
      delStudents: delStudents.count,
      delUsers: delUsers.count,
      delUserRoles: delUserRoles.count,
    };
  });

  console.log('✅ 测试数据清除完成！统计如下：');
  console.log(`- 清除上课日程 (ScheduleEvent): ${result.delSchedules} 条`);
  console.log(`- 清除签到考勤 (AttendanceRecord): ${result.delAttendances} 条`);
  console.log(`- 清除随堂课评 (LessonEvaluation): ${result.delEvaluations} 条`);
  console.log(`- 清除班级 (Class): ${result.delClasses} 条`);
  console.log(`- 清除学员 (Student): ${result.delStudents} 条`);
  console.log(`- 清除学员课包 (StudentCoursePackage): ${result.delPackages} 条`);
  console.log(`- 清除财务订单 (Order): ${result.delOrders} 条`);
  console.log(`- 清除非管理员老师/员工 (User): ${result.delUsers} 人`);

  // 3. 验证保留的系统状态
  const remainingUsers = await prisma.user.findMany({
    include: { userRoles: { include: { role: true } }, campus: true },
  });
  console.log('\n🔒 当前保留的用户列表：');
  for (const u of remainingUsers) {
    const roles = u.userRoles.map((ur) => ur.role.name).join(', ');
    console.log(`  - 账号: ${u.account} | 姓名: ${u.realName} | 校区: ${u.campus.name} | 角色: ${roles}`);
  }

  const remainingStudents = await prisma.student.count();
  const remainingClasses = await prisma.class.count();
  const remainingSchedules = await prisma.scheduleEvent.count();
  console.log(`\n📊 校验业务数据现状：学员数=${remainingStudents}, 班级数=${remainingClasses}, 上课日程数=${remainingSchedules}`);
}

clearTestData()
  .catch((e) => {
    console.error('❌ 清理失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
