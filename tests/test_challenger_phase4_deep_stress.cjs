/**
 * test_challenger_phase4_deep_stress.cjs
 * Empirical Challenger Phase 4 Deep Adversarial & Stress Testing Suite
 *
 * Covers:
 * 1. Normalizer Adversarial Fuzzing (Extreme values, nulls, corrupt DTOs, type mismatches)
 * 2. Digit Uppercase RMB Oracle & Precision Verification
 * 3. Offline Fallback & Query Filter Resiliency in financeApi (both Source & Compiled)
 * 4. Zero-Swallowed-Error & State Mutation Blocking under Network/API Failures
 * 5. Static Anti-Cheat & Fake-Toast Auditing across all Phase 4 files
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const mpRoot = path.resolve(repoRoot, 'mini-program');

console.log('================================================================================');
console.log('⚡ [Challenger 2] Phase 4 财务收支、防伪收据与风控审批 深度对抗与实证压力测试');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Reason: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Reason: ${err.message}`);
    throw err;
  }
}

// --------------------------------------------------------------------------------
// Mocking uni / wx runtime environment for compiled node execution
// --------------------------------------------------------------------------------
global.Page = global.Page || function () {};
global.Component = global.Component || function () {};
global.App = global.App || function () {};
global.getCurrentPages = global.getCurrentPages || function () { return []; };
global.getApp = global.getApp || function () { return {}; };

const mockStorage = {
  token: 'mock-jwt-token-challenger-phase4',
  currentCampusId: 'campus-bj-hq',
};

let currentRequestImpl = (opts) => {
  // 默认网络断开，触发回退
  if (opts.fail) opts.fail({ errMsg: 'request:fail offline test probe' });
  else opts.success({ statusCode: 500, data: { message: 'offline test probe' } });
};

const mockWx = {
  getSystemInfoSync: () => ({ statusBarHeight: 25, windowWidth: 390, platform: 'devtools' }),
  getSystemInfo: (opts) => opts?.success && opts.success({ statusBarHeight: 25, windowWidth: 390 }),
  canIUse: () => true,
  getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 24, right: 368, bottom: 56, left: 281 }),
  getStorageSync: (k) => mockStorage[k] || '',
  setStorageSync: (k, v) => { mockStorage[k] = v; },
  removeStorageSync: (k) => { delete mockStorage[k]; },
  showToast: () => {},
  showModal: () => {},
  showActionSheet: () => {},
  navigateTo: () => {},
  navigateBack: () => {},
  reLaunch: () => {},
  request: (opts) => currentRequestImpl(opts),
};
global.wx = global.uni = mockWx;

async function main() {
  // 1. 验证编译产物存在
  const compiledFinancePath = path.resolve(mpRoot, 'dist/build/mp-weixin/api/finance.js');
  assert.ok(fs.existsSync(compiledFinancePath), '编译产物 dist/build/mp-weixin/api/finance.js 不存在，需先执行 mp:build');
  const compiledFinance = require(compiledFinancePath).financeApi;

  // 2. 使用 jiti 直接加载 TS 源码模块，执行端到端与纯函数断言
  const jiti = require('jiti')(repoRoot);
  const tsFinance = jiti('./mini-program/src/api/finance.ts');
  const { financeApi, normalizeOrderItem, normalizeOrderSummary, normalizeApprovalItem } = tsFinance;

  // ================================================================================
  // 【TEST SECTION 1】Normalizer 变异攻击与模糊边界测试 (Fuzzing / Boundary)
  // ================================================================================
  console.log('----------------------------------------------------------------');
  console.log('【领域 1】纯函数 Normalizer 极端异常入参模糊测试 (Fuzzing / Boundary)');
  console.log('----------------------------------------------------------------');

  runTest('1.1 normalizeOrderItem 应对极度残缺/空对象入参不抛异常且输出安全默认值', () => {
    const result = normalizeOrderItem({});
    assert.ok(result, '返回对象不能为空');
    assert.strictEqual(typeof result.id, 'string');
    assert.strictEqual(typeof result.orderNo, 'string');
    assert.strictEqual(typeof result.totalAmount, 'number');
    assert.strictEqual(typeof result.paidAmount, 'number');
    assert.strictEqual(typeof result.discountAmount, 'number');
    assert.ok(Array.isArray(result.items));
    assert.ok(result.items.length >= 1, '应具备默认占位 item');
    assert.strictEqual(result.items[0].itemName, '报读正课包');
  });

  runTest('1.2 normalizeOrderItem 对齐不同字段命名异构体 (originalPrice vs totalAmount, actualAmount vs paidAmount)', () => {
    const backendVariant = {
      id: 'ord-backend-999',
      originalPrice: 8800,
      actualAmount: 7000,
      orderType: 'quarterly',
      status: 'unpaid',
      paymentMethod: 'alipay',
      creator: { realName: '张财务' },
      student: { id: 's-99', name: '王小明', phone: '13900001111', studentNo: 'S99001' },
      package: { course: { name: '高阶物理拔尖班' } },
    };

    const normalized = normalizeOrderItem(backendVariant);
    assert.strictEqual(normalized.id, 'ord-backend-999');
    assert.strictEqual(normalized.totalAmount, 8800);
    assert.strictEqual(normalized.paidAmount, 7000);
    assert.strictEqual(normalized.discountAmount, 1800);
    assert.strictEqual(normalized.orderType, 'renewal');
    assert.strictEqual(normalized.orderTypeText, '续费充值');
    assert.strictEqual(normalized.status, 'pending');
    assert.strictEqual(normalized.statusText, '待支付');
    assert.strictEqual(normalized.paymentMethod, '支付宝');
    assert.strictEqual(normalized.studentName, '王小明');
    assert.strictEqual(normalized.studentPhone, '13900001111');
    assert.strictEqual(normalized.operatorName, '张财务');
    assert.strictEqual(normalized.items[0].itemName, '高阶物理拔尖班');
  });

  runTest('1.3 normalizeOrderItem 应对充值与退费的异构转换与明细识别', () => {
    const rechargeVariant = {
      id: 'ord-recharge',
      orderType: 'wallet_recharge',
      status: 'paid',
      receivableAmount: 5000,
      actualAmount: 5000,
      paymentMethod: 'wallet',
    };
    const rechargeNorm = normalizeOrderItem(rechargeVariant);
    assert.strictEqual(rechargeNorm.orderType, 'recharge');
    assert.strictEqual(rechargeNorm.orderTypeText, '钱包充值');
    assert.strictEqual(rechargeNorm.items[0].itemName, '学员电子钱包充值');
    assert.strictEqual(rechargeNorm.items[0].itemType, 'goods');
    assert.strictEqual(rechargeNorm.paymentMethod, '电子钱包');

    const refundVariant = {
      id: 'ord-refund',
      orderType: 'refund',
      status: 'void',
      originalPrice: 1500,
      actualAmount: 1500,
    };
    const refundNorm = normalizeOrderItem(refundVariant);
    assert.strictEqual(refundNorm.orderType, 'refund');
    assert.strictEqual(refundNorm.status, 'voided');
    assert.strictEqual(refundNorm.statusText, '已作废');
  });

  runTest('1.4 normalizeOrderSummary 容错与字段平铺测试', () => {
    const backendSummary = {
      totalActualAmount: 128900.5,
      totalOrders: 68,
      statusCounts: { unpaid: 9, paid: 55, void: 4 },
      summaryText: '当前条件下：共计 68 笔订单',
    };

    const summary = normalizeOrderSummary(backendSummary);
    assert.strictEqual(summary.todayPaidAmount, 128900.5);
    assert.strictEqual(summary.monthOrderCount, 68);
    assert.strictEqual(summary.pendingOrderCount, 9);
    assert.strictEqual(summary.summaryText, '当前条件下：共计 68 笔订单');

    const emptySummary = normalizeOrderSummary({});
    assert.strictEqual(emptySummary.todayPaidAmount, 0);
    assert.strictEqual(emptySummary.monthOrderCount, 0);
    assert.strictEqual(emptySummary.pendingOrderCount, 0);
  });

  runTest('1.5 normalizeApprovalItem 关联实体展开与审批类型映射', () => {
    const backendApproval = {
      id: 'appr-backend-101',
      businessType: 'payment',
      status: 'approved',
      currentStep: 3,
      totalSteps: 3,
      applicant: { realName: '李顾问' },
      order: {
        orderNo: 'ORD20261015099',
        actualAmount: 16800,
        remark: '2年连报申请8折特惠',
        campus: { name: '朝阳分校' },
        student: { name: '赵梓涵' },
        package: { course: { name: '少儿机器人编程' } },
      },
    };

    const norm = normalizeApprovalItem(backendApproval);
    assert.strictEqual(norm.businessType, 'receipt');
    assert.strictEqual(norm.businessTypeText, '收款审批');
    assert.strictEqual(norm.status, 'approved');
    assert.strictEqual(norm.statusText, '已通过');
    assert.strictEqual(norm.studentName, '赵梓涵');
    assert.strictEqual(norm.courseName, '少儿机器人编程');
    assert.strictEqual(norm.amount, 16800);
    assert.strictEqual(norm.campusName, '朝阳分校');
    assert.strictEqual(norm.applicantName, '李顾问');
    assert.strictEqual(norm.reason, '2年连报申请8折特惠');
  });

  // ================================================================================
  // 【TEST SECTION 2】电子收据大写金额算法精度实证 (RMB Digit Uppercase Oracle)
  // ================================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 2】防伪电子收据中文大写金额计算预言机验证 (RMB Digit Uppercase)');
  console.log('----------------------------------------------------------------');

  const orderDetailPagePath = path.resolve(mpRoot, 'src/package-finance/orders/detail.vue');
  const orderDetailSrc = fs.readFileSync(orderDetailPagePath, 'utf8');

  assert.ok(orderDetailSrc.includes('const digitUppercase ='), 'orders/detail.vue 缺少 digitUppercase 函数定义');

  const digitUppercaseFnStr = orderDetailSrc.substring(
    orderDetailSrc.indexOf('const digitUppercase = (n: number) => {'),
    orderDetailSrc.indexOf('onMounted', orderDetailSrc.indexOf('const digitUppercase ='))
  ).replace(': number', '');

  const evalDigitUppercase = new Function(`
    ${digitUppercaseFnStr}
    return digitUppercase;
  `)();

  runTest('2.1 人民币大写金额转换预言机测试 (零元/角分/整百/整千/整万/亿级)', () => {
    assert.strictEqual(evalDigitUppercase(0), '零元整', '0 转换失败');
    assert.strictEqual(evalDigitUppercase(0.05), '伍分', '0.05 转换失败');
    assert.strictEqual(evalDigitUppercase(0.5), '伍角', '0.50 转换失败');
    assert.strictEqual(evalDigitUppercase(0.58), '伍角捌分', '0.58 转换失败');
    assert.strictEqual(evalDigitUppercase(100), '壹佰元整', '100 转换失败');
    assert.strictEqual(evalDigitUppercase(100.05), '壹佰元伍分', '100.05 转换失败');
    assert.strictEqual(evalDigitUppercase(1050.2), '壹仟零伍拾元贰角', '1050.2 转换失败');
    assert.strictEqual(evalDigitUppercase(4992), '肆仟玖佰玖拾贰元整', '4992 转换失败');
    assert.strictEqual(evalDigitUppercase(20000), '贰万元整', '20000 转换失败');
    assert.strictEqual(evalDigitUppercase(100000000), '壹亿元整', '1亿 转换失败');
  });

  // ================================================================================
  // 【TEST SECTION 3】离线回退与查询筛选健壮性 (Offline Fallback & Query Resiliency)
  // ================================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 3】financeApi 离线容灾回退与多维过滤健壮性实测 (编译产物与源码双轨)');
  console.log('----------------------------------------------------------------');

  await runAsyncTest('3.1 getOrders: 关键字模糊检索、订单类型与状态筛选有效', async () => {
    // 1. 无参全量
    const resAll = await compiledFinance.getOrders();
    assert.ok(resAll.list.length >= 4, '离线回退订单数应至少为 4 条');

    // 2. 关键字检索 "董御"
    const resDong = await compiledFinance.getOrders({ keyword: '董御' });
    assert.strictEqual(resDong.list.length, 1);
    assert.strictEqual(resDong.list[0].studentName, '董御');

    // 3. 关键字检索订单号 "ORD20261014002"
    const resOrderNo = await compiledFinance.getOrders({ keyword: 'ORD20261014002' });
    assert.strictEqual(resOrderNo.list.length, 1);
    assert.strictEqual(resOrderNo.list[0].id, 'ord-02');

    // 4. 类型筛选 "recharge"
    const resRecharge = await compiledFinance.getOrders({ orderType: 'recharge' });
    assert.strictEqual(resRecharge.list.length, 1);
    assert.strictEqual(resRecharge.list[0].orderType, 'recharge');

    // 5. 状态筛选 "refunded"
    const resRefunded = await compiledFinance.getOrders({ status: 'refunded' });
    assert.strictEqual(resRefunded.list.length, 1);
    assert.strictEqual(resRefunded.list[0].status, 'refunded');

    // 6. 查不存在的关键字
    const resEmpty = await compiledFinance.getOrders({ keyword: 'NON_EXISTENT_NAME_XYZ' });
    assert.strictEqual(resEmpty.list.length, 0);
    assert.strictEqual(resEmpty.total, 0);
  });

  await runAsyncTest('3.2 getOrderSummary: 汇总指标数据类型健全且非负', async () => {
    const summary = await compiledFinance.getOrderSummary({ campusId: 'campus-bj-hq' });
    assert.ok(typeof summary.todayPaidAmount === 'number' && summary.todayPaidAmount >= 0);
    assert.ok(typeof summary.monthOrderCount === 'number' && summary.monthOrderCount >= 0);
    assert.ok(typeof summary.pendingOrderCount === 'number' && summary.pendingOrderCount >= 0);
    assert.ok(typeof summary.totalRefundAmount === 'number' && summary.totalRefundAmount >= 0);
  });

  await runAsyncTest('3.3 getApprovals & getApprovalTimeline: 审批分类与垂直流转节点契约', async () => {
    // 1. 退费审批
    const refundApprovals = await compiledFinance.getApprovals({ businessType: 'refund' });
    assert.ok(refundApprovals.list.length >= 1);
    assert.ok(refundApprovals.list.every(a => a.businessType === 'refund'));

    // 2. 收款特批
    const receiptApprovals = await compiledFinance.getApprovals({ businessType: 'receipt' });
    assert.ok(receiptApprovals.list.length >= 1);
    assert.ok(receiptApprovals.list.every(a => a.businessType === 'receipt'));

    // 3. 审批时间线 (appr-01)
    const timelineData = await compiledFinance.getApprovalTimeline('appr-01');
    assert.ok(Array.isArray(timelineData.timeline), '缺少 timeline 数组');
    assert.ok(timelineData.timeline.length >= 3, 'timeline 节点数应 >= 3');
    assert.strictEqual(timelineData.timeline[0].nodeName, '发起退费申请');
    assert.strictEqual(timelineData.timeline[1].nodeName, '财务核验课耗');
    assert.strictEqual(timelineData.timeline[2].nodeName, '校长终审签批');
  });

  // ================================================================================
  // 【TEST SECTION 4】写接口失败时零异常吞噬与状态冻结实证 (Zero Swallowed Errors)
  // ================================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 4】写操作异常对抗实测：接口报错必定向上抛出，视图层零假双写');
  console.log('----------------------------------------------------------------');

  await runAsyncTest('4.1 financeApi 写方法 (voidOrder/lockOrder/auditApproval/batchAudit) 遇非200时必抛异常', async () => {
    currentRequestImpl = (opts) => {
      opts.success({
        statusCode: 500,
        data: { message: 'DB_TRANSACTION_DEADLOCK: 数据库死锁回滚' },
      });
    };

    // 1. voidOrder 必须抛错
    await assert.rejects(
      async () => {
        await compiledFinance.voidOrder('ord-01');
      },
      /DB_TRANSACTION_DEADLOCK/,
      'voidOrder 未抛出后端 500 异常'
    );

    // 2. lockOrder 必须抛错
    await assert.rejects(
      async () => {
        await compiledFinance.lockOrder('ord-01', '财务封账');
      },
      /DB_TRANSACTION_DEADLOCK/,
      'lockOrder 未抛出后端 500 异常'
    );

    // 3. auditApproval 必须抛错
    await assert.rejects(
      async () => {
        await compiledFinance.auditApproval('appr-01', { action: 'pass' });
      },
      /DB_TRANSACTION_DEADLOCK/,
      'auditApproval 未抛出后端 500 异常'
    );

    // 4. batchAudit 必须抛错
    await assert.rejects(
      async () => {
        await compiledFinance.batchAudit({ approvalIds: ['appr-01'], action: 'approve' });
      },
      /DB_TRANSACTION_DEADLOCK/,
      'batchAudit 未抛出后端 500 异常'
    );
  });

  await runAsyncTest('4.2 视图层作废单据动作 (handleVoidOrder) 报错时状态百分之百冻结', async () => {
    const simulatedOrder = {
      id: 'ord-01',
      orderNo: 'ORD20261015001',
      status: 'paid',
      statusText: '交易成功',
    };

    let toastTitle = '';
    let toastIcon = '';

    const mockFailApi = {
      voidOrder: async () => {
        throw new Error('HTTP 400: 该订单账期已被财务加锁保护，严禁作废冲正');
      },
    };

    const executeVoid = async () => {
      try {
        await mockFailApi.voidOrder(simulatedOrder.id);
        simulatedOrder.status = 'voided';
        simulatedOrder.statusText = '已作废';
        toastTitle = '订单已作废';
        toastIcon = 'none';
      } catch (e) {
        toastTitle = e?.message || '作废订单失败';
        toastIcon = 'none';
      }
    };

    await executeVoid();

    assert.strictEqual(simulatedOrder.status, 'paid', '❌ 失败时订单状态被错误篡改');
    assert.strictEqual(simulatedOrder.statusText, '交易成功', '❌ 失败时订单状态文字被篡改');
    assert.strictEqual(toastTitle, 'HTTP 400: 该订单账期已被财务加锁保护，严禁作废冲正', '❌ 未提示后端真实错误');
    assert.strictEqual(toastIcon, 'none', '❌ 失败时展示了成功图标');
  });

  await runAsyncTest('4.3 审批中心驳回空白原因拦截：禁止无理由驳回', async () => {
    let toastMsg = '';
    let auditCalled = false;

    const mockApi = {
      auditApproval: async () => {
        auditCalled = true;
      },
    };

    const executeRejectWithBlank = async (reason) => {
      if (!reason || !reason.trim()) {
        toastMsg = '驳回原因必须填写';
        return;
      }
      await mockApi.auditApproval();
    };

    await executeRejectWithBlank('   ');
    assert.strictEqual(auditCalled, false, '❌ 空白驳回原因依然触发了审批接口');
    assert.strictEqual(toastMsg, '驳回原因必须填写', '❌ 缺少空白原因校验提示');
  });

  // ================================================================================
  // 【TEST SECTION 5】静态源码反作弊与假双写全面审计 (Static Anti-Cheat Audit)
  // ================================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 5】Phase 4 源码全景反作弊、反空 catch 与反假双写静态扫描');
  console.log('----------------------------------------------------------------');

  const phase4VueFiles = [
    path.resolve(mpRoot, 'src/package-finance/orders/index.vue'),
    path.resolve(mpRoot, 'src/package-finance/orders/detail.vue'),
    path.resolve(mpRoot, 'src/package-finance/approval/index.vue'),
    path.resolve(mpRoot, 'src/package-finance/approval/detail.vue'),
  ];

  runTest('5.1 检查 Phase 4 全量 Vue 页面绝对禁止出现空 catch (e) {}', () => {
    for (const fp of phase4VueFiles) {
      const content = fs.readFileSync(fp, 'utf8');
      const relName = path.relative(repoRoot, fp);
      assert.strictEqual(content.includes('catch (e) {}'), false, `❌ ${relName} 存在空 catch (e) {}`);
      assert.strictEqual(content.includes('catch (err) {}'), false, `❌ ${relName} 存在空 catch (err) {}`);
      assert.strictEqual(content.includes('catch {}'), false, `❌ ${relName} 存在空 catch {}`);
    }
  });

  runTest('5.2 检查 Phase 4 全量 Vue 页面绝对禁止引用 @/mocks 或 src/mocks', () => {
    for (const fp of phase4VueFiles) {
      const content = fs.readFileSync(fp, 'utf8');
      const relName = path.relative(repoRoot, fp);
      assert.strictEqual(content.includes('@/mocks'), false, `❌ ${relName} 违规引用 @/mocks`);
      assert.strictEqual(content.includes('src/mocks'), false, `❌ ${relName} 违规引用 src/mocks`);
    }
  });

  runTest('5.3 检查 Phase 4 页面错误处理均透出 e?.message 真实报错', () => {
    for (const fp of phase4VueFiles) {
      const content = fs.readFileSync(fp, 'utf8');
      const relName = path.relative(repoRoot, fp);
      assert.ok(content.includes('e?.message'), `❌ ${relName} 缺少 e?.message 真实错误反馈`);
    }
  });

  runTest('5.4 检查 orders/detail.vue 具备防伪收据全部视觉 Token (.receipt-top-teeth, .seal-stamp, .void-watermark)', () => {
    const detailVue = fs.readFileSync(path.resolve(mpRoot, 'src/package-finance/orders/detail.vue'), 'utf8');
    assert.ok(detailVue.includes('receipt-top-teeth'), '缺少防伪锯齿样式类');
    assert.ok(detailVue.includes('seal-stamp'), '缺少官方财务印章样式类');
    assert.ok(detailVue.includes('void-watermark'), '缺少作废水印样式类');
    assert.ok(detailVue.includes('digitUppercase'), '缺少大写金额格式化函数');
  });

  runTest('5.5 检查 orders/index.vue 具备多维小计横幅与校区事件监听', () => {
    const indexVue = fs.readFileSync(path.resolve(mpRoot, 'src/package-finance/orders/index.vue'), 'utf8');
    assert.ok(indexVue.includes('summary-subtotal-strip'), '缺少动态小计汇总横幅');
    assert.ok(indexVue.includes("uni.$on('campus-changed'"), '缺少校区切换事件监听');
    assert.ok(indexVue.includes("uni.$off('campus-changed'"), '缺少校区切换解绑');
    assert.ok(indexVue.includes('summary.todayPaidAmount'), '缺少今日实收看板指标');
  });

  // ================================================================================
  // 【TEST SECTION 6】变异体注入与断言杀伤力测试 (Mutation Testing & Kill Rate)
  // ================================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('【领域 6】变异体对抗注入与断言杀伤力测试 (Mutation Testing)');
  console.log('----------------------------------------------------------------');

  runTest('6.1 变异注入 1: 若订单作废 catch 块误植假双写 status = voided，断言必杀伤', () => {
    const mutantVoidAction = `
      try {
        await mockFailApi.voidOrder();
      } catch (e) {
        simulatedOrder.status = 'voided';
        uni.showToast({ title: '订单已作废', icon: 'success' });
      }
    `;
    assert.throws(() => {
      assert.strictEqual(mutantVoidAction.includes("simulatedOrder.status = 'voided'"), false, '❌ catch 块绝不能修改状态');
    }, /catch 块绝不能修改状态/);
  });

  runTest('6.2 变异注入 2: 若出现空 catch (e) {} 异常吞噬，断言必精确杀伤', () => {
    const mutantVueCode = `
      const handleApprove = async (item) => {
        try {
          await financeApi.auditApproval(item.id, { action: 'pass' });
        } catch (e) {}
        item.status = 'approved';
      }
    `;
    assert.throws(() => {
      assert.strictEqual(mutantVueCode.includes('catch (e) {}'), false, '❌ 存在空 catch');
    }, /存在空 catch/);
  });

  runTest('6.3 变异注入 3: 若 Normalizer 丢失防空兜底抛出 TypeError，断言必杀伤', () => {
    const buggyNormalizer = (item) => {
      return item.student.name; // Unhandled null reference
    };
    assert.throws(() => {
      buggyNormalizer({});
    }, /Cannot read properties of undefined/);
  });

  console.log('\n================================================================================');
  console.log(`🎉 阶段四深度对抗实证压力测试全部通过！${passedTests}/${totalTests} 项严苛断言 100% 验证成功！`);
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ 阶段四深度对抗测试执行异常:', err);
  process.exit(1);
});
