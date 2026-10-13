/**
 * 专项测试：新增员工与手机号/工号双轨登录全链路测试
 * 运行方式: node server/test-user-phone-login.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          const payload = parsed && typeof parsed === 'object' && parsed.data !== undefined ? parsed.data : parsed;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: payload,
            raw: parsed,
          });
        });
      },
    );

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 开始执行：新增员工与手机号/工号双轨登录自动化集成测试\n');
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failCount++;
    }
  }

  let adminToken = '';
  let testUserId = '';
  const testAccount = `test_emp_${Date.now()}`;
  const testPhone = `139${Math.floor(10000000 + Math.random() * 90000000)}`;

  try {
    // 1. 超级管理员登录
    console.log('👉 测试 1: 超级管理员登录系统');
    const adminLoginRes = await request('POST', '/api/auth/login', {
      account: 'donghaichao',
      password: '123456',
    });
    assert(
      adminLoginRes.statusCode === 200 || adminLoginRes.statusCode === 201,
      '超级管理员使用默认凭据登录成功',
    );
    adminToken = adminLoginRes.body.accessToken;
    assert(!!adminToken, '超级管理员成功签发 JWT 访问令牌');

    // 2. 超级管理员新增在职员工
    console.log('\n👉 测试 2: 超级管理员录入新员工 (含工号与手机号)');
    const createRes = await request(
      'POST',
      '/api/system/users',
      {
        account: testAccount,
        realName: '测试手机员工',
        phone: testPhone,
        email: `${testAccount}@example.com`,
        campusId: 'campus-bj-hq',
        roleId: 'r4',
        dataScope: 'self',
        password: '123456',
      },
      {
        Authorization: `Bearer ${adminToken}`,
      },
    );
    assert(
      createRes.statusCode === 200 || createRes.statusCode === 201,
      `新员工录入成功: account=${testAccount}, phone=${testPhone}`,
    );
    testUserId = createRes.body?.id || createRes.raw?.data?.id;
    assert(!!testUserId, '服务端成功持久化并返回员工 ID');

    // 3. 使用【工号】登录验证
    console.log('\n👉 测试 3: 使用【工号】及默认初始密码 123456 登录系统');
    const loginByAccountRes = await request('POST', '/api/auth/login', {
      account: testAccount,
      password: '123456',
    });
    assert(
      loginByAccountRes.statusCode === 200 || loginByAccountRes.statusCode === 201,
      '工号登录成功返回 HTTP 200/201',
    );
    assert(
      loginByAccountRes.body.user && loginByAccountRes.body.user.account === testAccount,
      '工号登录正确解析用户身份及资料',
    );

    // 4. 使用【手机号】登录验证（核心修复验证点）
    console.log('\n👉 测试 4: 使用【手机号】及密码 123456 登录系统 (双轨登录核心修复点)');
    const loginByPhoneRes = await request('POST', '/api/auth/login', {
      account: testPhone,
      password: '123456',
    });
    assert(
      loginByPhoneRes.statusCode === 200 || loginByPhoneRes.statusCode === 201,
      `手机号 ${testPhone} 登录成功返回 HTTP 200/201`,
    );
    assert(
      loginByPhoneRes.body.user &&
        loginByPhoneRes.body.user.phone === testPhone &&
        loginByPhoneRes.body.user.account === testAccount,
      '手机号登录准确识别关联账号与手机号信息',
    );
    assert(!!loginByPhoneRes.body.accessToken, '手机号登录成功签发独立 JWT 凭证');

    // 5. 手机号查重防御：重复绑定同手机号应被拦截
    console.log('\n👉 测试 5: 手机号防重复绑定拦截校验');
    const duplicatePhoneRes = await request(
      'POST',
      '/api/system/users',
      {
        account: `${testAccount}_dup`,
        realName: '冲突员工',
        phone: testPhone, // 重复手机号
        campusId: 'campus-bj-hq',
        roleId: 'r4',
      },
      {
        Authorization: `Bearer ${adminToken}`,
      },
    );
    assert(
      duplicatePhoneRes.statusCode === 400,
      '重复手机号录入被正确拦截 (HTTP 400 Bad Request)',
    );
    assert(
      (duplicatePhoneRes.body.message || '').includes('绑定') ||
        (duplicatePhoneRes.body.message || '').includes('手机号码'),
      `友好错误提示包含冲突拦截说明: "${duplicatePhoneRes.body.message}"`,
    );

    // 6. 密码错误测试
    console.log('\n👉 测试 6: 手机号登录输入错误密码校验');
    const wrongPwdRes = await request('POST', '/api/auth/login', {
      account: testPhone,
      password: 'wrong_password_999',
    });
    assert(
      wrongPwdRes.statusCode === 401,
      '密码错误被拦截并返回 401 Unauthorized',
    );
    assert(
      (wrongPwdRes.body.message || '').includes('密码错误'),
      `错误提示包含密码错误信息: "${wrongPwdRes.body.message}"`,
    );

    // 7. 不存在手机号测试
    console.log('\n👉 测试 7: 未注册手机号登录校验');
    const nonexistentRes = await request('POST', '/api/auth/login', {
      account: '19999999999',
      password: '123456',
    });
    assert(
      nonexistentRes.statusCode === 401,
      '未注册手机号登录被拦截并返回 401 Unauthorized',
    );
    assert(
      (nonexistentRes.body.message || '').includes('账号不存在'),
      `错误提示准确提示账号不存在: "${nonexistentRes.body.message}"`,
    );

    // 8. 数据清理
    console.log('\n👉 测试 8: 测试现场环境安全清理');
    if (testUserId) {
      const delRes = await request('DELETE', `/api/system/users/${testUserId}`, null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert(
        delRes.statusCode === 200 || delRes.statusCode === 204,
        `成功删除测试员工账号 (id=${testUserId})`,
      );
    }
  } catch (err) {
    console.error('测试异常终止:', err);
    failCount++;
  }

  console.log(`\n========================================`);
  console.log(`测试完成: 通过 ${passCount} 项, 失败 ${failCount} 项`);
  console.log(`========================================`);

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
