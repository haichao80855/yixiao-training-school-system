/**
 * 拓视未来教育「一校教培系统」底层数据库物理存量实时统计工具
 */
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../server/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function showStats() {
  console.log('\n================================================================');
  console.log('📊 拓视未来教育「一校教培系统」底层数据库物理存量实时统计');
  console.log('================================================================\n');

  try {
    const studentCount = await prisma.student.count();
    const courseCount = await prisma.course.count();
    const lessonCount = await prisma.courseLesson.count();
    const classCount = await prisma.class.count();
    const scheduleCount = await prisma.scheduleEvent.count();
    const attendanceCount = await prisma.attendanceRecord.count();
    const orderCount = await prisma.order.count();
    const approvalCount = await prisma.approvalFlow.count();
    const userCount = await prisma.user.count();
    const campusCount = await prisma.campus.count();

    console.log(`  👨‍🎓 学员档案总数 (Student)       : ${studentCount} 人`);
    console.log(`  🏫 实体班级总数 (Class)         : ${classCount} 个`);
    console.log(`  📚 研发课程总数 (Course)        : ${courseCount} 门`);
    console.log(`  🎬 白板课件总数 (CourseLesson)  : ${lessonCount} 套`);
    console.log(`  📅 排课日程总数 (ScheduleEvent) : ${scheduleCount} 节`);
    console.log(`  ⏱️ 考勤消课记录 (Attendance)    : ${attendanceCount} 节`);
    console.log(`  💰 财务签约订单 (Order)         : ${orderCount} 笔`);
    console.log(`  📋 审批流转单据 (ApprovalFlow)  : ${approvalCount} 笔`);
    console.log(`  👨‍🏫 教职员工账号 (User)          : ${userCount} 位`);
    console.log(`  🏢 物理实体校区 (Campus)        : ${campusCount} 所`);

    console.log('\n----------------------------------------------------------------');
    console.log('💡 查看具体学员花名册:');
    const sampleStudents = await prisma.student.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { studentNo: true, name: true, phone: true, status: true }
    });
    console.log('最新录入的 5 位学员示例:');
    sampleStudents.forEach((s, idx) => {
      console.log(`  ${idx + 1}. [${s.studentNo}] ${s.name} (电话: ${s.phone || '无'}, 状态: ${s.status})`);
    });
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ 查询数据库失败:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

showStats();
