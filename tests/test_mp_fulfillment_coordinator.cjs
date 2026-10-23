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

console.log('======================================================');
console.log('🧪 运行微信小程序端教学履约协调器 (Deep Module) 契约与单元测试');
console.log('======================================================\n');

// 导入编译后的协调器模块产物
const coordinatorModulePath = path.resolve(
  __dirname,
  '../mini-program/dist/build/mp-weixin/coordinators/fulfillment/coordinator.js'
);
const { fulfillmentCoordinator } = require(coordinatorModulePath);

assert.ok(fulfillmentCoordinator, '❌ 未能成功导出 fulfillmentCoordinator 模块实例');
assert.ok(typeof fulfillmentCoordinator.fulfill === 'function', '❌ fulfill 方法未导出');
assert.ok(typeof fulfillmentCoordinator.quickFulfill === 'function', '❌ quickFulfill 方法未导出');
assert.ok(typeof fulfillmentCoordinator.loadSession === 'function', '❌ loadSession 方法未导出');
assert.ok(typeof fulfillmentCoordinator.openWorkbench === 'function', '❌ openWorkbench 方法未导出');
assert.ok(typeof fulfillmentCoordinator.saveDraft === 'function', '❌ saveDraft 方法未导出');
assert.ok(typeof fulfillmentCoordinator.hydrateStudentDraft === 'function', '❌ hydrateStudentDraft 方法未导出');
assert.ok(typeof fulfillmentCoordinator.saveStudentDraft === 'function', '❌ saveStudentDraft 方法未导出');
assert.ok(typeof fulfillmentCoordinator.commitStudentEvaluation === 'function', '❌ commitStudentEvaluation 方法未导出');
assert.ok(typeof fulfillmentCoordinator.reverse === 'function', '❌ reverse 方法未导出');
assert.ok(typeof fulfillmentCoordinator.createCoordinator === 'function', '❌ createCoordinator 工厂未导出');

console.log('✔ 协调器深模块接口形态检查通过 (全量工效接缝: quickFulfill, hydrateStudentDraft, saveStudentDraft, commitStudentEvaluation, openWorkbench, reverse)\n');

// 构造 Mock 存储适配器
class MockDraftStorage {
  constructor() {
    this.store = new Map();
  }
  resolveKey(scopeOrKey) {
    if (typeof scopeOrKey === 'string') return scopeOrKey;
    return `eval_draft_${scopeOrKey.scheduleId}${scopeOrKey.studentId ? '_' + scopeOrKey.studentId : ''}`;
  }
  getDraft(key) {
    const k = this.resolveKey(key);
    return this.store.has(k) ? JSON.parse(JSON.stringify(this.store.get(k))) : null;
  }
  setDraft(key, value) {
    const k = this.resolveKey(key);
    this.store.set(k, JSON.parse(JSON.stringify(value)));
  }
  removeDraft(key) {
    const k = this.resolveKey(key);
    this.store.delete(k);
  }
  purgeScheduleDrafts(scheduleId) {
    let count = 0;
    for (const k of Array.from(this.store.keys())) {
      if (k.includes(scheduleId)) {
        this.store.delete(k);
        count++;
      }
    }
    return count;
  }
}

// 构造 Mock 网络服务适配器
class MockFulfillmentPort {
  constructor() {
    this.lastCommitPayload = null;
    this.lastReversePayload = null;
    this.shouldThrowOnReverse = null;
    this.mockStudents = [
      { id: 'stu-101', name: '张小凡', defaultStatus: 'present', defaultDeductLessons: 1 },
      { id: 'stu-102', name: '碧瑶', defaultStatus: 'present', defaultDeductLessons: 1 },
      { id: 'stu-103', name: '陆雪琪', defaultStatus: 'present', defaultDeductLessons: 1 },
    ];
  }

