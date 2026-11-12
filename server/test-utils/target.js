/**
 * 测试连接的后端地址，所有 server/test-*.js 和 tests/*.cjs 统一从这里取。
 *
 * 优先级：TEST_BASE_URL > PORT > 默认 http://127.0.0.1:3001。
 * `npm run test:isolated` 会为临时后端设置 TEST_BASE_URL，测试不会碰到开发库。
 */
const raw = (process.env.TEST_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/+$/, '');
const parsed = new URL(raw);

if (!process.env.TEST_BASE_URL && !process.env.PORT && !global.__yixiaoTargetWarned) {
  global.__yixiaoTargetWarned = true;
  console.warn(
    '⚠️  没有设置 TEST_BASE_URL，正在连 3001 开发服务器，测试数据会写进开发库。' +
      '推荐改用 npm run test:isolated (临时库，跑完自动删除)。',
  );
}

module.exports = {
  BASE_URL: raw,
  HOST: parsed.hostname,
  PORT: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
};
