#!/usr/bin/env node
/**
 * 统一测试运行器：读取 tests/suites.json，逐个运行，失败后继续，最后汇总。
 *
 * 用法 (一般通过 npm 脚本调用，见 package.json)：
 *   node tests/run-suite.cjs [--scope=server|integration|offline|all] [--group=名称片段] [--file=文件名片段]
 *                            [--list] [--allow-dev-db] [--report=路径]
 *
 * 需要后端的测试会连 TEST_BASE_URL (由 tests/isolated-env.cjs 设置)。直接对开发服务器运行会被
 * tests/env-guard.cjs 拦下，除非显式传 --allow-dev-db。
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { checkTargetSafety, resolveSqlitePath } = require('./env-guard.cjs');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(__dirname, 'suites.json');
const PER_TEST_TIMEOUT_MS = 5 * 60 * 1000;

function parseArgs(argv) {
  const opts = { scope: 'all', group: null, file: null, list: false, allowDevDb: false, report: null };
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'scope') opts.scope = value;
    else if (key === 'group') opts.group = value;
    else if (key === 'file') opts.file = value;
    else if (key === 'list') opts.list = true;
    else if (key === 'allow-dev-db') opts.allowDevDb = true;
    else if (key === 'report') opts.report = value;
    else {
      console.error(`未知参数：${arg}`);
      process.exit(2);
    }
  }
  if (!['server', 'integration', 'offline', 'all'].includes(opts.scope)) {
    console.error(`--scope 只能是 server / integration / offline / all，收到：${opts.scope}`);
    process.exit(2);
  }
  return opts;
}

function loadManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const entries = [];
  for (const group of manifest.groups) {
    for (const t of group.tests) entries.push({ ...t, group: group.name, scope: group.scope });
  }
  return entries;
}

/** 清单完整性：每个 server/test-*.js 都必须登记；登记的文件必须存在且不重复。 */
function checkManifest(entries) {
  const problems = [];
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.file)) problems.push(`清单里重复登记：${e.file}`);
    seen.add(e.file);
    if (!fs.existsSync(path.join(ROOT, e.file))) problems.push(`清单里的文件不存在：${e.file}`);
  }
  const serverTests = fs.readdirSync(path.join(ROOT, 'server')).filter((f) => /^test-.*\.js$/.test(f));
  for (const f of serverTests) {
    if (!seen.has(`server/${f}`)) problems.push(`server/${f} 没有登记到 tests/suites.json，不会被任何入口运行`);
  }
  // tests/ 顶层的脚本同样必须登记 (tests/unit/*.test.js 由 tests/runner.js 统一运行)
  const INFRA = new Set(['run-suite.cjs', 'isolated-env.cjs', 'env-guard.cjs', 'run_all_unified.cjs']);
  const topLevel = fs.readdirSync(__dirname).filter((f) => /\.(c?js)$/.test(f) && !INFRA.has(f));
  for (const f of topLevel) {
    if (!seen.has(`tests/${f}`)) problems.push(`tests/${f} 没有登记到 tests/suites.json，不会被任何入口运行`);
  }
  return problems;
}

function checkHealth(baseUrl) {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function newestMtime(dir) {
  let newest = 0;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else newest = Math.max(newest, fs.statSync(p).mtimeMs);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return newest;
}

/** 小程序 / H5 的构建产物比源码旧时不能测：测的是旧代码，通过和失败都没有意义。 */
let mpSourceMtime = null;
function buildStatus(distDir) {
  const abs = path.join(ROOT, distDir);
  if (!fs.existsSync(abs)) return 'missing';
  if (mpSourceMtime === null) mpSourceMtime = newestMtime(path.join(ROOT, 'mini-program/src'));
  return newestMtime(abs) < mpSourceMtime ? 'stale' : 'fresh';
}

function missingNeeds(entry) {
  if (entry.skip) return [`已登记跳过：${entry.skip}`];
  const reasons = [];
  const builds = {
    'mp-dist': ['mini-program/dist/build/mp-weixin', '小程序', 'npm run mp:build'],
    'h5-dist': ['mini-program/dist/build/h5', '家长端 H5', 'cd mini-program && npm run build:h5'],
  };
  for (const need of entry.needs || []) {
    if (need === 'server-dist' && !fs.existsSync(path.join(ROOT, 'server/dist/main.js'))) {
      reasons.push('需要先构建后端 (npm run server:build)');
    }
    if (builds[need]) {
      const [dir, label, cmd] = builds[need];
      const status = buildStatus(dir);
      if (status === 'missing') reasons.push(`需要先构建${label} (${cmd})`);
      if (status === 'stale') reasons.push(`${label}构建产物比源码旧，请先重新构建 (${cmd})`);
    }
  }
  return reasons;
}

function commandFor(entry) {
  const abs = path.join(ROOT, entry.file);
  if (entry.file.endsWith('.ts')) {
    const tsNode = path.join(ROOT, 'server/node_modules/.bin/ts-node');
    return { cmd: tsNode, args: ['--transpile-only', abs], cwd: path.join(ROOT, 'server') };
  }
  // 后端测试一直在 server 目录下运行 (相对路径和 .env 都按这个目录写)；tests/ 下的在仓库根目录运行
  const cwd = entry.file.startsWith('server/') ? path.join(ROOT, 'server') : ROOT;
  return { cmd: process.execPath, args: [abs], cwd };
}

function runOne(entry) {
  const { cmd, args, cwd } = commandFor(entry);
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env, stdio: 'inherit' });
    const timer = setTimeout(() => {
      console.error(`\n⏱  ${entry.file} 超过 ${PER_TEST_TIMEOUT_MS / 60000} 分钟，强制结束`);
      child.kill('SIGKILL');
    }, PER_TEST_TIMEOUT_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, signal, ms: Date.now() - started });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      console.error(err);
      resolve({ code: 1, signal: null, ms: Date.now() - started });
    });
  });
}

