/**
 * Milestone 2 跨校区课程授权与数据隔离对抗渗透测试套件 (Challenger M2-2)
 * 纯 Node.js 原生运行，沙箱标准执行，严禁 BypassSandbox
 * 覆盖：
 * 1. 5 大实体校区授权树渗透与越权测试
 * 2. 跨校区穿梭授权在三步编辑器中的动态增删与即时隔离性
 * 3. 未知/非法校区传入 Mock API 时的数据安全性与防护表现
 * 4. 三步编辑器模型规范与边界负向防御
 */

const path = require('node:path');
const createJiti = require('jiti');

// 使用 jiti 安全解析生产 TypeScript 源码
const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
});

const mocks = jiti('../src/mocks/index.ts');
const CurriculumModel = require('./contracts/curriculumModel');
const TenantContext = require('./contracts/tenantContext');

// 颜色输出辅助函数
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
    throw new Error(`${message || 'Failed'}: Expected [${expected}] but received [${actual}]`);
  }
}

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ${colors.green}✓ PASS:${colors.reset} ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err });
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} ${name}`);
    console.log(`    ${colors.yellow}Error: ${err.message}${colors.reset}`);
  }
}

console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}拓视未来教育「一校教培系统」Milestone 2 跨校区授权与数据隔离对抗渗透测试 (Challenger M2-2)${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

// 5 大实体校区常量
const CAMPUS_HQ = 'campus-bj-hq';  // 总部校区
const CAMPUS_YY = 'campus-bj-yy';  // 远洋校区
const CAMPUS_CY = 'campus-bj-cy';  // 朝阳校区
const CAMPUS_HD = 'campus-bj-hd';  // 海淀分校
const CAMPUS_WJ = 'campus-bj-wj';  // 望京校区

const ALL_5_CAMPUSES = [CAMPUS_HQ, CAMPUS_YY, CAMPUS_CY, CAMPUS_HD, CAMPUS_WJ];
const BRANCH_CAMPUSES = [CAMPUS_YY, CAMPUS_CY, CAMPUS_HD, CAMPUS_WJ];

// -----------------------------------------------------------------------------
// DIMENSION 1: 5 大实体校区授权树渗透与越权测试
// -----------------------------------------------------------------------------
console.log(`${colors.bold}【Dimension 1: 5 大实体校区课程授权树渗透与越权测试】${colors.reset}`);

test('1.1 授权树基线容量与数据作用域核验 (HQ:15, YY:11, CY:8, HD:8, WJ:8)', () => {
  const hqCourses = mocks.getCoursesByCampus(CAMPUS_HQ);
  const yyCourses = mocks.getCoursesByCampus(CAMPUS_YY);
  const cyCourses = mocks.getCoursesByCampus(CAMPUS_CY);
  const hdCourses = mocks.getCoursesByCampus(CAMPUS_HD);
  const wjCourses = mocks.getCoursesByCampus(CAMPUS_WJ);

  assertEqual(hqCourses.length, 15, '总部校区必须拥有全量 15 门教研课系');
  assertEqual(yyCourses.length, 11, '远洋校区基线授权课程数应严格为 11 门');
  assertEqual(cyCourses.length, 8, '朝阳校区基线授权课程数应严格为 8 门');
  assertEqual(hdCourses.length, 8, '海淀分校基线授权课程数应严格为 8 门');
  assertEqual(wjCourses.length, 8, '望京校区基线授权课程数应严格为 8 门');
});

test('1.2 分校区授权隔离性核验：分校区课程池内所有课程必须显式包含该校区授权ID', () => {
  for (const branchId of BRANCH_CAMPUSES) {
    const branchCourses = mocks.getCoursesByCampus(branchId);
    for (const course of branchCourses) {
      assert(
        Array.isArray(course.authorizedCampusIds) && course.authorizedCampusIds.includes(branchId),
        `安全漏洞：校区 [${branchId}] 的课程池中泄露了未授权课程 [${course.id}: ${course.name}]`
      );
    }
  }
});

test('1.3 水平越权防渗透测试：朝阳与望京校区严禁越权获取「C++编程集训课 (course-cpp-002)」', () => {
  // course-cpp-002 授权范围：HQ, HD, YY。朝阳与望京均未被授权
  const cyCourses = mocks.getCoursesByCampus(CAMPUS_CY);
  const wjCourses = mocks.getCoursesByCampus(CAMPUS_WJ);

  assert(!cyCourses.some(c => c.id === 'course-cpp-002'), '朝阳校区发生水平越权：检测到了未授权课程 course-cpp-002');
  assert(!wjCourses.some(c => c.id === 'course-cpp-002'), '望京校区发生水平越权：检测到了未授权课程 course-cpp-002');
});

test('1.4 水平越权防渗透测试：远洋与朝阳校区严禁越权获取「单片机集训课 (course-mcu-006)」', () => {
  // course-mcu-006 授权范围：HQ, HD
  const yyCourses = mocks.getCoursesByCampus(CAMPUS_YY);
  const cyCourses = mocks.getCoursesByCampus(CAMPUS_CY);

  assert(!yyCourses.some(c => c.id === 'course-mcu-006'), '远洋校区发生水平越权：检测到了未授权课程 course-mcu-006');
  assert(!cyCourses.some(c => c.id === 'course-mcu-006'), '朝阳校区发生水平越权：检测到了未授权课程 course-mcu-006');
});

test('1.5 垂直越权防渗透测试：全部 4 所分校区均严禁访问总部独占师训课「901-盛通师资认证 (course-training-006)」', () => {
  // course-training-006 仅授权总部 [campus-bj-hq]
  for (const branchId of BRANCH_CAMPUSES) {
    const list = mocks.getCoursesByCampus(branchId);
    assert(
      !list.some(c => c.id === 'course-training-006'),
      `安全特权泄露：分校区 [${branchId}] 违规穿透获得了总部独占课程 course-training-006`
    );
  }
});

test('1.6 全局通用课授权全景核验：「Scratch集训课」与「NCT考务服务费」必须全校区触达', () => {
  for (const campusId of ALL_5_CAMPUSES) {
    const list = mocks.getCoursesByCampus(campusId);
    assert(list.some(c => c.id === 'course-scratch-001'), `校区 [${campusId}] 缺失全局课程 course-scratch-001`);
    assert(list.some(c => c.id === 'course-service-015'), `校区 [${campusId}] 缺失全局课程 course-service-015`);
  }
});

// -----------------------------------------------------------------------------
// DIMENSION 2: 课程跨校区穿梭授权在三步编辑器中的动态增删与即时隔离性
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 2: 课程跨校区穿梭授权在三步编辑器中的动态增删与即时隔离性】${colors.reset}`);

