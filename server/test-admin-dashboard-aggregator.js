/**
 * 拓视未来教育「一校教培系统」
 * 管理员首页看板聚合 (AdminDashboardAggregator) 测试套件
 * 1) 离线：趋势分桶算法  2) 在线：自建夹具 → 调用 /api/financial/dashboard/admin 核对真实汇总 → 精确清理夹具
 */

const assert = require('assert');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const {
  buildTrendBuckets,
  bucketKeyOf,
  toBusinessDateParts,
} = require('./dist/modules/financial/domain/admin-dashboard.aggregator');

const prisma = new PrismaClient();
const { PORT } = require('./test-utils/target');
const HOST = '127.0.0.1';

function request(path, { method = 'GET', token, body } = {}) {
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
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
function check(cond, desc) {
  assert.ok(cond, desc);
  passed++;
  console.log(`  ✓ PASS [${passed}]: ${desc}`);
}

function offlineBucketTests() {
  console.log('【1】趋势分桶算法 (离线)');
  const feb = buildTrendBuckets('2026-02-01', '2026-02-28');
  check(feb.granularity === 'day' && feb.buckets.length === 28, '2 月按天分桶共 28 个点 (不再写死 05~30)');
  check(feb.buckets[27].label === '02-28', '2 月最后一个桶为 02-28');

  const nov = buildTrendBuckets('2026-11-01', '2026-11-30');
  check(nov.buckets.length === 30 && nov.buckets[0].label === '11-01', '11 月按天分桶共 30 个点');

  const year = buildTrendBuckets('2026-01-01', '2026-12-31');
  check(year.granularity === 'month' && year.buckets.length === 12, '本年按月分桶共 12 个点');
  check(year.buckets[9].label === '10月', '本年第 10 个桶为 10月');

  const day = buildTrendBuckets('2026-11-03', '2026-11-03');
  check(day.granularity === 'hour' && day.buckets[0].label === '08:00' && day.buckets.length === 14, '单日按小时分桶 08:00~21:00');
  check(bucketKeyOf('hour', '2026-11-03', 23) === '21' && bucketKeyOf('hour', '2026-11-03', 6) === '08', '营业时间外记录并入首/末小时桶');

  // 2026-11-02T17:30Z = 北京时间 11-03 01:30，必须归入 11-03
  const parts = toBusinessDateParts(new Date('2026-11-02T17:30:00Z'));
  check(parts.date === '2026-11-03' && parts.hour === 1, '订单时间按北京时间归日，跨零点不错位');
}

async function onlineTests() {
  console.log('\n【2】看板接口真实汇总 (在线，自建夹具)');
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { account: 'donghaichao', password: '123456' },
  });
  check(login.status === 200 || login.status === 201, '超管登录成功');
  const token = login.body.data.accessToken;

  const admin = await prisma.user.findUniqueOrThrow({ where: { account: 'donghaichao' } });
  const campusId = admin.campusId;
  const regularCourse = await prisma.course.findFirstOrThrow({ where: { attribute: 'regular' } });
  const extendedCourse = await prisma.course.findFirstOrThrow({ where: { attribute: 'extended' } });

  const tag = `DASH${Date.now()}`;
  const { date: today } = toBusinessDateParts(new Date());
  const created = { orders: [], attendances: [], schedules: [], packages: [], students: [], classes: [], classrooms: [] };

  const q = (start, end) =>
    `/api/financial/dashboard/admin?campusId=${campusId}&consumptionStart=${start}&consumptionEnd=${end}&enrollmentStart=${start}&enrollmentEnd=${end}`;
  const monthStart = `${today.slice(0, 8)}01`;
  const pointValue = (trend, label) => (trend.find((p) => p.label === label) || { value: 0 }).value;
  const trendSum = (trend) => trend.reduce((s, p) => s + p.value, 0);

  // 同一个库里其他测试今天也会建订单和点名，所以先记下基线，下面只核对本测试夹具带来的增量
  const baseRes = await request(q(today, today), { token });
  const baseMonthRes = await request(q(monthStart, today), { token });
  check(baseRes.status === 200 && baseMonthRes.status === 200, '夹具创建前读取看板基线');
  const base = baseRes.body.data;
  const baseMonth = baseMonthRes.body.data;

  try {
    const classroom = await prisma.classroom.create({ data: { campusId, code: `CR-${tag}`, name: `看板测试教室${tag}` } });
    created.classrooms.push(classroom.id);
    const klass = await prisma.class.create({
      data: {
        campusId,
        courseId: regularCourse.id,
        code: `CLS-${tag}`,
        name: `看板测试班${tag}`,
        teacherId: admin.id,
        classroomId: classroom.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000 * 90),
      },
    });
    created.classes.push(klass.id);

    const mkStudent = async (suffix) => {
      const s = await prisma.student.create({
        data: { campusId, studentNo: `${tag}${suffix}`, name: `看板测试${suffix}`, gender: 'male', phone: '15600000000' },
      });
      created.students.push(s.id);
      return s;
    };
    const renewing = await mkStudent('A'); // 去年已缴费，本期续费 → 续费
    const fresh = await mkStudent('B'); // 首次缴费 → 新签

    const mkPackage = async (studentId, courseId, price) => {
      const p = await prisma.studentCoursePackage.create({
        data: { studentId, courseId, classId: klass.id, totalLessons: 20, remainingLessons: 20, pricePerLesson: price },
      });
      created.packages.push(p.id);
      return p;
    };
    const pkgA = await mkPackage(renewing.id, regularCourse.id, 150);
    const pkgB = await mkPackage(fresh.id, extendedCourse.id, 200);

    const schedule = await prisma.scheduleEvent.create({
      data: { campusId, classId: klass.id, teacherId: admin.id, classroomId: classroom.id, date: today, startTime: '10:00', endTime: '11:30', status: 'completed' },
    });
    created.schedules.push(schedule.id);

    const mkAttendance = async (data) => {
      const a = await prisma.attendanceRecord.create({ data: { scheduleEventId: schedule.id, operator: '看板测试', ...data } });
      created.attendances.push(a.id);
    };
    await mkAttendance({ studentId: renewing.id, packageId: pkgA.id, status: 'present', deductLessons: 2 }); // 2 × 150 = 300 常规
    await mkAttendance({ studentId: fresh.id, packageId: pkgB.id, status: 'present', deductLessons: 1 }); // 1 × 200 = 200 扩科
    await mkAttendance({ studentId: fresh.id, packageId: pkgB.id, status: 'leave', deductLessons: 0 }); // 请假不扣课，不计课耗
    await mkAttendance({ studentId: renewing.id, packageId: pkgA.id, status: 'present', deductLessons: 3, isReversed: true }); // 已冲正，不计

    const mkOrder = async (studentId, data) => {
      const o = await prisma.order.create({
        data: {
          campusId,
          studentId,
          orderNo: `ORD-${tag}-${created.orders.length}`,
          orderType: 'regular',
          status: 'paid',
          originalPrice: 1000,
          receivableAmount: 1000,
          actualAmount: 1000,
          paymentMethod: 'wechat',
          creatorId: admin.id,
          ownerId: admin.id,
          channel: 'ground',
          ...data,
        },
      });
      created.orders.push(o.id);
    };
    await mkOrder(renewing.id, { createdAt: new Date(Date.now() - 86400000 * 400), packageId: pkgA.id }); // 历史订单
    await mkOrder(renewing.id, { packageId: pkgA.id });
    await mkOrder(fresh.id, { packageId: pkgB.id });
    await mkOrder(fresh.id, { packageId: pkgB.id, status: 'unpaid' }); // 未缴费不计
    await mkOrder(fresh.id, { orderType: 'refund', actualAmount: -100 }); // 退费不计

    const res = await request(q(today, today), { token });
    check(res.status === 200, `今日看板接口返回 200 (实际 ${res.status})`);
    const { consumption, enrollment } = res.body.data;
    const c0 = base.consumption;
    const e0 = base.enrollment;
    const dAmount = consumption.amount - c0.amount;
    check(dAmount === 500, `课耗金额 = 实扣课时 × 课包单价 = 500 (增量 ${dAmount})`);
    check(
      consumption.regularAmount - c0.regularAmount === 300 &&
        consumption.expandAmount - c0.expandAmount === 200 &&
        consumption.otherAmount - c0.otherAmount === 0,
      '课耗按课程属性拆分 常规 300 / 扩科 200 / 其他 0',
    );
    check(consumption.lessonCount - c0.lessonCount === 3, '课耗数量只计未冲正且实扣的课时 (3)');
    check(pointValue(consumption.trend, '10:00') - pointValue(c0.trend, '10:00') === 500, '课耗趋势落在 10:00 上课时段');
    check(trendSum(consumption.trend) === consumption.amount, '课耗趋势各点之和等于课耗总额');

    const dStudents = enrollment.studentCount - e0.studentCount;
    check(dStudents === 2, `招生人数为去重学员数 2 (增量 ${dStudents})`);
    check(enrollment.newCount - e0.newCount === 1 && enrollment.renewalCount - e0.renewalCount === 1, '新签 1 / 续费 1');
    check(enrollment.regularCount - e0.regularCount === 1 && enrollment.expandCount - e0.expandCount === 1, '常规课 1 / 扩科 1');
    check(trendSum(enrollment.trend) === enrollment.studentCount, '招生趋势各点之和等于招生人数');

    const monthRes = await request(q(monthStart, today), { token });
    const dayLabel = today.slice(5);
    const dDay = monthRes.status === 200
      ? pointValue(monthRes.body.data.consumption.trend, dayLabel) - pointValue(baseMonth.consumption.trend, dayLabel)
      : NaN;
    check(dDay === 500, '本月按天分桶，课耗落在今天');

    const bad = await request(q('2026-11', today), { token });
    check(bad.status === 400, '日期格式非法返回 400');
  } finally {
    await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: created.attendances } } });
    await prisma.scheduleEvent.deleteMany({ where: { id: { in: created.schedules } } });
    await prisma.studentCoursePackage.deleteMany({ where: { id: { in: created.packages } } });
    await prisma.student.deleteMany({ where: { id: { in: created.students } } });
    await prisma.class.deleteMany({ where: { id: { in: created.classes } } });
    await prisma.classroom.deleteMany({ where: { id: { in: created.classrooms } } });
    console.log('  · 测试夹具已按 ID 清理');
  }
}

(async () => {
  console.log('================================================================');
  console.log('管理员首页看板聚合 (课耗 / 招生) 专项验证套件');
  console.log('================================================================\n');
  offlineBucketTests();
  await onlineTests();
  console.log(`\n🎉 全部 ${passed} 项断言通过`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error('❌ 测试失败:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
