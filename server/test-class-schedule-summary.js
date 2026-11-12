/**
 * 班级档案：结课日期选填，以及由真实排课推导的上课规律、课次进度与末次课日期
 * 需要后端服务已启动（PORT 默认 3001）
 */
const http = require('http');
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const { PORT } = require('./test-utils/target');
const { SEED_PASSWORD, ACCOUNTS } = require('./test-utils/accounts');
let token = '';

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      },
    );
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  const login = await api('POST', '/api/auth/login', { account: ACCOUNTS.superAdmin, password: SEED_PASSWORD });
  token = login.body.data.accessToken;

  const campus = await prisma.campus.findFirstOrThrow();
  const course = await prisma.course.findFirstOrThrow();
  const classroom = await prisma.classroom.findFirstOrThrow({ where: { campusId: campus.id } });
  const teacher = await prisma.user.findFirstOrThrow();
  const suffix = Date.now().toString(36).toUpperCase();
  const base = {
    campusId: campus.id,
    courseId: course.id,
    name: `排课概况测试班-${suffix}`,
    teacherId: teacher.id,
    advisorId: teacher.id,
    classroomId: classroom.id,
    startDate: '2026-09-01',
  };
  const createdIds = [];

  try {
    // 新建：不填结课日期可以保存，班主任被保存；结课早于开班被拒绝
    const created = await api('POST', '/api/educational/classes', { ...base, code: `CLS-SUM-${suffix}` });
    assert.ok(created.status < 300, `不填结课日期应能新建：${JSON.stringify(created.body)}`);
    const classId = created.body.data.id;
    createdIds.push(classId);
    assert.strictEqual(created.body.data.endDate, null);
    assert.strictEqual(created.body.data.advisorId, teacher.id);

    const earlier = await api('POST', '/api/educational/classes', {
      ...base,
      code: `CLS-SUM-BAD-${suffix}`,
      endDate: '2026-08-01',
    });
    assert.strictEqual(earlier.status, 400, '新建时结课早于开班应被拒绝');

    // 编辑：可填写、可清空；未传时不改动
    const filled = await api('PUT', `/api/educational/classes/${classId}`, { endDate: '2027-01-15' });
    assert.ok(String(filled.body.data.endDate).startsWith('2027-01-15'));
    const untouched = await api('PUT', `/api/educational/classes/${classId}`, { name: base.name });
    assert.ok(String(untouched.body.data.endDate).startsWith('2027-01-15'), '未传 endDate 时不应改动');
    const cleared = await api('PUT', `/api/educational/classes/${classId}`, { endDate: null });
    assert.strictEqual(cleared.body.data.endDate, null, '传 null 应清空结课日期');

    const find = async () => {
      const res = await api('GET', `/api/educational/classes?campusId=${campus.id}&keyword=${encodeURIComponent(base.name)}`);
      return res.body.data.list.find((c) => c.id === classId);
    };

    // 未排课
    const empty = await find();
    assert.strictEqual(empty.scheduleDesc, '');
    assert.strictEqual(empty.completedLessons, 0);
    assert.strictEqual(empty.lastScheduleDate, null);
    assert.strictEqual(empty.totalLessons, course.totalLessons, '总课次应取自关联课程');
    assert.strictEqual(empty.schedules, undefined, '列表不应返回完整排课明细');

    // 补课与已取消的课不计入规律、进度和末次课
    const lesson = (date, overrides = {}) => ({
      campusId: campus.id,
      classId,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date,
      startTime: '09:00',
      endTime: '10:30',
      ...overrides,
    });
    await prisma.scheduleEvent.createMany({
      data: [
        lesson('2026-09-26', { status: 'completed' }), // 周六
        lesson('2026-10-03'), // 周六
        lesson('2026-10-11', { startTime: '14:00', endTime: '15:30' }), // 周日
        lesson('2026-10-31', { status: 'cancelled' }),
        lesson('2026-11-14', { classType: 'make_up', status: 'completed' }),
      ],
    });

    const expected = {
      scheduleDesc: '每周六 09:00-10:30、每周日 14:00-15:30',
      completedLessons: 1,
      lastScheduleDate: '2026-10-11',
    };
    const listed = await find();
    const detail = (await api('GET', `/api/educational/classes/${classId}`)).body.data;
    for (const [key, value] of Object.entries(expected)) {
      assert.strictEqual(listed[key], value, `列表 ${key}`);
      assert.strictEqual(detail[key], value, `详情 ${key}`);
    }
    assert.strictEqual(detail.totalLessons, course.totalLessons);

    console.log('✓ test-class-schedule-summary 全部通过');
  } finally {
    await prisma.scheduleEvent.deleteMany({ where: { classId: { in: createdIds } } });
    await prisma.class.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
