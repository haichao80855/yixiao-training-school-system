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
  console.log('🏛️  拓视未来教育「一校教培系统」组织架构树与物理校区实体双轨统一自动化验证套件');
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

  // 1. 超管登录
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

  // 2. 验证组织架构树与物理校区的 1:1 双向锚定
  console.log('\n--- 1. 组织架构树与物理校区 1:1 双向锚定验证 ---');
  const treeRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/org-tree',
    method: 'GET',
    headers: authHeaders,
  });
  assert(treeRes.status === 200, '获取 5 级组织架构树成功返回 200');
  const rootNode = treeRes.body.data[0];
  assert(rootNode.code === 'org-root' && rootNode.level === 1, '根节点为集团总部 (level 1)');

  // 遍历收集全部校区节点
  const campusNodes = [];
  function collectCampusNodes(nodes) {
    for (const n of nodes) {
      if (n.level === 3 || n.type === 'campus') {
        campusNodes.push(n);
      }
      if (n.children && n.children.length > 0) {
        collectCampusNodes(n.children);
      }
    }
  }
  collectCampusNodes(treeRes.body.data);
  assert(campusNodes.length >= 5, `成功在组织树中定位到 ${campusNodes.length} 所 3 级校区节点 (>= 5)`);

  const hqCampusNode = campusNodes.find((n) => n.id === 'campus-node-hq' || n.code === 'NODE-HQ001');
  assert(!!hqCampusNode, '组织树中存在总部乐博旗舰校区节点');
  assert(!!hqCampusNode.campus, '组织树校区节点内联携带物理校区实体详情');
  assert(hqCampusNode.campus.id === 'campus-bj-hq', '组织树总部校区节点准确映射物理校区 ID [campus-bj-hq]');

  // 验证反向映射：GET /api/system/campuses 返回 orgNode
  const campusesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/campuses',
    method: 'GET',
    headers: authHeaders,
  });
  assert(campusesRes.status === 200, '获取物理校区清单返回 200');
  const hqPhysical = campusesRes.body.data.find((c) => c.id === 'campus-bj-hq');
  assert(!!hqPhysical, '物理校区列表中包含总部乐博旗舰校区');
  assert(hqPhysical.orgNodeId === 'campus-node-hq', '物理校区 orgNodeId 准确反向锚定组织节点 [campus-node-hq]');
  assert(!!hqPhysical.orgNode, '物理校区内联关联对应的组织树节点');

  // 3. 验证组织层级回溯推导引擎：真实解耦部门与岗位字段
  console.log('\n--- 2. 组织层级回溯推导引擎：彻底解耦部门与岗位混充 ---');
  const usersRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/users',
    method: 'GET',
    headers: authHeaders,
  });
  assert(usersRes.status === 200, '获取员工列表成功返回 200');
  const usersList = Array.isArray(usersRes.body.data) ? usersRes.body.data : usersRes.body.data.list;

  const zhaoTeacher = usersList.find((u) => u.account === 'zhaolp');
  assert(!!zhaoTeacher, '成功获取专职讲师 [赵立鹏 (zhaolp)] 员工档案');
  assert(zhaoTeacher.departmentId === 'dept-hq-edu', '真实解析出所属部门 ID: dept-hq-edu');
  assert(zhaoTeacher.departmentName === '教务教学部', '真实解析出所属部门名称: 教务教学部');
  assert(zhaoTeacher.postId === 'post-hq-teacher', '真实解析出专职岗位 ID: post-hq-teacher');
  assert(zhaoTeacher.postName === '少儿编程金牌讲师', '真实解析出专职岗位名称: 少儿编程金牌讲师');
  assert(zhaoTeacher.departmentId !== zhaoTeacher.postId, '【关键破除】departmentId 与 postId 彻底解耦，绝对非同一值！');
  assert(
    zhaoTeacher.orgPath.includes('华北北京大区') && zhaoTeacher.orgPath.includes('教务教学部'),
    `完整推导出组织链路: ${zhaoTeacher.orgPath}`,
  );

  const zhangPrincipal = usersList.find((u) => u.account === 'zhangjh');
  assert(!!zhangPrincipal, '成功获取执行校长 [张建华 (zhangjh)] 员工档案');
  assert(zhangPrincipal.campusId === 'campus-bj-hq', '执行校长归属物理校区 ID [campus-bj-hq]');

  // 4. 验证组织树子树级联穿透检索
  console.log('\n--- 3. 组织树子树级联穿透检索验证 ---');
  // 4.1 检索北京大区 (region-bj) -> 应该包含所有校区与部门人员
  const regionUsersRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/users?orgNodeId=region-bj',
    method: 'GET',
    headers: authHeaders,
  });
  const regionList = Array.isArray(regionUsersRes.body.data) ? regionUsersRes.body.data : regionUsersRes.body.data.list;
  assert(regionList.length >= 15, `按大区 (region-bj) 级联穿透成功检索出 ${regionList.length} 位在岗员工 (>= 15)`);

  // 4.2 检索总部校区 (campus-node-hq) -> 应该包含总部各部门人员
  const hqUsersRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/users?orgNodeId=campus-node-hq',
    method: 'GET',
    headers: authHeaders,
  });
  const hqList = Array.isArray(hqUsersRes.body.data) ? hqUsersRes.body.data : hqUsersRes.body.data.list;
  assert(hqList.length >= 5, `按校区 (campus-node-hq) 级联穿透成功检索出 ${hqList.length} 位总部员工 (>= 5)`);
  assert(
    hqList.some((u) => u.account === 'zhaolp') && hqList.some((u) => u.account === 'wangcw'),
    '总部校区穿透列表包含讲师赵立鹏与出纳王财务',
  );

  // 4.3 检索教务教学部 (dept-hq-edu) -> 应该精准包含讲师岗
  const eduUsersRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/users?orgNodeId=dept-hq-edu',
    method: 'GET',
    headers: authHeaders,
  });
  const eduList = Array.isArray(eduUsersRes.body.data) ? eduUsersRes.body.data : eduUsersRes.body.data.list;
  assert(
    eduList.some((u) => u.account === 'zhaolp'),
    '按教务教学部检索精确包含讲师赵立鹏',
  );

  // 5. 验证双轨合一联动写操作 (新建校区节点自动创建物理 Campus 表)
  console.log('\n--- 4. 双轨合一联动写操作验证 (新建校区自动落盘物理 Campus) ---');
  const newCampusCode = `NODE-TEST-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  const createCampusNodeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/system/org-tree',
      method: 'POST',
      headers: authHeaders,
    },
    {
      code: newCampusCode,
      name: '亦庄经开区教学中心',
      type: 'campus',
      level: 3,
      parentId: 'region-bj',
      phone: '010-66668888',
      address: '北京市大兴区亦庄荣华中路10号科技大厦B座',
    },
  );
  assert(createCampusNodeRes.status === 200 || createCampusNodeRes.status === 201, '成功在组织树中创建亦庄校区节点 (level 3)');
  const createdNode = createCampusNodeRes.body.data;
  assert(!!createdNode.campusId, '组织节点返回数据中包含自动创建的物理校区 campusId');
  assert(createdNode.campus?.name === '亦庄经开区教学中心', '物理校区实体名称自动对齐一致');

  // 验证在物理校区 API 中立刻能够查出该新增校区
  const afterCampusesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/campuses',
    method: 'GET',
    headers: authHeaders,
  });
  const yizhuangPhysical = afterCampusesRes.body.data.find((c) => c.code === newCampusCode);
  assert(!!yizhuangPhysical, '物理校区清单中成功同步查询到 [亦庄经开区教学中心]');
  assert(yizhuangPhysical.address === '北京市大兴区亦庄荣华中路10号科技大厦B座', '物理校区地址持久化落盘正确');

  // 6. 验证双重风控屏障安全拦截
  console.log('\n--- 5. 组织层级 + 物理业务依赖双重风控屏障验证 ---');
  // 6.1 尝试删除具有下级部门的校区节点 -> 拦截 400
  const deleteHqNodeRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/org-tree/campus-node-hq',
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(deleteHqNodeRes.status === 400, '尝试删除含下级部门的总部校区节点被坚决拦截 (400)');
  assert(
    deleteHqNodeRes.body.message.includes('下级组织子节点') || deleteHqNodeRes.body.message.includes('HasChildNodesException'),
    '返回错误提示明确指出包含下级组织子节点',
  );

  // 6.2 尝试直接删除具有学员/班级的物理校区 -> 拦截 400
  const deletePhysicalCampusRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/campuses/campus-bj-hq',
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(deletePhysicalCampusRes.status === 400, '尝试删除含班级/学员的物理校区被严格拦截 (400)');

  // 6.3 安全删除刚创建的无业务依赖的亦庄测试校区节点
  const deleteYizhuangRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/system/org-tree/${createdNode.id}`,
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(deleteYizhuangRes.status === 200, '无业务依赖的亦庄校区节点安全删除成功 (200)');

  // 验证物理校区也已被级联清理
  const finalCampusesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/campuses',
    method: 'GET',
    headers: authHeaders,
  });
  const deletedStillExists = finalCampusesRes.body.data.some((c) => c.code === newCampusCode);
  assert(!deletedStillExists, '物理校区表中亦庄校区已完成联动安全清理，零残留！');

  console.log('\n================================================================================');
  console.log(`🎉 全部 ${total} 项组织架构树与物理校区统一验证断言 100% 成功通过！`);
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('测试异常中断:', err);
  process.exit(1);
});
