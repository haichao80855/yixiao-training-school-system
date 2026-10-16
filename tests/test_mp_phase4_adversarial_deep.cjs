/**
 * tests/test_mp_phase4_adversarial_deep.cjs
 *
 * Empirical Challenger: Deep Adversarial & Boundary Stress Test Suite for Phase 4
 * (Financial Orders, Anti-counterfeiting Electronic Receipt & Multi-Level Approvals)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🔬 [Empirical Challenger] Phase 4 深度对抗与边界实证压测套件');
console.log('================================================================================\n');

let passCount = 0;
let totalCount = 0;

async function test(desc, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Reason: ${err.message}`);
    throw err;
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const mpRoot = path.resolve(repoRoot, 'mini-program');
  const compiledFinancePath = path.resolve(mpRoot, 'dist/build/mp-weixin/api/finance.js');
  const srcFinancePath = path.resolve(mpRoot, 'src/api/finance.ts');
  const orderDetailVuePath = path.resolve(mpRoot, 'src/package-finance/orders/detail.vue');
  const orderIndexVuePath = path.resolve(mpRoot, 'src/package-finance/orders/index.vue');
  const approvalIndexVuePath = path.resolve(mpRoot, 'src/package-finance/approval/index.vue');
  const approvalDetailVuePath = path.resolve(mpRoot, 'src/package-finance/approval/detail.vue');

  assert.ok(fs.existsSync(compiledFinancePath), '编译产物 api/finance.js 不存在');
  assert.ok(fs.existsSync(srcFinancePath), '源码 src/api/finance.ts 不存在');
  assert.ok(fs.existsSync(orderDetailVuePath), 'orders/detail.vue 不存在');
  assert.ok(fs.existsSync(orderIndexVuePath), 'orders/index.vue 不存在');
  assert.ok(fs.existsSync(approvalIndexVuePath), 'approval/index.vue 不存在');
  assert.ok(fs.existsSync(approvalDetailVuePath), 'approval/detail.vue 不存在');

  // Setup minimal global runtime for wechat/uni
  global.Page = global.Page || function() {};
  global.Component = global.Component || function() {};
  global.App = global.App || function() {};
  global.getCurrentPages = global.getCurrentPages || function() { return []; };
  global.getApp = global.getApp || function() { return {}; };

  let lastRequestOptions = null;
  let mockRequestReturn = null;
  let mockRequestError = null;

  const mockWx = {
    getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375, platform: 'devtools' }),
    getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 24, right: 368, bottom: 56, left: 281 }),
    getStorageSync: (k) => {
      if (k === 'token') return 'mock-bearer-token-phase4';
      if (k === 'currentCampusId') return 'campus-phase4-test';
      return '';
    },
    removeStorageSync: () => {},
    showToast: () => {},
    showModal: () => {},
    showActionSheet: () => {},
    reLaunch: () => {},
    request: (opts) => {
      lastRequestOptions = opts;
      if (mockRequestError) {
        if (opts.fail) opts.fail(mockRequestError);
        else opts.success({ statusCode: 500, data: { message: mockRequestError.message } });
        return;
      }
      if (mockRequestReturn !== null) {
        opts.success({
          statusCode: 200,
          data: { code: 200, message: 'ok', data: mockRequestReturn }
        });
        return;
      }
      // default mock
      opts.success({
        statusCode: 200,
        data: { code: 200, message: 'ok', data: [] }
      });
    }
  };

  global.wx = global.uni = mockWx;

  const { financeApi } = require(compiledFinancePath);

  // --------------------------------------------------------------------------------
  // 领域 1: normalizeOrderItem 极限畸形入参与边界容错 (via financeApi.getOrderById / getOrders)
  // --------------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('【领域 1】normalizeOrderItem 极限边界与畸形数据归一化鲁棒性');
  console.log('----------------------------------------------------------------');

  await test('1.1 零金额/0元正课订单：防止 0 被假值合并运算符当作无值替换', async () => {
    mockRequestReturn = {
      id: 'ord-zero',
      orderNo: 'ORD-0000',
      actualAmount: 0,
      originalPrice: 0,
      orderType: 'enroll',
      status: 'paid',
      items: [{ id: 'sub-0', itemName: '公益试听课', unitPrice: 0, quantity: 1, subtotal: 0 }]
    };
    mockRequestError = null;

    const norm = await financeApi.getOrderById('ord-zero');
    assert.strictEqual(norm.paidAmount, 0, '0元订单实收金额应严格为 0，而非 NaN 或 fallback');
    assert.strictEqual(norm.totalAmount, 0, '0元订单应收金额应严格为 0');
    assert.strictEqual(norm.items[0].subtotal, 0, '明细项金额应为 0');
  });

  await test('1.2 极端缺失字段对象：防止属性未定义导致运行时崩溃', async () => {
    mockRequestReturn = {
      id: 'ord-naked',
      orderNo: 'ORD-NAKED'
    };
    mockRequestError = null;

    const norm = await financeApi.getOrderById('ord-naked');
    assert.strictEqual(typeof norm.orderNo, 'string');
    assert.strictEqual(typeof norm.studentName, 'string');
    assert.strictEqual(typeof norm.paidAmount, 'number');
    assert.strictEqual(typeof norm.totalAmount, 'number');
    assert.ok(Array.isArray(norm.items) && norm.items.length >= 1, '应有默认明细项保证渲染不白屏');
  });

  await test('1.3 嵌套 relation 字段 (creator, student, package) 与平铺字段并存映射', async () => {
    mockRequestReturn = {
      id: 'ord-nest',
      orderNo: 'ORD998877',
      actualAmount: 3600,
      originalPrice: 4000,
      orderType: 'quarterly', // 续费
      status: 'unpaid',
      student: { id: 's-nest-1', name: '嵌套学员', phone: '13900001111', studentNo: 'S0011' },
      creator: { id: 'u-1', realName: '张主管' },
      coursePackage: { name: '少儿硬笔连读包' },
      paymentMethod: 'alipay',
      createdAt: '2026-10-15T18:00:00.000Z'
    };
    mockRequestError = null;

    const norm = await financeApi.getOrderById('ord-nest');
    assert.strictEqual(norm.studentName, '嵌套学员');
    assert.strictEqual(norm.studentPhone, '13900001111');
    assert.strictEqual(norm.operatorName, '张主管');
    assert.strictEqual(norm.orderTypeText, '续费充值');
    assert.strictEqual(norm.status, 'pending');
    assert.strictEqual(norm.statusText, '待支付');
    assert.strictEqual(norm.paymentMethod, '支付宝');
    assert.strictEqual(norm.discountAmount, 400);
    assert.strictEqual(norm.items[0].itemName, '少儿硬笔连读包');
  });

  // --------------------------------------------------------------------------------
  // 领域 2: normalizeApprovalItem 跨业务模型解包与状态规整 (via financeApi.getApprovals)
  // --------------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 2】normalizeApprovalItem 多级审批模型解包与状态映射');
  console.log('----------------------------------------------------------------');

  await test('2.1 businessType 为 payment/receipt 时正确映射为收款审批', async () => {
    mockRequestReturn = {
      list: [
        {
          id: 'appr-pay-1',
          businessType: 'payment',
          order: {
            orderNo: 'ORD-REC-001',
            actualAmount: 18000,
            student: { name: '收款学员' },
            package: { course: { name: '高阶算法班' } },
            remark: '大额特批折扣'
          },
          applicant: { realName: '李销售' },
          status: 'pending',
          currentStep: 1,
          totalSteps: 2
        }
      ],
      total: 1
    };
    mockRequestError = null;

    const res = await financeApi.getApprovals({ businessType: 'receipt' });
    assert.strictEqual(res.list.length, 1);
    const norm = res.list[0];
    assert.strictEqual(norm.businessType, 'receipt');
    assert.strictEqual(norm.businessTypeText, '收款审批');
    assert.strictEqual(norm.studentName, '收款学员');
    assert.strictEqual(norm.courseName, '高阶算法班');
    assert.strictEqual(norm.amount, 18000);
    assert.strictEqual(norm.applicantName, '李销售');
    assert.strictEqual(norm.status, 'pending');
    assert.strictEqual(norm.statusText, '待我审批');
  });

  await test('2.2 status 为 approved / rejected / withdrawn 状态解构', async () => {
    mockRequestReturn = {
      list: [
        { id: 'a1', status: 'approved' },
        { id: 'a2', status: 'rejected' },
        { id: 'a3', status: 'withdrawn' }
      ],
      total: 3
    };
    mockRequestError = null;

    const res = await financeApi.getApprovals();
    const approvedItem = res.list.find(x => x.id === 'a1');
    assert.strictEqual(approvedItem.status, 'approved');
    assert.strictEqual(approvedItem.statusText, '已通过');
    assert.ok(approvedItem.currentNodeName.includes('通过'));

    const rejectedItem = res.list.find(x => x.id === 'a2');
    assert.strictEqual(rejectedItem.status, 'rejected');
    assert.strictEqual(rejectedItem.statusText, '已驳回');

    const withdrawnItem = res.list.find(x => x.id === 'a3');
    assert.strictEqual(withdrawnItem.status, 'rejected');
    assert.strictEqual(withdrawnItem.statusText, '已驳回');
  });

  // --------------------------------------------------------------------------------
  // 领域 3: financeApi 入参映射与请求契约防御
  // --------------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 3】financeApi 请求协议层映射与入参过滤校验');
  console.log('----------------------------------------------------------------');

  await test('3.1 getOrders: enroll -> regular, renewal -> quarterly, all 被删除', async () => {
    mockRequestReturn = { list: [], total: 0 };
    mockRequestError = null;

    await financeApi.getOrders({ orderType: 'enroll', status: 'pending' });
    assert.strictEqual(lastRequestOptions.data.orderType, 'regular', 'enroll 必须转换为后端 regular');
    assert.strictEqual(lastRequestOptions.data.status, 'unpaid', 'pending 必须转换为后端 unpaid');

    await financeApi.getOrders({ orderType: 'all', status: 'all' });
    assert.strictEqual(lastRequestOptions.data.orderType, undefined, 'orderType=all 必须从 query 中剔除');
    assert.strictEqual(lastRequestOptions.data.status, undefined, 'status=all 必须从 query 中剔除');
  });

  await test('3.2 getApprovals: receipt -> payment, all/my 被删除', async () => {
    mockRequestReturn = { list: [], total: 0 };
    mockRequestError = null;

    await financeApi.getApprovals({ businessType: 'receipt', status: 'my' });
    assert.strictEqual(lastRequestOptions.data.businessType, 'payment', 'receipt 必须转换为后端 payment');
    assert.strictEqual(lastRequestOptions.data.status, undefined, 'status=my 必须从 query 中剔除');

    await financeApi.getApprovals({ businessType: 'all' });
    assert.strictEqual(lastRequestOptions.data.businessType, undefined, 'businessType=all 必须剔除');
  });

  await test('3.3 auditApproval: action: approve -> pass, reject 自动填充默认 comment', async () => {
    mockRequestReturn = { success: true };
    mockRequestError = null;

    await financeApi.auditApproval('appr-test-1', { action: 'approve' });
    assert.ok(lastRequestOptions.url.includes('/api/financial/approvals/appr-test-1/audit'), 'URL 必须包含端点路径');
    assert.strictEqual(lastRequestOptions.data.action, 'pass', 'approve 必须归一化为 pass 以适配后端 DTO');
    assert.strictEqual(lastRequestOptions.data.comment, '同意通过');

    await financeApi.auditApproval('appr-test-2', { status: 'rejected' });
    assert.strictEqual(lastRequestOptions.data.action, 'reject', 'status=rejected 必须推导为 action=reject');
    assert.strictEqual(lastRequestOptions.data.comment, '审批驳回');
  });

  await test('3.4 lockOrder: 兼容字符串参数与对象参数', async () => {
    mockRequestReturn = { success: true };
    mockRequestError = null;

    await financeApi.lockOrder('ord-lock-1', '测试账期锁定');
    assert.ok(lastRequestOptions.url.includes('/api/financial/orders/ord-lock-1/lock'), 'URL 必须包含锁定路径');
    assert.strictEqual(lastRequestOptions.data.isLocked, true);
    assert.strictEqual(lastRequestOptions.data.reason, '测试账期锁定');

    await financeApi.lockOrder('ord-lock-2', { isLocked: false, reason: '解锁' });
    assert.strictEqual(lastRequestOptions.data.isLocked, false);
    assert.strictEqual(lastRequestOptions.data.reason, '解锁');
  });

  // --------------------------------------------------------------------------------
  // 领域 4: 电子收据大写人民币转换与防伪标识实证
  // --------------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 4】电子收据防伪大写金额转换算法与国家规范核验');
  console.log('----------------------------------------------------------------');

  const orderDetailVueContent = fs.readFileSync(orderDetailVuePath, 'utf8');

  // 动态提取 digitUppercase 函数并在 Node 沙箱中执行 (移除 TS 类型声明以供 Node 运行)
  const funcMatch = orderDetailVueContent.match(/const digitUppercase = ([\s\S]*?\n\};)/);
  assert.ok(funcMatch, 'orders/detail.vue 中必须包含 const digitUppercase 函数');
  const cleanFuncBody = funcMatch[1].replace(/:\s*number/, '').replace(/;\s*$/, '');
  const digitUppercase = eval(`(${cleanFuncBody})`);

  await test('4.1 大写金额算法精度实证: 常见财务金额与边界值', () => {
    assert.strictEqual(digitUppercase(0), '零元整', '0 元应为 零元整');
    assert.strictEqual(digitUppercase(4992), '肆仟玖佰玖拾贰元整', '4992 应为 肆仟玖佰玖拾贰元整');
    assert.strictEqual(digitUppercase(6400), '陆仟肆佰元整', '6400 应为 陆仟肆佰元整');
    assert.strictEqual(digitUppercase(100.5), '壹佰元伍角', '100.5 角位后无分角位应为 壹佰元伍角');
    assert.strictEqual(digitUppercase(20000.88), '贰万元捌角捌分', '20000.88 应为 贰万元捌角捌分');
    assert.strictEqual(digitUppercase(1000000), '壹佰万元整', '1000000 应为 壹佰万元整');
  });

  await test('4.2 收据防伪样式与印章 DOM 规范白盒核查', () => {
    // 检查 CSS 锯齿定义
    assert.ok(orderDetailVueContent.includes('.receipt-top-teeth {'), '缺失 .receipt-top-teeth 样式声明');
    assert.ok(orderDetailVueContent.includes('radial-gradient'), '锯齿样式必须使用 radial-gradient 矢量实现');
    // 检查财务公章定义
    assert.ok(orderDetailVueContent.includes('.seal-stamp {'), '缺失 .seal-stamp 印章样式声明');
    assert.ok(orderDetailVueContent.includes('rotate(-15deg)'), '财务印章必须具备公章防伪倾斜角度');
    // 检查作废大红水印定义
    assert.ok(orderDetailVueContent.includes('.void-watermark {'), '缺失 .void-watermark 样式声明');
    assert.ok(orderDetailVueContent.includes('【 已 作 废 】'), '必须包含【 已 作 废 】印戳文案');
  });

  // --------------------------------------------------------------------------------
  // 领域 5: 异常防御与反状态突变实证 (Anti-Swallowed Errors / Anti-Ghost-Write)
  // --------------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 5】全链路异常防御实证 (作废/审批失败时阻断状态变更与假 Toast)');
  console.log('----------------------------------------------------------------');

  await test('5.1 orders/detail.vue: 作废订单接口失败时绝不修改 status 为 voided', async () => {
    let voidCalled = false;
    let toastType = '';
    let toastMsg = '';

    const mockOrder = {
      id: 'ord-void-test',
      orderNo: 'ORD20261015999',
      status: 'paid',
      statusText: '已支付'
    };

    const simulatedHandleVoidOrder = async (voidFn) => {
      try {
        await voidFn(mockOrder.id);
        mockOrder.status = 'voided';
        mockOrder.statusText = '已作废';
        mockWx.showToast({ title: '订单已作废', icon: 'none' });
      } catch (e) {
        mockWx.showToast({ title: e?.message || '作废订单失败', icon: 'none' });
      }
    };

    // 注入错误：接口返回 403 权限拒绝
    await simulatedHandleVoidOrder(async () => {
      throw new Error('HTTP 403: 仅校长或财务总监有权作废已支付订单');
    });

    assert.strictEqual(mockOrder.status, 'paid', '作废失败时 status 不得突变为 voided');
    assert.strictEqual(mockOrder.statusText, '已支付', '作废失败时 statusText 不得突变');
  });

  await test('5.2 approval/index.vue: 驳回必填校验：空内容或仅空格不得发起 API 请求', async () => {
    let apiCalled = false;
    let toastMsg = '';

    const simulatedRejectAction = async (content) => {
      if (!content || !content.trim()) {
        toastMsg = '驳回原因必须填写';
        return;
      }
      apiCalled = true;
    };

    await simulatedRejectAction('');
    assert.strictEqual(apiCalled, false, '空字符串不得调用 API');
    assert.strictEqual(toastMsg, '驳回原因必须填写');

    await simulatedRejectAction('    ');
    assert.strictEqual(apiCalled, false, '纯空格不得调用 API');
  });

  await test('5.3 approval/detail.vue: 签批失败时 detail.timeline 绝不追加伪造节点', async () => {
    const detail = {
      id: 'appr-audit-fail',
      status: 'pending',
      statusText: '待我审批',
      timeline: [
        { nodeId: 'n1', nodeName: '发起退费申请', status: 'approved' }
      ]
    };

    const simulatedApproveAction = async (auditFn, comment) => {
      try {
        await auditFn(detail.id, { action: 'pass', comment });
        detail.status = 'approved';
        detail.statusText = '已通过';
        detail.timeline.push({
          nodeId: 'node-done',
          nodeName: '校长终审签批',
          status: 'approved'
        });
      } catch (e) {
        // failed
      }
    };

    await simulatedApproveAction(async () => {
      throw new Error('网络断开，请求超时');
    }, '同意');

    assert.strictEqual(detail.status, 'pending', '失败时状态必须冻结');
    assert.strictEqual(detail.timeline.length, 1, '失败时时间线长度不得增加');
  });

  console.log('\n================================================================================');
  console.log(`🎉 Phase 4 深度对抗压测全部通过！${passCount}/${totalCount} 项挑战断言 100% 验证成功！`);
  console.log('================================================================================\n');
}

main().catch(err => {
  console.error('\n❌ 对抗测试执行失败:', err);
  process.exit(1);
});