  async fetchWorkbench(scheduleEventId) {
    return {
      schedule: {
        id: scheduleEventId,
        className: '青云志尖子一班',
        courseName: '太极玄清道入门',
        teacherName: '万剑一',
        date: '2026-10-16',
        startTime: '10:00',
        endTime: '11:00',
        status: 'scheduled',
      },
      students: this.mockStudents,
      evaluationSummary: {
        templateId: 'tpl-sword',
        templateName: '仙剑术法模板',
        studyContent: '御剑心法基础运转',
      },
    };
  }

  async commitFulfillment(payload) {
    this.lastCommitPayload = payload;
    return {
      receiptId: `REC-MOCK-${Date.now()}`,
      status: 'success',
      summary: {
        totalStudents: 3,
        defaultPresentCount: 3,
        totalDeductedLessons: 3,
      },
      evaluation: {
        id: 'eval-rec-001',
      },
      outboxSummary: {
        enqueuedCount: payload.mode === 'PUBLISH_EVALUATION' ? 3 : 2,
      },
    };
  }

  async reverseFulfillment(payload) {
    this.lastReversePayload = payload;
    if (this.shouldThrowOnReverse) {
      throw new Error(this.shouldThrowOnReverse);
    }
    return {
      receiptId: `REV-MOCK-${Date.now()}`,
      refundedLessons: 3,
      cancelledOutboxCount: 3,
    };
  }
}