test('2.1 动态新增校区穿梭授权：朝阳校区课程池即时增补，未授权校区（望京）零干扰', () => {
  const originalCourse = mocks.MOCK_COURSES.find(c => c.id === 'course-cpp-002');
  assert(originalCourse, '原始课程 course-cpp-002 必须存在');

  const originalAuth = [...originalCourse.authorizedCampusIds];
  const cyInitialCount = mocks.getCoursesByCampus(CAMPUS_CY).length; // 8
  const wjInitialCount = mocks.getCoursesByCampus(CAMPUS_WJ).length; // 8
  const hdInitialCount = mocks.getCoursesByCampus(CAMPUS_HD).length; // 8

  // 动态授予朝阳校区
  const updatedAuth = [...originalAuth, CAMPUS_CY];
  mocks.saveCourse({
    ...originalCourse,
    authorizedCampusIds: updatedAuth
  });

  // 验证即时性与隔离性
  const cyNewCourses = mocks.getCoursesByCampus(CAMPUS_CY);
  const wjNewCourses = mocks.getCoursesByCampus(CAMPUS_WJ);
  const hdNewCourses = mocks.getCoursesByCampus(CAMPUS_HD);

  assertEqual(cyNewCourses.length, cyInitialCount + 1, '朝阳校区课程池应立即增加 1 门');
  assert(cyNewCourses.some(c => c.id === 'course-cpp-002'), '朝阳校区课程池必须能立即查询到新增授权的 course-cpp-002');

  // 未授权校区隔离性
  assertEqual(wjNewCourses.length, wjInitialCount, '望京校区课程池数量不应发生任何变化');
  assert(!wjNewCourses.some(c => c.id === 'course-cpp-002'), '望京校区仍严禁出现 course-cpp-002');

  // 已有授权校区不受干扰
  assertEqual(hdNewCourses.length, hdInitialCount, '已有授权校区（海淀）数量不应发生任何变化');
  assert(hdNewCourses.some(c => c.id === 'course-cpp-002'), '海淀校区仍正常保有 course-cpp-002');
});

