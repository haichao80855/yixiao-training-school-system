/**
 * 压测造数：往「临时测试库」里批量写入一个校区若干年的业务数据，用来看接口耗时随数据量怎么增长。
 *
 * 规模 scale=1 约等于一个中等校区一年的量：
 *   300 名学员 (每人一个课包、一笔订单)、25 个班 (每班 12 人)、每班 40 节课 = 1000 节排课、
 *   过去的课都已点名 ≈ 1 万条上课记录。scale=10 就是 10 倍。
 *
 * 只允许写系统临时目录里的库 (tests/isolated-env.cjs 建的那种)，绝不碰 dev.db 或线上库。
 * 一般不直接运行，由 scripts/bench-api.cjs 调用：npm run bench
 */
const os = require('os');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'server');
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [SERVER] }));

function assertTempDatabase() {
  const url = process.env.DATABASE_URL || '';
  const file = url.replace(/^file:/, '');
  const tmp = fs_realpath(os.tmpdir());
  if (process.env.TEST_ISOLATED !== '1' || !file || !fs_realpath(path.dirname(file)).startsWith(tmp)) {
    throw new Error(`拒绝造数：DATABASE_URL 不在系统临时目录 (${url || '未设置'})。请通过 npm run bench 运行。`);
  }
}

function fs_realpath(p) {
  try {
    return require('fs').realpathSync(p);
  } catch {
    return p;
  }
}

function shanghaiDate(offsetDays) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

async function createInChunks(delegate, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await delegate.createMany({ data: rows.slice(i, i + size) });
  }
}

/**
 * @param {number} scale 规模倍数
 * @param {string} tag   本批数据的标记 (写进编号，方便识别)
 * @returns 写入的条数
 */
async function seedLoad(scale, tag = `L${Date.now().toString(36)}`) {
  assertTempDatabase();
  const prisma = new PrismaClient();
  try {
    const principal = await prisma.user.findFirst({ where: { account: 'zhangjh' } });
    const campusId = principal.campusId;
    const teachers = await prisma.user.findMany({ where: { OR: [{ campusId }, { account: 'zhaolp' }] }, select: { id: true }, take: 6 });
    const classrooms = await prisma.classroom.findMany({ where: { campusId }, select: { id: true } });
    const courses = await prisma.course.findMany({ select: { id: true, pricePerLesson: true }, take: 8 });
    if (!classrooms.length || !courses.length) throw new Error('种子数据里找不到该校区的教室或课程');

    const studentsPerClass = 12;
    const lessonsPerClass = 40;
    const classCount = Math.round(25 * scale);
    const now = Date.now();
    const counts = { students: 0, packages: 0, orders: 0, classes: 0, schedules: 0, attendances: 0 };

    const classes = [];
    const students = [];
    const packages = [];
    const orders = [];
    const schedules = [];
    const attendances = [];

    for (let c = 0; c < classCount; c += 1) {
      const course = courses[c % courses.length];
      const classId = `${tag}-cls-${c}`;
      const teacherId = teachers[c % teachers.length].id;
      const classroomId = classrooms[c % classrooms.length].id;
      // 让每个班的 40 节课分布在过去一年到未来两个月之间
      const firstOffset = -365 + Math.floor((c * 7) % 300);
      classes.push({
        id: classId,
        campusId,
        courseId: course.id,
        code: `${tag}-CLS-${c}`,
        name: `压测班${c}`,
        capacity: 16,
        currentStudentCount: studentsPerClass,
        teacherId,
        classroomId,
        startDate: new Date(now + firstOffset * 86400000),
        status: 'in_progress',
      });

      const classStudents = [];
      for (let s = 0; s < studentsPerClass; s += 1) {
        const n = c * studentsPerClass + s;
        const studentId = `${tag}-stu-${n}`;
        const packageId = `${tag}-pkg-${n}`;
        classStudents.push({ studentId, packageId });
        students.push({
          id: studentId,
          campusId,
          studentNo: `${tag}-S${n}`,
          name: `压测学员${n}`,
          gender: n % 2 ? 'male' : 'female',
          phone: `135${String(n).padStart(8, '0')}`,
          createdAt: new Date(now - (n % 365) * 86400000),
        });
        packages.push({
          id: packageId,
          studentId,
          courseId: course.id,
          classId,
          totalLessons: 48,
          remainingLessons: 20,
          consumedLessons: 28,
          pricePerLesson: course.pricePerLesson || 200,
          status: 'active',
        });
        orders.push({
          campusId,
          studentId,
          orderNo: `${tag}-ORD-${n}`,
          orderType: 'regular',
          status: 'paid',
          originalPrice: 9600,
          receivableAmount: 9600,
          actualAmount: 9600,
          paymentMethod: 'wechat',
          creatorId: principal.id,
          ownerId: principal.id,
          channel: 'ground',
          packageId,
          payTime: new Date(now - (n % 365) * 86400000),
          createdAt: new Date(now - (n % 365) * 86400000),
        });
      }

      for (let l = 0; l < lessonsPerClass; l += 1) {
        const offset = firstOffset + l * 7;
        const past = offset < 0;
        const scheduleId = `${tag}-sch-${c}-${l}`;
        schedules.push({
          id: scheduleId,
          campusId,
          classId,
          teacherId,
          classroomId,
          date: shanghaiDate(offset),
          startTime: `${String(9 + (c % 10)).padStart(2, '0')}:00`,
          endTime: `${String(10 + (c % 10)).padStart(2, '0')}:30`,
          status: past ? 'completed' : 'scheduled',
          semanticType: past ? 'completed' : 'regular',
        });
        if (past) {
          for (const { studentId, packageId } of classStudents) {
            const leave = (studentId.length + l) % 10 === 0;
            attendances.push({
              scheduleEventId: scheduleId,
              studentId,
              status: leave ? 'leave' : 'present',
              deductLessons: leave ? 0 : 1,
              regularBurned: leave ? 0 : 1,
              packageId,
              operator: 'bench',
              createdAt: new Date(now + offset * 86400000),
            });
          }
        }
      }
    }

    await createInChunks(prisma.class, classes);
    await createInChunks(prisma.student, students);
    await createInChunks(prisma.studentCoursePackage, packages);
    await createInChunks(prisma.order, orders);
    await createInChunks(prisma.scheduleEvent, schedules);
    await createInChunks(prisma.attendanceRecord, attendances, 1000);
    counts.classes = classes.length;
    counts.students = students.length;
    counts.packages = packages.length;
    counts.orders = orders.length;
    counts.schedules = schedules.length;
    counts.attendances = attendances.length;
    return counts;
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { seedLoad, assertTempDatabase };

if (require.main === module) {
  const scale = Number((process.argv.find((a) => a.startsWith('--scale=')) || '--scale=1').split('=')[1]);
  seedLoad(scale)
    .then((c) => console.log('写入：', c))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
