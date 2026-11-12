/**
 * 老师课酬 (TeacherPayEngine / TeacherPayCoordinator / /api/financial/teacher-pay) 测试
 * 1) 离线：按天计算的规则 (基础工资、课时费、人次费、达标奖励) 与边界
 * 2) 在线：在 2020-01 (没有真实数据的月份) 自建班级、课次和点名夹具 → 核对金额 → 权限 → 确认锁定 / 撤销 → 精确清理
 */

const assert = require('assert');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const {
  computeTeacherPay,
  normalizeRules,
  monthRange,
  DEFAULT_TEACHER_PAY_RULES,
} = require('./dist/modules/financial/domain/teacher-pay.engine');

const prisma = new PrismaClient();
const { PORT } = require('./test-utils/target');
const HOST = '127.0.0.1';
const MONTH = '2020-01';

function request(path, { method = 'GET', token, body, campusId } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(campusId ? { 'x-campus-id': campusId } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(account) {
  const res = await request('/api/auth/login', { method: 'POST', body: { account, password: '123456' } });
  const data = res.body && res.body.data;
  return { token: data && (data.accessToken || data.token), user: data && data.user };
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const lesson = (o) => ({
  scheduleEventId: o.id,
  teacherId: o.teacherId || 't1',
  teacherName: o.teacherName || '甲老师',
  date: o.date,
  startTime: o.startTime || '09:00',
  endTime: '10:00',
  className: '测试班',
  lessonTitle: '测试课',
  attendedCount: o.attended,
});

async function offline() {
  console.log('离线：计算规则');
  const R = DEFAULT_TEACHER_PAY_RULES;

  await test('1 节课 5 人到课 = 120 + 20 + 15 = 155 元', () => {
    const { lines } = computeTeacherPay([lesson({ id: 'a', date: '2026-10-08', attended: 5 })], R);
    assert.strictEqual(lines[0].totalCents, 15500);
  });

  await test('同一天 2 节课各 5 人 = 120 + 40 + 30 + 20 奖励 = 210 元', () => {
    const { lines } = computeTeacherPay(
      [lesson({ id: 'a', date: '2026-10-08', attended: 5 }), lesson({ id: 'b', date: '2026-10-08', startTime: '14:00', attended: 5 })],
      R,
    );
    assert.strictEqual(lines[0].totalCents, 21000);
    assert.strictEqual(lines[0].bonusDays, 1);
    assert.strictEqual(lines[0].days[0].lessons.length, 2);
  });

  await test('当天 9 人次不发奖励', () => {
    const { lines } = computeTeacherPay(
      [lesson({ id: 'a', date: '2026-10-08', attended: 5 }), lesson({ id: 'b', date: '2026-10-08', attended: 4 })],
      R,
    );
    assert.strictEqual(lines[0].bonusCents, 0);
    assert.strictEqual(lines[0].totalCents, 12000 + 4000 + 2700);
  });

  await test('奖励按天判断：两天各 5 人次都不达标', () => {
    const { lines } = computeTeacherPay(
      [lesson({ id: 'a', date: '2026-10-08', attended: 5 }), lesson({ id: 'b', date: '2026-10-09', attended: 5 })],
      R,
    );
    assert.strictEqual(lines[0].bonusDays, 0);
    assert.strictEqual(lines[0].teachingDays, 2);
    assert.strictEqual(lines[0].baseCents, 24000);
  });

  await test('0 人到课的课仍计基础工资和课时费', () => {
    const { lines } = computeTeacherPay([lesson({ id: 'a', date: '2026-10-08', attended: 0 })], R);
    assert.strictEqual(lines[0].totalCents, 14000);
  });

  await test('多位老师分开算，合计正确', () => {
    const { lines, summary } = computeTeacherPay(
      [
        lesson({ id: 'a', date: '2026-10-08', attended: 5 }),
        lesson({ id: 'b', teacherId: 't2', teacherName: '乙老师', date: '2026-10-08', attended: 1 }),
      ],
      R,
    );
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(summary.totalCents, 15500 + 14300);
    assert.strictEqual(lines[0].teacherName, '甲老师');
  });

  await test('改规则后按新数值算 (含小数金额)', () => {
    const rules = normalizeRules({ dailyBase: 100, perLesson: 25.5, perStudent: '2.5', bonusThreshold: 3, bonusAmount: 10 });
    const { lines } = computeTeacherPay([lesson({ id: 'a', date: '2026-10-08', attended: 4 })], rules);
    assert.strictEqual(lines[0].totalCents, 10000 + 2550 + 1000 + 1000);
  });

  await test('规则校验：负数、非数字、奖励门槛非整数、三位小数都拒绝', () => {
    assert.throws(() => normalizeRules({ ...R, dailyBase: -1 }));
    assert.throws(() => normalizeRules({ ...R, perLesson: 'abc' }));
    assert.throws(() => normalizeRules({ ...R, bonusThreshold: 9.5 }));
    assert.throws(() => normalizeRules({ ...R, perStudent: 0.001 }));
    assert.doesNotThrow(() => normalizeRules({ ...R, perStudent: 0.1 }));
  });

  await test('月份范围：2 月按平闰年取末日，格式错误报错', () => {
    assert.deepStrictEqual(monthRange('2024-02'), { start: '2024-02-01', end: '2024-02-29' });
    assert.deepStrictEqual(monthRange('2026-02'), { start: '2026-02-01', end: '2026-02-28' });
    assert.throws(() => monthRange('2026-13'));
  });
}

async function online() {
  console.log(`在线：接口与夹具 (端口 ${PORT})`);
  const principal = await login('zhangjh');
  const teacher = await login('zhaolp');
  const finance = await login('wangcw');
  const advisor = await login('lixw');
  assert.ok(principal.token && teacher.token && finance.token && advisor.token, '种子账号登录失败');
  const campusId = principal.user.campusId;

  const teacherUser = await prisma.user.findFirst({ where: { account: 'zhaolp' } });
  const classroom = await prisma.classroom.findFirst({ where: { campusId } });
  const course = await prisma.course.findFirst();
  const students = await prisma.student.findMany({ where: { campusId }, take: 3 });
  assert.ok(teacherUser && classroom && course && students.length, '测试库缺少老师、教室、课程或学员');

  const existing = await prisma.scheduleEvent.count({ where: { campusId, date: { startsWith: MONTH } } });
  assert.strictEqual(existing, 0, `${MONTH} 已有真实课次，换一个空月份再测`);

  const suffix = Date.now().toString(36);
  const cls = await prisma.class.create({
    data: {
      campusId,
      courseId: course.id,
      code: `PAY-TEST-${suffix}`,
      name: `课酬测试班-${suffix}`,
      teacherId: teacherUser.id,
      classroomId: classroom.id,
      startDate: new Date('2020-01-01T00:00:00+08:00'),
      status: 'in_progress',
    },
  });

  const mkEvent = (date, startTime, extra = {}) =>
    prisma.scheduleEvent.create({
      data: {
        campusId,
        classId: cls.id,
        teacherId: teacherUser.id,
        classroomId: classroom.id,
        date,
        startTime,
        endTime: '23:59',
        status: 'completed',
        ...extra,
      },
    });
  const mkAttendance = async (eventId, statuses, reversed = false) => {
    for (let i = 0; i < statuses.length; i++) {
      await prisma.attendanceRecord.create({
        data: {
          scheduleEventId: eventId,
          studentId: students[i % students.length].id,
          status: statuses[i],
          operator: 'test-teacher-pay',
          isReversed: reversed,
        },
      });
    }
  };
  const repeat = (s, n) => Array(n).fill(s);

  try {
    // 1 月 6 日：两节正式课，到课 5 + 5 (4 出勤 + 1 迟到；请假、缺勤不算) = 10 人次 → 达标
    const e1 = await mkEvent('2020-01-06', '09:00');
    await mkAttendance(e1.id, repeat('present', 5));
    const e2 = await mkEvent('2020-01-06', '14:00');
    await mkAttendance(e2.id, [...repeat('present', 4), 'late', 'leave', 'absent']);
    // 1 月 7 日：一节正式课 3 人
    const e3 = await mkEvent('2020-01-07', '09:00');
    await mkAttendance(e3.id, repeat('present', 3));
    // 不计酬：试听课、补课、取消的课、未点名的课、点名全部被冲正的课
    const trial = await mkEvent('2020-01-08', '09:00', { classType: 'trial' });
    await mkAttendance(trial.id, repeat('present', 5));
    const makeUp = await mkEvent('2020-01-08', '10:00', { classType: 'make_up' });
    await mkAttendance(makeUp.id, repeat('present', 5));
    const cancelled = await mkEvent('2020-01-09', '09:00', { status: 'cancelled' });
    await mkAttendance(cancelled.id, repeat('present', 5));
    await mkEvent('2020-01-10', '09:00', { status: 'scheduled' });
    const reversed = await mkEvent('2020-01-11', '09:00', { status: 'scheduled' });
    await mkAttendance(reversed.id, repeat('present', 5), true);

    // 1 月 6 日：120 + 40 + 30 + 20 = 210；1 月 7 日：120 + 20 + 9 = 149；合计 359 元
    const EXPECTED = 35900;
    const path = `/api/financial/teacher-pay?month=${MONTH}`;

    await test('校长看到的金额与规则一致 (试听、补课、取消、未点名、冲正的课都不计)', async () => {
      const res = await request(path, { token: principal.token, campusId });
      assert.strictEqual(res.status, 200, JSON.stringify(res.body));
      const d = res.body.data;
      assert.strictEqual(d.status, 'draft');
      assert.strictEqual(d.monthEnded, true);
      const line = d.lines.find((l) => l.teacherId === teacherUser.id);
      assert.ok(line, '没有这位老师的课酬行');
      assert.strictEqual(line.totalCents, EXPECTED);
      assert.strictEqual(line.teachingDays, 2);
      assert.strictEqual(line.lessonCount, 3);
      assert.strictEqual(line.attendedCount, 13);
      assert.strictEqual(line.bonusDays, 1);
      assert.strictEqual(line.days[0].date, '2020-01-06');
      assert.strictEqual(line.days[0].totalCents, 21000);
    });

    await test('任课老师、财务、教务都不能查看 (403)', async () => {
      for (const who of [teacher, finance, advisor]) {
        const res = await request(path, { token: who.token, campusId });
        assert.strictEqual(res.status, 403, `${who.user && who.user.account} 得到 ${res.status}`);
      }
      const rules = await request('/api/financial/teacher-pay/rules', { token: finance.token });
      assert.strictEqual(rules.status, 403);
    });

    await test('集团管理员没选具体校区时提示先切换校区 (400)，选了校区可以查看', async () => {
      const admin = await login('donghaichao');
      if (!admin.token) return; // 种子里没有这个账号时跳过
      const none = await request(path, { token: admin.token });
      assert.strictEqual(none.status, 400);
      const withCampus = await request(path, { token: admin.token, campusId });
      assert.strictEqual(withCampus.status, 200);
    });

    await test('月份格式错误返回 400；本月未结束不能确认', async () => {
      const bad = await request('/api/financial/teacher-pay?month=2020-1', { token: principal.token, campusId });
      assert.strictEqual(bad.status, 400);
      const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7);
      const early = await request('/api/financial/teacher-pay/confirm', {
        method: 'POST',
        token: principal.token,
        campusId,
        body: { month: now },
      });
      assert.strictEqual(early.status, 400);
    });

    await test('确认后锁定：再点名也不改已确认金额，并提示现在重算的金额', async () => {
      const c = await request('/api/financial/teacher-pay/confirm', { method: 'POST', token: principal.token, campusId, body: { month: MONTH } });
      assert.ok(c.status === 200 || c.status === 201, JSON.stringify(c.body));
      assert.strictEqual(c.body.data.status, 'confirmed');

      const again = await request('/api/financial/teacher-pay/confirm', { method: 'POST', token: principal.token, campusId, body: { month: MONTH } });
      assert.strictEqual(again.status, 409);

      await mkAttendance(e3.id, ['present']); // 确认后补点 1 人
      const after = (await request(path, { token: principal.token, campusId })).body.data;
      const line = after.lines.find((l) => l.teacherId === teacherUser.id);
      assert.strictEqual(line.totalCents, EXPECTED);
      assert.strictEqual(after.liveTotalCents - after.summary.totalCents, 300);
      assert.ok(after.confirmedBy);
    });

    await test('确认后改规则不影响已确认月份', async () => {
      const original = (await request('/api/financial/teacher-pay/rules', { token: principal.token, campusId })).body.data;
      const rulesKey = `teacherPay.rules:${campusId}`;
      const hadRules = await prisma.systemSetting.findUnique({ where: { key: rulesKey } });
      try {
        const saved = await request('/api/financial/teacher-pay/rules', {
          method: 'PUT',
          token: principal.token,
          campusId,
          body: { ...original, perStudent: 5 },
        });
        assert.strictEqual(saved.status, 200);
        const d = (await request(path, { token: principal.token, campusId })).body.data;
        assert.strictEqual(d.rules.perStudent, 3);
        assert.strictEqual(d.summary.totalCents, EXPECTED);

        const invalid = await request('/api/financial/teacher-pay/rules', {
          method: 'PUT',
          token: principal.token,
          campusId,
          body: { ...original, dailyBase: -5 },
        });
        assert.strictEqual(invalid.status, 400);
      } finally {
        if (hadRules) {
          await request('/api/financial/teacher-pay/rules', { method: 'PUT', token: principal.token, campusId, body: original });
        } else {
          await prisma.systemSetting.deleteMany({ where: { key: rulesKey } });
        }
      }
    });

    await test('撤销确认必须写原因；撤销后按实时数据重算', async () => {
      const noReason = await request('/api/financial/teacher-pay/reopen', { method: 'POST', token: principal.token, campusId, body: { month: MONTH } });
      assert.strictEqual(noReason.status, 400);
      const r = await request('/api/financial/teacher-pay/reopen', {
        method: 'POST',
        token: principal.token,
        campusId,
        body: { month: MONTH, reason: '补录 1 月 7 日点名' },
      });
      assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
      const d = r.body.data;
      assert.strictEqual(d.status, 'draft');
      assert.strictEqual(d.lastReopenReason, '补录 1 月 7 日点名');
      assert.strictEqual(d.lines.find((l) => l.teacherId === teacherUser.id).totalCents, EXPECTED + 300);
    });
  } finally {
    await prisma.teacherPayrollMonth.deleteMany({ where: { campusId, month: MONTH } });
    // 删除班级会级联删除课次和点名记录
    await prisma.class.delete({ where: { id: cls.id } });
  }

  const leftover = await prisma.scheduleEvent.count({ where: { campusId, date: { startsWith: MONTH } } });
  assert.strictEqual(leftover, 0, '夹具没有清理干净');
}

(async () => {
  try {
    await offline();
    await online();
    console.log(`\n全部通过：${passed} 项`);
  } catch (err) {
    console.error('\n测试失败：', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
