/**
 * 专项测试：员工管理接口越权防护（校长提权、跨校区操作、改超管账号）
 *
 * 运行方式: PORT=<端口> node test-user-management-authz.js
 * 所有写操作只针对本脚本创建的 authz_* 账号，结束时由超管清理。
 * 依赖种子数据：超管 donghaichao / 123456，以及至少两个校区。
 */

const http = require('http');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const SUFFIX = Date.now().toString(36);
const PASSWORD = '123456';

let passed = 0;
const failures = [];

function check(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failures.push(message);
    console.error(`  ❌ ${message}`);
  }
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            // 非 JSON 响应按原文返回
          }
          const data = parsed && typeof parsed === 'object' && parsed.data !== undefined ? parsed.data : parsed;
          resolve({ status: res.statusCode, data });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(account, password = PASSWORD) {
  const res = await request('POST', '/api/auth/login', { account, password });
  return res.status === 200 || res.status === 201 ? res.data.accessToken || res.data.token : null;
}

async function runTests() {
  console.log(`🛡️  员工管理接口越权测试 (端口 ${PORT})\n`);

  const superToken = await login('donghaichao');
  if (!superToken) throw new Error('超管 donghaichao 登录失败，请确认运行在种子库上');

  const campuses = (await request('GET', '/api/system/campuses', null, superToken)).data;
  if (!Array.isArray(campuses) || campuses.length < 2) throw new Error('需要至少两个校区的种子库');
  const campusA = campuses[0];
  const campusB = campuses[1];

  const roles = (await request('GET', '/api/system/roles', null, superToken)).data;
  const roleOf = (code) => {
    const role = roles.find((r) => r.code === code);
    if (!role) throw new Error(`种子库缺少角色 ${code}`);
    return role;
  };
  const superRole = roleOf('super_admin');
  const principalRole = roleOf('principal');
  const teacherRole = roleOf('teacher');

  const createdUserIds = [];
  let allScopeRoleId;
  let seq = 0;

  /** 由超管创建一个测试账号，返回其 id 和账号名 */
  async function fixture(campus, role, extra = {}) {
    const account = `authz_${SUFFIX}_${++seq}`;
    const res = await request(
      'POST',
      '/api/system/users',
      { account, realName: account, campusId: campus.id, roleId: role.id, password: PASSWORD, ...extra },
      superToken,
    );
    if (res.status !== 201 && res.status !== 200) throw new Error(`创建测试账号失败: ${JSON.stringify(res.data)}`);
    createdUserIds.push(res.data.id);
    return { id: res.data.id, account };
  }

  /** 以超管视角读取账号当前状态，用于确认被拒绝的请求没有落库 */
  async function readUser(account) {
    const res = await request('GET', `/api/system/users?keyword=${account}`, null, superToken);
    return res.data.find((u) => u.account === account);
  }

  try {
    const allScopeRes = await request(
      'POST',
      '/api/system/roles',
      { code: `authz_all_${SUFFIX}`, name: `authz_all_${SUFFIX}`, dataScope: 'all' },
      superToken,
    );
    if (allScopeRes.status !== 201 && allScopeRes.status !== 200) {
      throw new Error(`创建全校区测试角色失败: ${JSON.stringify(allScopeRes.data)}`);
    }
    allScopeRoleId = allScopeRes.data.id;

    const principal = await fixture(campusA, principalRole);
    const principalToken = await login(principal.account);

    /** 把校长还原成初始状态，避免未修复时一次提权影响后续用例 */
    const restorePrincipal = () =>
      request(
        'PUT',
        `/api/system/users/${principal.id}`,
        { roleId: principalRole.id, campusId: campusA.id, dataScope: null },
        superToken,
      );

    console.log('--- 1. 校长提权 ---');

    let res = await request('PUT', `/api/system/users/${principal.id}`, { roleId: superRole.id }, principalToken);
    check(res.status === 403, `校长把自己提为超管（按角色 ID）应返回 403，实际 ${res.status}`);
    check((await readUser(principal.account)).roleId === principalRole.id, '校长自提超管被拒后角色未变');
    await restorePrincipal();

    res = await request('PUT', `/api/system/users/${principal.id}`, { roleId: 'super_admin' }, principalToken);
    check(res.status === 403, `校长把自己提为超管（按角色编码）应返回 403，实际 ${res.status}`);
    await restorePrincipal();

    res = await request('PUT', `/api/system/users/${principal.id}`, { dataScope: 'all' }, principalToken);
    check(res.status === 403, `校长把自己的数据范围提到全校区应返回 403，实际 ${res.status}`);
    await restorePrincipal();

    const promoteTarget = await fixture(campusA, teacherRole);
    res = await request('PUT', `/api/system/users/${promoteTarget.id}`, { roleId: superRole.id }, principalToken);
    check(res.status === 403, `校长把本校员工提为超管应返回 403，实际 ${res.status}`);
    check((await readUser(promoteTarget.account)).roleId === teacherRole.id, '本校员工提超管被拒后角色未变');

    const scopeTarget = await fixture(campusA, teacherRole);
    res = await request('PUT', `/api/system/users/${scopeTarget.id}`, { dataScope: 'all' }, principalToken);
    check(res.status === 403, `校长把本校员工数据范围提到全校区应返回 403，实际 ${res.status}`);

    const roleScopeTarget = await fixture(campusA, teacherRole);
    res = await request('PUT', `/api/system/users/${roleScopeTarget.id}`, { roleId: allScopeRoleId }, principalToken);
    check(res.status === 403, `校长授予全校区范围的普通角色应返回 403，实际 ${res.status}`);

    res = await request('PUT', `/api/system/users/${scopeTarget.id}`, { dataScope: 'ALL' }, principalToken);
    check(res.status === 400, `校长写入非法数据范围应返回 400，实际 ${res.status}`);

    // 持有全校区角色的账号在读接口上等同全校区，个人覆写无法压低
    const inheritTarget = await fixture(campusA, { id: allScopeRoleId }, { dataScope: 'self' });
    res = await request('PUT', `/api/system/users/${inheritTarget.id}`, { realName: '改名' }, principalToken);
    check(res.status === 403, `校长修改持有全校区角色的账号应返回 403，实际 ${res.status}`);

    for (const [label, extra] of [
      ['超管角色', { roleId: superRole.id }],
      ['全校区数据范围', { roleId: teacherRole.id, dataScope: 'all' }],
    ]) {
      const account = `authz_${SUFFIX}_new_${++seq}`;
      res = await request(
        'POST',
        '/api/system/users',
        { account, realName: account, campusId: campusA.id, roleId: teacherRole.id, ...extra },
        principalToken,
      );
      if (res.data && res.data.id) createdUserIds.push(res.data.id);
      check(res.status === 403, `校长新建${label}账号应返回 403，实际 ${res.status}`);
      check(!(await readUser(account)), `校长新建${label}账号被拒后未落库`);
    }

    console.log('\n--- 2. 操作超级管理员账号 ---');

    const superTarget = await fixture(campusA, superRole);

    res = await request('PUT', `/api/system/users/${superTarget.id}`, { realName: '被改名' }, principalToken);
    check(res.status === 403, `校长修改超管资料应返回 403，实际 ${res.status}`);
    check((await readUser(superTarget.account)).realName === superTarget.account, '超管资料未被修改');

    res = await request('PUT', `/api/system/users/${superTarget.id}`, { roleId: teacherRole.id }, principalToken);
    check(res.status === 403, `校长撤销超管角色应返回 403，实际 ${res.status}`);
    check((await readUser(superTarget.account)).roleId === superRole.id, '超管角色未被撤销');

    res = await request('PATCH', `/api/system/users/${superTarget.id}/password`, { password: 'hacked999' }, principalToken);
    check(res.status === 403, `校长重置超管密码应返回 403，实际 ${res.status}`);
    check(Boolean(await login(superTarget.account)), '超管原密码仍可登录');

    res = await request('PATCH', `/api/system/users/${superTarget.id}/status`, { status: 'disabled' }, principalToken);
    check(res.status === 403, `校长停用超管应返回 403，实际 ${res.status}`);
    check((await readUser(superTarget.account)).status === 'active', '超管账号未被停用');

    res = await request('DELETE', `/api/system/users/${superTarget.id}`, null, principalToken);
    check(res.status === 403, `校长删除超管应返回 403，实际 ${res.status}`);
    check(Boolean(await readUser(superTarget.account)), '超管账号未被删除');

    // 数据范围为 all 的账号在读接口上等同超管，重置其密码同样能接管全校区权限
    const allScopeUser = await fixture(campusA, teacherRole, { dataScope: 'all' });
    res = await request('PATCH', `/api/system/users/${allScopeUser.id}/password`, { password: 'hacked999' }, principalToken);
    check(res.status === 403, `校长重置全校区账号密码应返回 403，实际 ${res.status}`);
    check(Boolean(await login(allScopeUser.account)), '全校区账号原密码仍可登录');

    console.log('\n--- 3. 跨校区操作 ---');

    const otherCampusUser = await fixture(campusB, teacherRole);

    res = await request('PUT', `/api/system/users/${otherCampusUser.id}`, { realName: '被改名' }, principalToken);
    check(res.status === 403, `校长修改其他校区员工应返回 403，实际 ${res.status}`);
    check((await readUser(otherCampusUser.account)).realName === otherCampusUser.account, '其他校区员工资料未被修改');

    res = await request('PATCH', `/api/system/users/${otherCampusUser.id}/password`, { password: 'hacked999' }, principalToken);
    check(res.status === 403, `校长重置其他校区员工密码应返回 403，实际 ${res.status}`);
    check(Boolean(await login(otherCampusUser.account)), '其他校区员工原密码仍可登录');

    res = await request('PATCH', `/api/system/users/${otherCampusUser.id}/status`, { status: 'disabled' }, principalToken);
    check(res.status === 403, `校长停用其他校区员工应返回 403，实际 ${res.status}`);
    check((await readUser(otherCampusUser.account)).status === 'active', '其他校区员工未被停用');

    res = await request('DELETE', `/api/system/users/${otherCampusUser.id}`, null, principalToken);
    check(res.status === 403, `校长删除其他校区员工应返回 403，实际 ${res.status}`);
    check(Boolean(await readUser(otherCampusUser.account)), '其他校区员工未被删除');

    const moveTarget = await fixture(campusA, teacherRole);
    res = await request('PUT', `/api/system/users/${moveTarget.id}`, { campusId: campusB.id }, principalToken);
    check(res.status === 403, `校长把本校员工移到其他校区应返回 403，实际 ${res.status}`);
    check((await readUser(moveTarget.account)).campusId === campusA.id, '本校员工校区未变');

    res = await request('PUT', `/api/system/users/${principal.id}`, { campusId: campusB.id }, principalToken);
    check(res.status === 403, `校长把自己移到其他校区应返回 403，实际 ${res.status}`);
    await restorePrincipal();

    if (campusB.orgNodeId) {
      res = await request('PUT', `/api/system/users/${moveTarget.id}`, { orgNodeId: campusB.orgNodeId }, principalToken);
      check(res.status === 403, `校长把本校员工挂到其他校区的组织节点应返回 403，实际 ${res.status}`);
    }

    const newAccount = `authz_${SUFFIX}_new_${++seq}`;
    res = await request(
      'POST',
      '/api/system/users',
      { account: newAccount, realName: newAccount, campusId: campusB.id, roleId: teacherRole.id },
      principalToken,
    );
    if (res.data && res.data.id) createdUserIds.push(res.data.id);
    check(res.status === 403, `校长在其他校区新建员工应返回 403，实际 ${res.status}`);
    check(!(await readUser(newAccount)), '其他校区新建被拒后未落库');

    console.log('\n--- 4. 校长的本校正常操作不受影响 ---');
    await restorePrincipal();

    const staff = await fixture(campusA, teacherRole);

    // 与前端保存抽屉的提交结构一致：角色、校区、数据范围每次都会带上
    const listed = await readUser(staff.account);
    res = await request(
      'PUT',
      `/api/system/users/${staff.id}`,
      { roleId: listed.roleId, campusId: listed.campusId, dataScope: listed.dataScope, realName: '本校改名' },
      principalToken,
    );
    check(res.status === 200, `校长按前端结构保存本校员工应成功，实际 ${res.status}`);
    check((await readUser(staff.account)).realName === '本校改名', '本校员工改名已落库');

    res = await request('PUT', `/api/system/users/${staff.id}`, { dataScope: 'campus' }, principalToken);
    check(res.status === 200, `校长把本校员工数据范围设为本校区应成功，实际 ${res.status}`);

    res = await request('PUT', `/api/system/users/${staff.id}`, { roleId: principalRole.id }, principalToken);
    check(res.status === 200, `校长授予不超出自身范围的角色应成功，实际 ${res.status}`);

    if (campusA.orgNodeId) {
      res = await request('PUT', `/api/system/users/${staff.id}`, { orgNodeId: campusA.orgNodeId }, principalToken);
      check(res.status === 200, `校长把员工挂到本校组织节点应成功，实际 ${res.status}`);
    }

    res = await request('PATCH', `/api/system/users/${staff.id}/password`, { password: 'reset999' }, principalToken);
    check(res.status === 200, `校长重置本校员工密码应成功，实际 ${res.status}`);
    check(Boolean(await login(staff.account, 'reset999')), '本校员工可用新密码登录');

    res = await request('PATCH', `/api/system/users/${principal.id}/password`, { password: PASSWORD }, principalToken);
    check(res.status === 200, `校长修改自己的密码应成功，实际 ${res.status}`);

    res = await request('PATCH', `/api/system/users/${staff.id}/status`, { status: 'disabled' }, principalToken);
    check(res.status === 200, `校长停用本校员工应成功，实际 ${res.status}`);

    const ownAccount = `authz_${SUFFIX}_new_${++seq}`;
    res = await request(
      'POST',
      '/api/system/users',
      { account: ownAccount, realName: ownAccount, campusId: campusA.id, roleId: teacherRole.id, dataScope: 'self' },
      principalToken,
    );
    check(res.status === 201, `校长在本校新建员工应成功，实际 ${res.status}`);
    if (res.data && res.data.id) {
      createdUserIds.push(res.data.id);
      const delRes = await request('DELETE', `/api/system/users/${res.data.id}`, null, principalToken);
      check(delRes.status === 200, `校长删除本校员工应成功，实际 ${delRes.status}`);
      if (delRes.status === 200) createdUserIds.pop();
    }

    console.log('\n--- 5. 全校区范围的非超管账号 ---');

    const groupOperator = await fixture(campusA, principalRole, { dataScope: 'all' });
    const groupToken = await login(groupOperator.account);

    res = await request('PUT', `/api/system/users/${otherCampusUser.id}`, { realName: '集团改名' }, groupToken);
    check(res.status === 200, `全校区账号修改其他校区员工应成功，实际 ${res.status}`);

    res = await request('PUT', `/api/system/users/${otherCampusUser.id}`, { roleId: superRole.id }, groupToken);
    check(res.status === 403, `全校区账号授予超管角色应返回 403，实际 ${res.status}`);

    res = await request('PATCH', `/api/system/users/${superTarget.id}/password`, { password: 'hacked999' }, groupToken);
    check(res.status === 403, `全校区账号重置超管密码应返回 403，实际 ${res.status}`);

    res = await request('PUT', `/api/system/users/${groupOperator.id}`, { roleId: superRole.id }, groupToken);
    check(res.status === 403, `全校区账号自提超管应返回 403，实际 ${res.status}`);

    console.log('\n--- 6. 超级管理员操作不变 ---');

    const superOpTarget = await fixture(campusB, teacherRole);

    res = await request(
      'PUT',
      `/api/system/users/${superOpTarget.id}`,
      { roleId: superRole.id, campusId: campusA.id, dataScope: 'all' },
      superToken,
    );
    check(res.status === 200, `超管跨校区授予超管角色和全校区范围应成功，实际 ${res.status}`);
    const promoted = await readUser(superOpTarget.account);
    check(
      promoted.roleId === superRole.id && promoted.campusId === campusA.id && promoted.dataScope === 'all',
      '超管授予的角色、校区、数据范围均已落库',
    );

    res = await request('PATCH', `/api/system/users/${superOpTarget.id}/password`, { password: 'reset999' }, superToken);
    check(res.status === 200, `超管重置其他超管密码应成功，实际 ${res.status}`);

    res = await request('PATCH', `/api/system/users/${superOpTarget.id}/status`, { status: 'disabled' }, superToken);
    check(res.status === 200, `超管停用其他超管应成功，实际 ${res.status}`);

    const superCreateAccount = `authz_${SUFFIX}_new_${++seq}`;
    res = await request(
      'POST',
      '/api/system/users',
      { account: superCreateAccount, realName: superCreateAccount, campusId: campusB.id, roleId: superRole.id },
      superToken,
    );
    check(res.status === 201, `超管在任意校区新建超管应成功，实际 ${res.status}`);
    if (res.data && res.data.id) createdUserIds.push(res.data.id);
  } finally {
    for (const id of createdUserIds) {
      await request('DELETE', `/api/system/users/${id}`, null, superToken);
    }
    if (allScopeRoleId) {
      await request('DELETE', `/api/system/roles/${allScopeRoleId}`, null, superToken);
    }
  }

  console.log(`\n结果: ${passed} 通过, ${failures.length} 失败`);
  if (failures.length > 0) {
    console.error(failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('测试执行异常:', err);
  process.exit(1);
});
