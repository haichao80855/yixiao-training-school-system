/**
 * ============================================================================
 * 拓视未来教育「一校教培系统」课件资产专属流式 ETL 导入工具 (L2 Asset Pipeline)
 * 将 118 门官方核心课程及 2353+ 套白板课件批量结构化导入服务端数据库 (Prisma / PostgreSQL / SQLite)
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface RawLessonResource {
  id: number;
  resourceType: number;
  name: string;
  pptUrl?: string;
  downloadUrl?: string;
  fid?: number | string;
  fileSize?: string;
}

interface RawLesson {
  sessionId: number;
  sessionCode: string;
  sessionName: string;
  pptUrl?: string;
  pptFileName?: string;
  downloadUrl?: string;
  resources?: RawLessonResource[];
}

interface RawCourse {
  id: number;
  courseName: string;
  courseCode: string;
  lessonTotal: number;
  lessons?: RawLesson[];
}

function detectSubject(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('python')) return 'python';
  if (n.includes('c++') || n.includes('cpp') || n.includes('信奥') || n.includes('算法')) return 'cpp';
  if (n.includes('scratch') || n.includes('图形') || n.includes('动画')) return 'scratch';
  if (n.includes('机器') || n.includes('硬件') || n.includes('乐高') || n.includes('单片机') || n.includes('单板')) return 'robotics';
  return 'scratch';
}

function detectGrade(name: string): string {
  if (name.includes('高阶') || name.includes('集训') || name.includes('初中') || name.includes('高中') || name.includes('csp')) return 'senior';
  if (name.includes('进阶') || name.includes('中阶') || name.includes('二阶')) return 'middle';
  return 'junior';
}

async function runCoursewareETL() {
  console.log('================================================================================');
  console.log('🚀 启动课件与课程资产 ETL 数据库沉淀流水线 (L2 Stream Importer)');
  console.log('================================================================================\n');

  const jsonCandidates = [
    path.resolve(__dirname, '../../src/mocks/allCoursesDetailsWithCoursewares.json'),
    path.resolve(__dirname, '../src/mocks/allCoursesDetailsWithCoursewares.json'),
    path.resolve(process.cwd(), 'src/mocks/allCoursesDetailsWithCoursewares.json'),
  ];

  let jsonPath = '';
  for (const p of jsonCandidates) {
    if (fs.existsSync(p)) {
      jsonPath = p;
      break;
    }
  }

  if (!jsonPath) {
    console.error('❌ 未找到 allCoursesDetailsWithCoursewares.json 源文件，请检查文件路径！');
    process.exit(1);
  }

  console.log(`[ETL] 读取课件源文件: ${jsonPath}`);
  const rawData: Record<string, RawCourse> = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const courseKeys = Object.keys(rawData);
  console.log(`[ETL] 共发现 ${courseKeys.length} 门课程元数据待同步入库...\n`);

  // 获取默认授权校区
  let defaultCampus = await prisma.campus.findFirst({
    where: { code: 'campus-bj-hq' },
  });
  if (!defaultCampus) {
    defaultCampus = await prisma.campus.findFirst();
  }

  let importedCourses = 0;
  let importedLessons = 0;
  const startTime = Date.now();

  for (let i = 0; i < courseKeys.length; i++) {
    const key = courseKeys[i];
    const item = rawData[key];
    const courseCode = item.courseCode || `CRS-${key.slice(0, 8)}`;
    const courseName = item.courseName?.trim() || `标准课程-${key.slice(0, 6)}`;
    const lessons = item.lessons || [];

    // 1. Upsert 课程主体
    const course = await prisma.course.upsert({
      where: { code: courseCode },
      update: {
        name: courseName,
        totalLessons: Math.max(item.lessonTotal || 0, lessons.length, 1),
        subject: detectSubject(courseName),
        grade: detectGrade(courseName),
      },
      create: {
        code: courseCode,
        name: courseName,
        cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80',
        pricePerLesson: 280.0,
        totalLessons: Math.max(item.lessonTotal || 0, lessons.length, 1),
        subject: detectSubject(courseName),
        grade: detectGrade(courseName),
        attribute: 'regular',
        status: 'enabled',
        description: `盛通教育官方标准研发课程：${courseName}`,
      },
    });
    importedCourses++;

    // 2. 授权至校区
    if (defaultCampus) {
      await prisma.courseCampusAuth.upsert({
        where: {
          courseId_campusId: {
            courseId: course.id,
            campusId: defaultCampus.id,
          },
        },
        update: {},
        create: {
          courseId: course.id,
          campusId: defaultCampus.id,
        },
      });
    }

    // 3. 创建/获取默认单元 (Unit)
    let unit = await prisma.courseUnit.findFirst({
      where: { courseId: course.id },
    });
    if (!unit) {
      unit = await prisma.courseUnit.create({
        data: {
          courseId: course.id,
          unitName: '第 1 阶段：核心教学大纲与实战演练',
          sort: 1,
        },
      });
    }

    // 4. 同步课次 (Lessons)
    if (lessons.length > 0) {
      // 预先查询已有课次，避免重复插入
      const existingLessons = await prisma.courseLesson.findMany({
        where: { unitId: unit.id },
        select: { id: true, lessonName: true },
      });
      const existingNames = new Set(existingLessons.map((l) => l.lessonName));

      const newLessonsData = [];
      for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
        const l = lessons[lIdx];
        const lName = l.sessionName?.trim() || `第 ${lIdx + 1} 课：核心知识与项目实战`;
        if (!existingNames.has(lName)) {
          newLessonsData.push({
            unitId: unit.id,
            lessonName: lName,
            durationMin: 90,
            courseware: l.pptUrl || l.downloadUrl || '',
            sort: lIdx + 1,
          });
        }
      }

      if (newLessonsData.length > 0) {
        // 分批插入
        const chunkSize = 100;
        for (let c = 0; c < newLessonsData.length; c += chunkSize) {
          const chunk = newLessonsData.slice(c, c + chunkSize);
          await prisma.courseLesson.createMany({
            data: chunk,
          });
        }
        importedLessons += newLessonsData.length;
      }
    }

    if ((i + 1) % 20 === 0 || i === courseKeys.length - 1) {
      console.log(`  [Progress] 已处理课程 ${i + 1}/${courseKeys.length} 门，已入库课次累计: ${importedLessons} 节...`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================================');
  console.log(`✅ 课件与课程资产 ETL 入库完成！`);
  console.log(`  - 课程入库/更新数: ${importedCourses} 门`);
  console.log(`  - 白板课件入库数: ${importedLessons} 套`);
  console.log(`  - 耗时: ${elapsed} 秒`);
  console.log('================================================================================\n');

  await prisma.$disconnect();
}

runCoursewareETL().catch(async (e) => {
  console.error('❌ ETL 执行异常:', e);
  await prisma.$disconnect();
  process.exit(1);
});
