const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================================');
  console.log('🌳  拓视未来教育「一校教培系统」4 级权限树契约与员工数据范围持久化自动化验证套件');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;
  function assert(condition, desc) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS [${passed}]: ${desc}`);
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      process.exit(1);
    }
  }

  const PORT = 3001;
  const HOST = '127.0.0.1';

  // 1. 超管登录获取凭证
  const loginRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'donghaichao', password: '123456' },
  );
  assert(loginRes.status === 200 || loginRes.status === 201, '超管 [donghaichao] 成功登录');
  const token = loginRes.body.data.accessToken;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  console.log('\n--- 1. 4 级权威权限树契约结构与 Label 完整性校验 ---');
  // 1.1 获取权限树
  const permRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/permissions',
    method: 'GET',
    headers: authHeaders,
  });
  assert(permRes.status === 200, '获取权限树接口成功返回 200');
  const tree = permRes.body.data;
  assert(Array.isArray(tree) && tree.length === 1, '返回顶级数组结构且包含 1 个系统根节点');

  const root = tree[0];
  assert(root.level === 'system', '顶级根节点为 1 级系统全域 (level: system)');
  assert(root.code === '*', '顶级系统根节点权限码为全通配 *');
  assert(typeof root.label === 'string' && root.label.length > 0, '系统根节点具备有效 label 字段');
  assert(Array.isArray(root.children) && root.children.length === 5, '系统根节点包含 5 大核心业务模块 (level: module)');

  // 1.2 校验 5 大模块
  const expectedModules = ['system:view', 'curriculum:view', 'student:view', 'educational:view', 'financial:view'];
  const actualModuleCodes = root.children.map((m) => m.code);
  const allModulesPresent = expectedModules.every((c) => actualModuleCodes.includes(c));
  assert(allModulesPresent, '5 大核心业务中心总览模块完备 (系统/教研/学员/教务/财务)');

  // 1.3 递归检查树中所有节点的 label 字段与无 undefined
  let allLabelsValid = true;
  let totalNodesCount = 0;
  const collectedCodes = new Set();

  function traverseCheck(nodes) {
    for (const node of nodes) {
      totalNodesCount++;
      collectedCodes.add(node.code);
      if (!node.label || node.label === 'undefined' || typeof node.label !== 'string') {
        allLabelsValid = false;
        console.error(`节点缺少合法 label:`, node);
      }
      if (node.children && node.children.length > 0) {
        traverseCheck(node.children);
      }
    }
  }
  traverseCheck(tree);

  assert(allLabelsValid, '【关键破除】权限树所有节点 label 均合法非空，彻底消除 undefined 白屏断裂');
  assert(totalNodesCount >= 62, `权限树层级节点完整挂载 (共遍历 ${totalNodesCount} 个节点，包含根节点)`);
  assert(collectedCodes.has('system:org:add'), '页面按钮级权限 [新增组织节点] 正常挂载在树中');
  assert(collectedCodes.has('educational:schedule:collision'), '页面按钮级权限 [时段防撞检测] 正常挂载在树中');
  assert(collectedCodes.has('financial:order:lock'), '页面按钮级权限 [财务账期加锁保护] 正常挂载在树中');

  // 1.4 兼容性平铺接口校验 (?flat=true)
  const flatRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/permissions?flat=true',
    method: 'GET',
    headers: authHeaders,
  });
  assert(flatRes.status === 200, '平铺权限列表接口返回 200');
  assert(Array.isArray(flatRes.body.data) && flatRes.body.data.length >= 61, '平铺列表准确返回全部 61 项持久化细粒度权限记录');
  assert(typeof flatRes.body.data[0].label === 'string', '平铺列表节点同样补齐 label 契约字段');

  console.log('\n--- 2. 员工个人数据权限范围 (Data Scope) 真实持久化与落盘验证 ---');
  // 2.1 查询讲师 赵立鹏 的账号
  const usersRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/users?keyword=zhaolp',
    method: 'GET',
    headers: authHeaders,
  });
  assert(usersRes.status === 200, '查询讲师 [zhaolp] 档案成功');
  const teacher = usersRes.body.data.find((u) => u.account === 'zhaolp');
  assert(Boolean(teacher), '成功定位讲师 [赵立鹏]');
  const teacherId = teacher.id;

  // 2.2 超管通过 PUT /api/system/users/:id 为讲师覆写配置个人数据权限为 department (本部门)
  const updateScopeRes1 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/system/users/${teacherId}`,
      method: 'PUT',
      headers: authHeaders,
    },
    { dataScope: 'department' },
  );
  assert(updateScopeRes1.status === 200, '修改员工数据范围为 [department] 成功返回 200');

  // 2.3 重新获取用户列表验证物理落盘持久化
  const checkUsersRes1 = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/users?keyword=zhaolp',
    method: 'GET',
    headers: authHeaders,
  });
  const updatedTeacher1 = checkUsersRes1.body.data.find((u) => u.account === 'zhaolp');
  assert(updatedTeacher1.dataScope === 'department', '【关键验证】员工个性化数据范围 [department] 已真实持久化落盘，终结本地伪保存！');

  // 2.4 再次修改员工数据范围为 campus (本校区)
  const updateScopeRes2 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/system/users/${teacherId}`,
      method: 'PUT',
      headers: authHeaders,
    },
    { dataScope: 'campus' },
  );
  assert(updateScopeRes2.status === 200, '再次修改员工数据范围为 [campus] 成功返回 200');

  const checkUsersRes2 = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/users?keyword=zhaolp',
    method: 'GET',
    headers: authHeaders,
  });
  const updatedTeacher2 = checkUsersRes2.body.data.find((u) => u.account === 'zhaolp');
  assert(updatedTeacher2.dataScope === 'campus', '员工个性化数据范围变更为 [campus] 并再次落盘验证成功');

  console.log('\n--- 3. 员工独立数据权限优先级与身份鉴权仲裁验证 ---');
  // 3.1 讲师 zhaolp 登录，其角色原本为 teacher (dataScope: 'self')，但当前个人覆写为 'campus'
  const teacherLoginRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'zhaolp', password: '123456' },
  );
  assert(teacherLoginRes.status === 200 || teacherLoginRes.status === 201, '讲师 [zhaolp] 登录成功');
  const teacherUser = teacherLoginRes.body.data.user;
  const teacherToken = teacherLoginRes.body.data.accessToken;
  assert(teacherUser.dataScope === 'campus', '【优先级仲裁】登录凭证中有效数据权限为员工个性化覆写的 [campus]，优先于角色的 [self]！');

  // 3.2 讲师通过 Token 请求自身 Profile
  const profileRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/auth/profile',
    method: 'GET',
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  assert(profileRes.status === 200, '讲师获取个人 Profile 成功');
  assert(profileRes.body.data.dataScope === 'campus', 'Profile 返回数据权限范围严格对齐为个性化 [campus]');

  // 3.3 将讲师数据范围清空回退为 null，验证自动无缝回退继承角色默认 self
  await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/system/users/${teacherId}`,
      method: 'PUT',
      headers: authHeaders,
    },
    { dataScope: null },
  );

  const teacherLoginRes2 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'zhaolp', password: '123456' },
  );
  assert(teacherLoginRes2.body.data.user.dataScope === 'self', '【平滑回退】清除个人覆写后，自动无缝回退继承所属角色默认的 [self] 范围！');

  console.log('\n--- 4. 角色细粒度权限配置与角色数据范围落盘验证 ---');
  // 4.1 新建临时业务角色组
  const tempRoleCode = `test_role_${Date.now()}`;
  const createRoleRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/system/roles',
      method: 'POST',
      headers: authHeaders,
    },
    {
      code: tempRoleCode,
      name: '教研排课专项测试组',
      description: '自动化测试临时角色',
      dataScope: 'department',
    },
  );
  assert(createRoleRes.status === 200 || createRoleRes.status === 201, '新建系统业务角色组成功');
  const testRoleId = createRoleRes.body.data.id;

  // 4.2 为角色分配指定权限码
  const assignCodes = ['curriculum:view', 'curriculum:courseManage', 'curriculum:course:add'];
  const assignRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/system/roles/${testRoleId}/permissions`,
      method: 'POST',
      headers: authHeaders,
    },
    { permissionCodes: assignCodes },
  );
  assert(assignRes.status === 200 || assignRes.status === 201, '角色分配细粒度功能权限成功返回 200');

  // 4.3 查询角色列表校验权限码持久化
  const rolesListRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/roles',
    method: 'GET',
    headers: authHeaders,
  });
  const testRoleInList = rolesListRes.body.data.find((r) => r.id === testRoleId);
  assert(Boolean(testRoleInList), '在角色列表中成功定位测试角色');
  assert(testRoleInList.permissions.length === 3, '分配的 3 项细粒度权限码准确落盘');
  assert(testRoleInList.permissions.includes('curriculum:course:add'), '角色权限包含 [curriculum:course:add]');

  // 4.4 校验角色全通配权限分配 (支持 *)
  const assignWildcardRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/system/roles/${testRoleId}/permissions`,
      method: 'POST',
      headers: authHeaders,
    },
    { permissionCodes: ['*'] },
  );
  assert(assignWildcardRes.status === 200 || assignWildcardRes.status === 201, '传入通配符 * 分配权限成功');

  const rolesListRes2 = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/roles',
    method: 'GET',
    headers: authHeaders,
  });
  const testRoleInList2 = rolesListRes2.body.data.find((r) => r.id === testRoleId);
  assert(testRoleInList2.permissions.length >= 61, '通配符 * 成功一键绑定全量 61 项系统细粒度权限点！');

  // 4.5 更改角色的 dataScope
  const updateRoleScopeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/system/roles/${testRoleId}`,
      method: 'PUT',
      headers: authHeaders,
    },
    { dataScope: 'campus' },
  );
  assert(updateRoleScopeRes.status === 200, '更新角色自身数据透视范围成功');

  // 4.6 安全清理临时角色
  const deleteRoleRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/system/roles/${testRoleId}`,
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(deleteRoleRes.status === 200, '临时测试角色组已安全删除清理');

  console.log('\n================================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项权限树契约与员工数据范围持久化断言 100% 成功通过！`);
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
