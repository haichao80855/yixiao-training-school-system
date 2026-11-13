/**
 * 核心接口压测 (流畅度改进第 0 期)：在临时库上测 15 个核心接口的耗时，看它们随数据量怎么增长。
 *
 * 用法：npm run bench                (默认测三档：种子数据、scale=1、scale=10)
 *       npm run bench -- --scales=1   (只测种子数据和 scale=1)
 *       npm run bench -- --runs=20 --out=bench.json
 *
 * 由 tests/isolated-env.cjs --exec 启动：临时库 + 随机端口的后端，跑完全部删除，不碰 dev.db。
 * 每档先造数 (scripts/seed-load.cjs，累加)，再对每个接口顺序请求 runs 次 (先预热 2 次)，
 * 输出 p50 / p95 / 响应体大小，并统计这一档期间后端日志里的慢请求和慢查询条数。
 */
const fs = require('fs');
const path = require('path');
const { seedLoad, assertTempDatabase } = require('./seed-load.cjs');
const { BASE_URL } = require('../server/test-utils/target');
const { ACCOUNTS, SEED_PASSWORD } = require('../server/test-utils/accounts');

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const RUNS = Number(arg('runs', 30));
const SCALES = arg('scales', '1,10').split(',').filter(Boolean).map(Number);
const OUT = arg('out', '');

function shanghaiToday(offset = 0) {
  return new Date(Date.now() + 8 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
}
function weekRange() {
  const today = new Date(`${shanghaiToday()}T00:00:00Z`);
  const dow = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today.getTime() - dow * 86400e3);
  const sunday = new Date(monday.getTime() + 6 * 86400e3);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

async function login(role) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: ACCOUNTS[role], password: SEED_PASSWORD }),
  });
  const body = await res.json();
  if (!body?.data?.accessToken) throw new Error(`${role} 登录失败：${JSON.stringify(body).slice(0, 200)}`);
  return body.data;
}

