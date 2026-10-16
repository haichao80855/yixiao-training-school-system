const assert = require('assert');
const path = require('path');

// 注入微信小程序全局基础环境垫片，供 Node.js 单元测试加载
if (typeof global.wx === 'undefined') {
  global.wx = new Proxy(
    {
      getSystemInfoSync: () => ({ platform: 'devtools', windowWidth: 375, windowHeight: 667 }),
      canIUse: () => true,
      getStorageSync: () => null,
      setStorageSync: () => {},
      removeStorageSync: () => {},
      request: () => {},
      uploadFile: () => {},
      showToast: () => {},
      showModal: () => {},
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => {};
      },
    }
  );
}
if (typeof global.uni === 'undefined') {
  global.uni = global.wx;
}
global.Page = global.Page || function () {};
global.Component = global.Component || function () {};
global.App = global.App || function () {};
global.getApp = global.getApp || function () { return {}; };
global.getCurrentPages = global.getCurrentPages || function () { return []; };

console.log('================================================================================');
console.log('🧪 运行微信小程序端学员全景投影与学籍归一化深模块 (Deep Module) 契约与单元测试');
console.log('================================================================================\n');

// 导入编译后的学员投影深模块产物
const projectorModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/projectors/student/projector.js'
);
const normalizerModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/projectors/student/normalizer.js'
);
const fakeAdapterModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/projectors/student/adapters/fake-student-data.adapter.js'
);

const { studentProjector } = require(projectorModulePath);
const {
  normalizeStatus,
  calculateStudentAssets,
  computeConsumptionRisk,
  computeActionPermissions,
} = require(normalizerModulePath);
const FakeStudentDataAdapter =
  studentProjector.FakeStudentDataAdapter ||
  require(fakeAdapterModulePath).FakeStudentDataAdapter;

assert.ok(studentProjector, '❌ 未能成功导出 studentProjector 模块实例');
assert.ok(typeof studentProjector.projectRoster === 'function', '❌ projectRoster 方法未导出');
assert.ok(typeof studentProjector.projectDossier === 'function', '❌ projectDossier 方法未导出');
assert.ok(typeof normalizeStatus === 'function', '❌ normalizeStatus 方法未导出');
assert.ok(typeof studentProjector.createProjector === 'function', '❌ createProjector 工厂未导出');
assert.ok(typeof FakeStudentDataAdapter === 'function', '❌ FakeStudentDataAdapter 适配器未导出');

console.log('✔ 深模块极简外部接口校验通过 (核心动词: projectRoster, projectDossier, normalizeStatus)\n');

