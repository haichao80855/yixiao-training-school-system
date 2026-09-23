/**
 * Forensic Audit M6-1: Black-box Random Blind Test Suite
 * 独立盲测套件：50 组随机组织架构树、50 组随机权限树、50 组随机数据范围过滤
 */

const assert = require('assert');
const fs = require('fs');
const esbuild = require('esbuild');

// 1. 加载测试契约引擎
const ContractRBACEngine = require('./contracts/rbacEngine');

// 2. 直接从源码 src/mocks/system.ts 转译并加载生产环境 RBACEngine
const systemMockCode = fs.readFileSync('src/mocks/system.ts', 'utf8');
const transformed = esbuild.transformSync(systemMockCode, { loader: 'ts', format: 'cjs' });
const mockModule = { exports: {} };
const loaderFn = new Function('module', 'exports', 'require', transformed.code);
loaderFn(mockModule, mockModule.exports, (id) => {
  if (id === '@/types/system') return {};
  return require(id);
});
const SourceRBACEngine = mockModule.exports.RBACEngine;

console.log('================================================================================');
console.log('盛通教育「一校教培系统」Milestone 6 RBAC 法证随机盲测 (Random Blind Test)');
console.log('================================================================================');

// 伪随机数发生器 (带确定性种子以保证审计可复现，且具备充分随机分布)
let seed = 20260922;
function rng() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function randChoice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

let totalTests = 0;
let passedTests = 0;

function runCheck(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${desc}: ${err.message}`);
    throw err;
  }
}

// ================================================================================
// Part 1: 50 组随机组织架构树深度盲测 (RBACEngine.validateNodeDeletion)
// ================================================================================
console.log('\n[Phase 1] 执行 50 组随机组织架构树结构与删除拦截盲测...');

const nodeTypes = ['group', 'region', 'campus', 'department', 'post'];

function generateRandomOrgTree(treeId) {
  let nodeIdCounter = 1;

  function buildNode(level, maxDepth) {
    const id = `node_${treeId}_${nodeIdCounter++}`;
    const type = level === 1 ? 'group' : nodeTypes[Math.min(level - 1, nodeTypes.length - 1)];
    const name = `节点_${type}_${id}`;
    const boundUserCount = randInt(0, 5); // 0 表示无员工绑定，>0 表示有员工

    const node = {
      id,
      name,
      code: `CODE_${id}`,
      type,
      level,
      boundUserCount,
      children: []
    };

    if (level < maxDepth && randInt(1, 10) > 3) {
      const childCount = randInt(1, 3);
      for (let i = 0; i < childCount; i++) {
        node.children.push(buildNode(level + 1, maxDepth));
      }
    }

    return node;
  }

  const maxDepth = randInt(2, 5);
  return [buildNode(1, maxDepth)];
}

// 独立参考 Oracle (Ground Truth)
function oracleValidateDeletion(tree, targetId) {
  let target = null;
  function find(nodes) {
    for (const n of nodes) {
      if (n.id === targetId) {
        target = n;
        return;
      }
      if (n.children && n.children.length > 0) {
        find(n.children);
      }
    }
  }
  find(tree);

  if (!target) {
    return { shouldThrow: true, errorType: 'NotFound' };
  }
  if (target.level === 1 && target.type === 'group') {
    return { shouldThrow: true, errorType: 'RootGroup' };
  }
  if (target.children && target.children.length > 0) {
    return { shouldThrow: true, errorType: 'HasChildren' };
  }
  if (target.boundUserCount && target.boundUserCount > 0) {
    return { shouldThrow: true, errorType: 'BoundEmployees' };
  }
  return { shouldThrow: false, canDelete: true, node: target };
}

for (let i = 1; i <= 50; i++) {
  const tree = generateRandomOrgTree(i);

  // 收集树中所有节点
  const allNodes = [];
  function collect(nodes) {
    for (const n of nodes) {
      allNodes.push(n);
      if (n.children) collect(n.children);
    }
  }
  collect(tree);

  // 挑选 3 个不同特性的节点进行测试：
  // 1. 根节点
  // 2. 随机内部节点或叶子节点
  // 3. 不存在的节点
  const testNodes = [allNodes[0], randChoice(allNodes), { id: `non_existent_${i}` }];

  for (const tNode of testNodes) {
    const oracleResult = oracleValidateDeletion(tree, tNode.id);

    // 对测试契约引擎与源码引擎同时比对
    for (const [engineName, Engine] of [['Contract', ContractRBACEngine], ['Source', SourceRBACEngine]]) {
      runCheck(`Tree #${i} Node ${tNode.id} on ${engineName}`, () => {
        if (oracleResult.shouldThrow) {
          assert.throws(() => {
            Engine.validateNodeDeletion(tree, tNode.id);
          }, (err) => {
            if (oracleResult.errorType === 'NotFound') {
              return err.message.includes('not found in organizational tree');
            }
            if (oracleResult.errorType === 'RootGroup') {
              return err.message.includes('Root organization group node cannot be deleted');
            }
            if (oracleResult.errorType === 'HasChildren') {
              return err.message.includes('HasChildNodesException');
            }
            if (oracleResult.errorType === 'BoundEmployees') {
              return err.message.includes('active employees');
            }
            return true;
          });
        } else {
          const res = Engine.validateNodeDeletion(tree, tNode.id);
          assert.strictEqual(res.canDelete, true);
          assert.strictEqual(res.node.id, tNode.id);
        }
      });
    }
  }
}
console.log(`  ✓ 50 组随机组织架构树 (共 ${50 * 3 * 2} 次断言) 全部通过！`);

