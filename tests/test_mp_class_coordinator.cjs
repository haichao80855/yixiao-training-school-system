const assert = require('assert');
const path = require('path');
const fs = require('fs');

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
      showLoading: () => {},
      hideLoading: () => {},
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
console.log('🧪 运行微信小程序端班级花名册与生命周期协调器深模块 (Client Class Coordinator) 契约测试');
console.log('================================================================================\n');

// 1. 确保并加载编译产物
const coordinatorModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/coordinators/class/coordinator.js'
);
if (!fs.existsSync(coordinatorModulePath)) {
  const { execSync } = require('child_process');
  console.log('⚡ 检测到协调器编译产物缺失，正在自动执行 mp:build...');
  execSync('npm --prefix mini-program run build:mp-weixin', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
}

const { classCoordinator } = require(coordinatorModulePath);
const { studentProjector } = require(
  path.resolve(__dirname, '../mini-program/dist/build/mp-weixin/projectors/student/projector.js')
);

// -----------------------------------------------------------------------------
// [Check 0] 极简外部接口形态契约校验 (Interface Contract)
// -----------------------------------------------------------------------------
assert.ok(classCoordinator, '❌ classCoordinator 未成功导出');
assert.strictEqual(typeof classCoordinator.removeStudent, 'function', '❌ removeStudent 方法未导出');
assert.strictEqual(typeof classCoordinator.completeClass, 'function', '❌ completeClass 方法未导出');
assert.strictEqual(typeof classCoordinator.syncCancelledSchedules, 'function', '❌ syncCancelledSchedules 方法未导出');
assert.strictEqual(typeof classCoordinator.loadClassWorkspace, 'function', '❌ loadClassWorkspace 方法未导出');
assert.strictEqual(typeof classCoordinator.createCoordinator, 'function', '❌ createCoordinator 工厂未导出');
assert.ok(classCoordinator.FakeClassOperationAdapter, '❌ FakeClassOperationAdapter 适配器未导出');
assert.ok(classCoordinator.HttpClassOperationAdapter, '❌ HttpClassOperationAdapter 适配器未导出');
assert.ok(classCoordinator.CoordinatorClass, '❌ CoordinatorClass 构造函数未导出');

console.log('✔ [Check 0] 协调器深模块极简外部接口校验通过 (4 大任务动词 + 2 大六边形适配器)\n');

async function runTests() {
  const FakeAdapter = classCoordinator.FakeClassOperationAdapter;

  // ---------------------------------------------------------------------------
  // Scenario 1: loadClassWorkspace 全景聚合大盘加载
  // ---------------------------------------------------------------------------
  console.log('>>> [Scenario 1] 测试 loadClassWorkspace 聚合加载班级全景工作台...');
  const fakeAdapter1 = new FakeAdapter();
  const coordinator1 = classCoordinator.createCoordinator(fakeAdapter1, studentProjector);

  const mockClass1 = {
    id: 'cls-test-001',
    name: '少儿软编Python精品班',
    statusText: '已开班',
    startDateText: '2026-09-01',
    courseName: 'Python少儿编程',
    classroomName: '第一多媒体教室',
    classType: '常规班',
    capacity: 20,
    currentStudentCount: 2,
    teacherName: '冯老师',
    advisorName: '李老师',
    schedulePatternText: '每周六 09:00~10:30',
    completedLessons: 1,
    totalLessons: 16,
    schedules: [
      {
        id: 'sch-01',
        date: '2026-09-05',
        timeRange: '2026.09.05 09:00~10:30',
        semanticType: 'regular',
        status: 'completed',
        statusText: '已上',
        title: '第1讲 环境搭建与变量',
        actualCount: 2,
        expectedCount: 2,
        deductLessons: 1,
        teacherName: '冯老师',
        advisorName: '李老师',
      },
      {
        id: 'sch-02',
        date: '2026-09-12',
        timeRange: '2026.09.12 09:00~10:30',
        semanticType: 'regular',
        status: 'scheduled',
        statusText: '未上',
        title: '第2讲 条件分支控制',
        actualCount: 0,
        expectedCount: 2,
        deductLessons: 1,
        teacherName: '冯老师',
        advisorName: '李老师',
      },
    ],
    students: [
      {
        studentId: 'stu-001',
        name: '张小豪',
        studentNo: 'S20260001',
        phone: '13800000001',
        availableLessons: 15,
        joinDateText: '2026-09-01',
      },
      {
        studentId: 'stu-002',
        name: '李小萌',
        studentNo: 'S20260002',
        phone: '13800000002',
        availableLessons: 12,
        joinDateText: '2026-09-01',
      },
    ],
  };

  fakeAdapter1.seedClass(mockClass1);
  const workspace = await coordinator1.loadClassWorkspace('cls-test-001');
  assert.strictEqual(workspace.id, 'cls-test-001');
  assert.strictEqual(workspace.name, '少儿软编Python精品班');
  assert.strictEqual(workspace.students.length, 2);
  assert.strictEqual(workspace.schedules.length, 2);
  console.log('  ✔ 班级全景工作台 (班级元数据、在班学员、排课表) 聚合加载校验通过');

  // ---------------------------------------------------------------------------
  // Scenario 2: removeStudent 移出学员调用网络接缝并正确核算更新后的班级人数 (ADR-0004)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 2] 测试 removeStudent 真实调用网络端口、释放班容与返回自愈后人数...');
  const removeRes = await coordinator1.removeStudent('cls-test-001', 'stu-001', '学员申请调班');

  assert.strictEqual(fakeAdapter1.removeStudentCalls.length, 1, '必须真实穿透调用网络接缝端口');
  assert.strictEqual(fakeAdapter1.removeStudentCalls[0].classId, 'cls-test-001');
  assert.strictEqual(fakeAdapter1.removeStudentCalls[0].studentId, 'stu-001');
  assert.strictEqual(fakeAdapter1.removeStudentCalls[0].reason, '学员申请调班');

  assert.strictEqual(removeRes.success, true);
  assert.strictEqual(removeRes.studentId, 'stu-001');
  assert.strictEqual(removeRes.newClassStudentCount, 1, '在读人数必须原子冲减为 1');
  assert.strictEqual(removeRes.fallbackToUnassignedPool, true, '必须标识回退待分班资产池');
  assert.strictEqual(removeRes.studentStatus, 'normal', '学籍状态自愈回退');

  // 再次读取工作台确认真实状态
  const updatedWorkspace = await coordinator1.loadClassWorkspace('cls-test-001');
  assert.strictEqual(updatedWorkspace.currentStudentCount, 1);
  assert.strictEqual(updatedWorkspace.students.length, 1);
  assert.strictEqual(updatedWorkspace.students[0].studentId, 'stu-002');
  console.log('  ✔ 移出学员穿透网络接缝、行级名额原子核减与学籍自愈回退全部校验通过');

  // ---------------------------------------------------------------------------
  // Scenario 3: removeStudent 自动触发学员全息档案与待分班资产池缓存淘汰 (Cache Eviction)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 3] 测试 removeStudent 自动触发 studentProjector 全息档案与待分班资产池缓存淘汰...');
  const cachePort = studentProjector.getCachePort
    ? studentProjector.getCachePort()
    : (studentProjector.cachePort || studentProjector.cache);

  assert.ok(cachePort, '❌ studentProjector 底层缓存端口必须可访问');

  // 模拟端侧预热缓存
  cachePort.set('dossier_stu-002', { id: 'stu-002', name: '李小萌预热档案' });
  cachePort.set('pending_asset_pool', [{ id: 'stu-001' }]);
  cachePort.set('unassigned_roster', [{ id: 'stu-001' }]);

  assert.ok(cachePort.get('dossier_stu-002'), '预热学员全息档案缓存必须存在');
  assert.ok(cachePort.get('pending_asset_pool'), '预热待分班资产池缓存必须存在');
  assert.ok(cachePort.get('unassigned_roster'), '预热待分班名册缓存必须存在');

  // 执行移出李小萌
  await coordinator1.removeStudent('cls-test-001', 'stu-002');

  // 断言缓存已被即时淘汰
  assert.strictEqual(cachePort.get('dossier_stu-002'), null, '学员李小萌的全息档案缓存必须被成功淘汰驱逐');
  assert.strictEqual(cachePort.get('pending_asset_pool'), null, '待分班资产池缓存必须被成功淘汰驱逐');
  assert.strictEqual(cachePort.get('unassigned_roster'), null, '待分班名册缓存必须被成功淘汰驱逐');

  console.log('  ✔ removeStudent 自动级联学员全息档案与待分班资产池缓存淘汰自愈校验通过');

  // ---------------------------------------------------------------------------
  // Scenario 4: completeClass 合规结班携带处置策略、排课注销与解析审计收据 (ADR-0007)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 4] 测试 completeClass 规范组装 disposition 与 cancelFutureSchedules 策略及凭据解析...');
  const fakeAdapter2 = new FakeAdapter();
  const coordinator2 = classCoordinator.createCoordinator(fakeAdapter2, studentProjector);

  const mockClass2 = {
    id: 'cls-test-002',
    name: '硬笔书法初阶班',
    statusText: '已开班',
    startDateText: '2026-08-01',
    courseName: '硬笔书法',
    classroomName: '书法教室A',
    classType: '常规班',
    capacity: 15,
    currentStudentCount: 2,
    teacherName: '王老师',
    advisorName: '赵老师',
    schedulePatternText: '每周日 10:00~11:30',
    completedLessons: 1,
    totalLessons: 3,
    schedules: [
      {
        id: 'sch-201',
        date: '2026-08-01',
        timeRange: '2026.08.01 10:00~11:30',
        semanticType: 'regular',
        status: 'completed',
        statusText: '已上',
        title: '第1讲 握笔姿势与基本笔画',
        actualCount: 2,
        expectedCount: 2,
        deductLessons: 1,
        teacherName: '王老师',
        advisorName: '赵老师',
      },
      {
        id: 'sch-202',
        date: '2026-08-08',
        timeRange: '2026.08.08 10:00~11:30',
        semanticType: 'regular',
        status: 'scheduled',
        statusText: '未上',
        title: '第2讲 偏旁部首结构解析',
        actualCount: 0,
        expectedCount: 2,
        deductLessons: 1,
        teacherName: '王老师',
        advisorName: '赵老师',
      },
      {
        id: 'sch-203',
        date: '2026-08-15',
        timeRange: '2026.08.15 10:00~11:30',
        semanticType: 'regular',
        status: 'scheduled',
        statusText: '未上',
        title: '第3讲 汉字间架结构实训',
        actualCount: 0,
        expectedCount: 2,
        deductLessons: 1,
        teacherName: '王老师',
        advisorName: '赵老师',
      },
    ],
    students: [
      {
        studentId: 'stu-201',
        name: '赵子龙',
        studentNo: 'S20260201',
        phone: '13900000001',
        availableLessons: 10,
        joinDateText: '2026-08-01',
      },
      {
        studentId: 'stu-202',
        name: '黄月英',
        studentNo: 'S20260202',
        phone: '13900000002',
        availableLessons: 8,
        joinDateText: '2026-08-01',
      },
    ],
  };

  fakeAdapter2.seedClass(mockClass2);

  // 预置待分班资产池缓存，验证结班同样自动驱逐
  cachePort.set('pending_asset_pool', [{ id: 'stu-old' }]);
  assert.ok(cachePort.get('pending_asset_pool'));

  // 执行默认策略结班
  const receipt = await coordinator2.completeClass('cls-test-002', {
    remark: '移动端学期结束正常归档',
  });

  // 验证调用参数规范
  assert.strictEqual(fakeAdapter2.completeClassCalls.length, 1);
  const call = fakeAdapter2.completeClassCalls[0];
  assert.strictEqual(call.classId, 'cls-test-002');
  assert.deepStrictEqual(call.options.disposition, { mode: 'fallback_unassigned' }, '未指定时默认必须组装 fallback_unassigned 策略');
  assert.strictEqual(call.options.cancelFutureSchedules, true, '未指定时默认必须开启 cancelFutureSchedules: true');
  assert.strictEqual(call.options.remark, '移动端学期结束正常归档');

  // 验证 ClassCompletionReceipt 审计收据
  assert.strictEqual(receipt.success, true);
  assert.strictEqual(receipt.classId, 'cls-test-002');
  assert.strictEqual(receipt.currentStatus, 'completed');
  assert.strictEqual(receipt.disposedStudentCount, 2, '2 名在班学员课包已妥善安置');
  assert.strictEqual(receipt.cancelledScheduleCount, 2, '未上排课已撤销 2 节');
  assert.strictEqual(receipt.preservedAttendanceCount, 1, '已点名考勤已安全保留 1 节');
  assert.ok(receipt.receiptId.startsWith('REC-'), '必须生成审计凭据编号');
  assert.ok(receipt.immutableFingerprint, '必须包含不可变数据指纹');

  // 验证待分班缓存驱逐
  assert.strictEqual(cachePort.get('pending_asset_pool'), null, '结班后待分班资产池缓存必须即时驱逐');

  console.log('  ✔ completeClass 规范携带策略、未来排课物理撤销与 ClassCompletionReceipt 审计凭单解析通过');

  // ---------------------------------------------------------------------------
  // Scenario 5: syncCancelledSchedules 结班后本地排课日程列表自愈为已取消状态 (Local Invariant)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 5] 测试 syncCancelledSchedules 本地未执行排课日程自愈为已取消状态与已上考勤防腐...');
  const originalSchedules = [
    {
      id: 's-done-1',
      date: '2026-10-01',
      timeRange: '2026.10.01 10:00~11:30',
      semanticType: 'regular',
      status: 'completed',
      statusText: '已上',
      title: '已完成课次',
      actualCount: 5,
      expectedCount: 5,
      deductLessons: 1,
      teacherName: '张老师',
      advisorName: '李老师',
    },
    {
      id: 's-todo-2',
      date: '2026-10-08',
      timeRange: '2026.10.08 10:00~11:30',
      semanticType: 'regular',
      status: 'scheduled',
      statusText: '未上',
      title: '未来待上课次 A',
      actualCount: 0,
      expectedCount: 5,
      deductLessons: 1,
      teacherName: '张老师',
      advisorName: '李老师',
    },
    {
      id: 's-todo-3',
      date: '2026-10-15',
      timeRange: '2026.10.15 10:00~11:30',
      semanticType: 'regular',
      status: 'scheduled',
      statusText: '未上',
      title: '未来待上课次 B',
      actualCount: 0,
      expectedCount: 5,
      deductLessons: 1,
      teacherName: '张老师',
      advisorName: '李老师',
    },
  ];

  const syncedSchedules = coordinator2.syncCancelledSchedules(originalSchedules);

  // 历史考勤防腐不变式：已完成状态绝对不变
  assert.strictEqual(syncedSchedules[0].status, 'completed', '历史已消课考勤绝对严禁变更为已取消');
  assert.strictEqual(syncedSchedules[0].statusText, '已上');

  // 未来未上课次自愈
  assert.strictEqual(syncedSchedules[1].status, 'cancelled', '未执行排课必须自愈为 cancelled');
  assert.strictEqual(syncedSchedules[1].statusText, '已取消');
  assert.strictEqual(syncedSchedules[2].status, 'cancelled', '未执行排课必须自愈为 cancelled');
  assert.strictEqual(syncedSchedules[2].statusText, '已取消');

  console.log('  ✔ syncCancelledSchedules 历史已消课 100% 锁死防腐与未来日程自愈已取消通过');

  // ---------------------------------------------------------------------------
  // Scenario 6: 网络异常与服务端阻断时的安全熔断与异常透传断言 (No Error Swallowing)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 6] 测试网络断层与服务端阻断时的安全熔断与异常透传 (绝无静默吞噬)...');
  const fakeAdapter3 = new FakeAdapter();
  const coordinator3 = classCoordinator.createCoordinator(fakeAdapter3, studentProjector);

  // 6.1 模拟移出学员时的网络超时或 CAS 锁冲突
  fakeAdapter3.shouldFailRemove = new Error('DatabaseTransactionTimeout: 行级 CAS 锁超时冲突');
  let removeErrorCaught = null;
  try {
    await coordinator3.removeStudent('cls-999', 'stu-999');
  } catch (err) {
    removeErrorCaught = err;
  }
  assert.ok(removeErrorCaught, '移出学员发生网络断层或服务端异常时必须显式抛出');
  assert.ok(
    removeErrorCaught.message.includes('行级 CAS 锁超时冲突'),
    '原始异常报文必须完整透传至调用端'
  );

  // 6.2 模拟结班时的服务端业务阻断 (如班级不存在)
  fakeAdapter3.shouldFailComplete = new Error('BadRequestException: 班级仍有未处理异常日程，禁止直接结课');
  let completeErrorCaught = null;
  try {
    await coordinator3.completeClass('cls-999');
  } catch (err) {
    completeErrorCaught = err;
  }
  assert.ok(completeErrorCaught, '结班操作发生服务端业务阻断时必须显式抛出');
  assert.ok(
    completeErrorCaught.message.includes('禁止直接结课'),
    '服务端业务阻断信息必须完整透传'
  );

  console.log('  ✔ 网络断层与服务端异常透传安全熔断校验通过 (无异常吞噬，守卫数据强一致性)');

  // ---------------------------------------------------------------------------
  // Scenario 7: 参数前置契约防御 (Boundary Guards)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 7] 测试参数空值与边界前置防御...');
  await assert.rejects(
    async () => coordinator3.removeStudent('', 'stu-1'),
    /班级ID不能为空/,
    '空班级ID必须在客户端前置拦截'
  );
  await assert.rejects(
    async () => coordinator3.removeStudent('cls-1', ''),
    /学员ID不能为空/,
    '空学员ID必须在客户端前置拦截'
  );
  await assert.rejects(
    async () => coordinator3.completeClass(''),
    /班级ID不能为空/,
    '空班级ID结班必须前置拦截'
  );

  assert.deepStrictEqual(coordinator3.syncCancelledSchedules([]), []);
  assert.deepStrictEqual(coordinator3.syncCancelledSchedules(null), []);
  console.log('  ✔ 前置防御校验通过 (空 ID 拦截与空排课容错)');

  // ---------------------------------------------------------------------------
  // Scenario 8: 班级详情页 (class/detail.vue) 源码接缝静态契约防假改造审查
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 8] 审查 package-edu/class/detail.vue 源码接缝，杜绝假删除与裸结班...');
  const detailVuePath = path.resolve(
    __dirname,
    '../mini-program/src/package-edu/class/detail.vue'
  );
  assert.ok(fs.existsSync(detailVuePath), '❌ class/detail.vue 不存在');
  const detailContent = fs.readFileSync(detailVuePath, 'utf8');

  // 1. 验证导入了 classCoordinator
  assert.ok(
    detailContent.includes("from '../../coordinators/class'") ||
    detailContent.includes('classCoordinator'),
    '❌ detail.vue 必须从 coordinators/class 导入 classCoordinator'
  );

  // 2. 验证移出学员移除了脆弱的本地 splice 假删除，采用 classCoordinator.removeStudent 真实落盘
  assert.ok(
    detailContent.includes('classCoordinator.removeStudent'),
    '❌ detail.vue 移出学员必须调用 classCoordinator.removeStudent'
  );

  // 3. 验证结班升级为 classCoordinator.completeClass 携带策略与排课自愈
  assert.ok(
    detailContent.includes('classCoordinator.completeClass'),
    '❌ detail.vue 结班必须调用 classCoordinator.completeClass'
  );
  assert.ok(
    detailContent.includes('classCoordinator.syncCancelledSchedules'),
    '❌ detail.vue 结班必须调用 classCoordinator.syncCancelledSchedules 同步已取消日程'
  );

  // 4. 验证 UI 契约零破坏：原关键 CSS 类名与 DOM 结构稳定存在
  const requiredUiClasses = [
    'class-header-card',
    'badge-ratio-pill',
    'finish-class-btn',
    'class-tabs-bar',
    'stu-roster-card',
  ];
  for (const cls of requiredUiClasses) {
    assert.ok(
      detailContent.includes(cls),
      `❌ detail.vue 缺少关键 UI 样式类名契约: ${cls}`
    );
  }

  console.log('  ✔ detail.vue 接缝改造审查 100% 通过: 假删除根除、规范结班联动、UI 样式契约零破坏');

  // ---------------------------------------------------------------------------
  // Scenario 9: 并发在途锁防重拦截测试 (In-Flight Concurrency Deduplication)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 9] 测试端侧在途并发锁 (In-Flight Lock)，杜绝弱网抖动重复提交...');
  const fakeAdapter4 = new FakeAdapter();
  const coordinator4 = classCoordinator.createCoordinator(fakeAdapter4, studentProjector);
  fakeAdapter4.seedClass({
    id: 'cls-concurrent-01',
    name: '并发测试班',
    statusText: '已开班',
    capacity: 10,
    currentStudentCount: 2,
    students: [
      { studentId: 'stu-c1', name: '并发学员1', availableLessons: 5 },
      { studentId: 'stu-c2', name: '并发学员2', availableLessons: 5 },
    ],
    schedules: [],
  });

  // 9.1 测试 removeStudent 在途并发拦截
  // 故意延迟适配器执行，制造并发窗口
  const originalRemove = fakeAdapter4.removeStudent.bind(fakeAdapter4);
  fakeAdapter4.removeStudent = async (payload) => {
    await new Promise((r) => setTimeout(r, 50));
    return originalRemove(payload);
  };

  const removePromise1 = coordinator4.removeStudent('cls-concurrent-01', 'stu-c1');
  let dupRemoveError = null;
  try {
    await coordinator4.removeStudent('cls-concurrent-01', 'stu-c1');
  } catch (err) {
    dupRemoveError = err;
  }
  assert.ok(dupRemoveError, '并发重复触发 removeStudent 必须被在途锁拦截');
  assert.ok(
    dupRemoveError.message.includes('正在进行中') || dupRemoveError.message.includes('请勿重复提交'),
    `提示信息必须明确友好: ${dupRemoveError.message}`
  );
  await removePromise1;

  // 9.2 测试 completeClass 在途并发拦截
  const originalComplete = fakeAdapter4.completeClass.bind(fakeAdapter4);
  fakeAdapter4.completeClass = async (classId, opts) => {
    await new Promise((r) => setTimeout(r, 50));
    return originalComplete(classId, opts);
  };

  const completePromise1 = coordinator4.completeClass('cls-concurrent-01');
  let dupCompleteError = null;
  try {
    await coordinator4.completeClass('cls-concurrent-01');
  } catch (err) {
    dupCompleteError = err;
  }
  assert.ok(dupCompleteError, '并发重复触发 completeClass 必须被在途锁拦截');
  assert.ok(
    dupCompleteError.message.includes('正在进行中') || dupCompleteError.message.includes('请勿重复提交'),
    `提示信息必须明确友好: ${dupCompleteError.message}`
  );
  await completePromise1;

  console.log('  ✔ 端侧在途并发锁拦截断言通过 (有效防御双击抖动与重复扣减/结课)');

  // ---------------------------------------------------------------------------
  // Scenario 10: 结班级联驱逐在班学员档案缓存 (Dossier Cache Eviction on CompleteClass)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 10] 测试 completeClass 级联淘汰原在班学员全息档案缓存...');
  const fakeAdapter5 = new FakeAdapter();
  const coordinator5 = classCoordinator.createCoordinator(fakeAdapter5, studentProjector);
  fakeAdapter5.seedClass({
    id: 'cls-dossier-01',
    name: '学员档案级联淘汰测试班',
    statusText: '已开班',
    capacity: 10,
    currentStudentCount: 2,
    students: [
      { studentId: 'stu-dossier-1', name: '学员甲', availableLessons: 8 },
      { studentId: 'stu-dossier-2', name: '学员乙', availableLessons: 8 },
    ],
    schedules: [],
  });

  cachePort.set('dossier_stu-dossier-1', { id: 'stu-dossier-1', name: '学员甲预热档案' });
  cachePort.set('dossier_stu-dossier-2', { id: 'stu-dossier-2', name: '学员乙预热档案' });
  assert.ok(cachePort.get('dossier_stu-dossier-1'));
  assert.ok(cachePort.get('dossier_stu-dossier-2'));

  await coordinator5.completeClass('cls-dossier-01', {
    studentIds: ['stu-dossier-1', 'stu-dossier-2'],
  });

  assert.strictEqual(cachePort.get('dossier_stu-dossier-1'), null, '学员甲档案缓存必须被成功淘汰');
  assert.strictEqual(cachePort.get('dossier_stu-dossier-2'), null, '学员乙档案缓存必须被成功淘汰');
  console.log('  ✔ completeClass 携带 studentIds 级联学员全息档案驱逐验证通过');

  // ---------------------------------------------------------------------------
  // Scenario 11: 空格与非法入参防穿透与自愈防御 (Whitespace & Null Boundary)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 11] 测试全空格脏 ID 穿透拦截与工作台空数组自愈...');
  await assert.rejects(
    async () => coordinator5.removeStudent('   ', 'stu-1'),
    /班级ID不能为空/,
    '纯空格班级ID必须被 trim 并拒绝'
  );
  await assert.rejects(
    async () => coordinator5.removeStudent('cls-1', '   '),
    /学员ID不能为空/,
    '纯空格学员ID必须被 trim 并拒绝'
  );
  await assert.rejects(
    async () => coordinator5.completeClass('   '),
    /班级ID不能为空/,
    '纯空格班级ID结班必须被拦截'
  );

  // 工作台缺省自愈
  const mockMinimal = {
    id: 'cls-minimal',
    name: '极简班级',
    statusText: '已开班',
    capacity: 10,
    currentStudentCount: 0,
    students: null,
    schedules: null,
  };
  fakeAdapter5.seedClass(mockMinimal);
  const minimalWorkspace = await coordinator5.loadClassWorkspace('cls-minimal');
  assert.ok(Array.isArray(minimalWorkspace.students), 'students 为 null 时自愈为空数组');
  assert.ok(Array.isArray(minimalWorkspace.schedules), 'schedules 为 null 时自愈为空数组');
  console.log('  ✔ 全空格脏入参前置拦截与工作台空数组自愈保护校验通过');

  // ---------------------------------------------------------------------------
  // Scenario 12: 审查 detail.vue 结班花名册清空、防重锁与已结班状态安全防御
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 12] 审查 detail.vue 结班后清空 students 数组与状态守卫...');
  // 1. 验证结班后 classData.value.students = []
  assert.ok(
    detailContent.includes('classData.value.students = []'),
    '❌ detail.vue 结班完成后必须显式将 classData.value.students 重置为空数组，杜绝幽灵名册'
  );

  // 2. 验证包含 isSubmitting 防重锁
  assert.ok(
    detailContent.includes('isSubmitting'),
    '❌ detail.vue 必须具备 isSubmitting 防重锁，防止双击重复提交'
  );

  // 3. 验证已结班状态下拦截结班与加学员
  assert.ok(
    detailContent.includes("classData.value.statusText === '已结班'"),
    '❌ detail.vue 必须守卫已结班状态下的非法操作'
  );

  // 4. 验证已取消排课拦截点名考勤
  assert.ok(
    detailContent.includes("item.status === 'cancelled'"),
    '❌ detail.vue 必须拦截已取消排课进入点名考勤页面'
  );

  console.log('  ✔ detail.vue 名册清空、防重锁与状态机边界守卫静态审查通过');

  // ---------------------------------------------------------------------------
  // Scenario 13: 跨操作在途并发锁对抗测试 (Cross-Operation In-Flight Concurrency)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 13] 测试跨操作在途并发排他锁 (移出学员与结课归档相互互斥)...');
  const fakeAdapter6 = new FakeAdapter();
  const coordinator6 = classCoordinator.createCoordinator(fakeAdapter6, studentProjector);
  fakeAdapter6.seedClass({
    id: 'cls-cross-01',
    name: '跨操作并发测试班',
    statusText: '已开班',
    capacity: 10,
    currentStudentCount: 2,
    students: [
      { studentId: 'stu-x1', name: '学员X1', availableLessons: 5 },
      { studentId: 'stu-x2', name: '学员X2', availableLessons: 5 },
    ],
    schedules: [],
  });

  // 13.1 移出学员在途中 -> 尝试结班必须被排他拦截
  let slowRemoveResolve;
  fakeAdapter6.removeStudent = () => new Promise((resolve) => {
    slowRemoveResolve = resolve;
  });

  const slowRemovePromise = coordinator6.removeStudent('cls-cross-01', 'stu-x1');
  let crossCompleteError = null;
  try {
    await coordinator6.completeClass('cls-cross-01');
  } catch (err) {
    crossCompleteError = err;
  }
  assert.ok(crossCompleteError, '移出学员在途中时调用 completeClass 必须被拦截');
  assert.ok(
    crossCompleteError.message.includes('学员移出操作正在进行中') ||
    crossCompleteError.message.includes('请稍后结班'),
    `异常提示必须明确指明有移出在途中: ${crossCompleteError.message}`
  );

  // 释放慢操作
  slowRemoveResolve({
    success: true,
    classId: 'cls-cross-01',
    studentId: 'stu-x1',
    newClassStudentCount: 1,
    studentStatus: 'normal',
    fallbackToUnassignedPool: true,
  });
  await slowRemovePromise;

  // 13.2 结班在途中 -> 尝试移出学员必须被排他拦截
  let slowCompleteResolve;
  fakeAdapter6.completeClass = () => new Promise((resolve) => {
    slowCompleteResolve = resolve;
  });

  const slowCompletePromise = coordinator6.completeClass('cls-cross-01');
  let crossRemoveError = null;
  try {
    await coordinator6.removeStudent('cls-cross-01', 'stu-x2');
  } catch (err) {
    crossRemoveError = err;
  }
  assert.ok(crossRemoveError, '结班操作在途中时调用 removeStudent 必须被拦截');
  assert.ok(
    crossRemoveError.message.includes('正在结课归档中') ||
    crossRemoveError.message.includes('禁止移出学员'),
    `异常提示必须明确指明结班在途中: ${crossRemoveError.message}`
  );

  // 释放慢结班
  slowCompleteResolve({
    success: true,
    receiptId: 'REC-SLOW-COMPLETE',
    classId: 'cls-cross-01',
    currentStatus: 'completed',
    disposedStudentCount: 1,
    dispositionMode: 'fallback_unassigned',
    cancelledScheduleCount: 0,
    preservedAttendanceCount: 0,
    completedAt: new Date().toISOString(),
  });
  await slowCompletePromise;

  console.log('  ✔ 跨操作在途并发排他互斥锁断言通过 (结课与移出学员双向互斥，杜绝竞态脏写)');

  // ---------------------------------------------------------------------------
  // Scenario 14: syncCancelledSchedules 考勤防腐与实到课次保护 (ADR-0007 Invariant)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 14] 测试 syncCancelledSchedules 对产生考勤人次的未结课日程防腐保护...');
  const mixedSchedules = [
    {
      id: 'sch-done',
      status: 'completed',
      statusText: '已上',
      actualCount: 5,
    },
    {
      id: 'sch-attended-but-scheduled',
      status: 'scheduled',
      statusText: '未上',
      actualCount: 3, // 已有 3 人签到消课！严禁被物理抹杀为已取消
    },
    {
      id: 'sch-pure-future',
      status: 'scheduled',
      statusText: '未上',
      actualCount: 0, // 纯未来课次，安全自愈为已取消
    },
  ];

  const protectedSchedules = coordinator6.syncCancelledSchedules(mixedSchedules);
  assert.strictEqual(protectedSchedules[0].status, 'completed', '历史已完成课次不变');
  assert.strictEqual(protectedSchedules[0].statusText, '已上');

  assert.strictEqual(
    protectedSchedules[1].status,
    'completed',
    '已产生考勤记录 (actualCount > 0) 的课次必须被提升保护为 completed，杜绝考勤被冲销'
  );
  assert.strictEqual(protectedSchedules[1].statusText, '已上');

  assert.strictEqual(protectedSchedules[2].status, 'cancelled', '无考勤的纯未来排课自愈为 cancelled');
  assert.strictEqual(protectedSchedules[2].statusText, '已取消');

  console.log('  ✔ syncCancelledSchedules 考勤人次防腐增强断言通过 (历史实到课次 100% 锁死防腐)');

  // ---------------------------------------------------------------------------
  // Scenario 15: FakeClassOperationAdapter 状态机前置守卫与后端 ClassLifecycle 对齐
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 15] 测试 FakeClassOperationAdapter 对已结课班级的状态机守卫...');
  const fakeAdapter7 = new FakeAdapter();
  const coordinator7 = classCoordinator.createCoordinator(fakeAdapter7, studentProjector);
  fakeAdapter7.seedClass({
    id: 'cls-completed-01',
    name: '已归档老班级',
    statusText: '已结班',
    status: 'completed',
    capacity: 10,
    currentStudentCount: 0,
    students: [],
    schedules: [],
  });

  // 对已结班班级重复结课 -> 抛出异常
  await assert.rejects(
    async () => fakeAdapter7.completeClass('cls-completed-01'),
    /已处于已结课状态，禁止重复结课/,
    '对已结班班级执行 completeClass 必须对齐真实后端抛出 BadRequestException'
  );

  // 对已结班班级执行移出学员 -> 抛出异常
  await assert.rejects(
    async () => fakeAdapter7.removeStudent({ classId: 'cls-completed-01', studentId: 'stu-any' }),
    /已结课归档，无有效在班学员可供移出/,
    '对已结班班级执行 removeStudent 必须前置拒绝'
  );

  console.log('  ✔ FakeClassOperationAdapter 状态机前置守卫与后端 ClassLifecycle 100% 对齐');

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Scenario 16: detail.vue filteredStudents 空指针与异常脏数据防穿透审查 & 调整课耗反馈
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 16] 审查 detail.vue 防穿透鲁棒性与 调整课耗 友好反馈...');
  const freshDetailContent = fs.readFileSync(detailVuePath, 'utf8');

  // 1. 验证 filteredStudents 针对 null/undefined 字段的安全转换
  assert.ok(
    freshDetailContent.includes('String(s.name ||') &&
    freshDetailContent.includes('String(s.phone ||') &&
    freshDetailContent.includes('String(s.studentNo ||'),
    '❌ detail.vue filteredStudents 必须对 name/phone/studentNo 执行空指针防御转换'
  );

  // 2. 验证调整课耗具备友好反馈分支
  assert.ok(
    freshDetailContent.includes('res.tapIndex === 1') &&
    freshDetailContent.includes('课耗调整请前往PC端'),
    '❌ detail.vue 必须提供调整课耗的明确引导提示，杜绝点击无响应的死交互'
  );

  // 3. 验证 isClassCompleted 统一状态机守卫
  assert.ok(
    freshDetailContent.includes('isClassCompleted') &&
    freshDetailContent.includes("classData.value.statusText === '已结课'"),
    '❌ detail.vue 必须具备严密的已结班/已结课联合状态机守卫'
  );

  console.log('  ✔ detail.vue 空指针防崩过滤、调整课耗反馈与联合状态机守卫静态审查通过');

  // ---------------------------------------------------------------------------
  // Scenario 17: syncCancelledSchedules 字符串数值、attendances 数组与脏状态自愈断言
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 17] 测试 syncCancelledSchedules 对字符串数值与 attendances 对象的防腐自愈...');
  const dirtySchedules = [
    {
      id: 'sch-str-count',
      status: 'scheduled',
      statusText: '未开始',
      actualCount: '3', // 字符串数值出勤人次
    },
    {
      id: 'sch-attendances-array',
      status: 'scheduled',
      statusText: '待上课',
      actualCount: 0,
      attendances: [{ id: 'att-01', studentId: 'stu-01' }], // 有考勤数组对象
    },
    {
      id: 'sch-pure-future-dirty',
      status: 'scheduled',
      statusText: '未开始',
      actualCount: 0,
    },
    null, // 空项容错
  ];

  const healedSchedules = coordinator7.syncCancelledSchedules(dirtySchedules);
  assert.strictEqual(healedSchedules[0].status, 'completed', '字符串数值出勤人次课次必须被提升为 completed');
  assert.strictEqual(healedSchedules[0].statusText, '已上', '旧文本「未开始」必须自愈修正为「已上」');
  assert.strictEqual(healedSchedules[1].status, 'completed', '存在 attendances 数组的课次必须被提升为 completed');
  assert.strictEqual(healedSchedules[1].statusText, '已上', '旧文本「待上课」必须自愈修正为「已上」');
  assert.strictEqual(healedSchedules[2].status, 'cancelled', '无考勤的纯未来排课必须自愈为 cancelled');
  assert.strictEqual(healedSchedules[2].statusText, '已取消');
  assert.strictEqual(healedSchedules[3], null, '数组中的 null 元素安全保留，不崩溃');

  console.log('  ✔ syncCancelledSchedules 字符串数值转换、attendances 数组识别与空值容错断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 18: FakeClassOperationAdapter 考勤数组防腐与「已结课」状态机阻断
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 18] 测试 FakeClassOperationAdapter 对 attendances 数组与「已结课」状态机阻断...');
  const fakeAdapter8 = new FakeAdapter();
  const coordinator8 = classCoordinator.createCoordinator(fakeAdapter8, studentProjector);

  // 18.1 测试结班时保护带有 attendances 数组但 actualCount 为 0 的排课
  fakeAdapter8.seedClass({
    id: 'cls-att-arr-01',
    name: '考勤数组班级',
    statusText: '已开班',
    capacity: 10,
    currentStudentCount: 1,
    students: [{ studentId: 'stu-att-1', name: '出勤学员1' }],
    schedules: [
      {
        id: 'sch-att-only',
        status: 'scheduled',
        statusText: '未上',
        actualCount: 0,
        attendances: [{ id: 'att-x1', studentId: 'stu-att-1' }],
      },
      {
        id: 'sch-future-only',
        status: 'scheduled',
        statusText: '未上',
        actualCount: 0,
        attendances: [],
      },
    ],
  });

  const receiptAtt = await coordinator8.completeClass('cls-att-arr-01');
  assert.strictEqual(receiptAtt.preservedAttendanceCount, 1, '存在 attendances 记录的排课必须被计入 preservedAttendanceCount');
  assert.strictEqual(receiptAtt.cancelledScheduleCount, 1, '无考勤记录的纯未来排课必须被计入 cancelledScheduleCount');

  // 18.2 测试状态文本为「已结课」时的业务阻断
  fakeAdapter8.seedClass({
    id: 'cls-status-text-completed',
    name: '已结课状态班级',
    statusText: '已结课',
    capacity: 10,
    currentStudentCount: 0,
    students: [],
    schedules: [],
  });

  await assert.rejects(
    async () => coordinator8.completeClass('cls-status-text-completed'),
    /已处于已结课状态，禁止重复结课/,
    '对 statusText 为「已结课」的班级结班必须被 Fake 适配器拦截'
  );
  await assert.rejects(
    async () => coordinator8.removeStudent('cls-status-text-completed', 'stu-any'),
    /已结课归档，无有效在班学员可供移出/,
    '对 statusText 为「已结课」的班级移出学员必须被 Fake 适配器拦截'
  );

  console.log('  ✔ FakeClassOperationAdapter 考勤数组防腐与「已结课」状态机阻断校验通过');

  // ---------------------------------------------------------------------------
  // Scenario 19: loadClassWorkspace 指标自愈补齐与 completeClass 数值 ID 字符串清洗
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 19] 测试 loadClassWorkspace 缺失指标字段防御性补齐与 studentIds 归一化清洗...');
  const fakeAdapter9 = new FakeAdapter();
  const coordinator9 = classCoordinator.createCoordinator(fakeAdapter9, studentProjector);

  // 19.1 测试工作台字段缺失自愈
  fakeAdapter9.seedClass({
    id: 'cls-sparse-fields',
    name: '稀疏指标班级',
    // 故意省略 currentStudentCount, capacity, completedLessons, totalLessons, statusText
    students: [
      { studentId: 'stu-sp-1', name: '稀疏学员1' },
      { studentId: 'stu-sp-2', name: '稀疏学员2' },
    ],
    schedules: [
      { id: 'sch-sp-1', status: 'completed', statusText: '已上', actualCount: 2 },
      { id: 'sch-sp-2', status: 'scheduled', statusText: '未上', actualCount: 0 },
    ],
  });

  const sparseWorkspace = await coordinator9.loadClassWorkspace('cls-sparse-fields');
  assert.strictEqual(sparseWorkspace.currentStudentCount, 2, '缺失 currentStudentCount 时自愈为 students.length');
  assert.strictEqual(sparseWorkspace.capacity, 10, '缺失 capacity 时自愈为默认 10');
  assert.strictEqual(sparseWorkspace.completedLessons, 1, '缺失 completedLessons 时自愈为已完成课次数');
  assert.strictEqual(sparseWorkspace.totalLessons, 2, '缺失 totalLessons 时自愈为排课总数');
  assert.strictEqual(sparseWorkspace.statusText, '已开班', '缺失 statusText 时自愈为已开班');

  // 19.2 测试 completeClass 传入数值类型或带空格的 studentIds 字符串清洗驱逐
  cachePort.set('dossier_1001', { id: '1001', name: '数值ID学员档案' });
  assert.ok(cachePort.get('dossier_1001'));

  await coordinator9.completeClass('cls-sparse-fields', {
    studentIds: [1001, '  2002  '],
  });
  assert.strictEqual(cachePort.get('dossier_1001'), null, '数值 ID 必须被清洗为 String 并在 studentProjector 中精准驱逐');

  console.log('  ✔ loadClassWorkspace 指标自愈补齐与 studentIds 归一化清洗断言通过');

  // ---------------------------------------------------------------------------
  // Scenario 20: detail.vue 模板空数组包装防御、已退班复选框过滤与 completedLessons 刷新审查
  // ---------------------------------------------------------------------------
  console.log('\n>>> [Scenario 20] 审查 detail.vue 模板空值容错、退班过滤与 completedLessons 刷新...');
  const latestDetailContent = fs.readFileSync(detailVuePath, 'utf8');

  // 1. 验证 Tab 标签中的防御性 length 访问
  assert.ok(
    latestDetailContent.includes('(classData.schedules || []).length') &&
    latestDetailContent.includes('(classData.students || []).length'),
    '❌ detail.vue Tab 标签必须具备 (classData.schedules || []).length 与 (classData.students || []).length 防御性包装'
  );

  // 2. 验证 filteredStudents 支持 !showRetired.value 退班学员过滤
  assert.ok(
    latestDetailContent.includes('!showRetired.value') &&
    latestDetailContent.includes('s.isRetired'),
    '❌ detail.vue filteredStudents 必须响应 showRetired 复选框过滤退班学员，杜绝死交互'
  );

  // 3. 验证结班后即时同步刷新 completedLessons 指标
  assert.ok(
    latestDetailContent.includes('classData.value.completedLessons ='),
    '❌ detail.vue 结班后必须即时根据最新排课日程刷新 completedLessons 结课指标'
  );

  // 4. 验证移出学员弹窗前置 isSubmitting 拦截
  assert.ok(
    latestDetailContent.includes('if (isSubmitting.value) {') &&
    latestDetailContent.includes('操作正在处理中'),
    '❌ detail.vue 移出学员必须在前置弹窗前阻断并友好提示正在处理中'
  );

  console.log('  ✔ detail.vue 模板防崩、退班过滤联动与 completedLessons 刷新静态审查通过');

  console.log('\n================================================================================');
  console.log('🎉 客户端班级花名册与生命周期协调器深模块全部核心场景与对抗性断言 100% 验证通过！');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ 测试执行失败:', err);
  process.exit(1);
});