async function runTests() {
  const port = new MockFulfillmentPort();
  const storage = new MockDraftStorage();
  const coordinator = fulfillmentCoordinator.createCoordinator(port, storage);

  // -------------------------------------------------------------
  // Case 1: 零心智通途测试 (Zero-Ceremony Happy Path)
  // -------------------------------------------------------------
  console.log('>>> [Case 1] 测试 90% 零心智极速履约通途 (fulfill)...');
  storage.setDraft('eval_draft_sch-001', { some: 'dangling draft' });
  
  const receipt = await coordinator.fulfill('sch-001');
  assert.strictEqual(port.lastCommitPayload.scheduleEventId, 'sch-001', '排课 ID 传递错误');
  assert.strictEqual(port.lastCommitPayload.mode, 'FULL_SETTLE', '履约模式必须默认为 FULL_SETTLE');
  assert.deepStrictEqual(port.lastCommitPayload.anomalyOverrides, [], '零心智通途出站报文 anomalyOverrides 必须严格为空数组');
  assert.deepStrictEqual(port.lastCommitPayload.overrides, [], '兼容 overrides 字段必须严格为空');
  assert.strictEqual(receipt.scheduleEventId, 'sch-001');
  assert.strictEqual(receipt.anomalyCount, 0);
  assert.strictEqual(storage.getDraft('eval_draft_sch-001'), null, '结课后历史悬挂草稿必须被物理清除');
  console.log('✔ Case 1 验证通过: 零心智极速履约无需入参、差分为空且自动驱逐草稿\n');

  // -------------------------------------------------------------
  // Case 2: 会话水化与基线对齐 (Session Hydration)
  // -------------------------------------------------------------
  console.log('>>> [Case 2] 测试履约会话水化与不可变基线建立 (loadSession)...');
  const session = await coordinator.loadSession('sch-002');
  assert.strictEqual(session.schedule.id, 'sch-002');
  assert.strictEqual(session.schedule.courseName, '太极玄清道入门');
  assert.strictEqual(session.students.length, 3);
  assert.strictEqual(session.isDirty, false, '刚水化的会话 isDirty 必须为 false');
  assert.strictEqual(session.isCommitted, false, '新会话 isCommitted 必须为 false');

  for (const s of session.students) {
    assert.strictEqual(s.status, 'present');
    assert.strictEqual(s.deductLessons, 1);
    assert.strictEqual(s.isAnomaly, false, '初始化所有默认学员 isAnomaly 必须为 false');
  }
  console.log('✔ Case 2 验证通过: 会话从远程工作台成功水化，3名学员基线准确对齐\n');

  // -------------------------------------------------------------
  // Case 3: 异常学员差分提取 (Anomaly Delta Calculation)
  // -------------------------------------------------------------
  console.log('>>> [Case 3] 测试 10% 异常学员差分比对与增量报文提取...');
  // 变更学员 101：考勤切换为 leave，扣课时应为 0
  session.toggleStudentAttendance('stu-101');
  const s1 = session.students.find((s) => s.studentId === 'stu-101');
  assert.strictEqual(s1.status, 'leave');
  assert.strictEqual(s1.deductLessons, 0);
  assert.strictEqual(s1.isAnomaly, true, '状态被修改的学员必须被标记为异常');

  // 变更学员 102：增加个性化专属评语
  session.updatePersonalizedComment('stu-102', '九仪天成，资质上佳！', 5);
  const s2 = session.students.find((s) => s.studentId === 'stu-102');
  assert.strictEqual(s2.comment, '九仪天成，资质上佳！');
  assert.strictEqual(s2.isAnomaly, true, '有评语差异的学员必须被标记为异常');

  // 学员 103：保持默认 present，未做任何修改
  const s3 = session.students.find((s) => s.studentId === 'stu-103');
  assert.strictEqual(s3.isAnomaly, false, '未修改学员绝不能被误判为异常');
  assert.strictEqual(session.isDirty, true, '发生修改后会话 isDirty 必须为 true');

  // 暂存草稿
  await session.saveDraft();
  assert.ok(storage.getDraft('eval_draft_sch-002'), '草稿必须持久化到存储');
  assert.ok(storage.getDraft('eval_draft_sch-002_stu-102'), '单学员个性化草稿键必须兼容写入');
  assert.strictEqual(session.isDirty, false, '保存草稿后 isDirty 重置为 false');

  // 执行最终提交
  const commitReceipt = await session.commit({ mode: 'FULL_SETTLE' });
  const committedPayload = port.lastCommitPayload;

  assert.strictEqual(committedPayload.anomalyOverrides.length, 2, '增量上报报文 anomalyOverrides 长度必须严格为 2');
  assert.strictEqual(
    committedPayload.anomalyOverrides.some((a) => a.studentId === 'stu-103'),
    false,
    '未变更学员 stu-103 绝不允许被打包上传至网络接缝'
  );

  const diff101 = committedPayload.anomalyOverrides.find((a) => a.studentId === 'stu-101');
  assert.strictEqual(diff101.status, 'leave');
  assert.strictEqual(diff101.deductLessons, 0);

  const diff102 = committedPayload.anomalyOverrides.find((a) => a.studentId === 'stu-102');
  assert.strictEqual(diff102.personalizedComment, '九仪天成，资质上佳！');

  assert.strictEqual(commitReceipt.anomalyCount, 2);
  assert.strictEqual(commitReceipt.presentCount, 2);
  assert.strictEqual(commitReceipt.leaveCount, 1);
  assert.strictEqual(session.isCommitted, true, '提交后会话状态锁定');
  assert.strictEqual(storage.getDraft('eval_draft_sch-002'), null, '履约完成后草稿必须被原子销毁');
  assert.strictEqual(storage.getDraft('eval_draft_sch-002_stu-102'), null, '单学员草稿也必须同步被原子销毁');
  console.log('✔ Case 3 验证通过: 增量差分计算精准过滤正常学员，草稿在落盘后原子驱逐\n');

  // -------------------------------------------------------------
  // Case 4: 重复提交防篡改 (Replay Protection)
  // -------------------------------------------------------------
  console.log('>>> [Case 4] 测试已提交会话的幂等防篡改保护...');
  let duplicateErrorCaught = false;
  try {
    await session.commit();
  } catch (err) {
    duplicateErrorCaught = true;
    assert.ok(err.message.includes('已完成落盘，禁止重复提交'));
  }
  assert.ok(duplicateErrorCaught, '已提交的会话再次 commit 必须抛出明确异常');
  console.log('✔ Case 4 验证通过: 严格防止二次提交与网络幽灵重放\n');

  // -------------------------------------------------------------
  // Case 5: 独立随堂课评发布模式 (PUBLISH_EVALUATION Mode)
  // -------------------------------------------------------------
  console.log('>>> [Case 5] 测试仅发布课评模式 (PUBLISH_EVALUATION)...');
  const sessionEval = await coordinator.loadSession('sch-003');
  sessionEval.updateEvaluationDraft({
    lessonTitle: '仙剑第三重专练',
    teacherComment: '全体学员领悟极佳',
  });
  const evalReceipt = await sessionEval.commit({ mode: 'PUBLISH_EVALUATION' });
  assert.strictEqual(port.lastCommitPayload.mode, 'PUBLISH_EVALUATION');
  assert.strictEqual(port.lastCommitPayload.lessonTitle, '仙剑第三重专练');
  assert.strictEqual(port.lastCommitPayload.teacherComment, '全体学员领悟极佳');
  assert.strictEqual(evalReceipt.mode, 'PUBLISH_EVALUATION');
  console.log('✔ Case 5 验证通过: 课评发布模式参数封装与下发契约一致\n');

  // -------------------------------------------------------------
  // Case 6: 级联反结课冲正与退费异常防护 (Reversal & Safe-guard)
  // -------------------------------------------------------------
  console.log('>>> [Case 6] 测试级联反结课冲正与在途业务锁定保护...');
  const revReceipt = await coordinator.reverse('sch-004', '教务排课错误冲正');
  assert.strictEqual(port.lastReversePayload.scheduleEventId, 'sch-004');
  assert.strictEqual(port.lastReversePayload.reason, '教务排课错误冲正');
  assert.strictEqual(port.lastReversePayload.strategy, 'FULL_ROLLBACK');
  assert.strictEqual(revReceipt.refundedLessons, 3);

  // 模拟退费锁定阻断测试
  port.shouldThrowOnReverse = 'ACB-LOCK-403: 该排课关联学员正在执行退费审核，已加锁禁止反结课冲正';
  let reverseBlockCaught = false;
  try {
    await coordinator.reverse('sch-004', '非法冲正');
  } catch (err) {
    reverseBlockCaught = true;
    assert.ok(err.message.includes('ACB-LOCK-403'));
  }
  assert.ok(reverseBlockCaught, '反结课遇业务冲突锁定时，异常必须向上透传供前端弹窗捕获');
  console.log('✔ Case 6 验证通过: 级联反结课冲正与在途退费业务冲突熔断保护生效\n');

  // -------------------------------------------------------------
  // Case 7: 单学员课评水化与不可变基线封闭性测试 (hydrateStudentDraft)
  // -------------------------------------------------------------
  console.log('>>> [Case 7] 测试单学员课评水化与不可变基线封闭性 (hydrateStudentDraft)...');
  const stuDraft = await coordinator.hydrateStudentDraft('sch-005', 'stu-101');
  assert.strictEqual(stuDraft.studentId, 'stu-101');
  assert.strictEqual(stuDraft.studentName, '张小凡');
  assert.strictEqual(stuDraft.className, '青云志尖子一班');
  assert.strictEqual(stuDraft.studyContent, '御剑心法基础运转');
  assert.strictEqual(stuDraft.rating, 5);
  assert.ok(stuDraft._baselineToken, '单学员草稿必须持有不可变基线凭证');
  assert.strictEqual(stuDraft._baselineToken.baselineContent, '御剑心法基础运转');
  assert.strictEqual(stuDraft._baselineToken.baselineRating, 5);
  assert.strictEqual(stuDraft._baselineToken.studentId, 'stu-101');
  console.log('✔ Case 7 验证通过: 单学员水化精确剥离全班多余数据，成功封闭不可变基线\n');

  // -------------------------------------------------------------
  // Case 8: 草稿防抖持久化与原子出清测试 (saveStudentDraft)
  // -------------------------------------------------------------
  console.log('>>> [Case 8] 测试草稿即时暂存与防抖写入 (saveStudentDraft)...');
  // 即时保存
  await coordinator.saveStudentDraft('sch-005', 'stu-101', {
    studyContent: '张小凡悟性极高，剑气凝形',
    rating: 5,
  }, { immediate: true });
  const savedDraft = storage.getDraft('eval_draft_sch-005_stu-101');
  assert.ok(savedDraft, '草稿必须成功落盘至存储适配器');
  assert.strictEqual(savedDraft.studyContent, '张小凡悟性极高，剑气凝形');

  // 防抖暂存测试 (设置 50ms 防抖)
  let debouncedPromise = coordinator.saveStudentDraft('sch-005', 'stu-101', {
    studyContent: '张小凡领悟了噬魂之妙',
    rating: 5,
  }, { debounceMs: 50 });
  // 此时立即检查应仍为旧值
  assert.strictEqual(storage.getDraft('eval_draft_sch-005_stu-101').studyContent, '张小凡悟性极高，剑气凝形');
  await debouncedPromise;
  // 防抖结束后应更新为最新值
  assert.strictEqual(storage.getDraft('eval_draft_sch-005_stu-101').studyContent, '张小凡领悟了噬魂之妙');
  console.log('✔ Case 8 验证通过: 草稿即时与防抖持久化管道表现稳健\n');

  // -------------------------------------------------------------
  // Case 9: 单学员精准异常覆写与出站信箱测试 (commitStudentEvaluation)
  // -------------------------------------------------------------
  console.log('>>> [Case 9] 测试单学员精准异常覆写与草稿出清 (commitStudentEvaluation)...');
  // 写课评双字段：comment = 随堂特写评语 (学员专属)，studyContent = 课程学习内容与知识点大纲 (课次级)
  const stuReceipt = await coordinator.commitStudentEvaluation('sch-005', 'stu-101', {
    studyContent: '<p>本课大纲：噬魂棒法</p>',
    comment: '张小凡领悟了噬魂之妙',
    rating: 5,
    _baselineToken: stuDraft._baselineToken,
  });
  assert.strictEqual(port.lastCommitPayload.mode, 'PUBLISH_EVALUATION', '单学员点评必须使用 PUBLISH_EVALUATION 模式');
  assert.strictEqual(port.lastCommitPayload.anomalyOverrides.length, 1, '单学员点评仅包含当前学员的差异覆写');
  assert.strictEqual(port.lastCommitPayload.anomalyOverrides[0].studentId, 'stu-101');
  assert.strictEqual(port.lastCommitPayload.anomalyOverrides[0].personalizedComment, '张小凡领悟了噬魂之妙');
  assert.strictEqual(port.lastCommitPayload.studyContentHtml, '<p>本课大纲：噬魂棒法</p>', '大纲必须作为课次级 studyContentHtml 提交，不能与学员评语混用');
  assert.strictEqual(stuReceipt.mode, 'PUBLISH_EVALUATION');
  assert.strictEqual(storage.getDraft('eval_draft_sch-005_stu-101'), null, '单学员评价提交后本地草稿必须被物理清除');
  console.log('✔ Case 9 验证通过: 单学员提交增量精确上行，且草稿原子清理完毕\n');

  // -------------------------------------------------------------
  // Case 10: 零心智快速履约语义一致性测试 (quickFulfill & openWorkbench)
  // -------------------------------------------------------------
  console.log('>>> [Case 10] 测试 90% 极速通途与工作台别名映射 (quickFulfill & openWorkbench)...');
  const qReceipt = await coordinator.quickFulfill('sch-006');
  assert.strictEqual(port.lastCommitPayload.scheduleEventId, 'sch-006');
  assert.strictEqual(port.lastCommitPayload.mode, 'FULL_SETTLE');
  assert.strictEqual(qReceipt.scheduleEventId, 'sch-006');

  const wbSession = await coordinator.openWorkbench('sch-006');
  assert.strictEqual(wbSession.schedule.id, 'sch-006');
  assert.strictEqual(typeof wbSession.commit, 'function');
  console.log('✔ Case 10 验证通过: quickFulfill 与 openWorkbench 语义对齐且完全兼容\n');

  console.log('======================================================');
  console.log('🎉 客户端教学履约协调器全部 10 大核心场景断言 100% 验证通过！');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ 测试执行失败:', err);
  process.exit(1);
});
