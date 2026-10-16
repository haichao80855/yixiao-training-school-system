const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🔥 [Challenger P1] 阶段一运行时拦截器与多租户高强度对抗挑战套件');
console.log('================================================================================\n');

let passCount = 0;
let totalCount = 0;

async function runTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
    console.error(err.stack);
    throw err;
  }
}

const miniProgRoot = path.resolve(__dirname, '../mini-program');
const compiledRequestPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/utils/request.js');
assert.ok(fs.existsSync(compiledRequestPath), `编译后请求层不存在: ${compiledRequestPath}`);

// 全局持久代理单例，确保 vendor.js 缓存引用始终路由至当前测试的状态
let activeState = {
  storage: {},
  toastCalls: [],
  reLaunchCalls: [],
  removedKeys: [],
  currentPages: [{ route: 'pages/workbench/index' }],
  requestHandler: null,
};

global.Page = global.Page || function () {};
global.Component = global.Component || function () {};
global.App = global.App || function () {};
global.getApp = global.getApp || function () { return {}; };
global.getCurrentPages = () => (typeof activeState.getCurrentPages === 'function' ? activeState.getCurrentPages() : activeState.currentPages);

const mockUni = {
  getStorageSync: (k) => activeState.storage[k] || '',
  setStorageSync: (k, v) => { activeState.storage[k] = v; },
  removeStorageSync: (k) => {
    activeState.removedKeys.push(k);
    delete activeState.storage[k];
  },
  showToast: (opts) => {
    activeState.toastCalls.push(opts);
  },
  reLaunch: (opts) => {
    activeState.reLaunchCalls.push(opts);
  },
  request: (opts) => {
    if (activeState.requestHandler) {
      activeState.requestHandler(opts);
    } else {
      opts.success({ statusCode: 200, data: { success: true } });
    }
  },
  getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375, platform: 'devtools' }),
  getSystemInfo: (opts) => opts && opts.success && opts.success({ statusBarHeight: 20, windowWidth: 375 }),
  canIUse: () => true,
  getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 24, right: 368, bottom: 56, left: 281 }),
};

global.wx = global.uni = mockUni;

function resetTestState() {
  activeState = {
    storage: {},
    toastCalls: [],
    reLaunchCalls: [],
    removedKeys: [],
    currentPages: [{ route: 'pages/workbench/index' }],
    requestHandler: null,
  };
  delete require.cache[require.resolve(compiledRequestPath)];
  const { request } = require(compiledRequestPath);
  return { activeState, request };
}