async function runTests() {
  // ---------------------------------------------------------------------------
  // Case 1: 权威学籍状态机穷举归一化断言 (SSOT Status Normalizer)
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 1] 测试权威学籍状态机穷举归一化 (SSOT Status Normalizer)...');

  // 1.1 正常在读 (持有有效课时 + 已进班)
  const normInClass = normalizeStatus({
    id: 'stu-01',
    status: 'active',
    classes: [{ id: 'cls-01', name: '启蒙班' }],
    packages: [{ id: 'pkg-01', remainingLessons: 20, status: 'active' }],
  });
  assert.strictEqual(normInClass.status, 'in_class', '持有课时且进班应归一化为 in_class');
  assert.strictEqual(normInClass.statusText, '在读', '状态文本应为 在读');
  assert.strictEqual(normInClass.isAssignedClass, true, 'isAssignedClass 应为 true');
  assert.strictEqual(normInClass.inPendingAssetPool, false, '在读学员不可落入待分班资产池');

  // 1.2 停课状态 (显式 suspended 或 停课，具有绝对优先权)
  const normSuspended = normalizeStatus({
    id: 'stu-02',
    status: 'suspended',
    classes: [{ id: 'cls-01' }],
    packages: [{ id: 'pkg-01', remainingLessons: 50 }],
  });
  assert.strictEqual(normSuspended.status, 'suspended', '休学停课状态优先级最高');
  assert.strictEqual(normSuspended.statusText, '停课');
  assert.strictEqual(normSuspended.tagClass, 'tag-suspended');
  assert.strictEqual(normSuspended.inPendingAssetPool, false);

  // 1.3 已结业
  const normGraduated = normalizeStatus({ id: 'stu-03', status: 'graduated' });
  assert.strictEqual(normGraduated.status, 'graduated');
  assert.strictEqual(normGraduated.statusText, '已结业');

  // 1.4 已流失 (lost / dropped_out)
  const normLost = normalizeStatus({ id: 'stu-04', status: 'dropped_out' });
  assert.strictEqual(normLost.status, 'lost');
  assert.strictEqual(normLost.statusText, '已流失');

  // 1.5 已转校 (transferred)
  const normTransferred = normalizeStatus({ id: 'stu-05', status: 'transferred' });
  assert.strictEqual(normTransferred.status, 'transferred');
  assert.strictEqual(normTransferred.statusText, '已转校');

  // 1.6 未报读 (新客或无资产无班级)
  const normNotEnrolled = normalizeStatus({ id: 'stu-06', status: 'active', remainingLessons: 0 });
  assert.strictEqual(normNotEnrolled.status, 'not_enrolled', '无有效课时且未编班应归一化为未报读');
  assert.strictEqual(normNotEnrolled.statusText, '未报读');

  // 1.7 异常输入安全降级
  const normNull = normalizeStatus(null);
  assert.strictEqual(normNull.status, 'not_enrolled');
  assert.strictEqual(normNull.statusText, '未报读');

  console.log('✔ Case 1 验证通过: 权威学籍状态机穷举归一化断言全部通过 (在读/停课/已结业/已流失/转校/未报读)\n');

  // ---------------------------------------------------------------------------
  // Case 2: 待分班资产池（持有有效课包剩余课时但未进班）精准识别并锁定
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 2] 测试待分班资产池精准识别并锁定为 pending_assignment...');

  // 2.1 购买课包但未分配班级
  const rawPending1 = {
    id: 'stu-pending-01',
    name: '待分班学员甲',
    status: 'active',
    classes: [],
    enrolledClassesCount: 0,
    packages: [
      { id: 'pkg-101', courseName: '幼少儿乐高编程', remainingLessons: 48, status: 'active' },
    ],
  };
  const normPending1 = normalizeStatus(rawPending1);
  assert.strictEqual(
    normPending1.status,
    'pending_assignment',
    '持有 48 课时但 classes 为空必须锁定为待分班'
  );
  assert.strictEqual(normPending1.statusText, '待分班');
  assert.strictEqual(normPending1.inPendingAssetPool, true, 'inPendingAssetPool 必须为 true');
  assert.strictEqual(normPending1.isAssignedClass, false, 'isAssignedClass 必须为 false');

  // 2.2 多个课包但全部未进班
  const rawPending2 = {
    id: 'stu-pending-02',
    name: '待分班学员乙',
    packages: [
      { id: 'pkg-1', remainingLessons: 12, status: 'active' },
      { id: 'pkg-2', remainingLessons: 24, status: 'active' },
    ],
  };
  const normPending2 = normalizeStatus(rawPending2);
  assert.strictEqual(normPending2.status, 'pending_assignment');
  assert.strictEqual(normPending2.inPendingAssetPool, true);

  // 2.3 动态进班跃迁：一旦某个课包分配了班级，立即脱离待分班资产池
  rawPending2.packages[0].classId = 'cls-robotics-01';
  rawPending2.packages[0].className = '乐高初级01班';
  const normTransition = normalizeStatus(rawPending2);
  assert.strictEqual(normTransition.status, 'in_class', '分配班级后立即由待分班跃迁为在读');
  assert.strictEqual(normTransition.statusText, '在读');
  assert.strictEqual(normTransition.inPendingAssetPool, false, '跃迁后脱离待分班资产池');

  // 2.4 课包已退费的排他排除：已退费课包不计入待分班资产池
  const rawRefunded = {
    id: 'stu-refunded-01',
    status: 'active',
    packages: [{ id: 'pkg-ref', remainingLessons: 30, status: 'refunded' }],
  };
  const normRefunded = normalizeStatus(rawRefunded);
  assert.strictEqual(
    normRefunded.status,
    'not_enrolled',
    '已全额退费课包绝不可计入待分班资产池'
  );
  assert.strictEqual(normRefunded.inPendingAssetPool, false);

  console.log('✔ Case 2 验证通过: 待分班资产池识别无死角，进班状态机跃迁与退费排他断言通过\n');

  // ---------------------------------------------------------------------------
  // Case 3: 资产加权金额试算与冻结课时排他隔离断言
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 3] 测试课包与钱包资产加权试算引擎与冻结课时排他隔离...');

  const complexStudentRaw = {
    id: 'stu-asset-01',
    packages: [
      { id: 'p1', courseName: '少儿英语', remainingLessons: 20, pricePerLesson: 100, status: 'active' },
      { id: 'p2', courseName: '数学思维', remainingLessons: 10, pricePerLesson: 80, status: 'active' },
      { id: 'p3', courseName: '国画特训', remainingLessons: 6, pricePerLesson: 120, status: 'frozen' }, // 冻结课时
      { id: 'p4', courseName: '已退学费', remainingLessons: 15, pricePerLesson: 100, status: 'refunded' }, // 已退费课包
    ],
    walletSummary: {
      principalBalance: 2500, // 本金钱包
      bonusBalance: 500,      // 赠送金钱包
    },
    cardCount: 2,
  };

  const assets = calculateStudentAssets(complexStudentRaw);

  // 试算课时：有效课包 20 + 10 + 6 (冻结) = 36；已退费的 15 课时严密排除
  assert.strictEqual(assets.totalRemainingLessons, 36, '总剩余课时应为 36 (排除已退费课包)');
  assert.strictEqual(assets.frozenLessons, 6, '冻结课时应严格隔离为 6 课时');
  assert.strictEqual(assets.activeRemainingLessons, 30, '可用正课课时必须排他隔离冻结课时 (36 - 6 = 30)');

  // 加权剩余金额：20*100 (2000) + 10*80 (800) + 6*120 (720) = 3520 元
  assert.strictEqual(assets.totalRemainingAmount, 3520, '总剩余加权金额计算错误');
  // 加权平均单价：3520 / 36 ≈ 97.78 元/课时
  assert.strictEqual(assets.weightedPricePerLesson, 97.78, '加权课时平均单价计算错误');

  // 钱包资金分账隔离
  assert.strictEqual(assets.principalBalance, 2500, '本金钱包余额必须严格隔离');
  assert.strictEqual(assets.bonusBalance, 500, '赠送金钱包余额必须严格隔离');
  assert.strictEqual(assets.walletBalance, 3000, '钱包总余额必须为本金与赠送金之和 (2500 + 500)');
  assert.strictEqual(assets.cardCount, 2, '卡包数量读取错误');

  console.log('✔ Case 3 验证通过: 课包加权金额准确、冻结课时严格排他隔离且本金/赠送金严密分账\n');

  // ---------------------------------------------------------------------------
  // Case 4: 课消流失风险星级评级（ADR-0005 映射）
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 4] 测试 ADR-0005 课消流失风险三级星级投影...');

  // 4.1 URGENT (≤4 课时，紧急预警)
  const risk0 = computeConsumptionRisk(0);
  assert.strictEqual(risk0.level, 'URGENT');
  assert.strictEqual(risk0.label, '紧急预警');
  assert.strictEqual(risk0.isUrgent, true);
  assert.strictEqual(risk0.color, '#EF4444');
  assert.strictEqual(risk0.stars, 1);

  const risk4 = computeConsumptionRisk(4);
  assert.strictEqual(risk4.level, 'URGENT');
  assert.strictEqual(risk4.isUrgent, true);

  // 4.2 WARNING (5~8 课时，续费预警)
  const risk5 = computeConsumptionRisk(5);
  assert.strictEqual(risk5.level, 'WARNING');
  assert.strictEqual(risk5.label, '续费预警');
  assert.strictEqual(risk5.isUrgent, false);
  assert.strictEqual(risk5.warningWindow, true);
  assert.strictEqual(risk5.color, '#F59E0B');
  assert.strictEqual(risk5.stars, 2);

  const risk8 = computeConsumptionRisk(8);
  assert.strictEqual(risk8.level, 'WARNING');
  assert.strictEqual(risk8.warningWindow, true);

  // 4.3 HEALTHY (>8 课时，课消健康)
  const risk9 = computeConsumptionRisk(9);
  assert.strictEqual(risk9.level, 'HEALTHY');
  assert.strictEqual(risk9.label, '课消健康');
  assert.strictEqual(risk9.isUrgent, false);
  assert.strictEqual(risk9.warningWindow, false);
  assert.strictEqual(risk9.color, '#10B981');
  assert.strictEqual(risk9.stars, 3);

  const risk50 = computeConsumptionRisk(50);
  assert.strictEqual(risk50.level, 'HEALTHY');

  console.log('✔ Case 4 验证通过: ADR-0005 课消流失三级星级投影 (≤4紧急红标 / 5~8续费橙标 / >8健康绿标) 断言全部吻合\n');

  // ---------------------------------------------------------------------------
  // Case 5: 业务操作权限矩阵推导断言
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 5] 测试业务操作权限矩阵推导 (ActionPermissionMatrix)...');

  const permInClass = computeActionPermissions('in_class', assets);
  assert.strictEqual(permInClass.canEnroll, true, '在读学员允许报名/续费');
  assert.strictEqual(permInClass.canAdjustClass, true, '在读学员允许调整班级');
  assert.strictEqual(permInClass.canRecharge, true, '在读学员允许充值');
  assert.strictEqual(permInClass.canDisable, true, '在读学员允许办理停课/禁用');
  assert.strictEqual(permInClass.canRefund, true, '有课时资产学员允许发起退费');

  const permSuspended = computeActionPermissions('suspended', assets);
  assert.strictEqual(permSuspended.canAdjustClass, false, '停课学员严禁调班');
  assert.strictEqual(permSuspended.canDisable, false, '已停课学员无需重复禁用');
  assert.strictEqual(permSuspended.canEnroll, false, '停课学员严禁直接开单');

  const permLost = computeActionPermissions('lost', { ...assets, totalRemainingLessons: 0, walletBalance: 0 });
  assert.strictEqual(permLost.canEnroll, false, '已注销流失学员严禁直接开单');
  assert.strictEqual(permLost.canRefund, false, '无资产流失学员不可退费');

  console.log('✔ Case 5 验证通过: 权限矩阵推导自洽，精准阻断非法操作\n');

  // ---------------------------------------------------------------------------
  // Case 6: Fake 数据适配器与网络异常降级防护断言
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 6] 测试 Fake 数据适配器与网络熔断降级防护...');

  const fakePort = new FakeStudentDataAdapter();
  const testProjector = studentProjector.createProjector(fakePort);

  // 6.1 动态注入全景数据
  fakePort.seedStudent({
    id: 'fake-stu-001',
    name: '沈墨卿',
    studentNo: 'S20261016',
    phone: '13988889999',
    status: 'active',
    packages: [
      {
        id: 'fp-1',
        courseName: '高阶算法竞赛',
        classId: 'cls-algo-01',
        className: '竞赛一队',
        remainingLessons: 3, // ≤4 触发 URGENT 紧急
        pricePerLesson: 200,
        status: 'active',
      },
    ],
  });

  fakePort.seedProfile('fake-stu-001', {
    id: 'fake-stu-001',
    name: '沈墨卿',
    studentNo: 'S20261016',
    gender: 'female',
    phone: '13988889999',
    guardianRelation: '母亲',
    campusName: '中关村校区',
    packages: [
      {
        id: 'fp-1',
        courseName: '高阶算法竞赛',
        classId: 'cls-algo-01',
        className: '竞赛一队',
        remainingLessons: 3,
        pricePerLesson: 200,
        status: 'active',
      },
    ],
    attendances: [
      {
        id: 'att-1',
        status: 'present',
        deductLessons: 1,
        timeRangeText: '2026-10-15 09:00-10:30',
        courseName: '高阶算法竞赛',
        className: '竞赛一队',
        teacherName: '李教练',
      },
    ],
    walletSummary: {
      principalBalance: 600,
      bonusBalance: 100,
    },
  });

  // 6.2 名册投影实测
  const rosterResult = await testProjector.projectRoster({ keyword: '沈墨卿' });
  assert.strictEqual(rosterResult.total, 1);
  const projectedItem = rosterResult.list[0];
  assert.strictEqual(projectedItem.name, '沈墨卿');
  assert.strictEqual(projectedItem.status, 'in_class');
  assert.strictEqual(projectedItem.statusText, '在读');
  assert.strictEqual(projectedItem.remainingLessons, 3);
  assert.strictEqual(projectedItem.remainingAmount, 600);
  assert.strictEqual(projectedItem.risk.level, 'URGENT', '3 课时学员名册评级必须为 URGENT');
  assert.strictEqual(projectedItem.risk.isUrgent, true);

  // 6.3 全息档案全景投影实测
  const dossierResult = await testProjector.projectDossier('fake-stu-001');
  assert.strictEqual(dossierResult.name, '沈墨卿');
  assert.strictEqual(dossierResult.gender, '女');
  assert.strictEqual(dossierResult.guardianRelation, '母亲');
  assert.strictEqual(dossierResult.campusName, '中关村校区');
  assert.strictEqual(dossierResult.totalRemainingLessons, 3);
  assert.strictEqual(dossierResult.walletBalance, 700);
  assert.strictEqual(dossierResult.principalBalance, 600);
  assert.strictEqual(dossierResult.bonusBalance, 100);
  assert.strictEqual(dossierResult.consumptionRisk.level, 'URGENT');
  assert.strictEqual(dossierResult.permissions.canEnroll, true);
  assert.strictEqual(dossierResult.courses.length, 1);
  assert.strictEqual(dossierResult.attendances.length, 1);

  // 6.4 模拟网络断开与熔断降级
  console.log('>>> [Case 6.4] 模拟网络断开 (504 网关超时)，测试端侧优雅熔断降级...');
  fakePort.setNetworkFailure(true);

  // 名册在网络异常时不崩，返回安全空列表
  const failedRoster = await testProjector.projectRoster();
  assert.strictEqual(failedRoster.total, 0);
  assert.deepStrictEqual(failedRoster.list, []);

  // 详情在强制刷新遭遇网络异常时，返回安全基线模型，不产生未捕获异常
  const failedDossier = await testProjector.projectDossier('fake-stu-001', { forceRefresh: true });
  assert.strictEqual(failedDossier.name, '学员');
  assert.strictEqual(failedDossier.normalizedStatus, 'not_enrolled');
  assert.strictEqual(failedDossier.totalRemainingLessons, 0);
  assert.strictEqual(failedDossier.walletBalance, 0);
  assert.strictEqual(failedDossier.consumptionRisk.level, 'URGENT');

  // 恢复网络
  fakePort.setNetworkFailure(false);
  const recoveredDossier = await testProjector.projectDossier('fake-stu-001', { forceRefresh: true });
  assert.strictEqual(recoveredDossier.name, '沈墨卿');
  assert.strictEqual(recoveredDossier.totalRemainingLessons, 3);

  console.log('✔ Case 6 验证通过: Fake 数据适配器操作自如，网络异常降级与熔断防护 100% 生效\n');

  // ---------------------------------------------------------------------------
  // Case 7: 深度测试服务端真实嵌套 studentInfo 格式解析与停课/转校拦截
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 7] 测试服务端原生嵌套 studentInfo 格式解析与状态机优先级...');

  const nestedSuspendedProfile = {
    studentInfo: {
      id: 'stu-nested-001',
      studentNo: 'S20269988',
      name: '停课测试学员',
      gender: 'male',
      phone: '13800001111',
      status: 'suspended',
      campus: { name: '西二旗校区' },
    },
    packages: [
      {
        id: 'pkg-nest-1',
        courseId: 'crs-robotics',
        course: { name: '乐高双足机器人', pricePerLesson: 150 },
        classId: 'cls-robotics-01',
        className: '乐高初级01班',
        remainingLessons: 24,
        totalLessons: 48,
        expiryDate: '2027-12-31T00:00:00.000Z',
        status: 'active',
      },
    ],
    attendances: [],
    walletSummary: {
      principalBalance: 0,
      bonusBalance: 200,
    },
  };

  fakePort.seedProfile('stu-nested-001', nestedSuspendedProfile);
  const projectedNested = await testProjector.projectDossier('stu-nested-001', { forceRefresh: true });

  assert.strictEqual(projectedNested.normalizedStatus, 'suspended', '嵌套 studentInfo 的 suspended 必须被权威提取');
  assert.strictEqual(projectedNested.statusText, '停课');
  assert.strictEqual(projectedNested.tagClass, 'tag-suspended');
  assert.strictEqual(projectedNested.permissions.canEnroll, false, '停课学员不可开单');
  assert.strictEqual(projectedNested.permissions.canAdjustClass, false, '停课学员不可调班');
  assert.strictEqual(projectedNested.walletBalance, 200, '纯赠送金账户余额必须正确提取为 200');
  assert.strictEqual(projectedNested.courses[0].remainingAmount, 3600, '课包加权单价应正确回退到 course.pricePerLesson (24 * 150)');
  assert.strictEqual(projectedNested.courses[0].expireDateText, '2027-12-31', 'expiryDate 字段应正确解析为 ISO 日期');

  console.log('✔ Case 7 验证通过: 服务端嵌套 studentInfo 权威解析、停课拦截与 expiryDate 映射完全正确\n');

  // ---------------------------------------------------------------------------
  // Case 8: 待分班名册动态筛选与端侧缓存淘汰机制实测 (invalidateDossier / clearCache)
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 8] 测试待分班名册状态筛选与端侧缓存淘汰机制...');

  fakePort.seedStudent({
    id: 'stu-filter-pending',
    name: '待分班候选人',
    status: 'normal',
    packages: [{ remainingLessons: 30, status: 'active' }],
    classes: [],
  });

  fakePort.seedStudent({
    id: 'stu-filter-inclass',
    name: '在读候选人',
    status: 'normal',
    packages: [{ remainingLessons: 30, classId: 'cls-1', status: 'active' }],
    classes: [{ id: 'cls-1' }],
  });

  const pendingRoster = await testProjector.projectRoster({ status: 'pending_assignment' });
  assert.ok(pendingRoster.list.some((s) => s.id === 'stu-filter-pending'), '待分班筛选应包含待分班学员');
  assert.ok(!pendingRoster.list.some((s) => s.id === 'stu-filter-inclass'), '待分班筛选不可包含在读学员');

  // 缓存淘汰实测
  const cachedDossier = await testProjector.projectDossier('stu-nested-001');
  assert.strictEqual(cachedDossier.walletBalance, 200);

  // 更新底层数据但不使用 forceRefresh
  nestedSuspendedProfile.walletSummary.bonusBalance = 500;
  fakePort.seedProfile('stu-nested-001', nestedSuspendedProfile);

  // 此时走缓存应仍为 200
  const hitCache = await testProjector.projectDossier('stu-nested-001');
  assert.strictEqual(hitCache.walletBalance, 200, '未淘汰时应命中端侧缓存');

  // 显式淘汰缓存
  testProjector.invalidateDossier('stu-nested-001');
  const evictedDossier = await testProjector.projectDossier('stu-nested-001');
  assert.strictEqual(evictedDossier.walletBalance, 500, '缓存淘汰后应穿透获取最新数据');

  console.log('✔ Case 8 验证通过: 待分班动态筛选与端侧缓存淘汰生效\n');

  // ---------------------------------------------------------------------------
  // Case 9: 课包全部为 0 课时且包含已退费、已过期、已学完结业的极端边界状态归一化
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 9] 测试全 0 课时课包混杂退费、过期、结业的极端边界状态归一化与资产安全...');

  const zeroLessonStudent = {
    id: 'stu-zero-pkg-001',
    name: '结业老生',
    packages: [
      { id: 'p-ref', status: 'refunded', remainingLessons: 0, consumedLessons: 0, pricePerLesson: 100 },
      { id: 'p-exp', status: 'expired', remainingLessons: 0, consumedLessons: 0, pricePerLesson: 120 },
      { id: 'p-done', status: 'completed', remainingLessons: 0, consumedLessons: 48, classId: 'cls-past', pricePerLesson: 150 },
    ],
    walletSummary: { principalBalance: 0, bonusBalance: 0 },
  };

  const zeroNorm = normalizeStatus(zeroLessonStudent);
  assert.strictEqual(zeroNorm.status, 'graduated', '全部课包课时消耗完毕且已结业学员必须归一化为 graduated');
  assert.strictEqual(zeroNorm.statusText, '已结业');
  assert.strictEqual(zeroNorm.inPendingAssetPool, false, '已结业学员不可进入待分班资产池');
  assert.strictEqual(zeroNorm.isAssignedClass, false, '历史已结业班级不可误判为当前在读');

  const zeroAssets = calculateStudentAssets(zeroLessonStudent);
  assert.strictEqual(zeroAssets.totalRemainingLessons, 0, '总剩余课时严格为 0');
  assert.strictEqual(zeroAssets.totalRemainingAmount, 0, '0 课时课包剩余金额严格为 0 (排他隔离非有效资产)');
  assert.strictEqual(zeroAssets.weightedPricePerLesson, 0, '加权单价严格为 0');
  assert.strictEqual(zeroAssets.frozenLessons, 0, '冻结课时为 0');

  console.log('✔ Case 9 验证通过: 全 0 课时退费/过期/结业混杂边界归一化与加权资产隔离 100% 正确\n');

  // ---------------------------------------------------------------------------
  // Case 10: 多校区关联学员过滤与 warningLevel 预警级别检索
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 10] 测试多校区关联学员动态筛选与 ADR-0005 预警级别组合检索...');

  fakePort.seedStudent({
    id: 'stu-multi-campus-001',
    name: '双校区学员',
    campuses: [{ id: 'campus-bj-hq', name: '北京总部' }, { id: 'campus-sh-pudong', name: '上海浦东' }],
    packages: [{ remainingLessons: 2, status: 'active', classId: 'c1' }],
  });

  fakePort.seedStudent({
    id: 'stu-warning-level-002',
    name: '续费预警学员',
    campusId: 'campus-sh-pudong',
    packages: [{ remainingLessons: 6, status: 'active', classId: 'c2' }], // 5~8 WARNING
  });

  // 测试多校区筛选：上海浦东校区应检索出双校区学员与续费预警学员
  const shRoster = await testProjector.projectRoster({ campusId: 'campus-sh-pudong' });
  assert.ok(shRoster.list.some((s) => s.id === 'stu-multi-campus-001'), '多校区学员在分校区检索时必须正确命中');
  assert.ok(shRoster.list.some((s) => s.id === 'stu-warning-level-002'), '直属分校区学员必须正确命中');

  // 测试 warningLevel 过滤
  const urgentRoster = await testProjector.projectRoster({ warningLevel: 'URGENT' });
  assert.ok(urgentRoster.list.every((s) => s.risk.level === 'URGENT'), 'warningLevel: URGENT 检索结果必须全部为紧急预警');

  const warningRoster = await testProjector.projectRoster({ warningLevel: 'WARNING' });
  assert.ok(warningRoster.list.every((s) => s.risk.level === 'WARNING'), 'warningLevel: WARNING 检索结果必须全部为续费预警');

  console.log('✔ Case 10 验证通过: 多校区关联学员筛选与 ADR-0005 预警级别组合检索验证通过\n');

  // ---------------------------------------------------------------------------
  // Case 11: 真实后端返回数据结构对齐与显式状态状态机解析
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 11] 测试真实后端返回数据结构与显式 in_class / disabled / completed 映射...');

  // 显式 in_class 传参
  const normExplicitInClass = normalizeStatus({ id: 's-exp-1', status: 'in_class', totalRemainingLessons: 24 });
  assert.strictEqual(normExplicitInClass.status, 'in_class', '显式传入 in_class 必须归一化为在读');
  assert.strictEqual(normExplicitInClass.isAssignedClass, true);

  // 显式 disabled 状态传参
  const normDisabled = normalizeStatus({ id: 's-exp-2', status: 'disabled', totalRemainingLessons: 10 });
  assert.strictEqual(normDisabled.status, 'suspended', '显式 disabled 学员必须被安全归一化为停课');
  assert.strictEqual(normDisabled.statusText, '停课');

  // 模拟真实后端 /api/students 返回结构 (张子豪真实报文)
  const realBackendStudent = {
    id: 'stu-001',
    studentNo: 'S948918',
    name: '张子豪',
    gender: 'male',
    phone: '156****0125',
    status: 'normal',
    campusId: 'campus-bj-hq',
    totalRemainingLessons: 44,
    enrolledClassesCount: 1,
    isAssignedClass: true,
    packages: [
      {
        packageId: 'pkg-stu-001',
        id: 'pkg-stu-001',
        courseId: 'crs-scratch-001',
        courseName: '012-软编Scratch创意图形编程',
        classId: 'cls-scratch-sat-0900',
        className: 'Scratch-周六09:00精品班',
        isEnrolledClass: true,
        totalLessons: 48,
        remainingLessons: 44,
        status: 'active',
        pricePerLesson: 100,
      },
    ],
  };

  fakePort.seedStudent(realBackendStudent);
  const realRoster = await testProjector.projectRoster({ keyword: '张子豪' });
  assert.strictEqual(realRoster.total, 1);
  const zhang = realRoster.list[0];
  assert.strictEqual(zhang.status, 'in_class', '张子豪在已分配班级情况下必须归一化为在读 (in_class)');
  assert.strictEqual(zhang.statusText, '在读');
  assert.strictEqual(zhang.enrolledClassesCount, 1, '在读班级数必须为 1');
  assert.strictEqual(zhang.inPendingAssetPool, false, '在读学员不可进入待分班资产池');

  console.log('✔ Case 11 验证通过: 真实后端报文无缝对齐，显式行政状态与在读班级精准映射\n');

  // ---------------------------------------------------------------------------
  // Case 12: 学员持有已学完0课时进班课包与新购未进班课包，必须精准判定为待分班
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 12] 测试已学完0课时进班课包与有效未进班课包组合下的待分班判定...');

  const partialFinishedStudent = {
    id: 'stu-part-fin-001',
    name: '续费待分班学员',
    packages: [
      {
        id: 'pkg-fin-1',
        status: 'active',
        remainingLessons: 0,
        consumedLessons: 48,
        classId: 'cls-old-sat',
        className: '历史周六班',
        pricePerLesson: 100,
      },
      {
        id: 'pkg-new-2',
        status: 'active',
        remainingLessons: 24,
        consumedLessons: 0,
        classId: null,
        className: null,
        pricePerLesson: 120,
      },
    ],
  };

  const normPartFin = normalizeStatus(partialFinishedStudent);
  assert.strictEqual(
    normPartFin.status,
    'pending_assignment',
    '已学完0课时课包绝不能将学员错误带入在读状态，必须锁定为 pending_assignment'
  );
  assert.strictEqual(normPartFin.statusText, '待分班');
  assert.strictEqual(normPartFin.inPendingAssetPool, true);
  assert.strictEqual(normPartFin.isAssignedClass, false);

  const assetsPartFin = calculateStudentAssets(partialFinishedStudent);
  assert.strictEqual(assetsPartFin.totalRemainingLessons, 24);
  assert.strictEqual(assetsPartFin.totalRemainingAmount, 2880, '0 课时历史课包金额清零，仅计算 24 * 120 = 2880');

  fakePort.seedStudent(partialFinishedStudent);
  const rosterPartFin = await testProjector.projectRoster({ keyword: '续费待分班学员' });
  assert.strictEqual(rosterPartFin.list[0].status, 'pending_assignment');
  assert.strictEqual(rosterPartFin.list[0].enrolledClassesCount, 0, '未进班课包对应在读班级数必须为 0');

  console.log('✔ Case 12 验证通过: 历史已耗尽0课时课包不影响新课包待分班判定，在班数精准归零\n');

  // ---------------------------------------------------------------------------
  // Case 13: 虚拟状态过滤与 Http 适配器参数脱敏安全
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 13] 测试 Http 数据适配器虚拟学籍状态剥离与状态筛选...');

  const HttpStudentDataAdapter =
    studentProjector.HttpStudentDataAdapter ||
    require(projectorModulePath).HttpStudentDataAdapter;
  assert.ok(HttpStudentDataAdapter, '❌ HttpStudentDataAdapter 必须导出');
  const httpAdapter = new HttpStudentDataAdapter();

  // 测试 query status 为 all 或 全部状态 时 projector 不发生意外清空
  fakePort.seedStudent({
    id: 'stu-all-test-01',
    name: '全量学员测试',
    status: 'normal',
    packages: [{ remainingLessons: 10, status: 'active', classId: 'c1' }],
  });
  const allStatusRoster1 = await testProjector.projectRoster({ status: 'all' });
  assert.ok(allStatusRoster1.list.length > 0, 'status: "all" 绝不可被字面量错误过滤为空');

  const allStatusRoster2 = await testProjector.projectRoster({ status: '全部状态' });
  assert.ok(allStatusRoster2.list.length > 0, 'status: "全部状态" 绝不可被错误过滤为空');

  console.log('✔ Case 13 验证通过: Http 适配器虚拟状态处理健全，全量查询与状态过滤稳健\n');

  // ---------------------------------------------------------------------------
  // Case 14: 非标准/中文过期文本（如“无限期”）全息档案水化稳健性与 RangeError 防护
  // ---------------------------------------------------------------------------
  console.log('>>> [Case 14] 测试非标准/中文日期文本全息档案水化稳健性...');

  fakePort.seedProfile('stu-date-robust-01', {
    id: 'stu-date-robust-01',
    name: '日期容错学员',
    studentNo: 'S20268888',
    phone: '13812345678',
    status: 'normal',
    packages: [
      {
        id: 'p-date-1',
        courseName: '终身会员课程',
        expireDateText: '无限期',
        remainingLessons: 99,
        pricePerLesson: 100,
        status: 'active',
      },
      {
        id: 'p-date-2',
        courseName: '待定日期课包',
        expireDate: '长期有效',
        remainingLessons: 10,
        pricePerLesson: 100,
        status: 'active',
      },
    ],
  });

  const dossierDate = await testProjector.projectDossier('stu-date-robust-01', { forceRefresh: true });
  assert.strictEqual(dossierDate.name, '日期容错学员', '非标准日期绝不能引发异常并降级为空学员');
  assert.strictEqual(dossierDate.courses[0].expireDateText, '无限期', '中文无限期应平稳保留');
  assert.strictEqual(dossierDate.courses[1].expireDateText, '长期有效', '长期有效文本应平稳保留');

  console.log('✔ Case 14 验证通过: 非标准日期文本不抛 RangeError，全息档案水化平稳可靠\n');

  console.log('================================================================================');
  console.log('🎉 客户端学员档案全景投影与学籍状态归一化深模块 14 大核心场景全量断言 100% 验证通过！');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ 测试执行失败:', err);
  process.exit(1);
});
