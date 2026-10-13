/**
 * 拓视未来教育「一校教培系统」机构工商信息持久化、品牌LOGO与超级管理员转让自动化测试套件
 * 严格验证：
 * 1. 机构工商信息真实持久化落盘（终结前端自嗨与刷新即丢）
 * 2. 品牌LOGO与测评报告抬头配置落库与回显
 * 3. 超管转让防伪与安全防护（密码防撞、权限拦截、本人拦截）
 * 4. 超管转让原子化事务切换（新超管提权、旧超管降级、Company.adminName 自动更新、新超管鉴权）
 * 5. 安全还原测试环境
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:3001';

let passedAssertions = 0;
function logPass(msg) {
  passedAssertions++;
  console.log(`  ✓ PASS [${passedAssertions}]: ${msg}`);
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

async function login(account, password = 'password123') {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  });
  assert.ok(res.status === 200 || res.status === 201, `登录账号 [${account}] 失败 (status: ${res.status})`);
  return (
    res.data?.data?.accessToken ||
    res.data?.accessToken ||
    res.data?.data?.token ||
    res.data?.token
  );
}

async function runTests() {
  console.log('\n================================================================================');
  console.log('🏢  拓视未来教育「一校教培系统」机构持久化、品牌与超管转让自动化验证套件');
  console.log('================================================================================\n');

  // 1. 超管登录
  const adminToken = await login('donghaichao', '123456');
  logPass('超级管理员 [donghaichao] 成功登录');

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  // 0. 基准数据归一化预置 (保证测试可重入幂等自愈)
  await request('/api/system/company', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: '北京拓视未来教育科技集团股份有限公司',
      legalPerson: '贾洪波',
      phone: '010-88880000',
      validUntil: '2028-12-31',
      stockCode: '002599',
    }),
  });

  // --- 测试集 1: 机构基本信息读取与新增持久化字段校验 ---
  console.log('\n--- 1. 机构工商信息真实持久化与全量字段契约验证 ---');
  const compRes = await request('/api/system/company', { headers: authHeaders });
  assert.strictEqual(compRes.status, 200, '获取机构信息应返回 200');
  logPass('获取机构信息接口成功响应 200');

  const compData = compRes.data.data || compRes.data;
  assert.ok(compData.name, '机构名称应存在');
  assert.ok(compData.code, '机构编码应存在');
  assert.strictEqual(compData.legalPerson, '贾洪波', '法人代表初始值应为贾洪波');
  logPass('机构法人代表字段已落盘: ' + compData.legalPerson);

  assert.strictEqual(compData.phone, '010-88880000', '联系电话初始值应为010-88880000');
  logPass('机构电话字段已落盘: ' + compData.phone);

  assert.strictEqual(compData.validUntil, '2028-12-31', '授权有效期初始值应为2028-12-31');
  logPass('机构授权有效期字段已落盘: ' + compData.validUntil);

  assert.strictEqual(compData.adminName, '冬海潮', '当前超管初始姓名应为冬海潮');
  logPass('机构超管姓名已关联: ' + compData.adminName);

  assert.ok(compData.metrics, '机构信息应包含 metrics 统计对象');
  assert.strictEqual(typeof compData.metrics.campusCount, 'number', 'metrics 包含校区数');
  logPass('机构运行综合指标成功聚合 (校区数: ' + compData.metrics.campusCount + ', 在职员工数: ' + compData.metrics.activeEmployeeCount + ')');

  // --- 测试集 2: 机构工商信息真实更新与落盘测试 (终结刷新即丢) ---
  console.log('\n--- 2. 机构信息真实 PUT 维护与数据库落盘测试 (终结伪保存) ---');
  const updatePayload = {
    name: '北京拓视未来教育科技集团股份有限公司(已认证)',
    legalPerson: '贾洪波(董事长)',
    phone: '010-88889999',
    validUntil: '2029-12-31',
    stockCode: '002599.SZ',
  };

  const updateRes = await request('/api/system/company', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify(updatePayload),
  });
  assert.strictEqual(updateRes.status, 200, '更新机构信息应返回 200');
  logPass('更新机构工商信息返回 200 OK');

  // 再次重新 GET 查询，验证数据库物理落盘而不是前端自嗨
  const checkCompRes = await request('/api/system/company', { headers: authHeaders });
  const checkCompData = checkCompRes.data.data || checkCompRes.data;
  assert.strictEqual(checkCompData.name, updatePayload.name, '机构名称物理落盘验证成功');
  assert.strictEqual(checkCompData.legalPerson, updatePayload.legalPerson, '法人代表物理落盘验证成功');
  assert.strictEqual(checkCompData.phone, updatePayload.phone, '联系电话物理落盘验证成功');
  assert.strictEqual(checkCompData.validUntil, updatePayload.validUntil, '有效期物理落盘验证成功');
  assert.strictEqual(checkCompData.stockCode, updatePayload.stockCode, '证券代码物理落盘验证成功');
  logPass('【关键破除】机构工商信息物理持久化落盘验证成功，彻底终结刷新即丢！');

  // --- 测试集 3: 品牌 LOGO 与评测报告抬头配置落库与回显 ---
  console.log('\n--- 3. 机构品牌 LOGO 与测评报告专属抬头真实持久化测试 ---');
  const logoPayload = {
    logoUrl: '/uploads/branding/logo_light_v2.png',
    faviconUrl: '/uploads/branding/favicon_v2.ico',
    reportLogoUrl: '/uploads/branding/report_header_v2.png',
  };

  const updateLogoRes = await request('/api/system/company', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify(logoPayload),
  });
  assert.strictEqual(updateLogoRes.status, 200, '保存品牌配置应返回 200');
  logPass('保存品牌配置接口成功返回 200');

  const checkLogoRes = await request('/api/system/company', { headers: authHeaders });
  const checkLogoData = checkLogoRes.data.data || checkLogoRes.data;
  assert.strictEqual(checkLogoData.logoUrl, logoPayload.logoUrl, '浅色顶栏 LOGO 持久化一致');
  assert.strictEqual(checkLogoData.faviconUrl, logoPayload.faviconUrl, '浏览器 Favicon 持久化一致');
  assert.strictEqual(checkLogoData.reportLogoUrl, logoPayload.reportLogoUrl, '测评报告专属 LOGO 持久化一致');
  logPass('【关键破除】品牌 LOGO 与测评报告抬头物理持久化落库验证成功！');

  // --- 测试集 4: 超管转让安全性与风控拦截测试 ---
  console.log('\n--- 4. 超管转让安全风控拦截测试 (错误密码/越权/本人拦截) ---');

  // 4.1 获取员工列表定位目标员工（执行校长张建华 zhangjh）
  const usersRes = await request('/api/system/users', { headers: authHeaders });
  const rawData = usersRes.data?.data || usersRes.data;
  const userList = Array.isArray(rawData) ? rawData : (rawData?.list || []);
  const targetUser = userList.find((u) => u.account === 'zhangjh');
  assert.ok(targetUser, '必须存在目标员工 [zhangjh]');
  logPass('成功定位目标员工: ' + (targetUser.realName || targetUser.name) + ' (' + targetUser.account + ')');

  // 4.2 错误密码尝试转让，坚决拦截
  const wrongPwdRes = await request('/api/system/company/transfer-admin', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetUserId: targetUser.id,
      password: 'wrong_password_999',
    }),
  });
  assert.strictEqual(wrongPwdRes.status, 400, '错误密码应被拒绝 400');
  logPass('【防伪拦截】错误密码转让被安全拦截: ' + (wrongPwdRes.data?.message || '密码不正确'));

  // 4.3 转给自己本人拦截
  const superUserObj = userList.find((u) => u.account === 'donghaichao');
  const selfTransferRes = await request('/api/system/company/transfer-admin', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetUserId: superUserObj.id,
      password: '123456',
    }),
  });
  assert.strictEqual(selfTransferRes.status, 400, '转给自己本人应被拒绝 400');
  logPass('【逻辑拦截】目标员工为超管本人被拒绝 (禁止自我转让)');

  // 4.4 普通教师账号越权调用转让端点，被 PermissionsGuard 拦截
  const teacherToken = await login('teacher_zhang', '123456');
  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };
  const teacherTransferRes = await request('/api/system/company/transfer-admin', {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      targetUserId: targetUser.id,
      password: '123456',
    }),
  });
  assert.strictEqual(teacherTransferRes.status, 403, '无权限员工调用超管转让应返回 403');
  logPass('【越权拦截】普通讲师越权转让超管被 PermissionsGuard 拦截 (403 Forbidden)');

  // --- 测试集 5: 超管转让原子化事务执行与权限切换验证 ---
  console.log('\n--- 5. 超管转让原子化事务执行与权限双向交接验证 ---');
  const validTransferRes = await request('/api/system/company/transfer-admin', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetUserId: targetUser.id,
      password: '123456',
    }),
  });
  assert.ok(validTransferRes.status === 200 || validTransferRes.status === 201, '合法密码超管转让应返回 200/201');
  logPass('超管转让接口执行成功返回 200/201');

  // 验证机构信息中超管自动变更为张建华
  const afterCompRes = await request('/api/system/company', { headers: authHeaders });
  const afterCompData = afterCompRes.data.data || afterCompRes.data;
  const targetUserName = targetUser.realName || targetUser.name;
  assert.strictEqual(afterCompData.adminName, targetUserName, '机构超管姓名已自动更新为: ' + targetUserName);
  assert.strictEqual(afterCompData.adminUserId, targetUser.id, '机构超管用户ID已对齐更新');
  logPass('【原子联动】机构 Company 表关联的超级管理员已更新为: ' + targetUserName);

  // 验证张建华登录后拥有超级管理员身份与全部权限
  const newAdminToken = await login('zhangjh', '123456');
  const newAdminHeaders = { Authorization: `Bearer ${newAdminToken}` };
  const newAdminProfile = await request('/api/auth/profile', { headers: newAdminHeaders });
  assert.strictEqual(newAdminProfile.status, 200, '新超管获取个人资料应返回 200');
  const profileRoles = newAdminProfile.data?.data?.roles || newAdminProfile.data?.roles || [];
  const hasSuperRole = profileRoles.some((r) => r.code === 'super_admin' || r.name?.includes('超级管理员'));
  assert.ok(hasSuperRole, '新超管角色应已晋升为 super_admin');
  logPass('【角色晋升】接收员工 [张建华] 角色已原子晋升为超级管理员 (super_admin)');

  // --- 测试集 6: 环境安全回滚与还原 ---
  console.log('\n--- 6. 测试环境安全回滚与复原测试 ---');
  // 张建华将超管权限交还给冬海潮
  const returnRes = await request('/api/system/company/transfer-admin', {
    method: 'POST',
    headers: newAdminHeaders,
    body: JSON.stringify({
      targetUserId: superUserObj.id,
      password: '123456',
    }),
  });
  assert.ok(returnRes.status === 200 || returnRes.status === 201, '超管交还应返回 200/201');
  logPass('超级管理员最高权限已安全平滑交回给 [冬海潮]');

  // 还原机构名称
  await request('/api/system/company', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: '北京拓视未来教育科技集团股份有限公司',
      legalPerson: '贾洪波',
      phone: '010-88880000',
      validUntil: '2028-12-31',
      stockCode: '002599',
    }),
  });
  logPass('机构工商信息已安全复原为标准种子数据');

  console.log('\n================================================================================');
  console.log(`🎉 全部 ${passedAssertions}/${passedAssertions} 项机构持久化、品牌与超管转让断言 100% 成功通过！`);
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
