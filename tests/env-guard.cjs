/**
 * 测试环境保护：会写数据的测试只能连本机后端 + 临时测试库。
 *
 * 规则：
 * 1. 后端地址必须是本机 (localhost / 127.0.0.1 / ::1)，任何情况下都不放行远程地址，防止误连生产。
 * 2. 必须设置 DATABASE_URL：很多测试会直接用 PrismaClient 写库，不设置就会读 server/.env，落到开发库。
 * 3. DATABASE_URL 指向 server/prisma/dev.db，或后端是 3001 端口 (开发服务器的约定端口)，视为开发环境。
 *    这两种情况默认拒绝，只有显式传 --allow-dev-db 才放行。
 */
const path = require('path');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DEV_PORT = 3001;

function resolveSqlitePath(databaseUrl, cwd) {
  if (!databaseUrl || !databaseUrl.startsWith('file:')) return null;
  const raw = databaseUrl.slice('file:'.length).split('?')[0];
  // Prisma 把相对路径解析到 schema 所在目录 (server/prisma)
  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(cwd, 'server/prisma', raw);
}

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function checkTargetSafety({ baseUrl, databaseUrl, allowDevDb = false, repoRoot = path.resolve(__dirname, '..') }) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return { ok: false, reason: `后端地址无法解析：${baseUrl}` };
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    return { ok: false, reason: `测试只能连本机后端，当前地址是 ${url.host}。远程地址一律拒绝，避免写入生产数据。` };
  }

  if (allowDevDb) return { ok: true };

  const devHint = '如确实要对开发服务器运行，请加 --allow-dev-db；推荐改用 npm run test:isolated (临时库，跑完自动删除)。';

  if (!databaseUrl) {
    return { ok: false, reason: `没有设置 DATABASE_URL，测试里的 PrismaClient 会读 server/.env 写开发库。${devHint}` };
  }

  const sqlitePath = resolveSqlitePath(databaseUrl, repoRoot);
  if (sqlitePath && /[\\/]server[\\/]prisma[\\/]dev\.db$/.test(sqlitePath)) {
    return { ok: false, reason: `DATABASE_URL 指向开发库 ${sqlitePath}。${devHint}` };
  }
  if (!sqlitePath) {
    let dbHost = '';
    try {
      dbHost = new URL(databaseUrl).hostname;
    } catch {
      return { ok: false, reason: '无法识别 DATABASE_URL 的格式。' };
    }
    if (!LOCAL_HOSTS.has(dbHost)) {
      return { ok: false, reason: `DATABASE_URL 指向远程数据库 ${dbHost}，拒绝运行。` };
    }
  }

  if (Number(url.port) === DEV_PORT) {
    return { ok: false, reason: `后端是 ${DEV_PORT} 端口，通常是开发服务器 (连的是开发库)。${devHint}` };
  }

  return { ok: true };
}

module.exports = { checkTargetSafety, resolveSqlitePath };
