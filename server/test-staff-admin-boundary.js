/**
 * 员工账号和角色管理的越权回归：校长等非超管不能提权、不能跨校区、不能接管更高权限的账号或角色。
 * 所有夹具都是临时创建的一次性账号和角色，结束后清理。
 * 需要后端已运行：PORT=3187 node test-staff-admin-boundary.js
 */
const { PORT } = require('./test-utils/target');
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

  async function fixtureRole(suffix, permissionCodes, dataScope = 'campus') {
    const role = await api(adminToken, 'POST', '/api/system/roles', {
      code: `bnd_${suffix}_${stamp}`,
      name: `bnd_${suffix}_${stamp}`,
      dataScope,
    });
    createdRoles.push(role.data.id);
    const assigned = await api(adminToken, 'POST', `/api/system/roles/${role.data.id}/permissions`, { permissionCodes });
    if (!assigned.data || assigned.data.assignedCount !== permissionCodes.length) {
      throw new Error(`夹具角色 ${suffix} 权限码不存在: ${JSON.stringify(assigned.body)}`);
    }
    return role.data;
  }

  async function fetchRole(id) {
    const list = await api(adminToken, 'GET', '/api/system/roles');
    return list.data.find((role) => role.id === id);
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

    console.log('\n[11] 角色管理员不能给自己持有的角色提权');
    const managerPerms = [
      'system:role:view',
      'system:role:add',
      'system:role:edit',
      'system:role:delete',
    ];
    const managerRole = await fixtureRole('rolemgr', managerPerms);
    const manager = await fixtureUser('rolemgr', campusA.id, managerRole.id);
    const selfScoped = await fixtureUser('rolemgrself', campusA.id, managerRole.id, 'self');
    const mToken = await login(manager.account);

    const selfAttacks = [
      ['加权限', 'POST', 'permissions', { permissionCodes: [...managerPerms, 'system:user:edit'] }],
      ['通配符全选', 'POST', 'permissions', { permissionCodes: ['*'] }],
      ['减权限', 'POST', 'permissions', { permissionCodes: ['system:role:view'] }],
      ['改数据范围为 all', 'PUT', '', { dataScope: 'all' }],
      ['改名称', 'PUT', '', { name: `renamed_${stamp}` }],
    ];
    for (const [label, method, sub, payload] of selfAttacks) {
      const path = `/api/system/roles/${managerRole.id}${sub ? `/${sub}` : ''}`;
      res = await api(mToken, method, path, payload);
      check(res.status === 403, `自己的角色：${label}被拒`, res.status);
    }
    res = await api(mToken, 'DELETE', `/api/system/roles/${managerRole.id}`);
    check(res.status === 403, '自己的角色：删除被拒', res.status);
    const managerAfter = await fetchRole(managerRole.id);
    check(
      [...managerAfter.permissions].sort().join() === [...managerPerms].sort().join(),
      '自己的角色：权限未被改动',
      managerAfter.permissions,
    );
    check(managerAfter.dataScope === 'campus', '自己的角色：数据范围未被改动', managerAfter.dataScope);
    check(managerAfter.name === managerRole.name, '自己的角色：名称未被改动', managerAfter.name);
    res = await api(await login(manager.account), 'GET', '/api/auth/profile');
    check(res.data && res.data.dataScope === 'campus', '重新登录后数据范围仍为 campus', res.data && res.data.dataScope);

    // 在未修复的后端上，上面的攻击会削掉操作者的权限；恢复后再测，避免后续用例被权限守卫拦下而假通过
    await api(adminToken, 'POST', `/api/system/roles/${managerRole.id}/permissions`, { permissionCodes: managerPerms });
    await api(adminToken, 'PUT', `/api/system/roles/${managerRole.id}`, { name: managerRole.name, dataScope: 'campus' });

    console.log('\n[12] 角色管理员不能动超管角色');
    // 只发原值：即使跑在未修复的后端上也不会改掉超管角色
    const superBefore = await fetchRole(superRole.id);
    res = await api(mToken, 'POST', `/api/system/roles/${superRole.id}/permissions`, {
      permissionCodes: superBefore.permissions,
    });
    check(res.status === 403, '超管角色：分配权限被拒', res.status);
    res = await api(mToken, 'PUT', `/api/system/roles/${superRole.id}`, { name: superBefore.name });
    check(res.status === 403, '超管角色：编辑被拒', res.status);
    res = await api(mToken, 'DELETE', `/api/system/roles/${superRole.id}`);
    check(res.status === 403, '超管角色：删除被拒', res.status);

    console.log('\n[13] 角色管理员不能动权限或范围高于自己的角色');
    const permHigher = await fixtureRole('permhigher', ['system:role:view', 'system:user:edit']);
    const scopeHigher = await fixtureRole('scopehigher', ['system:role:view'], 'all');
    for (const [label, role] of [['权限更高的角色', permHigher], ['范围更高的角色', scopeHigher]]) {
      res = await api(mToken, 'POST', `/api/system/roles/${role.id}/permissions`, {
        permissionCodes: ['system:role:view'],
      });
      check(res.status === 403, `${label}：分配权限被拒`, res.status);
      res = await api(mToken, 'PUT', `/api/system/roles/${role.id}`, { name: `renamed_${stamp}` });
      check(res.status === 403, `${label}：编辑被拒`, res.status);
      res = await api(mToken, 'DELETE', `/api/system/roles/${role.id}`);
      check(res.status === 403, `${label}：删除被拒`, res.status);
    }
    const permHigherAfter = await fetchRole(permHigher.id);
    check(
      permHigherAfter && permHigherAfter.permissions.includes('system:user:edit'),
      '权限更高的角色没有被削权',
      permHigherAfter,
    );
    const scopeHigherAfter = await fetchRole(scopeHigher.id);
    check(scopeHigherAfter && scopeHigherAfter.dataScope === 'all', '范围更高的角色未被改动', scopeHigherAfter);

    console.log('\n[14] 赋予其他角色的权限和范围不能超出自己');
    const lower = await fixtureRole('lower', ['system:role:view']);
    res = await api(mToken, 'POST', `/api/system/roles/${lower.id}/permissions`, {
      permissionCodes: ['system:role:view', 'system:user:edit'],
    });
    check(res.status === 403, '分配自己没有的权限被拒', res.status);
    for (const code of ['*', 'admin:all']) {
      res = await api(mToken, 'POST', `/api/system/roles/${lower.id}/permissions`, { permissionCodes: [code] });
      check(res.status === 403, `分配通配符 ${code} 被拒`, res.status);
    }
    res = await api(mToken, 'PUT', `/api/system/roles/${lower.id}`, { dataScope: 'all' });
    check(res.status === 403, '把角色数据范围改成 all 被拒', res.status);
    const lowerAfter = await fetchRole(lower.id);
    check(lowerAfter.permissions.join() === 'system:role:view', '被拒后角色权限未变', lowerAfter.permissions);
    check(lowerAfter.dataScope === 'campus', '被拒后角色数据范围未变', lowerAfter.dataScope);

    console.log('\n[15] 新建角色同样受限');
    const createRoleCases = [
      ['all 数据范围', { code: `bnd_newall_${stamp}`, dataScope: 'all' }],
      ['超管编码 admin', { code: 'admin', dataScope: 'campus' }],
      ['超管编码 super_admin', { code: 'super_admin', dataScope: 'campus' }],
    ];
    for (const [label, payload] of createRoleCases) {
      res = await api(mToken, 'POST', '/api/system/roles', { name: `bnd_x_${stamp}`, ...payload });
      check(res.status === 403, `新建角色：${label}被拒`, res.status);
      if (res.data && res.data.id) createdRoles.push(res.data.id);
    }
    const selfToken = await login(selfScoped.account);
    res = await api(selfToken, 'POST', '/api/system/roles', { code: `bnd_newdef_${stamp}`, name: `bnd_newdef_${stamp}` });
    check(res.status === 403, '仅本人范围的操作者：不传范围时默认 campus 同样超出自身，被拒', res.status);
    if (res.data && res.data.id) createdRoles.push(res.data.id);
    res = await api(selfToken, 'PUT', `/api/system/roles/${lower.id}`, { name: `renamed_${stamp}` });
    check(res.status === 403, '仅本人范围的操作者：编辑 campus 范围的角色被拒', res.status);

    console.log('\n[16] 角色管理员的正常操作不受影响');
    const newCode = `bnd_newok_${stamp}`;
    res = await api(mToken, 'POST', '/api/system/roles', { code: newCode, name: newCode, dataScope: 'department' });
    check([200, 201].includes(res.status), '新建不超出自身范围的角色成功', res.body);
    const newRoleId = res.data && res.data.id;
    if (newRoleId) createdRoles.push(newRoleId);
    res = await api(mToken, 'POST', `/api/system/roles/${newRoleId}/permissions`, {
      permissionCodes: ['system:role:view', 'system:role:edit'],
    });
    check(res.status === 200 || res.status === 201, '分配自己持有的权限成功', res.body);
    res = await api(mToken, 'PUT', `/api/system/roles/${newRoleId}`, { description: 'ok', dataScope: 'campus' });
    check(res.status === 200, '编辑角色并把范围调整为不超过自身成功', res.body);
    res = await api(mToken, 'POST', `/api/system/roles/${newRoleId}/permissions`, {
      permissionCodes: ['system:role:view'],
    });
    check(res.status === 200 || res.status === 201, '收回下级角色的权限成功', res.body);
    res = await api(mToken, 'DELETE', `/api/system/roles/${newRoleId}`);
    check(res.status === 200, '删除下级角色成功', res.body);
    if (res.status === 200) createdRoles.splice(createdRoles.indexOf(newRoleId), 1);

    console.log('\n[17] 超管不受角色限制，数据范围取值仍要合法');
    res = await api(adminToken, 'PUT', `/api/system/roles/${superRole.id}`, { name: superBefore.name });
    check(res.status === 200, '超管可编辑超管角色', res.body);
    res = await api(adminToken, 'POST', `/api/system/roles/${lower.id}/permissions`, { permissionCodes: ['*'] });
    check([200, 201].includes(res.status) && res.data.assignedCount > 1, '超管可用通配符全选权限', res.body);
    res = await api(adminToken, 'PUT', `/api/system/roles/${lower.id}`, { dataScope: 'all' });
    check(res.status === 200, '超管可把角色范围改成 all', res.body);
    res = await api(adminToken, 'PUT', `/api/system/roles/${lower.id}`, { dataScope: 'everything' });
    check(res.status === 400, '编辑角色：未知的数据范围被拒', res.status);
    res = await api(adminToken, 'POST', '/api/system/roles', {
      code: `bnd_badscope_${stamp}`,
      name: `bnd_badscope_${stamp}`,
      dataScope: 'everything',
    });
    check(res.status === 400, '新建角色：未知的数据范围被拒', res.status);
    if (res.data && res.data.id) createdRoles.push(res.data.id);
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
