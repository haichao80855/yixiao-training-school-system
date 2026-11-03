/**
 * 拓视未来教育「一校教培系统」
 * 生产环境配置安全门禁测试：JWT 密钥
 */

const assert = require('assert');
const { resolveJwtSecret } = require('./dist/modules/auth/jwt-secret');

const strong = 'a3f1c9e07b2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d';

console.log('▶ [Case 1] 开发环境未配置时使用开发回退密钥');
assert.strictEqual(typeof resolveJwtSecret(undefined, 'development'), 'string');
assert.strictEqual(resolveJwtSecret(' custom ', 'development'), 'custom');

console.log('▶ [Case 2] 生产环境未配置 / 模板占位值 / 过短时拒绝启动');
assert.throws(() => resolveJwtSecret(undefined, 'production'), /JWT_SECRET/);
assert.throws(() => resolveJwtSecret('', 'production'), /JWT_SECRET/);
assert.throws(() => resolveJwtSecret('replace-with-your-own-secret', 'production'), /JWT_SECRET/);
assert.throws(() => resolveJwtSecret('shengtong_edu_secret_key_2026_antigravity', 'production'), /JWT_SECRET/);
assert.throws(() => resolveJwtSecret('short-secret', 'production'), /JWT_SECRET/);

console.log('▶ [Case 3] 生产环境配置强随机密钥时正常返回');
assert.strictEqual(resolveJwtSecret(strong, 'production'), strong);

console.log('\n🎉 生产环境配置安全门禁 3 项测试通过！\n');
