/**
 * 安全清理无任何引用的 263 条测试重复课程
 * 严谨保护被班级、课包引用的课程与用户自建课程
 */

const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 开始检查课程数据...');

  const duplicateNames = [
    '2026盛通全栈创新软硬件机器人高级研讨班',
    'Python与人工智能机器人创新进阶课',
  ];

  for (const name of duplicateNames) {
    const list = await prisma.course.findMany({
      where: { name },
      include: {
        _count: { select: { classes: true, studentPackages: true, units: true } },
      },
    });

    // 找出没有任何班级和课包引用的多余课程
    const unreferenced = list.filter((c) => c._count.classes === 0 && c._count.studentPackages === 0);

    if (unreferenced.length > 0) {
      const deleteIds = unreferenced.map((c) => c.id);
      console.log(`正在安全清理 [${name}] 的零引用冗余副本: 共 ${list.length} 条，可安全删除 ${deleteIds.length} 条...`);

      // 1. 先删除对应的 units 与 lessons（通过关联）
      const units = await prisma.courseUnit.findMany({
        where: { courseId: { in: deleteIds } },
        select: { id: true },
      });
      if (units.length > 0) {
        const unitIds = units.map((u) => u.id);
        await prisma.courseLesson.deleteMany({
          where: { unitId: { in: unitIds } },
        });
        await prisma.courseUnit.deleteMany({
          where: { id: { in: unitIds } },
        });
      }

      // 2. 删除校区授权
      await prisma.courseCampusAuth.deleteMany({
        where: { courseId: { in: deleteIds } },
      });

      // 3. 删除课程
      const res = await prisma.course.deleteMany({
        where: { id: { in: deleteIds } },
      });

      console.log(`✓ 成功清理 ${res.count} 条 [${name}]`);
    }
  }

  // 为用户创建的课程补齐全部校区授权，确保在任何校区都清晰可见
  const userCourses = await prisma.course.findMany({
    where: {
      name: { in: ['海潮Python课', '人工智能开发', 'Ai学习班'] },
    },
  });

  const campuses = await prisma.campus.findMany();

  for (const uc of userCourses) {
    for (const cp of campuses) {
      const existing = await prisma.courseCampusAuth.findFirst({
        where: { courseId: uc.id, campusId: cp.id },
      });
      if (!existing) {
        await prisma.courseCampusAuth.create({
          data: {
            courseId: uc.id,
            campusId: cp.id,
          },
        });
      }
    }
  }

  console.log('✓ 用户创建的课程已成功授权至全部校区！');

  const finalCounts = await prisma.course.groupBy({
    by: ['name'],
    _count: { id: true },
  });

  console.log('\n📊 清理后课程现状统计:');
  console.table(finalCounts.map((c) => ({ '课程名称': c.name, '当前数量': c._count.id })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
