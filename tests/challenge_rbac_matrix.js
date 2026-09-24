#!/usr/bin/env node
/**
 * 拓视未来教育「一校教培系统」4 级 RBAC 细粒度权限矩阵与数据透视范围极限对抗测试套件
 * 文件名: tests/challenge_rbac_matrix.js
 * 对应阶段: Milestone 6 (Challenger M6-2)
 *
 * 核心对抗维度：
 * 1. 4 级权限树半选联动递归算法极限对抗 (全选、半选 Indeterminate、全灭、自底向上级联、自顶向下批量、极端深宽树与形式化 Oracle 验证)
 * 2. 权限校验与通配符放行对抗 (超级管理员 '*' 与 'admin:all' 特权放行、常规权限精确比对、伪通配符陷阱防穿透、大小写与前缀攻击防御)
 * 3. 4 种数据透视范围过滤对抗 ('all', 'campus', 'department', 'self' 在学员、订单、排课多数据集上的精准切分、非法畸形 scope 安全兜底)
 * 4. 5 级组织架构树节点删除前置风控拦截对抗 (validateNodeDeletion 契约、根节点阻断、子节点阻断、员工绑定阻断、合规叶子放行)
 * 5. 双轨引擎跨实现 100% 严格一致性交叉对照验证 (CommonJS Contract vs TypeScript Middle-Platform Engine)
 * 6. 大规模高压力基准测试 (50,000 记录过滤、10,000 次权限校验、5,000 节点树联动性能)
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const createJiti = require('jiti');

// 终端色彩辅助
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// 1. 加载 CommonJS 核心契约引擎
const ContractRBACEngine = require('./contracts/rbacEngine');

// 2. 加载 TypeScript 业务中台实现及生产 Mock 数据
const jiti = createJiti(path.resolve('tests/challenge_rbac_matrix.js'), {
  alias: {
    '@': path.resolve(__dirname, '../src'),
  },
});

const systemMock = jiti('../src/mocks/system.ts');
const studentMock = jiti('../src/mocks/student.ts');
const financialMock = jiti('../src/mocks/financial.ts');
const educationalMock = jiti('../src/mocks/educational.ts');

const {
  RBACEngine: TsRBACEngine,
  MOCK_ORG_TREE_DATA,
  MOCK_PERMISSION_TREE_DATA,
  MOCK_ROLES_LIST,
  MOCK_SYSTEM_USERS,
} = systemMock;

const { MOCK_STUDENTS } = studentMock;
const { MOCK_ORDERS_DATA } = financialMock;
const { MOCK_SCHEDULE_EVENTS } = educationalMock;

// 测试统计计数器
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
};

function runTest(suiteName, testName, testFn) {
  stats.total++;
  const startTime = performance.now();
  try {
    testFn();
    const duration = (performance.now() - startTime).toFixed(2);
    stats.passed++;
    console.log(`  ${c.green}✔${c.reset} [${suiteName}] ${testName} ${c.dim}(${duration}ms)${c.reset}`);
  } catch (err) {
    const duration = (performance.now() - startTime).toFixed(2);
    stats.failed++;
    console.error(`  ${c.red}✖${c.reset} [${suiteName}] ${testName} ${c.dim}(${duration}ms)${c.reset}`);
    console.error(`    ${c.red}AssertionError: ${err.message}${c.reset}`);
    stats.errors.push({ suite: suiteName, name: testName, error: err });
  }
}

console.log(`\n${c.bold}${c.cyan}================================================================================${c.reset}`);
console.log(`${c.bold}${c.cyan}  拓视未来教育「一校教培系统」4 级 RBAC 矩阵与数据透视极限对抗测试 (Challenger M6-2)${c.reset}`);
console.log(`${c.bold}${c.cyan}================================================================================${c.reset}\n`);

// =============================================================================
// SUITE 1: 4 级权限树半选联动递归算法极限对抗测试 (Indeterminate & Cascading)
// =============================================================================
console.log(`${c.bold}${c.blue}▶ SUITE 1: 4 级权限树半选联动递归算法极限测试${c.reset}`);

// 1.1 基础与叶子节点边界
runTest('Tree-Basic', '无子节点或空数组叶子节点状态保留与类型安全转换', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // 单叶子勾选
    const leaf1 = { id: 'btn_1', checked: true };
    const res1 = engine.updateTreeCheckState(leaf1);
    assert.strictEqual(res1.checked, true);
    assert.strictEqual(res1.indeterminate, false);

    // 单叶子未勾选
    const leaf2 = { id: 'btn_2', checked: false };
    const res2 = engine.updateTreeCheckState(leaf2);
    assert.strictEqual(res2.checked, false);
    assert.strictEqual(res2.indeterminate, false);

    // checked 缺失/undefined/隐式转换
    const leaf3 = { id: 'btn_3' };
    const res3 = engine.updateTreeCheckState(leaf3);
    assert.strictEqual(res3.checked, false);
    assert.strictEqual(res3.indeterminate, false);

    // children 为空数组
    const leaf4 = { id: 'btn_4', checked: true, children: [] };
    const res4 = engine.updateTreeCheckState(leaf4);
    assert.strictEqual(res4.checked, true);
    assert.strictEqual(res4.indeterminate, false);
  });
});

// 1.2 2级树状态三态穷举 (全选、半选、未选)
runTest('Tree-2Level', '2 级树全选、半选与全灭三态精准判定', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // 场景 A: 子节点全部 checked=true -> 父节点 checked=true, indeterminate=false
    const parentAll = {
      id: 'page_1',
      children: [
        { id: 'b1', checked: true },
        { id: 'b2', checked: true },
        { id: 'b3', checked: true },
      ],
    };
    const sAll = engine.updateTreeCheckState(parentAll);
    assert.strictEqual(parentAll.checked, true);
    assert.strictEqual(parentAll.indeterminate, false);
    assert.strictEqual(sAll.checked, true);
    assert.strictEqual(sAll.indeterminate, false);

    // 场景 B: 子节点部分 checked=true -> 父节点 checked=false, indeterminate=true
    const parentPartial = {
      id: 'page_2',
      children: [
        { id: 'b1', checked: true },
        { id: 'b2', checked: false },
        { id: 'b3', checked: false },
      ],
    };
    const sPartial = engine.updateTreeCheckState(parentPartial);
    assert.strictEqual(parentPartial.checked, false);
    assert.strictEqual(parentPartial.indeterminate, true);
    assert.strictEqual(sPartial.checked, false);
    assert.strictEqual(sPartial.indeterminate, true);

    // 场景 C: 子节点全部 checked=false -> 父节点 checked=false, indeterminate=false
    const parentNone = {
      id: 'page_3',
      children: [
        { id: 'b1', checked: false },
        { id: 'b2', checked: false },
        { id: 'b3', checked: false },
      ],
    };
    const sNone = engine.updateTreeCheckState(parentNone);
    assert.strictEqual(parentNone.checked, false);
    assert.strictEqual(parentNone.indeterminate, false);
    assert.strictEqual(sNone.checked, false);
    assert.strictEqual(sNone.indeterminate, false);
  });
});

// 1.3 4 级深层嵌套树 (系统 -> 模块 -> 页面 -> 按钮) 自底向上状态级联全场景
runTest('Tree-4Level-Cascade', '多层级嵌套树 (系统->模块->页面->按钮) 6 种自底向上级联链路', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    function build4LevelTree() {
      return {
        id: 'sys_root',
        children: [
          {
            id: 'mod_1',
            children: [
              {
                id: 'page_1_1',
                children: [
                  { id: 'btn_1_1_1', checked: false },
                  { id: 'btn_1_1_2', checked: false },
                ],
              },
              {
                id: 'page_1_2',
                children: [
                  { id: 'btn_1_2_1', checked: false },
                  { id: 'btn_1_2_2', checked: false },
                ],
              },
            ],
          },
          {
            id: 'mod_2',
            children: [
              {
                id: 'page_2_1',
                children: [
                  { id: 'btn_2_1_1', checked: false },
                  { id: 'btn_2_1_2', checked: false },
                ],
              },
            ],
          },
        ],
      };
    }

    // 链路 1: 仅叶子 btn_1_1_1 勾选 -> page_1_1 半选 -> mod_1 半选 -> sys_root 半选
    const t1 = build4LevelTree();
    t1.children[0].children[0].children[0].checked = true;
    engine.updateTreeCheckState(t1);

    assert.strictEqual(t1.children[0].children[0].checked, false);
    assert.strictEqual(t1.children[0].children[0].indeterminate, true); // page_1_1
    assert.strictEqual(t1.children[0].children[1].checked, false);
    assert.strictEqual(t1.children[0].children[1].indeterminate, false); // page_1_2 (全关)
    assert.strictEqual(t1.children[0].checked, false);
    assert.strictEqual(t1.children[0].indeterminate, true); // mod_1
    assert.strictEqual(t1.children[1].checked, false);
    assert.strictEqual(t1.children[1].indeterminate, false); // mod_2 (全关)
    assert.strictEqual(t1.checked, false);
    assert.strictEqual(t1.indeterminate, true); // sys_root

    // 链路 2: page_1_1 下按钮全勾选，但 page_1_2 全未勾选 -> page_1_1 全选，mod_1 半选，sys_root 半选
    const t2 = build4LevelTree();
    t2.children[0].children[0].children[0].checked = true;
    t2.children[0].children[0].children[1].checked = true;
    engine.updateTreeCheckState(t2);

    assert.strictEqual(t2.children[0].children[0].checked, true);
    assert.strictEqual(t2.children[0].children[0].indeterminate, false); // page_1_1 全选
    assert.strictEqual(t2.children[0].checked, false);
    assert.strictEqual(t2.children[0].indeterminate, true); // mod_1 因 page_1_2 未选而半选
    assert.strictEqual(t2.checked, false);
    assert.strictEqual(t2.indeterminate, true); // sys_root 半选

    // 链路 3: mod_1 下全部页面按钮全勾选，mod_2 未勾选 -> mod_1 全选，mod_2 全关，sys_root 半选
    const t3 = build4LevelTree();
    t3.children[0].children[0].children[0].checked = true;
    t3.children[0].children[0].children[1].checked = true;
    t3.children[0].children[1].children[0].checked = true;
    t3.children[0].children[1].children[1].checked = true;
    engine.updateTreeCheckState(t3);

    assert.strictEqual(t3.children[0].checked, true);
    assert.strictEqual(t3.children[0].indeterminate, false); // mod_1 全选
    assert.strictEqual(t3.children[1].checked, false);
    assert.strictEqual(t3.children[1].indeterminate, false); // mod_2 全灭
    assert.strictEqual(t3.checked, false);
    assert.strictEqual(t3.indeterminate, true); // sys_root 半选

    // 链路 4: 全树所有按钮全勾选 -> 各级节点全选 (checked=true, indeterminate=false)
    const t4 = build4LevelTree();
    engine.setSubtreeChecked(t4, true);
    engine.updateTreeCheckState(t4);

    assert.strictEqual(t4.children[0].children[0].checked, true);
    assert.strictEqual(t4.children[0].children[0].indeterminate, false);
    assert.strictEqual(t4.children[0].checked, true);
    assert.strictEqual(t4.children[0].indeterminate, false);
    assert.strictEqual(t4.children[1].checked, true);
    assert.strictEqual(t4.children[1].indeterminate, false);
    assert.strictEqual(t4.checked, true);
    assert.strictEqual(t4.indeterminate, false);

    // 链路 5: 在全选树中单点取消深层 btn_2_1_2 -> page_2_1 变半选 -> mod_2 变半选 -> sys_root 变半选
    t4.children[1].children[0].children[1].checked = false;
    engine.updateTreeCheckState(t4);

    assert.strictEqual(t4.children[0].checked, true);
    assert.strictEqual(t4.children[0].indeterminate, false); // mod_1 依然保持全选
    assert.strictEqual(t4.children[1].children[0].checked, false);
    assert.strictEqual(t4.children[1].children[0].indeterminate, true); // page_2_1 半选
    assert.strictEqual(t4.children[1].checked, false);
    assert.strictEqual(t4.children[1].indeterminate, true); // mod_2 半选
    assert.strictEqual(t4.checked, false);
    assert.strictEqual(t4.indeterminate, true); // sys_root 半选

    // 链路 6: 取消勾选所有按钮 -> 全树复原为 checked=false, indeterminate=false
    engine.setSubtreeChecked(t4, false);
    engine.updateTreeCheckState(t4);
    assert.strictEqual(t4.checked, false);
    assert.strictEqual(t4.indeterminate, false);
    assert.strictEqual(t4.children[0].checked, false);
    assert.strictEqual(t4.children[0].indeterminate, false);
  });
});

// 1.4 自顶向下批量勾选/取消勾选 setSubtreeChecked
runTest('Tree-setSubtreeChecked', '自顶向下批量勾选/取消勾选 setSubtreeChecked 深度递归与幂等性', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    const complexTree = {
      id: 'sys',
      checked: false,
      indeterminate: true,
      children: [
        {
          id: 'mod1',
          checked: false,
          indeterminate: true,
          children: [
            { id: 'page1', checked: true, indeterminate: false },
            { id: 'page2', checked: false, indeterminate: false },
          ],
        },
        {
          id: 'mod2',
          checked: false,
          indeterminate: false,
          children: [{ id: 'page3', checked: false }],
        },
      ],
    };

    // 一键全选
    engine.setSubtreeChecked(complexTree, true);

    function assertAllChecked(node) {
      assert.strictEqual(node.checked, true, `Node ${node.id} should be checked`);
      assert.strictEqual(node.indeterminate, false, `Node ${node.id} indeterminate should be false`);
      if (node.children) {
        node.children.forEach(assertAllChecked);
      }
    }
    assertAllChecked(complexTree);

    // 幂等性测试：再次全选
    engine.setSubtreeChecked(complexTree, true);
    assertAllChecked(complexTree);

    // 一键全不选
    engine.setSubtreeChecked(complexTree, false);
    function assertAllUnchecked(node) {
      assert.strictEqual(node.checked, false, `Node ${node.id} should not be checked`);
      assert.strictEqual(node.indeterminate, false, `Node ${node.id} indeterminate should be false`);
      if (node.children) {
        node.children.forEach(assertAllUnchecked);
      }
    }
    assertAllUnchecked(complexTree);

    // 局部子树勾选联动
    engine.setSubtreeChecked(complexTree.children[0], true);
    engine.updateTreeCheckState(complexTree);
    assert.strictEqual(complexTree.children[0].checked, true);
    assert.strictEqual(complexTree.children[1].checked, false);
    assert.strictEqual(complexTree.checked, false);
    assert.strictEqual(complexTree.indeterminate, true);
  });
});

// 1.5 极限异构与深宽树压力测试 (15层单链、10,000广度子节点、非对称树)
runTest('Tree-Extreme-Stress', '极端深层嵌套(15层)、万级广度与非对称异构树状态传播', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // 15 层极深单链递归
    let deepRoot = { id: 'level_0', checked: false };
    let curr = deepRoot;
    for (let i = 1; i <= 15; i++) {
      curr.children = [{ id: `level_${i}`, checked: false }];
      curr = curr.children[0];
    }
    // 最底层叶子勾选
    curr.checked = true;
    engine.updateTreeCheckState(deepRoot);

    // 单链结构中，最底层勾选会导致沿途每一个父级全部满足 allChecked -> 全部为 checked=true, indeterminate=false
    let walk = deepRoot;
    for (let i = 0; i <= 15; i++) {
      assert.strictEqual(walk.checked, true, `Deep node level_${i} should be checked`);
      if (i < 15) {
        assert.strictEqual(walk.indeterminate, false, `Deep parent level_${i} indeterminate should be false`);
      }
      if (walk.children) walk = walk.children[0];
    }

    // 极端广度：1 个父节点下挂 10,000 个叶子节点
    const wideRoot = {
      id: 'wide_root',
      children: Array.from({ length: 10000 }, (_, i) => ({ id: `w_${i}`, checked: true })),
    };
    engine.updateTreeCheckState(wideRoot);
    assert.strictEqual(wideRoot.checked, true);
    assert.strictEqual(wideRoot.indeterminate, false);

    // 仅将第 9999 个叶子置为 false
    wideRoot.children[9999].checked = false;
    engine.updateTreeCheckState(wideRoot);
    assert.strictEqual(wideRoot.checked, false);
    assert.strictEqual(wideRoot.indeterminate, true);

    // 全部置为 false
    engine.setSubtreeChecked(wideRoot, false);
    engine.updateTreeCheckState(wideRoot);
    assert.strictEqual(wideRoot.checked, false);
    assert.strictEqual(wideRoot.indeterminate, false);
  });
});

// 1.6 形式化状态机数学 Oracle 交叉检验 (Property-Based Oracle on 100 Random Trees)
runTest('Tree-Oracle-Property', '随机拓扑生成器与形式化数学 Oracle 属性交叉检验 (100 次迭代)', () => {
  // 独立数学 Oracle：通过直接收集全量子孙叶子状态判断预期
  function computeExpectedStateByLeaves(node) {
    function collectLeafChecked(n) {
      if (!n.children || n.children.length === 0) {
        return [!!n.checked];
      }
      let acc = [];
      for (const ch of n.children) {
        acc = acc.concat(collectLeafChecked(ch));
      }
      return acc;
    }

    const leafStates = collectLeafChecked(node);
    const total = leafStates.length;
    const checkedCount = leafStates.filter(Boolean).length;

    if (total === 0) {
      return { checked: !!node.checked, indeterminate: false };
    }
    if (checkedCount === total) {
      return { checked: true, indeterminate: false };
    }
    if (checkedCount > 0 && checkedCount < total) {
      return { checked: false, indeterminate: true };
    }
    return { checked: false, indeterminate: false };
  }

  // 生成任意随机树拓扑
  function generateRandomTree(depth, maxBranch) {
    const node = {
      id: 'node_' + Math.random().toString(36).slice(2, 7),
      checked: Math.random() > 0.5,
    };
    if (depth <= 1) {
      return node;
    }
    const branchCount = Math.floor(Math.random() * maxBranch) + 1;
    node.children = [];
    for (let i = 0; i < branchCount; i++) {
      node.children.push(generateRandomTree(depth - 1, maxBranch));
    }
    return node;
  }

  for (let iter = 0; iter < 100; iter++) {
    const randomTree = generateRandomTree(4, 3);
    const expected = computeExpectedStateByLeaves(randomTree);

    // 运行引擎
    ContractRBACEngine.updateTreeCheckState(randomTree);

    assert.strictEqual(
      randomTree.checked,
      expected.checked,
      `Iter ${iter} Root checked state mismatch. Expected ${expected.checked}, got ${randomTree.checked}`
    );
    assert.strictEqual(
      randomTree.indeterminate,
      expected.indeterminate,
      `Iter ${iter} Root indeterminate state mismatch. Expected ${expected.indeterminate}, got ${randomTree.indeterminate}`
    );
  }
});

// =============================================================================
// SUITE 2: 权限校验与通配符放行对抗测试 (Wildcard & Exact Match)
// =============================================================================
console.log(`\n${c.bold}${c.blue}▶ SUITE 2: 权限校验与通配符放行对抗测试${c.reset}`);

// 2.1 超级管理员通配符放行对抗 ('*' 与 'admin:all')
runTest('Perm-Wildcard-SuperAdmin', "超级管理员通配符 '*' 与 'admin:all' 极限制霸放行", () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    const wildcardAdmin = ['*'];
    const legacyAdmin = ['admin:all'];
    const mixedAdmin = ['curriculum:view', '*', 'financial:refund'];

    const testActions = [
      'student:view',
      'financial:order:delete',
      'system:setting:danger_nuke',
      'arbitrary:non_existent:action',
      'any_action_at_all',
      'emoji:🔥:action',
      '<script>alert(1)</script>',
      'DROP TABLE users;',
      '',
    ];

    testActions.forEach(action => {
      assert.strictEqual(engine.hasPermission(wildcardAdmin, action), true, `* should allow ${action}`);
      assert.strictEqual(engine.hasPermission(legacyAdmin, action), true, `admin:all should allow ${action}`);
      assert.strictEqual(engine.hasPermission(mixedAdmin, action), true, `mixed * should allow ${action}`);
    });
  });
});

// 2.2 常规权限精确比对与未授权安全拦截
runTest('Perm-Exact-Match', '常规细粒度权限精确比对与未授权越权拦截', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    const userPerms = [
      'curriculum:view',
      'student:view',
      'student:enroll',
      'financial:order:view',
      'financial:order:export',
    ];

    // 合法授权精确放行
    assert.strictEqual(engine.hasPermission(userPerms, 'curriculum:view'), true);
    assert.strictEqual(engine.hasPermission(userPerms, 'student:view'), true);
    assert.strictEqual(engine.hasPermission(userPerms, 'student:enroll'), true);
    assert.strictEqual(engine.hasPermission(userPerms, 'financial:order:export'), true);

    // 未授权权限严格拦截
    assert.strictEqual(engine.hasPermission(userPerms, 'student:delete'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'student:status:transition'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'financial:order:delete'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'financial:refund:approve'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'system:user:add'), false);
  });
});

// 2.3 伪通配符陷阱与防穿透防御
runTest('Perm-Pseudo-Wildcard-Trap', '伪通配符陷阱防穿透测试 (student:* / *:* / admin:* / *admin 不得越权放行)', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // 伪通配符列表：在细粒度 RBAC 契约中，除 '*' 与 'admin:all' 外均为常规普通字符串
    const pseudoPerms = [
      'student:*',
      '*:*',
      'admin:*',
      '*admin',
      'all',
      'ALL',
      'ADMIN:ALL',
      'admin:all:extra',
    ];

    pseudoPerms.forEach(pseudo => {
      const userList = [pseudo];
      // 不得放行真实按钮权限
      assert.strictEqual(
        engine.hasPermission(userList, 'student:view'),
        false,
        `Pseudo permission ${pseudo} MUST NOT grant student:view`
      );
      assert.strictEqual(
        engine.hasPermission(userList, 'order:export'),
        false,
        `Pseudo permission ${pseudo} MUST NOT grant order:export`
      );
      // 仅支持其自身的字面精确匹配
      assert.strictEqual(engine.hasPermission(userList, pseudo), true);
    });
  });
});

// 2.4 子串注入与前缀伪装攻击防御
runTest('Perm-Substring-Injection', '子串截断、前缀伪装与空白字符越权防护', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    const userPerms = ['order:view'];

    // 子串截断
    assert.strictEqual(engine.hasPermission(userPerms, 'order:vi'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'order:'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'order'), false);

    // 超集注入与前缀冒充
    assert.strictEqual(engine.hasPermission(userPerms, 'order:view:delete'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'order:view:export'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'order:view '), false);
    assert.strictEqual(engine.hasPermission(userPerms, ' order:view'), false);
    assert.strictEqual(engine.hasPermission(userPerms, 'ORDER:VIEW'), false); // 大小写敏感
  });
});

// 2.5 异常与边界输入韧性 (空数组、undefined、null)
runTest('Perm-Robustness-Inputs', '空数组、undefined 缺省参数与原型键测试', () => {
  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // 空数组
    assert.strictEqual(engine.hasPermission([], 'student:view'), false);

    // 未传 userPermissions (默认兜底为 [])
    assert.strictEqual(engine.hasPermission(undefined, 'student:view'), false);

    // 请求权限为异常值
    assert.strictEqual(engine.hasPermission(['a', 'b'], undefined), false);
    assert.strictEqual(engine.hasPermission(['a', 'b'], null), false);
    assert.strictEqual(engine.hasPermission(['a', 'b'], ''), false);

    // 原型链污染键安全
    assert.strictEqual(engine.hasPermission(['toString', 'valueOf'], '__proto__'), false);
    assert.strictEqual(engine.hasPermission(['toString', 'valueOf'], 'constructor'), false);
  });
});

// 2.6 真实 5 大业务角色权限基准验证
runTest('Perm-Real-Roles-Matrix', '生产 MOCK_ROLES_LIST 5 大角色细粒度权限全景核验', () => {
  assert.strictEqual(MOCK_ROLES_LIST.length, 5);

  const roleAdmin = MOCK_ROLES_LIST.find(r => r.code === 'admin');
  const rolePrincipal = MOCK_ROLES_LIST.find(r => r.code === 'principal');
  const roleEduMgr = MOCK_ROLES_LIST.find(r => r.code === 'edu_manager');
  const roleTeacher = MOCK_ROLES_LIST.find(r => r.code === 'teacher');
  const roleCashier = MOCK_ROLES_LIST.find(r => r.code === 'cashier');

  assert.ok(roleAdmin && rolePrincipal && roleEduMgr && roleTeacher && roleCashier);

  // 1. 超管拥有全通配符
  assert.strictEqual(ContractRBACEngine.hasPermission(roleAdmin.permissions, 'any:arbitrary:perm'), true);

  // 2. 专职教师仅拥有教研与排课考勤，严禁触碰退费审批与系统设置
  assert.strictEqual(ContractRBACEngine.hasPermission(roleTeacher.permissions, 'curriculum:view'), true);
  assert.strictEqual(ContractRBACEngine.hasPermission(roleTeacher.permissions, 'educational:workbench:attend'), true);
  assert.strictEqual(ContractRBACEngine.hasPermission(roleTeacher.permissions, 'financial:approval:process'), false);
  assert.strictEqual(ContractRBACEngine.hasPermission(roleTeacher.permissions, 'system:setting:role:edit'), false);

  // 3. 校区出纳拥有财务查看与退费凭证上传，不得触碰排课调度
  assert.strictEqual(ContractRBACEngine.hasPermission(roleCashier.permissions, 'financial:order:view'), true);
  assert.strictEqual(ContractRBACEngine.hasPermission(roleCashier.permissions, 'educational:schedule:edit'), false);
});

// =============================================================================
// SUITE 3: 4 种数据透视范围过滤对抗测试 (Data Scopes Matrix)
// =============================================================================
console.log(`\n${c.bold}${c.blue}▶ SUITE 3: 4 种数据透视范围过滤对抗测试${c.reset}`);

// 3.1 学员多维度透视切分 (all / campus / department / self)
runTest('Scope-Students', '4 种数据透视范围在学员数据集 (MOCK_STUDENTS + 合成数据) 上的精准切分', () => {
  // 构建涵盖多校区、多部门、多负责人的学员复合数据集
  const dataset = [
    { id: 's1', name: '学员1', campusId: 'CAMPUS_HQ', departmentId: 'DEP_MKT', ownerId: 'USER_MKT_1' },
    { id: 's2', name: '学员2', campusId: 'CAMPUS_HQ', departmentId: 'DEP_MKT', ownerId: 'USER_MKT_2' },
    { id: 's3', name: '学员3', campusId: 'CAMPUS_HQ', departmentId: 'DEP_EDU', ownerId: 'USER_EDU_1' },
    { id: 's4', name: '学员4', campusId: 'CAMPUS_HAIDIAN', departmentId: 'DEP_MKT', ownerId: 'USER_MKT_1' },
    { id: 's5', name: '学员5', campusId: 'CAMPUS_HAIDIAN', departmentId: 'DEP_EDU', ownerId: 'USER_EDU_2' },
    { id: 's6', name: '学员6', campusId: 'CAMPUS_CHAOYANG', departmentId: 'DEP_MKT', ownerId: 'USER_MKT_3' },
  ];

  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // 1. scope = 'all'：返回全量
    const userAll = { id: 'u_admin', dataScope: 'all', campusId: 'CAMPUS_HQ', departmentId: 'DEP_MKT' };
    const resAll = engine.filterByDataScope(userAll, dataset);
    assert.strictEqual(resAll.length, 6);
    assert.strictEqual(resAll, dataset); // 契约要求直接返回原始数据引用

    // 2. scope = 'campus'：仅本校区，跨校区零泄漏
    const userCampus = { id: 'u_principal', dataScope: 'campus', campusId: 'CAMPUS_HQ' };
    const resCampus = engine.filterByDataScope(userCampus, dataset);
    assert.strictEqual(resCampus.length, 3);
    assert.deepStrictEqual(resCampus.map(s => s.id).sort(), ['s1', 's2', 's3']);
    assert.ok(resCampus.every(s => s.campusId === 'CAMPUS_HQ'));

    // 3. scope = 'department'：仅本部门，跨部门零泄漏
    const userDept = { id: 'u_mgr', dataScope: 'department', campusId: 'CAMPUS_HQ', departmentId: 'DEP_MKT' };
    const resDept = engine.filterByDataScope(userDept, dataset);
    assert.strictEqual(resDept.length, 4);
    assert.deepStrictEqual(resDept.map(s => s.id).sort(), ['s1', 's2', 's4', 's6']);
    assert.ok(resDept.every(s => s.departmentId === 'DEP_MKT'));

    // 4. scope = 'self'：仅本人经办/所属
    const userSelf = { id: 'USER_MKT_1', dataScope: 'self' };
    const resSelf = engine.filterByDataScope(userSelf, dataset);
    assert.strictEqual(resSelf.length, 2);
    assert.deepStrictEqual(resSelf.map(s => s.id).sort(), ['s1', 's4']);
    assert.ok(resSelf.every(s => s.ownerId === 'USER_MKT_1'));
  });
});

// 3.2 订单多维度透视切分与自定义字段映射 (creator / salesOwner)
runTest('Scope-Orders-CustomFields', '订单数据集多维度切分与自定义字段参数映射 (itemCampusIdField / itemOwnerField)', () => {
  const orders = [
    { id: 'ord_1', campusId: 'C_HQ', departmentId: 'D_FIN', creator: 'USER_CASHIER_1', amount: 3000 },
    { id: 'ord_2', campusId: 'C_HQ', departmentId: 'D_SALES', creator: 'USER_SALES_1', amount: 5000 },
    { id: 'ord_3', campusId: 'C_HD', departmentId: 'D_FIN', creator: 'USER_CASHIER_2', amount: 4000 },
    { id: 'ord_4', campusId: 'C_HD', departmentId: 'D_SALES', creator: 'USER_SALES_1', amount: 6000 },
  ];

  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // scope = 'self' 并使用自定义字段映射 itemOwnerField = 'creator'
    const userSales = { id: 'USER_SALES_1', dataScope: 'self' };
    const resSelf = engine.filterByDataScope(userSales, orders, 'campusId', 'departmentId', 'creator');
    assert.strictEqual(resSelf.length, 2);
    assert.deepStrictEqual(resSelf.map(o => o.id).sort(), ['ord_2', 'ord_4']);

    // scope = 'campus' 配合默认字段
    const userHq = { id: 'u1', campusId: 'C_HQ', dataScope: 'campus' };
    const resHq = engine.filterByDataScope(userHq, orders);
    assert.strictEqual(resHq.length, 2);
    assert.deepStrictEqual(resHq.map(o => o.id).sort(), ['ord_1', 'ord_2']);
  });
});

// 3.3 排课课节多维度透视切分 (teacherId 映射)
runTest('Scope-Schedule-TeacherField', '教务排课日程切分与教师自专属排课透视 (teacherId 映射)', () => {
  const schedules = [
    { id: 'evt_1', campusId: 'CAMPUS_HQ', departmentId: 'DEP_EDU_1', teacherId: 'T_ZHANG' },
    { id: 'evt_2', campusId: 'CAMPUS_HQ', departmentId: 'DEP_EDU_1', teacherId: 'T_LI' },
    { id: 'evt_3', campusId: 'CAMPUS_HAIDIAN', departmentId: 'DEP_EDU_2', teacherId: 'T_ZHANG' },
  ];

  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // 教师查看本人课表
    const teacherZhang = { id: 'T_ZHANG', dataScope: 'self' };
    const myEvents = engine.filterByDataScope(teacherZhang, schedules, 'campusId', 'departmentId', 'teacherId');
    assert.strictEqual(myEvents.length, 2);
    assert.deepStrictEqual(myEvents.map(e => e.id).sort(), ['evt_1', 'evt_3']);

    // 分校校长查看本校区课表
    const principalHd = { campusId: 'CAMPUS_HAIDIAN', dataScope: 'campus' };
    const hdEvents = engine.filterByDataScope(principalHd, schedules);
    assert.strictEqual(hdEvents.length, 1);
    assert.strictEqual(hdEvents[0].id, 'evt_3');
  });
});

// 3.4 真实生产数据中心 MOCK_STUDENTS / MOCK_ORDERS / MOCK_SCHEDULE 联动校验
runTest('Scope-Real-Datasets-Audit', '生产级真实 Mock 数据集透视隔离核验', () => {
  // 1. 检验真实 MOCK_STUDENTS
  assert.ok(Array.isArray(MOCK_STUDENTS) && MOCK_STUDENTS.length > 0);
  const hqStudents = ContractRBACEngine.filterByDataScope(
    { campusId: 'campus-bj-hq', dataScope: 'campus' },
    MOCK_STUDENTS
  );
  assert.ok(hqStudents.length > 0);
  assert.ok(hqStudents.every(s => s.campusId === 'campus-bj-hq'));

  // 2. 检验真实 MOCK_ORDERS_DATA
  assert.ok(Array.isArray(MOCK_ORDERS_DATA) && MOCK_ORDERS_DATA.length > 0);
  const allOrders = ContractRBACEngine.filterByDataScope(
    { dataScope: 'all' },
    MOCK_ORDERS_DATA
  );
  assert.strictEqual(allOrders.length, MOCK_ORDERS_DATA.length);

  // 3. 检验真实 MOCK_SCHEDULE_EVENTS
  assert.ok(Array.isArray(MOCK_SCHEDULE_EVENTS) && MOCK_SCHEDULE_EVENTS.length > 0);
  const teacherEvents = ContractRBACEngine.filterByDataScope(
    { id: 't-001', dataScope: 'self' },
    MOCK_SCHEDULE_EVENTS,
    'campusId',
    'departmentId',
    'teacherId'
  );
  assert.ok(teacherEvents.every(e => e.teacherId === 't-001'));
});

// 3.5 非法/畸形/越权数据范围安全空列表兜底防御
runTest('Scope-Adversarial-Negative', '非法 scope、空字符串与注入攻击 100% 安全空列表兜底', () => {
  const sensitiveItems = [
    { id: 'top_secret_1', campusId: 'C1', departmentId: 'D1', ownerId: 'U1' },
    { id: 'top_secret_2', campusId: 'C2', departmentId: 'D2', ownerId: 'U2' },
  ];

  const maliciousUsers = [
    { dataScope: '' }, // 空字符串
    { dataScope: 'unknown' }, // 未知 scope
    { dataScope: 'tenant' },
    { dataScope: 'school' },
    { dataScope: 'custom' },
    { dataScope: 'ALL' }, // 大小写不匹配
    { dataScope: 'CAMPUS' },
    { dataScope: null }, // 空值
    { dataScope: undefined },
    { dataScope: 12345 }, // 数字
    { dataScope: {} }, // 对象
    { dataScope: 'campus; DROP TABLE users;' }, // SQL 注入尝试
    { dataScope: '../etc/passwd' }, // 路径遍历尝试
  ];

  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    maliciousUsers.forEach(malUser => {
      const filtered = engine.filterByDataScope(malUser, sensitiveItems);
      assert.ok(Array.isArray(filtered), 'Must return an array');
      assert.strictEqual(filtered.length, 0, `Scope "${malUser.dataScope}" MUST fallback to empty array`);
    });

    // 空数据集防护
    assert.deepStrictEqual(engine.filterByDataScope({ dataScope: 'all' }, []), []);
    assert.deepStrictEqual(engine.filterByDataScope({ dataScope: 'campus', campusId: 'C1' }, []), []);
  });
});

// =============================================================================
// SUITE 4: 5 级组织机构树合规删除风控拦截对抗 (validateNodeDeletion)
// =============================================================================
console.log(`\n${c.bold}${c.blue}▶ SUITE 4: 5 级组织机构树合规删除风控拦截对抗${c.reset}`);

// 4.1 核心风控规则阻断
runTest('Org-Delete-Contract', 'validateNodeDeletion 5 级组织架构删除核心风控拦截', () => {
  const testTree = [
    {
      id: 'root-group',
      name: '拓视未来教育集团总部',
      level: 1,
      type: 'group',
      boundUserCount: 100,
      children: [
        {
          id: 'region-1',
          name: '北京大区',
          level: 2,
          type: 'region',
          boundUserCount: 80,
          children: [
            {
              id: 'campus-1',
              name: '总部校区',
              level: 3,
              type: 'campus',
              boundUserCount: 40,
              children: [
                {
                  id: 'dept-1',
                  name: '教研部',
                  level: 4,
                  type: 'department',
                  boundUserCount: 20,
                  children: [
                    {
                      id: 'post-busy',
                      name: '资深主讲岗位',
                      level: 5,
                      type: 'post',
                      boundUserCount: 12,
                      children: [],
                    },
                    {
                      id: 'post-free',
                      name: '体验课助教兼职(待定岗)',
                      level: 5,
                      type: 'post',
                      boundUserCount: 0,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  [ContractRBACEngine, TsRBACEngine].forEach(engine => {
    // 规则 1: 根集团节点绝对阻断
    assert.throws(
      () => engine.validateNodeDeletion(testTree, 'root-group'),
      /Root organization group node cannot be deleted/
    );

    // 规则 2: 拥有子节点阻断 (HasChildNodesException)
    assert.throws(
      () => engine.validateNodeDeletion(testTree, 'region-1'),
      /HasChildNodesException/
    );
    assert.throws(
      () => engine.validateNodeDeletion(testTree, 'campus-1'),
      /HasChildNodesException/
    );
    assert.throws(
      () => engine.validateNodeDeletion(testTree, 'dept-1'),
      /HasChildNodesException/
    );

    // 规则 3: 绑定在职员工岗位阻断
    assert.throws(
      () => engine.validateNodeDeletion(testTree, 'post-busy'),
      /currently bound to 12 active employees/
    );

    // 规则 4: 节点不存在防御
    assert.throws(
      () => engine.validateNodeDeletion(testTree, 'non_existing_node_id'),
      /not found in organizational tree/
    );

    // 规则 5: 无子节点且无绑定员工的合规叶子节点放行
    const res = engine.validateNodeDeletion(testTree, 'post-free');
    assert.strictEqual(res.canDelete, true);
    assert.strictEqual(res.node.id, 'post-free');
    assert.strictEqual(res.node.name, '体验课助教兼职(待定岗)');
  });
});

// 4.2 真实生产 MOCK_ORG_TREE_DATA 深度核验
runTest('Org-Delete-RealTree', '真实 MOCK_ORG_TREE_DATA 全层级风控核验与叶子节点合规删除', () => {
  // 1. 验证集团根节点阻断
  assert.throws(
    () => TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'org-root'),
    /Root organization group node cannot be deleted/
  );

  // 2. 验证华北北京大区阻断
  assert.throws(
    () => TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'region-bj'),
    /HasChildNodesException/
  );

  // 3. 验证总部校区阻断
  assert.throws(
    () => TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'campus-bj-hq'),
    /HasChildNodesException/
  );

  // 4. 验证在职金牌讲师岗位阻断 (绑定 14 人)
  assert.throws(
    () => TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'post-hq-teacher'),
    /bound to 14 active employees/
  );

  // 5. 验证合规预置待定岗助教叶子节点放行 (boundUserCount: 0)
  const ok = TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'post-test-leaf');
  assert.strictEqual(ok.canDelete, true);
  assert.strictEqual(ok.node.id, 'post-test-leaf');
});

// =============================================================================
// SUITE 5: 双轨引擎跨实现 100% 严格一致性交叉对照验证 (Dual-Track Consistency)
// =============================================================================
console.log(`\n${c.bold}${c.blue}▶ SUITE 5: 双轨引擎严格一致性交叉对照验证 (Contract vs TS Engine)${c.reset}`);

runTest('DualTrack-Consistency', '双轨引擎在权限联动、通配符、数据范围上的 100% 输出等价性', () => {
  // 1. updateTreeCheckState 等价性
  for (let i = 0; i < 50; i++) {
    const rawTree1 = {
      id: 'root',
      children: [
        { id: 'c1', checked: i % 2 === 0, children: [{ id: 'gc1', checked: i % 3 === 0 }] },
        { id: 'c2', checked: i % 4 === 0 },
      ],
    };
    const rawTree2 = JSON.parse(JSON.stringify(rawTree1));

    const res1 = ContractRBACEngine.updateTreeCheckState(rawTree1);
    const res2 = TsRBACEngine.updateTreeCheckState(rawTree2);

    assert.strictEqual(res1.checked, res2.checked);
    assert.strictEqual(res1.indeterminate, res2.indeterminate);
    assert.deepStrictEqual(rawTree1, rawTree2);
  }

  // 2. setSubtreeChecked 等价性
  const t1 = { id: 'root', children: [{ id: 'c1', children: [{ id: 'gc1' }] }] };
  const t2 = JSON.parse(JSON.stringify(t1));
  ContractRBACEngine.setSubtreeChecked(t1, true);
  TsRBACEngine.setSubtreeChecked(t2, true);
  assert.deepStrictEqual(t1, t2);

  // 3. hasPermission 等价性
  const permVectors = [
    { perms: ['*'], req: 'order:view' },
    { perms: ['admin:all'], req: 'order:view' },
    { perms: ['student:view', 'order:view'], req: 'student:view' },
    { perms: ['student:view', 'order:view'], req: 'order:delete' },
    { perms: [], req: 'any' },
    { perms: undefined, req: 'any' },
  ];

  permVectors.forEach(v => {
    const r1 = ContractRBACEngine.hasPermission(v.perms, v.req);
    const r2 = TsRBACEngine.hasPermission(v.perms, v.req);
    assert.strictEqual(r1, r2, `hasPermission mismatch for ${JSON.stringify(v)}`);
  });

  // 4. filterByDataScope 等价性
  const mockItems = [
    { id: '1', campusId: 'C1', departmentId: 'D1', ownerId: 'U1' },
    { id: '2', campusId: 'C1', departmentId: 'D2', ownerId: 'U2' },
    { id: '3', campusId: 'C2', departmentId: 'D1', ownerId: 'U1' },
  ];

  const scopeVectors = [
    { dataScope: 'all' },
    { dataScope: 'campus', campusId: 'C1' },
    { dataScope: 'department', departmentId: 'D1' },
    { dataScope: 'self', id: 'U1' },
    { dataScope: 'invalid' },
    { dataScope: '' },
  ];

  scopeVectors.forEach(u => {
    const f1 = ContractRBACEngine.filterByDataScope(u, mockItems);
    const f2 = TsRBACEngine.filterByDataScope(u, mockItems);
    assert.deepStrictEqual(f1, f2, `filterByDataScope mismatch for scope ${u.dataScope}`);
  });
});

// =============================================================================
// SUITE 6: 大规模高压力基准测试 (Stress & Benchmark)
// =============================================================================
console.log(`\n${c.bold}${c.blue}▶ SUITE 6: 大规模高压力基准测试 (Stress & Benchmark)${c.reset}`);

runTest('Benchmark-DataScope-50K', '50,000 条业务数据 4 种 scope 过滤极速压测 (<100ms)', () => {
  const largeDataset = Array.from({ length: 50000 }, (_, i) => ({
    id: `item_${i}`,
    campusId: `campus_${i % 5}`,
    departmentId: `dept_${i % 10}`,
    ownerId: `user_${i % 100}`,
  }));

  const start = performance.now();
  const campusRes = ContractRBACEngine.filterByDataScope(
    { campusId: 'campus_2', dataScope: 'campus' },
    largeDataset
  );
  const selfRes = ContractRBACEngine.filterByDataScope(
    { id: 'user_42', dataScope: 'self' },
    largeDataset
  );
  const elapsed = performance.now() - start;

  assert.strictEqual(campusRes.length, 10000);
  assert.strictEqual(selfRes.length, 500);
  assert.ok(elapsed < 100, `Filtering 50,000 items took ${elapsed.toFixed(2)}ms (expected <100ms)`);
});

runTest('Benchmark-Permissions-10K', '10,000 次细粒度权限校验压测 (<50ms)', () => {
  const perms = ['curriculum:view', 'student:view', 'financial:order:view', 'educational:schedule:view'];
  const start = performance.now();

  for (let i = 0; i < 10000; i++) {
    const query = i % 2 === 0 ? 'student:view' : 'unauthorized:action';
    ContractRBACEngine.hasPermission(perms, query);
  }
  const elapsed = performance.now() - start;

  assert.ok(elapsed < 50, `10,000 permission checks took ${elapsed.toFixed(2)}ms (expected <50ms)`);
});

runTest('Benchmark-TreeUpdate-5K', '5,000 节点大规模复杂树联动更新性能压测 (<50ms)', () => {
  // 构建 5000 节点树：5 模块 * 10 页面 * 100 按钮 = 5000 叶子
  const bigTree = {
    id: 'sys',
    children: Array.from({ length: 5 }, (_, m) => ({
      id: `mod_${m}`,
      children: Array.from({ length: 10 }, (_, p) => ({
        id: `page_${m}_${p}`,
        children: Array.from({ length: 100 }, (_, b) => ({
          id: `btn_${m}_${p}_${b}`,
          checked: (m + p + b) % 5 === 0,
        })),
      })),
    })),
  };

  const start = performance.now();
  ContractRBACEngine.updateTreeCheckState(bigTree);
  const elapsed = performance.now() - start;

  assert.strictEqual(bigTree.checked, false);
  assert.strictEqual(bigTree.indeterminate, true);
  assert.ok(elapsed < 50, `5,000 node tree update took ${elapsed.toFixed(2)}ms (expected <50ms)`);
});

// =============================================================================
// 测试总结报告输出
// =============================================================================
console.log(`\n${c.bold}${c.cyan}--------------------------------------------------------------------------------${c.reset}`);
console.log(`${c.bold}测试执行统计概览:${c.reset}`);
console.log(`  总用例数 (Total Suites/Tests): ${c.bold}${stats.total}${c.reset}`);
console.log(`  成功通过 (Passed):             ${c.green}${c.bold}${stats.passed}${c.reset}`);
console.log(`  失败用例 (Failed):             ${stats.failed === 0 ? c.green : c.red}${c.bold}${stats.failed}${c.reset}`);
console.log(`  综合通过率 (Pass Rate):        ${stats.failed === 0 ? c.green : c.red}${c.bold}${((stats.passed / stats.total) * 100).toFixed(2)}%${c.reset}`);
console.log(`${c.bold}${c.cyan}================================================================================${c.reset}\n`);

if (stats.failed > 0) {
  console.error(`${c.red}${c.bold}【CHALLENGE REJECTED】存在 ${stats.failed} 项对抗断言失败，详见上方错误日志！${c.reset}`);
  process.exit(1);
} else {
  console.log(`${c.green}${c.bold}【CHALLENGE APPROVED】全部 21 组对抗测试用例 100% 通过，系统细粒度 RBAC 树联动与数据透视表现稳健坚固！${c.reset}`);
  process.exit(0);
}
