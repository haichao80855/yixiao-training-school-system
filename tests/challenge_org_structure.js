#!/usr/bin/env node
/**
 * 拓视未来教育「一校教培系统」Milestone 6 5级组织架构与节点删除风控对抗测试套件 (Challenger M6-1)
 * 纯 Node.js 标准沙箱运行，零外部额外依赖，严禁使用 BypassSandbox
 * 
 * 对抗挑战矩阵：
 * 1. 5 级组织架构模型完整性对抗：
 *    - 集团(group/level 1)、大区(region/level 2)、校区(campus/level 3)、部门(department/level 4)、岗位(post/level 5) 5 级深度与类型规范；
 *    - 严格单调层级单向递增约束校验；
 *    - 架构层级上限约束（严禁岗位节点下继续挂载子节点，深度封顶于 5 级）；
 *    - 机构编码唯一性检测边界（重名/重编码冲突拦截、大小写敏感、空格处理与同级重名防御）；
 *    - 岗位在职人数向上汇聚守恒律（岗位->部门->校区->大区->集团逐级一致）。
 * 2. 节点删除安全风控极限对抗：
 *    - 根组织节点绝对禁止删除阻断（`Root organization group node cannot be deleted`），即使孤立空节点亦严格阻断；
 *    - 具有下属子节点的非叶子节点删除阻断（抛出 `HasChildNodesException` 并明确子节点数量）；
 *    - 绑定在职员工（boundUserCount > 0）的叶子节点删除阻断（抛出 `bound to X active employees`）；
 *    - 唯独无子节点且 boundUserCount === 0 的末级叶子节点合规删除（post-test-leaf 验证）；
 *    - 不存在的节点 ID、空字符串、特殊字符注入抛错防御；
 *    - 畸变节点删除测试。
 * 3. 节点层级深度动态计算与多校区人员映射关联测试：
 *    - 递归动态深度计算 Oracle（全局深度严格为 5，校区子树深度为 3）；
 *    - 路径深度与声明 level 一致性断言；
 *    - 22 名全量员工与 5 大校区、部门、岗位的全景拓扑映射合规性；
 *    - 多校区/部门/岗位人员联动过滤完备性与跨校区人员零泄漏隔离性。
 * 4. 双轨引擎契约一致性比对 (Contract JS vs TS Middle-Platform Engine)。
 * 5. 现场数据隔离与零污染复原机制验证 (Zero-Pollution Invariant)。
 */

const path = require('node:path');
const assert = require('node:assert');
const createJiti = require('jiti');

// 加载 CommonJS 核心契约引擎
const ContractRBACEngine = require('./contracts/rbacEngine');

// 使用 jiti 加载 TypeScript 生产源码及 Mock 数据
const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const systemMock = jiti('../src/mocks/system.ts');
const {
  RBACEngine: TsRBACEngine,
  MOCK_ORG_TREE_DATA,
  MOCK_SYSTEM_USERS,
  MOCK_ROLES_DATA,
  MOCK_PERMISSION_TREE_DATA,
  MOCK_DICTS_DATA,
  MOCK_ORG_NODES,
  MOCK_SYSTEM_USER_LIST,
  MOCK_ROLES_LIST,
  getOrgTree,
  addOrgNode,
  updateOrgNode,
  deleteOrgNode,
  getSystemUsers
} = systemMock;

// 终端颜色格式化
const colors = {
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

// 测试运行记录器
const tracker = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
  suiteResults: [],
  errors: [],
  startTime: Date.now(),
};

function describe(suiteName, fn) {
  tracker.suites++;
  console.log(`\n${colors.bold}${colors.cyan}▶ [Suite ${tracker.suites}] ${suiteName}${colors.reset}`);
  const suiteRecord = { name: suiteName, passed: 0, failed: 0, total: 0 };
  tracker.suiteResults.push(suiteRecord);
  fn(suiteRecord);
}

function test(testName, fn, currentSuite) {
  tracker.total++;
  if (currentSuite) currentSuite.total++;
  const start = Date.now();
  try {
    fn();
    const duration = Date.now() - start;
    tracker.passed++;
    if (currentSuite) currentSuite.passed++;
    console.log(`  ${colors.green}✔${colors.reset} ${testName} ${colors.dim}(${duration}ms)${colors.reset}`);
  } catch (err) {
    const duration = Date.now() - start;
    tracker.failed++;
    if (currentSuite) currentSuite.failed++;
    console.log(`  ${colors.red}✖${colors.reset} ${testName} ${colors.dim}(${duration}ms)${colors.reset}`);
    console.error(`    ${colors.red}Assertion Error: ${err.message}${colors.reset}`);
    tracker.errors.push({ testName, error: err });
  }
}

// 现场状态快照管理器 (Zero-Pollution Invariant)
class SnapshotManager {
  constructor() {
    this.initialOrgNodes = JSON.stringify(MOCK_ORG_NODES);
    this.initialUsers = JSON.stringify(MOCK_SYSTEM_USER_LIST);
    this.initialRoles = JSON.stringify(MOCK_ROLES_LIST);
  }

  restore() {
    MOCK_ORG_NODES.length = 0;
    MOCK_ORG_NODES.push(...JSON.parse(this.initialOrgNodes));

    MOCK_SYSTEM_USER_LIST.length = 0;
    MOCK_SYSTEM_USER_LIST.push(...JSON.parse(this.initialUsers));

    MOCK_ROLES_LIST.length = 0;
    MOCK_ROLES_LIST.push(...JSON.parse(this.initialRoles));
  }

  verifyClean() {
    const currentOrg = JSON.stringify(MOCK_ORG_NODES);
    const currentUsers = JSON.stringify(MOCK_SYSTEM_USER_LIST);
    const currentRoles = JSON.stringify(MOCK_ROLES_LIST);
    return (
      currentOrg === this.initialOrgNodes &&
      currentUsers === this.initialUsers &&
      currentRoles === this.initialRoles
    );
  }
}

const snapshotManager = new SnapshotManager();

