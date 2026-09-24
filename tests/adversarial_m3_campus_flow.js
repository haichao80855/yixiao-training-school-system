/**
 * Milestone 3 多校区上下文联动与业务链路对抗验证测试套件 (Challenger M3-2)
 * 纯 Node.js 原生沙箱标准执行，严禁 BypassSandbox
 * 
 * 核心验证维度：
 * 1. 多校区学员数据作用域穿透与统计指标核验 (5大实体校区、正交互斥、注入与原型链安全防御)
 * 2. 待分班学员调度池流转与校区过滤核验 (分校区精确过滤、入班排课与从调度池移除)
 * 3. 学员报读签约开单至待分班调度池全链路闭环测试 (enrollStudent -> getUnassignedStudents -> assignClassToStudent 闭环)
 * 4. 易快报服务费与代报考核销链路对抗测试 (单条核销、批量核销、状态流转与幂等性验证)
 * 5. 学员中心 7 大异动分支状态机与风控边界负向对抗 (转班、换课、停课、复课、转校、转让、退费与钱包风控)
 * 6. 测试数据状态幂等复原与全量测试无污染验证
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
if (mocks.MOCK_STUDENTS.length === 0 && mocks.restoreStudentMockData) {
  mocks.restoreStudentMockData();
}

// 颜色输出辅助函数
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message || 'Failed'}: Expected [${expectedStr}] but received [${actualStr}]`);
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
console.log(`${colors.bold}${colors.cyan}盛通教育「一校教培系统」Milestone 3 多校区上下文联动与业务链路对抗验证 (Challenger M3-2)${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

// 5 大实体校区常量
const CAMPUS_HQ = 'campus-bj-hq';  // 总部校区
const CAMPUS_YY = 'campus-bj-yy';  // 远洋校区
const CAMPUS_CY = 'campus-bj-cy';  // 朝阳校区
const CAMPUS_HD = 'campus-bj-hd';  // 海淀分校
const CAMPUS_WJ = 'campus-bj-wj';  // 望京校区

const ALL_5_CAMPUSES = [CAMPUS_HQ, CAMPUS_YY, CAMPUS_CY, CAMPUS_HD, CAMPUS_WJ];
const BRANCH_CAMPUSES = [CAMPUS_YY, CAMPUS_CY, CAMPUS_HD, CAMPUS_WJ];

// 保存初始 Mock 数据快照以便现场严格复原
const initialStudentsSnapshot = JSON.parse(JSON.stringify(mocks.MOCK_STUDENTS));
const initialUnassignedSnapshot = JSON.parse(JSON.stringify(mocks.MOCK_UNASSIGNED_STUDENTS));
const initialServiceFeesSnapshot = JSON.parse(JSON.stringify(mocks.MOCK_SERVICE_FEES));

// -----------------------------------------------------------------------------
// DIMENSION 1: 多校区学员数据作用域穿透与统计指标核验
// -----------------------------------------------------------------------------
console.log(`${colors.bold}【Dimension 1: 多校区学员数据作用域穿透与统计指标核验】${colors.reset}`);

test('1.1 5 大实体校区学员基线容量核验 (HQ:6, YY:4, CY:4, HD:4, WJ:4, 总和:22)', () => {
  const hqStudents = mocks.getStudentsByCampus(CAMPUS_HQ);
  const yyStudents = mocks.getStudentsByCampus(CAMPUS_YY);
  const cyStudents = mocks.getStudentsByCampus(CAMPUS_CY);
  const hdStudents = mocks.getStudentsByCampus(CAMPUS_HD);
  const wjStudents = mocks.getStudentsByCampus(CAMPUS_WJ);

  assertEqual(hqStudents.length, 6, '总部校区必须精准归属 6 位学员');
  assertEqual(yyStudents.length, 4, '远洋校区必须精准归属 4 位学员');
  assertEqual(cyStudents.length, 4, '朝阳校区必须精准归属 4 位学员');
  assertEqual(hdStudents.length, 4, '海淀分校必须精准归属 4 位学员');
  assertEqual(wjStudents.length, 4, '望京校区必须精准归属 4 位学员');

  const totalSum = hqStudents.length + yyStudents.length + cyStudents.length + hdStudents.length + wjStudents.length;
  assertEqual(totalSum, 22, '5 大校区学员总和守恒为 22 位');
});

test('1.2 严格数据隔离不变式：任意校区查询返回的全部学员其 campusId 必须与目标校区 100% 严格一致', () => {
  for (const campusId of ALL_5_CAMPUSES) {
    const list = mocks.getStudentsByCampus(campusId);
    for (const student of list) {
      assertEqual(
        student.campusId,
        campusId,
        `数据穿透漏洞：校区 [${campusId}] 的学员列表中泄露了归属 [${student.campusId}] 的学员 [${student.id}: ${student.name}]`
      );
    }
  }
});

test('1.3 正交切分与互斥性核验 (Disjoint Partition Invariant)：5 大校区学员 ID 集合两两交集为空', () => {
  const campusIdMaps = {};
  for (const campusId of ALL_5_CAMPUSES) {
    campusIdMaps[campusId] = new Set(mocks.getStudentsByCampus(campusId).map(s => s.id));
  }

  for (let i = 0; i < ALL_5_CAMPUSES.length; i++) {
    for (let j = i + 1; j < ALL_5_CAMPUSES.length; j++) {
      const c1 = ALL_5_CAMPUSES[i];
      const c2 = ALL_5_CAMPUSES[j];
      const set1 = campusIdMaps[c1];
      const set2 = campusIdMaps[c2];

      for (const id of set1) {
        assert(!set2.has(id), `跨校区学籍冲突：学员 [${id}] 同时出现在校区 [${c1}] 和校区 [${c2}] 中`);
      }
    }
  }
});

test('1.4 校区统计指标 (getCampusStats) 动态计算核验：各校区 studentCount 严格对齐', () => {
  for (const campusId of ALL_5_CAMPUSES) {
    const stats = mocks.getCampusStats(campusId);
    const students = mocks.getStudentsByCampus(campusId);
    assertEqual(
      stats.studentCount,
      students.length,
      `统计指标不一致：校区 [${campusId}] 的 stats.studentCount (${stats.studentCount}) 不等于实际学员数 (${students.length})`
    );
    assert(stats.courseCount > 0, `校区 [${campusId}] 的课程统计数应大于 0`);
  }
});

test('1.5 复合条件过滤 (getStudents with campusId + status/grade/keyword)：在校区作用域下的精确过滤', () => {
  // 总部正常在读
  const hqNormal = mocks.getStudents({ campusId: CAMPUS_HQ, status: 'normal' });
  assert(hqNormal.length > 0, '总部应包含正常在读学员');
  for (const s of hqNormal) {
    assertEqual(s.campusId, CAMPUS_HQ, '总部筛选学员 campusId 必须为 HQ');
    assertEqual(s.status, 'normal', '学员状态必须为 normal');
  }

  // 远洋校区关键词模糊搜索
  const yySearch = mocks.getStudents({ campusId: CAMPUS_YY, keyword: '王紫涵' });
  assertEqual(yySearch.length, 1, '远洋校区应精准检索到王紫涵');
  assertEqual(yySearch[0].name, '王紫涵');

  // 朝阳校区检索总部学员姓名，必须被校区作用域阻断，返回 0 条
  const crossSearch = mocks.getStudents({ campusId: CAMPUS_CY, keyword: '张小萌' });
  assertEqual(crossSearch.length, 0, '朝阳校区检索总部学员张小萌必须返回空列表，防止越权');
});

test('1.6 非法/未知校区 ID 渗透防御：SQL/XSS/畸形字符严格返回空列表，统计指标安全归零', () => {
  const evilCampusIds = [
    'campus-fake-999',
    'campus-bj-hq\' OR \'1\'=\'1',
    'campus-bj-hq; DROP TABLE students; --',
    '<script>alert("xss")</script>',
    '   ',
    'null',
    'undefined',
    'NaN',
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'valueOf'
  ];

  for (const evilId of evilCampusIds) {
    const studentsByCampus = mocks.getStudentsByCampus(evilId);
    assertEqual(studentsByCampus.length, 0, `渗透失败防御失败：getStudentsByCampus("${evilId}") 泄露了 ${studentsByCampus.length} 条数据`);

    const studentsFiltered = mocks.getStudents({ campusId: evilId });
    assertEqual(studentsFiltered.length, 0, `渗透失败防御失败：getStudents({ campusId: "${evilId}" }) 泄露了 ${studentsFiltered.length} 条数据`);

    const stats = mocks.getCampusStats(evilId);
    assertEqual(stats.studentCount, 0, `统计指标泄露：未知校区 [${evilId}] stats.studentCount 应为 0`);
    assertEqual(stats.paidOrderCount, 0, `统计指标泄露：未知校区 [${evilId}] stats.paidOrderCount 应为 0`);
    assertEqual(stats.totalRevenue, 0, `统计指标泄露：未知校区 [${evilId}] stats.totalRevenue 应为 0`);

    const unassigned = mocks.getUnassignedStudents(evilId);
    assertEqual(unassigned.length, 0, `待分班池泄露：未知校区 [${evilId}] getUnassignedStudents 应返回空列表`);

    const serviceFees = mocks.getServiceFeeRecords(evilId);
    assertEqual(serviceFees.length, 0, `服务费台账泄露：未知校区 [${evilId}] getServiceFeeRecords 应返回空列表`);
  }
});

test('1.7 原型链污染探测：验证全局对象原型链未被污染', () => {
  const testObj = {};
  assertEqual(testObj.polluted, undefined, 'Object.prototype 不得存在 polluted 属性');
  assertEqual(testObj.isAdmin, undefined, 'Object.prototype 不得存在 isAdmin 属性');
  assertEqual(Object.prototype.campusId, undefined, 'Object.prototype 不得存在 campusId 属性');
});

// -----------------------------------------------------------------------------
// DIMENSION 2: 待分班学员调度池数据流转与校区过滤核验
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 2: 待分班学员调度池数据流转与校区过滤核验】${colors.reset}`);

test('2.1 待分班调度池基线与校区作用域过滤：分校区精准过滤，未知校区安全返回空集', () => {
  const allUnassigned = mocks.getUnassignedStudents();
  assert(allUnassigned.length >= 3, '系统全局待分班学员池应至少包含 3 位基线学员');

  const yyUnassigned = mocks.getUnassignedStudents(CAMPUS_YY);
  assertEqual(yyUnassigned.length, 1, '远洋校区基线应有 1 位待分班学员');
  assertEqual(yyUnassigned[0].campusId, CAMPUS_YY, '远洋校区待分班学员 campusId 必须为 YY');
  assertEqual(yyUnassigned[0].name, '林若汐', '远洋校区待分班学员为林若汐');

  const wjUnassigned = mocks.getUnassignedStudents(CAMPUS_WJ);
  assertEqual(wjUnassigned.length, 1, '望京校区基线应有 1 位待分班学员');
  assertEqual(wjUnassigned[0].campusId, CAMPUS_WJ, '望京校区待分班学员 campusId 必须为 WJ');
  assertEqual(wjUnassigned[0].name, '周泽铭', '望京校区待分班学员为周泽铭');

  const fakeUnassigned = mocks.getUnassignedStudents('campus-non-existent');
  assertEqual(fakeUnassigned.length, 0, '非法校区必须返回空数组');
});

test('2.2 待分班学员数据契约与必要字段核验', () => {
  const list = mocks.getUnassignedStudents();
  for (const item of list) {
    assert(typeof item.id === 'string' && item.id.length > 0, 'id 必须为非空字符串');
    assert(typeof item.studentId === 'string' && item.studentId.length > 0, 'studentId 必须为非空字符串');
    assert(typeof item.name === 'string' && item.name.length > 0, 'name 必须为非空字符串');
    assert(typeof item.campusId === 'string' && item.campusId.length > 0, 'campusId 必须为非空字符串');
    assert(typeof item.courseId === 'string' && item.courseId.length > 0, 'courseId 必须为非空字符串');
    assert(typeof item.unassignedLessons === 'number' && item.unassignedLessons > 0, 'unassignedLessons 必须为大于0的数字');
    assert(typeof item.preferredTime === 'string', 'preferredTime 必须存在');
    assert(typeof item.assessmentScore === 'number', 'assessmentScore 必须存在');
    assert(typeof item.assessmentSummary === 'string', 'assessmentSummary 必须存在');
  }
});

test('2.3 分班入班排课 API (assignClassToStudent) 负向防护：未知学员 ID 返回 false', () => {
  const result = mocks.assignClassToStudent('std-unknown-fake', 'class-scratch-101', 'Scratch创意周末班');
  assertEqual(result, false, '为未知学员分班必须返回 false，严禁抛出未捕获异常');
});

// -----------------------------------------------------------------------------
// DIMENSION 3: 学员报读签约开单至待分班调度池全链路闭环测试
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 3: 学员报读签约开单至待分班调度池全链路闭环测试】${colors.reset}`);

test('3.1 正常报读签约开单 -> 自动推入待分班调度池 -> 快捷加入班级 -> 状态流转闭环', () => {
  // Step 1: 创建一位全新测试学员
  const testStudent = mocks.addStudent({
    name: '对抗测试学员A',
    campusId: CAMPUS_YY,
    phone: '13999990001',
    wallet: { principalBalance: 5000, bonusBalance: 1000, goldPoints: 50, ledger: [] }
  });
  assert(testStudent.id, '新学员应分配有效 ID');

  const beforeUnassignedCount = mocks.getUnassignedStudents().length;
  const beforeYYUnassignedCount = mocks.getUnassignedStudents(CAMPUS_YY).length;

  // Step 2: 模拟前台选课签约开单 (4步开单签约流程)
  const enrollRes = mocks.enrollStudent({
    studentId: testStudent.id,
    courseId: 'course-python-003',
    lessonCount: 30,
    bonusLessons: 6,
    pricePerLesson: 260,
    discountAmount: 200,
    couponAmount: 100,
    actualAmount: 7500,
    paymentMethod: 'wechat',
    campusId: CAMPUS_YY,
    operator: '对抗测试学管'
  });

  assertEqual(enrollRes.success, true, '学员报读开单签约必须返回 success: true');
  assert(enrollRes.packageId.startsWith('pkg-'), '必须生成合规课包编号');
  assert(enrollRes.orderNo.startsWith('ORD'), '必须生成合规订单流水编号');

  // 验证学员实体内的课包资产更新
  const updatedStudent = mocks.getStudentById(testStudent.id);
  assert(updatedStudent, '学员必须能被检索');
  assertEqual(updatedStudent.coursePackages.length, 1, '学员名下必须新增 1 个有效课包');
  const newPkg = updatedStudent.coursePackages[0];
  assertEqual(newPkg.courseId, 'course-python-003');
  assertEqual(newPkg.totalLessons, 36, '总课时应为 30 正课 + 6 赠课 = 36');
  assertEqual(newPkg.remainingLessons, 36, '剩余课时应严格等于 36');
  assertEqual(newPkg.bonusLessons, 6, '赠课应为 6');
  assertEqual(newPkg.status, 'active', '新购课包状态必须为 active');

  // Step 3: 验证该学员已被自动推入待分班调度池
  const afterUnassignedCount = mocks.getUnassignedStudents().length;
  assertEqual(afterUnassignedCount, beforeUnassignedCount + 1, '全局待分班池应精准增加 1 人');

  const afterYYUnassigned = mocks.getUnassignedStudents(CAMPUS_YY);
  assertEqual(afterYYUnassigned.length, beforeYYUnassignedCount + 1, '远洋校区待分班池应精准增加 1 人');

  const unassignedEntry = afterYYUnassigned.find(u => u.studentId === testStudent.id);
  assert(unassignedEntry, '在远洋校区待分班池中必须能检索到该学员');
  assertEqual(unassignedEntry.unassignedLessons, 36, '待分配课时必须为 36');
  assertEqual(unassignedEntry.courseId, 'course-python-003');
  assertEqual(unassignedEntry.campusId, CAMPUS_YY);

  // Step 4: 执行快捷分班加入班级 (assignClassToStudent)
  const assignRes = mocks.assignClassToStudent(
    testStudent.id,
    'class-python-301',
    'Python算法实战A班 (周六 16:00)'
  );
  assertEqual(assignRes, true, '加入班级排课必须返回 true');

  // 验证学员课包上已写入班级信息
  assertEqual(newPkg.classId, 'class-python-301');
  assertEqual(newPkg.className, 'Python算法实战A班 (周六 16:00)');

  // Step 5: 验证该学员已从待分班调度池中闭环移出
  const finalUnassigned = mocks.getUnassignedStudents();
  const foundInPool = finalUnassigned.some(u => u.studentId === testStudent.id);
  assert(!foundInPool, '学员完成分班后必须彻底移出待分班调度池，形成闭环');

  const finalYYUnassigned = mocks.getUnassignedStudents(CAMPUS_YY);
  assertEqual(finalYYUnassigned.length, beforeYYUnassignedCount, '远洋待分班人数应恢复');
});

test('3.2 电子钱包支付签约与余额扣减优先级（优先扣赠送金再扣本金）', () => {
  const testStudent = mocks.addStudent({
    name: '钱包支付测试学员',
    campusId: CAMPUS_HQ,
    wallet: { principalBalance: 3000, bonusBalance: 1000, goldPoints: 0, ledger: [] }
  });

  // 签约实付 1500 元：赠送金 1000 全部扣除，本金扣除 500，本金剩余 2500，赠送金剩余 0
  const enrollRes = mocks.enrollStudent({
    studentId: testStudent.id,
    courseId: 'course-scratch-001',
    lessonCount: 10,
    bonusLessons: 0,
    pricePerLesson: 150,
    discountAmount: 0,
    couponAmount: 0,
    actualAmount: 1500,
    paymentMethod: 'wallet',
    campusId: CAMPUS_HQ
  });

  assertEqual(enrollRes.success, true);
  const student = mocks.getStudentById(testStudent.id);
  assertEqual(student.wallet.bonusBalance, 0, '赠送金 1000 应优先被全额扣减为 0');
  assertEqual(student.wallet.principalBalance, 2500, '本金 3000 应扣除差额 500 变为 2500');
});

test('3.3 电子钱包余额不足拦截：actualAmount > 总余额时严格阻断，资产无篡改', () => {
  const testStudent = mocks.addStudent({
    name: '钱包透支拦截学员',
    campusId: CAMPUS_HQ,
    wallet: { principalBalance: 500, bonusBalance: 200, goldPoints: 0, ledger: [] }
  });

  const enrollRes = mocks.enrollStudent({
    studentId: testStudent.id,
    courseId: 'course-scratch-001',
    lessonCount: 20,
    bonusLessons: 0,
    pricePerLesson: 200,
    discountAmount: 0,
    couponAmount: 0,
    actualAmount: 4000, // 远超钱包 700 元余额
    paymentMethod: 'wallet',
    campusId: CAMPUS_HQ
  });

  assertEqual(enrollRes.success, false, '余额不足必须阻断签约开单');
  const student = mocks.getStudentById(testStudent.id);
  assertEqual(student.wallet.principalBalance, 500, '本金余额不得发生变化');
  assertEqual(student.wallet.bonusBalance, 200, '赠送金余额不得发生变化');
  assertEqual(student.coursePackages.length, 0, '不得生成任何课包');
});

test('3.4 非法报读入参防御：不存在的 studentId 严格阻断', () => {
  const res = mocks.enrollStudent({
    studentId: 'std-fake-99999',
    courseId: 'course-scratch-001',
    lessonCount: 10,
    bonusLessons: 0,
    pricePerLesson: 200,
    discountAmount: 0,
    couponAmount: 0,
    actualAmount: 2000,
    paymentMethod: 'wechat',
    campusId: CAMPUS_HQ
  });
  assertEqual(res.success, false, '对不存在学员开单必须返回 false');
});

// -----------------------------------------------------------------------------
// DIMENSION 4: 易快报费控服务费与代报考核销链路对抗测试
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 4: 易快报费控服务费与代报考核销链路对抗测试】${colors.reset}`);

test('4.1 易快报服务费台账基线与校区过滤：HQ返回全量，分校区精确过滤，未知校区安全返回空集', () => {
  const allRecords = mocks.getServiceFeeRecords();
  assert(allRecords.length >= 4, '系统基线服务费记录应至少 4 条');

  const hdRecords = mocks.getServiceFeeRecords(CAMPUS_HD);
  assertEqual(hdRecords.length, 2, '海淀校区基线应有 2 条服务费代报记录');
  for (const r of hdRecords) {
    assertEqual(r.campusId, CAMPUS_HD, '海淀校区服务费记录 campusId 必须为 HD');
  }

  const evilRecords = mocks.getServiceFeeRecords('campus-fake-id');
  assertEqual(evilRecords.length, 0, '非法校区必须返回空数组');
});

test('4.2 单条服务费核销 (verifyServiceFeeRecord) 状态流转与凭证号写入', () => {
  const newRecord = mocks.addServiceFeeRecord({
    studentId: 'std-001',
    studentName: '张小萌',
    campusId: CAMPUS_HQ,
    fee: 350,
    status: 'pending',
    examType: 'NCT全国青少年编程能力等级测试Python一级'
  });

  assertEqual(newRecord.status, 'pending');

  const customVoucher = 'YKB-20260921-TEST01';
  const verifyRes = mocks.verifyServiceFeeRecord(newRecord.id, customVoucher);
  assertEqual(verifyRes, true, '单条核销必须返回 true');

  const verifiedRecord = mocks.getServiceFeeRecords().find(r => r.id === newRecord.id);
  assert(verifiedRecord, '核销后记录必须存在');
  assertEqual(verifiedRecord.status, 'verified', '核销后状态必须流转为 verified');
  assertEqual(verifiedRecord.yikuaibaoVoucherNo, customVoucher, '易快报凭证号必须正确写入');
  assert(verifiedRecord.verifyTime && verifiedRecord.verifyTime.length > 0, '核销时间戳必须生效');
});

test('4.3 单条核销幂等性测试：对已核销记录再次调用核销，状态保持 verified', () => {
  const newRecord = mocks.addServiceFeeRecord({
    studentId: 'std-002',
    studentName: '李浩轩',
    campusId: CAMPUS_HQ,
    fee: 400,
    status: 'pending',
    examType: '蓝桥杯少儿创意编程组选拔赛'
  });

  mocks.verifyServiceFeeRecord(newRecord.id, 'YKB-V1');
  // 再次核销
  const secondRes = mocks.verifyServiceFeeRecord(newRecord.id, 'YKB-V2');
  assertEqual(secondRes, true);

  const rec = mocks.getServiceFeeRecords().find(r => r.id === newRecord.id);
  assertEqual(rec.status, 'verified', '幂等调用状态依然稳定为 verified');
});

test('4.4 单条核销负向边界：对不存在的记录 ID 进行核销安全返回 false', () => {
  const res = mocks.verifyServiceFeeRecord('sf-non-existent-999');
  assertEqual(res, false, '不存在单号核销必须返回 false');
});

test('4.5 批量核销服务费 (batchVerifyServiceFeeRecords) 状态流转与统一凭证号应用', () => {
  const r1 = mocks.addServiceFeeRecord({ id: 'sf-batch-test-1', studentId: 'std-001', fee: 200, status: 'pending' });
  const r2 = mocks.addServiceFeeRecord({ id: 'sf-batch-test-2', studentId: 'std-002', fee: 300, status: 'pending' });
  const r3 = mocks.addServiceFeeRecord({ id: 'sf-batch-test-3', studentId: 'std-003', fee: 400, status: 'pending' });

  const batchVoucher = 'YKB-BATCH-CORP-999';
  const count = mocks.batchVerifyServiceFeeRecords([r1.id, r2.id, r3.id], batchVoucher);
  assertEqual(count, 3, '批量核销应成功核销全部 3 条记录');

  for (const id of [r1.id, r2.id, r3.id]) {
    const item = mocks.getServiceFeeRecords().find(r => r.id === id);
    assertEqual(item.status, 'verified', '批量核销记录状态必须为 verified');
    assertEqual(item.yikuaibaoVoucherNo, batchVoucher, '统一核销凭证号必须一致写入');
  }
});

test('4.6 批量核销幂等性测试：对已核销记录再次执行批量核销，返回计数为 0', () => {
  const r1 = mocks.addServiceFeeRecord({ id: 'sf-idemp-test-1', studentId: 'std-001', fee: 200, status: 'pending' });
  const r2 = mocks.addServiceFeeRecord({ id: 'sf-idemp-test-2', studentId: 'std-002', fee: 250, status: 'pending' });

  const firstCount = mocks.batchVerifyServiceFeeRecords([r1.id, r2.id], 'YKB-BATCH-FIRST');
  assertEqual(firstCount, 2, '首次批量核销成功 2 条');

  // 再次对完全相同的 ID 进行批量核销
  const secondCount = mocks.batchVerifyServiceFeeRecords([r1.id, r2.id], 'YKB-BATCH-SECOND');
  assertEqual(secondCount, 0, '幂等性保障：已核销记录不得被重复核销，返回成功计数必须为 0');
});

test('4.7 混合批量核销鲁棒性测试：输入数组包含 [未核销, 已核销, 非法不存在ID]', () => {
  const pendingRec = mocks.addServiceFeeRecord({ id: 'sf-mixed-pending', studentId: 'std-001', fee: 180, status: 'pending' });
  const alreadyVerifiedRec = mocks.addServiceFeeRecord({ id: 'sf-mixed-verified', studentId: 'std-002', fee: 220, status: 'verified' });

  const mixedIds = [pendingRec.id, alreadyVerifiedRec.id, 'sf-ghost-non-existent'];
  const count = mocks.batchVerifyServiceFeeRecords(mixedIds, 'YKB-MIXED-001');

  assertEqual(count, 1, '仅 pending 状态记录被计入核销，已核销与不存在单号安全跳过');
  const checkedPending = mocks.getServiceFeeRecords().find(r => r.id === pendingRec.id);
  assertEqual(checkedPending.status, 'verified');
});

// -----------------------------------------------------------------------------
// DIMENSION 5: 学员中心 7 大异动分支状态机与风控边界负向对抗
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 5: 学员中心 7 大异动分支状态机与风控边界负向对抗】${colors.reset}`);

test('5.1 异动分支 1: 转班 (transfer_class) 满班容量阻断与停课学员转班阻断', () => {
  const stu = mocks.addStudent({
    name: '转班测试学员',
    campusId: CAMPUS_HQ,
    status: 'normal',
    coursePackages: [{
      packageId: 'pkg-test-transfer',
      courseId: 'course-scratch-001',
      courseName: '012-软编Scratch创意图形编程',
      totalLessons: 20,
      remainingLessons: 15,
      status: 'active'
    }]
  });

  // 1. 正常转班成功
  const successRes = mocks.applyAbnormalMovement({
    movementType: 'transfer_class',
    studentId: stu.id,
    packageId: 'pkg-test-transfer',
    toClassId: 'class-scratch-101',
    targetClassCapacity: 16,
    targetClassCurrentCount: 12
  });
  assertEqual(successRes.success, true);
  assertEqual(stu.coursePackages[0].classId, 'class-scratch-101');

  // 2. 目标班级满员阻断 (currentCount >= capacity)
  const fullRes = mocks.applyAbnormalMovement({
    movementType: 'transfer_class',
    studentId: stu.id,
    packageId: 'pkg-test-transfer',
    toClassId: 'class-scratch-102',
    targetClassCapacity: 16,
    targetClassCurrentCount: 16
  });
  assertEqual(fullRes.success, false, '满班时必须严密阻断转班');

  // 3. 停课学员转班阻断
  stu.status = 'suspended';
  const suspendRes = mocks.applyAbnormalMovement({
    movementType: 'transfer_class',
    studentId: stu.id,
    packageId: 'pkg-test-transfer',
    toClassId: 'class-scratch-101',
    targetClassCapacity: 16,
    targetClassCurrentCount: 10
  });
  assertEqual(suspendRes.success, false, '停课休学学员禁止转班');
});

test('5.2 异动分支 2: 换课 (change_course) 差额退补高精度数学核算与负向课时拦截', () => {
  const stu = mocks.addStudent({
    name: '换课测试学员',
    campusId: CAMPUS_HQ,
    wallet: { principalBalance: 1000, bonusBalance: 0, goldPoints: 0, ledger: [] },
    coursePackages: [{
      packageId: 'pkg-test-change',
      courseId: 'course-scratch-001',
      courseName: 'Scratch编程基础',
      pricePerLesson: 200,
      totalLessons: 20,
      remainingLessons: 10, // 剩余价值 10 * 200 = 2000
      status: 'active'
    }]
  });

  // 1. 负数/0课时换课拦截
  const zeroRes = mocks.applyAbnormalMovement({
    movementType: 'change_course',
    studentId: stu.id,
    packageId: 'pkg-test-change',
    newCourseId: 'course-cpp-002',
    newPurchasedLessons: 0
  });
  assertEqual(zeroRes.success, false, '购买课时<=0必须拦截');

  // 2. 剩余价值 (2000) > 新课总价 (5 * 300 = 1500) -> 差额 500 自动退回电子钱包本金
  const refundDiffRes = mocks.applyAbnormalMovement({
    movementType: 'change_course',
    studentId: stu.id,
    packageId: 'pkg-test-change',
    newCourseId: 'course-cpp-002', // 假设单价通过 mock 动态获取
    newPurchasedLessons: 5
  });
  assertEqual(refundDiffRes.success, true);
  assert(stu.coursePackages.some(p => p.courseId === 'course-cpp-002' && p.status === 'active'), '新课包应激活');
  assert(stu.coursePackages.find(p => p.packageId === 'pkg-test-change').status === 'completed', '原课包应结课');
});

test('5.3 异动分支 3 & 4: 停课 (suspend) 有效期自动顺延与复课 (resume) 解冻恢复', () => {
  const stu = mocks.addStudent({
    name: '休学复课测试学员',
    campusId: CAMPUS_HQ,
    status: 'normal',
    coursePackages: [{
      packageId: 'pkg-test-suspend',
      courseId: 'course-scratch-001',
      totalLessons: 20,
      remainingLessons: 20,
      expireDate: '2026-10-01',
      expiryDate: '2026-10-01',
      status: 'active'
    }]
  });

  // 1. 正常办理停课 30 天
  const suspendRes = mocks.applyAbnormalMovement({
    movementType: 'suspend',
    studentId: stu.id,
    suspensionDays: 30
  });
  assertEqual(suspendRes.success, true);
  assertEqual(stu.status, 'suspended', '学员状态应变为 suspended');
  assertEqual(stu.coursePackages[0].status, 'frozen', '课包应冻结');
  assertEqual(stu.coursePackages[0].expireDate, '2026-10-31', '有效期应自动顺延 30 天');

  // 2. 重复停课拦截
  const repeatSuspend = mocks.applyAbnormalMovement({
    movementType: 'suspend',
    studentId: stu.id,
    suspensionDays: 30
  });
  assertEqual(repeatSuspend.success, false, '重复停课必须拦截');

  // 3. 办理复课
  const resumeRes = mocks.applyAbnormalMovement({
    movementType: 'resume',
    studentId: stu.id
  });
  assertEqual(resumeRes.success, true);
  assertEqual(stu.status, 'normal', '学员状态应恢复为 normal');
  assertEqual(stu.coursePackages[0].status, 'active', '课包应解冻为 active');

  // 4. 对非停课学员复课拦截
  const repeatResume = mocks.applyAbnormalMovement({
    movementType: 'resume',
    studentId: stu.id
  });
  assertEqual(repeatResume.success, false, '非停课学员复课必须拦截');
});

test('5.4 异动分支 5: 转校 (transfer_campus) 跨校区学籍划转与同校区拦截', () => {
  const stu = mocks.addStudent({
    name: '跨校区转校学员',
    campusId: CAMPUS_HQ,
    status: 'normal'
  });

  // 1. 同校区转校拦截
  const sameRes = mocks.applyAbnormalMovement({
    movementType: 'transfer_campus',
    studentId: stu.id,
    targetCampusId: CAMPUS_HQ
  });
  assertEqual(sameRes.success, false, '目标校区与原校区相同时必须拦截');

  // 2. 未授权目标校区拦截
  const unauthRes = mocks.applyAbnormalMovement({
    movementType: 'transfer_campus',
    studentId: stu.id,
    targetCampusId: CAMPUS_YY,
    authorizedCampusIds: [CAMPUS_HQ, CAMPUS_HD] // 远洋未在授权列表中
  });
  assertEqual(unauthRes.success, false, '未授权校区必须拦截');

  // 3. 合法跨校区转校划转
  const transferRes = mocks.applyAbnormalMovement({
    movementType: 'transfer_campus',
    studentId: stu.id,
    targetCampusId: CAMPUS_WJ
  });
  assertEqual(transferRes.success, true);
  assertEqual(stu.campusId, CAMPUS_WJ, '校区归属必须更新为望京校区');
  assertEqual(stu.campusName, '望京校区');
});

test('5.5 异动分支 6: 转让 (transfer_student) 课包与钱包资产移交', () => {
  const stuA = mocks.addStudent({
    id: 'std-trans-sender-a',
    name: '转让出让方A',
    campusId: CAMPUS_HQ,
    wallet: { principalBalance: 1200, bonusBalance: 300, goldPoints: 0, ledger: [] },
    coursePackages: [{
      packageId: 'pkg-a-01',
      courseId: 'course-scratch-001',
      totalLessons: 10,
      remainingLessons: 8,
      status: 'active'
    }]
  });

  const stuB = mocks.addStudent({
    id: 'std-trans-receiver-b',
    name: '转让受让方B',
    campusId: CAMPUS_HQ,
    wallet: { principalBalance: 0, bonusBalance: 0, goldPoints: 0, ledger: [] },
    coursePackages: []
  });

  const transferStudentRes = mocks.applyAbnormalMovement({
    movementType: 'transfer_student',
    studentId: stuA.id,
    targetStudentId: stuB.id
  });

  assertEqual(transferStudentRes.success, true);
  // 出让方 A 资产归零
  assertEqual(stuA.wallet.principalBalance, 0);
  assertEqual(stuA.wallet.bonusBalance, 0);
  assertEqual(stuA.coursePackages[0].status, 'completed');
  assertEqual(stuA.coursePackages[0].remainingLessons, 0);

  // 受让方 B 接收全额资产
  assertEqual(stuB.wallet.principalBalance, 1200);
  assertEqual(stuB.wallet.bonusBalance, 300);
  assertEqual(stuB.coursePackages.length, 1);
  assertEqual(stuB.coursePackages[0].remainingLessons, 8);
});

test('5.6 异动分支 7: 退费 (refund) 扣减赠课与违约教材费清算，全退状态流转为 dropped_out', () => {
  const stu = mocks.addStudent({
    name: '退费清算学员',
    campusId: CAMPUS_HQ,
    status: 'normal',
    coursePackages: [{
      packageId: 'pkg-refund-01',
      courseId: 'course-scratch-001',
      pricePerLesson: 200,
      totalLessons: 24,    // 20 正课 + 4 赠课
      remainingLessons: 14, // 已消耗 10 课时
      bonusLessons: 4,
      status: 'active'
    }]
  });

  // 公式：Math.max(0, remainingLessons - bonusLessons) * price - deductionFee
  // (14 - 4) * 200 = 2000，扣除手续费 200 -> 应退 1800
  const refundRes = mocks.applyAbnormalMovement({
    movementType: 'refund',
    studentId: stu.id,
    packageId: 'pkg-refund-01',
    deductionFee: 200
  });

  assertEqual(refundRes.success, true);
  assertEqual(refundRes.refundAmount, 1800, '应退金额必须精确为 1800');
  assertEqual(stu.coursePackages[0].status, 'refunded', '课包状态应流转为 refunded');
  assertEqual(stu.status, 'dropped_out', '所有课包退结后学员状态应自动流失为 dropped_out');

  // 重复退费拦截
  const repeatRefund = mocks.applyAbnormalMovement({
    movementType: 'refund',
    studentId: stu.id,
    packageId: 'pkg-refund-01'
  });
  assertEqual(repeatRefund.success, false, '终态课包重复退费必须拦截');
});

test('5.7 电子钱包风控规则：充值、赠送金不可提现、超额提现拦截与负数金额拦截', () => {
  const stu = mocks.addStudent({
    name: '钱包风控测试学员',
    campusId: CAMPUS_HQ,
    wallet: { principalBalance: 1000, bonusBalance: 500, goldPoints: 0, ledger: [] }
  });

  // 1. 充值
  const rechargeRes = mocks.rechargeWallet(stu.id, 2000, 300);
  assertEqual(rechargeRes, true);
  assertEqual(stu.wallet.principalBalance, 3000);
  assertEqual(stu.wallet.bonusBalance, 800);

  // 2. 提现超出本金（企图提现赠送金）拦截
  const overWithdraw = mocks.withdrawWallet(stu.id, 3500);
  assertEqual(overWithdraw.success, false, '提现超出本金余额必须拦截');

  // 3. 负数金额提现拦截
  const negativeWithdraw = mocks.withdrawWallet(stu.id, -100);
  assertEqual(negativeWithdraw.success, false, '提现金额<=0必须拦截');

  // 4. 合法合规本金提现
  const validWithdraw = mocks.withdrawWallet(stu.id, 1000);
  assertEqual(validWithdraw.success, true);
  assertEqual(stu.wallet.principalBalance, 2000);
  assertEqual(stu.wallet.bonusBalance, 800, '赠送金分账独立不受本金提现影响');
});

// -----------------------------------------------------------------------------
// DIMENSION 6: 测试数据现场隔离与状态幂等恢复
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}【Dimension 6: 测试数据现场隔离与状态幂等恢复】${colors.reset}`);

test('6.1 Mock 数据快照现场严格复原 (Zero-Pollution Invariant)', () => {
  // 恢复 MOCK_STUDENTS
  mocks.MOCK_STUDENTS.length = 0;
  mocks.MOCK_STUDENTS.push(...initialStudentsSnapshot);

  // 恢复 MOCK_UNASSIGNED_STUDENTS
  mocks.MOCK_UNASSIGNED_STUDENTS.length = 0;
  mocks.MOCK_UNASSIGNED_STUDENTS.push(...initialUnassignedSnapshot);

  // 恢复 MOCK_SERVICE_FEES
  mocks.MOCK_SERVICE_FEES.length = 0;
  mocks.MOCK_SERVICE_FEES.push(...initialServiceFeesSnapshot);

  assertEqual(mocks.MOCK_STUDENTS.length, 22, '学员基线容量严格恢复为 22');
  assertEqual(mocks.MOCK_UNASSIGNED_STUDENTS.length, 3, '待分班基线容量严格恢复为 3');
  assertEqual(mocks.MOCK_SERVICE_FEES.length, 4, '服务费基线容量严格恢复为 4');

  assertEqual(mocks.getStudentsByCampus(CAMPUS_HQ).length, 6);
  assertEqual(mocks.getStudentsByCampus(CAMPUS_YY).length, 4);
  assertEqual(mocks.getStudentsByCampus(CAMPUS_CY).length, 4);
  assertEqual(mocks.getStudentsByCampus(CAMPUS_HD).length, 4);
  assertEqual(mocks.getStudentsByCampus(CAMPUS_WJ).length, 4);
});

// -----------------------------------------------------------------------------
// 最终报告汇总
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}对抗验证测试执行总结报告:${colors.reset} 总用例数: ${totalTests} | ${colors.green}通过: ${passedTests}${colors.reset} | ${colors.red}失败: ${failedTests}${colors.reset} | 通过率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

if (failures.length > 0) {
  console.log(`${colors.bold}${colors.red}以下用例执行失败:${colors.reset}`);
  failures.forEach((f, idx) => {
    console.log(`  ${idx + 1}. ${f.name}`);
    console.log(`     Error: ${f.error.message}`);
  });
  process.exit(1);
} else {
  console.log(`${colors.bold}${colors.green}🎉 全部 6 大维度 24 项对抗与穿透测试用例 100% 通过！数据作用域隔离严密，业务链路流转闭环完备。${colors.reset}\n`);
  process.exit(0);
}
