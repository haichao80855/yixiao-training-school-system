/**
 * 冒烟 4：老师发布课评 → 执行校长的铃铛出现通知 → 点开跳到对应页面 → 标为已读。
 * 课次和结课用夹具 + 接口完成 (等同老师在讲台上结课发布课评)，界面只测执行校长看到并处理通知。
 */
const { PrismaClient } = require('../../server/node_modules/@prisma/client');
const { runSmoke, loginAs, apiLogin, api, check, clickText, todayInShanghai } = require('./helpers.cjs');

const prisma = new PrismaClient();

runSmoke('课评发布后铃铛通知', async (s) => {
  const { user: principal } = await apiLogin('principal');
  const campusId = principal.campusId;
  const { token: adminToken } = await apiLogin('superAdmin');
  const tag = `__t_${Date.now().toString(36)}`;
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());
  const teacher = await prisma.user.findFirst({ where: { account: 'zhaolp' } });
  const classroom = await prisma.classroom.create({ data: { campusId, code: `CR-${tag}`, name: `冒烟教室${tag}` } });
  const cls = await prisma.class.create({
    data: {
      campusId, courseId: course.id, teacherId: teacher.id, classroomId: classroom.id, name: `冒烟课评班${tag}`, code: `CLS-${tag}`,
      capacity: 10, status: 'in_progress', startDate: new Date(Date.now() - 86400000 * 7), endDate: new Date(Date.now() + 86400000 * 90),
    },
  });
  const st = await prisma.student.create({ data: { campusId, name: `冒烟课评${tag}`, studentNo: `${tag}A`, gender: 'male', phone: '13800000000' } });
  await prisma.studentCoursePackage.create({ data: { studentId: st.id, courseId: course.id, classId: cls.id, totalLessons: 20, remainingLessons: 20, consumedLessons: 0, status: 'active' } });
  const schedule = await prisma.scheduleEvent.create({
    data: { campusId, classId: cls.id, teacherId: teacher.id, classroomId: classroom.id, date: todayInShanghai(), startTime: '08:00', endTime: '09:30', status: 'scheduled' },
  });

  // 登录前先读一下执行校长的未读数，后面按增量判断
  const { token: principalToken } = await apiLogin('principal');
  const before = await api(principalToken, 'GET', '/api/notifications');
  const unreadBefore = before.body?.data?.unreadCount || 0;

  const fulfill = await api(adminToken, 'POST', '/api/educational/fulfillment/fulfill', {
    scheduleEventId: schedule.id,
    mode: 'FULL_SETTLE',
    lessonTitle: `冒烟课评${tag}`,
    studyContentHtml: '本节内容',
    overallRating: 5,
    teacherComment: '全班整体评语',
    anomalyOverrides: [{ studentId: st.id, status: 'present', deductLessons: 1, rating: 5, personalizedComment: '专属评语' }],
  });
  check(fulfill.status === 201, `老师结课并发布课评 (接口返回 ${fulfill.status})`);

  await loginAs(s, 'principal');
  const page = s.page;
  // 铃铛角标：按钮的无障碍名称里带未读数
  const label = await page.$eval('button[title="通知与待办"]', (b) => b.getAttribute('aria-label'));
  check(/\d+/.test(label || ''), `铃铛显示有待处理事项 (${label})`);

  await page.click('button[title="通知与待办"]');
  await page.waitForFunction((n) => [...document.querySelectorAll('.el-popover')].some((p) => p.offsetParent !== null && p.innerText.includes(n)), {}, cls.name);
  const popover = await page.evaluate(() => [...document.querySelectorAll('.el-popover')].find((p) => p.offsetParent !== null).innerText);
  check(popover.includes('发布了课评') && popover.includes(cls.name), '通知列表里有「赵立鹏发布了课评」和这个班级');
  check(new RegExp(`通知\\s*${unreadBefore + 1}\\b`).test(popover), `通知标题旁显示未读数 ${unreadBefore + 1}`);

  // 点开通知：跳到点名消课页，并标为已读
  await clickText(page, cls.name, '.el-popover button, .el-popover .notice-item, .el-popover li, .el-popover div');
  await page.waitForFunction(() => location.pathname === '/educational/attendance');
  check(true, '点开通知后跳到「授课点名消课」页');
  let after = null;
  for (let i = 0; i < 25; i++) {
    after = await api(principalToken, 'GET', '/api/notifications');
    if ((after.body?.data?.unreadCount || 0) === unreadBefore) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check((after.body?.data?.unreadCount || 0) === unreadBefore, `这条通知已标为已读 (未读数回到 ${unreadBefore})`);

  // 财务看不到这类通知 (只发给校区负责人及以上)
  const { token: financeToken } = await apiLogin('finance');
  const fin = await api(financeToken, 'GET', '/api/notifications');
  const finItems = fin.body?.data?.items || [];
  check(!finItems.some((n) => (n.content || '').includes(cls.name)), '财务的通知里没有这条课评通知');
}).finally(() => prisma.$disconnect());