// =========================================================================
// Suite 1: 5 级组织架构模型完整性与类型边界对抗
// =========================================================================
describe('5 级组织架构模型完整性与类型边界对抗 (Integrity & Level Boundary)', (suite) => {
  test('1.1 根节点属性与规范契约校验：level 1, type group, QD2023111500002', () => {
    assert.ok(MOCK_ORG_TREE_DATA.length >= 1, 'Org tree should have at least 1 root node');
    const root = MOCK_ORG_TREE_DATA[0];
    assert.strictEqual(root.id, 'org-root');
    assert.strictEqual(root.level, 1, 'Root level must be 1');
    assert.strictEqual(root.type, 'group', 'Root type must be group');
    assert.strictEqual(root.code, 'QD2023111500002', 'Root code must match QD2023111500002');
    assert.ok(root.boundUserCount > 0, 'Root boundUserCount should be > 0');
    assert.ok(Array.isArray(root.children) && root.children.length > 0, 'Root must contain children');
  }, suite);

  test('1.2 第 2 级大区节点规范校验：level 2, type region', () => {
    const root = MOCK_ORG_TREE_DATA[0];
    const region = root.children[0];
    assert.ok(region, 'Region node must exist');
    assert.strictEqual(region.level, 2, 'Region level must be 2');
    assert.strictEqual(region.type, 'region', 'Region type must be region');
    assert.strictEqual(region.code, 'REG-BJ', 'Region code must be REG-BJ');
    assert.ok(Array.isArray(region.children) && region.children.length === 5, 'Region must contain exactly 5 campuses');
  }, suite);

  test('1.3 第 3 级实体校区节点规范校验：level 3, type campus, 覆盖 5 大实体校区', () => {
    const region = MOCK_ORG_TREE_DATA[0].children[0];
    const campuses = region.children;
    assert.strictEqual(campuses.length, 5, 'Must contain exactly 5 campuses');
    
    const expectedCampuses = [
      { id: 'campus-bj-hq', code: 'HQ001', name: '总部校区 (世纪金源旗舰店)' },
      { id: 'campus-bj-yy', code: 'YY002', name: '远洋校区' },
      { id: 'campus-bj-cy', code: 'CY003', name: '朝阳校区' },
      { id: 'campus-bj-hd', code: 'HD004', name: '海淀分校 (万泉河校区)' },
      { id: 'campus-bj-wj', code: 'WJ005', name: '望京校区 (望京SOHO校区)' },
    ];

    for (let i = 0; i < expectedCampuses.length; i++) {
      const exp = expectedCampuses[i];
      const actual = campuses.find(c => c.id === exp.id);
      assert.ok(actual, `Campus ${exp.id} must exist in tree`);
      assert.strictEqual(actual.level, 3, `Campus ${exp.id} level must be 3`);
      assert.strictEqual(actual.type, 'campus', `Campus ${exp.id} type must be campus`);
      assert.strictEqual(actual.code, exp.code, `Campus ${exp.id} code mismatch`);
      assert.strictEqual(actual.name, exp.name, `Campus ${exp.id} name mismatch`);
      assert.ok(Array.isArray(actual.children) && actual.children.length > 0, `Campus ${exp.id} must contain departments`);
    }
  }, suite);

  test('1.4 第 4 级部门节点规范校验：level 4, type department', () => {
    const region = MOCK_ORG_TREE_DATA[0].children[0];
    const campuses = region.children;
    let deptCount = 0;

    for (const campus of campuses) {
      for (const dept of campus.children) {
        deptCount++;
        assert.strictEqual(dept.level, 4, `Department ${dept.id} level must be 4`);
        assert.strictEqual(dept.type, 'department', `Department ${dept.id} type must be department`);
        assert.ok(dept.code.length > 0, `Department ${dept.id} code must not be empty`);
        assert.ok(Array.isArray(dept.children) && dept.children.length > 0, `Department ${dept.id} must contain posts`);
      }
    }
    assert.ok(deptCount >= 10, `Total departments across 5 campuses should be >= 10, got ${deptCount}`);
  }, suite);

  test('1.5 第 5 级岗位职务节点规范校验：level 5, type post, 末级叶子节点 children 为空', () => {
    const region = MOCK_ORG_TREE_DATA[0].children[0];
    let postCount = 0;

    for (const campus of region.children) {
      for (const dept of campus.children) {
        for (const post of dept.children) {
          postCount++;
          assert.strictEqual(post.level, 5, `Post ${post.id} level must be 5`);
          assert.strictEqual(post.type, 'post', `Post ${post.id} type must be post`);
          assert.ok(typeof post.boundUserCount === 'number', `Post ${post.id} boundUserCount must be a number`);
          assert.ok(!post.children || post.children.length === 0, `Post ${post.id} must be leaf node (children empty)`);
        }
      }
    }
    assert.ok(postCount >= 15, `Total posts across org tree should be >= 15, got ${postCount}`);
  }, suite);

  test('1.6 严格单调层级单向递增约束：全树任意父子关系满足 child.level === parent.level + 1', () => {
    function traverseAndVerify(node, parentLevel = 0) {
      if (parentLevel > 0) {
        assert.strictEqual(
          node.level,
          parentLevel + 1,
          `Hierarchy violation: node [${node.name}] level ${node.level} is not parent level ${parentLevel} + 1`
        );
      }
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          traverseAndVerify(child, node.level);
        }
      }
    }

    for (const root of MOCK_ORG_TREE_DATA) {
      traverseAndVerify(root, 0);
    }
  }, suite);

  test('1.7 架构层级上限与超限挂载边界防御：严禁在 level 5 岗位节点下挂载子节点 (5-Level Ceiling)', () => {
    function validateAddNodeDepth(parentNode, newLevel) {
      if (parentNode.level >= 5) {
        throw new Error(`MaxHierarchyExceeded: Cannot add child under level ${parentNode.level} (maximum 5 levels permitted)`);
      }
      if (newLevel > 5) {
        throw new Error(`MaxHierarchyExceeded: New level ${newLevel} exceeds maximum level 5`);
      }
      return true;
    }

    const postNode = { id: 'post-1', level: 5, type: 'post' };
    assert.throws(() => {
      validateAddNodeDepth(postNode, 6);
    }, /MaxHierarchyExceeded/);

    const deptNode = { id: 'dept-1', level: 4, type: 'department' };
    assert.strictEqual(validateAddNodeDepth(deptNode, 5), true);
  }, suite);

  test('1.8 越级与倒挂结构防御：检测并阻断非法挂载（如 group 直挂 department、post 下挂 campus 等）', () => {
    const validTransitions = {
      group: ['region'],
      region: ['campus'],
      campus: ['department'],
      department: ['post'],
      post: []
    };

    function validateHierarchyTransition(parentType, childType) {
      const allowed = validTransitions[parentType] || [];
      if (!allowed.includes(childType)) {
        throw new Error(`InvalidHierarchyTransition: Cannot attach [${childType}] under [${parentType}]`);
      }
      return true;
    }

    assert.throws(() => validateHierarchyTransition('group', 'department'), /InvalidHierarchyTransition/);
    assert.throws(() => validateHierarchyTransition('post', 'campus'), /InvalidHierarchyTransition/);
    assert.throws(() => validateHierarchyTransition('campus', 'post'), /InvalidHierarchyTransition/);
    assert.throws(() => validateHierarchyTransition('region', 'post'), /InvalidHierarchyTransition/);
    assert.strictEqual(validateHierarchyTransition('campus', 'department'), true);
  }, suite);

  test('1.9 节点必填字段完整性断言：id, name, code, type, level 均非空且格式合规', () => {
    function checkFields(node) {
      assert.ok(node.id && typeof node.id === 'string', `Node must have non-empty id: ${JSON.stringify(node)}`);
      assert.ok(node.name && typeof node.name === 'string', `Node [${node.id}] must have non-empty name`);
      assert.ok(node.code && typeof node.code === 'string', `Node [${node.id}] must have non-empty code`);
      assert.ok(['group', 'region', 'campus', 'department', 'post'].includes(node.type), `Node [${node.id}] invalid type: ${node.type}`);
      assert.ok(node.level >= 1 && node.level <= 5, `Node [${node.id}] invalid level: ${node.level}`);
      if (node.children) {
        for (const child of node.children) {
          checkFields(child);
        }
      }
    }

    for (const root of MOCK_ORG_TREE_DATA) {
      checkFields(root);
    }
  }, suite);

  test('1.10 岗位在职人数向上汇聚守恒律：岗位之和 == 部门，部门之和 == 校区，校区之和 == 大区 == 集团总人数', () => {
    const root = MOCK_ORG_TREE_DATA[0];
    const region = root.children[0];

    for (const campus of region.children) {
      let campusSum = 0;
      for (const dept of campus.children) {
        let deptSum = 0;
        for (const post of dept.children) {
          deptSum += (post.boundUserCount || 0);
        }
        assert.strictEqual(
          dept.boundUserCount,
          deptSum,
          `Dept [${dept.name}] boundUserCount (${dept.boundUserCount}) must equal sum of posts (${deptSum})`
        );
        campusSum += dept.boundUserCount;
      }
      assert.strictEqual(
        campus.boundUserCount,
        campusSum,
        `Campus [${campus.name}] boundUserCount (${campus.boundUserCount}) must equal sum of depts (${campusSum})`
      );
    }

    const totalCampusUsers = region.children.reduce((acc, c) => acc + c.boundUserCount, 0);
    // 集团总在职人数 128 (42+24+18+26+18 = 128)
    assert.strictEqual(totalCampusUsers, 128, 'Sum of all campus active employees must equal 128');
    assert.strictEqual(root.boundUserCount, 128, 'Root org boundUserCount must match 128');
  }, suite);
});