test('2.2 动态移除校区穿梭授权：远洋校区课程池即时扣减，已保留校区（朝阳/海淀）零干扰', () => {
  const course = mocks.MOCK_COURSES.find(c => c.id === 'course-cpp-002');
  const yyInitialCount = mocks.getCoursesByCampus(CAMPUS_YY).length; // 11
  const cyInitialCount = mocks.getCoursesByCampus(CAMPUS_CY).length; // 9

  // 从远洋校区撤销授权，保留 HQ, HD, CY
  const revokedAuth = course.authorizedCampusIds.filter(id => id !== CAMPUS_YY);
  mocks.saveCourse({
    ...course,
    authorizedCampusIds: revokedAuth
  });

  const yyNewCourses = mocks.getCoursesByCampus(CAMPUS_YY);
  const cyNewCourses = mocks.getCoursesByCampus(CAMPUS_CY);

  assertEqual(yyNewCourses.length, yyInitialCount - 1, '远洋校区课程池应立即减少 1 门');
  assert(!yyNewCourses.some(c => c.id === 'course-cpp-002'), '远洋校区被撤权后必须立即无法查询到 course-cpp-002');

  assertEqual(cyNewCourses.length, cyInitialCount, '已授权的朝阳校区不受撤销影响');
  assert(cyNewCourses.some(c => c.id === 'course-cpp-002'), '朝阳校区仍正常享有 course-cpp-002');
});

test('2.3 现场幂等复原与状态一致性核验', () => {
  // 恢复 course-cpp-002 初始授权: HQ, HD, YY
  const course = mocks.MOCK_COURSES.find(c => c.id === 'course-cpp-002');
  mocks.saveCourse({
    ...course,
    authorizedCampusIds: [CAMPUS_HQ, CAMPUS_HD, CAMPUS_YY]
  });

  assertEqual(mocks.getCoursesByCampus(CAMPUS_HQ).length, 15, 'HQ 应恢复为 15 门');
  assertEqual(mocks.getCoursesByCampus(CAMPUS_YY).length, 11, 'YY 应恢复为 11 门');
  assertEqual(mocks.getCoursesByCampus(CAMPUS_CY).length, 8, 'CY 应恢复为 8 门');
  assertEqual(mocks.getCoursesByCampus(CAMPUS_HD).length, 8, 'HD 应恢复为 8 门');
  assertEqual(mocks.getCoursesByCampus(CAMPUS_WJ).length, 8, 'WJ 应恢复为 8 门');
});

test('2.4 新建课程并指定单校区独占：验证分校区专属课程不被其他分校区侵入', () => {
  const newCourseId = `course-adversarial-${Date.now()}`;
  const customCourse = {
    id: newCourseId,
    name: '望京校区专属-无人机创客实训',
    code: 'WJ-DRONE-ADV',
    cover: 'data:image/svg+xml;utf8,<svg></svg>',
    pricePerLesson: 450,
    totalLessons: 24,
    subject: '硬件机器人',
    grade: '高级课程',
    attribute: 'extended',
    status: 'enabled',
    authorizedCampusIds: [CAMPUS_WJ], // 仅授权望京分校
    standardDuration: 90,
    maxCapacity: 12
  };

  mocks.saveCourse(customCourse);

  // 验证望京校区增加且能够查到
  const wjCourses = mocks.getCoursesByCampus(CAMPUS_WJ);
  assert(wjCourses.some(c => c.id === newCourseId), '望京校区必须包含新建的专属课程');

  // 验证远洋、朝阳、海淀严禁查到该课程
  for (const otherBranchId of [CAMPUS_YY, CAMPUS_CY, CAMPUS_HD]) {
    const list = mocks.getCoursesByCampus(otherBranchId);
    assert(!list.some(c => c.id === newCourseId), `非授权分校区 [${otherBranchId}] 违规泄露了望京专属课程`);
  }

  // 总部作为全量教研中心拥有全量透视权
  const hqCourses = mocks.getCoursesByCampus(CAMPUS_HQ);
  assert(hqCourses.some(c => c.id === newCourseId), '总部校区应具备全量教研课程透视权');

  // 清理测试数据
  mocks.deleteCourse(newCourseId);
  assert(!mocks.getCoursesByCampus(CAMPUS_WJ).some(c => c.id === newCourseId), '清理后望京校区不应再包含该临时课程');
});

test('2.5 批量穿梭授权联动模拟与去重校验', () => {
  // 模拟从 CourseManageView 对所有 Python 科目课程批量授权望京校区
  const pythonCourses = mocks.MOCK_COURSES.filter(c => c.subject === '软件编程' && c.name.includes('Python'));
  const originalSnapshot = pythonCourses.map(c => ({ id: c.id, auth: [...c.authorizedCampusIds] }));

  // 批量追加授权望京校区
  pythonCourses.forEach(c => {
    c.authorizedCampusIds = Array.from(new Set([...c.authorizedCampusIds, CAMPUS_WJ]));
  });

  // 验证所有 Python 课均具备望京校区且去重
  for (const c of pythonCourses) {
    assert(c.authorizedCampusIds.includes(CAMPUS_WJ), `课程 [${c.name}] 批量授权后应包含望京校区`);
    const countWj = c.authorizedCampusIds.filter(id => id === CAMPUS_WJ).length;
    assertEqual(countWj, 1, `课程 [${c.name}] 校区ID数组不应产生重复项`);
  }

  // 恢复现场
  originalSnapshot.forEach(snap => {
    const target = mocks.MOCK_COURSES.find(c => c.id === snap.id);
    if (target) target.authorizedCampusIds = snap.auth;
  });
  assertEqual(mocks.getCoursesByCampus(CAMPUS_WJ).length, 8, '望京校区课程数量应精准复原');
});

