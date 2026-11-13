/**
 * 冒烟 6：老师课酬。用夹具在一个已经结束的月份 (2020-02) 建好点过名的正式课，
 * 执行校长打开老师课酬页：核对金额 → 导出汇总 CSV → 确认本月课酬并锁定 → 撤销确认。
 *
 * 规则 (默认)：每天有课 120 元 + 每节 20 元 + 每到课人次 3 元 + 当天到课 ≥ 10 人次奖励 20 元。
 *   2020-02-03：2 节课，各 5 人到课 → 120 + 40 + 30 + 20 = 210
 *   2020-02-04：1 节课，3 人到课、1 人请假 → 120 + 20 + 9 = 149
 *   合计 359.00 元
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PrismaClient } = require('../../server/node_modules/@prisma/client');
const { runSmoke, loginAs, apiLogin, check, clickText, pageText, waitOverlaysGone } = require('./helpers.cjs');

const prisma = new PrismaClient();
const MONTH = '2020-02';

runSmoke('老师课酬', async (s) => {
  const { user } = await apiLogin('principal');
  const campusId = user.campusId;
  const tag = `__t_${Date.now().toString(36)}`;
  // 2020-02 专供这个测试用：先清掉之前留下的确认记录，保证从「未确认」开始
  await prisma.teacherPayrollMonth.deleteMany({ where: { campusId, month: MONTH } });
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());
  const teacher = await prisma.user.create({
    data: { account: `pay${tag}`.slice(0, 30), realName: `冒烟课酬老师${tag.slice(-4)}`, password: 'x', campusId, phone: `150${String(Date.now()).slice(-8)}` },
  });
  const classroom = await prisma.classroom.create({ data: { campusId, code: `CR-${tag}`, name: `课酬教室${tag}` } });
  const cls = await prisma.class.create({
    data: { campusId, courseId: course.id, teacherId: teacher.id, classroomId: classroom.id, name: `课酬班${tag}`, code: `CLS-${tag}`, capacity: 10, status: 'in_progress', startDate: new Date('2020-01-01'), endDate: new Date('2020-06-30') },
  });
  const students = [];
  for (let i = 0; i < 5; i++) {
    students.push(await prisma.student.create({ data: { campusId, name: `课酬学员${i}${tag}`, studentNo: `${tag}${i}`, gender: 'male', phone: '13800000000' } }));
  }
  const lesson = async (date, startTime, statuses) => {
    const ev = await prisma.scheduleEvent.create({
      data: { campusId, classId: cls.id, teacherId: teacher.id, classroomId: classroom.id, date, startTime, endTime: '23:59', status: 'completed', classType: 'formal' },
    });
    for (const [i, status] of statuses.entries()) {
      await prisma.attendanceRecord.create({ data: { scheduleEventId: ev.id, studentId: students[i].id, status, deductLessons: status === 'present' ? 1 : 0, operator: '冒烟' } });
    }
  };
  const five = ['present', 'present', 'present', 'present', 'present'];
  await lesson('2020-02-03', '09:00', five);
  await lesson('2020-02-03', '14:00', five);
  await lesson('2020-02-04', '09:00', ['present', 'present', 'present', 'leave']);
  check(true, `夹具：${MONTH} 老师「${teacher.realName}」3 节课，按规则应得 359.00 元`);

  await loginAs(s, 'principal');
  const page = s.page;
  await page.goto(`${s.url}/financial/teacherPay?month=${MONTH}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction((n) => document.body.innerText.includes(n), {}, teacher.realName);
  const rowText = await page.evaluate((n) => [...document.querySelectorAll('.el-table__row')].find((r) => r.innerText.includes(n))?.innerText || '', teacher.realName);
  check(rowText.includes('359.00'), '老师这一行合计 359.00 元');
  check(/240\.00/.test(rowText) && /60\.00/.test(rowText) && /39\.00/.test(rowText) && /20\.00/.test(rowText), '基础工资 240、课时费 60、人次费 39、奖励 20');

  // 导出汇总 CSV：让浏览器下载到临时目录再读文件
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-download-'));
  // 无痕上下文的下载设置要在浏览器层面按上下文指定
  const cdp = await s.browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, browserContextId: page.browserContext().id });
  await clickText(page, '导出', 'button');
  await clickText(page, '导出汇总', '.el-dropdown-menu__item');
  let csvFile = null;
  for (let i = 0; i < 50 && !csvFile; i++) {
    csvFile = fs.readdirSync(downloadDir).find((f) => f.endsWith('.csv'));
    if (!csvFile) await new Promise((r) => setTimeout(r, 200));
  }
  check(Boolean(csvFile) && csvFile.includes(MONTH) && csvFile.includes('未确认'), `下载了汇总 CSV：${csvFile}`);
  const csv = fs.readFileSync(path.join(downloadDir, csvFile), 'utf8');
  const line = csv.split('\r\n').find((l) => l.startsWith(teacher.realName));
  check(csv.charCodeAt(0) === 0xfeff && line && line.endsWith(',359.00'), 'CSV 带 BOM，老师这一行合计 359.00');
  fs.rmSync(downloadDir, { recursive: true, force: true });

  // 确认本月课酬 → 锁定
  // 页面上的课酬合计 (同一月份可能还有其他老师)
  const pageTotal = await page.evaluate(() => {
    const card = [...document.querySelectorAll('div')].find((d) => d.children.length <= 3 && /课酬合计/.test(d.innerText) && /[\d,]+\.\d\d/.test(d.innerText));
    return card ? card.innerText.match(/[\d,]+\.\d\d/)[0] : null;
  });
  await clickText(page, '确认本月课酬', 'button');
  await page.waitForSelector('.el-message-box', { visible: true });
  const confirmText = await page.$eval('.el-message-box', (el) => el.innerText);
  check(pageTotal && confirmText.includes(`¥${pageTotal}`) && confirmText.includes('确认后金额锁定'), `确认弹窗写明合计 ¥${pageTotal}，并说明确认后锁定`);
  await clickText(page, '确认并锁定', '.el-message-box button');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('撤销确认')));
  const month = await prisma.teacherPayrollMonth.findUnique({ where: { campusId_month: { campusId, month: MONTH } } });
  check(month?.status === 'confirmed' && month.totalCents >= 35900, '数据库里本月已确认并保存金额');
  check((await pageText(page)).includes('已确认'), '页面状态显示「已确认」');

  // 撤销确认：必须填原因
  await waitOverlaysGone(page);
  await clickText(page, '撤销确认', 'button');
  // 上一个确认框可能还在关闭动画里，找可见的那个输入框
  const reasonInput = await page.waitForFunction(() => [...document.querySelectorAll('.el-message-box input')].find((i) => i.offsetParent !== null) || null);
  await reasonInput.asElement().type('冒烟测试撤销');
  await clickText(page, '撤销确认', '.el-message-box button');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('确认本月课酬')));
  const reopened = await prisma.teacherPayrollMonth.findUnique({ where: { campusId_month: { campusId, month: MONTH } } });
  check(reopened.status === 'reopened' && reopened.lastReopenReason === '冒烟测试撤销', '撤销确认后状态回到未确认，原因已记录');
}).finally(() => prisma.$disconnect());