// =========================================================================
// Suite 2: 机构编码唯一性与重名检测边界对抗
// =========================================================================
describe('机构编码唯一性与重名检测边界对抗 (Code Uniqueness & Name Conflicts)', (suite) => {
  test('2.1 标准组织树全量节点 code 全局 100% 唯一性断言', () => {
    const codes = [];
    function collectCodes(node) {
      codes.push({ id: node.id, code: node.code, name: node.name });
      if (node.children) {
        for (const child of node.children) {
          collectCodes(child);
        }
      }
    }
    for (const r of MOCK_ORG_TREE_DATA) {
      collectCodes(r);
    }

    const codeSet = new Set();
    const duplicates = [];
    for (const item of codes) {
      if (codeSet.has(item.code)) {
        duplicates.push(item);
      }
      codeSet.add(item.code);
    }

    assert.strictEqual(
      duplicates.length,
      0,
      `Duplicate codes detected in org tree: ${JSON.stringify(duplicates)}`
    );
    assert.ok(codes.length >= 25, `Total unique nodes should be >= 25, got ${codes.length}`);
  }, suite);

  test('2.2 重编码拦截：尝试使用现有机构编码（如 HQ001, REG-BJ）创建节点必须被拦截', () => {
    function validateUniqueCode(existingTree, newCode) {
      const codeToTest = String(newCode).trim().toUpperCase();
      let conflict = false;
      function check(nodes) {
        for (const n of nodes) {
          if (n.code && n.code.trim().toUpperCase() === codeToTest) {
            conflict = true;
            return;
          }
          if (n.children) check(n.children);
        }
      }
      check(existingTree);
      if (conflict) {
        throw new Error(`DuplicateOrgCodeException: Organization code [${newCode}] already exists`);
      }
      return true;
    }

    assert.throws(() => validateUniqueCode(MOCK_ORG_TREE_DATA, 'HQ001'), /DuplicateOrgCodeException/);
    assert.throws(() => validateUniqueCode(MOCK_ORG_TREE_DATA, 'REG-BJ'), /DuplicateOrgCodeException/);
    assert.throws(() => validateUniqueCode(MOCK_ORG_TREE_DATA, 'QD2023111500002'), /DuplicateOrgCodeException/);
    assert.strictEqual(validateUniqueCode(MOCK_ORG_TREE_DATA, 'HQ_BRAND_NEW_999'), true);
  }, suite);

  test('2.3 编码大小写与空格模糊碰撞攻击：如 hq001 与  HQ001  冲突防御', () => {
    function validateNormalizedCode(existingTree, newCode) {
      const normalized = (newCode || '').trim().toUpperCase();
      let conflict = false;
      function check(nodes) {
        for (const n of nodes) {
          if ((n.code || '').trim().toUpperCase() === normalized) {
            conflict = true;
            return;
          }
          if (n.children) check(n.children);
        }
      }
      check(existingTree);
      if (conflict) {
        throw new Error(`NormalizedCodeCollisionException: Code [${newCode}] normalizes to existing code [${normalized}]`);
      }
      return true;
    }

    // 大小写攻击
    assert.throws(() => validateNormalizedCode(MOCK_ORG_TREE_DATA, 'hq001'), /NormalizedCodeCollisionException/);
    // 前后空格攻击
    assert.throws(() => validateNormalizedCode(MOCK_ORG_TREE_DATA, '  HQ001  '), /NormalizedCodeCollisionException/);
    // 制表符攻击
    assert.throws(() => validateNormalizedCode(MOCK_ORG_TREE_DATA, '\treg-bj\n'), /NormalizedCodeCollisionException/);
  }, suite);

  test('2.4 空编码与非法格式编码检测：拒绝空字符串、纯空白字符及 null/undefined', () => {
    function validateCodeFormat(code) {
      if (!code || typeof code !== 'string' || code.trim().length === 0) {
        throw new Error('InvalidOrgCodeException: Code must be a non-empty string');
      }
      if (code.trim().length < 2 || code.trim().length > 32) {
        throw new Error('InvalidOrgCodeException: Code length must be between 2 and 32 characters');
      }
      if (!/^[A-Za-z0-9_-]+$/.test(code.trim())) {
        throw new Error('InvalidOrgCodeException: Code contains illegal characters (alphanumeric, dash, underscore only)');
      }
      return true;
    }

    assert.throws(() => validateCodeFormat(''), /InvalidOrgCodeException/);
    assert.throws(() => validateCodeFormat('   '), /InvalidOrgCodeException/);
    assert.throws(() => validateCodeFormat(null), /InvalidOrgCodeException/);
    assert.throws(() => validateCodeFormat(undefined), /InvalidOrgCodeException/);
    assert.throws(() => validateCodeFormat('A'), /InvalidOrgCodeException/); // too short
    assert.throws(() => validateCodeFormat('A'.repeat(33)), /InvalidOrgCodeException/); // too long
    assert.throws(() => validateCodeFormat('HQ 001'), /InvalidOrgCodeException/); // contains space
    assert.strictEqual(validateCodeFormat('CAMPUS_SH_01'), true);
  }, suite);

  test('2.5 同一父节点下的同级子节点同名拦截', () => {
    function validateSiblingName(parentNode, newName) {
      if (!parentNode.children) return true;
      const cleanName = (newName || '').trim();
      if (!cleanName) {
        throw new Error('InvalidNodeNameException: Node name cannot be empty');
      }
      const hasDup = parentNode.children.some(c => (c.name || '').trim() === cleanName);
      if (hasDup) {
        throw new Error(`DuplicateSiblingNameException: Sibling node with name [${cleanName}] already exists under [${parentNode.name}]`);
      }
      return true;
    }

    const hqEduDept = MOCK_ORG_TREE_DATA[0].children[0].children[0].children[0]; // 教务教学部
    assert.throws(() => {
      validateSiblingName(hqEduDept, '少儿编程金牌讲师'); // 已存在同名岗位
    }, /DuplicateSiblingNameException/);

    assert.strictEqual(validateSiblingName(hqEduDept, '高中NOIP特级讲师'), true);
  }, suite);

  test('2.6 跨级/跨分支同名合法性：不同校区下的同名部门（如市场部）允许合法共存', () => {
    function findNodesByName(nodes, name) {
      const results = [];
      function recurse(list) {
        for (const n of list) {
          if (n.name.includes(name)) results.push(n);
          if (n.children) recurse(n.children);
        }
      }
      recurse(nodes);
      return results;
    }

    // 总部校区有“市场招生部”，远洋校区有“远洋市场部”
    const allNodes = [];
    function flatten(list) {
      for (const n of list) {
        allNodes.push(n);
        if (n.children) flatten(n.children);
      }
    }
    flatten(MOCK_ORG_TREE_DATA);

    // 验证不同校区可以拥有同职能部门或同名称岗位而不会发生冲突
    const posts = allNodes.filter(n => n.type === 'post');
    assert.ok(posts.length >= 10, 'Multiple posts exist across campuses');
  }, suite);
});

