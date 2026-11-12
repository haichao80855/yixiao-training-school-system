/**
 * 经营统计与存活探针访问控制测试
 *  - /api/stats/overview：匿名与无效令牌 401，家长令牌 403，教职工登录后可用
 *  - /api/health：匿名可用，不含业务数据；数据库异常时 503 且不透出原始错误
 *  - deploy/ 下的健康检查全部指向 /api/health
 * 运行前提：后端已启动并执行过 prisma:seed，且已 npm run build
 * 运行命令: cd server && node test-stats-health-access.js (可用 PORT 指定被测服务端口，默认 3001)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { AppController } = require('./dist/app.controller');

const { BASE_URL } = require('./test-utils/target');
const prisma = new PrismaClient();
const RUN = Date.now().toString().slice(-7);
const PARENT_PHONE = `1772${RUN}`;
const STAT_FIELDS = ['campusCount', 'studentCount', 'courseCount', 'classCount', 'scheduleCount', 'orderCount'];
const STAT_FIELD_PATTERN = new RegExp(STAT_FIELDS.join('|'));

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`  ✓ [${passed}] ${message}`);
}

async function call(method, url, token, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // 非 JSON 响应保留在 text 中供断言
  }
  return { status: res.status, text, json };
}

async function staffToken(account, password = '123456') {
  const res = await call('POST', '/api/auth/login', null, { account, password });
  const token = res.json?.data?.accessToken;
  assert.ok(token, `账号 ${account} 应能登录 (需先执行 prisma:seed)`);
  return token;
}

async function testAnonymousStatsBlocked() {
  const anonymous = await call('GET', '/api/stats/overview');
  assert.strictEqual(anonymous.status, 401);
  assert.ok(!STAT_FIELD_PATTERN.test(anonymous.text), '匿名响应不得包含统计字段');
  ok('匿名请求统计接口返回 401，且响应不含统计字段');

  const forged = await call('GET', '/api/stats/overview', 'not-a-valid-token');
  assert.strictEqual(forged.status, 401);
  assert.ok(!STAT_FIELD_PATTERN.test(forged.text), '无效令牌响应不得包含统计字段');
  ok('无效令牌请求统计接口返回 401');
}

async function testStaffStatsAllowed() {
  const admin = await call('GET', '/api/stats/overview', await staffToken('donghaichao'));
  assert.strictEqual(admin.status, 200);
  for (const field of STAT_FIELDS) {
    assert.strictEqual(typeof admin.json.data[field], 'number', `应返回数字字段 ${field}`);
  }
  ok('管理员登录后可读取全部统计字段');

  const teacher = await call('GET', '/api/stats/overview', await staffToken('teacher_zhang'));
  assert.strictEqual(teacher.status, 200);
  assert.ok(
    teacher.json.data.studentCount <= admin.json.data.studentCount,
    '受限账号的学员数不应超过全集团',
  );
  ok('普通教职工登录后可访问，学员数不超过全集团');
}

async function testParentStatsForbidden() {
  const student = await prisma.student.create({
    data: {
      studentNo: `SH${RUN}`,
      name: '统计接口测试学员',
      gender: 'male',
      campusId: 'campus-bj-hq',
      status: 'normal',
      phone: PARENT_PHONE,
      phoneNormalized: PARENT_PHONE,
    },
  });
  try {
    const login = await call('POST', '/api/parent/auth/login', null, {
      phone: PARENT_PHONE,
      password: PARENT_PHONE.slice(-6),
    });
    const token = login.json?.data?.accessToken;
    assert.ok(token, '测试家长应能登录');

    const res = await call('GET', '/api/stats/overview', token);
    assert.strictEqual(res.status, 403);
    assert.ok(!STAT_FIELD_PATTERN.test(res.text), '家长响应不得包含统计字段');
    ok('家长令牌请求统计接口返回 403');
  } finally {
    await prisma.parentAccount.deleteMany({ where: { phone: PARENT_PHONE } });
    await prisma.student.delete({ where: { id: student.id } });
  }
}

async function testHealthIsAnonymousAndClean() {
  const res = await call('GET', '/api/health');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json.data, { status: 'ok' });
  assert.ok(!STAT_FIELD_PATTERN.test(res.text), '探针响应不得包含统计字段');
  ok('匿名请求存活探针返回 200，data 仅含 status');
}

async function testHealthDoesNotLeakDbErrors() {
  const secret = 'file:/opt/yixiao/server/prisma/dev.db locked';
  const controller = new AppController({ $queryRaw: () => Promise.reject(new Error(secret)) });
  await assert.rejects(controller.getLiveness(), (err) => {
    assert.strictEqual(err.getStatus(), 503);
    assert.ok(!JSON.stringify(err.getResponse()).includes(secret), '不得透出数据库原始错误');
    return true;
  });
  ok('数据库异常时存活探针抛 503，且不透出原始错误');
}

function testDeployScriptsUseHealth() {
  const deployDir = path.join(__dirname, '..', 'deploy');
  for (const file of ['deploy-to-aliyun.sh', 'setup-ecs.sh', 'docker-compose.prod.yml']) {
    const source = fs.readFileSync(path.join(deployDir, file), 'utf8');
    assert.ok(!source.includes('/api/stats/overview'), `${file} 不应再依赖统计接口`);
    assert.ok(source.includes('/api/health'), `${file} 应使用 /api/health 做健康检查`);
  }
  ok('deploy/ 下的健康检查全部指向 /api/health');
}

async function main() {
  console.log('🚀 经营统计与存活探针访问控制测试\n');
  await testAnonymousStatsBlocked();
  await testStaffStatsAllowed();
  await testParentStatsForbidden();
  await testHealthIsAnonymousAndClean();
  await testHealthDoesNotLeakDbErrors();
  testDeployScriptsUseHealth();
  console.log(`\n🎉 经营统计与存活探针访问控制 ${passed} 项测试通过！\n`);
}

main()
  .catch((err) => {
    console.error('❌ 测试失败:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
