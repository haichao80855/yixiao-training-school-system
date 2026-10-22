/**
 * 拓视未来教育「一校教培系统」全量预设学员与课程落库初始化流水线
 * 将 22 位实体学员 (包括总部校区的张小萌、李浩轩、陈宇杰等) 及其签约课包、钱包、标准课程彻底持久化入库
 */

import { PrismaClient } from '@prisma/client';
import { normalizeCnMobile } from '../src/common/phone.util';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 4 门标准常用核心研发课程
const PRESET_COURSES = [
  {
    id: 'course-scratch-001',
    code: 'CRS-SCRATCH-001',
    name: '012-软编Scratch创意图形编程',
    cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop',
    pricePerLesson: 280.0,
    totalLessons: 48,
    subject: 'scratch',
    grade: 'junior',
    attribute: 'regular',
    status: 'enabled',
    description: '面向 6-8 岁儿童的图形化创意少儿编程标准课程体系',
  },
  {
    id: 'course-python-003',
    code: 'CRS-PYTHON-003',
    name: '008-Python人工智能趣味算法',
    cover: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop',
    pricePerLesson: 300.0,
    totalLessons: 48,
    subject: 'python',
    grade: 'middle',
    attribute: 'extended',
    status: 'enabled',
    description: 'Python代码实战与人工智能基础进阶课程',
  },
  {
    id: 'course-cpp-002',
    code: 'CRS-CPP-002',
    name: '001-信息学奥赛C++高阶培优班',
    cover: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop',
    pricePerLesson: 350.0,
    totalLessons: 64,
    subject: 'cpp',
    grade: 'senior',
    attribute: 'regular',
    status: 'enabled',
    description: '针对 CSP-J/S 与全国青少信息学奥林匹克竞赛金牌冲刺',
  },
  {
    id: 'course-robot-004',
    code: 'CRS-ROBOT-004',
    name: '003-少儿编程乐高EV3创意搭建课',
    cover: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&auto=format&fit=crop',
    pricePerLesson: 320.0,
    totalLessons: 48,
    subject: 'robotics',
    grade: 'junior',
    attribute: 'activity',
    status: 'enabled',
    description: '结合乐高硬件与传感器智能编程的创客实践课',
  },
];

async function main() {
  console.log('================================================================================');
  console.log('🚀 启动全量预设学员与核心课程资产入库流水线');
  console.log('================================================================================\n');

  // 1. 初始化并授权 4 门常用核心课程
  console.log('[1/3] 初始化常用核心课程与跨校区授权...');
  const campuses = await prisma.campus.findMany();

  for (const c of PRESET_COURSES) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: {
        id: c.id,
        name: c.name,
        pricePerLesson: c.pricePerLesson,
        totalLessons: c.totalLessons,
        subject: c.subject,
        grade: c.grade,
        attribute: c.attribute,
        status: 'enabled',
      },
      create: c,
    });

    // 授权至所有 5 大实体校区
    for (const campus of campuses) {
      await prisma.courseCampusAuth.upsert({
        where: {
          courseId_campusId: {
            courseId: course.id,
            campusId: campus.id,
          },
        },
        update: {},
        create: {
          courseId: course.id,
          campusId: campus.id,
        },
      });
    }
  }
  console.log('✓ 4 门常用核心课程已成功入库并全校区授权');

  // 2. 读取并持久化 22 位预设学员
  console.log('\n[2/3] 读取并持久化 22 位预设学员档案...');
  const studentMockPath = path.resolve(__dirname, '../../src/mocks/student.ts');
  const mockContent = fs.readFileSync(studentMockPath, 'utf-8');
  const match = mockContent.match(/export const PRESET_MOCK_STUDENTS: Student\[\] = (\[[\s\S]*?\n\];?\n)/);

  if (!match) {
    console.error('未在 src/mocks/student.ts 找到 PRESET_MOCK_STUDENTS');
    process.exit(1);
  }

  const presetStudents = eval(match[1]);
  console.log(`找到 ${presetStudents.length} 位预设学员，开始入库...`);

  let studentCount = 0;
  let packageCount = 0;

  for (const stu of presetStudents) {
    // 确保所属校区有效
    let targetCampusId = stu.campusId;
    const campusExist = campuses.some((c) => c.id === targetCampusId);
    if (!campusExist) {
      targetCampusId = campuses[0].id;
    }

    // 插入或更新学员
    const savedStudent = await prisma.student.upsert({
      where: { studentNo: stu.studentNo },
      update: {
        id: stu.id,
        name: stu.name,
        gender: stu.gender,
        phone: stu.phone,
        phoneNormalized: normalizeCnMobile(stu.phone),
        parentName: stu.parentName,
        school: stu.school,
        status: stu.status,
        campusId: targetCampusId,
      },
      create: {
        id: stu.id,
        studentNo: stu.studentNo,
        name: stu.name,
        gender: stu.gender,
        phone: stu.phone,
        phoneNormalized: normalizeCnMobile(stu.phone),
        parentName: stu.parentName,
        school: stu.school,
        status: stu.status,
        campusId: targetCampusId,
      },
    });
    studentCount++;

    // 插入或更新电子钱包
    if (stu.wallet) {
      await prisma.studentWallet.upsert({
        where: { studentId: savedStudent.id },
        update: {
          principalBalance: stu.wallet.principalBalance || 0,
          bonusBalance: stu.wallet.bonusBalance || 0,
          goldPoints: stu.wallet.goldPoints || 0,
        },
        create: {
          studentId: savedStudent.id,
          principalBalance: stu.wallet.principalBalance || 0,
          bonusBalance: stu.wallet.bonusBalance || 0,
          goldPoints: stu.wallet.goldPoints || 0,
        },
      });
    }

    // 插入或更新签约课包
    if (stu.coursePackages && stu.coursePackages.length > 0) {
      for (const pkg of stu.coursePackages) {
        // 查找或使用默认课程
        let courseId = pkg.courseId;
        const courseExist = await prisma.course.findFirst({
          where: {
            OR: [{ id: courseId }, { code: courseId }],
          },
        });
        if (!courseExist) {
          courseId = PRESET_COURSES[0].id;
        } else {
          courseId = courseExist.id;
        }

        const existingPkg = await prisma.studentCoursePackage.findFirst({
          where: {
            studentId: savedStudent.id,
            courseId: courseId,
          },
        });

        if (!existingPkg) {
          await prisma.studentCoursePackage.create({
            data: {
              id: pkg.packageId || `pkg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              studentId: savedStudent.id,
              courseId: courseId,
              totalLessons: pkg.totalLessons || 48,
              remainingLessons: pkg.remainingLessons || 28,
              consumedLessons: pkg.consumedLessons || 0,
              bonusLessons: pkg.bonusLessons || 4,
              pricePerLesson: pkg.pricePerLesson || 280,
              status: pkg.status || 'active',
              orderNo: pkg.orderNo || `ORD-${savedStudent.studentNo}`,
            },
          });
          packageCount++;
        }
      }
    }
  }

  console.log(`✓ 成功入库 ${studentCount} 位预设学员档案`);
  console.log(`✓ 成功入库 ${packageCount} 套在读签约课包资产`);

  // 3. 统计各校区学员分布
  console.log('\n[3/3] 验证各校区学员物理分布:');
  for (const c of campuses) {
    const cnt = await prisma.student.count({ where: { campusId: c.id } });
    console.log(`  - [${c.name}] (${c.id}): ${cnt} 位学员`);
  }

  console.log('\n================================================================================');
  console.log('✅ 全量预设学员与课程资产入库完毕！');
  console.log('================================================================================\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