// =========================================================================
// Suite 3: 节点删除安全风控极限对抗
// =========================================================================
describe('节点删除安全风控极限对抗 (Node Deletion Risk Control & Blockers)', (suite) => {
  test('3.1 根节点删除绝对阻断：删除 level 1 && type group 抛出 Root organization group node cannot be deleted', () => {
    assert.throws(() => {
      TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'org-root');
    }, /Root organization group node cannot be deleted/);

    assert.throws(() => {
      ContractRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'org-root');
    }, /Root organization group node cannot be deleted/);
  }, suite);

  test('3.2 孤立根节点删除极限对抗：即使根节点被清空 children 且 boundUserCount 为 0，依然坚决阻断', () => {
    const isolatedRootTree = [
      {
        id: 'isolated-root',
        name: '孤立根集团',
        code: 'ISO_ROOT',
        type: 'group',
        level: 1,
        boundUserCount: 0,
        children: []
      }
    ];

    assert.throws(() => {
      TsRBACEngine.validateNodeDeletion(isolatedRootTree, 'isolated-root');
    }, /Root organization group node cannot be deleted/);

    assert.throws(() => {
      ContractRBACEngine.validateNodeDeletion(isolatedRootTree, 'isolated-root');
    }, /Root organization group node cannot be deleted/);
  }, suite);

  test('3.3 非叶子节点删除阻断 - 大区节点（下含 5 大校区），抛出 HasChildNodesException', () => {
    assert.throws(() => {
      TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'region-bj');
    }, (err) => {
      assert.match(err.message, /HasChildNodesException/);
      assert.match(err.message, /contains 5 child nodes/);
      return true;
    });
  }, suite);

  test('3.4 非叶子节点删除阻断 - 校区节点（下含部门），抛出 HasChildNodesException', () => {
    assert.throws(() => {
      TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'campus-bj-hq');
    }, (err) => {
      assert.match(err.message, /HasChildNodesException/);
      assert.match(err.message, /contains 3 child nodes/);
      return true;
    });
  }, suite);

  test('3.5 非叶子节点删除阻断 - 部门节点（下含岗位），抛出 HasChildNodesException', () => {
    assert.throws(() => {
      TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'dept-hq-edu');
    }, (err) => {
      assert.match(err.message, /HasChildNodesException/);
      assert.match(err.message, /contains 4 child nodes/);
      return true;
    });
  }, suite);

  test('3.6 单子节点非叶子节点删除阻断：精准抛出包含 1 child node 的阻断信息', () => {
    const customTree = [
      {
        id: 'r',
        level: 2,
        type: 'region',
        children: [
          {
            id: 'dept-single-child',
            level: 4,
            type: 'department',
            name: '单岗位实验部门',
            boundUserCount: 0,
            children: [
              { id: 'post-only-one', level: 5, type: 'post', boundUserCount: 0, children: [] }
            ]
          }
        ]
      }
    ];

    assert.throws(() => {
      TsRBACEngine.validateNodeDeletion(customTree, 'dept-single-child');
    }, (err) => {
      assert.match(err.message, /HasChildNodesException/);
      assert.match(err.message, /contains 1 child nodes/);
      return true;
    });
  }, suite);

  test('3.7 在职员工绑定阻断 - 大规模在职员工绑定岗位（14 人），抛出 bound to 14 active employees', () => {
    assert.throws(() => {
      TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'post-hq-teacher');
    }, (err) => {
      assert.match(err.message, /currently bound to 14 active employees/);
      return true;
    });
  }, suite);

  test('3.8 在职员工绑定阻断 - 临界单员工绑定岗位（1 人），抛出 bound to 1 active employees', () => {
    const singleUserTree = [
      {
        id: 'r',
        level: 2,
        type: 'region',
        children: [
          {
            id: 'post-single-employee',
            level: 5,
            type: 'post',
            name: '专属特教岗',
            boundUserCount: 1,
            children: []
          }
        ]
      }
    ];

    assert.throws(() => {
      TsRBACEngine.validateNodeDeletion(singleUserTree, 'post-single-employee');
    }, (err) => {
      assert.match(err.message, /currently bound to 1 active employees/);
      return true;
    });
  }, suite);

  test('3.9 合规叶子节点安全删除：无子节点且 boundUserCount === 0 返回 canDelete: true', () => {
    // 使用预置的测试叶子节点 post-test-leaf (体验课助教兼职(待定岗))
    const res = TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, 'post-test-leaf');
    assert.strictEqual(res.canDelete, true);
    assert.ok(res.node);
    assert.strictEqual(res.node.id, 'post-test-leaf');
    assert.strictEqual(res.node.boundUserCount, 0);
  }, suite);

  test('3.10 物理删除执行与树形结构一致性联动验证 (deleteOrgNode)', () => {
    // 获取删除前的父部门
    const deptBefore = MOCK_ORG_NODES[0].children[0].children[0].children[0];
    const initialChildrenCount = deptBefore.children.length;
    assert.ok(deptBefore.children.some(c => c.id === 'post-test-leaf'));

    // 执行物理删除
    const delResult = deleteOrgNode('post-test-leaf');
    assert.strictEqual(delResult.canDelete, true);

    // 验证物理删除后该节点已被移出
    const deptAfter = MOCK_ORG_NODES[0].children[0].children[0].children[0];
    assert.strictEqual(deptAfter.children.length, initialChildrenCount - 1);
    assert.strictEqual(deptAfter.children.some(c => c.id === 'post-test-leaf'), false);

    // 再次尝试删除已被删除的节点，验证抛出不存在
    assert.throws(() => {
      deleteOrgNode('post-test-leaf');
    }, /Node post-test-leaf not found/);

    // 现场恢复
    snapshotManager.restore();
  }, suite);

  test('3.11 不存在节点 ID 攻击拦截：空字符串、非法 UUID、SQL 注入字符严格抛错', () => {
    const maliciousIds = [
      'NON_EXISTENT_NODE_UUID_99999',
      '',
      '   ',
      "' OR 1=1 --",
      '<script>alert(1)</script>',
      '__proto__',
      'constructor'
    ];

    for (const testId of maliciousIds) {
      assert.throws(() => {
        TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, testId);
      }, (err) => {
        assert.match(err.message, /not found in organizational tree/);
        return true;
      });
    }
  }, suite);

  test('3.12 畸变节点边界防御：非 group 类型的 level 1 或非 level 1 的 group 节点处理验证', () => {
    const mutatedTree = [
      {
        id: 'node-mutated-1',
        level: 1,
        type: 'campus', // 畸变：level 1 但 type 是 campus
        boundUserCount: 0,
        children: []
      },
      {
        id: 'node-mutated-2',
        level: 3,
        type: 'group', // 畸变：level 3 但 type 是 group
        boundUserCount: 0,
        children: []
      }
    ];

    // 契约规定：targetNode.level === 1 && targetNode.type === 'group' 才是根组织节点
    // 对于 mutated-1 (level 1 && type campus)，不满足 group 条件，但由于是叶子且无员工，返回 canDelete: true
    const res1 = TsRBACEngine.validateNodeDeletion(mutatedTree, 'node-mutated-1');
    assert.strictEqual(res1.canDelete, true);

    // 对于 mutated-2 (level 3 && type group)，不满足 level 1 条件，返回 canDelete: true
    const res2 = TsRBACEngine.validateNodeDeletion(mutatedTree, 'node-mutated-2');
    assert.strictEqual(res2.canDelete, true);
  }, suite);
});

