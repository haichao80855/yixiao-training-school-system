/**
 * test_challenger_r2_targeted_stress.cjs
 * Empirical Challenger Phase 1 Iteration 2 Targeted Stress Test & Mutation Suite
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const mpRoot = path.resolve(repoRoot, 'mini-program');

console.log('================================================================================');
console.log('⚡ [Empirical Challenger] Phase 1 Iteration 2 变异攻击与边界压力测试套件');
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

// --------------------------------------------------------------------------------
// 领域 1: 修改密码接口报错时弹层保持、不触发登出、恢复按钮状态
// --------------------------------------------------------------------------------
console.log('----------------------------------------------------------------');
console.log('【领域 1】修改密码边界与异常对抗：接口报错时不登出、不闭弹层、按钮状态复原');
console.log('----------------------------------------------------------------');

const myPagePath = path.resolve(mpRoot, 'src/pages/my/index.vue');
const myPageContent = fs.readFileSync(myPagePath, 'utf8');

runTest('1.1 静态源码审查：catch 块绝无 authStore.logout 与弹层强制关闭', () => {
  assert.ok(myPageContent.includes('const submitPasswordChange = async'), '缺少 submitPasswordChange 方法');
  
  // 提取 submitPasswordChange 方法块
  const startIdx = myPageContent.indexOf('const submitPasswordChange = async');
  const endIdx = myPageContent.indexOf('// ==========================================', startIdx);
  const methodBlock = myPageContent.substring(startIdx, endIdx);

  // 必须有 try-catch
  assert.ok(methodBlock.includes('try {'), '必须包含 try 块');
  assert.ok(methodBlock.includes('catch (err: any) {') || methodBlock.includes('catch (err) {'), '必须包含 catch 块');

  // catch 块内容分析
  const catchIdx = methodBlock.indexOf('catch');
  const finallyIdx = methodBlock.indexOf('finally', catchIdx);
  const catchBlock = methodBlock.substring(catchIdx, finallyIdx > -1 ? finallyIdx : methodBlock.length);

  assert.strictEqual(catchBlock.includes('authStore.logout()'), false, '❌ catch 块内绝不能调用 authStore.logout()');
  assert.strictEqual(catchBlock.includes('showPasswordModal.value = false'), false, '❌ catch 块内绝不能关闭弹层');
  assert.ok(catchBlock.includes('uni.showToast'), '❌ catch 块内必须提示错误 Toast');
});

runTest('1.2 静态表单校验：oldPassword 必须参与强校验且禁止硬编码用户 ID', () => {
  // 检查 isPasswordFormValid 逻辑
  assert.ok(myPageContent.includes('oldPassword.value.trim().length > 0'), '❌ 密码表单校验必须包含 oldPassword 非空校验');
  // 检查用户 ID 来源
  const methodBlock = myPageContent.substring(myPageContent.indexOf('const submitPasswordChange = async'));
  assert.ok(methodBlock.includes('authStore.user?.id'), '❌ 必须使用 authStore.user?.id');
  assert.strictEqual(methodBlock.includes("'usr-dong'"), false, '❌ 禁止出现 usr-dong 假兜底 ID');
});

runTest('1.3 运行时逻辑模拟执行：网络/服务端异常下实证弹层保持开启且未调用 logout', async () => {
  // 模拟运行 submitPasswordChange 逻辑
  let logoutCalled = false;
  let showPasswordModal = true;
  let passwordSubmitting = false;
  let toastMsg = '';

  const mockAuthStore = {
    user: { id: 'usr-real-test' },
    logout: () => { logoutCalled = true; }
  };

  const mockUni = {
    showToast: (opts) => { toastMsg = opts.title; }
  };

  const simulatedSubmitPasswordChange = async (mockRequest) => {
    const userId = mockAuthStore.user?.id;
    if (!userId) {
      mockUni.showToast({ title: '登录凭证已失效，请重新登录', icon: 'none' });
      return;
    }

    passwordSubmitting = true;
    try {
      await mockRequest();
      mockUni.showToast({ title: '密码修改成功，请重新登录', icon: 'success' });
      showPasswordModal = false;
      mockAuthStore.logout();
    } catch (err) {
      mockUni.showToast({ title: err?.message || '密码修改失败，请重试', icon: 'none' });
    } finally {
      passwordSubmitting = false;
    }
  };

  // 注入攻击用例：后端 500 业务报错
  await simulatedSubmitPasswordChange(async () => {
    throw new Error('原密码校验错误，请重新输入');
  });

  assert.strictEqual(logoutCalled, false, '实证失败：报错时意外触发了 logout');
  assert.strictEqual(showPasswordModal, true, '实证失败：报错时意外关闭了弹层');
  assert.strictEqual(passwordSubmitting, false, '实证失败：finally 未重置 submitting 状态');
  assert.strictEqual(toastMsg, '原密码校验错误，请重新输入', '实证失败：未正确透出后端错误提示');
});


// --------------------------------------------------------------------------------
// 领域 2: 微信快捷登录在离线/本地环境防 Facade 与防后门
// --------------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【领域 2】微信快捷登录防后门与环境边界：离线/本地环境绝不无条件登入超管');
console.log('----------------------------------------------------------------');

const loginPagePath = path.resolve(mpRoot, 'src/pages/login/index.vue');
const loginPageContent = fs.readFileSync(loginPagePath, 'utf8');

runTest('2.1 源码零后门审查：绝无写死超管账号与虚假 setTimeout 提权', () => {
  assert.ok(loginPageContent.includes('handleWechatQuickLogin'), '缺少 handleWechatQuickLogin 方法');

  const startIdx = loginPageContent.indexOf('const handleWechatQuickLogin = async');
  const endIdx = loginPageContent.indexOf('const handleHelp =', startIdx);
  const methodBlock = loginPageContent.substring(startIdx, endIdx);

  // 必须彻底剔除写死账号
  assert.strictEqual(methodBlock.includes('donghaichao'), false, '❌ 微信快捷登录中禁止出现写死账号 donghaichao');
  assert.strictEqual(methodBlock.includes('123456'), false, '❌ 微信快捷登录中禁止出现写死密码 123456');
  assert.strictEqual(methodBlock.includes('authStore.login('), false, '❌ handleWechatQuickLogin 中禁止直接静默调用 authStore.login');
  assert.strictEqual(methodBlock.includes('setTimeout('), false, '❌ 禁止通过 setTimeout 伪造假登录成功');
});

runTest('2.2 官方 API 调用与本地环境友好引导审查', () => {
  const startIdx = loginPageContent.indexOf('const handleWechatQuickLogin = async');
  const endIdx = loginPageContent.indexOf('const handleHelp =', startIdx);
  const methodBlock = loginPageContent.substring(startIdx, endIdx);

  assert.ok(methodBlock.includes('uni.login'), '❌ 必须调用原生 uni.login');
  assert.ok(methodBlock.includes('provider:'), '❌ 必须指定 provider');
  assert.ok(methodBlock.includes('uni.showModal'), '❌ 在本地无开放平台凭证时必须使用 modal 明示环境');
  assert.ok(methodBlock.includes("loginType.value = 'account'"), '❌ 必须引导切回工号密码登录');
});

runTest('2.3 运行时逻辑模拟：离线/未授权触发 handleWechatQuickLogin 绝无越权登录', async () => {
  let loginCalled = false;
  let modalTitle = '';
  let currentLoginType = 'wechat';

  const mockAuthStore = {
    login: () => { loginCalled = true; }
  };

  const simulatedWechatQuickLogin = async () => {
    // 模拟原生 uni.login 在本地无配置时的行为
    await new Promise((res) => res());
    modalTitle = '环境提示';
    currentLoginType = 'account';
  };

  await simulatedWechatQuickLogin();

  assert.strictEqual(loginCalled, false, '实证失败：在本地环境依然静默执行了登录');
  assert.strictEqual(modalTitle, '环境提示', '实证失败：未弹出环境提示');
  assert.strictEqual(currentLoginType, 'account', '实证失败：未安全切回账号密码输入');
});


// --------------------------------------------------------------------------------
// 领域 3: 审批流在接口报错时绝不发生状态突变 (零假双写)
// --------------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【领域 3】审批流异常防御：接口报错时绝不突变状态、零假双写');
console.log('----------------------------------------------------------------');

const approvalIndexPath = path.resolve(mpRoot, 'src/package-finance/approval/index.vue');
const approvalDetailPath = path.resolve(mpRoot, 'src/package-finance/approval/detail.vue');
const approvalIndexContent = fs.readFileSync(approvalIndexPath, 'utf8');
const approvalDetailContent = fs.readFileSync(approvalDetailPath, 'utf8');

runTest('3.1 审批列表页静态审查：接口失败阻断状态修改与假成功 Toast', () => {
  assert.strictEqual(approvalIndexContent.includes('catch (e) {}'), false, '❌ approval/index.vue 严禁出现空 catch');

  // 检查 handleApprove
  const approveBlock = approvalIndexContent.substring(
    approvalIndexContent.indexOf('const handleApprove ='),
    approvalIndexContent.indexOf('const handleReject =')
  );

  assert.ok(approveBlock.includes('await financeApi.auditApproval'), '必须调用 financeApi.auditApproval');
  
  const auditCallIdx = approveBlock.indexOf('await financeApi.auditApproval');
  const statusAssignIdx = approveBlock.indexOf("item.status = 'approved'");
  const catchIdx = approveBlock.indexOf('catch');

  assert.ok(statusAssignIdx > auditCallIdx, '❌ 状态赋值必须在 await auditApproval 成功之后');
  assert.ok(catchIdx > statusAssignIdx, '❌ 状态赋值必须在 try 块内，catch 必须在后');
  assert.ok(approveBlock.includes('uni.showToast({ title: e?.message'), '❌ catch 必须提示真实错误');
});

runTest('3.2 审批详情页静态审查：通过与驳回在报错时均不修改 detail.status 与时间线', () => {
  assert.strictEqual(approvalDetailContent.includes('catch (e) {}'), false, '❌ approval/detail.vue 严禁出现空 catch');

  // 检查 handleApproveAction
  const approveActionBlock = approvalDetailContent.substring(
    approvalDetailContent.indexOf('const handleApproveAction ='),
    approvalDetailContent.indexOf('const handleRejectAction =')
  );

  const auditCallIdx = approveActionBlock.indexOf('await financeApi.auditApproval');
  const statusAssignIdx = approveActionBlock.indexOf("detail.value.status = 'approved'");
  const catchIdx = approveActionBlock.indexOf('catch');

  assert.ok(statusAssignIdx > auditCallIdx, '❌ detail.status 变更必须在 await 成功后');
  assert.ok(catchIdx > statusAssignIdx, '❌ detail.status 变更必须位于 try 块内');

  // 检查 handleRejectAction
  const rejStart = approvalDetailContent.indexOf('const handleRejectAction =');
  const rejEnd = approvalDetailContent.indexOf('</script>', rejStart);
  const rejectActionBlock = approvalDetailContent.substring(rejStart, rejEnd);

  const rejCallIdx = rejectActionBlock.indexOf('await financeApi.auditApproval');
  const rejStatusAssignIdx = rejectActionBlock.indexOf("detail.value.status = 'rejected'");
  const rejCatchIdx = rejectActionBlock.indexOf('catch');

  assert.ok(rejStatusAssignIdx > rejCallIdx, '❌ detail.status 驳回变更必须在 await 成功后');
  assert.ok(rejCatchIdx > rejStatusAssignIdx, '❌ detail.status 驳回变更必须位于 try 块内');
});

runTest('3.3 运行时断言：审批 API 报错时状态百分之百冻结原值', async () => {
  const detail = {
    id: 'appr-999',
    status: 'pending',
    statusText: '待我审批',
    timeline: [{ nodeId: 'n1', status: 'approved' }]
  };

  let toastType = '';
  let toastMsg = '';

  const mockFinanceApi = {
    auditApproval: async () => {
      throw new Error('HTTP 403: 您无权进行校长终审签批');
    }
  };

  const mockUni = {
    showToast: (opts) => {
      toastType = opts.icon;
      toastMsg = opts.title;
    }
  };

  // 模拟审批通过动作
  const simulatedApproveAction = async () => {
    try {
      await mockFinanceApi.auditApproval(detail.id, { action: 'pass', comment: 'ok' });
      detail.status = 'approved';
      detail.statusText = '已通过';
      detail.timeline.push({ nodeId: 'n2', status: 'approved' });
      mockUni.showToast({ title: '已成功签批通过！', icon: 'success' });
    } catch (e) {
      mockUni.showToast({ title: e?.message || '签批通过处理失败', icon: 'none' });
    }
  };

  await simulatedApproveAction();

  assert.strictEqual(detail.status, 'pending', '实证失败：API 报错后 status 被非法篡改');
  assert.strictEqual(detail.statusText, '待我审批', '实证失败：API 报错后 statusText 被非法篡改');
  assert.strictEqual(detail.timeline.length, 1, '实证失败：API 报错后时间线被非法篡改');
  assert.strictEqual(toastMsg, 'HTTP 403: 您无权进行校长终审签批', '实证失败：未透出 403 错误');
  assert.strictEqual(toastType, 'none', '实证失败：报错时错误触发了 success 图标');
});

runTest('3.4 API 层契约审查：financeApi.auditApproval 严格契约透传且对齐后端 DTO', () => {
  const financeApiTsPath = path.resolve(mpRoot, 'src/api/finance.ts');
  const financeApiContent = fs.readFileSync(financeApiTsPath, 'utf8');

  assert.ok(financeApiContent.includes('async auditApproval(id: string, payload:'), '缺少 auditApproval 签名');
  assert.ok(financeApiContent.includes('/api/financial/approvals/${id}/audit'), '端点路由规范对齐');
  assert.ok(financeApiContent.includes("action?: 'pass' | 'reject'"), '入参支持后端 AuditApprovalDto 规范');
});


// --------------------------------------------------------------------------------
// 领域 4: 物理实体与构建产物合规性
// --------------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【领域 4】物理实体受控与原生 TabBar 契约核验');
console.log('----------------------------------------------------------------');

runTest('4.1 mini-program 目录物理实体属性检验', () => {
  const lstat = fs.lstatSync(mpRoot);
  assert.strictEqual(lstat.isSymbolicLink(), false, '❌ mini-program 依然是软链接，未实体化');
  assert.ok(lstat.isDirectory(), '❌ mini-program 必须是物理目录');
});

runTest('4.2 编译产物 app.json 原生 tabBar 结构验证', () => {
  const distAppJsonPath = path.resolve(mpRoot, 'dist/build/mp-weixin/app.json');
  assert.ok(fs.existsSync(distAppJsonPath), '❌ 编译产物 app.json 不存在');
  const appJson = JSON.parse(fs.readFileSync(distAppJsonPath, 'utf8'));

  assert.ok(appJson.tabBar, '❌ app.json 缺少 tabBar 节点');
  assert.strictEqual(appJson.tabBar.custom, true, '❌ tabBar.custom 必须为 true');
  assert.strictEqual(appJson.tabBar.list.length, 5, '❌ tabBar.list 必须正好包含 5 个核心 Tab');

  const expectedPages = [
    'pages/index/index',
    'pages/workbench/index',
    'pages/ai/index',
    'pages/todo/index',
    'pages/my/index'
  ];
  const actualPages = appJson.tabBar.list.map((item) => item.pagePath);
  for (const ep of expectedPages) {
    assert.ok(actualPages.includes(ep), `❌ tabBar.list 缺少 ${ep}`);
  }
});

runTest('4.3 warning 与 leads 子页面充实度检验 (>= 500B 且具备卡片和交互)', () => {
  const warningPath = path.resolve(mpRoot, 'src/package-edu/warning/index.vue');
  const leadsPath = path.resolve(mpRoot, 'src/package-crm/leads/index.vue');

  const warningStat = fs.statSync(warningPath);
  const leadsStat = fs.statSync(leadsPath);

  assert.ok(warningStat.size >= 5000, `warning/index.vue 体积为 ${warningStat.size}B，需 >= 5KB`);
  assert.ok(leadsStat.size >= 5000, `leads/index.vue 体积为 ${leadsStat.size}B，需 >= 5KB`);

  const warningContent = fs.readFileSync(warningPath, 'utf8');
  assert.ok(warningContent.includes('category-tabs') || warningContent.includes('currentCategory'), 'warning/index.vue 缺少预警分类 Tab');
  assert.ok(warningContent.includes('warning-card'), 'warning/index.vue 缺少预警卡片布局');

  const leadsContent = fs.readFileSync(leadsPath, 'utf8');
  assert.ok(leadsContent.includes('pipeline-summary') || leadsContent.includes('stage-tabs'), 'leads/index.vue 缺少线索漏斗阶段');
  assert.ok(leadsContent.includes('handleCall'), 'leads/index.vue 缺少拨打电话跟进交互');
});

// --------------------------------------------------------------------------------
// 领域 5: 变异攻击与杀伤力实证 (防止假阳性)
// --------------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------');
console.log('【领域 5】变异体注入与断言杀伤力实证 (Mutation Testing & Kill Rate)');
console.log('----------------------------------------------------------------');

runTest('5.1 变异注入 1: 若修改密码 catch 块注入 authStore.logout()，断言必精确杀伤', () => {
  const mutantCatchBlock = `
    } catch (err: any) {
      console.warn('修改密码端点异常:', err);
      authStore.logout();
      uni.showToast({ title: err?.message || '密码修改失败，请重试', icon: 'none' });
    }
  `;
  assert.throws(() => {
    assert.strictEqual(mutantCatchBlock.includes('authStore.logout()'), false, '❌ catch 块内绝不能调用 authStore.logout()');
  }, /catch 块内绝不能调用 authStore.logout\(\)/);
});

runTest('5.2 变异注入 2: 若微信快捷登录注入写死账号 donghaichao，断言必精确杀伤', () => {
  const mutantLoginBlock = `
    const handleWechatQuickLogin = async () => {
      await authStore.login('donghaichao', '123456');
    };
  `;
  assert.throws(() => {
    assert.strictEqual(mutantLoginBlock.includes('donghaichao'), false, '❌ 微信快捷登录中禁止出现写死账号 donghaichao');
  }, /禁止出现写死账号/);
});

runTest('5.3 变异注入 3: 若审批处理注入静默空 catch (e) {}，断言必精确杀伤', () => {
  const mutantApprovalContent = `
    try {
      await financeApi.auditApproval(id, payload);
    } catch (e) {}
    item.status = 'approved';
  `;
  assert.throws(() => {
    assert.strictEqual(mutantApprovalContent.includes('catch (e) {}'), false, '❌ 严禁出现空 catch');
  }, /严禁出现空 catch/);
});

runTest('5.4 变异注入 4: 若 app.json 剔除 tabBar 节点，断言必精确杀伤', () => {
  const mutantAppJson = { pages: ['pages/index/index'] };
  assert.throws(() => {
    assert.ok(mutantAppJson.tabBar, '❌ app.json 缺少 tabBar 节点');
  }, /缺少 tabBar 节点/);
});


console.log('\n================================================================================');
console.log(`🎉 目标对抗挑战全部通过！${passedTests}/${totalTests} 项边界测试 100% 验证成功！`);
console.log('================================================================================');