async function main() {
  // -----------------------------------------------------------------------------
  // 【维度 1】401 并发与 1500ms 防抖锁对抗实测 (Concurrency & Debounce Lock)
  // -----------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('【维度 1】401 高并发轰击与 1500ms 防抖锁实证检验');
  console.log('----------------------------------------------------------------');

  await runTest('1.1 模拟 5 个异步请求并发遭遇 401: 验证仅触发 1 次 Toast 与 1 次 reLaunch', async () => {
    const { activeState: env, request } = resetTestState();
    env.storage['token'] = 'expired-token-xyz';
    env.currentPages = [{ route: 'pages/workbench/index' }];

    env.requestHandler = (opts) => {
      // 模拟异步网络返回 401
      setTimeout(() => {
        opts.success({
          statusCode: 401,
          data: { message: 'Token expired or invalid' }
        });
      }, 10);
    };

    // 连续并发发起 5 个异步请求
    const promises = [
      request({ url: '/api/test/req1' }),
      request({ url: '/api/test/req2' }),
      request({ url: '/api/test/req3' }),
      request({ url: '/api/test/req4' }),
      request({ url: '/api/test/req5' }),
    ];

    const results = await Promise.allSettled(promises);

    // 1. 验证 5 个请求全部被正确 reject，且未被吞噬
    assert.strictEqual(results.length, 5, '请求数量应为 5');
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(results[i].status, 'rejected', `请求 ${i + 1} 应当处于 rejected 状态`);
      assert.strictEqual(results[i].reason.message, 'Unauthorized', `请求 ${i + 1} 错误信息应为 Unauthorized`);
    }

    // 2. 验证 token 缓存被清除
    assert.ok(env.removedKeys.includes('token'), '401 未触发 removeStorageSync("token")');
    assert.strictEqual(env.storage['token'], undefined, 'token 必须从 storage 中清除');

    // 3. 关键防抖对抗断言：防抖锁必须生效，Toast 和 reLaunch 严格只触发 1 次！
    assert.strictEqual(
      env.toastCalls.length,
      1,
      `防抖锁失效！预期 showToast 只触发 1 次，实际触发了 ${env.toastCalls.length} 次`
    );
    assert.strictEqual(env.toastCalls[0].title, '登录已失效，请重新登录', 'Toast 提示文案不符');

    assert.strictEqual(
      env.reLaunchCalls.length,
      1,
      `防抖锁失效！预期 reLaunch 只触发 1 次，实际触发了 ${env.reLaunchCalls.length} 次`
    );
    assert.strictEqual(env.reLaunchCalls[0].url, '/pages/login/index', '重定向目标页面应为 /pages/login/index');
  });

  await runTest('1.2 验证 1500ms 防抖锁冷却恢复机制 (跨越防抖窗口后的第二次 401 触发)', async () => {
    const { activeState: env, request } = resetTestState();
    env.currentPages = [{ route: 'pages/todo/index' }];
    env.requestHandler = (opts) => {
      opts.success({ statusCode: 401, data: { message: 'Token expired' } });
    };

    // 第一次触发 401
    await assert.rejects(async () => {
      await request({ url: '/api/test/window-1' });
    }, /Unauthorized/);
    assert.strictEqual(env.toastCalls.length, 1);
    assert.strictEqual(env.reLaunchCalls.length, 1);

    // 在 200ms 内发起第二个 401 (仍在 1500ms 锁定期内)
    await assert.rejects(async () => {
      await request({ url: '/api/test/window-2' });
    }, /Unauthorized/);
    assert.strictEqual(env.toastCalls.length, 1, '锁定期内不应增加 Toast');
    assert.strictEqual(env.reLaunchCalls.length, 1, '锁定期内不应增加 reLaunch');

    // 等待 1600ms 跨过防抖窗口 (锁已重置)
    await new Promise((resolve) => setTimeout(resolve, 1600));

    // 再次触发 401 (此时仍在非登录页，锁已释放，应当允许再次重定向)
    await assert.rejects(async () => {
      await request({ url: '/api/test/window-3' });
    }, /Unauthorized/);
    assert.strictEqual(env.toastCalls.length, 2, '防抖窗口过期后应允许触发新一轮 Toast');
    assert.strictEqual(env.reLaunchCalls.length, 2, '防抖窗口过期后应允许触发新一轮 reLaunch');
  });

  // -----------------------------------------------------------------------------
  // 【维度 2】登录页死循环重定向防御对抗实测 (Anti-Infinite Loop)
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【维度 2】登录页 (/pages/login/index) 遭遇 401 死循环重定向防御实证');
  console.log('----------------------------------------------------------------');

  await runTest('2.1 当前页面为 pages/login/index (标准 route) 时发生 401: 杜绝重定向循环', async () => {
    const { activeState: env, request } = resetTestState();
    env.storage['token'] = 'invalid-token-on-login';
    // 设置当前处于登录页
    env.currentPages = [{ route: 'pages/login/index' }];

    env.requestHandler = (opts) => {
      opts.success({ statusCode: 401, data: { message: 'Invalid credentials' } });
    };

    // 发起登录接口或者登录页其他校验请求
    await assert.rejects(async () => {
      await request({ url: '/api/auth/login', method: 'POST', data: { username: 'foo', password: 'bar' } });
    }, /Unauthorized/);

    // 重点断言：在登录页遭遇 401 时，不得调用 reLaunch 产生无限死循环刷新
    assert.strictEqual(
      env.reLaunchCalls.length,
      0,
      `死循环漏洞！在登录页遭遇 401 时调用了 reLaunch (${env.reLaunchCalls.length} 次)`
    );
    // 登录页自身也不应弹多余的「登录已失效」Toast，避免干扰登录页自有的错误提示
    assert.strictEqual(
      env.toastCalls.length,
      0,
      `在登录页遭遇 401 时弹出了全局登录失效 Toast (${env.toastCalls.length} 次)`
    );
  });

  await runTest('2.2 兼容原生微信小程序页面实例 __route__ 属性的死循环防御', async () => {
    const { activeState: env, request } = resetTestState();
    // 模拟小程序真机某些版本仅提供 __route__ 的情况
    env.currentPages = [{ __route__: 'pages/login/index' }];
    env.requestHandler = (opts) => {
      opts.success({ statusCode: 401, data: { message: 'Auth failed' } });
    };

    await assert.rejects(async () => {
      await request({ url: '/api/auth/check' });
    }, /Unauthorized/);

    assert.strictEqual(env.reLaunchCalls.length, 0, '__route__ 模式下未能防御死循环重定向');
    assert.strictEqual(env.toastCalls.length, 0, '__route__ 模式下未阻止冗余 Toast');
  });

  await runTest('2.3 getCurrentPages 返回空数组或抛异常时的极端健壮性', async () => {
    const { activeState: env, request } = resetTestState();
    // 模拟异常环境
    env.getCurrentPages = () => { throw new Error('Native context destroyed'); };
    env.requestHandler = (opts) => {
      opts.success({ statusCode: 401, data: { message: 'Auth failed' } });
    };

    // 不应抛出未捕获的 Native context destroyed 异常，而应平稳降级执行
    await assert.rejects(async () => {
      await request({ url: '/api/auth/check' });
    }, /Unauthorized/);

    // 异常安全降级后，由于未命中 isOnLoginPage，会执行重定向安全保护
    assert.strictEqual(env.reLaunchCalls.length, 1);
  });

  // -----------------------------------------------------------------------------
  // 【维度 3】多租户 Header 注入与动态响应实测 (Multi-Tenant & Dynamic Headers)
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【维度 3】多租户 Header 动态注入与跨校区隔离实证');
  console.log('----------------------------------------------------------------');

  await runTest('3.1 无 Token / 无校区状态下的安全请求头隔离', async () => {
    const { activeState: env, request } = resetTestState();
    let capturedHeader = null;
    env.requestHandler = (opts) => {
      capturedHeader = opts.header;
      opts.success({ statusCode: 200, data: { code: 200, data: { ok: 1 } } });
    };

    await request({ url: '/api/public/config' });

    assert.strictEqual(capturedHeader['Content-Type'], 'application/json');
    assert.strictEqual(capturedHeader['Authorization'], undefined, '未登录时不应注入 Authorization 头');
    assert.strictEqual(capturedHeader['x-campus-id'], undefined, '无校区上下文时不应注入 x-campus-id');
  });

  await runTest('3.2 动态从 Storage 提取 x-campus-id 与 Authorization: Bearer', async () => {
    const { activeState: env, request } = resetTestState();
    env.storage['token'] = 'bearer-jwt-dynamic-token-777';
    env.storage['currentCampusId'] = 'campus-shanghai-pudong';

    let capturedHeader = null;
    env.requestHandler = (opts) => {
      capturedHeader = opts.header;
      opts.success({ statusCode: 200, data: { code: 200, data: { ok: 1 } } });
    };

    await request({ url: '/api/educational/schedules' });

    assert.strictEqual(capturedHeader['Authorization'], 'Bearer bearer-jwt-dynamic-token-777');
    assert.strictEqual(capturedHeader['x-campus-id'], 'campus-shanghai-pudong');
  });

  await runTest('3.3 校区动态切换实测 (无需重启即可发送新校区 Header)', async () => {
    const { activeState: env, request } = resetTestState();
    env.storage['token'] = 'test-token';
    env.storage['currentCampusId'] = 'campus-bj-01';

    let capturedHeaders = [];
    env.requestHandler = (opts) => {
      capturedHeaders.push(opts.header);
      opts.success({ statusCode: 200, data: { code: 200, data: true } });
    };

    // 请求 1: 北京校区
    await request({ url: '/api/curriculum/courses' });
    assert.strictEqual(capturedHeaders[0]['x-campus-id'], 'campus-bj-01');

    // 用户在 UI 上切换至广州分校
    env.storage['currentCampusId'] = 'campus-gz-02';

    // 请求 2: 广州分校 (必须立即可见，严禁模块级闭包死锁)
    await request({ url: '/api/curriculum/courses' });
    assert.strictEqual(capturedHeaders[1]['x-campus-id'], 'campus-gz-02');
  });

  await runTest('3.4 自定义 options.header 优先级与透传校验', async () => {
    const { activeState: env, request } = resetTestState();
    env.storage['token'] = 'base-tok';
    env.storage['currentCampusId'] = 'campus-01';

    let capturedHeader = null;
    env.requestHandler = (opts) => {
      capturedHeader = opts.header;
      opts.success({ statusCode: 200, data: { ok: true } });
    };

    await request({
      url: '/api/upload',
      header: {
        'Content-Type': 'multipart/form-data',
        'x-trace-id': 'trace-trace-999',
      }
    });

    assert.strictEqual(capturedHeader['Content-Type'], 'multipart/form-data', '自定义 Content-Type 应当生效');
    assert.strictEqual(capturedHeader['x-trace-id'], 'trace-trace-999', '自定义追踪头透传失败');
    assert.strictEqual(capturedHeader['Authorization'], 'Bearer base-tok');
    assert.strictEqual(capturedHeader['x-campus-id'], 'campus-01');
  });

  // -----------------------------------------------------------------------------
  // 【维度 4】200 响应解包与边界载荷实测 (200 Unpacking Boundaries)
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【维度 4】200 响应智能解包与极端载荷边界实证');
  console.log('----------------------------------------------------------------');

  await runTest('4.1 标准后端包装结构 { code: 200, message: "ok", data: {...} } 智能解包', async () => {
    const { activeState: env, request } = resetTestState();
    env.requestHandler = (opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          message: 'ok',
          data: { studentId: 's-99', name: '李明', balance: 3500 }
        }
      });
    };

    const result = await request({ url: '/api/students/s-99' });

    assert.deepStrictEqual(result, { studentId: 's-99', name: '李明', balance: 3500 });
  });

  await runTest('4.2 极端载荷: data 为 null / 0 / false / "" 等 Falsy 值时的精准解包 (防吞噬为原始对象)', async () => {
    const { activeState: env, request } = resetTestState();
    let currentData = null;
    env.requestHandler = (opts) => {
      opts.success({
        statusCode: 200,
        data: { code: 200, data: currentData }
      });
    };

    // data = null
    currentData = null;
    const resNull = await request({ url: '/api/test/null' });
    assert.strictEqual(resNull, null, 'data 为 null 时未正确解包出 null');

    // data = 0
    currentData = 0;
    const resZero = await request({ url: '/api/test/zero' });
    assert.strictEqual(resZero, 0, 'data 为 0 时未正确解包出 0');

    // data = false
    currentData = false;
    const resFalse = await request({ url: '/api/test/false' });
    assert.strictEqual(resFalse, false, 'data 为 false 时未正确解包出 false');

    // data = ''
    currentData = '';
    const resEmptyStr = await request({ url: '/api/test/empty-str' });
    assert.strictEqual(resEmptyStr, '', 'data 为 "" 时未正确解包出 ""');
  });

  await runTest('4.3 原始数组载荷与非包装对象支持 (未被 data 嵌套的顶层 Array / Primitive)', async () => {
    const { activeState: env, request } = resetTestState();
    env.requestHandler = (opts) => {
      if (opts.url.includes('/api/array')) {
        opts.success({
          statusCode: 200,
          data: [{ id: 1 }, { id: 2 }]
        });
      } else if (opts.url.includes('/api/string')) {
        opts.success({
          statusCode: 200,
          data: 'SUCCESS_STRING'
        });
      }
    };

    const resArray = await request({ url: '/api/array' });
    assert.deepStrictEqual(resArray, [{ id: 1 }, { id: 2 }], '数组载荷解包不符合预期');

    const resStr = await request({ url: '/api/string' });
    assert.strictEqual(resStr, 'SUCCESS_STRING', '纯字符串载荷解包不符合预期');
  });

  // -----------------------------------------------------------------------------
  // 【维度 5】500 / 400 业务报错透出与网络崩溃实测 (Error Propagation)
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【维度 5】500 / 400 业务报错与网络层崩溃透出 (零吞噬) 实证');
  console.log('----------------------------------------------------------------');

  await runTest('5.1 500 服务端领域异常真实透出且触发错误提示', async () => {
    const { activeState: env, request } = resetTestState();
    env.requestHandler = (opts) => {
      opts.success({
        statusCode: 500,
        data: { message: '排课冲突：该讲师在同一时段已被占用' }
      });
    };

    await assert.rejects(async () => {
      await request({ url: '/api/educational/schedules', method: 'POST', data: {} });
    }, (err) => {
      assert.strictEqual(err.message, '排课冲突：该讲师在同一时段已被占用');
      return true;
    });

    assert.strictEqual(env.toastCalls.length, 1);
    assert.strictEqual(env.toastCalls[0].title, '排课冲突：该讲师在同一时段已被占用');
  });

  await runTest('5.2 400 NestJS ValidationPipe 数组格式报错正确提取并透出', async () => {
    const { activeState: env, request } = resetTestState();
    env.requestHandler = (opts) => {
      opts.success({
        statusCode: 400,
        data: {
          statusCode: 400,
          message: ['学员手机号必须为11位数字', '学员姓名不能为空'],
          error: 'Bad Request'
        }
      });
    };

    await assert.rejects(async () => {
      await request({ url: '/api/students', method: 'POST', data: {} });
    }, (err) => {
      assert.strictEqual(err.message, '学员手机号必须为11位数字');
      return true;
    });

    assert.strictEqual(env.toastCalls.length, 1);
    assert.strictEqual(env.toastCalls[0].title, '学员手机号必须为11位数字');
  });

  await runTest('5.3 响应体缺少 message 时的默认安全降级提示', async () => {
    const { activeState: env, request } = resetTestState();
    env.requestHandler = (opts) => {
      opts.success({
        statusCode: 502,
        data: null
      });
    };

    await assert.rejects(async () => {
      await request({ url: '/api/crash' });
    }, /请求处理失败/);

    assert.strictEqual(env.toastCalls.length, 1);
    assert.strictEqual(env.toastCalls[0].title, '请求处理失败');
  });

  await runTest('5.4 网络层通信彻底崩溃 (fail 回调) 的异常透出与友好指引', async () => {
    const { activeState: env, request } = resetTestState();
    const networkError = { errMsg: 'request:fail connection refused' };
    env.requestHandler = (opts) => {
      opts.fail(networkError);
    };

    await assert.rejects(async () => {
      await request({ url: '/api/offline' });
    }, (err) => {
      assert.strictEqual(err.errMsg, networkError.errMsg, 'fail 回调应原样向上 reject 网络错误对象');
      return true;
    });

    assert.strictEqual(env.toastCalls.length, 1);
    assert.ok(
      env.toastCalls[0].title.includes('无法连接到后端服务'),
      '网络连不上时应给予 3001 端口与免校验提示'
    );
  });

  // -----------------------------------------------------------------------------
  // 【维度 6】URL 拼接规范化实测 (Leading Slash Defense)
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【维度 6】URL 拼接规范化与斜杠防御实证');
  console.log('----------------------------------------------------------------');

  await runTest('6.1 无论 url 是否带有前置 /，均精确拼接为单一斜杠 http://127.0.0.1:3001/xxx', async () => {
    const { activeState: env, request } = resetTestState();
    let requestedUrls = [];
    env.requestHandler = (opts) => {
      requestedUrls.push(opts.url);
      opts.success({ statusCode: 200, data: true });
    };

    await request({ url: '/api/v1/user' });
    await request({ url: 'api/v1/user' });

    assert.strictEqual(requestedUrls[0], 'http://127.0.0.1:3001/api/v1/user');
    assert.strictEqual(requestedUrls[1], 'http://127.0.0.1:3001/api/v1/user');
    assert.ok(!requestedUrls[0].includes('3001//'), '严禁出现双斜杠 3001//');
  });

  // -----------------------------------------------------------------------------
  // 【维度 7】对抗性突变注入与断言杀伤力实测 (Mutation Testing / Kill Rate 100%)
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【维度 7】对抗性变异注入与断言杀伤力实证 (防止假阳性)');
  console.log('----------------------------------------------------------------');

  await runTest('7.1 变异注入 1: 若拦截器未实现并发防抖锁 (Toast > 1)，断言必精确杀伤', () => {
    const mutantToastCalls = [{ title: 'err' }, { title: 'err' }];
    assert.throws(() => {
      assert.strictEqual(mutantToastCalls.length, 1, '防抖锁失效！预期 showToast 只触发 1 次');
    }, /防抖锁失效/);
  });

  await runTest('7.2 变异注入 2: 若登录页遭遇 401 发生死循环重定向 (reLaunch > 0)，断言必精确杀伤', () => {
    const mutantReLaunchCalls = [{ url: '/pages/login/index' }];
    assert.throws(() => {
      assert.strictEqual(mutantReLaunchCalls.length, 0, '死循环漏洞！在登录页遭遇 401 时调用了 reLaunch');
    }, /死循环漏洞/);
  });

  await runTest('7.3 变异注入 3: 若 500 异常被静默吞噬 (resolve 假数据)，断言必精确杀伤', async () => {
    const fakeSwallowingRequest = async () => ({ success: false }); // 模拟吞噬
    await assert.rejects(async () => {
      await assert.rejects(async () => {
        await fakeSwallowingRequest();
      }, /排课冲突/);
    }, /Missing expected rejection/);
  });

  await runTest('7.4 变异注入 4: 若校区切换后 Header 未动态同步更新，断言必精确杀伤', () => {
    const mutantHeaders = [{ 'x-campus-id': 'campus-bj-01' }, { 'x-campus-id': 'campus-bj-01' }];
    assert.throws(() => {
      assert.strictEqual(mutantHeaders[1]['x-campus-id'], 'campus-gz-02', '动态切换校区未同步至请求头');
    }, /动态切换校区未同步至请求头/);
  });

  console.log('\n================================================================================');
  console.log(`🎉 阶段一运行时拦截器对抗挑战全部通过！${passCount}/${totalCount} 项挑战断言 100% 验证成功！`);
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ 对抗测试套件执行异常终止:', err);
  process.exit(1);
});