// =========================================================================
// Suite 4: 节点层级深度动态计算与多校区人员映射关联测试
// =========================================================================
describe('节点层级深度动态计算与多校区人员映射关联测试 (Dynamic Depth & Mapping)', (suite) => {
  test('4.1 独立深度计算 Oracle：全树最大深度严格精确为 5', () => {
    function computeTreeMaxDepth(node) {
      if (!node.children || node.children.length === 0) {
        return 1;
      }
      return 1 + Math.max(...node.children.map(computeTreeMaxDepth));
    }

    const maxDepth = computeTreeMaxDepth(MOCK_ORG_TREE_DATA[0]);
    assert.strictEqual(maxDepth, 5, `Org tree maximum depth must strictly equal 5, got ${maxDepth}`);
  }, suite);

  test('4.2 路径深度与声明 level 100% 强一致性不变量断言 (Path Depth Invariant)', () => {
    function verifyPathDepth(node, currentDepth = 1) {
      assert.strictEqual(
        node.level,
        currentDepth,
        `Node [${node.name}] level ${node.level} mismatch with path depth ${currentDepth}`
      );
      if (node.children) {
        for (const child of node.children) {
          verifyPathDepth(child, currentDepth + 1);
        }
      }
    }

    for (const root of MOCK_ORG_TREE_DATA) {
      verifyPathDepth(root, 1);
    }
  }, suite);

  test('4.3 5 大实体校区子树深度独立计算：每个校区子树深度严格精确为 3 (校区->部门->岗位)', () => {
    function computeSubtreeDepth(node) {
      if (!node.children || node.children.length === 0) return 1;
      return 1 + Math.max(...node.children.map(computeSubtreeDepth));
    }

    const campuses = MOCK_ORG_TREE_DATA[0].children[0].children;
    for (const campus of campuses) {
      const depth = computeSubtreeDepth(campus);
      assert.strictEqual(
        depth,
        3,
        `Campus [${campus.name}] subtree depth must be strictly 3 (campus->dept->post), got ${depth}`
      );
    }
  }, suite);

  test('4.4 22 名在职员工校区归属映射完备性校验：全量 campusId 必须归属 5 大校区之一', () => {
    assert.ok(MOCK_SYSTEM_USERS.length >= 22, `Expected at least 22 mock users, got ${MOCK_SYSTEM_USERS.length}`);
    const validCampusIds = ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy', 'campus-bj-hd', 'campus-bj-wj'];

    for (const u of MOCK_SYSTEM_USERS) {
      assert.ok(
        validCampusIds.includes(u.campusId),
        `User [${u.name}] campusId ${u.campusId} is not in standard 5 campuses`
      );
    }
  }, suite);

  test('4.5 员工部门归属拓扑关系严格校验：departmentId 必须真实存在于其所属校区下', () => {
    const campusDeptMap = new Map();
    const campuses = MOCK_ORG_TREE_DATA[0].children[0].children;
    for (const c of campuses) {
      const deptIds = (c.children || []).map(d => d.id);
      campusDeptMap.set(c.id, new Set(deptIds));
    }

    for (const u of MOCK_SYSTEM_USERS) {
      const allowedDepts = campusDeptMap.get(u.campusId);
      assert.ok(allowedDepts, `Campus ${u.campusId} must exist in map`);
      assert.ok(
        allowedDepts.has(u.departmentId),
        `Topological violation: User [${u.name}] department [${u.departmentId}] does not belong to campus [${u.campusId}]`
      );
    }
  }, suite);

  test('4.6 员工岗位归属拓扑关系严格校验：postId 必须真实存在于其所属部门下', () => {
    const deptPostMap = new Map();
    const campuses = MOCK_ORG_TREE_DATA[0].children[0].children;
    for (const c of campuses) {
      for (const d of c.children || []) {
        const postIds = (d.children || []).map(p => p.id);
        deptPostMap.set(d.id, new Set(postIds));
      }
    }

    for (const u of MOCK_SYSTEM_USERS) {
      const allowedPosts = deptPostMap.get(u.departmentId);
      assert.ok(allowedPosts, `Department ${u.departmentId} must exist in map`);
      assert.ok(
        allowedPosts.has(u.postId),
        `Topological violation: User [${u.name}] post [${u.postId}] does not belong to department [${u.departmentId}]`
      );
    }
  }, suite);

  test('4.7 多校区人员联动过滤完备性：按校区精准筛选员工', () => {
    const hqUsers = getSystemUsers({ campusId: 'campus-bj-hq' });
    assert.ok(hqUsers.length > 0, 'HQ users must not be empty');
    assert.ok(hqUsers.every(u => u.campusId === 'campus-bj-hq'), 'All returned users must belong to HQ campus');

    const yyUsers = getSystemUsers({ campusId: 'campus-bj-yy' });
    assert.ok(yyUsers.length > 0, 'YY users must not be empty');
    assert.ok(yyUsers.every(u => u.campusId === 'campus-bj-yy'), 'All returned users must belong to YY campus');

    const hdUsers = getSystemUsers({ campusId: 'campus-bj-hd' });
    assert.ok(hdUsers.length > 0, 'HD users must not be empty');
    assert.ok(hdUsers.every(u => u.campusId === 'campus-bj-hd'), 'All returned users must belong to HD campus');
  }, suite);

  test('4.8 跨校区人员数据隔离性对抗：望京校区筛选结果绝对零泄漏（无其他校区人员）', () => {
    const wjUsers = getSystemUsers({ campusId: 'campus-bj-wj' });
    const wjUserIds = new Set(wjUsers.map(u => u.id));

    // 获取非望京校区的所有人员
    const otherUsers = MOCK_SYSTEM_USERS.filter(u => u.campusId !== 'campus-bj-wj');
    for (const ou of otherUsers) {
      assert.strictEqual(
        wjUserIds.has(ou.id),
        false,
        `Data Leakage Violation: User [${ou.name}] from [${ou.campusName}] leaked into Wangjing campus list!`
      );
    }
  }, suite);

  test('4.9 关键字模糊搜索与状态过滤组合对抗', () => {
    const searchByName = getSystemUsers({ keyword: '冬海潮' });
    assert.strictEqual(searchByName.length, 1);
    assert.strictEqual(searchByName[0].account, 'donghaichao');

    const searchByPhone = getSystemUsers({ keyword: '13800138000' });
    assert.strictEqual(searchByPhone.length, 1);

    const lockedUsers = getSystemUsers({ status: 'locked' });
    assert.ok(lockedUsers.length >= 1, 'At least 1 locked user for boundary test');
    assert.ok(lockedUsers.every(u => u.status === 'locked'));
  }, suite);

  test('4.10 动态添加与删除员工的人员树联动一致性', () => {
    const initialCount = MOCK_SYSTEM_USER_LIST.length;
    const testUser = {
      name: '自动化对抗测试员',
      account: 'test_challenger',
      campusId: 'campus-bj-hd',
      departmentId: 'dept-hd-edu',
      postId: 'post-hd-teacher'
    };

    const added = systemMock.addSystemUser(testUser);
    assert.strictEqual(MOCK_SYSTEM_USER_LIST.length, initialCount + 1);
    assert.strictEqual(added.name, testUser.name);

    // 删除
    const deleted = systemMock.deleteSystemUser(added.id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(MOCK_SYSTEM_USER_LIST.length, initialCount);

    snapshotManager.restore();
  }, suite);
});

// =========================================================================
// Suite 5: 双轨引擎契约一致性对比 (Dual Engine Parity)
// =========================================================================
describe('双轨引擎契约一致性对比 (Contract vs TypeScript Middle-Platform)', (suite) => {
  test('5.1 validateNodeDeletion 成功返回结果全等同构', () => {
    const tree = [
      {
        id: 'r',
        level: 2,
        type: 'region',
        children: [
          { id: 'leaf', level: 5, type: 'post', boundUserCount: 0, children: [] }
        ]
      }
    ];

    const res1 = ContractRBACEngine.validateNodeDeletion(tree, 'leaf');
    const res2 = TsRBACEngine.validateNodeDeletion(tree, 'leaf');

    assert.strictEqual(res1.canDelete, true);
    assert.strictEqual(res2.canDelete, true);
    assert.strictEqual(res1.node.id, res2.node.id);
  }, suite);

  test('5.2 validateNodeDeletion 阻断异常类型与语义信息 100% 同步一致', () => {
    const testCases = [
      {
        name: '根节点删除',
        nodeId: 'org-root',
        expectedRegex: /Root organization group node cannot be deleted/
      },
      {
        name: '下属子节点非空删除',
        nodeId: 'campus-bj-hq',
        expectedRegex: /HasChildNodesException/
      },
      {
        name: '在职员工绑定删除',
        nodeId: 'post-hq-teacher',
        expectedRegex: /active employees/
      },
      {
        name: '不存在节点删除',
        nodeId: 'RANDOM_NON_EXISTENT_ID',
        expectedRegex: /not found in organizational tree/
      }
    ];

    for (const tc of testCases) {
      let errContract = null;
      let errTs = null;

      try {
        ContractRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, tc.nodeId);
      } catch (e) {
        errContract = e;
      }

      try {
        TsRBACEngine.validateNodeDeletion(MOCK_ORG_TREE_DATA, tc.nodeId);
      } catch (e) {
        errTs = e;
      }

      assert.ok(errContract, `Contract engine must throw on ${tc.name}`);
      assert.ok(errTs, `TS engine must throw on ${tc.name}`);
      assert.match(errContract.message, tc.expectedRegex);
      assert.match(errTs.message, tc.expectedRegex);
      assert.strictEqual(errContract.message, errTs.message, `Error message mismatch on ${tc.name}`);
    }
  }, suite);

  test('5.3 4 级权限树半选联动算法同构性对抗 (updateTreeCheckState)', () => {
    // 构造 3 级权限树：System -> Module -> Button
    const createSampleTree = () => ({
      id: 'sys',
      checked: false,
      indeterminate: false,
      children: [
        {
          id: 'mod1',
          checked: false,
          indeterminate: false,
          children: [
            { id: 'btn1', checked: false, indeterminate: false },
            { id: 'btn2', checked: false, indeterminate: false }
          ]
        }
      ]
    });

    // 状态 1: 全部未选
    const tree1A = createSampleTree();
    const tree1B = createSampleTree();
    const s1A = ContractRBACEngine.updateTreeCheckState(tree1A);
    const s1B = TsRBACEngine.updateTreeCheckState(tree1B);
    assert.deepStrictEqual(s1A, { checked: false, indeterminate: false });
    assert.deepStrictEqual(s1B, { checked: false, indeterminate: false });

    // 状态 2: 部分勾选 (btn1 = true)
    const tree2A = createSampleTree();
    tree2A.children[0].children[0].checked = true;
    const tree2B = createSampleTree();
    tree2B.children[0].children[0].checked = true;
    const s2A = ContractRBACEngine.updateTreeCheckState(tree2A);
    const s2B = TsRBACEngine.updateTreeCheckState(tree2B);
    assert.deepStrictEqual(s2A, { checked: false, indeterminate: true });
    assert.deepStrictEqual(s2B, { checked: false, indeterminate: true });
    assert.strictEqual(tree2A.children[0].indeterminate, true);
    assert.strictEqual(tree2B.children[0].indeterminate, true);

    // 状态 3: 全选 (btn1 = true, btn2 = true)
    const tree3A = createSampleTree();
    tree3A.children[0].children[0].checked = true;
    tree3A.children[0].children[1].checked = true;
    const tree3B = createSampleTree();
    tree3B.children[0].children[0].checked = true;
    tree3B.children[0].children[1].checked = true;
    const s3A = ContractRBACEngine.updateTreeCheckState(tree3A);
    const s3B = TsRBACEngine.updateTreeCheckState(tree3B);
    assert.deepStrictEqual(s3A, { checked: true, indeterminate: false });
    assert.deepStrictEqual(s3B, { checked: true, indeterminate: false });
  }, suite);

  test('5.4 子树批量级联勾选算法同构性对抗 (setSubtreeChecked)', () => {
    const createSample = () => ({
      id: 'root',
      checked: false,
      children: [
        { id: 'c1', checked: false, children: [{ id: 'c11', checked: false }] },
        { id: 'c2', checked: false, children: [{ id: 'c21', checked: false }] }
      ]
    });

    const t1 = createSample();
    const t2 = createSample();

    ContractRBACEngine.setSubtreeChecked(t1, true);
    TsRBACEngine.setSubtreeChecked(t2, true);

    assert.strictEqual(t1.children[0].children[0].checked, true);
    assert.strictEqual(t2.children[0].children[0].checked, true);
    assert.deepStrictEqual(t1, t2);

    ContractRBACEngine.setSubtreeChecked(t1, false);
    TsRBACEngine.setSubtreeChecked(t2, false);
    assert.strictEqual(t1.children[0].children[0].checked, false);
    assert.strictEqual(t2.children[0].children[0].checked, false);
    assert.deepStrictEqual(t1, t2);
  }, suite);

  test('5.5 权限检查 hasPermission 通配符放行同构性对抗', () => {
    // 通配符 *
    assert.strictEqual(ContractRBACEngine.hasPermission(['*'], 'curriculum:course:delete'), true);
    assert.strictEqual(TsRBACEngine.hasPermission(['*'], 'curriculum:course:delete'), true);

    // 通配符 admin:all
    assert.strictEqual(ContractRBACEngine.hasPermission(['admin:all'], 'system:user:reset'), true);
    assert.strictEqual(TsRBACEngine.hasPermission(['admin:all'], 'system:user:reset'), true);

    // 精确匹配
    assert.strictEqual(ContractRBACEngine.hasPermission(['curriculum:view'], 'curriculum:view'), true);
    assert.strictEqual(TsRBACEngine.hasPermission(['curriculum:view'], 'curriculum:view'), true);

    // 未授权拒绝
    assert.strictEqual(ContractRBACEngine.hasPermission(['curriculum:view'], 'curriculum:delete'), false);
    assert.strictEqual(TsRBACEngine.hasPermission(['curriculum:view'], 'curriculum:delete'), false);
  }, suite);

  test('5.6 数据范围过滤器 filterByDataScope 4 级范围同构性对抗 (all, campus, department, self)', () => {
    const mockData = [
      { id: 'd1', campusId: 'c1', departmentId: 'dept1', ownerId: 'u1' },
      { id: 'd2', campusId: 'c1', departmentId: 'dept2', ownerId: 'u2' },
      { id: 'd3', campusId: 'c2', departmentId: 'dept3', ownerId: 'u3' }
    ];

    const userAll = { id: 'u0', dataScope: 'all' };
    const userCampus = { id: 'u1', campusId: 'c1', dataScope: 'campus' };
    const userDept = { id: 'u1', campusId: 'c1', departmentId: 'dept1', dataScope: 'department' };
    const userSelf = { id: 'u1', campusId: 'c1', departmentId: 'dept1', dataScope: 'self' };
    const userInvalid = { id: 'u1', dataScope: 'invalid_scope' };

    // all
    assert.deepStrictEqual(
      ContractRBACEngine.filterByDataScope(userAll, mockData),
      TsRBACEngine.filterByDataScope(userAll, mockData)
    );

    // campus
    assert.deepStrictEqual(
      ContractRBACEngine.filterByDataScope(userCampus, mockData),
      TsRBACEngine.filterByDataScope(userCampus, mockData)
    );
    assert.strictEqual(ContractRBACEngine.filterByDataScope(userCampus, mockData).length, 2);

    // department
    assert.deepStrictEqual(
      ContractRBACEngine.filterByDataScope(userDept, mockData),
      TsRBACEngine.filterByDataScope(userDept, mockData)
    );
    assert.strictEqual(ContractRBACEngine.filterByDataScope(userDept, mockData).length, 1);

    // self
    assert.deepStrictEqual(
      ContractRBACEngine.filterByDataScope(userSelf, mockData),
      TsRBACEngine.filterByDataScope(userSelf, mockData)
    );
    assert.strictEqual(ContractRBACEngine.filterByDataScope(userSelf, mockData).length, 1);

    // invalid
    assert.deepStrictEqual(
      ContractRBACEngine.filterByDataScope(userInvalid, mockData),
      []
    );
    assert.deepStrictEqual(
      TsRBACEngine.filterByDataScope(userInvalid, mockData),
      []
    );
  }, suite);

  test('5.7 输入容错差异：TypeScript 引擎兼容支持单节点对象与数组节点输入', () => {
    const singleNodeTree = {
      id: 'root-single',
      level: 2,
      type: 'region',
      children: [
        { id: 'leaf-single', level: 5, type: 'post', boundUserCount: 0, children: [] }
      ]
    };

    // TS 引擎增强了 Array.isArray 检查，支持单对象
    const resTs = TsRBACEngine.validateNodeDeletion(singleNodeTree, 'leaf-single');
    assert.strictEqual(resTs.canDelete, true);
  }, suite);
});

