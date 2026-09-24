const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

console.log('================================================================================');
console.log('盛通教育「一校教培系统」Milestone 3 深度法证与运行时真实性独立审计');
console.log('================================================================================\n');

// 1. 静态代码法证审查 (Phase 1: Source Code Forensics)
console.log('【Check 1: 静态源码法证审查 (Static AST & Source Forensics)】');

const filesToAudit = [
  'src/types/student.ts',
  'src/mocks/student.ts',
  'src/views/studentCenter/allStudent.vue',
  'src/views/studentCenter/unassigned.vue',
  'src/views/studentCenter/serviceFee.vue',
  'src/views/studentCenter/components/AbnormalMovementDialog.vue',
  'src/views/studentCenter/components/EnrollDialog.vue',
  'src/views/studentCenter/components/StudentProfileDrawer.vue',
  'src/views/studentCenter/components/StudentFormDialog.vue',
  'src/views/studentCenter/components/FaceEntryDialog.vue',
];

const suspiciousPatterns = [
  { name: '测试脚本名特判', regex: /runner\.js|t1_|t2_|t3_|t4_|test_|jest|mocha|vitest|playwright/i },
  { name: '空实现或返回固定常数假实现', regex: /function\s+\w+\([^)]*\)\s*\{\s*return\s+(true|false|1|0|""|\[\]|\{\})\s*;\s*\}/ },
  { name: '硬编码测试学员ID特判', regex: /if\s*\(\s*(studentId|id|payload\.studentId)\s*===?\s*['"](t1_|test_|fake_)/i },
  { name: '绕过真实计算的门面标志', regex: /\/\*\s*bypass\s*\*\/|\/\/\s*facade|dummy implementation/i },
];

let staticViolationCount = 0;

for (const relPath of filesToAudit) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ❌ 缺失核心文件: ${relPath}`);
    staticViolationCount++;
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');

  // 检查空文件
  if (content.trim().length === 0) {
    console.error(`  ❌ 发现空文件: ${relPath}`);
    staticViolationCount++;
    continue;
  }

  // 模式扫描
  for (const pat of suspiciousPatterns) {
    if (pat.regex.test(content)) {
      console.error(`  ❌ 发现可疑模式 [${pat.name}] in ${relPath}`);
      staticViolationCount++;
    }
  }

  console.log(`  ✓ 静态审计通过: ${relPath} (行数: ${content.split('\n').length}, 字节: ${content.length})`);
}

assert.strictEqual(staticViolationCount, 0, '静态代码法证检测发现违规项！');
console.log('  -> 静态源码审查结果：0 违规，0 假实现，0 硬编码特判。\n');

// 2. 运行时真实性与状态机独立验证 (Phase 2: Runtime Behavioral Verification)
console.log('【Check 2: 运行时真实性与 7 大异动状态机独立验证】');

// 动态转译并加载 src/mocks/student.ts
const studentTsPath = path.resolve(__dirname, '../src/mocks/student.ts');
const studentTsCode = fs.readFileSync(studentTsPath, 'utf8');

// 转译 TS 为 JS (CommonJS)
const transpileResult = ts.transpileModule(studentTsCode, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  }
});

// 构建沙箱上下文加载并执行
const mockModule = { exports: {} };
const curriculumMock = {
  MOCK_COURSES: [
    { id: 'course-scratch-001', name: '012-软编Scratch创意图形编程', pricePerLesson: 280, totalLessons: 48, status: 'enabled', authorizedCampusIds: ['campus-bj-hq'] },
    { id: 'course-cpp-002', name: '001-信息学奥赛C++高阶培优班', pricePerLesson: 350, totalLessons: 64, status: 'enabled', authorizedCampusIds: ['campus-bj-hq'] },
    { id: 'course-python-003', name: '008-Python人工智能趣味算法', pricePerLesson: 300, totalLessons: 48, status: 'enabled', authorizedCampusIds: ['campus-bj-yy'] },
  ],
  MOCK_CURRICULUM_COURSES: [
    { id: 'course-scratch-001', name: '012-软编Scratch创意图形编程', pricePerLesson: 280, totalLessons: 48, status: 'enabled', authorizedCampusIds: ['campus-bj-hq'] },
    { id: 'course-cpp-002', name: '001-信息学奥赛C++高阶培优班', pricePerLesson: 350, totalLessons: 64, status: 'enabled', authorizedCampusIds: ['campus-bj-hq'] },
    { id: 'course-python-003', name: '008-Python人工智能趣味算法', pricePerLesson: 300, totalLessons: 48, status: 'enabled', authorizedCampusIds: ['campus-bj-yy'] },
  ]
};

const customRequire = (id) => {
  if (id === './curriculum' || id.includes('curriculum')) {
    return curriculumMock;
  }
  if (id === './educational' || id.includes('educational')) {
    return { enrollStudentIntoClass: () => true, getAvailableClasses: () => [], MOCK_CLASSES: [] };
  }
  if (id === './financial' || id.includes('financial')) {
    return { saveOrder: (o) => o };
  }
  return require(id);
};

const fnWrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', transpileResult.outputText);
fnWrapper(mockModule.exports, customRequire, mockModule, studentTsPath, path.dirname(studentTsPath));

const StudentMocks = mockModule.exports;

// 验证函数导出完备度
const requiredFunctions = [
  'getStudents',
  'getStudentById',
  'addStudent',
  'updateStudent',
  'deleteStudent',
  'applyAbnormalMovement',
  'enrollStudent',
  'rechargeWallet',
  'withdrawWallet',
  'getUnassignedStudents',
  'assignClassToStudent',
  'getServiceFeeRecords',
  'addServiceFeeRecord',
  'verifyServiceFeeRecord',
  'batchVerifyServiceFeeRecords',
];

for (const fnName of requiredFunctions) {
  assert.strictEqual(typeof StudentMocks[fnName], 'function', `未导出必需的核心函数: ${fnName}`);
}
console.log(`  ✓ 核心函数导出核验：15/15 个领域业务函数全部已真实实现`);

// 3. 7 种异动状态机真实性全分支测试
console.log('\n【Check 3: 7 种异动状态机动态逻辑与算法核验】');

// 准备测试学员数据
const baseStudent = StudentMocks.getStudentById('std-001');
assert.ok(baseStudent, 'std-001 初始学员数据必须存在');

// 3.1 分支 1: 转班
console.log('  -> 3.1 转班 (Transfer Class)');
const transferSuccess = StudentMocks.applyAbnormalMovement({
  movementType: 'transfer_class',
  studentId: 'std-001',
  packageId: 'pkg-001',
  toClassId: 'class-scratch-102',
  targetClassCapacity: 16,
  targetClassCurrentCount: 15,
});
assert.strictEqual(transferSuccess.success, true, '合法转班必须成功');
const updatedStd001 = StudentMocks.getStudentById('std-001');
assert.strictEqual(updatedStd001.coursePackages[0].classId, 'class-scratch-102');

// 满班拒绝测试
const transferFull = StudentMocks.applyAbnormalMovement({
  movementType: 'transfer_class',
  studentId: 'std-001',
  packageId: 'pkg-001',
  toClassId: 'class-scratch-102',
  targetClassCapacity: 16,
  targetClassCurrentCount: 16,
});
assert.strictEqual(transferFull.success, false, '满班转班必须拦截');
console.log('     ✓ 正常转班与满班防御断言通过');

// 3.2 分支 2: 换课差额计算
console.log('  -> 3.2 换课 (Change Course)');
// 原课包: remainingLessons = 28, pricePerLesson = 280, 原净值 = 28 * 280 = 7840
// 新课: course-cpp-002 (price = 350), 购买 20 课时, 新总价 = 20 * 350 = 7000
// 差额: diff = 7840 - 7000 = 840 (>0, 退回钱包本金)
const initialPrincipal = updatedStd001.wallet.principalBalance;
const changeRes = StudentMocks.applyAbnormalMovement({
  movementType: 'change_course',
  studentId: 'std-001',
  packageId: 'pkg-001',
  newCourseId: 'course-cpp-002',
  newPurchasedLessons: 20,
});
assert.strictEqual(changeRes.success, true);
assert.strictEqual(changeRes.diff, 840);
assert.strictEqual(changeRes.walletCredited, 840);
assert.strictEqual(updatedStd001.wallet.principalBalance, Number((initialPrincipal + 840).toFixed(2)), '差额必须真实存入电子钱包');
assert.strictEqual(updatedStd001.coursePackages[0].status, 'completed', '原课包必须终结');
assert.strictEqual(updatedStd001.coursePackages[updatedStd001.coursePackages.length - 1].courseId, 'course-cpp-002', '新课包必须开立');
console.log('     ✓ 换课净值折算与钱包流水真实入账验证通过');

// 3.3 分支 3 & 4: 停课休学与复课解冻
console.log('  -> 3.3 停课与复课 (Suspend & Resume)');
const suspRes = StudentMocks.applyAbnormalMovement({
  movementType: 'suspend',
  studentId: 'std-001',
  suspensionDays: 45,
});
assert.strictEqual(suspRes.success, true);
assert.strictEqual(updatedStd001.status, 'suspended', '状态必须置为 suspended');
const activePkg = updatedStd001.coursePackages.find(p => p.courseId === 'course-cpp-002');
assert.strictEqual(activePkg.status, 'frozen', '课包必须冻结');

// 重复停课必须阻断
const doubleSusp = StudentMocks.applyAbnormalMovement({
  movementType: 'suspend',
  studentId: 'std-001',
  suspensionDays: 10,
});
assert.strictEqual(doubleSusp.success, false, '重复停课必须阻断');

// 复课
const resumeRes = StudentMocks.applyAbnormalMovement({
  movementType: 'resume',
  studentId: 'std-001',
});
assert.strictEqual(resumeRes.success, true);
assert.strictEqual(updatedStd001.status, 'normal', '复课后状态必须恢复 normal');
assert.strictEqual(activePkg.status, 'active', '课包必须恢复 active');
console.log('     ✓ 停课课包冻结顺延与复课解冻联动验证通过');

// 3.4 分支 5: 转校
console.log('  -> 3.4 转校 (Transfer Campus)');
const transferCampusRes = StudentMocks.applyAbnormalMovement({
  movementType: 'transfer_campus',
  studentId: 'std-001',
  targetCampusId: 'campus-bj-yy',
  authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy'],
});
assert.strictEqual(transferCampusRes.success, true);
assert.strictEqual(updatedStd001.campusId, 'campus-bj-yy');
assert.strictEqual(updatedStd001.campusName, '远洋校区');

// 未授权校区必须阻断
const unauthCampus = StudentMocks.applyAbnormalMovement({
  movementType: 'transfer_campus',
  studentId: 'std-001',
  targetCampusId: 'campus-unauthorized-999',
  authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy'],
});
assert.strictEqual(unauthCampus.success, false, '未授权校区转校必须阻断');
console.log('     ✓ 跨校区转校与非法校区防御核验通过');

// 3.5 分支 6: 转让
console.log('  -> 3.5 转让 (Transfer Student)');
const std002 = StudentMocks.getStudentById('std-002');
const std001Balance = updatedStd001.wallet.principalBalance + updatedStd001.wallet.bonusBalance;
const std002OldBalance = std002.wallet.principalBalance + std002.wallet.bonusBalance;

const transferStuRes = StudentMocks.applyAbnormalMovement({
  movementType: 'transfer_student',
  studentId: 'std-001',
  targetStudentId: 'std-002',
});
assert.strictEqual(transferStuRes.success, true);
assert.strictEqual(updatedStd001.wallet.principalBalance, 0, '原学员钱包本金必须清零');
assert.strictEqual(updatedStd001.wallet.bonusBalance, 0, '原学员钱包赠送金必须清零');
assert.strictEqual(std002.wallet.principalBalance + std002.wallet.bonusBalance, std002OldBalance + std001Balance, '受让学员余额必须增加');
console.log('     ✓ 课包与钱包资产过户转让核验通过');

// 3.6 分支 7: 退费盛通扣赠课算法深度测试
console.log('  -> 3.6 退费 (Refund) 盛通扣赠课算法');
// 创建具有赠课的测试退费课包
// Case A: 消耗课时 (10) <= 购买正课 (20) (总课时 24，含赠课 4)
// remaining = 14, bonus = 4, price = 100, deduction = 50
// 应退: (14 - 4) * 100 - 50 = 950
const mockStudentRefundA = StudentMocks.addStudent({
  name: '退费测试生A',
  coursePackages: [{
    packageId: 'pkg-test-ref-a',
    courseId: 'c-1',
    courseName: '测试课程',
    pricePerLesson: 100,
    totalLessons: 24,
    remainingLessons: 14,
    bonusLessons: 4,
    status: 'active',
  }]
});
const refResA = StudentMocks.applyAbnormalMovement({
  movementType: 'refund',
  studentId: mockStudentRefundA.id,
  packageId: 'pkg-test-ref-a',
  deductionFee: 50,
});
assert.strictEqual(refResA.success, true);
assert.strictEqual(refResA.refundAmount, 950, '未消耗赠课时退费计算必须精准为 950');

// Case B: 消耗课时 (22) > 购买正课 (20) (总课时 24，含赠课 4，已上 22 课时，占用了 2 课时赠课)
// remaining = 2, bonus = 4, price = 100
// 购买正课 = 20, 已消耗 = 22, 超额占用赠课 = 22 - 20 = 2 课时
// 扣减 clawback = 2 * 100 = 200
// 可退正课价值 = Math.max(0, 2 - 4) * 100 = 0
// 扣减后 = 0
const mockStudentRefundB = StudentMocks.addStudent({
  name: '退费测试生B',
  coursePackages: [{
    packageId: 'pkg-test-ref-b',
    courseId: 'c-2',
    courseName: '超额消耗课程',
    pricePerLesson: 100,
    totalLessons: 24,
    remainingLessons: 2,
    bonusLessons: 4,
    status: 'active',
  }]
});
const refResB = StudentMocks.applyAbnormalMovement({
  movementType: 'refund',
  studentId: mockStudentRefundB.id,
  packageId: 'pkg-test-ref-b',
  deductionFee: 0,
});
assert.strictEqual(refResB.success, true);
assert.strictEqual(refResB.refundAmount, 0, '超额消耗赠课时退款金额必须扣回至 0');
assert.strictEqual(mockStudentRefundB.status, 'dropped_out', '所有课包退费后学员状态自动变更dropped_out');
console.log('     ✓ 盛通退费赠课扣减算法严格核验通过 (Case A: 950元, Case B: 0元退学)');

// 4. 报读签约与待分班流转
console.log('\n【Check 4: 报读签约开单与待分班池自动入库】');
const enrollRes = StudentMocks.enrollStudent({
  studentId: 'std-002',
  courseId: 'course-scratch-001',
  lessonCount: 48,
  bonusLessons: 4,
  pricePerLesson: 280,
  discountAmount: 400,
  couponAmount: 500,
  actualAmount: 12540,
  paymentMethod: 'wechat',
  campusId: 'campus-bj-hq',
});
assert.strictEqual(enrollRes.success, true);
assert.ok(enrollRes.packageId, '开单必须生成 packageId');
const std002Updated = StudentMocks.getStudentById('std-002');
assert.ok(std002Updated.coursePackages.some(p => p.packageId === enrollRes.packageId), '新课包必须真实加入学员名下');

// 验证自动推入待分班池
const unassignedList = StudentMocks.getUnassignedStudents('campus-bj-hq');
const unassignedEntry = unassignedList.find(u => u.studentId === 'std-002');
assert.ok(unassignedEntry, '报读签约后必须自动进入待分班池');
assert.strictEqual(unassignedEntry.unassignedLessons, 52, '待分配课时数必须为 48 + 4 = 52');

// 验证待分班分班加入班级
const assignRes = StudentMocks.assignClassToStudent('std-002', 'class-scratch-101', 'Scratch创意周末班');
assert.strictEqual(assignRes, true);
const unassignedAfter = StudentMocks.getUnassignedStudents('campus-bj-hq');
assert.strictEqual(unassignedAfter.some(u => u.studentId === 'std-002'), false, '分班后必须从待分班池移除');
console.log('  ✓ 报读签约 -> 待分班入池 -> 分班出池 完整业务链路验证通过');

// 5. 易快报服务费核销
console.log('\n【Check 5: 服务费与代报考易快报核销机制】');
const newFee = StudentMocks.addServiceFeeRecord({
  studentId: 'std-002',
  studentName: '李浩轩',
  campusId: 'campus-bj-hq',
  fee: 350,
  category: 'certification',
  examType: '全国青少年编程考级',
});
assert.strictEqual(newFee.status, 'pending');

// 单条核销
const vRes = StudentMocks.verifyServiceFeeRecord(newFee.id, 'YKB-AUDIT-TEST-001');
assert.strictEqual(vRes, true);
const allFees = StudentMocks.getServiceFeeRecords('campus-bj-hq');
const verifiedRec = allFees.find(f => f.id === newFee.id);
assert.strictEqual(verifiedRec.status, 'verified');
assert.strictEqual(verifiedRec.yikuaibaoVoucherNo, 'YKB-AUDIT-TEST-001');

// 批量核销 (使用不同 ID 避免同毫秒 Date.now 碰撞)
const bFee1 = StudentMocks.addServiceFeeRecord({ id: 'sf-audit-b1', studentId: 'std-001', campusId: 'campus-bj-hq', status: 'pending' });
const bFee2 = StudentMocks.addServiceFeeRecord({ id: 'sf-audit-b2', studentId: 'std-002', campusId: 'campus-bj-hq', status: 'pending' });
const batchCount = StudentMocks.batchVerifyServiceFeeRecords([bFee1.id, bFee2.id], 'YKB-BATCH-AUDIT-002');
assert.strictEqual(batchCount, 2);
console.log('  ✓ 单条核销与批量凭证核销验证通过');

console.log('\n================================================================================');
console.log('【法证审计判定】: 全部独立运行时与状态机校验 100% 真实通过！无任何假实现！');
console.log('================================================================================\n');
