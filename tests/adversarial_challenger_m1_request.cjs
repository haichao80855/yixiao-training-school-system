/**
 * 对抗性验证测试套件：前端网络层防假双写与错误透传实测
 * 针对 src/utils/request.ts 的对抗测试
 */
const path = require('node:path');
const assert = require('node:assert');
const createJiti = require('jiti');

// 模拟浏览器基础环境 (localStorage, window)
global.window = global;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const { request } = jiti('../src/utils/request.ts');

async function runTests() {
  console.log('=== 对抗性测试: src/utils/request.ts 防假双写与异常抛出实测 ===\n');
  let passed = 0;
  let total = 0;

  // 辅助函数：替换 global.fetch
  function mockFetch(handler) {
    global.fetch = async (url, options) => {
      return handler(url, options);
    };
  }

  // 1. POST 请求遇 HTTP 400，传入 fallbackData，必须直接抛出异常，绝不回退 fallback
  total++;
  mockFetch(async () => {
    return {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      async json() {
        return { success: false, message: '【实测】参数校验失败: 课程代码不可为空' };
      }
    };
  });

  try {
    await request('/api/curriculum/courses', {
      method: 'POST',
      body: JSON.stringify({}),
      fallbackData: { fake: 'POST回退假数据' }
    });
    assert.fail('POST 400 应该抛出异常，但意外成功并返回了数据！');
  } catch (err) {
    assert.strictEqual(
      err.message,
      '【实测】参数校验失败: 课程代码不可为空',
      `预期抛出后端真实错误信息，但捕获为: ${err.message}`
    );
    console.log('✅ 测试 1 通过: POST 400 携带 fallbackData 强阻断，真实抛出异常，绝无伪造成功');
    passed++;
  }

  // 2. POST 请求遇 HTTP 500 (服务端崩溃/事务冲突)，传入 fallbackData，必须直接抛出异常
  total++;
  mockFetch(async () => {
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      async json() {
        return { success: false, message: 'PrismaClientKnownRequestError: Unique constraint failed' };
      }
    };
  });

  try {
    await request('/api/students/1/wallet/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
      fallbackData: { success: true, balance: 99999 }
    });
    assert.fail('POST 500 应该抛出异常，但意外返回了 fallbackData！');
  } catch (err) {
    assert.ok(err.message.includes('Unique constraint failed'));
    console.log('✅ 测试 2 通过: POST 500 强阻断，禁止 fallbackData 伪造充值成功');
    passed++;
  }

  // 3. PUT 请求遇 HTTP 404，传入 fallbackData，必须直接抛出异常
  total++;
  mockFetch(async () => {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      async json() {
        return { message: '目标班级不存在或已被删除' };
      }
    };
  });

  try {
    await request('/api/educational/classes/cls-999', {
      method: 'PUT',
      body: JSON.stringify({ name: '修改班级' }),
      fallbackData: { id: 'cls-999', name: '假修改成功' }
    });
    assert.fail('PUT 404 应该抛出异常，但意外返回了 fallbackData！');
  } catch (err) {
    assert.strictEqual(err.message, '目标班级不存在或已被删除');
    console.log('✅ 测试 3 通过: PUT 404 强阻断，禁止 fallbackData 伪造修改成功');
    passed++;
  }

  // 4. DELETE 请求遇 HTTP 400 (三级依赖关联完整性拦截)，传入 fallbackData，必须直接抛出异常
  total++;
  mockFetch(async () => {
    return {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      async json() {
        return { message: '该班级存在关联排课日程，禁止删除！' };
      }
    };
  });

  try {
    await request('/api/educational/classes/cls-001', {
      method: 'DELETE',
      fallbackData: { success: true, deleted: true }
    });
    assert.fail('DELETE 400 应该抛出异常，但意外返回了 fallbackData！');
  } catch (err) {
    assert.strictEqual(err.message, '该班级存在关联排课日程，禁止删除！');
    console.log('✅ 测试 4 通过: DELETE 400 强阻断，班级删除拦截真实抛出，禁止假删除');
    passed++;
  }

  // 5. PATCH 请求遇 HTTP 403 (跨校区越权拦截)，传入 fallbackData，必须直接抛出异常
  total++;
  mockFetch(async () => {
    return {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      async json() {
        return { message: 'Forbidden: 越权访问其他分校数据' };
      }
    };
  });

  try {
    await request('/api/financial/orders/ord-001', {
      method: 'PATCH',
      body: JSON.stringify({ actualAmount: 0 }),
      fallbackData: { success: true }
    });
    assert.fail('PATCH 403 应该抛出异常，但意外返回了 fallbackData！');
  } catch (err) {
    assert.ok(err.message.includes('越权访问其他分校数据'));
    console.log('✅ 测试 5 通过: PATCH 403 跨校区越权强阻断，禁止假双写回退');
    passed++;
  }

  // 6. 写操作 (POST) 遇网络完全断开 (TypeError: Failed to fetch)，传入 fallbackData，必须直接抛出网络异常
  total++;
  mockFetch(async () => {
    throw new TypeError('Failed to fetch (Network connection refused)');
  });

  try {
    await request('/api/educational/roll-call', {
      method: 'POST',
      body: JSON.stringify({ scheduleId: 'sch-1', attendances: [] }),
      fallbackData: { success: true, fromMock: true }
    });
    assert.fail('网络错误时写操作应该抛出异常，但意外回退了 fallbackData！');
  } catch (err) {
    assert.ok(err.message.includes('Failed to fetch'));
    console.log('✅ 测试 6 通过: 网络断开时 POST 写操作绝不回退 fallbackData，真实抛出网络异常');
    passed++;
  }

  // 7. 读操作 (GET) 遇后端未启动时，优雅降级返回 fallbackData (读操作离线平滑预览兼容)
  total++;
  mockFetch(async () => {
    return {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      async json() {
        return { message: 'Bad Gateway' };
      }
    };
  });

  const getFallbackRes = await request('/api/curriculum/subjects', {
    method: 'GET',
    fallbackData: [{ id: 'sub-1', name: '离线平滑学科列表' }]
  });
  assert.strictEqual(getFallbackRes.success, true);
  assert.strictEqual(getFallbackRes.fromMock, true);
  assert.strictEqual(getFallbackRes.data[0].name, '离线平滑学科列表');
  console.log('✅ 测试 7 通过: GET 读操作保留离线平滑预览能力 (fallbackData 有效)');
  passed++;

  // 8. 写操作 (POST) 在 200 OK 时正常返回后端真实数据，且 fromMock 为 false
  total++;
  mockFetch(async () => {
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, data: { orderId: 'ord-real-999', status: 'paid' }, message: '订单创建成功' };
      }
    };
  });

  const postSuccessRes = await request('/api/financial/orders', {
    method: 'POST',
    body: JSON.stringify({ amount: 1999 })
  });
  assert.strictEqual(postSuccessRes.success, true);
  assert.strictEqual(postSuccessRes.fromMock, false);
  assert.strictEqual(postSuccessRes.data.orderId, 'ord-real-999');
  console.log('✅ 测试 8 通过: POST 200 正常解析后端响应，fromMock: false');
  passed++;

  console.log(`\n=== 测试结果: ${passed}/${total} 用例全部通过 (100.0%) ===`);
}

runTests().catch(err => {
  console.error('测试异常失败:', err);
  process.exit(1);
});
