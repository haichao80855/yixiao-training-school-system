/**
 * 专项测试：少儿编程专职主讲教师访问指定页面免受 system:user:view 越界拦截验真
 * 运行命令: node server/test-teacher-page-permissions.js
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
  console.log('🛡️  少儿编程教师角色权限开启后访问业务页面防越权与免受 [system:user:view] 阻断实测');
  console.log('================================================================================\n');

  // 1. 超管登录
  const adminLogin = await login('donghaichao', '123456');
  assert.ok(adminLogin.token, '超级管理员必须成功登录');
  logPass('超级管理员成功登录并签发 JWT');
  const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` };

  // 2. 定位教师角色 (code: teacher)
  const rolesRes = await request('/api/system/roles', { headers: adminHeaders });
  const roleList = rolesRes.data?.data || rolesRes.data || [];
  const teacherRole = roleList.find((r) => r.code === 'teacher');
  assert.ok(teacherRole, '数据库中必须存在少儿编程专职主讲教师角色 (teacher)');
  const originalPerms = (teacherRole.permissions || []).map((p) => (typeof p === 'string' ? p : (p.code || p.name)));
  logPass(`定位少儿编程教师角色: ${teacherRole.name} (ID: ${teacherRole.id})`);

  // 3. 超管在 4 级 RBAC 角色中为教师赋予业务权限 (排课、教学讲台、班级管理、课程库)，绝不赋予 system:user:view
  const businessPerms = [
    'curriculum:courseManage',
    'educational:workbench',
    'educational:workbench:attend',
    'educational:timeSchedule',
    'educational:schedule:collision',
    'educational:classManagement',
  ];
  const assignRes = await request(`/api/system/roles/${teacherRole.id}/permissions`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ permissionCodes: businessPerms }),
  });
  assert.ok(assignRes.status === 200 || assignRes.status === 201, '超管为教师角色成功配置业务权限');
  logPass('超管在 4 级 RBAC 角色中为教师成功开通排课看板、班级管理与教学讲台权限（无 system:user:view）');

  // 4. 登录教师账号 (优先 teacher_zhang，兼容 zhaolp)
  let teacherLogin = await login('teacher_zhang', '123456');
  if (!teacherLogin.token) {
    teacherLogin = await login('zhaolp', '123456');
  }
  assert.ok(teacherLogin.token, '教师账号登录成功');
  const teacherHeaders = { Authorization: `Bearer ${teacherLogin.token}` };
  const userPerms = teacherLogin.data?.data?.user?.permissions || [];
  assert.ok(!userPerms.includes('system:user:view'), '教师权限列表中严格不包含人事最高权限 [system:user:view]');
  logPass('教师成功登录，身份资料确认未被授予人事总管权限 [system:user:view]');

  // 5. 关键验证：教师访问排课、班级与讲台必须的讲师列表端点 GET /api/educational/teachers
  const teachersRes = await request('/api/educational/teachers?campusId=campus-bj-hq', {
    headers: teacherHeaders,
  });
  assert.strictEqual(teachersRes.status, 200, '教师访问 GET /api/educational/teachers 必须成功返回 200 OK');
  const teacherData = teachersRes.data?.data || teachersRes.data;
  assert.ok(Array.isArray(teacherData) && teacherData.length > 0, '讲师列表正确返回在职教师数组');
  logPass('【核心破除】教师进入页面拉取教务讲师列表成功返回 200 OK，彻底终结 [system:user:view] 阻断！');

  // 6. 双重防御验证：教师直接请求 GET /api/system/users 也不再抛出 403 弹窗
  const systemUsersRes = await request('/api/system/users?pageSize=10', {
    headers: teacherHeaders,
  });
  assert.strictEqual(systemUsersRes.status, 200, '双重防线生效：GET /api/system/users 支持教务业务角色安全只读放行');
  logPass('【双重防线】教师直接请求人员总表亦平滑放行，彻底消除页面崩溃隐患');

  // 7. 教师访问指定业务页面数据 (排课、班级、课程)
  const schedulesRes = await request('/api/educational/schedules', { headers: teacherHeaders });
  assert.strictEqual(schedulesRes.status, 200, '教师合法访问 7×15 排课看板成功');
  logPass('教师合法访问 7×15 排课日程看板数据成功 (200 OK)');

  const classesRes = await request('/api/educational/classes', { headers: teacherHeaders });
  assert.strictEqual(classesRes.status, 200, '教师合法访问班级与班容管理成功');
  logPass('教师合法访问班级档案管理数据成功 (200 OK)');

  // 8. 越权安全性坚固测试：教师尝试删除员工仍被坚决拦截 (403)
  const hackDelRes = await request('/api/system/users/fake-user-id', {
    method: 'DELETE',
    headers: teacherHeaders,
  });
  assert.strictEqual(hackDelRes.status, 403, '教师越权删除员工被 PermissionsGuard 坚决拦截 (403)');
  logPass('【安全红线未失守】教师越权删除员工被坚决拦截 (403 Forbidden: 缺少 system:user:delete)');

  // 9. 教师尝试重置他人密码仍被坚决拦截 (403)
  const hackPwdRes = await request('/api/system/users/fake-user-id/password', {
    method: 'PATCH',
    headers: teacherHeaders,
    body: JSON.stringify({ password: 'hack' }),
  });
  assert.strictEqual(hackPwdRes.status, 403, '教师越权重置他人密码被坚决拦截 (403)');
  logPass('【安全红线未失守】教师越权重置他人密码被坚决拦截 (403 Forbidden: 缺少 system:user:resetPwd)');

  // 10. 安全复原：恢复教师角色标准种子权限 (不包含 classManagement 等管理权限)
  const standardTeacherPerms = [
    'curriculum:view',
    'curriculum:courseManage',
    'curriculum:course:add',
    'curriculum:course:edit',
    'curriculum:course:delete',
    'curriculum:course:auth',
    'curriculum:course:status',
    'curriculum:lessonPlan',
    'curriculum:lessonPlan:add',
    'curriculum:lessonPlan:preview',
    'curriculum:subject',
    'educational:workbench',
    'educational:workbench:attend',
    'educational:timeSchedule',
    'educational:schedule:collision',
  ];
  await request(`/api/system/roles/${teacherRole.id}/permissions`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ permissionCodes: standardTeacherPerms }),
  });
  logPass('测试环境安全复原：教师角色权限已平滑还原为标准配置');

  console.log('\n================================================================================');
  console.log(`🎉 全部 ${passed}/${passed} 项少儿编程教师权限开启后免受越界阻断断言 100% 成功通过！`);
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
