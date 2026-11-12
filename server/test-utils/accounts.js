/**
 * 测试登录用的种子账号，所有测试统一从这里取，不在测试文件里写死账号和密码。
 * 账号来自 server/prisma/seed.ts；隔离测试的临时库每次都按种子数据重建。
 *
 * 默认密码可以用 TEST_SEED_PASSWORD 覆盖 (种子数据改了初始密码时只改这一处)。
 * 能用业务角色验证的场景，优先用对应角色账号，不要都用超管，否则权限问题会被掩盖。
 */
const SEED_PASSWORD = process.env.TEST_SEED_PASSWORD || '123456';

const ACCOUNTS = Object.freeze({
  superAdmin: 'donghaichao', // 集团超管
  principal: 'zhangjh', // 执行校长 (校区负责人)
  finance: 'wangcw', // 财务
  teacher: 'zhaolp', // 任课老师
  advisor: 'lixw', // 课程顾问
});

module.exports = { SEED_PASSWORD, ACCOUNTS };
