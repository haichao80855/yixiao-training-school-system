/**
 * 冒烟 7：资金与课时按钮连点只生效一次 (流畅度改进第 1 期)。
 * - 学员档案 → 电子钱包 → 充值：确认按钮连点两次，只弹一次确认框、只记一笔账。
 * - 授课工作台 → 签到：弹窗立刻打开再加载名单；缺勤显示扣 0 课时 (以前显示 -1.0)；
 *   确认按钮连点两次只消课一次。
 */
const { PrismaClient } = require('../../server/node_modules/@prisma/client');
const { runSmoke, loginAs, apiLogin, check, clickText, todayInShanghai, waitOverlaysGone } = require('./helpers.cjs');

const prisma = new PrismaClient();

runSmoke('资金与课时按钮防连点', async (s) => {
  const { user } = await apiLogin('principal');
  const campusId = user.campusId;
  const tag = `__t_${Date.now().toString(36)}`;
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());
  const teacher = await prisma.user.findFirst({ where: { account: 'zhaolp' } });
  const classroom = await prisma.classroom.create({ data: { campusId, code: `CR-${tag}`, name: `冒烟教室${tag}` } });
  const cls = await prisma.class.create({
    data: {
      campusId, courseId: course.id, teacherId: teacher.id, classroomId: classroom.id, name: `冒烟防连点班${tag}`, code: `CLS-${tag}`,
      capacity: 10, status: 'in_progress', startDate: new Date(Date.now() - 86400000 * 7), endDate: new Date(Date.now() + 86400000 * 90),
    },
  });
  const mk = async (suffix) => {
    const st = await prisma.student.create({ data: { campusId, name: `冒烟${suffix}${tag}`, studentNo: `${tag}${suffix}`, gender: 'male', phone: '13800000000' } });
    const pkg = await prisma.studentCoursePackage.create({ data: { studentId: st.id, courseId: course.id, classId: cls.id, totalLessons: 20, remainingLessons: 20, consumedLessons: 0, status: 'active' } });
    return { st, pkg };
  };
  const a = await mk('到课');
  const b = await mk('缺勤');
  const schedule = await prisma.scheduleEvent.create({
    data: { campusId, classId: cls.id, teacherId: teacher.id, classroomId: classroom.id, date: todayInShanghai(), startTime: '20:00', endTime: '21:00', status: 'scheduled' },
  });

  try {
    await loginAs(s, 'principal');
    const page = s.page;

    // ---------------- 充值连点 ----------------
    await page.goto(`${s.url}/studentCenter/allStudent`, { waitUntil: 'networkidle0' });
    await page.waitForFunction((n) => document.body.innerText.includes(n), {}, a.st.name);
    await page.evaluate((n) => {
      const row = [...document.querySelectorAll('.el-table__row')].find((r) => r.innerText.includes(n));
      row.querySelector('.cursor-pointer').click();
    }, a.st.name);
    await page.waitForFunction(() => [...document.querySelectorAll('.el-drawer .el-tabs__item')].some((t) => t.innerText.includes('电子钱包')));
    await clickText(page, '电子钱包', '.el-drawer .el-tabs__item');
    await clickText(page, '充值本金', '.el-drawer button');
    await page.waitForFunction(() => [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent !== null && d.innerText.includes('电子钱包充值')));
    const amountInput = await page.evaluateHandle(() => [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && d.innerText.includes('电子钱包充值')).querySelector('input'));
    const prefilled = await amountInput.evaluate((el) => el.value);
    check(prefilled === '', `打开充值弹窗时金额是空的，不再预填 ¥2000 (实际「${prefilled}」)`);
    await amountInput.asElement().click();
    await amountInput.asElement().type('500');
    await page.keyboard.press('Tab');

    // 连点两次「确认充值」
    await page.evaluate(() => {
      const dialog = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && d.innerText.includes('电子钱包充值'));
      const btn = [...dialog.querySelectorAll('button')].find((x) => x.innerText.includes('确认充值'));
      btn.click();
      btn.click();
    });
    await page.waitForSelector('.el-message-box', { visible: true });
    const boxText = await page.$eval('.el-message-box', (el) => el.innerText);
    check(boxText.includes('¥500.00'), '确认框里复述了充值金额 ¥500.00');
    check((await page.$$('.el-message-box')).length === 1, '连点两次只弹出一个确认框');
    await clickText(page, '确认充值', '.el-message-box button');
    for (let i = 0; i < 50; i++) {
      if ((await prisma.walletLedger.count({ where: { studentId: a.st.id } })) > 0) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 500));
    const ledgers = await prisma.walletLedger.findMany({ where: { studentId: a.st.id } });
    check(ledgers.length === 1 && ledgers[0].principalChange === 500, `只记了一笔 ¥500 的充值 (实际 ${ledgers.length} 笔)`);
    await page.keyboard.press('Escape');
    await waitOverlaysGone(page);

    // ---------------- 工作台签到 ----------------
    await page.goto(`${s.url}/educational/workbench`, { waitUntil: 'networkidle0' });
    await page.waitForFunction((n) => document.body.innerText.includes(n), {}, cls.name);
    await page.evaluate((n) => {
      const card = [...document.querySelectorAll('div')].filter((d) => d.innerText.includes(n) && [...d.querySelectorAll('button, span, div')].some((x) => /^签到\(/.test(x.innerText || ''))).pop();
      const btn = [...card.querySelectorAll('button, span, div')].find((x) => /^签到\(/.test(x.innerText || ''));
      btn.click();
    }, cls.name);
    await page.waitForFunction((n) => [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent !== null && d.innerText.includes(n)), {}, b.st.name);
    check(true, '点「签到」后弹窗打开并加载出这节课的 2 名学员');

    // 把第二个学员设为缺勤，扣课列应显示 0
    await page.evaluate((n) => {
      const row = [...document.querySelectorAll('.el-dialog .el-table__row')].find((r) => r.innerText.includes(n));
      [...row.querySelectorAll('.el-radio-button')].find((x) => x.innerText.includes('缺勤')).click();
    }, b.st.name);
    await new Promise((r) => setTimeout(r, 200));
    const deductCells = await page.evaluate((names) => names.map((n) => {
      const row = [...document.querySelectorAll('.el-dialog .el-table__row')].find((r) => r.innerText.includes(n));
      const cells = row.querySelectorAll('td');
      return cells[cells.length - 1].innerText.trim();
    }), [a.st.name, b.st.name]);
    check(deductCells[0] === '-1.0' && deductCells[1] === '0', `扣课列：到课 -1.0、缺勤 0 (实际 ${deductCells.join(' / ')})`);

    await page.evaluate(() => {
      const dialog = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && d.innerText.includes('确认打卡消课'));
      const btn = [...dialog.querySelectorAll('button')].find((x) => x.innerText.includes('确认打卡消课'));
      btn.click();
      btn.click();
    });
    await page.waitForSelector('.el-message-box', { visible: true });
    const signText = await page.$eval('.el-message-box', (el) => el.innerText);
    check(signText.includes('实到 1 人') && signText.includes('共扣 1 课时'), '确认框复述：实到 1 人，共扣 1 课时');
    await clickText(page, '确认消课', '.el-message-box button');
    for (let i = 0; i < 50; i++) {
      if ((await prisma.scheduleEvent.findUnique({ where: { id: schedule.id } })).status === 'completed') break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 500));
    const [pa, pb] = await Promise.all([a.pkg, b.pkg].map((p) => prisma.studentCoursePackage.findUnique({ where: { id: p.id } })));
    check(pa.remainingLessons === 19 && pb.remainingLessons === 20, `到课扣 1 课时 (剩 ${pa.remainingLessons})，缺勤不扣 (剩 ${pb.remainingLessons})`);
    check((await prisma.attendanceRecord.count({ where: { scheduleEventId: schedule.id } })) === 2, '只生成 2 条上课记录 (没有重复消课)');
  } finally {
    await prisma.scheduleEvent.deleteMany({ where: { id: schedule.id } });
    await prisma.student.deleteMany({ where: { id: { in: [a.st.id, b.st.id] } } });
    await prisma.class.deleteMany({ where: { id: cls.id } });
    await prisma.classroom.deleteMany({ where: { id: classroom.id } });
    await prisma.idempotencyRecord.deleteMany({ where: { scope: 'wallet-recharge', createdAt: { gte: new Date(Date.now() - 3600e3) } } });
    await prisma.$disconnect();
  }
});
