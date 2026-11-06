/**
 * 员工账号管理的越权回归：校长等非超管不能提权、不能跨校区、不能接管更高权限的账号。
 * 所有夹具都是临时创建的一次性账号和角色，结束后清理。
 * 需要后端已运行：PORT=3187 node test-staff-admin-boundary.js
 */
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = '123456';
const stamp = Date.now().toString(36);

let passed = 0;
const failures = [];

function check(condition, desc, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${desc}`);
  } else {
    failures.push(desc);
    console.error(`  ✗ ${desc}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  }
}

async function api(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, data: parsed && parsed.data };
}

async function login(account, password = PASSWORD) {
  const res = await api(null, 'POST', '/api/auth/login', { account, password });
  return res.data && res.data.accessToken;
}

async function listUsers(token, keyword) {
  const res = await api(token, 'GET', `/api/system/users?keyword=${encodeURIComponent(keyword)}`);
  return Array.isArray(res.data) ? res.data : res.data.list;
}

let phoneSeq = 0;
function nextPhone() {
  phoneSeq++;
  return `139${String((Date.now() + phoneSeq) % 100000000).padStart(8, '0')}`;
}

async function main() {
  const adminToken = await login('donghaichao');
  if (!adminToken) throw new Error('超管 donghaichao 登录失败，请使用种子库运行');

  const createdUsers = [];
  const createdRoles = [];

  const rolesRes = await api(adminToken, 'GET', '/api/system/roles');
  const roleByCode = Object.fromEntries(rolesRes.data.map((r) => [r.code, r]));
  const campuses = (await api(adminToken, 'GET', '/api/system/campuses')).data;
  const rootUser = (await listUsers(adminToken, 'donghaichao')).find((u) => u.account === 'donghaichao');
  const campusA = campuses[0];
  const campusB = campuses[1];
  if (!campusB) throw new Error('需要至少两个校区，请使用种子库运行');

  async function fixtureUser(suffix, campusId, roleId, dataScope) {
    const account = `bnd_${suffix}_${stamp}`;
    const res = await api(adminToken, 'POST', '/api/system/users', {
      account,
      realName: account,
      phone: nextPhone(),
      campusId,
      roleId,
      dataScope,
    });
    if (![200, 201].includes(res.status)) {
      throw new Error(`夹具 ${account} 创建失败: ${JSON.stringify(res.body)}`);
    }
    createdUsers.push(res.data.id);
    return { id: res.data.id, account };
  }

  async function fixtureRole(suffix, permissionCodes) {
    const role = await api(adminToken, 'POST', '/api/system/roles', {
      code: `bnd_${suffix}_${stamp}`,
      name: `bnd_${suffix}_${stamp}`,
      dataScope: 'campus',
    });
    createdRoles.push(role.data.id);
    await api(adminToken, 'POST', `/api/system/roles/${role.data.id}/permissions`, { permissionCodes });
    return role.data;
  }

  try {
    const principalRole = roleByCode.principal;
    const teacherRole = roleByCode.teacher;
    const superRole = roleByCode.super_admin;
    const higherRole = await fixtureRole('higher', ['system:role:view']);
    const editOnlyRole = await fixtureRole('editonly', ['system:user:view', 'system:user:edit']);

    const principal = await fixtureUser('p', campusA.id, principalRole.id, 'campus');
    const peer = await fixtureUser('peer', campusA.id, principalRole.id, 'campus');
    const teacher = await fixtureUser('t', campusA.id, teacherRole.id, 'self');
    const other = await fixtureUser('other', campusB.id, teacherRole.id, 'self');
    const allScope = await fixtureUser('all', campusA.id, teacherRole.id, 'all');
    const higher = await fixtureUser('higher', campusA.id, higherRole.id);
    const editor = await fixtureUser('editor', campusA.id, editOnlyRole.id, 'campus');
    const editorPeer = await fixtureUser('editorpeer', campusA.id, editOnlyRole.id, 'campus');

    const pToken = await login(principal.account);

    console.log('\n[1] 校长不能修改自己的角色和数据范围');
    for (const roleId of [superRole.id, 'super_admin']) {
      const res = await api(pToken, 'PUT', `/api/system/users/${principal.id}`, { roleId });
      check(res.status === 403, `把自己改成超管被拒 (roleId=${roleId === superRole.id ? 'id' : 'code'})`, res.status);
    }
    let res = await api(pToken, 'PUT', `/api/system/users/${principal.id}`, { dataScope: 'all' });
    check(res.status === 403, '把自己的数据范围改成 all 被拒', res.status);
    res = await api(pToken, 'PUT', `/api/system/users/${principal.id}`, { dataScope: 'self' });
    check(res.status === 403, '降低自己的数据范围同样被拒', res.status);
    res = await api(pToken, 'PUT', `/api/system/users/${principal.id}`, { roleId: teacherRole.id });
    check(res.status === 403, '把自己换成低权限角色同样被拒', res.status);
    res = await api(pToken, 'PUT', `/api/system/users/${principal.id}`, { campusId: campusB.id });
    check(res.status === 403, '把自己调到其他校区被拒', res.status);

    const relogin = await login(principal.account);
    res = await api(relogin, 'GET', '/api/system/org-tree');
    check(res.status === 403, '重新登录后仍不能访问组织架构接口', res.status);
    res = await api(relogin, 'GET', '/api/auth/profile');
    check(res.data && res.data.dataScope === 'campus', '重新登录后数据范围仍为 campus', res.data && res.data.dataScope);

    // 在未修复的后端上，上面的攻击会改掉校长身份；恢复后再测，避免后续用例因权限不足而假通过
    await api(adminToken, 'PUT', `/api/system/users/${principal.id}`, {
      roleId: principalRole.id,
      campusId: campusA.id,
      dataScope: 'campus',
    });

    console.log('\n[2] 校长编辑自己的资料不受影响（前端抽屉会带上原值）');
    res = await api(pToken, 'PUT', `/api/system/users/${principal.id}`, {
      roleId: principalRole.id,
      campusId: campusA.id,
      dataScope: 'campus',
      phone: nextPhone(),
    });
    check(res.status === 200, '带原角色、原校区、原范围保存手机号成功', res.body);

    console.log('\n[3] 校长不能给下属授予超出自身的角色和范围');
    res = await api(pToken, 'PUT', `/api/system/users/${teacher.id}`, { roleId: superRole.id });
    check(res.status === 403, '授予超管角色被拒', res.status);
    res = await api(pToken, 'PUT', `/api/system/users/${teacher.id}`, { dataScope: 'all' });
    check(res.status === 403, '授予 all 数据范围被拒', res.status);
    res = await api(pToken, 'PUT', `/api/system/users/${teacher.id}`, { roleId: higherRole.id });
    check(res.status === 403, '分配权限超出自身的自定义角色被拒', res.status);
    res = await api(pToken, 'PUT', `/api/system/users/${teacher.id}`, { campusId: campusB.id });
    check(res.status === 403, '把下属调到其他校区被拒', res.status);
    if (campusB.orgNodeId) {
      res = await api(pToken, 'PUT', `/api/system/users/${teacher.id}`, { orgNodeId: campusB.orgNodeId });
      check(res.status === 403, '把下属挂到其他校区的组织节点被拒', res.status);
    }

    console.log('\n[4] 新建员工同样受限');
    const createCases = [
      ['超管角色', { campusId: campusA.id, roleId: superRole.id }],
      ['all 数据范围', { campusId: campusA.id, roleId: teacherRole.id, dataScope: 'all' }],
      ['其他校区', { campusId: campusB.id, roleId: teacherRole.id }],
      ['权限超出自身的角色', { campusId: campusA.id, roleId: higherRole.id }],
    ];
    for (const [label, payload] of createCases) {
      const account = `bnd_new_${createCases.findIndex((c) => c[0] === label)}_${stamp}`;
      res = await api(pToken, 'POST', '/api/system/users', { account, realName: account, ...payload });
      check(res.status === 403, `新建员工：${label}被拒`, res.status);
      if (res.data && res.data.id) createdUsers.push(res.data.id);
      const found = await listUsers(adminToken, account);
      check(found.length === 0, `新建员工：${label}未留下账号`, found.length);
    }

    console.log('\n[5] 校长不能操作其他校区、超管和更高权限的账号');
    // 针对根超管的探测都不改变数据：即使后端未修复（如本地跑着旧代码），也不会锁死超管
    const protectedTargets = [
      ['其他校区员工', other.id, nextPhone(), 'disabled'],
      ['超管', rootUser.id, rootUser.phone, 'active'],
      ['数据范围为 all 的员工', allScope.id, nextPhone(), 'disabled'],
      ['权限超出自身的员工', higher.id, nextPhone(), 'disabled'],
    ];
    for (const [label, id, phone, status] of protectedTargets) {
      res = await api(pToken, 'PUT', `/api/system/users/${id}`, { phone });
      check(res.status === 403, `${label}：编辑被拒`, res.status);
      res = await api(pToken, 'PATCH', `/api/system/users/${id}/password`, { password: PASSWORD });
      check(res.status === 403, `${label}：重置密码被拒`, res.status);
      res = await api(pToken, 'PATCH', `/api/system/users/${id}/status`, { status });
      check(res.status === 403, `${label}：启停被拒`, res.status);
      res = await api(pToken, 'DELETE', `/api/system/users/${id}`);
      check(res.status === 403, `${label}：删除被拒`, res.status);
    }

    console.log('\n[6] 校长不能调用转让超管接口');
    // 故意传错密码：修复后先判身份返回 403，未修复时返回 400，都不会真的转让
    res = await api(pToken, 'POST', '/api/system/company/transfer-admin', {
      targetUserId: teacher.id,
      password: `wrong-${stamp}`,
    });
    check(res.status === 403, '校长调用转让超管接口时先被身份校验拒绝', res.status);

    console.log('\n[7] PUT 不能绕过启停权限');
    const editorToken = await login(editor.account);
    res = await api(editorToken, 'PUT', `/api/system/users/${editorPeer.id}`, { status: 'disabled' });
    check(res.status === 403, '没有 system:user:status 时不能通过 PUT 停用员工', res.status);
    res = await api(editorToken, 'PUT', `/api/system/users/${editorPeer.id}`, { status: 'active', realName: editorPeer.account });
    check(res.status === 200, '状态不变时可以正常编辑', res.body);

    console.log('\n[8] 数据范围取值校验');
    res = await api(adminToken, 'PUT', `/api/system/users/${teacher.id}`, { dataScope: 'everything' });
    check(res.status === 400, '未知的数据范围被拒', res.status);

    console.log('\n[9] 校长在本校区的正常管理不受影响');
    const newAccount = `bnd_ok_${stamp}`;
    res = await api(pToken, 'POST', '/api/system/users', {
      account: newAccount,
      realName: newAccount,
      campusId: campusA.id,
      roleId: teacherRole.id,
      dataScope: 'self',
    });
    check([200, 201].includes(res.status), '新建本校区讲师成功', res.body);
    const newId = res.data && res.data.id;
    if (newId) createdUsers.push(newId);
    res = await api(pToken, 'PUT', `/api/system/users/${newId}`, { phone: nextPhone(), dataScope: 'campus' });
    check(res.status === 200, '编辑手机号并把范围调整为不超过自身成功', res.body);
    res = await api(pToken, 'PATCH', `/api/system/users/${newId}/password`, { password: PASSWORD });
    check(res.status === 200, '重置下属密码成功', res.body);
    res = await api(pToken, 'PATCH', `/api/system/users/${newId}/status`, { status: 'disabled' });
    check(res.status === 200, '停用下属成功', res.body);
    res = await api(pToken, 'PUT', `/api/system/users/${teacher.id}`, { roleId: principalRole.id, dataScope: 'campus' });
    check(res.status === 200, '任命同校区同级校长成功', res.body);
    res = await api(pToken, 'PATCH', `/api/system/users/${peer.id}/password`, { password: PASSWORD });
    check(res.status === 200, '管理同校区同级校长成功', res.body);
    res = await api(pToken, 'DELETE', `/api/system/users/${newId}`);
    check(res.status === 200, '删除下属成功', res.body);
    if (res.status === 200) createdUsers.splice(createdUsers.indexOf(newId), 1);

    console.log('\n[10] 超管不受这些限制');
    res = await api(adminToken, 'PUT', `/api/system/users/${other.id}`, { roleId: superRole.id, dataScope: 'all' });
    check(res.status === 200, '超管可跨校区授予超管角色和 all 范围', res.body);
    res = await api(adminToken, 'PUT', `/api/system/users/${other.id}`, { roleId: teacherRole.id, dataScope: 'self' });
    check(res.status === 200, '超管可撤销上述授权', res.body);
    res = await api(adminToken, 'PATCH', `/api/system/users/${other.id}/password`, { password: PASSWORD });
    check(res.status === 200, '超管可跨校区重置密码', res.body);
  } finally {
    for (const id of createdUsers) {
      await api(adminToken, 'PUT', `/api/system/users/${id}`, { roleId: roleByCode.teacher.id });
      const res = await api(adminToken, 'DELETE', `/api/system/users/${id}`);
      if (res.status !== 200) console.error(`清理账号失败 ${id}: ${JSON.stringify(res.body)}`);
    }
    for (const id of createdRoles) {
      const res = await api(adminToken, 'DELETE', `/api/system/roles/${id}`);
      if (res.status !== 200) console.error(`清理角色失败 ${id}: ${JSON.stringify(res.body)}`);
    }
  }

  console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('测试异常终止:', err);
  process.exit(1);
});