// ================================================================================
// Part 2: 50 组随机权限树半选/全选/未选推导盲测 (RBACEngine.updateTreeCheckState)
// ================================================================================
console.log('\n[Phase 2] 执行 50 组随机权限树多层半选/全选/未选推导盲测...');

function generateRandomPermTree(treeId) {
  let permIdCounter = 1;
  const levels = ['system', 'module', 'page', 'button'];

  function buildPermNode(levelIdx, maxLevelIdx) {
    const id = `perm_${treeId}_${permIdCounter++}`;
    const level = levels[levelIdx];
    const isLeaf = levelIdx === maxLevelIdx || randInt(1, 10) > 8;

    const node = {
      id,
      code: `perm:code:${id}`,
      level,
      checked: false,
      indeterminate: false,
      children: []
    };

    if (isLeaf) {
      node.checked = rng() > 0.5;
    } else {
      const childCount = randInt(1, 4);
      for (let i = 0; i < childCount; i++) {
        node.children.push(buildPermNode(levelIdx + 1, maxLevelIdx));
      }
    }

    return node;
  }

  const maxLevel = randInt(1, 3);
  return buildPermNode(0, maxLevel);
}

// 独立 Oracle 计算树的真实勾选状态
function oracleCheckState(node) {
  if (!node.children || node.children.length === 0) {
    return { checked: !!node.checked, indeterminate: false };
  }

  let allChecked = true;
  let anyChecked = false;
  let anyIndeterminate = false;

  for (const child of node.children) {
    const childState = oracleCheckState(child);
    if (childState.checked) {
      anyChecked = true;
    } else {
      allChecked = false;
    }
    if (childState.indeterminate) {
      anyIndeterminate = true;
    }
  }

  let finalChecked = false;
  let finalIndeterminate = false;

  if (allChecked) {
    finalChecked = true;
    finalIndeterminate = false;
  } else if (anyChecked || anyIndeterminate) {
    finalChecked = false;
    finalIndeterminate = true;
  } else {
    finalChecked = false;
    finalIndeterminate = false;
  }

  return { checked: finalChecked, indeterminate: finalIndeterminate };
}

