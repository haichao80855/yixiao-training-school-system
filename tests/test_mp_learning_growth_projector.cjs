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
console.log('🧪 运行微信小程序端多媒体学情成长投影深模块 (LearningGrowthProjector) 契约与单元测试');
console.log('======================================================\n');

// 加载构建产物
const projectorModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/projectors/learning-growth/index.js'
);
const imported = require(projectorModulePath);
const learningGrowthProjector = imported.learningGrowthProjector;
const createLearningGrowthProjector = imported.createLearningGrowthProjector || learningGrowthProjector.createProjector;
const MemoryGrowthQueryAdapter = imported.MemoryGrowthQueryAdapter || learningGrowthProjector.MemoryGrowthQueryAdapter;
const MemoryGrowthCacheAdapter = imported.MemoryGrowthCacheAdapter || learningGrowthProjector.MemoryGrowthCacheAdapter;
const DefaultLearningGrowthProjector = imported.DefaultProjectorClass || learningGrowthProjector.DefaultProjectorClass;

let passedCount = 0;

async function runScenario(title, fn) {
  process.stdout.write(`▶ 测试场景: ${title} ... `);
  try {
    await fn();
    console.log('✅ 通过');
    passedCount++;
  } catch (err) {
    console.log('❌ 失败');
    console.error(err);
    process.exit(1);
  }
}

