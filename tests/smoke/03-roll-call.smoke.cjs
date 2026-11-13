/**
 * 冒烟 3：排课 → 点名 → 结课。
 * 用数据库夹具建好今天的一节课 (班级、2 名学员、课包)，执行校长在「授课点名消课」页进入点名，
 * 一人到课、一人请假，提交下课结算；然后核对点名结果、课时扣减和课次状态。
 */
const { PrismaClient } = require('../../server/node_modules/@prisma/client');
const { runSmoke, loginAs, apiLogin, check, clickText, todayInShanghai } = require('./helpers.cjs');

const prisma = new PrismaClient();

runSmoke('排课点名结课', async (s) => {
  const { user } = await apiLogin('principal');
  const campusId = user.campusId;
  const tag = `__t_${Date.now().toString(36)}`;
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());
  const teacher = await prisma.user.findFirst({ where: { account: 'zhaolp' } });
  const classroom = await prisma.classroom.create({ data: { campusId, code: `CR-${tag}`, name: `冒烟教室${tag}` } });
  const cls = await prisma.class.create({
    data: {
      campusId, courseId: course.id, teacherId: teacher.id, classroomId: classroom.id, name: `冒烟点名班${tag}`, code: `CLS-${tag}`,
      capacity: 10, status: 'in_progress', startDate: new Date(Date.now() - 86400000 * 7), endDate: new Date(Date.now() + 86400000 * 90),
    },
  });
  const mk = async (suffix) => {
    const st = await prisma.student.create({ data: { campusId, name: `冒烟${suffix}${tag}`, studentNo: `${tag}${suffix}`, gender: 'male', phone: '13800000000' } });
    const pkg = await prisma.studentCoursePackage.create({ data: { studentId: st.id, courseId: course.id, classId: cls.id, totalLessons: 20, remainingLessons: 20, consumedLessons: 0, status: 'active' } });
    return { st, pkg };
  };
  const a = await mk('到课');
  const b = await mk('请假');
  const schedule = await prisma.scheduleEvent.create({
    data: { campusId, classId: cls.id, teacherId: teacher.id, classroomId: classroom.id, date: todayInShanghai(), startTime: '19:00', endTime: '20:30', status: 'scheduled' },
  });
  check(true, `夹具：今天 19:00 的「${cls.name}」，2 名学员各 20 课时`);

  await loginAs(s, 'principal');
  const page = s.page;
  await page.goto(`${s.url}/educational/attendance`, { waitUntil: 'networkidle0' });
  await page.waitForFunction((n) => document.body.innerText.includes(n), {}, cls.name);
  check(true, '今天的待点名列表里有这节课');

  // 进入点名：找到这节课所在行的「进入点名」
  const row = await page.evaluateHandle((n) => [...document.querySelectorAll('.el-table__row')].find((r) => r.innerText.includes(n)), cls.name);
  const enter = await row.asElement().evaluateHandle((r) => [...r.querySelectorAll('button')].find((b) => b.innerText.includes('进入点名')));
  await enter.asElement().click();
  await page.waitForFunction((n) => [...document.querySelectorAll('.el-drawer')].some((d) => d.innerText.includes(n)), {}, a.st.name);
  const drawerText = await page.$eval('.el-drawer', (el) => el.innerText);
  check(drawerText.includes(a.st.name) && drawerText.includes(b.st.name), '点名抽屉列出这节课的 2 名学员');

  // 学员 B 改为请假
  const bRow = await page.evaluateHandle((n) => [...document.querySelectorAll('.el-drawer .el-table__row')].find((r) => r.innerText.includes(n)), b.st.name);
  const leave = await bRow.asElement().evaluateHandle((r) => [...r.querySelectorAll('.el-radio-button')].find((x) => x.innerText.includes('请假')));
  await leave.asElement().click();

  await clickText(page, '确认下课并结算消课', '.el-drawer button');
  await clickText(page, '确认消课', '.el-message-box button');
  // 等结算落库 (成功提示一闪而过，以数据库为准)
  for (let i = 0; i < 50; i++) {
    if ((await prisma.scheduleEvent.findUnique({ where: { id: schedule.id } })).status === 'completed') break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // 核对数据库
  const records = await prisma.attendanceRecord.findMany({ where: { scheduleEventId: schedule.id, isReversed: false } });
  const byStudent = Object.fromEntries(records.map((r) => [r.studentId, r]));
  check(byStudent[a.st.id]?.status === 'present' && byStudent[b.st.id]?.status === 'leave', '点名结果落库：一人到课、一人请假');
  const [pa, pb] = await Promise.all([a.pkg, b.pkg].map((p) => prisma.studentCoursePackage.findUnique({ where: { id: p.id } })));
  check(pa.remainingLessons === 19 && pb.remainingLessons === 20, `到课学员扣 1 课时 (剩 ${pa.remainingLessons})，请假学员不扣 (剩 ${pb.remainingLessons})`);
  if (byStudent[a.st.id]?.comment === '随堂实操任务完成良好') {
    console.log('  ⚠️  已知缺陷复现：老师没写评语，学员评语却被存成「随堂实操任务完成良好」(见 tests/unit/normalizers.spec.ts 的 it.fails)');
  }
  const ev = await prisma.scheduleEvent.findUnique({ where: { id: schedule.id } });
  check(ev.status === 'completed', '课次状态变为已结课');

  await page.reload({ waitUntil: 'networkidle0' });
  const rowText = await page.evaluate((n) => [...document.querySelectorAll('.el-table__row')].find((r) => r.innerText.includes(n))?.innerText || '', cls.name);
  check(rowText.includes('已消课'), '刷新后列表里这节课显示「已消课」');
}).finally(() => prisma.$disconnect());
