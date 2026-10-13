/**
 * 拓视未来教育「一校教培系统」学员业务测试数据一键清空工具
 * 清空学员档案及其全生命周期关联业务数据（订单、审批、考勤消课、钱包、异动、在读课包）
 * 保留组织架构、物理校区、教研课程、班级骨架、教室资源及教职工账号
 */
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../server/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function clearStudentData() {
  console.log('\n================================================================');
  console.log('🧹 正在执行学员业务测试数据安全清空...');
  console.log('================================================================\n');

  try {
    const studentCountBefore = await prisma.student.count();
    const orderCountBefore = await prisma.order.count();
    const attendanceCountBefore = await prisma.attendanceRecord.count();
    const packageCountBefore = await prisma.studentCoursePackage.count();
    const walletCountBefore = await prisma.studentWallet.count();
    const ledgerCountBefore = await prisma.walletLedger.count();
    const movementCountBefore = await prisma.studentAbnormalMovement.count();
    const approvalCountBefore = await prisma.approvalFlow.count();

    console.log(`[当前存量] 学员: ${studentCountBefore} | 订单: ${orderCountBefore} | 考勤: ${attendanceCountBefore} | 课包: ${packageCountBefore} | 钱包: ${walletCountBefore}`);

    // 1. 删除与学员订单强绑定的审批流节点与单据
    const deletedNodes = await prisma.approvalNode.deleteMany({});
    const deletedFlows = await prisma.approvalFlow.deleteMany({});
    console.log(`✓ 已清理审批流记录: 节点 ${deletedNodes.count} 条, 工单 ${deletedFlows.count} 笔`);

    // 2. 删除学员签约报名单与财务订单
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`✓ 已清理财务签约订单: ${deletedOrders.count} 笔`);

    // 3. 删除随堂考勤消课与点名记录
    const deletedAttendances = await prisma.attendanceRecord.deleteMany({});
    console.log(`✓ 已清理考勤点名消课记录: ${deletedAttendances.count} 节`);

    // 4. 删除电子钱包账本流水与钱包账户
    const deletedLedgers = await prisma.walletLedger.deleteMany({});
    const deletedWallets = await prisma.studentWallet.deleteMany({});
    console.log(`✓ 已清理学员钱包账户及流水: 账本 ${deletedLedgers.count} 条, 钱包 ${deletedWallets.count} 个`);

    // 5. 删除学员学籍异动流转记录
    const deletedMovements = await prisma.studentAbnormalMovement.deleteMany({});
    console.log(`✓ 已清理学员学籍异动记录: ${deletedMovements.count} 条`);

    // 6. 删除学员在读与历史课程课包
    const deletedPackages = await prisma.studentCoursePackage.deleteMany({});
    console.log(`✓ 已清理学员课程课包记录: ${deletedPackages.count} 个`);

    // 7. 删除所有学员档案实体
    const deletedStudents = await prisma.student.deleteMany({});
    console.log(`✓ 已彻底清空学员档案 (Student): ${deletedStudents.count} 人`);

    // 8. 重置班级学员计数为 0
    const updatedClasses = await prisma.class.updateMany({
      data: { currentStudentCount: 0 }
    });
    console.log(`✓ 已重置实体班级人数计数 (currentStudentCount = 0): ${updatedClasses.count} 个班级`);

    // 9. 将已完成结课的点名日程恢复为待上课 scheduled
    const resetSchedules = await prisma.scheduleEvent.updateMany({
      where: { status: 'completed' },
      data: { status: 'scheduled', semanticType: 'regular' }
    });
    console.log(`✓ 已重置已结课排课日程为待上课状态 (scheduled): ${resetSchedules.count} 节`);

    console.log('\n================================================================');
    console.log('🎉 学员测试数据已全部清空！当前学员总数: 0');
    console.log('💡 核心基础设施配置（校区、课程、教室、班级骨架、教职员工）完好保留');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ 清空数据过程出现异常:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearStudentData();