function endpoints(campusId) {
  const [weekStart, weekEnd] = weekRange();
  const today = shanghaiToday();
  const monthAgo = shanghaiToday(-30);
  const month = today.slice(0, 7);
  const c = `campusId=${campusId}`;
  // [名称, 角色, 路径]。路径尽量和前端页面实际发的请求一致 (包括现在不带日期范围的请求)
  return [
    ['登录后取个人信息', 'principal', '/api/auth/profile'],
    ['学员列表 (第 1 页)', 'principal', `/api/students?${c}&page=1&pageSize=20`],
    ['学员统计', 'principal', `/api/students/stats?${c}`],
    ['续报名单', 'principal', `/api/students/renewal/roster?${c}`],
    ['排课 (排课页现状：不带日期)', 'principal', `/api/educational/schedules?${c}`],
    ['排课 (本周)', 'principal', `/api/educational/schedules?${c}&startDate=${weekStart}&endDate=${weekEnd}`],
    ['点名工作台快照 (不带日期)', 'principal', `/api/educational/settlement/workbench?${c}`],
    ['点名工作台快照 (今天)', 'principal', `/api/educational/settlement/workbench?${c}&date=${today}`],
    ['班级列表', 'principal', `/api/educational/classes?${c}`],
    ['订单列表 (第 1 页)', 'principal', `/api/financial/orders?${c}&page=1&pageSize=20`],
    ['审批列表', 'principal', `/api/financial/approvals?${c}`],
    ['后台看板 (近 30 天)', 'principal', `/api/financial/dashboard/admin?consumptionStart=${monthAgo}&consumptionEnd=${today}&enrollmentStart=${monthAgo}&enrollmentEnd=${today}`],
    ['教学指标 (近 30 天)', 'principal', `/api/educational/dashboard/teaching-metrics?start=${monthAgo}&end=${today}`],
    ['老师课酬 (本月)', 'principal', `/api/financial/teacher-pay?month=${month}`],
    ['站内通知', 'principal', '/api/notifications?limit=20'],
    ['老师端首页', 'teacher', '/api/teacher-portal/overview'],
  ];
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function measure(token, url) {
  const headers = { Authorization: `Bearer ${token}` };
  let status = 0;
  let bytes = 0;
  for (let i = 0; i < 2; i += 1) await fetch(`${BASE_URL}${url}`, { headers }).then((r) => r.arrayBuffer());
  const times = [];
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}${url}`, { headers });
    const buf = await res.arrayBuffer();
    times.push(performance.now() - t0);
    status = res.status;
    bytes = buf.byteLength;
  }
  times.sort((a, b) => a - b);
  return { status, bytes, p50: percentile(times, 50), p95: percentile(times, 95) };
}

function logOffset() {
  const file = process.env.SERVER_LOG_FILE;
  return file && fs.existsSync(file) ? fs.statSync(file).size : 0;
}
function slowLinesSince(offset) {
  const file = process.env.SERVER_LOG_FILE;
  if (!file || !fs.existsSync(file)) return { requests: 0, queries: 0 };
  const text = fs.readFileSync(file, 'utf8').slice(offset);
  return {
    requests: (text.match(/\[timing\].*慢请求/g) || []).length,
    queries: (text.match(/\[slow-query\]/g) || []).length,
  };
}

const fmtMs = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
const fmtKb = (n) => (n / 1024).toFixed(n >= 10240 ? 0 : 1);

async function main() {
  assertTempDatabase();
  const principal = await login('principal');
  const teacher = await login('teacher');
  const tokens = { principal: principal.accessToken, teacher: teacher.accessToken };
  const list = endpoints(principal.user.campusId);

  const tiers = [{ label: '种子数据', scale: 0 }, ...SCALES.map((s) => ({ label: `scale=${s}`, scale: s }))];
  const results = [];
  let loaded = 0;
  for (const tier of tiers) {
    if (tier.scale > loaded) {
      const t0 = Date.now();
      const counts = await seedLoad(tier.scale - loaded, `L${tier.scale}`);
      loaded = tier.scale;
      console.log(`\n[bench] 造数到 ${tier.label}：新增 ${JSON.stringify(counts)}，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    const offset = logOffset();
    console.log(`\n[bench] ${tier.label}：每个接口 ${RUNS} 次`);
    const rows = [];
    for (const [name, role, url] of list) {
      const r = await measure(tokens[role], url);
      rows.push({ name, url, ...r });
      console.log(`  ${name.padEnd(22, '　')} p50 ${fmtMs(r.p50).padStart(6)}ms  p95 ${fmtMs(r.p95).padStart(6)}ms  ${fmtKb(r.bytes).padStart(6)}KB  HTTP ${r.status}`);
    }
    const slow = slowLinesSince(offset);
    console.log(`  后端日志：慢请求 ${slow.requests} 条，慢查询 ${slow.queries} 条`);
    results.push({ tier: tier.label, scale: tier.scale, rows, slow });
  }

  // Markdown 对比表：每个接口在各档的 p95
  const header = `| 接口 | ${tiers.map((t) => `${t.label} p95`).join(' | ')} | ${tiers[tiers.length - 1].label} 响应体 |`;
  const sep = `|---|${tiers.map(() => '---:').join('|')}|---:|`;
  const lines = list.map(([name], i) => {
    const cells = results.map((r) => `${fmtMs(r.rows[i].p95)} ms`);
    const last = results[results.length - 1].rows[i];
    return `| ${name} | ${cells.join(' | ')} | ${fmtKb(last.bytes)} KB |`;
  });
  console.log(`\n${header}\n${sep}\n${lines.join('\n')}\n`);

  if (OUT) {
    fs.writeFileSync(path.resolve(OUT), JSON.stringify({ at: new Date().toISOString(), runs: RUNS, results }, null, 2));
    console.log(`[bench] 结果写到 ${OUT}`);
  }
  const failed = results.flatMap((r) => r.rows).filter((r) => r.status >= 400);
  if (failed.length) {
    console.error(`[bench] ❌ ${failed.length} 个请求返回错误：${[...new Set(failed.map((f) => `${f.status} ${f.url}`))].join('; ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[bench] ❌ ${err.stack || err.message}`);
  process.exit(1);
});
