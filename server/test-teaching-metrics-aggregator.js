/**
 * 首页教学经营指标 (TeachingMetricsAggregator) 测试
 * 1) 离线：到课率、请假率、课评查看率、满班率的计算口径
 * 2) 在线：/api/educational/dashboard/teaching-metrics 的权限与参数校验 (只读，不写数据库)
 */

const assert = require('assert');
const http = require('http');
const { summarizeTeachingMetrics, ratio } = require('./dist/modules/educational/domain/teaching-metrics.aggregator');

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
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
  return data && (data.accessToken || data.token);
}

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    });
}

async function offline() {
  console.log('离线：指标计算口径');

  await test('比率保留 1 位小数，分母为 0 时为 null', () => {
    assert.deepStrictEqual(ratio(1, 3), { numerator: 1, denominator: 3, rate: 33.3 });
    assert.deepStrictEqual(ratio(0, 0), { numerator: 0, denominator: 0, rate: null });
  });

  await test('到课算出勤和迟到，请假和缺勤分开统计', () => {
    const m = summarizeTeachingMetrics({
      start: '2026-11-01',
      end: '2026-11-30',
      attendanceStatuses: ['present', 'present', 'late', 'leave', 'absent'],
      lessonCount: 2,
      evaluationItems: [],
      classes: [],
    });
    assert.strictEqual(m.attendance.rate, 60);
    assert.strictEqual(m.leave.rate, 20);
    assert.strictEqual(m.absentCount, 1);
    assert.strictEqual(m.lessonCount, 2);
  });

  await test('没有点名和课评时显示暂无数据，而不是 0%', () => {
    const m = summarizeTeachingMetrics({
      start: '2026-11-01',
      end: '2026-11-30',
      attendanceStatuses: [],
      lessonCount: 0,
      evaluationItems: [],
      classes: [],
    });
    assert.strictEqual(m.attendance.rate, null);
    assert.strictEqual(m.evaluationView.rate, null);
    assert.strictEqual(m.classFill.rate, null);
  });

  await test('课评查看率 = 家长看过的 / 已发布的', () => {
    const m = summarizeTeachingMetrics({
      start: '2026-11-01',
      end: '2026-11-30',
      attendanceStatuses: [],
      lessonCount: 0,
      evaluationItems: [{ viewed: true }, { viewed: false }, { viewed: true }, { viewed: true }],
      classes: [],
    });
    assert.strictEqual(m.evaluationView.rate, 75);
  });

  await test('满班率：超员按满员计，容量为 0 的班不计', () => {
    const m = summarizeTeachingMetrics({
      start: '2026-11-01',
      end: '2026-11-30',
      attendanceStatuses: [],
      lessonCount: 0,
      evaluationItems: [],
      classes: [
        { capacity: 8, currentStudentCount: 10 },
        { capacity: 8, currentStudentCount: 4 },
        { capacity: 0, currentStudentCount: 3 },
      ],
    });
    assert.deepStrictEqual(m.classFill, { numerator: 12, denominator: 16, rate: 75 });
    assert.strictEqual(m.fullClassCount, 1);
    assert.strictEqual(m.activeClassCount, 2);
  });
}

async function online() {
  console.log(`在线：接口 (端口 ${PORT})`);
  const path = '/api/educational/dashboard/teaching-metrics?start=2026-11-01&end=2026-11-30';

  const principal = await login('zhangjh');
  const finance = await login('wangcw');
  assert.ok(principal && finance, '种子账号登录失败');

  await test('校长可以查看，返回四项指标', async () => {
    const res = await request(path, { token: principal });
    assert.strictEqual(res.status, 200);
    const d = res.body.data;
    for (const key of ['attendance', 'leave', 'evaluationView', 'classFill']) {
      assert.ok(d[key] && 'rate' in d[key] && 'denominator' in d[key], `缺少 ${key}`);
    }
  });

  await test('没有教务权限的财务账号被拒绝', async () => {
    const res = await request(path, { token: finance });
    assert.strictEqual(res.status, 403);
  });

  await test('日期格式错误或开始晚于结束时返回 400', async () => {
    const bad = await request('/api/educational/dashboard/teaching-metrics?start=11-01&end=2026-11-30', { token: principal });
    assert.strictEqual(bad.status, 400);
    const reversed = await request('/api/educational/dashboard/teaching-metrics?start=2026-12-01&end=2026-11-30', { token: principal });
    assert.strictEqual(reversed.status, 400);
  });
}

(async () => {
  try {
    await offline();
    await online();
    console.log(`\n全部通过：${passed} 项`);
  } catch (err) {
    console.error('\n测试失败：', err);
    process.exit(1);
  }
})();
