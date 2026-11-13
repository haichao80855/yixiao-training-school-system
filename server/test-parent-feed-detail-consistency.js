/**
 * 家长端课评卡片与详情页一致 (家长端 UI 改进第 2 期)：
 * - 卡片上的照片数 = 详情页能看到的照片数 (孩子照片 + 班级照片，去重后)；
 * - 卡片显示「有视频」时，详情页确实有孩子视频或班级视频；
 * - 评分口径一致：有孩子专属评分用专属评分，没有时用课堂整体评分；
 * - 未读总数 unreadCount 随家长查看而减少。
 *
 * 需要后端：npm run test:server -- --file=parent-feed-detail
 */
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const { BASE_URL } = require('./test-utils/target');
const { PARENT, seedParentDemo } = require('../tests/smoke/parent-fixtures.cjs');

const prisma = new PrismaClient();
let passed = 0;
function check(cond, desc, detail) {
  assert.ok(cond, `❌ ${desc}${detail !== undefined ? `：${JSON.stringify(detail).slice(0, 300)}` : ''}`);
  passed += 1;
  console.log(`  ✓ PASS [${passed}]: ${desc}`);
}
async function api(token, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const keyOf = (url) => String(url || '').split('?')[0];

async function run() {
  console.log('家长端课评卡片与详情页一致');
  const cleanup = await seedParentDemo(prisma);
  try {
    const login = await api('', 'POST', '/api/parent/auth/login', { phone: PARENT.phone, password: PARENT.password });
    check(login.status === 201 || login.status === 200, '种子家长登录', login.body);
    const token = login.body.data.accessToken;
    const base = `/api/parent/students/${PARENT.childId}`;

    const feed = await api(token, 'GET', `${base}/evaluations?limit=20`);
    const items = feed.body.data.items.filter((i) => i.evaluation);
    check(items.length >= 3, `课评列表里有演示数据的课评 (${items.length} 条)`);
    const unreadBefore = feed.body.data.unreadCount;
    check(unreadBefore === items.filter((i) => i.evaluation.unread).length, `第一页返回未读总数 unreadCount = ${unreadBefore}`);

    for (const item of items) {
      const detail = (await api(token, 'GET', `${base}/evaluations/${item.scheduleEventId}`)).body.data;
      const own = detail.forChild?.photos || [];
      const seen = new Set(own.map((p) => keyOf(p.url)));
      const visible = own.length + detail.classMedia.photos.filter((p) => !seen.has(keyOf(p.url))).length;
      check(item.evaluation.photoCount === visible, `「${item.evaluation.lessonTitle}」卡片照片数 ${item.evaluation.photoCount} = 详情页照片数 ${visible}`);
      const hasVideo = !!(detail.forChild?.video || detail.classMedia.video);
      check(item.evaluation.hasVideo === hasVideo, `「${item.evaluation.lessonTitle}」卡片和详情页的视频一致 (${hasVideo ? '有' : '无'})`);
      const rating = detail.forChild?.rating ?? detail.overall.rating ?? null;
      check(item.evaluation.rating === rating, `「${item.evaluation.lessonTitle}」评分口径一致 (${rating})`);
    }

    const first = items.find((i) => i.evaluation.unread);
    await api(token, 'POST', `${base}/evaluations/${first.scheduleEventId}/read`);
    const after = await api(token, 'GET', `${base}/evaluations?limit=1`);
    check(after.body.data.unreadCount === unreadBefore - 1, `看过一条后未读总数减一 (${unreadBefore} → ${after.body.data.unreadCount})`);

    console.log(`\n🎉 家长端卡片与详情一致 ${passed} 项检查通过\n`);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('测试失败:', err.message || err);
  process.exit(1);
});
