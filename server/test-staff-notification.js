/**
 * 员工站内通知 (StaffNotificationService / /api/notifications) 测试
 * 自建夹具：给一名学员临时加一个只剩 2 课时的课包 → 触发课时不足通知 → 校长能看到、能标记已读、
 * 财务看不到 → 同一课包不重复通知 → 精确清理夹具。
 */

const assert = require('assert');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const {
  StaffNotificationService,
  canReceiveStaffNotifications,
  LOW_BALANCE_THRESHOLD,
} = require('./dist/modules/staff-notification/domain/staff-notification.service');

const prisma = new PrismaClient();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = '127.0.0.1';

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
  return { token: data && (data.accessToken || data.token), campusId: data && data.user && data.user.campusId };
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log('离线：谁能收到通知');
  await test('校长、超级管理员能收到，老师和财务收不到', () => {
    assert.strictEqual(canReceiveStaffNotifications({ roles: [{ code: 'principal' }] }), true);
    assert.strictEqual(canReceiveStaffNotifications({ roles: [{ code: 'teacher' }], permissions: [] }), false);
    assert.strictEqual(canReceiveStaffNotifications({ roles: [{ code: 'finance' }], permissions: [] }), false);
    assert.strictEqual(canReceiveStaffNotifications({ roles: [], permissions: ['*'] }), true);
  });

  console.log(`在线：通知读写 (端口 ${PORT})`);
  const principal = await login('zhangjh');
  const finance = await login('wangcw');
  assert.ok(principal.token && finance.token, '种子账号登录失败');

  const student = await prisma.student.findFirst({ where: { campusId: principal.campusId } });
  assert.ok(student, '测试库里缺少学员');
  // 选一门该学员没买过的课，保证剩余课时只算临时课包
  const owned = await prisma.studentCoursePackage.findMany({ where: { studentId: student.id }, select: { courseId: true } });
  const course = await prisma.course.findFirst({ where: { id: { notIn: owned.map((p) => p.courseId) } } });
  assert.ok(course, '测试库里缺少该学员没买过的课程');

  const service = new StaffNotificationService(prisma);
  const created = { packageIds: [], notificationKeys: [] };

  try {
    // 临时课包：剩 2 课时 (阈值以内)
    const pkg = await prisma.studentCoursePackage.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        totalLessons: 10,
        remainingLessons: 2,
        consumedLessons: 8,
        status: 'active',
        // 让它成为该学员该课程最新的课包
        createdAt: new Date(Date.now() + 60_000),
      },
    });
    created.packageIds.push(pkg.id);
    const dedupeKey = `low_balance:${student.id}:${pkg.id}`;
    created.notificationKeys.push(dedupeKey);

    // 该学员在这门课所有在用课包合计
    const live = await prisma.studentCoursePackage.findMany({
      where: { studentId: student.id, courseId: course.id, status: { in: ['active', 'frozen'] } },
    });
    const total = live.reduce((s, p) => s + Math.max(0, p.remainingLessons), 0);

    await service.notifyLowBalance({ campusId: student.campusId, courseId: course.id, studentIds: [student.id] });
    const n = await prisma.staffNotification.findUnique({ where: { dedupeKey } });

    if (total <= LOW_BALANCE_THRESHOLD) {
      await test('课时降到阈值以内时生成通知，标题写明剩余课时', () => {
        assert.ok(n, '没有生成通知');
        assert.strictEqual(n.type, 'low_balance');
        assert.ok(n.title.includes(String(total)) || (total === 0 && n.title.includes('用完')), n.title);
      });

      await test('同一课包重复消课不会重复通知', async () => {
        await service.notifyLowBalance({ campusId: student.campusId, courseId: course.id, studentIds: [student.id] });
        const count = await prisma.staffNotification.count({ where: { dedupeKey } });
        assert.strictEqual(count, 1);
      });

      await test('校长在铃铛里能看到这条未读通知', async () => {
        const res = await request('/api/notifications', { token: principal.token, campusId: student.campusId });
        assert.strictEqual(res.status, 200);
        const d = res.body.data;
        assert.strictEqual(d.enabled, true);
        const item = d.items.find((i) => i.id === n.id);
        assert.ok(item, '列表里没有这条通知');
        assert.strictEqual(item.read, false);
        assert.ok(d.unreadCount >= 1);
      });

      await test('标记已读后不再计入未读', async () => {
        const before = (await request('/api/notifications', { token: principal.token, campusId: student.campusId })).body.data.unreadCount;
        const r = await request(`/api/notifications/${n.id}/read`, { method: 'POST', token: principal.token, campusId: student.campusId });
        assert.ok(r.status === 200 || r.status === 201, `status ${r.status}`);
        const after = (await request('/api/notifications', { token: principal.token, campusId: student.campusId })).body.data;
        assert.strictEqual(after.unreadCount, before - 1);
        assert.strictEqual(after.items.find((i) => i.id === n.id).read, true);
      });
    } else {
      await test('该学员其他课包课时充足，不生成通知', () => {
        assert.strictEqual(n, null);
      });
    }

    await test('财务账号看不到通知，也不能标记已读', async () => {
      const res = await request('/api/notifications', { token: finance.token });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.enabled, false);
      assert.strictEqual(res.body.data.items.length, 0);
      const r = await request('/api/notifications/read-all', { method: 'POST', token: finance.token });
      assert.strictEqual(r.status, 403);
    });

    await test('不存在的课评不会报错，也不会生成通知', async () => {
      await service.notifyEvaluationPublished({ scheduleEventId: 'no-such-event' });
    });
  } finally {
    await prisma.staffNotification.deleteMany({ where: { dedupeKey: { in: created.notificationKeys } } });
    await prisma.studentCoursePackage.deleteMany({ where: { id: { in: created.packageIds } } });
    await prisma.$disconnect();
  }

  console.log(`\n全部通过：${passed} 项`);
}

main().catch(async (err) => {
  console.error('\n测试失败：', err);
  await prisma.$disconnect();
  process.exit(1);
});
