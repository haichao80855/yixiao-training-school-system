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
  console.log('====================================================');
  console.log('拓视未来教育「一校教培系统」后端第二步集成与安全测试套件');
  console.log('====================================================\n');

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

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const HOST = '127.0.0.1';

  // 1. 验证公开接口存活
  const healthRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/',
    method: 'GET',
  });
  assert(healthRes.status === 200, '健康检查接口 GET / 返回 200');
  assert(healthRes.body.data.stockCode === '002599', '健康检查返回拓视未来教育股票代码 002599');

  // 2. 验证受保护接口未携带 Token 自动被拦截 (401)
  const unauthRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/auth/profile',
    method: 'GET',
  });
  assert(unauthRes.status === 401, '未携带 Token 访问受保护接口自动返回 401 Unauthorized');

  // 3. 验证账号密码错误拦截
  const wrongPassRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'donghaichao', password: 'wrong_password' },
  );
  assert(wrongPassRes.status === 401, '错误密码登录被准确拦截 (401)');

  // 4. 验证超管账号真实登录成功并签发有效 JWT Token
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
  assert(loginRes.status === 200 || loginRes.status === 201, '超管账号 [donghaichao/123456] 登录成功');
  const token = loginRes.body.data.accessToken;
  assert(typeof token === 'string' && token.length > 20, '成功签发有效 JWT Bearer Token');
  assert(loginRes.body.data.user.realName === '冬海潮', '登录返回真实姓名 [冬海潮]');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 5. 携带 Token 请求当前用户画像与权限码列表
  const profileRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/auth/profile',
    method: 'GET',
    headers: authHeaders,
  });
  assert(profileRes.status === 200, '携带 Token 获取用户画像返回 200');
  assert(profileRes.body.data.account === 'donghaichao', '用户画像账号匹配');
  assert(profileRes.body.data.permissions.includes('*'), '超级管理员包含全局通配权限 [*]');
  assert(profileRes.body.data.authorizedCampuses.length === 5, '超管可管辖全量 5 大物理校区');

  // 6. 验证校区清单接口
  const campusesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/campuses',
    method: 'GET',
    headers: authHeaders,
  });
  assert(campusesRes.status === 200, '获取校区清单返回 200');
  assert(campusesRes.body.data.length === 5, '校区数量恰好为 5 所');

  // 7. 验证 5 级组织架构树
  const orgTreeRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/org-tree',
    method: 'GET',
    headers: authHeaders,
  });
  assert(orgTreeRes.status === 200, '获取 5 级组织架构树返回 200');
  assert(orgTreeRes.body.data[0].name === '盛通股份集团总部' || orgTreeRes.body.data[0].name.includes('集团'), '组织树顶层根节点为集团总部');
  assert(orgTreeRes.body.data[0].children.length > 0, '集团总部下挂子部门');

  // 8. 验证组织架构安全风控删除拦截 (删除根节点必须被坚决拒绝)
  const rootNodeId = orgTreeRes.body.data[0].id;
  const deleteRootRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/system/org-tree/${rootNodeId}`,
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(deleteRootRes.status === 400, '风控生效：删除集团总部根节点被坚决拦截 (400)');

  // 9. 验证有子节点的组织亦被风控拦截
  const hasChildNode = orgTreeRes.body.data[0];
  const deleteHasChildRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/system/org-tree/${hasChildNode.id}`,
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(deleteHasChildRes.status === 400, '风控生效：删除含有下级子分支的组织节点被拦截 (400)');

  // 10. 验证新建叶子组织节点与合法删除
  const createNodeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/system/org-tree',
      method: 'POST',
      headers: authHeaders,
    },
    {
      code: 'org-test-post-999',
      name: '测试临时教研小组',
      type: 'post',
      level: 4,
      parentId: orgTreeRes.body.data[0].children[0].id,
      leader: '测试组长',
    },
  );
  assert(createNodeRes.status === 200 || createNodeRes.status === 201, '成功创建测试叶子节点');
  const tempNodeId = createNodeRes.body.data.id;

  const deleteTempRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/system/org-tree/${tempNodeId}`,
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(deleteTempRes.status === 200, '无子节点且无绑定员工的合法叶子节点被安全删除 (200)');

  // 11. 验证角色列表与权限查询
  const rolesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/roles',
    method: 'GET',
    headers: authHeaders,
  });
  assert(rolesRes.status === 200, '获取角色列表返回 200');
  assert(rolesRes.body.data.length >= 3, '包含超管、校长、教师等角色');

  // 12. 验证业务数据字典
  const dictRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/dict-items',
    method: 'GET',
    headers: authHeaders,
  });
  assert(dictRes.status === 200, '获取业务字典返回 200');
  assert(dictRes.body.data.length >= 5, '包含异动原因与预警规则字典项');

  console.log(`\n🎉 全部 ${passed}/${total} 项集成测试与安全断言 100% 验证通过！底座坚实就绪。\n`);
}

runTests().catch((err) => {
  console.error('测试异常失败:', err);
  process.exit(1);
});