// -----------------------------------------------------------------------------
// DIMENSION 3: 未知/非法校区传入 Mock API 时的数据安全性与防护表现
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 3: 未知/非法校区传入 Mock API 时的数据安全性与防护表现】${colors.reset}`);

test('3.1 恶意 SQL 注入字符串穿透防御：返回空列表，绝不发生跨校区提权与崩溃', () => {
  const sqliPayloads = [
    "' OR '1'='1",
    "campus-bj-yy' OR 1=1 --",
    "'; DROP TABLE courses; --",
    "' UNION SELECT * FROM users --",
    "admin' --"
  ];

  for (const payload of sqliPayloads) {
    const res = mocks.getCoursesByCampus(payload);
    assert(Array.isArray(res), '注入载荷应返回数组');
    assertEqual(res.length, 0, `SQL注入载荷 [${payload}] 必须返回空列表，不得泄露任何课程`);

    const students = mocks.getStudentsByCampus(payload);
    assertEqual(students.length, 0, `SQL注入载荷 [${payload}] 不得泄露任何学员`);

    const orders = mocks.getOrdersByCampus(payload);
    assertEqual(orders.length, 0, `SQL注入载荷 [${payload}] 不得泄露任何订单`);
  }
});

test('3.2 XSS 攻击载荷与路径穿越攻击防御：返回空列表，防止反射与穿透', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    '../../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '%2e%2e%2f%2e%2e%2f'
  ];

  for (const payload of xssPayloads) {
    const res = mocks.getCoursesByCampus(payload);
    assertEqual(res.length, 0, `XSS/路径穿越载荷 [${payload}] 必须返回空列表`);
  }
});

test('3.3 原型链污染属性与对象保留关键字探测：防御通过原型链旁路窃取', () => {
  const protoPayloads = [
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'valueOf',
    'hasOwnProperty'
  ];

  for (const payload of protoPayloads) {
    const res = mocks.getCoursesByCampus(payload);
    assertEqual(res.length, 0, `原型链关键字 [${payload}] 必须返回空列表，不得发生类型混淆`);
  }
});

test('3.4 未知随机/非实体校区 ID 输入防护：返回严格空列表', () => {
  const unknownIds = [
    'campus-unknown-999',
    'CAMPUS_NOT_EXIST_SHENGTONG',
    'beijing-chaoyang-branch-fake',
    '9999999',
    'null',
    'undefined'
  ];

  for (const id of unknownIds) {
    const res = mocks.getCoursesByCampus(id);
    assertEqual(res.length, 0, `非法校区ID [${id}] 必须返回空数组`);
    const stats = mocks.getCampusStats(id);
    assertEqual(stats.courseCount, 0, `非法校区ID [${id}] 的课程统计必须为 0`);
    assertEqual(stats.studentCount, 0, `非法校区ID [${id}] 的学员统计必须为 0`);
    assertEqual(stats.totalRevenue, 0, `非法校区ID [${id}] 的实缴收入统计必须为 0`);
    assertEqual(stats.conflictCount, 0, `非法校区ID [${id}] 的冲突统计必须为 0`);
  }
});

test('3.5 空白字符与畸形字符校区防御：禁止空匹配泄漏', () => {
  const whitespaceIds = [' ', '   ', '\t', '\n', '\r\n'];
  for (const ws of whitespaceIds) {
    const res = mocks.getCoursesByCampus(ws);
    assertEqual(res.length, 0, `空白字符校区ID 必须返回空数组`);
  }
});

test('3.6 TenantContext 契约模型对未知校区切换的显式阻断抛错校验', () => {
  const tenant = new TenantContext();

  // 空值阻断
  let emptyBlocked = false;
  try {
    tenant.setCampus('');
  } catch (e) {
    emptyBlocked = e.message.includes('Campus ID cannot be empty');
  }
  assert(emptyBlocked, 'TenantContext 应阻断空校区并抛错');

  // 未授权非法校区阻断
  let invalidBlocked = false;
  try {
    tenant.setCampus('campus-hacker-malicious');
  } catch (e) {
    invalidBlocked = e.message.includes('Unauthorized or invalid campus ID');
  }
  assert(invalidBlocked, 'TenantContext 应阻断非法校区并抛错');
});

// -----------------------------------------------------------------------------
// DIMENSION 4: 三步编辑器模型规范与边界负向防御
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 4: 三步编辑器模型规范与边界负向防御】${colors.reset}`);

