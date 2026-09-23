/**
 * Milestone 6 系统设置与 RBAC 架构对抗性压力测试套件 (Reviewer/Critic M6-1)
 * 纯 Node.js 原生沙箱标准执行，严禁使用 BypassSandbox，严格保持只读与零污染原则。
 */

const path = require('node:path');
const createJiti = require('jiti');

const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

// 加载 Contract 版 RBACEngine 与 TypeScript Mock 版 RBACEngine
const ContractRBACEngine = require('./contracts/rbacEngine');
const mockSystem = jiti('../src/mocks/system.ts');
const MockRBACEngine = mockSystem.RBACEngine;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, regExp, message) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (regExp && !regExp.test(err.message)) {
      throw new Error(`${message || 'Wrong error thrown'}: expected ${regExp}, got "${err.message}"`);
    }
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw, but it did not throw');
  }
}

function runTest(suiteName, testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ${colors.green}✓${colors.reset} [${suiteName}] ${testName}`);
  } catch (err) {
    failedTests++;
    failures.push({ suiteName, testName, error: err });
    console.log(`  ${colors.red}✗ [${suiteName}] ${testName}: ${err.message}${colors.reset}`);
  }
}

console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}   Milestone 6: RBAC 与系统设置架构对抗性压力与完整性测试套件    ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

// =============================================================================
// Suite 1: RBACEngine 契约与 TS 实现对齐与完整性 (Anti-Facade / Anti-Hardcode)
// =============================================================================
console.log(`${colors.bold}${colors.blue}▶ Suite 1: RBACEngine 契约与 TS 实现双轨一致性${colors.reset}`);

for (const [engineName, Engine] of [['ContractEngine', ContractRBACEngine], ['MockEngine', MockRBACEngine]]) {
  // 1.1 动态未知随机节点删除阻断测试
  runTest(`Suite 1 (${engineName})`, '非硬编码：随机层级与ID的组织树删除阻断', () => {
    const randomId = 'RAND_' + Math.random().toString(36).substring(2, 9);
    const tree = [
      {
        id: 'root',
        level: 1,
        type: 'group',
        name: '集团',
        children: [
          {
            id: randomId,
            level: 4,
            type: 'department',
            name: '随机测试部门',
            children: [{ id: 'child_1', level: 5, type: 'post', name: '下级岗位' }],
            boundUserCount: 0
          }
        ]
      }
    ];

    // 含子节点必阻断
    assertThrows(() => Engine.validateNodeDeletion(tree, randomId), /HasChildNodesException/);

    // 不存在节点抛出异常
    assertThrows(() => Engine.validateNodeDeletion(tree, 'NON_EXISTENT_ID'), /not found/);
  });

  // 1.2 根节点阻断
  runTest(`Suite 1 (${engineName})`, '根节点阻断：集团根节点禁止删除', () => {
    const tree = [{ id: 'root_node', level: 1, type: 'group', name: '盛通集团', children: [] }];
    assertThrows(() => Engine.validateNodeDeletion(tree, 'root_node'), /Root organization group node cannot be deleted/);
  });

  // 1.3 在职员工绑定阻断
  runTest(`Suite 1 (${engineName})`, '在职员工阻断：有员工绑定的岗位严禁删除', () => {
    const tree = [
      {
        id: 'root',
        level: 1,
        children: [
          {
            id: 'post_teacher',
            level: 5,
            type: 'post',
            name: '金牌讲师岗',
            children: [],
            boundUserCount: 17
          }
        ]
      }
    ];
    assertThrows(() => Engine.validateNodeDeletion(tree, 'post_teacher'), /bound to 17 active employees/);
  });

  // 1.4 合规叶子节点允许删除
  runTest(`Suite 1 (${engineName})`, '合规叶子节点：无子节点且无绑定员工返回 canDelete=true', () => {
    const tree = [
      {
        id: 'root',
        level: 1,
        children: [
          {
            id: 'post_empty',
            level: 5,
            type: 'post',
            name: '待定岗助教',
            children: [],
            boundUserCount: 0
          }
        ]
      }
    ];
    const res = Engine.validateNodeDeletion(tree, 'post_empty');
    assert(res.canDelete === true, 'res.canDelete must be true');
    assertEqual(res.node.id, 'post_empty', 'res.node.id matches target');
  });
}

// =============================================================================
// Suite 2: 4 级权限树半选联动算法极端压力测试 (Indeterminate State Engine)
// =============================================================================
console.log(`\n${colors.bold}${colors.blue}▶ Suite 2: 4 级权限树半选联动与递归勾选压力测试${colors.reset}`);

for (const [engineName, Engine] of [['ContractEngine', ContractRBACEngine], ['MockEngine', MockRBACEngine]]) {
  // 2.1 深度 4 级树（系统 -> 模块 -> 页面 -> 按钮）全选联动
  runTest(`Suite 2 (${engineName})`, '四级深层全选：所有叶子勾选时，全链路祖先全选', () => {
    const tree = {
      id: 'sys',
      checked: false,
      children: [
        {
          id: 'mod',
          checked: false,
          children: [
            {
              id: 'page',
              checked: false,
              children: [
                { id: 'btn1', checked: true },
                { id: 'btn2', checked: true },
                { id: 'btn3', checked: true }
              ]
            }
          ]
        }
      ]
    };

    Engine.updateTreeCheckState(tree);
    assertEqual(tree.checked, true, 'root checked should be true');
    assertEqual(tree.indeterminate, false, 'root indeterminate should be false');
    assertEqual(tree.children[0].checked, true, 'module checked should be true');
    assertEqual(tree.children[0].indeterminate, false, 'module indeterminate should be false');
    assertEqual(tree.children[0].children[0].checked, true, 'page checked should be true');
    assertEqual(tree.children[0].children[0].indeterminate, false, 'page indeterminate should be false');
  });

  // 2.2 深度 4 级树：1 开 N 关自底向上半选传染
  runTest(`Suite 2 (${engineName})`, '半选传染：深层单按钮勾选导致祖先链全半选', () => {
    const tree = {
      id: 'sys',
      checked: false,
      children: [
        {
          id: 'mod1',
          children: [
            {
              id: 'page1',
              children: [
                { id: 'btn1', checked: true },
                { id: 'btn2', checked: false }
              ]
            }
          ]
        },
        {
          id: 'mod2',
          children: [
            {
              id: 'page2',
              children: [
                { id: 'btn3', checked: false }
              ]
            }
          ]
        }
      ]
    };

    Engine.updateTreeCheckState(tree);
    // page1: 1 checked, 1 unchecked -> checked=false, indeterminate=true
    assertEqual(tree.children[0].children[0].checked, false);
    assertEqual(tree.children[0].children[0].indeterminate, true);

    // mod1: has indeterminate child -> checked=false, indeterminate=true
    assertEqual(tree.children[0].checked, false);
    assertEqual(tree.children[0].indeterminate, true);

    // mod2: all unchecked -> checked=false, indeterminate=false
    assertEqual(tree.children[1].checked, false);
    assertEqual(tree.children[1].indeterminate, false);

    // sys: has indeterminate child -> checked=false, indeterminate=true
    assertEqual(tree.checked, false);
    assertEqual(tree.indeterminate, true);
  });

  // 2.3 批量全选与清空子树
  runTest(`Suite 2 (${engineName})`, '批量子树级联：setSubtreeChecked 深度贯穿', () => {
    const tree = {
      id: 'root',
      checked: false,
      children: [
        {
          id: 'c1',
          checked: false,
          children: [
            { id: 'gc1', checked: false, children: [{ id: 'ggc1', checked: false }] }
          ]
        },
        { id: 'c2', checked: false, children: [] }
      ]
    };

    Engine.setSubtreeChecked(tree, true);
    assertEqual(tree.checked, true);
    assertEqual(tree.children[0].children[0].children[0].checked, true);
    assertEqual(tree.children[1].checked, true);

    Engine.setSubtreeChecked(tree, false);
    assertEqual(tree.checked, false);
    assertEqual(tree.children[0].children[0].children[0].checked, false);
    assertEqual(tree.children[1].checked, false);
  });

  // 2.4 幂等性与纯函数稳定性
  runTest(`Suite 2 (${engineName})`, '状态算法幂等性：连续多次调用 updateTreeCheckState 结果恒定', () => {
    const tree = {
      id: 'root',
      children: [
        { id: 'c1', checked: true },
        { id: 'c2', checked: false }
      ]
    };
    const s1 = Engine.updateTreeCheckState(tree);
    const s2 = Engine.updateTreeCheckState(tree);
    const s3 = Engine.updateTreeCheckState(tree);
    assertEqual(s1.checked, s2.checked);
    assertEqual(s2.checked, s3.checked);
    assertEqual(s1.indeterminate, s2.indeterminate);
    assertEqual(s2.indeterminate, s3.indeterminate);
  });
}

// =============================================================================
// Suite 3: 通配符与权限判决对抗测试 (Security & Wildcard Bypass)
// =============================================================================
console.log(`\n${colors.bold}${colors.blue}▶ Suite 3: 通配符与权限判决对抗测试${colors.reset}`);

for (const [engineName, Engine] of [['ContractEngine', ContractRBACEngine], ['MockEngine', MockRBACEngine]]) {
  runTest(`Suite 3 (${engineName})`, '通配符放行：* 与 admin:all 放行任意细粒度权限', () => {
    assert(Engine.hasPermission(['*'], 'curriculum:course:add') === true);
    assert(Engine.hasPermission(['*'], 'financial:refund:approve') === true);
    assert(Engine.hasPermission(['*'], 'system:arbitrary:dangerous_cmd') === true);

    assert(Engine.hasPermission(['admin:all'], 'student:enroll') === true);
    assert(Engine.hasPermission(['admin:all'], 'educational:schedule:edit') === true);
  });

  runTest(`Suite 3 (${engineName})`, '细粒度精确匹配与未授权阻断', () => {
    const perms = ['curriculum:view', 'student:view', 'educational:schedule:view'];
    assert(Engine.hasPermission(perms, 'curriculum:view') === true);
    assert(Engine.hasPermission(perms, 'student:view') === true);
    assert(Engine.hasPermission(perms, 'student:enroll') === false);
    assert(Engine.hasPermission(perms, 'financial:order:void') === false);
  });

  runTest(`Suite 3 (${engineName})`, '空权限列表与非法入参鲁棒性', () => {
    assert(Engine.hasPermission([], 'curriculum:view') === false);
    assert(Engine.hasPermission(undefined, 'curriculum:view') === false);
  });
}

// =============================================================================
// Suite 4: 4 种数据透视隔离范围 (all / campus / department / self) 大数据量过滤
// =============================================================================
console.log(`\n${colors.bold}${colors.blue}▶ Suite 4: 4 种数据透视隔离范围大数据量压力测试${colors.reset}`);

for (const [engineName, Engine] of [['ContractEngine', ContractRBACEngine], ['MockEngine', MockRBACEngine]]) {
  runTest(`Suite 4 (${engineName})`, '1000 笔多校区/多部门/多所有者数据集精准穿透与隔离', () => {
    // 构造 1000 条业务数据
    const campuses = ['campus_hq', 'campus_yy', 'campus_cy', 'campus_hd', 'campus_wj'];
    const depts = ['dept_edu', 'dept_mkt', 'dept_fin', 'dept_adm'];
    const owners = ['user_01', 'user_02', 'user_03', 'user_04', 'user_05'];

    const mockOrders = [];
    for (let i = 0; i < 1000; i++) {
      mockOrders.push({
        id: `ord_${i}`,
        campusId: campuses[i % campuses.length],
        departmentId: depts[i % depts.length],
        ownerId: owners[i % owners.length],
        amount: (i + 1) * 10
      });
    }

    // 1. scope: 'all' -> 1000 笔全透视
    const superAdmin = { id: 'user_01', campusId: 'campus_hq', departmentId: 'dept_edu', dataScope: 'all' };
    const allRes = Engine.filterByDataScope(superAdmin, mockOrders);
    assertEqual(allRes.length, 1000, 'all scope should return 1000');

    // 2. scope: 'campus' -> 属于 campus_hq 的恰好 200 笔 (1000 / 5)
    const principalHQ = { id: 'user_01', campusId: 'campus_hq', departmentId: 'dept_edu', dataScope: 'campus' };
    const campusRes = Engine.filterByDataScope(principalHQ, mockOrders);
    assertEqual(campusRes.length, 200, 'campus scope should return exactly 200');
    assert(campusRes.every(item => item.campusId === 'campus_hq'), 'all items belong to campus_hq');

    // 3. scope: 'department' -> 属于 dept_mkt 的恰好 250 笔 (1000 / 4)
    const mktManager = { id: 'user_02', campusId: 'campus_yy', departmentId: 'dept_mkt', dataScope: 'department' };
    const deptRes = Engine.filterByDataScope(mktManager, mockOrders);
    assertEqual(deptRes.length, 250, 'department scope should return exactly 250');
    assert(deptRes.every(item => item.departmentId === 'dept_mkt'), 'all items belong to dept_mkt');

    // 4. scope: 'self' -> 属于 user_03 的恰好 200 笔 (1000 / 5)
    const teacher03 = { id: 'user_03', campusId: 'campus_hd', departmentId: 'dept_edu', dataScope: 'self' };
    const selfRes = Engine.filterByDataScope(teacher03, mockOrders);
    assertEqual(selfRes.length, 200, 'self scope should return exactly 200');
    assert(selfRes.every(item => item.ownerId === 'user_03'), 'all items belong to user_03');

    // 5. 非法作用域返回空数组
    const invalidUser = { id: 'user_01', campusId: 'campus_hq', dataScope: 'unknown_scope' };
    const emptyRes = Engine.filterByDataScope(invalidUser, mockOrders);
    assertEqual(emptyRes.length, 0, 'invalid scope must return empty array');
  });
}

// =============================================================================
// Suite 5: 真实 Mock 数据集与生产配置完整性校验
// =============================================================================
console.log(`\n${colors.bold}${colors.blue}▶ Suite 5: 系统设置真实 Mock 资产与业务完备性${colors.reset}`);

runTest('Suite 5', '5 级组织架构树深度与校区映射完整性', () => {
  const tree = mockSystem.MOCK_ORG_TREE_DATA;
  assert(tree.length > 0, 'Org tree exists');
  const root = tree[0];
  assertEqual(root.level, 1, 'Root level is 1 (group)');
  assertEqual(root.type, 'group');

  const region = root.children[0];
  assertEqual(region.level, 2, 'Region level is 2');
  assertEqual(region.type, 'region');

  // 校验 5 大校区完整挂载
  const campuses = region.children;
  assertEqual(campuses.length, 5, 'Must contain exactly 5 physical campuses');
  const campusCodes = campuses.map(c => c.code);
  assert(campusCodes.includes('HQ001'), 'HQ001 exists');
  assert(campusCodes.includes('YY002'), 'YY002 exists');
  assert(campusCodes.includes('CY003'), 'CY003 exists');
  assert(campusCodes.includes('HD004'), 'HD004 exists');
  assert(campusCodes.includes('WJ005'), 'WJ005 exists');

  // 校验包含 level 4 (department) 与 level 5 (post)
  const hqDepts = campuses[0].children;
  assert(hqDepts.length >= 3, 'HQ has at least 3 departments');
  assertEqual(hqDepts[0].level, 4, 'Department level is 4');
  assertEqual(hqDepts[0].type, 'department');

  const hqPosts = hqDepts[0].children;
  assert(hqPosts.length >= 3, 'HQ Edu Dept has posts');
  assertEqual(hqPosts[0].level, 5, 'Post level is 5');
  assertEqual(hqPosts[0].type, 'post');
});

runTest('Suite 5', '在职员工数据集 (22+ 名员工) 属性完备性', () => {
  const users = mockSystem.MOCK_SYSTEM_USERS;
  assert(users.length >= 22, `Expected at least 22 employees, got ${users.length}`);

  for (const u of users) {
    assert(u.id, 'User must have id');
    assert(u.name, 'User must have name');
    assert(u.account, 'User must have account');
    assert(u.phone, 'User must have phone');
    assert(u.campusId, 'User must have campusId');
    assert(u.campusName, 'User must have campusName');
    assert(u.departmentId, 'User must have departmentId');
    assert(u.postId, 'User must have postId');
    assert(u.roleId, 'User must have roleId');
    assert(['all', 'campus', 'department', 'self'].includes(u.dataScope), 'Valid data scope');
  }
});

runTest('Suite 5', '5 大核心角色组完整性', () => {
  const roles = mockSystem.MOCK_ROLES_DATA;
  assertEqual(roles.length, 5, 'Expected 5 business roles');
  const roleCodes = roles.map(r => r.code);
  assert(roleCodes.includes('admin'), 'admin exists');
  assert(roleCodes.includes('principal'), 'principal exists');
  assert(roleCodes.includes('edu_manager'), 'edu_manager exists');
  assert(roleCodes.includes('teacher'), 'teacher exists');
  assert(roleCodes.includes('cashier'), 'cashier exists');
});

runTest('Suite 5', '4 级细粒度权限树 (系统->模块->页面->按钮) 完整性', () => {
  const permTree = mockSystem.MOCK_PERMISSION_TREE_DATA;
  assertEqual(permTree.length, 5, 'Expected 5 root systems');
  const sysCodes = permTree.map(s => s.code);
  assert(sysCodes.includes('curriculum'), 'curriculum system exists');
  assert(sysCodes.includes('student'), 'student system exists');
  assert(sysCodes.includes('educational'), 'educational system exists');
  assert(sysCodes.includes('financial'), 'financial system exists');
  assert(sysCodes.includes('system'), 'system setting exists');

  // 抽查按钮级节点 (level === 'button')
  function countButtons(nodes) {
    let count = 0;
    for (const n of nodes) {
      if (n.level === 'button') count++;
      if (n.children) count += countButtons(n.children);
    }
    return count;
  }
  const buttonCount = countButtons(permTree);
  assert(buttonCount >= 18, `Expected at least 18 button level permissions, got ${buttonCount}`);
});

runTest('Suite 5', '业务字典包含异动原因 (7大分支)、预警规则与常规课时', () => {
  const dicts = mockSystem.MOCK_DICTS_DATA;
  assert(dicts.length >= 15, `Expected >= 15 dict entries, got ${dicts.length}`);

  const transDicts = dicts.filter(d => d.category === 'trans_reason');
  assert(transDicts.length >= 7, `Expected >= 7 trans_reason items, got ${transDicts.length}`);

  const warningDicts = dicts.filter(d => d.category === 'warning_rule');
  assert(warningDicts.length >= 4, `Expected >= 4 warning_rule items, got ${warningDicts.length}`);

  const durationDicts = dicts.filter(d => d.category === 'lesson_duration');
  assert(durationDicts.length >= 4, `Expected >= 4 lesson_duration items, got ${durationDicts.length}`);
});

// =============================================================================
// 测试总结
// =============================================================================
console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
console.log(`${colors.bold}测试总数: ${totalTests} | ${colors.green}通过: ${passedTests}${colors.reset} | ${failedTests > 0 ? colors.red : colors.green}失败: ${failedTests}${colors.reset} | 通过率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
console.log(`${colors.bold}----------------------------------------------------------------${colors.reset}\n`);

if (failedTests > 0) {
  console.error(`${colors.red}${colors.bold}对抗测试发现缺陷！详情如下：${colors.reset}`);
  failures.forEach((f, idx) => {
    console.error(`  ${idx + 1}. [${f.suiteName}] ${f.testName}: ${f.error.stack || f.error.message}`);
  });
  process.exit(1);
} else {
  console.log(`${colors.green}${colors.bold}★ 对抗性压力测试与真实性检查 100% 全部通过！无完整性违规、无硬编码欺骗、无桩函数！${colors.reset}\n`);
  process.exit(0);
}
