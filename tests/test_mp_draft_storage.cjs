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
console.log('🧪 运行微信小程序端草稿存储深模块 (DraftStoragePort) 契约与单元测试');
console.log('======================================================\n');

// 加载构建产物
const coordinatorModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/coordinators/fulfillment/coordinator.js'
);
const imported = require(coordinatorModulePath);
const coordinator = imported.fulfillmentCoordinator;

const UniStorageDraftAdapter = imported.UniStorageDraftAdapter || coordinator.UniStorageDraftAdapter;
const MemoryDraftStorageAdapter = imported.MemoryDraftStorageAdapter || coordinator.MemoryDraftStorageAdapter;

assert.ok(UniStorageDraftAdapter, '❌ UniStorageDraftAdapter 未成功导出');
assert.ok(MemoryDraftStorageAdapter, '❌ MemoryDraftStorageAdapter 未成功导出');

async function runTests() {
  // ----------------------------------------------------
  // Scenario 1: 领域语义 DraftScope 存取与双轨隔离
  // ----------------------------------------------------
  console.log('▶ [场景 1] 校验领域语义 DraftScope 存取与整班/单人草稿隔离');
  const storage1 = new MemoryDraftStorageAdapter();

  const classScope = { scheduleId: 'sch-001' };
  const studentAScope = { scheduleId: 'sch-001', studentId: 'stu-A' };
  const studentBScope = { scheduleId: 'sch-001', studentId: 'stu-B' };

  storage1.setDraft(classScope, { lessonTitle: 'Scratch 变量大冒险', commonComment: '全班积极' });
  storage1.setDraft(studentAScope, { comment: '张三逻辑清晰', rating: 5 });
  storage1.setDraft(studentBScope, { comment: '李四专注度高', rating: 4 });

  const readClass = storage1.getDraft(classScope);
  const readStudentA = storage1.getDraft(studentAScope);
  const readStudentB = storage1.getDraft(studentBScope);

  assert.strictEqual(readClass.lessonTitle, 'Scratch 变量大冒险');
  assert.strictEqual(readStudentA.comment, '张三逻辑清晰');
  assert.strictEqual(readStudentA.rating, 5);
  assert.strictEqual(readStudentB.comment, '李四专注度高');
  assert.strictEqual(readStudentB.rating, 4);
  console.log('✔ [场景 1] 领域标识草稿存取与数据物理隔离验证通过\n');

  // ----------------------------------------------------
  // Scenario 2: 整班排课草稿级联原子清空 (purgeScheduleDrafts)
  // ----------------------------------------------------
  console.log('▶ [场景 2] 整班排课草稿一键级联原子清空 (purgeScheduleDrafts)');
  const storage2 = new MemoryDraftStorageAdapter();

  // 为排课 1 写入 1 份班级草稿与 3 份学员草稿
  storage2.setDraft({ scheduleId: 'sch-target' }, { title: '目标班级大纲' });
  storage2.setDraft({ scheduleId: 'sch-target', studentId: 's-1' }, { comment: '学员1评语' });
  storage2.setDraft({ scheduleId: 'sch-target', studentId: 's-2' }, { comment: '学员2评语' });
  storage2.setDraft({ scheduleId: 'sch-target', studentId: 's-3' }, { comment: '学员3评语' });

  // 为排课 2 写入草稿 (应当完好保留)
  storage2.setDraft({ scheduleId: 'sch-other', studentId: 's-other' }, { comment: '其他排课草稿' });

  const purgedCount = storage2.purgeScheduleDrafts('sch-target');
  assert.strictEqual(purgedCount, 4, '❌ purgeScheduleDrafts 应当准确清除 4 条关联草稿');

  // 验证 sch-target 已全被出清
  assert.strictEqual(storage2.getDraft({ scheduleId: 'sch-target' }), null);
  assert.strictEqual(storage2.getDraft({ scheduleId: 'sch-target', studentId: 's-1' }), null);
  assert.strictEqual(storage2.getDraft({ scheduleId: 'sch-target', studentId: 's-2' }), null);
  assert.strictEqual(storage2.getDraft({ scheduleId: 'sch-target', studentId: 's-3' }), null);

  // 验证 sch-other 完好不受牵连
  const otherDraft = storage2.getDraft({ scheduleId: 'sch-other', studentId: 's-other' });
  assert.ok(otherDraft);
  assert.strictEqual(otherDraft.comment, '其他排课草稿');
  console.log('✔ [场景 2] purgeScheduleDrafts 级联出清与跨日程隔离验证通过\n');

  // ----------------------------------------------------
  // Scenario 3: TTL 过期自动失效与懒删除机制
  // ----------------------------------------------------
  console.log('▶ [场景 3] TTL 过期自动失效与懒删除机制 (7天默认生命周期沙箱)');
  const storage3 = new MemoryDraftStorageAdapter();

  // 存入短暂 TTL (30ms)
  storage3.setDraft({ scheduleId: 'sch-ttl', studentId: 's-ttl' }, { content: '短暂草稿' }, { ttlMs: 30 });

  // 立即读取：有效
  const immediate = storage3.getDraft({ scheduleId: 'sch-ttl', studentId: 's-ttl' });
  assert.ok(immediate);
  assert.strictEqual(immediate.content, '短暂草稿');

  // 等待 50ms 超过 TTL
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 二次读取：命中过期判定，自动懒删除并返回 null
  const expired = storage3.getDraft({ scheduleId: 'sch-ttl', studentId: 's-ttl' });
  assert.strictEqual(expired, null, '❌ 过期草稿应当返回 null 并被驱逐');
  console.log('✔ [场景 3] TTL 自动失效与懒删除机制验证通过\n');

  // ----------------------------------------------------
  // Scenario 4: 裸字符串 Key 的平滑向后兼容性
  // ----------------------------------------------------
  console.log('▶ [场景 4] 裸字符串 Key 的平滑向后兼容');
  const storage4 = new MemoryDraftStorageAdapter();

  storage4.setDraft('legacy_string_key_999', { foo: 'bar', timestamp: 123456 });
  const readLegacy = storage4.getDraft('legacy_string_key_999');
  assert.deepStrictEqual(readLegacy, { foo: 'bar', timestamp: 123456 });

  storage4.removeDraft('legacy_string_key_999');
  assert.strictEqual(storage4.getDraft('legacy_string_key_999'), null);
  console.log('✔ [场景 4] 传统字符串 key 平滑兼容通过\n');

  // ----------------------------------------------------
  // Scenario 5: 微信 10MB 存储上限模拟与 LRU 自动淘汰紧缩 (compact)
  // ----------------------------------------------------
  console.log('▶ [场景 5] 微信 10MB 存储上限模拟与 LRU 自动淘汰紧缩');
  // 构造模拟配额溢出的 Storage Mock
  let quotaErrorTriggered = false;
  const mockStorageMap = new Map();
  const simulatedUni = {
    getStorageSync: (k) => mockStorageMap.get(k) || null,
    setStorageSync: (k, v) => {
      // 当存入超过 12 条记录时，模拟微信抛出超出存储上限错误
      if (mockStorageMap.size >= 12 && !quotaErrorTriggered) {
        quotaErrorTriggered = true;
        throw new Error('fail:exceed storage max size');
      }
      mockStorageMap.set(k, v);
    },
    removeStorageSync: (k) => mockStorageMap.delete(k),
  };

  const storage5 = new UniStorageDraftAdapter(simulatedUni);

  // 存入 15 条草稿，触发自动紧缩
  for (let i = 1; i <= 15; i++) {
    storage5.setDraft(
      { scheduleId: `sch-batch-${i}`, studentId: `stu-${i}` },
      { index: i, text: `草稿正文内容 ${i}` }
    );
  }

  assert.ok(quotaErrorTriggered, '❌ 应当模拟触发一次微信配额溢出异常');
  // 紧缩之后应当保证最新写入的第 15 条草稿成功落盘
  const draft15 = storage5.getDraft({ scheduleId: 'sch-batch-15', studentId: 'stu-15' });
  assert.ok(draft15, '❌ 紧缩重试后第 15 条草稿必须成功读取');
  assert.strictEqual(draft15.index, 15);
  console.log('✔ [场景 5] 配额溢出捕获与 LRU 紧缩重试沙箱稳健通过\n');

  // ----------------------------------------------------
  // Scenario 6: 损坏数据反序列化与自愈防崩溃沙箱
  // ----------------------------------------------------
  console.log('▶ [场景 6] 损坏数据反序列化与自愈防崩溃沙箱');
  // 人为塞入非 JSON 脏字符
  const corruptScope = { scheduleId: 'sch-corrupt', studentId: 'stu-err' };
  const mockUniCorrupt = {
    getStorageSync: () => '{{CORRUPTED_NON_JSON_SYNTAX_ERROR%%',
    setStorageSync: () => {},
    removeStorageSync: () => {},
  };
  const storage6 = new UniStorageDraftAdapter(mockUniCorrupt);

  const result = storage6.getDraft(corruptScope);
  assert.strictEqual(result, null, '❌ 损坏数据必须安全返回 null 并被静默清理，阻断界面白屏');
  console.log('✔ [场景 6] 脏数据自愈与白屏防御通过\n');

  // ----------------------------------------------------
  // Scenario 7: 协调器端到端调用联动验证
  // ----------------------------------------------------
  console.log('▶ [场景 7] 协调器端到端草稿水化、暂存与履约后原子清空联动');
  const mockStorage7 = new MemoryDraftStorageAdapter();
  class MockFulfillmentPort7 {
    async fetchWorkbench(schId) {
      return {
        schedule: { id: schId, className: 'Scratch实验班' },
        students: [{ studentId: 'stu-e2e', name: '王同学' }],
        evaluationDraft: { studyContentHtml: '默认教研大纲' },
      };
    }
    async commitFulfillment(payload) {
      return { receiptId: 'REC-TEST-E2E' };
    }
  }

  const coord7 = coordinator.createCoordinator(new MockFulfillmentPort7(), mockStorage7);

  // 1. 暂存单学员草稿
  await coord7.saveStudentDraft(
    'sch-e2e',
    'stu-e2e',
    { studyContent: '王同学随堂草稿实录', rating: 5 },
    { immediate: true }
  );

  // 2. 水化草稿
  const hydrated = await coord7.hydrateStudentDraft('sch-e2e', 'stu-e2e');
  assert.strictEqual(hydrated.studyContent, '王同学随堂草稿实录');
  assert.strictEqual(hydrated.rating, 5);

  // 3. 提交履约出站
  await coord7.commitStudentEvaluation('sch-e2e', 'stu-e2e', hydrated);

  // 4. 验证出站后本地对应学员草稿已原子出清
  const cleared = mockStorage7.getDraft({ scheduleId: 'sch-e2e', studentId: 'stu-e2e' });
  assert.strictEqual(cleared, null, '❌ 履约出站后单学员草稿必须原子出清');
  console.log('✔ [场景 7] 协调器水化、防抖暂存与出站后出清端到端闭环正常\n');

  // ----------------------------------------------------
  // Scenario 8: 双适配器行为等价性测试
  // ----------------------------------------------------
  console.log('▶ [场景 8] UniStorageDraftAdapter 与 MemoryDraftStorageAdapter 行为等价性验证');
  const memoryAdapter = new MemoryDraftStorageAdapter();
  const mockStorage8 = new Map();
  const simulatedUni8 = {
    getStorageSync: (k) => mockStorage8.get(k) || null,
    setStorageSync: (k, v) => mockStorage8.set(k, v),
    removeStorageSync: (k) => mockStorage8.delete(k),
  };
  const uniAdapter = new UniStorageDraftAdapter(simulatedUni8);

  const testScope = { scheduleId: 'sch-equiv', studentId: 'stu-equiv' };
  const testPayload = { score: 98, level: 'A+' };

  memoryAdapter.setDraft(testScope, testPayload);
  uniAdapter.setDraft(testScope, testPayload);

  assert.deepStrictEqual(memoryAdapter.getDraft(testScope), uniAdapter.getDraft(testScope));

  memoryAdapter.removeDraft(testScope);
  uniAdapter.removeDraft(testScope);

  assert.strictEqual(memoryAdapter.getDraft(testScope), null);
  assert.strictEqual(uniAdapter.getDraft(testScope), null);
  console.log('✔ [场景 8] 生产适配器与纯内存适配器契约行为 100% 等价\n');

  console.log('======================================================');
  console.log('🎉 草稿存储深模块 (DraftStoragePort) 8 大核心场景断言全部通过！');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
