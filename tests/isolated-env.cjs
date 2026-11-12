#!/usr/bin/env node
/**
 * 一键隔离测试：建临时测试库 → 在随机端口起后端 → 运行 tests/run-suite.cjs → 关闭后端、删除临时库。
 * 开发库 server/prisma/dev.db 和 3001 开发服务器都不会被碰到。
 *
 * 用法：node tests/isolated-env.cjs [--keep] [--no-build] [run-suite 的参数...]
 *   --keep      跑完保留临时目录 (库、上传文件、后端日志)，方便排查
 *   --no-build  不检查后端构建是否过期 (CI 里已经单独构建过)
 *   其余参数原样传给 run-suite，例如 --scope=server、--group=资金、--file=teacher-pay
 */
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
const BIN = path.join(SERVER, 'node_modules/.bin');

const argv = process.argv.slice(2);
const keep = argv.includes('--keep');
const noBuild = argv.includes('--no-build');
const suiteArgs = argv.filter((a) => a !== '--keep' && a !== '--no-build');

function log(msg) {
  console.log(`[isolated] ${msg}`);
}

function newestMtime(dir, filter) {
  let newest = 0;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (filter(p)) newest = Math.max(newest, fs.statSync(p).mtimeMs);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return newest;
}

/** 后端没构建，或 src / schema 比 dist 新时自动重新构建，避免测到旧代码。 */
function ensureServerBuild() {
  const distMain = path.join(SERVER, 'dist/main.js');
  const srcNewest = Math.max(
    newestMtime(path.join(SERVER, 'src'), (p) => p.endsWith('.ts') && !p.endsWith('.spec.ts')),
    fs.statSync(path.join(SERVER, 'prisma/schema.prisma')).mtimeMs,
  );
  const distNewest = newestMtime(path.join(SERVER, 'dist'), (p) => p.endsWith('.js'));
  if (fs.existsSync(distMain) && distNewest >= srcNewest) return;
  log(fs.existsSync(distMain) ? '后端源码比构建产物新，重新构建…' : '后端还没构建，开始构建…');
  run('npm', ['run', 'build'], { cwd: SERVER });
}

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`命令失败：${cmd} ${args.join(' ')}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, server, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) return false;
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // 还没起来
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  if (!noBuild) ensureServerBuild();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yixiao-test-'));
  const dbFile = path.join(tmp, 'test.db');
  const uploadDir = path.join(tmp, 'uploads');
  const logFile = path.join(tmp, 'server.log');
  fs.mkdirSync(uploadDir);

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    DATABASE_URL: `file:${dbFile}`,
    UPLOADS_DIR: uploadDir,
    PORT: String(port),
    TEST_BASE_URL: baseUrl,
    NODE_ENV: 'test',
    STORAGE_ENGINE: 'local',
    COURSEWARE_PROBE: 'off',
  };
  // 测试不应碰到真实 OSS、告警机器人和微信接口
  for (const k of Object.keys(env)) {
    if (/^(OSS_|ALIYUN_|WECHAT_)/.test(k) || k === 'ALERT_WEBHOOK_URL') delete env[k];
  }

  let server = null;
  let exitCode = 1;
  const cleanup = () => {
    if (server && server.exitCode === null) server.kill('SIGTERM');
    if (keep) log(`保留临时目录：${tmp}`);
    else fs.rmSync(tmp, { recursive: true, force: true });
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });

  try {
    log(`临时目录 ${tmp}`);
    log('建表 (prisma db push) 并写入种子数据…');
    run(path.join(BIN, 'prisma'), ['db', 'push', '--skip-generate'], { cwd: SERVER, env, stdio: 'ignore' });
    run(path.join(BIN, 'ts-node'), ['--transpile-only', 'prisma/seed.ts'], { cwd: SERVER, env, stdio: 'ignore' });

    log(`在 ${baseUrl} 启动后端，日志写到 ${logFile}`);
    const out = fs.openSync(logFile, 'a');
    server = spawn(process.execPath, ['dist/main.js'], { cwd: SERVER, env, stdio: ['ignore', out, out] });
    if (!(await waitForHealth(baseUrl, server))) {
      console.error(fs.readFileSync(logFile, 'utf8').split('\n').slice(-40).join('\n'));
      throw new Error('临时后端 30 秒内没有就绪');
    }

    const suite = spawnSync(process.execPath, [path.join(__dirname, 'run-suite.cjs'), ...suiteArgs], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });
    exitCode = suite.status ?? 1;
  } catch (err) {
    console.error(`[isolated] ❌ ${err.message}`);
    exitCode = 1;
  } finally {
    cleanup();
  }
  process.exit(exitCode);
}

main();