/**
 * 残留检查与恢复：每个需要后端的测试前后统计测试库各表的行数和最大 rowid。
 * - 测试跑完多出来的行 = 测试没清理干净的数据，记入汇总 (「清理遗漏」)。
 * - 随后把这些新增行删掉，让下一个测试面对的还是原来的库，测试之间互不影响。
 * 只在隔离环境的临时 SQLite 库上运行 (isolated-env 设置 TEST_ISOLATED=1)，绝不对开发库做删除。
 */
function createResidueProbe() {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('file:') || process.env.TEST_ISOLATED !== '1') return null;
  // 第二道保险：只对系统临时目录下的库做删除 (isolated-env 建的临时库都在这里)
  const dbFile = resolveSqlitePath(url, ROOT);
  const tmpRoot = fs.realpathSync(require('os').tmpdir());
  if (!dbFile || !fs.existsSync(dbFile) || !fs.realpathSync(dbFile).startsWith(tmpRoot + path.sep)) return null;
  const { PrismaClient } = require(path.join(ROOT, 'server/node_modules/@prisma/client'));
  const prisma = new PrismaClient();
  return {
    async snapshot() {
      const tables = await prisma.$queryRawUnsafe(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'",
      );
      const snap = {};
      for (const { name } of tables) {
        const [row] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n, COALESCE(MAX(rowid), 0) AS maxRowid FROM "${name}"`);
        snap[name] = { count: Number(row.n), maxRowid: Number(row.maxRowid) };
      }
      return snap;
    },
    diff(before, after) {
      return Object.keys(after)
        .filter((t) => after[t].count > (before[t]?.count || 0))
        .map((t) => `${t} +${after[t].count - (before[t]?.count || 0)}`);
    },
    /**
     * 删除测试期间新增的行 (rowid 大于测试前的最大值)。
     * 只处理「纯新增」的表：测试前已有的行一行没少。如果测试删掉过原有的行再重建 (例如重设角色权限)，
     * 新 rowid 的行里就包含了替换后的正式数据，删掉会破坏测试库，这种表只报告、不动。
     * @returns {string[]} 因为有替换而没有自动删除的表
     */
    async restore(before) {
      const untouched = [];
      await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
      try {
        for (const [table, { count, maxRowid }] of Object.entries(before)) {
          const [row] = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*) AS old, (SELECT COUNT(*) FROM "${table}" WHERE rowid > ${maxRowid}) AS added FROM "${table}" WHERE rowid <= ${maxRowid}`,
          );
          if (Number(row.added) === 0) continue;
          if (Number(row.old) !== count) {
            untouched.push(table);
            continue;
          }
          await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE rowid > ${maxRowid}`);
        }
      } finally {
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
      }
      return untouched;
    },
    close: () => prisma.$disconnect(),
  };
}

function pad(s, n) {
  const width = [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
  return String(s) + ' '.repeat(Math.max(0, n - width));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const all = loadManifest();

  const problems = checkManifest(all);
  if (problems.length) {
    console.error('❌ 测试清单 tests/suites.json 有问题：');
    for (const p of problems) console.error(`   - ${p}`);
    process.exit(2);
  }

  const selected = all.filter(
    (e) =>
      (opts.scope === 'all' || e.scope === opts.scope) &&
      (!opts.group || e.group.includes(opts.group)) &&
      (!opts.file || e.file.includes(opts.file)),
  );

  if (opts.list) {
    let last = '';
    for (const e of selected) {
      if (e.group !== last) console.log(`\n[${e.group}]`);
      last = e.group;
      console.log(`  ${e.file}${e.needs?.length ? `  (needs: ${e.needs.join(', ')})` : ''}`);
    }
    console.log(`\n共 ${selected.length} 项`);
    return;
  }

  if (!selected.length) {
    console.error('没有匹配的测试，请检查 --scope / --group / --file。');
    process.exit(2);
  }

  const { BASE_URL } = require('../server/test-utils/target');
  if (selected.some((e) => (e.needs || []).includes('server'))) {
    const safety = checkTargetSafety({
      baseUrl: BASE_URL,
      databaseUrl: process.env.DATABASE_URL,
      allowDevDb: opts.allowDevDb,
    });
    if (!safety.ok) {
      console.error(`❌ 已拒绝运行：${safety.reason}`);
      process.exit(2);
    }
    if (!(await checkHealth(BASE_URL))) {
      console.error(`❌ 后端 ${BASE_URL} 没有响应 /api/health。请用 npm run test:isolated 自动起临时后端。`);
      process.exit(2);
    }
  }

  console.log(`▶ 运行 ${selected.length} 项测试 (scope=${opts.scope}${opts.group ? `, group~${opts.group}` : ''}${opts.file ? `, file~${opts.file}` : ''})，后端：${BASE_URL}\n`);

  const probe = createResidueProbe();
  const results = [];
  for (const [i, entry] of selected.entries()) {
    const missing = missingNeeds(entry);
    if (missing.length) {
      results.push({ ...entry, status: 'skipped', reason: missing.join('；'), ms: 0 });
      console.log(`\n⏭  [${i + 1}/${selected.length}] 跳过 ${entry.file}：${missing.join('；')}`);
      continue;
    }
    console.log(`\n${'━'.repeat(80)}\n▶ [${i + 1}/${selected.length}] ${entry.group} · ${entry.file}\n${'━'.repeat(80)}`);
    const before = probe && (entry.needs || []).includes('server') ? await probe.snapshot() : null;
    const r = await runOne(entry);
    let residue = [];
    if (before) {
      residue = probe.diff(before, await probe.snapshot());
      if (residue.length) {
        const untouched = await probe.restore(before);
        const note = untouched.length ? `；${untouched.join("、")} 改动过原有数据，没有自动恢复` : "";
        console.log(`\n🧹 ${entry.file} 没有清理干净，测试库多出：${residue.join("，")} (纯新增的行已自动删除${note})`);
      }
    }
    results.push({ ...entry, status: r.code === 0 ? 'passed' : 'failed', exitCode: r.code, signal: r.signal, ms: r.ms, residue });
  }
  if (probe) await probe.close();

  const passed = results.filter((r) => r.status === 'passed');
  const failed = results.filter((r) => r.status === 'failed');
  const skipped = results.filter((r) => r.status === 'skipped');
  const totalMs = results.reduce((s, r) => s + r.ms, 0);

  console.log(`\n${'═'.repeat(80)}\n测试汇总\n${'═'.repeat(80)}`);
  let lastGroup = '';
  for (const r of results) {
    if (r.group !== lastGroup) console.log(`\n[${r.group}]`);
    lastGroup = r.group;
    const mark = r.status === 'passed' ? '✓' : r.status === 'failed' ? '✗' : '–';
    const time = r.status === 'skipped' ? r.reason : `${(r.ms / 1000).toFixed(1)}s`;
    console.log(`  ${mark} ${pad(path.basename(r.file), 56)} ${time}`);
  }
  const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 3).filter((r) => r.ms > 0);
  console.log(`\n通过 ${passed.length}，失败 ${failed.length}，跳过 ${skipped.length}，共 ${results.length} 项，用时 ${(totalMs / 1000).toFixed(1)}s`);
  if (slowest.length) console.log(`最慢：${slowest.map((r) => `${path.basename(r.file)} ${(r.ms / 1000).toFixed(1)}s`).join('，')}`);
  const leaky = results.filter((r) => r.residue?.length);
  if (leaky.length) {
    console.log(`\n清理遗漏 (${leaky.length} 项测试没有删掉自己造的数据，运行器已删除其中的纯新增行；修测试时以这里为准)：`);
    for (const r of leaky) console.log(`  🧹 ${path.basename(r.file)}：${r.residue.join('，')}`);
  }
  if (failed.length) {
    console.log('\n失败项：');
    for (const r of failed) console.log(`  ✗ ${r.file} (exit ${r.exitCode}${r.signal ? `, ${r.signal}` : ''})`);
  }

  if (opts.report) {
    fs.mkdirSync(path.dirname(path.resolve(opts.report)), { recursive: true });
    fs.writeFileSync(
      opts.report,
      JSON.stringify({ baseUrl: BASE_URL, passed: passed.length, failed: failed.length, skipped: skipped.length, totalMs, results }, null, 2),
    );
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