test('4.1 编辑器数据契约校验：课时单价为负数时严格阻断', () => {
  const invalidCourse = {
    name: '非法负价课程测试',
    pricePerLesson: -100,
    totalLessons: 20,
    attribute: 'regular',
    status: 'enabled',
    authorizedCampusIds: [CAMPUS_HQ]
  };
  const check = CurriculumModel.validateCourseItem(invalidCourse);
  assert(!check.isValid, '负数单价必须校验失败');
  assert(check.errors.some(e => e.includes('non-negative number')), '错误信息应包含 non-negative number');
});

test('4.2 编辑器数据契约校验：总课时数为 0 或负数时严格阻断', () => {
  const zeroLessonsCourse = {
    name: '零课时课程测试',
    pricePerLesson: 200,
    totalLessons: 0,
    attribute: 'regular',
    status: 'enabled',
    authorizedCampusIds: [CAMPUS_HQ]
  };
  const check = CurriculumModel.validateCourseItem(zeroLessonsCourse);
  assert(!check.isValid, '零课时必须校验失败');
  assert(check.errors.some(e => e.includes('greater than 0')), '错误信息应包含 greater than 0');
});

test('4.3 编辑器数据契约校验：非法课程属性或非法开课状态严格阻断', () => {
  const badAttrCourse = {
    name: '非法属性测试',
    pricePerLesson: 200,
    totalLessons: 10,
    attribute: 'invalid_type_xxx',
    status: 'enabled',
    authorizedCampusIds: [CAMPUS_HQ]
  };
  const check1 = CurriculumModel.validateCourseItem(badAttrCourse);
  assert(!check1.isValid, '非法课程属性必须阻断');

  const badStatusCourse = {
    name: '非法状态测试',
    pricePerLesson: 200,
    totalLessons: 10,
    attribute: 'regular',
    status: 'archived_pending',
    authorizedCampusIds: [CAMPUS_HQ]
  };
  const check2 = CurriculumModel.validateCourseItem(badStatusCourse);
  assert(!check2.isValid, '非法状态必须阻断');
});

test('4.4 编辑器课时编排算法边界：拖拽下标越界严密拦截防崩溃', () => {
  const unit = {
    id: 'u-01',
    lessons: [{ id: 'l-1', title: '课1' }, { id: 'l-2', title: '课2' }]
  };

  let caught1 = false;
  try {
    CurriculumModel.reorderLessons(unit, -1, 1);
  } catch (e) {
    caught1 = true;
  }
  assert(caught1, 'fromIndex 负数应抛出异常');

  let caught2 = false;
  try {
    CurriculumModel.reorderLessons(unit, 0, 999);
  } catch (e) {
    caught2 = true;
  }
  assert(caught2, 'toIndex 溢出应抛出异常');
});

test('4.5 课程下架与禁用对排课与前台开单的强阻断联动核验', () => {
  const disabledCourse = mocks.MOCK_COURSES.find(c => c.id === 'course-training-006');
  assert(disabledCourse && disabledCourse.status === 'disabled', 'course-training-006 初始应为 disabled 状态');

  const scheduleCheck = CurriculumModel.canSchedule(disabledCourse);
  assert(!scheduleCheck.allowed, '已禁用课程严禁参与教务排课');
  assertEqual(scheduleCheck.reason, 'Course is disabled', '禁用原因应为 Course is disabled');
});

// -----------------------------------------------------------------------------
// 测试汇总输出
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}对抗测试总结报告:${colors.reset} 总用例: ${totalTests} | ${colors.green}通过: ${passedTests}${colors.reset} | ${failedTests > 0 ? colors.red : colors.green}失败: ${failedTests}${colors.reset} | 通过率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

if (failedTests > 0) {
  console.error(`${colors.red}发现 ${failedTests} 项对抗测试用例未通过！详细信息：${colors.reset}`);
  for (const f of failures) {
    console.error(`- [${f.name}]: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log(`${colors.green}${colors.bold}全部对抗与渗透测试用例 100% 通过！5 大校区课程授权树隔离严密，动态穿梭增删即时，非法校区输入安全防护完备。${colors.reset}\n`);
  process.exit(0);
}
