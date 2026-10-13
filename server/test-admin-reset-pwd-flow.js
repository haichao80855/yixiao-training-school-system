/**
 * 拓视未来教育「一校教培系统」管理员重置其他账号密码全链路业务闭环自动化测试
 * 严格验证：
 * 1. 管理员登录并获取员工列表
 * 2. 目标员工原密码登录验证
 * 3. 管理员调用重置密码接口成功落盘
 * 4. 旧密码登录被坚决拦截 (401 密码错误)
 * 5. 新密码登录成功响应并获得有效 JWT
 * 6. 新凭证可正常访问受保护接口
 * 7. 密码安全复原回测
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:3001';

let passed = 0;
function logPass(msg) {
  passed++;
  console.log(`  ✓ PASS [${passed}]: ${msg}`);
}

async function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function login(account, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  });
  const token = res.data?.data?.accessToken || res.data?.accessToken;
  return { status: res.status, ok: res.ok, token, data: res.data };
}

async function runTests() {
  console.log('\n================================================================================');
  console.log('🔐  拓视未来教育「一校教培系统」管理员改密与真实登录验真自动化闭环测试');
  console.log('================================================================================\n');

  // 1. 管理员登录
  const adminLogin = await login('donghaichao', '123456');
  assert.ok(adminLogin.token, '超级管理员登录必须成功并取得有效 JWT');
  logPass('超级管理员 [donghaichao] 成功登录并取得授权凭证');

  const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` };

  // 2. 获取用户列表并选取测试员工 (优先 zhaolp，或现有在职员工如 zhangls)
  const usersRes = await request('/api/system/users', { headers: adminHeaders });
  const rawData = usersRes.data?.data || usersRes.data;
  const userList = Array.isArray(rawData) ? rawData : (rawData?.list || []);
  const targetUser =
    userList.find((u) => u.account === 'zhaolp') ||
    userList.find((u) => u.account === 'zhangls') ||
    userList.find((u) => u.account !== 'donghaichao');
  assert.ok(targetUser, '测试员工必须存在于数据库中');
  logPass(`定位目标员工档案: ${targetUser.realName || targetUser.name} (${targetUser.account}, ID: ${targetUser.id})`);

  // 2.1 基线密码归一化预置 (保证测试可重复幂等运行)
  await request(`/api/system/users/${targetUser.id}/password`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ password: '123456' }),
  });

  // 3. 验证原密码 (123456) 正常有效
  const initLogin = await login(targetUser.account, '123456');
  assert.ok(initLogin.token, '员工初始密码 123456 必须可用');
  logPass('员工当前有效密码 [123456] 校验通过');

  // 4. 管理员为员工修改密码为强安全性密码
  const newPassword = 'NewSecPass@2026';
  const resetRes = await request(`/api/system/users/${targetUser.id}/password`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ password: newPassword }),
  });
  assert.strictEqual(resetRes.status, 200, '管理员重置密码接口必须返回 200');
  assert.strictEqual(resetRes.data?.data?.success, true, '响应数据标记成功');
  logPass(`管理员成功为员工重置密码为 [${newPassword}]，服务端落盘成功`);

  // 5. 验证：旧密码登录被坚决拦截 (401 密码错误)
  const oldLogin = await login(targetUser.account, '123456');
  assert.strictEqual(oldLogin.status, 401, '旧密码登录必须被坚决拦截 401');
  assert.strictEqual(oldLogin.data?.message, '密码错误', '错误提示必须明确为密码错误');
  logPass('【安全生效】使用旧密码 [123456] 登录被坚决拦截: 401 密码错误');

  // 6. 验证：新密码登录成功并获取真实 JWT
  const newLogin = await login(targetUser.account, newPassword);
  assert.ok(newLogin.status === 200 || newLogin.status === 201, '新密码登录必须成功');
  assert.ok(newLogin.token, '新密码登录必须成功签发有效 JWT');
  logPass('【改密生效】使用新密码 [' + newPassword + '] 登录成功并签发有效 Token');

  // 7. 验证：新凭证可正常穿透访问受保护业务接口
  const profileRes = await request('/api/auth/profile', {
    headers: { Authorization: `Bearer ${newLogin.token}` },
  });
  assert.strictEqual(profileRes.status, 200, '新凭证调用 Profile 必须返回 200');
  const profileData = profileRes.data?.data || profileRes.data;
  assert.strictEqual(profileData.account, targetUser.account, '个人资料账号对齐一致');
  logPass('新密码会话凭证成功穿透受保护业务端点 (/api/auth/profile)');

  // 8. 安全回滚：将员工密码恢复为初始默认密码 123456
  const revertRes = await request(`/api/system/users/${targetUser.id}/password`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ password: '123456' }),
  });
  assert.strictEqual(revertRes.status, 200, '复原密码接口必须返回 200');
  const checkRevert = await login(targetUser.account, '123456');
  assert.ok(checkRevert.token, '复原后初始密码 123456 恢复可用');
  logPass('测试环境安全复原：员工密码已平滑还原为 [123456]');

  console.log('\n================================================================================');
  console.log(`🎉 全部 ${passed}/${passed} 项管理员改密与真实登录验真断言 100% 成功通过！`);
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