async function runAllTests() {
  // --------------------------------------------------------------------------
  // 场景 1: 接缝形态与接口完备性校验 (Seam Integrity & Zero Leaks)
  // --------------------------------------------------------------------------
  await runScenario('Scene 1: 接缝形态与接口完备性校验', async () => {
    assert(learningGrowthProjector, '默认导出的 learningGrowthProjector 单例必须存在');
    assert.strictEqual(typeof learningGrowthProjector.projectLessonGrowth, 'function', 'projectLessonGrowth 核心接缝方法必须存在');
    assert.strictEqual(typeof learningGrowthProjector.evictGrowthCache, 'function', 'evictGrowthCache 缓存驱逐方法必须存在');
    assert.strictEqual(typeof learningGrowthProjector.generateRadarSvgPoints, 'function', 'generateRadarSvgPoints 原生SVG点计算方法必须暴露');
    assert.strictEqual(typeof createLearningGrowthProjector, 'function', '工厂函数 createLearningGrowthProjector 必须存在');
  });

  // --------------------------------------------------------------------------
  // 场景 2: 专属回执接口标准学情投影与视图模型完整性 (Full Direct Projection)
  // --------------------------------------------------------------------------
  await runScenario('Scene 2: 专属回执接口标准学情投影与视图模型完整性', async () => {
    const memoryQuery = new MemoryGrowthQueryAdapter();
    const memoryCache = new MemoryGrowthCacheAdapter();
    const projector = createLearningGrowthProjector({
      queryPort: memoryQuery,
      cachePort: memoryCache,
    });

    // 预置单课专属回执数据
    memoryQuery.setMockParentLesson('sch-001', {
      studentName: '董御',
      lesson: {
        lessonId: 'lesson-001',
        scheduleEventId: 'sch-001',
        dateFormatted: '2026-10-13',
        timeSlot: '18:30 - 20:30',
        courseName: '启蒙英语 L1 精品班',
        lessonTitle: 'Unit 3: Colors & Shapes',
        teacherName: '冯老师',
        ratingScore: 5.0,
        performanceTag: '口语标兵',
        personalizedComment: '董御本节课发音饱满标准，主动与外教积极互动，表现极其优异！',
        syllabusPoints: ['颜色与基础形状高频词汇', '随堂句型口语问答对话'],
        photos: [
          { url: 'https://cdn.example.com/photos/1.jpg', thumbUrl: 'https://cdn.example.com/photos/1-thumb.jpg' },
          { url: 'https://cdn.example.com/photos/2.jpg', thumbUrl: 'https://cdn.example.com/photos/2-thumb.jpg' },
        ],
        video: {
          videoUrl: 'https://cdn.example.com/videos/v1.mp4',
          coverUrl: 'https://cdn.example.com/videos/v1-cover.jpg',
        },
        badges: [
          { name: '口语新星', icon: 'star', desc: '口语发音饱满标准' },
          { name: '互动达人', icon: 'zap', desc: '积极参与随堂问答' },
        ],
      },
    });

    const view = await projector.projectLessonGrowth({
      scheduleId: 'sch-001',
      studentId: 'stu-01',
    });

    assert.strictEqual(view.studentId, 'stu-01');
    assert.strictEqual(view.studentName, '董御');
    assert.strictEqual(view.className, '启蒙英语 L1 精品班');
    assert.strictEqual(view.score, 98, '5.0 分折合 98 分');
    assert.strictEqual(view.levelText, 'A+');
    assert.strictEqual(view.performanceTag, '口语标兵');
    assert.strictEqual(view.photos.length, 2);
    assert(view.video && view.video.videoUrl === 'https://cdn.example.com/videos/v1.mp4');
    assert.strictEqual(view.badges.length, 2);
    assert.strictEqual(view.radarDimensions.length, 5);
    assert(view.radarSvgPolygonPoints.length > 0, '雷达图多边形顶点必须有效生成');
    assert.strictEqual(view.source, 'network_fresh');
  });

  // --------------------------------------------------------------------------
  // 场景 3: 纯数学原生 SVG 5 维雷达几何坐标计算精准性 (Pure Math Radar SVG)
  // --------------------------------------------------------------------------
  await runScenario('Scene 3: 纯数学原生 SVG 5 维雷达几何坐标计算精准性', async () => {
    const memoryQuery = new MemoryGrowthQueryAdapter();
    const memoryCache = new MemoryGrowthCacheAdapter();
    const projector = createLearningGrowthProjector({
      queryPort: memoryQuery,
      cachePort: memoryCache,
    });

    // 测试满分 (全部 100 分):
    // 几何参数: cx=100, cy=100, r=80.
    // 维度 0: angle = -PI/2 (正上方, 12点钟方向) => x = 100 + 80 * cos(-PI/2) = 100, y = 100 + 80 * sin(-PI/2) = 20
    const fullDimensions = [
      { key: 'focus', label: '专注力', score: 100 },
      { key: 'expression', label: '表达力', score: 100 },
      { key: 'logic', label: '逻辑力', score: 100 },
      { key: 'practice', label: '动手力', score: 100 },
      { key: 'collaboration', label: '合作力', score: 100 },
    ];
    const fullPoints = projector.generateRadarSvgPoints(fullDimensions);
    const pointPairs = fullPoints.split(' ');
    assert.strictEqual(pointPairs.length, 5, '雷达图多边形必须包含精确的 5 个顶点坐标对');

    const firstPoint = pointPairs[0].split(',');
    assert.strictEqual(parseFloat(firstPoint[0]), 100, '满分时 12 点钟顶点 X 坐标必须为 100');
    assert.strictEqual(parseFloat(firstPoint[1]), 20, '满分时 12 点钟顶点 Y 坐标必须为 20 (100 - 80)');

    // 测试 0 分兜底 (内部防坍塌保底比例为 10% 即 score 10):
    // r = 80 * 0.1 = 8. 顶点 Y = 100 - 8 = 92
    const zeroDimensions = [
      { key: 'focus', label: '专注力', score: 0 },
      { key: 'expression', label: '表达力', score: 0 },
      { key: 'logic', label: '逻辑力', score: 0 },
      { key: 'practice', label: '动手力', score: 0 },
      { key: 'collaboration', label: '合作力', score: 0 },
    ];
    const zeroPoints = projector.generateRadarSvgPoints(zeroDimensions);
    const zeroFirstPair = zeroPoints.split(' ')[0].split(',');
    assert.strictEqual(parseFloat(zeroFirstPair[0]), 100, '0 分防坍塌保底顶点 X 必须仍为 100');
    assert.strictEqual(parseFloat(zeroFirstPair[1]), 92, '0 分防坍塌保底顶点 Y 必须内缩至 92');

    // 测试 SVG Data URI 编码生成 (兼容微信小程序 WXML <image>)
    const dataUri = projector.generateRadarSvgDataUri(fullPoints, fullDimensions);
    assert.ok(dataUri.startsWith('data:image/svg+xml;utf8,'), 'Data URI 必须以 data:image/svg+xml;utf8, 开头');
    assert.ok(dataUri.includes('viewBox%3D%220%200%20200%20200%22') || dataUri.includes('viewBox'), 'Data URI 必须包含 viewBox');
    assert.ok(dataUri.includes('points%3D%22') || dataUri.includes('points'), 'Data URI 必须包含多边形 points');
  });

  // --------------------------------------------------------------------------
  // 场景 4: 双数据源平滑无感降级同构水化 (Graceful Fallback to Workbench)
  // --------------------------------------------------------------------------
  await runScenario('Scene 4: 双数据源平滑无感降级同构水化 (结课工作台降级)', async () => {
    const memoryQuery = new MemoryGrowthQueryAdapter();
    const memoryCache = new MemoryGrowthCacheAdapter();
    const projector = createLearningGrowthProjector({
      queryPort: memoryQuery,
      cachePort: memoryCache,
    });

    // 不设置单课回执 (simulate 404 or not-yet-generated)，只设置结课履约工作台数据
    memoryQuery.setMockWorkbench('sch-wb-02', {
      schedule: {
        id: 'sch-wb-02',
        campusId: 'campus-bj-hq',
        className: '少林武术基础一班',
        courseName: '少儿少林武术',
        teacherName: '李教练',
        date: '2026-10-14',
        startTime: '16:00',
        endTime: '17:30',
        timeRange: '16:00-17:30',
        status: 'completed',
      },
      evaluationSummary: {
        teacherComment: '全班马步扎实，精气神极佳！',
        overallRating: 5.0,
        photoList: [
          'https://cdn.example.com/martial/photo1.jpg',
          'https://cdn.example.com/martial/photo2.jpg',
        ],
        videoUrl: 'https://cdn.example.com/martial/video.mp4',
      },
      students: [
        {
          studentId: 'stu-martial-01',
          name: '张景恒',
          studentNo: 'S950007',
          status: 'present',
          comment: '张景恒冲拳有力，韧带拉伸到位！',
          rating: 4.8,
          performanceTag: '武术先锋',
        },
      ],
    });

    const view = await projector.projectLessonGrowth({
      scheduleId: 'sch-wb-02',
      studentId: 'stu-martial-01',
    });

    assert.strictEqual(view.studentId, 'stu-martial-01');
    assert.strictEqual(view.studentName, '张景恒');
    assert.strictEqual(view.className, '少林武术基础一班');
    assert.strictEqual(view.score, 94, '4.8 星折算 94 分');
    assert.strictEqual(view.levelText, 'A');
    assert.strictEqual(view.performanceTag, '武术先锋');
    assert.strictEqual(view.photos.length, 2, '相册必须包含工作台填报的 photoList');
    assert(view.video && view.video.videoUrl === 'https://cdn.example.com/martial/video.mp4');
    assert(view.teacherComment.includes('冲拳有力'), '评语必须优先提取个人差异化评语');
    assert.strictEqual(view.source, 'network_fresh');
  });

  // --------------------------------------------------------------------------
  // 场景 5: 3 分钟短时缓存 (SWR / Cache Eviction & Force Refresh)
  // --------------------------------------------------------------------------
  await runScenario('Scene 5: 3 分钟短时缓存 (SWR / Cache Eviction & Force Refresh)', async () => {
    const memoryQuery = new MemoryGrowthQueryAdapter();
    const memoryCache = new MemoryGrowthCacheAdapter();
    const projector = createLearningGrowthProjector({
      queryPort: memoryQuery,
      cachePort: memoryCache,
      cacheTtlMs: 180000,
    });

    memoryQuery.setMockParentLesson('sch-cache-03', {
      studentName: '吴炳润',
      lesson: {
        lessonId: 'lesson-03',
        scheduleEventId: 'sch-cache-03',
        dateFormatted: '2026-10-15',
        timeSlot: '14:00 - 15:30',
        courseName: 'Scratch 编程',
        lessonTitle: '循环与逻辑控制',
        teacherName: '赵老师',
        ratingScore: 4.5,
        personalizedComment: '初次缓存评语',
      },
    });

    // 第一次调用：产生网络查询并写入缓存
    const v1 = await projector.projectLessonGrowth({
      scheduleId: 'sch-cache-03',
      studentId: 'stu-cache-01',
    });
    assert.strictEqual(v1.source, 'network_fresh');
    assert.strictEqual(v1.teacherComment, '初次缓存评语');

    // 第二次调用：应当直接命中缓存 (source: 'cache_instant')
    const v2 = await projector.projectLessonGrowth({
      scheduleId: 'sch-cache-03',
      studentId: 'stu-cache-01',
    });
    assert.strictEqual(v2.source, 'cache_instant', '未传 forceRefresh 且缓存未过期时应命中 instant 缓存');
    assert.strictEqual(v2.teacherComment, '初次缓存评语');

    // 修改源数据并强制刷新 forceRefresh: true
    memoryQuery.setMockParentLesson('sch-cache-03', {
      studentName: '吴炳润',
      lesson: {
        lessonId: 'lesson-03',
        scheduleEventId: 'sch-cache-03',
        dateFormatted: '2026-10-15',
        timeSlot: '14:00 - 15:30',
        courseName: 'Scratch 编程',
        lessonTitle: '循环与逻辑控制',
        teacherName: '赵老师',
        ratingScore: 5.0,
        personalizedComment: '强制刷新后的最新评语',
      },
    });

    const v3 = await projector.projectLessonGrowth({
      scheduleId: 'sch-cache-03',
      studentId: 'stu-cache-01',
      forceRefresh: true,
    });
    assert.strictEqual(v3.source, 'network_fresh', '强制刷新必须穿透缓存重新获取');
    assert.strictEqual(v3.teacherComment, '强制刷新后的最新评语');

    // 测试主动驱逐 evictGrowthCache
    projector.evictGrowthCache('sch-cache-03');
    const cachedItem = memoryCache.get('growth_cache_sch-cache-03_stu-cache-01');
    assert.strictEqual(cachedItem, null, 'evictGrowthCache 必须彻底清空该排课下的全部学情缓存');
  });

  // --------------------------------------------------------------------------
  // 场景 6: 4 级优雅降级与防御性容错防白屏 (Robust Defensive Sandbox)
  // --------------------------------------------------------------------------
  await runScenario('Scene 6: 4 级优雅降级与防御性容错防白屏', async () => {
    const memoryQuery = new MemoryGrowthQueryAdapter();
    const memoryCache = new MemoryGrowthCacheAdapter();
    const projector = createLearningGrowthProjector({
      queryPort: memoryQuery,
      cachePort: memoryCache,
    });

    // 既没有单课专属回执，工作台数据也没有 (mock 未配置，直接抛出未找到异常)
    const fallbackView = await projector.projectLessonGrowth({
      scheduleId: 'sch-error-04',
      studentId: 'stu-error-01',
    });

    assert(fallbackView, '异常状态下不得白屏崩溃，必须返回安全的兜底沙箱视图');
    assert.strictEqual(fallbackView.studentId, 'stu-error-01');
    assert.strictEqual(fallbackView.score, 88, '兜底安全评分 88 分');
    assert.strictEqual(fallbackView.levelText, 'A');
    assert.strictEqual(fallbackView.source, 'degraded_fallback');
    assert(fallbackView.teacherComment.length > 0, '安全寄语');
    assert.strictEqual(fallbackView.radarDimensions.length, 5, '必须具备标准的 5 维雷达结构');
    assert(fallbackView.radarSvgPolygonPoints.length > 0, '必须生成合法的 SVG 雷达点');
  });

  // --------------------------------------------------------------------------
  // 场景 7: 多学员及多课次作用域物理隔离 (Scope & Student Isolation)
  // --------------------------------------------------------------------------
  await runScenario('Scene 7: 多学员及多课次作用域物理隔离', async () => {
    const memoryQuery = new MemoryGrowthQueryAdapter();
    const memoryCache = new MemoryGrowthCacheAdapter();
    const projector = createLearningGrowthProjector({
      queryPort: memoryQuery,
      cachePort: memoryCache,
    });

    // 设置同一排课下两个不同学员的工作台数据
    memoryQuery.setMockWorkbench('sch-multi', {
      schedule: {
        id: 'sch-multi',
        campusId: 'campus-bj-hq',
        className: '小提琴重奏班',
        date: '2026-10-16',
        startTime: '10:00',
        endTime: '11:30',
        status: 'completed',
      },
      evaluationSummary: {
        teacherComment: '全班重奏配合默契！',
        overallRating: 4.8,
      },
      students: [
        {
          studentId: 'stu-A',
          name: '学员甲',
          status: 'present',
          comment: '学员甲音准极其完美，揉弦自然！',
          rating: 5.0,
          performanceTag: '音准大师',
        },
        {
          studentId: 'stu-B',
          name: '学员乙',
          status: 'present',
          comment: '学员乙节奏稳定，握弓手势标准！',
          rating: 4.2,
          performanceTag: '节奏标兵',
        },
      ],
    });

    const viewA = await projector.projectLessonGrowth({ scheduleId: 'sch-multi', studentId: 'stu-A' });
    const viewB = await projector.projectLessonGrowth({ scheduleId: 'sch-multi', studentId: 'stu-B' });

    assert.strictEqual(viewA.studentId, 'stu-A');
    assert.strictEqual(viewA.studentName, '学员甲');
    assert.strictEqual(viewA.performanceTag, '音准大师');
    assert.strictEqual(viewA.score, 98);

    assert.strictEqual(viewB.studentId, 'stu-B');
    assert.strictEqual(viewB.studentName, '学员乙');
    assert.strictEqual(viewB.performanceTag, '节奏标兵');
    assert.strictEqual(viewB.score, 82);

    // 检查缓存键相互隔离
    const cacheA = memoryCache.get('growth_cache_sch-multi_stu-A');
    const cacheB = memoryCache.get('growth_cache_sch-multi_stu-B');
    assert.strictEqual(cacheA.studentName, '学员甲');
    assert.strictEqual(cacheB.studentName, '学员乙');
  });

  // --------------------------------------------------------------------------
  // 场景 8: 双适配器替换与测试同态性 (Port & Adapter Substitutability)
  // --------------------------------------------------------------------------
  await runScenario('Scene 8: 双适配器替换与测试同态性', async () => {
    const mockStorage = new Map();
    const customCacheAdapter = {
      get(key) {
        return mockStorage.get(key) || null;
      },
      set(key, value, ttlMs) {
        mockStorage.set(key, value);
      },
      remove(key) {
        mockStorage.delete(key);
      },
      clearByPrefix(prefix) {
        for (const k of Array.from(mockStorage.keys())) {
          if (k.startsWith(prefix)) {
            mockStorage.delete(k);
          }
        }
      },
    };

    const customQueryAdapter = {
      async fetchParentSingleLesson(scheduleId) {
        return {
          studentName: '同态学员',
          lesson: {
            lessonId: 'lesson-custom',
            scheduleEventId: scheduleId,
            dateFormatted: '2026-10-17',
            timeSlot: '09:00 - 10:30',
            courseName: '少儿围棋大局观',
            lessonTitle: '布局与死活题',
            teacherName: '棋圣',
            ratingScore: 5.0,
            personalizedComment: '布局视野开阔，算路精准！',
          },
        };
      },
      async fetchScheduleWorkbench(scheduleId) {
        return null;
      },
    };

    const customProjector = new DefaultLearningGrowthProjector({
      queryPort: customQueryAdapter,
      cachePort: customCacheAdapter,
    });

    const res = await customProjector.projectLessonGrowth({
      scheduleId: 'sch-custom',
      studentId: 'stu-custom',
    });

    assert.strictEqual(res.studentName, '同态学员');
    assert.strictEqual(res.score, 98);
    assert.strictEqual(res.levelText, 'A+');
    assert(mockStorage.has('growth_cache_sch-custom_stu-custom'), '必须写入自定义缓存适配器');
  });

  console.log(`\n🎉 全部 ${passedCount} 个多媒体学情成长投影深模块契约与单元测试通过！\n`);
}

runAllTests().catch((err) => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
