/**
 * 拓视未来教育「一校教培系统」班级测试数据一键清空工具
 * 清空所有实体班级档案及关联的排课日程
 * 保留组织架构、物理校区、教研课程、教室资源及教职工账号
 */
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../server/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function clearClassData() {
  console.log('\n================================================================');
  console.log('🧹 正在执行实体班级测试数据安全清空...');
  console.log('================================================================\n');

  try {
    const classCountBefore = await prisma.class.count();
    const scheduleCountBefore = await prisma.scheduleEvent.count();
    const attendanceCountBefore = await prisma.attendanceRecord.count();

    console.log(`[当前存量] 实体班级: ${classCountBefore} 个 | 排课日程: ${scheduleCountBefore} 节 | 考勤消课: ${attendanceCountBefore} 条`);

    // 1. 解绑所有课包中关联的班级外键（防止外键依赖阻塞）
    const unlinkedPackages = await prisma.studentCoursePackage.updateMany({
      where: { classId: { not: null } },
      data: { classId: null }
    });
    if (unlinkedPackages.count > 0) {
      console.log(`✓ 已解绑学员课包中的班级关联: ${unlinkedPackages.count} 个`);
    }

    // 2. 清理排课日程下的考勤记录
    const deletedAttendances = await prisma.attendanceRecord.deleteMany({});
    if (deletedAttendances.count > 0) {
      console.log(`✓ 已清理考勤消课记录: ${deletedAttendances.count} 条`);
    }

    // 3. 删除所有排课日程 (ScheduleEvent)
    const deletedSchedules = await prisma.scheduleEvent.deleteMany({});
    console.log(`✓ 已清空关联排课日程 (ScheduleEvent): ${deletedSchedules.count} 节`);

    // 4. 删除所有班级档案实体 (Class)
    const deletedClasses = await prisma.class.deleteMany({});
    console.log(`✓ 已彻底清空实体班级档案 (Class): ${deletedClasses.count} 个`);

    console.log('\n================================================================');
    console.log('🎉 实体班级测试数据已全部清空！当前班级总数: 0');
    console.log('💡 核心基础设施配置（校区、课程、教室、教职员工账号）完好保留');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ 清空班级数据过程出现异常:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearClassData();
