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
  console.log('📚  拓视未来教育「一校教培系统」业务参数字典持久化、缓存与业务绑定自动化测试套件');
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
  const adminHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  console.log('\n--- 1. 字典实体 remark 字段持久化与防数据丢失测试 ---');
  // 1.1 创建携带 remark 说明的测试字典项
  const testDictKey = `TEST_REMARK_${Date.now()}`;
  const initialRemark = '这是自动化测试录入的真实业务说明备注与场景提示';
  const createDictRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/system/dict-items',
      method: 'POST',
      headers: adminHeaders,
    },
    {
      category: 'trans_reason',
      dictKey: testDictKey,
      label: '学员出国定居/国际转学',
      order: 88,
      enabled: true,
      remark: initialRemark,
    },
  );
  assert(createDictRes.status === 200 || createDictRes.status === 201, '创建含 remark 字段的字典项成功');
  const createdItem = createDictRes.body.data;
  assert(createdItem.remark === initialRemark, '接口返回数据中包含正确的 remark 字段');
  const createdId = createdItem.id;

  // 1.2 查询字典列表验证物理落盘
  const queryRes1 = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/dict-items?category=trans_reason',
    method: 'GET',
    headers: adminHeaders,
  });
  assert(queryRes1.status === 200, '查询分类字典项返回 200');
  const targetItem1 = queryRes1.body.data.find((d) => d.id === createdId);
  assert(Boolean(targetItem1), '在字典列表中成功定位新建字典项');
  assert(targetItem1.remark === initialRemark, '【关键破除】remark 业务说明物理持久化落盘成功，彻底终结静默丢弃！');

  // 1.3 更新 remark 业务说明并验证持久化
  const updatedRemark = '更新后的业务说明说明文案-已通过审批流程核准';
  const updateDictRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/system/dict-items/${createdId}`,
      method: 'PUT',
      headers: adminHeaders,
    },
    {
      label: '学员出国定居/国际转学 (已认证)',
      order: 89,
      enabled: true,
      remark: updatedRemark,
    },
  );
  assert(updateDictRes.status === 200, '更新字典项 remark 成功');

  const queryRes2 = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/dict-items?category=trans_reason',
    method: 'GET',
    headers: adminHeaders,
  });
  const targetItem2 = queryRes2.body.data.find((d) => d.id === createdId);
  assert(targetItem2.remark === updatedRemark, '更新后的 remark 业务说明物理落盘验证成功');
  assert(targetItem2.label === '学员出国定居/国际转学 (已认证)', '字典项 label 同步更新成功');

  console.log('\n--- 2. DictCacheManager 内存缓存与自驱失效机制测试 ---');
  // 2.1 连续高频读取触发缓存命中
  for (let i = 0; i < 5; i++) {
    await request({
      hostname: HOST,
      port: PORT,
      path: '/api/system/dict-items?category=warning_rule',
      method: 'GET',
      headers: adminHeaders,
    });
  }

  // 2.2 查询缓存性能与统计指标
  const statsRes1 = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/dict-items/cache/stats',
    method: 'GET',
    headers: adminHeaders,
  });
  assert(statsRes1.status === 200, '查询字典缓存指标接口返回 200');
  const stats1 = statsRes1.body.data;
  assert(stats1.hits >= 4, `【缓存命中验证】内存缓存命中成功 (hits: ${stats1.hits}, 命中率: ${stats1.hitRate})`);

  // 2.3 变更字典状态触发自驱缓存失效
  const prevInvalidations = stats1.invalidations;
  const toggleRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/system/dict-items/${createdId}/status`,
      method: 'PATCH',
      headers: adminHeaders,
    },
    { enabled: false },
  );
  assert(toggleRes.status === 200, '切换字典项状态为停用成功');

  const statsRes2 = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/dict-items/cache/stats',
    method: 'GET',
    headers: adminHeaders,
  });
  const stats2 = statsRes2.body.data;
  assert(stats2.invalidations > prevInvalidations, '【自驱失效验证】写操作自驱触发缓存失效计数递增，保证强一致性！');

  // 2.4 重新读取立即反映最新停用状态
  const queryRes3 = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/dict-items?category=trans_reason',
    method: 'GET',
    headers: adminHeaders,
  });
  const targetItem3 = queryRes3.body.data.find((d) => d.id === createdId);
  assert(targetItem3.enabled === false, '缓存失效后重新拉取到最新的停用状态');

  console.log('\n--- 3. 业务权限矩阵：只读放宽给登录教职工，写操作强管控 ---');
  // 3.1 普通授课讲师登录
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
  assert(teacherLoginRes.status === 200 || teacherLoginRes.status === 201, '普通讲师 [zhaolp] 登录成功');
  const teacherToken = teacherLoginRes.body.data.accessToken;
  const teacherHeaders = {
    Authorization: `Bearer ${teacherToken}`,
    'Content-Type': 'application/json',
  };

  // 3.2 讲师合法读取业务字典下拉选项 (放宽权限，消除业务孤岛)
  const teacherReadDictRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/dict-items?category=trans_reason',
    method: 'GET',
    headers: teacherHeaders,
  });
  assert(teacherReadDictRes.status === 200, '【破除权限死锁】普通讲师可合法查询业务字典下拉选项 (200 OK)');
  assert(Array.isArray(teacherReadDictRes.body.data) && teacherReadDictRes.body.data.length >= 5, '讲师成功获取异动原因字典项列表');

  // 3.3 讲师尝试越权新增字典项 -> 必须被 PermissionsGuard 拦截 (403)
  const teacherAddDictRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/system/dict-items',
      method: 'POST',
      headers: teacherHeaders,
    },
    { category: 'hacked', dictKey: 'HACK', label: '非法越权字典' },
  );
  assert(teacherAddDictRes.status === 403, '讲师越权新增字典被 PermissionsGuard 坚决拦截 (403 Forbidden)');
  assert(teacherAddDictRes.body.message.includes('system:dict:add'), '返回错误提示包含缺少 system:dict:add 权限码');

  // 3.4 讲师尝试越权删除字典项 -> 必须被拦截 (403)
  const teacherDelDictRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/system/dict-items/${createdId}`,
    method: 'DELETE',
    headers: teacherHeaders,
  });
  assert(teacherDelDictRes.status === 403, '讲师越权删除字典被 PermissionsGuard 坚决拦截 (403 Forbidden)');
  assert(teacherDelDictRes.body.message.includes('system:dict:delete'), '返回错误提示包含缺少 system:dict:delete 权限码');

  console.log('\n--- 4. 业务模块异动流程动态消费字典项闭环验证 ---');
  // 4.1 查询测试学员
  const studentRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/students?page=1&pageSize=5',
    method: 'GET',
    headers: adminHeaders,
  });
  assert(studentRes.status === 200, '获取学员列表成功');
  const targetStudent = studentRes.body.data.list ? studentRes.body.data.list[0] : studentRes.body.data[0];
  assert(Boolean(targetStudent), '成功定位测试学员档案');

  // 4.2 使用字典配置的标准异动原因提交异动申请
  const movementRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${targetStudent.id}/movement`,
      method: 'POST',
      headers: adminHeaders,
    },
    {
      type: 'suspend',
      reasonCategory: '家庭搬迁/距离过远',
      reasonDetail: '因家庭搬迁至通州区，通勤距离过长申请休学顺延课时',
      suspensionDays: 45,
    },
  );
  assert(movementRes.status === 200 || movementRes.status === 201, '使用标准字典原因提交学员休学异动成功');

  // 4.3 安全清理临时测试字典项
  const deleteRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/system/dict-items/${createdId}`,
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert(deleteRes.status === 200, '测试字典项已安全清理删除');

  console.log('\n================================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项业务参数字典持久化、缓存与业务绑定断言 100% 成功通过！`);
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
