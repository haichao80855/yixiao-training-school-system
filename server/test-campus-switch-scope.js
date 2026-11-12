/**
 * 校区切换作用域测试
 * 验证：超管按当前校区 (Header) 过滤、显式 all 透视全部、分校账号不可越权、可切换校区列表按权限下发
 */

const http = require('http');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const { PORT } = require('./test-utils/target');
const HOST = '127.0.0.1';
const HQ = 'campus-bj-hq';
const YY = 'campus-bj-yy';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function checkPort() {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${PORT}/`, (res) => resolve(res.statusCode < 500));
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function request(path, { method = 'GET', headers = {}, data } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: HOST, port: PORT, path, method, headers: { 'Content-Type': 'application/json', ...headers } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, body });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login(account) {
  const res = await request('/api/auth/login', { method: 'POST', data: { account, password: '123456' } });
  const token = res.body?.data?.accessToken || res.body?.accessToken;
  if (!token) throw new Error(`登录失败 [${account}]: ${JSON.stringify(res.body)}`);
  return token;
}

async function listStudentCampuses(token, query, campusHeader) {
  const res = await request(`/api/students?pageSize=200${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(campusHeader ? { 'X-Campus-Id': campusHeader } : {}),
    },
  });
  const data = res.body?.data ?? res.body;
  const list = data?.list || data?.items || [];
  return { status: res.status, campuses: new Set(list.map((s) => s.campusId)) };
}

async function getAuthorizedCampusIds(token) {
  const res = await request('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } });
  const data = res.body?.data ?? res.body;
  return (data.authorizedCampuses || []).map((c) => c.id);
}

async function run() {
  let passed = 0;
  function assert(condition, desc) {
    if (!condition) {
      console.error(`  ✗ FAIL: ${desc}`);
      process.exit(1);
    }
    passed++;
    console.log(`  ✓ PASS [${passed}]: ${desc}`);
  }

  let serverProcess = null;
  if (!(await checkPort())) {
    serverProcess = spawn('node', ['dist/main.js'], { cwd: __dirname, stdio: 'pipe' });
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      await sleep(500);
      ready = await checkPort();
    }
    if (!ready) {
      serverProcess.kill();
      throw new Error('后端服务启动超时');
    }
  }

  const principal = await prisma.user.findUnique({ where: { account: 'zhengli' } });
  const originalScope = principal.dataScope;

  try {
    const superToken = await login('donghaichao');
    const yyToken = await login('lixw');

    // 超管：当前校区 (Header) 决定列表范围
    const superByHeader = await listStudentCampuses(superToken, '', YY);
    assert(
      superByHeader.status === 200 && superByHeader.campuses.size === 1 && superByHeader.campuses.has(YY),
      '超管只带 X-Campus-Id 时，只返回当前校区的学员',
    );

    const superNoCampus = await listStudentCampuses(superToken, '');
    assert(superNoCampus.campuses.size > 1, '超管不带校区时，仍查看全部校区');

    const superAll = await listStudentCampuses(superToken, '&campusId=all', YY);
    assert(superAll.campuses.size > 1, '超管显式传 campusId=all 时，不受 Header 限制');

    const superQueryWins = await listStudentCampuses(superToken, `&campusId=${HQ}`, YY);
    assert(
      superQueryWins.campuses.size === 1 && superQueryWins.campuses.has(HQ),
      '超管同时传 campusId 和 Header 时，以 campusId 为准',
    );

    // 分校账号：Header 不能越权，显式跨校区被拦截
    const forgedHeader = await listStudentCampuses(yyToken, '', HQ);
    assert(
      forgedHeader.status === 200 && !forgedHeader.campuses.has(HQ),
      '分校账号伪造 X-Campus-Id 拿不到其他校区数据',
    );

    const crossCampus = await listStudentCampuses(yyToken, `&campusId=${HQ}`, HQ);
    assert(crossCampus.status === 403, '分校账号显式查询其他校区返回 403');

    const ownCampus = await listStudentCampuses(yyToken, `&campusId=${YY}`, YY);
    assert(ownCampus.status === 200 && !ownCampus.campuses.has(HQ), '分校账号可查询本校区');

    // 可切换校区列表
    const activeCampuses = await prisma.campus.findMany({ where: { status: 'active' }, select: { id: true } });
    const superCampuses = await getAuthorizedCampusIds(superToken);
    assert(superCampuses.length === activeCampuses.length, '超管可切换全部启用校区');

    const yyCampuses = await getAuthorizedCampusIds(yyToken);
    assert(yyCampuses.length === 1 && yyCampuses[0] === YY, '分校账号只能看到本校区');

    await prisma.user.update({ where: { id: principal.id }, data: { dataScope: 'all' } });
    const allScopeToken = await login('zhengli');
    const allScopeCampuses = await getAuthorizedCampusIds(allScopeToken);
    assert(allScopeCampuses.length === activeCampuses.length, '全校区权限账号可切换全部启用校区');

    console.log(`\n全部 ${passed} 项校区切换作用域测试通过`);
  } finally {
    await prisma.user.update({ where: { id: principal.id }, data: { dataScope: originalScope } });
    if (serverProcess) serverProcess.kill();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