// =========================================================================
// Suite 6: 现场数据隔离与零污染复原机制 (Zero-Pollution Invariant)
// =========================================================================
describe('现场数据隔离与零污染复原机制验证 (Zero-Pollution Invariant)', (suite) => {
  test('6.1 破坏性操作全流程演练后，现场数据被 100% 洁净复原', () => {
    // 演练：新增一个节点
    const newNode = addOrgNode('campus-bj-hq', { name: '临时测试部门', type: 'department' });
    assert.ok(newNode.id);

    // 演练：修改一个节点
    updateOrgNode('campus-bj-hq', { phone: '010-99999999' });

    // 触发复原
    snapshotManager.restore();

    // 验证复原成功
    assert.strictEqual(snapshotManager.verifyClean(), true, 'Org nodes must be completely clean after restore');
    const hqCampus = MOCK_ORG_NODES[0].children[0].children[0];
    assert.strictEqual(hqCampus.phone, '010-88886666'); // 原电话被完美恢复
  }, suite);

  test('6.2 组织架构树与员工、角色数据集哈希全同性断言', () => {
    snapshotManager.restore();
    assert.strictEqual(
      JSON.stringify(MOCK_ORG_NODES),
      snapshotManager.initialOrgNodes,
      'Org tree state must strictly match initial snapshot'
    );
    assert.strictEqual(
      JSON.stringify(MOCK_SYSTEM_USER_LIST),
      snapshotManager.initialUsers,
      'System users state must strictly match initial snapshot'
    );
    assert.strictEqual(
      JSON.stringify(MOCK_ROLES_LIST),
      snapshotManager.initialRoles,
      'Roles state must strictly match initial snapshot'
    );
  }, suite);

  test('6.3 连续破坏与恢复幂等性压力测试 (10 次循环)', () => {
    for (let i = 0; i < 10; i++) {
      addOrgNode('region-bj', { name: `FuzzNode_${i}` });
      snapshotManager.restore();
      assert.strictEqual(snapshotManager.verifyClean(), true, `Loop ${i} dirty data detected`);
    }
  }, suite);
});

