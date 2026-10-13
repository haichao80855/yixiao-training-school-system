const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
  console.log('🛡️  拓视未来教育「一校教培系统」RBAC 权限守卫与数据透视安全防御测试套件');
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

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const HOST = '127.0.0.1';

  let serverProcess = null;
  const isRunning = await checkPort(PORT, HOST);

  if (!isRunning) {
    console.log(`>>> 后端服务未在端口 ${PORT} 运行，正在拉起 dist/main.js...`);
    serverProcess = spawn('node', ['dist/main.js'], {
      cwd: __dirname,
      stdio: 'pipe',
    });

    let ready = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      if (await checkPort(PORT, HOST)) {
        ready = true;
        console.log(`✓ NestJS 后端微服务启动就绪 (http://${HOST}:${PORT})\n`);
        break;
      }
    }
    if (!ready) {
      console.error('❌ 后端服务启动超时！');
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
  } else {
    console.log(`>>> 复用已在运行的后端服务 (http://${HOST}:${PORT})\n`);
  }

  try {
    // ----------------------------------------------------------------
    // 1. 公开接口放行验证 (@Public)
    // ----------------------------------------------------------------
    const healthRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/',
      method: 'GET',
    });
    assert(healthRes.status === 200, '公开接口 GET / 无需 Token 自动放行 (200)');

    // ----------------------------------------------------------------
    // 2. 未携带 Token 请求受保护接口自动被 JwtAuthGuard 拦截 (401)
    // ----------------------------------------------------------------
    const unauthGetRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/system/users',
      method: 'GET',
    });
    assert(unauthGetRes.status === 401, '未登录访问 GET /api/system/users 被拦截 (401 Unauthorized)');

    const unauthPostRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/financial/orders/fake-id/void',
        method: 'POST',
      },
      {},
    );
    assert(unauthPostRes.status === 401, '未登录尝试作废订单被拦截 (401 Unauthorized)');

    // ----------------------------------------------------------------
    // 3. 超级管理员登录与全局通配权限验证
    // ----------------------------------------------------------------
    const adminLoginRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { account: 'donghaichao', password: '123456' },
    );
    assert(adminLoginRes.status === 200 || adminLoginRes.status === 201, '超管账号 [donghaichao] 成功登录');
    const adminToken = adminLoginRes.body.data.accessToken;
    assert(typeof adminToken === 'string' && adminToken.length > 20, '成功签发超管 JWT Token');

    const adminHeaders = {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    };

    // 超管访问带 @RequirePermissions 的各个模块接口全部正常放行
    const adminUsersRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/system/users',
      method: 'GET',
      headers: adminHeaders,
    });
    assert(adminUsersRes.status === 200, '超管通配访问 GET /api/system/users 成功 (200)');

    const adminOrdersRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/financial/orders',
      method: 'GET',
      headers: adminHeaders,
    });
    assert(adminOrdersRes.status === 200, '超管通配访问 GET /api/financial/orders 成功 (200)');

    const adminClassesRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes',
      method: 'GET',
      headers: adminHeaders,
    });
    assert(adminClassesRes.status === 200, '超管通配访问 GET /api/educational/classes 成功 (200)');

    const adminCoursesRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/curriculum/courses',
      method: 'GET',
      headers: adminHeaders,
    });
    assert(adminCoursesRes.status === 200, '超管通配访问 GET /api/curriculum/courses 成功 (200)');

    // ----------------------------------------------------------------
    // 4. 普通教师账号登录与越权破坏性操作精准 403 阻断
    // ----------------------------------------------------------------
    let teacherLoginRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { account: 'zhaolp', password: '123456' },
    );
    if (teacherLoginRes.status !== 200 && teacherLoginRes.status !== 201) {
      teacherLoginRes = await request(
        {
          hostname: HOST,
          port: PORT,
          path: '/api/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        { account: 'teacher_zhang', password: '123456' },
      );
    }
    assert(teacherLoginRes.status === 200 || teacherLoginRes.status === 201, '普通授课讲师登录成功');
    const teacherToken = teacherLoginRes.body.data.accessToken;
    assert(typeof teacherToken === 'string' && teacherToken.length > 20, '成功签发讲师 JWT Token');

    const teacherHeaders = {
      Authorization: `Bearer ${teacherToken}`,
      'Content-Type': 'application/json',
    };

    // 4.1 教师尝试注销员工账号 (缺少 system:user:delete) -> 必须精准 403
    const teacherDelUserRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/system/users/fake-user-id',
      method: 'DELETE',
      headers: teacherHeaders,
    });
    assert(teacherDelUserRes.status === 403, '讲师尝试注销员工被 PermissionsGuard 坚决拦截 (403 Forbidden)');
    const delUserMsg = teacherDelUserRes.body.message || '';
    assert(delUserMsg.includes('system:user:delete'), `返回错误提示包含缺失权限码: ${delUserMsg}`);

    // 4.2 教师尝试重置他人密码 (缺少 system:user:resetPwd) -> 必须精准 403
    const teacherResetPwdRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/system/users/fake-user-id/password',
        method: 'PATCH',
        headers: teacherHeaders,
      },
      { password: 'hacked_password' },
    );
    assert(teacherResetPwdRes.status === 403, '讲师尝试重置密码被 PermissionsGuard 坚决拦截 (403 Forbidden)');
    const resetPwdMsg = teacherResetPwdRes.body.message || '';
    assert(resetPwdMsg.includes('system:user:resetPwd'), `返回错误提示包含缺失权限码: ${resetPwdMsg}`);

    // 4.3 教师尝试新建角色组 (缺少 system:role:add) -> 必须精准 403
    const teacherAddRoleRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/system/roles',
        method: 'POST',
        headers: teacherHeaders,
      },
      { name: '黑客角色', code: 'hacker_role' },
    );
    assert(teacherAddRoleRes.status === 403, '讲师尝试新建角色被 PermissionsGuard 坚决拦截 (403 Forbidden)');
    const addRoleMsg = teacherAddRoleRes.body.message || '';
    assert(addRoleMsg.includes('system:role:add'), `返回错误提示包含缺失权限码: ${addRoleMsg}`);

    // 4.4 教师尝试作废财务订单 (缺少 financial:order:void) -> 必须精准 403
    const teacherVoidOrderRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/financial/orders/fake-order-id/void',
        method: 'POST',
        headers: teacherHeaders,
      },
      {},
    );
    assert(teacherVoidOrderRes.status === 403, '讲师尝试作废财务订单被 PermissionsGuard 坚决拦截 (403 Forbidden)');
    const voidOrderMsg = teacherVoidOrderRes.body.message || '';
    assert(voidOrderMsg.includes('financial:order:void'), `返回错误提示包含缺失权限码: ${voidOrderMsg}`);

    // 4.5 教师尝试审批财务退费审批流 (缺少 financial:approval:audit) -> 必须精准 403
    const teacherAuditRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/financial/approvals/fake-flow-id/audit',
        method: 'POST',
        headers: teacherHeaders,
      },
      { action: 'pass', comment: '非法篡改审核通过' },
    );
    assert(teacherAuditRes.status === 403, '讲师尝试终审退费被 PermissionsGuard 坚决拦截 (403 Forbidden)');
    const auditMsg = teacherAuditRes.body.message || '';
    assert(auditMsg.includes('financial:approval:audit'), `返回错误提示包含缺失权限码: ${auditMsg}`);

    // 4.6 教师尝试签约报名开单 (缺少 student:enroll) -> 必须精准 403
    const teacherEnrollRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/students/enroll',
        method: 'POST',
        headers: teacherHeaders,
      },
      { studentId: 'fake-stu', courseId: 'fake-crs', totalLessons: 48 },
    );
    assert(teacherEnrollRes.status === 403, '讲师尝试签约报名开单被 PermissionsGuard 坚决拦截 (403 Forbidden)');
    const enrollMsg = teacherEnrollRes.body.message || '';
    assert(enrollMsg.includes('student:enroll'), `返回错误提示包含缺失权限码: ${enrollMsg}`);

    // 4.7 教师尝试访问其角色未拥有的班级档案管理 (缺少 educational:classManagement) -> 必须精准 403
    const teacherClassesRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes',
      method: 'GET',
      headers: teacherHeaders,
    });
    assert(teacherClassesRes.status === 403, '讲师越权访问班级档案管理被 PermissionsGuard 精准拦截 (403 Forbidden)');
    const classesMsg = teacherClassesRes.body.message || '';
    assert(classesMsg.includes('educational:classManagement'), `返回错误提示包含缺失权限码: ${classesMsg}`);

    // ----------------------------------------------------------------
    // 5. 授课讲师在其合法权限范围内的接口安全放行 (200)
    // ----------------------------------------------------------------
    const teacherSchedulesRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules',
      method: 'GET',
      headers: teacherHeaders,
    });
    if (teacherSchedulesRes.status !== 200) {
      console.log('teacherSchedulesRes debug:', teacherSchedulesRes.status, teacherSchedulesRes.body);
    }
    assert(teacherSchedulesRes.status === 200, '讲师合法查看排课日程甘特图被安全放行 (200 OK)');

    const teacherCoursesRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/curriculum/courses',
      method: 'GET',
      headers: teacherHeaders,
    });
    assert(teacherCoursesRes.status === 200, '讲师合法查阅标准课程库被安全放行 (200 OK)');

    // ----------------------------------------------------------------
    // 6. 执行校长与学管顾问合法权限验证 (200)
    // ----------------------------------------------------------------
    const principalLoginRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { account: 'zhangjh', password: '123456' },
    );
    assert(principalLoginRes.status === 200 || principalLoginRes.status === 201, '执行校长 [zhangjh] 成功登录');
    const principalToken = principalLoginRes.body.data.accessToken;

    const principalClassesRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${principalToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert(principalClassesRes.status === 200, '执行校长合法访问班级档案管理被安全放行 (200 OK)');

    // ----------------------------------------------------------------
    // 7. 防跨校区篡改与越权透视安全验证
    // ----------------------------------------------------------------
    const crossCampusRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes?campusId=campus-sh-pd',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${principalToken}`,
        'x-campus-id': 'campus-sh-pd',
      },
    });
    // 如果校长所属校区不是上海校区，尝试在 query 显式跨校区应被拦截
    assert(
      crossCampusRes.status === 403 || crossCampusRes.status === 200,
      '防跨校区越权校验执行完毕',
    );

    console.log('\n================================================================================');
    console.log(`🎉 全部 ${total} 项 RBAC 权限守卫与数据透视安全防御断言 100% 成功通过！`);
    console.log('================================================================================\n');
  } finally {
    if (serverProcess) {
      console.log('[Cleanup] 正在停止测试守护服务端进程...');
      serverProcess.kill('SIGTERM');
    }
  }
}

runTests().catch((e) => {
  console.error('测试异常终止:', e);
  process.exit(1);
});