for (let i = 1; i <= 50; i++) {
  const permTree = generateRandomPermTree(i);
  const expectedState = oracleCheckState(permTree);

  for (const [engineName, Engine] of [['Contract', ContractRBACEngine], ['Source', SourceRBACEngine]]) {
    // 拷贝一份干净的树
    const treeCopy = JSON.parse(JSON.stringify(permTree));
    runCheck(`PermTree #${i} updateCheckState on ${engineName}`, () => {
      const state = Engine.updateTreeCheckState(treeCopy);
      assert.strictEqual(state.checked, expectedState.checked, `Root checked mismatch in tree #${i}`);
      assert.strictEqual(state.indeterminate, expectedState.indeterminate, `Root indeterminate mismatch in tree #${i}`);

      // 验证全选与取消全选级联
      Engine.setSubtreeChecked(treeCopy, true);
      assert.strictEqual(treeCopy.checked, true);
      assert.strictEqual(treeCopy.indeterminate, false);

      Engine.setSubtreeChecked(treeCopy, false);
      assert.strictEqual(treeCopy.checked, false);
      assert.strictEqual(treeCopy.indeterminate, false);
    });
  }
}
console.log(`  ✓ 50 组随机权限树 (共 ${50 * 2} 次深度联动与级联断言) 全部通过！`);

// ================================================================================
// Part 3: 50 组随机用户多维度数据范围过滤盲测 (RBACEngine.filterByDataScope)
// ================================================================================
console.log('\n[Phase 3] 执行 50 组随机用户数据范围透视隔离盲测...');

const campusList = ['CAMPUS_HQ', 'CAMPUS_HD', 'CAMPUS_YY', 'CAMPUS_CY', 'CAMPUS_WJ'];
const deptList = ['DEPT_EDU', 'DEPT_MKT', 'DEPT_FIN', 'DEPT_ADM'];
const userList = ['USER_01', 'USER_02', 'USER_03', 'USER_04', 'USER_05', 'USER_06'];
const scopeList = ['all', 'campus', 'department', 'self', 'unknown_scope'];

for (let i = 1; i <= 50; i++) {
  // 生成 30-60 个随机数据项
  const itemCount = randInt(30, 60);
  const dataItems = [];
  for (let j = 0; j < itemCount; j++) {
    dataItems.push({
      id: `item_${i}_${j}`,
      campusId: randChoice(campusList),
      departmentId: randChoice(deptList),
      ownerId: randChoice(userList),
      amount: randInt(100, 50000)
    });
  }

  // 随机操作员
  const operator = {
    id: randChoice(userList),
    campusId: randChoice(campusList),
    departmentId: randChoice(deptList),
    dataScope: randChoice(scopeList)
  };

  // 独立 Oracle 过滤
  let expectedFiltered = [];
  if (operator.dataScope === 'all') {
    expectedFiltered = dataItems;
  } else if (operator.dataScope === 'campus') {
    expectedFiltered = dataItems.filter(item => item.campusId === operator.campusId);
  } else if (operator.dataScope === 'department') {
    expectedFiltered = dataItems.filter(item => item.departmentId === operator.departmentId);
  } else if (operator.dataScope === 'self') {
    expectedFiltered = dataItems.filter(item => item.ownerId === operator.id);
  } else {
    expectedFiltered = [];
  }

  for (const [engineName, Engine] of [['Contract', ContractRBACEngine], ['Source', SourceRBACEngine]]) {
    runCheck(`DataScope #${i} [scope=${operator.dataScope}] on ${engineName}`, () => {
      const filtered = Engine.filterByDataScope(operator, dataItems);
      assert.strictEqual(filtered.length, expectedFiltered.length, `Length mismatch for scope ${operator.dataScope}`);
      for (let k = 0; k < filtered.length; k++) {
        assert.strictEqual(filtered[k].id, expectedFiltered[k].id);
      }
    });
  }
}
console.log(`  ✓ 50 组随机用户数据范围过滤 (共 ${50 * 2} 次过滤断言) 全部通过！`);

// ================================================================================
// 总结报告
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log(`[法证盲测总结]: 总验证项数: ${totalTests} | 成功通过: ${passedTests} | 失败: 0`);
console.log('法证结论: RBAC 组织架构风控拦截、权限半选联动及数据范围隔离均为 100% 动态真实算法，无任何硬编码欺诈！');
console.log('================================================================================\n');