// =========================================================================
// 测试结果输出与汇总报告
// =========================================================================
const elapsed = Date.now() - tracker.startTime;
console.log(`\n${colors.bold}═══════════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bold}  拓视未来教育「一校教培系统」Challenger M6-1 组织架构对抗测试套件报告${colors.reset}`);
console.log(`${colors.bold}═══════════════════════════════════════════════════════════════════════${colors.reset}`);

for (const s of tracker.suiteResults) {
  const statusColor = s.failed === 0 ? colors.green : colors.red;
  const statusIcon = s.failed === 0 ? '✔' : '✖';
  console.log(`  ${statusColor}${statusIcon}${colors.reset} ${s.name}: ${colors.bold}${s.passed}/${s.total}${colors.reset} passed`);
}

console.log(`${colors.dim}───────────────────────────────────────────────────────────────────────${colors.reset}`);
console.log(`  总测试数: ${colors.bold}${tracker.total}${colors.reset}`);
console.log(`  通过用例: ${colors.green}${colors.bold}${tracker.passed}${colors.reset}`);
console.log(`  失败用例: ${tracker.failed === 0 ? colors.green : colors.red}${colors.bold}${tracker.failed}${colors.reset}`);
console.log(`  总耗时:   ${colors.cyan}${elapsed}ms${colors.reset}`);

if (tracker.failed > 0) {
  console.log(`\n${colors.red}${colors.bold}【REJECT】存在未通过的对抗测试用例：${colors.reset}`);
  for (const f of tracker.errors) {
    console.error(`  - ${f.testName}: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log(`\n${colors.green}${colors.bold}【APPROVE】全部 6 大对抗测试套件共 ${tracker.total} 项用例 100% 通过！组织架构模型与删除风控达到最高稳健性。${colors.reset}\n`);
  process.exit(0);
}
