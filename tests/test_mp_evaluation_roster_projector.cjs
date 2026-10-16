const assert = require('assert');
const path = require('path');

// 注入微信小程序全局环境垫片
if (typeof global.wx === 'undefined') {
  global.wx = new Proxy(
    {
      getSystemInfoSync: () => ({ platform: 'devtools', windowWidth: 375, windowHeight: 667 }),
      canIUse: () => true,
      getStorageSync: () => null,
      setStorageSync: () => {},
      removeStorageSync: () => {},
      getStorageInfoSync: () => ({ keys: [] }),
      request: () => {},
      showToast: () => {},
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

console.log('======================================================');
console.log('🧪 运行微信小程序端待评花名册投影深模块 (EvaluationRosterProjector) 契约与单元测试');
console.log('======================================================\n');

// 加载构建产物
const projectorModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/projectors/evaluation-roster/index.js'
);
const imported = require(projectorModulePath);
const evaluationRosterProjector = imported.evaluationRosterProjector;
const createEvaluationRosterProjector = imported.createEvaluationRosterProjector || evaluationRosterProjector.createEvaluationRosterProjector;
const MemoryRosterCacheAdapter = imported.MemoryRosterCacheAdapter || evaluationRosterProjector.MemoryRosterCacheAdapter;
const DefaultEvaluationRosterProjector = imported.DefaultEvaluationRosterProjector || evaluationRosterProjector.DefaultProjectorClass;

// ----------------------------------------------------
// Mock 基础设备
// ----------------------------------------------------
class MockRosterQueryAdapter {
  constructor() {
    this.schedulesByCampus = new Map();
    this.workbenchByScheduleId = new Map();
    this.activeWorkbenchRequests = 0;
    this.maxConcurrentWorkbenchRequests = 0;
    this.totalWorkbenchCalls = 0;
    this.shouldThrowOnWorkbenchId = null;
    this.shouldThrowOnScheduleQuery = false;
  }

  setMockData(campusId, schedules, workbenches) {
    this.schedulesByCampus.set(campusId, schedules);
    for (const [schId, wb] of Object.entries(workbenches)) {
      this.workbenchByScheduleId.set(schId, wb);
    }
  }

  async fetchCampusSchedules(campusId, dateRange) {
    if (this.shouldThrowOnScheduleQuery) {
      throw new Error('Network offline or Gateway 502');
    }
    return this.schedulesByCampus.get(campusId) || [];
  }

  async fetchScheduleWorkbench(scheduleId) {
    this.activeWorkbenchRequests++;
    this.totalWorkbenchCalls++;
    if (this.activeWorkbenchRequests > this.maxConcurrentWorkbenchRequests) {
      this.maxConcurrentWorkbenchRequests = this.activeWorkbenchRequests;
    }

    if (this.shouldThrowOnWorkbenchId === scheduleId) {
      this.activeWorkbenchRequests--;
      throw new Error(`Schedule ${scheduleId} workbench internal error`);
    }

    // 模拟真实异步网络延迟
    await new Promise((resolve) => setTimeout(resolve, 20));

    const wb = this.workbenchByScheduleId.get(scheduleId);
    this.activeWorkbenchRequests--;
    if (!wb) {
      return {
        schedule: { id: scheduleId, campusId: 'mock', className: '默认班级', date: '2026-10-14', startTime: '18:00', endTime: '19:00' },
        students: [],
      };
    }
    return wb;
  }
}

async function runTests() {
  // ----------------------------------------------------
  // Scenario 1: 模块形态与对外接缝契约验证
  // ----------------------------------------------------
  console.log('▶ [场景 1] 校验 EvaluationRosterProjector 模块形态与极简接缝');
  assert.ok(evaluationRosterProjector, '❌ 未能导出 evaluationRosterProjector 默认单例');
  assert.strictEqual(typeof evaluationRosterProjector.projectRoster, 'function', '❌ projectRoster 入口未导出');
  assert.strictEqual(typeof evaluationRosterProjector.invalidateCampusCache, 'function', '❌ invalidateCampusCache 未导出');
  assert.strictEqual(typeof createEvaluationRosterProjector, 'function', '❌ createEvaluationRosterProjector 工厂未导出');
  console.log('✔ [场景 1] 模块外部接口形态验证通过\n');

  // ----------------------------------------------------
  // Scenario 2: 多排课日程到花名册全景的展平映射
  // ----------------------------------------------------
  console.log('▶ [场景 2] 多排课日程到花名册全景的展平映射');
  const queryPort2 = new MockRosterQueryAdapter();
  const cachePort2 = new MemoryRosterCacheAdapter();

  queryPort2.setMockData(
    'campus-bj-hq',
    [
      { id: 'sch-1', campusId: 'campus-bj-hq', classId: 'cls-1', className: '启蒙英语-001班', courseName: '启蒙英语', date: '2026-10-14', startTime: '18:16', endTime: '19:46', status: 'completed' },
      { id: 'sch-2', campusId: 'campus-bj-hq', classId: 'cls-2', className: '进阶绘本-002班', courseName: '进阶绘本', date: '2026-10-15', startTime: '19:00', endTime: '20:30', status: 'completed' },
    ],
    {
      'sch-1': {
        schedule: { id: 'sch-1', campusId: 'campus-bj-hq', className: '启蒙英语-001班', date: '2026-10-14', startTime: '18:16', endTime: '19:46' },
        students: [
          { studentId: 'stu-01', studentNo: 'S950000', name: '兰岚', phone: '15237356327', remainingLessons: 12, evaluated: false },
          { studentId: 'stu-02', studentNo: 'S950002', name: '王思博', phone: '13525086086', remainingLessons: 2, evaluated: true },
        ],
      },
      'sch-2': {
        schedule: { id: 'sch-2', campusId: 'campus-bj-hq', className: '进阶绘本-002班', date: '2026-10-15', startTime: '19:00', endTime: '20:30' },
        students: [
          { studentId: 'stu-03', studentNo: 'S950004', name: '潘程皓', phone: '15090434720', remainingLessons: 20, evaluated: false },
        ],
      },
    }
  );

  const projector2 = createEvaluationRosterProjector({ queryPort: queryPort2, cachePort: cachePort2 });
  const view2 = await projector2.projectRoster({ campusId: 'campus-bj-hq' });

  assert.strictEqual(view2.campusId, 'campus-bj-hq');
  assert.strictEqual(view2.items.length, 3, '❌ 两个排课的 3 名学员未全量展平');
  assert.strictEqual(view2.source, 'network_fresh');

  const lanLan = view2.items.find((i) => i.id === 'stu-01');
  assert.ok(lanLan, '❌ 兰岚记录缺失');
  assert.strictEqual(lanLan.name, '兰岚');
  assert.strictEqual(lanLan.phone, '15237356327');
  assert.strictEqual(lanLan.studentNo, 'S950000');
  assert.strictEqual(lanLan.className, '启蒙英语-001班');
  assert.strictEqual(lanLan.isPushed, false);
  assert.strictEqual(lanLan.pushStatusText, '未推送');
  assert.strictEqual(lanLan.isLowBalance, false);

  const wangSiBo = view2.items.find((i) => i.id === 'stu-02');
  assert.ok(wangSiBo, '❌ 王思博记录缺失');
  assert.strictEqual(wangSiBo.isPushed, true);
  assert.strictEqual(wangSiBo.pushStatusText, '已推送');
  assert.strictEqual(wangSiBo.isLowBalance, true, '❌ 余2课时未命中低额课时预警');
  console.log('✔ [场景 2] 展平投影、低额课时标签与字段映射正确无误\n');

  // ----------------------------------------------------
  // Scenario 3: 消除 N+1 串行瀑布与受控 4 路并发池验证
  // ----------------------------------------------------
  console.log('▶ [场景 3] 受控并发池 (Concurrency = 4) 压力与限流验证');
  const queryPort3 = new MockRosterQueryAdapter();
  const cachePort3 = new MemoryRosterCacheAdapter();

  // 构造 10 个排课日程
  const schedules10 = Array.from({ length: 10 }, (_, i) => ({
    id: `sch-${i + 1}`,
    campusId: 'campus-bj-hq',
    classId: `cls-${i + 1}`,
    className: `高频并发班级-${i + 1}`,
    courseName: '全能测试课',
    date: '2026-10-16',
    startTime: '10:00',
    endTime: '11:00',
    status: 'completed',
  }));
  const workbenches10 = {};
  schedules10.forEach((s) => {
    workbenches10[s.id] = {
      schedule: s,
      students: [{ studentId: `stu-${s.id}`, name: `学员-${s.id}`, evaluated: false }],
    };
  });
  queryPort3.setMockData('campus-bj-hq', schedules10, workbenches10);

  const projector3 = createEvaluationRosterProjector({
    queryPort: queryPort3,
    cachePort: cachePort3,
    concurrency: 4,
  });

  const view3 = await projector3.projectRoster({ campusId: 'campus-bj-hq' });
  assert.strictEqual(view3.items.length, 10);
  assert.strictEqual(queryPort3.totalWorkbenchCalls, 10, '❌ 10 个排课的工作台必须全部调用');
  assert.ok(
    queryPort3.maxConcurrentWorkbenchRequests <= 4,
    `❌ 瞬时最大并发数 (${queryPort3.maxConcurrentWorkbenchRequests}) 超出了受控限制 4`
  );
  console.log(`✔ [场景 3] 受控并发池通过：10 项请求瞬时最大活跃数 = ${queryPort3.maxConcurrentWorkbenchRequests} <= 4\n`);

  // ----------------------------------------------------
  // Scenario 4: 校区上下文绝对隔离
  // ----------------------------------------------------
  console.log('▶ [场景 4] 校区上下文绝对隔离');
  const queryPort4 = new MockRosterQueryAdapter();
  const cachePort4 = new MemoryRosterCacheAdapter();

  queryPort4.setMockData('campus-A', [
    { id: 'sch-A', campusId: 'campus-A', classId: 'cls-A', className: '校区A班级', courseName: '语文', date: '2026-10-16', startTime: '09:00', endTime: '10:00', status: 'completed' }
  ], {
    'sch-A': { schedule: { id: 'sch-A', campusId: 'campus-A', className: '校区A班级', date: '2026-10-16', startTime: '09:00', endTime: '10:00' }, students: [{ studentId: 's-A1', name: '校区A学生', evaluated: false }] }
  });

  queryPort4.setMockData('campus-B', [
    { id: 'sch-B', campusId: 'campus-B', classId: 'cls-B', className: '校区B班级', courseName: '数学', date: '2026-10-16', startTime: '09:00', endTime: '10:00', status: 'completed' }
  ], {
    'sch-B': { schedule: { id: 'sch-B', campusId: 'campus-B', className: '校区B班级', date: '2026-10-16', startTime: '09:00', endTime: '10:00' }, students: [{ studentId: 's-B1', name: '校区B学生', evaluated: true }] }
  });

  const projector4 = createEvaluationRosterProjector({ queryPort: queryPort4, cachePort: cachePort4 });

  const viewA = await projector4.projectRoster({ campusId: 'campus-A' });
  const viewB = await projector4.projectRoster({ campusId: 'campus-B' });

  assert.strictEqual(viewA.items.length, 1);
  assert.strictEqual(viewA.items[0].name, '校区A学生');
  assert.strictEqual(viewB.items.length, 1);
  assert.strictEqual(viewB.items[0].name, '校区B学生');
  console.log('✔ [场景 4] 双校区数据查询与缓存完全隔离\n');

  // ----------------------------------------------------
  // Scenario 5: SWR（先发缓存 + 后台静默再校验）
  // ----------------------------------------------------
  console.log('▶ [场景 5] SWR 机制：本地瞬时先发返回与后台静默更新');
  const queryPort5 = new MockRosterQueryAdapter();
  const cachePort5 = new MemoryRosterCacheAdapter();

  queryPort5.setMockData('campus-swr', [
    { id: 'sch-swr', campusId: 'campus-swr', classId: 'cls-swr', className: 'SWR测试班', courseName: '物理', date: '2026-10-16', startTime: '14:00', endTime: '15:00', status: 'completed' }
  ], {
    'sch-swr': {
      schedule: { id: 'sch-swr', campusId: 'campus-swr', className: 'SWR测试班', date: '2026-10-16', startTime: '14:00', endTime: '15:00' },
      students: [{ studentId: 'stu-initial', name: '初始学员', evaluated: false }]
    }
  });

  const projector5 = createEvaluationRosterProjector({ queryPort: queryPort5, cachePort: cachePort5 });

  // 第一次请求：冷启动，填充缓存
  const firstView = await projector5.projectRoster({ campusId: 'campus-swr' });
  assert.strictEqual(firstView.source, 'network_fresh');
  assert.strictEqual(firstView.items[0].name, '初始学员');

  // 修改远程数据源（模拟后台有新推送产生）
  queryPort5.setMockData('campus-swr', [
    { id: 'sch-swr', campusId: 'campus-swr', classId: 'cls-swr', className: 'SWR测试班', courseName: '物理', date: '2026-10-16', startTime: '14:00', endTime: '15:00', status: 'completed' }
  ], {
    'sch-swr': {
      schedule: { id: 'sch-swr', campusId: 'campus-swr', className: 'SWR测试班', date: '2026-10-16', startTime: '14:00', endTime: '15:00' },
      students: [
        { studentId: 'stu-initial', name: '初始学员', evaluated: true },
        { studentId: 'stu-new', name: '新报道学员', evaluated: false },
      ]
    }
  });

  // 第二次请求：命中 SWR 缓存，立即返回旧数据 (source: 'cache_instant')，并在后台静默触发 revalidate
  let revalidatedCallbackView = null;
  const swrPromise = projector5.projectRoster({ campusId: 'campus-swr' }, (fresh) => {
    revalidatedCallbackView = fresh;
  });

  const instantView = await swrPromise;
  assert.strictEqual(instantView.source, 'cache_instant', '❌ 第二次请求未瞬间交付缓存数据');
  assert.strictEqual(instantView.items.length, 1, '❌ 瞬间返回的视图应为 1 条旧条目');

  // 等待后台静默再校验完成
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(revalidatedCallbackView, '❌ onRevalidated 回调未被调用');
  assert.strictEqual(revalidatedCallbackView.source, 'network_fresh');
  assert.strictEqual(revalidatedCallbackView.items.length, 2, '❌ 再校验交付的数据应包含 2 条最新学员');
  console.log('✔ [场景 5] SWR 瞬间先发与后台静默通知回调全链路正常\n');

  // ----------------------------------------------------
  // Scenario 6: 缓存失效与 forceRefresh 穿透
  // ----------------------------------------------------
  console.log('▶ [场景 6] invalidateCampusCache 与 forceRefresh 强制穿透');
  const queryPort6 = new MockRosterQueryAdapter();
  const cachePort6 = new MemoryRosterCacheAdapter();

  queryPort6.setMockData('campus-inv', [
    { id: 'sch-inv', campusId: 'campus-inv', classId: 'cls-inv', className: '失效班', courseName: '化学', date: '2026-10-16', startTime: '16:00', endTime: '17:00', status: 'completed' }
  ], {
    'sch-inv': { schedule: { id: 'sch-inv', campusId: 'campus-inv', className: '失效班', date: '2026-10-16', startTime: '16:00', endTime: '17:00' }, students: [{ studentId: 'stu-inv', name: '化学学员', evaluated: false }] }
  });

  const projector6 = createEvaluationRosterProjector({ queryPort: queryPort6, cachePort: cachePort6 });
  await projector6.projectRoster({ campusId: 'campus-inv' }); // 填充缓存

  // 主动失效
  projector6.invalidateCampusCache('campus-inv');

  const reloadedView = await projector6.projectRoster({ campusId: 'campus-inv' });
  assert.strictEqual(reloadedView.source, 'network_fresh', '❌ invalidateCampusCache 后未能穿透至网络拉取');

  // forceRefresh: true 测试
  const forcedView = await projector6.projectRoster({ campusId: 'campus-inv', forceRefresh: true });
  assert.strictEqual(forcedView.source, 'network_fresh', '❌ forceRefresh: true 未能强制穿透');
  console.log('✔ [场景 6] 缓存主动失效与强制穿透通过\n');

  // ----------------------------------------------------
  // Scenario 7: 4 级优雅降级沙箱容错
  // ----------------------------------------------------
  console.log('▶ [场景 7] 4 级优雅降级沙箱容错');
  const queryPort7 = new MockRosterQueryAdapter();
  const cachePort7 = new MemoryRosterCacheAdapter();

  // 子场景 7.1: 单个排课工作台抛出 500，其余排课不受牵连
  queryPort7.setMockData('campus-degraded', [
    { id: 'sch-ok', campusId: 'campus-degraded', classId: 'cls-1', className: '正常班', courseName: '历史', date: '2026-10-16', startTime: '08:00', endTime: '09:00', status: 'completed' },
    { id: 'sch-fail', campusId: 'campus-degraded', classId: 'cls-2', className: '故障班', courseName: '地理', date: '2026-10-16', startTime: '09:00', endTime: '10:00', status: 'completed' },
  ], {
    'sch-ok': { schedule: { id: 'sch-ok', campusId: 'campus-degraded', className: '正常班', date: '2026-10-16', startTime: '08:00', endTime: '09:00' }, students: [{ studentId: 'stu-ok', name: '正常学生', evaluated: true }] }
  });
  queryPort7.shouldThrowOnWorkbenchId = 'sch-fail';

  const projector7 = createEvaluationRosterProjector({ queryPort: queryPort7, cachePort: cachePort7 });
  const degradedPartView = await projector7.projectRoster({ campusId: 'campus-degraded' });
  assert.strictEqual(degradedPartView.items.length, 1, '❌ 部分失败时正常项应正常渲染');
  assert.strictEqual(degradedPartView.items[0].name, '正常学生');

  // 子场景 7.2: 全盘网络崩溃，如果存在旧缓存，返回 degraded_fallback 兜底
  // 先把 sch-fail 恢复以种下成功缓存
  queryPort7.shouldThrowOnWorkbenchId = null;
  queryPort7.workbenchByScheduleId.set('sch-fail', {
    schedule: { id: 'sch-fail', campusId: 'campus-degraded', className: '故障班', date: '2026-10-16', startTime: '09:00', endTime: '10:00' },
    students: [{ studentId: 'stu-f', name: '故障班学生', evaluated: false }]
  });
  await projector7.projectRoster({ campusId: 'campus-degraded', forceRefresh: true });

  // 此时全盘网络断网
  queryPort7.shouldThrowOnScheduleQuery = true;
  const offlineFallbackView = await projector7.projectRoster({ campusId: 'campus-degraded', forceRefresh: true });
  assert.strictEqual(offlineFallbackView.source, 'degraded_fallback', '❌ 离线网络断开时未能降级至 fallback 缓存');
  assert.strictEqual(offlineFallbackView.items.length, 2);

  // 子场景 7.3: 全盘网络断网且从未存过缓存，返回安全空对象阻断白屏崩溃
  const offlineEmptyView = await projector7.projectRoster({ campusId: 'campus-never-seen', forceRefresh: true });
  assert.strictEqual(offlineEmptyView.source, 'degraded_fallback');
  assert.strictEqual(offlineEmptyView.items.length, 0);
  assert.strictEqual(offlineEmptyView.metrics.totalCount, 0);
  console.log('✔ [场景 7] 4 级优雅降级沙箱容错与白屏阻断验证通过\n');

  // ----------------------------------------------------
  // Scenario 8: 单趟流式指标规约与分面过滤
  // ----------------------------------------------------
  console.log('▶ [场景 8] 单趟流式指标规约与分面过滤');
  const queryPort8 = new MockRosterQueryAdapter();
  const cachePort8 = new MemoryRosterCacheAdapter();

  queryPort8.setMockData('campus-metrics', [
    { id: 'sch-m', campusId: 'campus-metrics', classId: 'cls-m', className: '进阶火箭班', courseName: '奥数', date: '2026-10-16', startTime: '18:00', endTime: '19:30', status: 'completed' }
  ], {
    'sch-m': {
      schedule: { id: 'sch-m', campusId: 'campus-metrics', className: '进阶火箭班', date: '2026-10-16', startTime: '18:00', endTime: '19:30' },
      students: [
        { studentId: 's1', studentNo: 'S001', name: '张三', phone: '13811112222', evaluated: true },
        { studentId: 's2', studentNo: 'S002', name: '李四', phone: '13933334444', evaluated: false },
        { studentId: 's3', studentNo: 'S003', name: '张小五', phone: '13755556666', evaluated: false },
        { studentId: 's4', studentNo: 'S004', name: '赵六', phone: '13677778888', evaluated: true },
      ]
    }
  });

  const projector8 = createEvaluationRosterProjector({ queryPort: queryPort8, cachePort: cachePort8 });

  // 1. 全量状态指标
  const fullView = await projector8.projectRoster({ campusId: 'campus-metrics' });
  assert.strictEqual(fullView.metrics.totalCount, 4);
  assert.strictEqual(fullView.metrics.pushedCount, 2);
  assert.strictEqual(fullView.metrics.pendingCount, 2);
  assert.strictEqual(fullView.metrics.coverageRate, 50);
  assert.strictEqual(fullView.metrics.coverageRateText, '50%');
  assert.strictEqual(fullView.items.length, 4);

  // 2. 状态分面：仅待评
  const pendingView = await projector8.projectRoster({ campusId: 'campus-metrics', statusFilter: 'pending' });
  assert.strictEqual(pendingView.items.length, 2);
  assert.ok(pendingView.items.every((i) => !i.isPushed));
  // 顶层全局盘子指标应保持全量全景
  assert.strictEqual(pendingView.metrics.totalCount, 4);

  // 3. 状态分面：仅已推送
  const pushedView = await projector8.projectRoster({ campusId: 'campus-metrics', statusFilter: 'pushed' });
  assert.strictEqual(pushedView.items.length, 2);
  assert.ok(pushedView.items.every((i) => i.isPushed));

  // 4. 关键字搜索匹配姓名
  const searchNameView = await projector8.projectRoster({ campusId: 'campus-metrics', keyword: '张' });
  assert.strictEqual(searchNameView.items.length, 2); // 张三, 张小五

  // 5. 关键字搜索匹配学号
  const searchNoView = await projector8.projectRoster({ campusId: 'campus-metrics', keyword: 'S002' });
  assert.strictEqual(searchNoView.items.length, 1);
  assert.strictEqual(searchNoView.items[0].name, '李四');

  // 6. 关键字搜索匹配手机
  const searchPhoneView = await projector8.projectRoster({ campusId: 'campus-metrics', keyword: '1367777' });
  assert.strictEqual(searchPhoneView.items.length, 1);
  assert.strictEqual(searchPhoneView.items[0].name, '赵六');

  console.log('✔ [场景 8] 单趟流式指标（待评、已评、覆盖率）与多字段分面搜索过滤完全符合预期\n');

  console.log('======================================================');
  console.log('🎉 待评花名册投影深模块 (EvaluationRosterProjector) 8 大场景全部测试通过！');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
