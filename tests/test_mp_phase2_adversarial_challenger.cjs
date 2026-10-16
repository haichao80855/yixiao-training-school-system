const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================================');
console.log('⚔️  Phase 2 (Educational Fulfillment) Empirical Challenger Stress-Test Harness');
console.log('================================================================================\n');

let passCount = 0;
let totalCount = 0;

async function runChallenge(title, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✅ [CHALLENGE PASSED] ${title}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [CHALLENGE FAILED] ${title}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function run() {
  const miniProgRoot = path.resolve(__dirname, '../mini-program');
  const compiledEduPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/edu.js');
  assert.ok(fs.existsSync(compiledEduPath), `Compiled edu.js does not exist: ${compiledEduPath}`);

  // -------------------------------------------------------------------------
  // MOCK ENVIRONMENT SETUP
  // -------------------------------------------------------------------------
  let lastRequestOptions = null;
  let mockRequestBehavior = null;
  let toastLog = [];
  let storageMock = {
    token: 'test-jwt-token-edu',
    currentCampusId: 'campus-bj-hq',
  };

  global.Page = global.Page || function() {};
  global.Component = global.Component || function() {};
  global.App = global.App || function() {};
  global.getCurrentPages = global.getCurrentPages || function() { return []; };
  global.getApp = global.getApp || function() { return {}; };

  const mockWx = {
    getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375, platform: 'devtools' }),
    getSystemInfo: (opts) => opts && opts.success && opts.success({ statusBarHeight: 20, windowWidth: 375 }),
    canIUse: () => true,
    getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 24, right: 368, bottom: 56, left: 281 }),
    getStorageSync: (k) => storageMock[k],
    setStorageSync: (k, v) => { storageMock[k] = v; },
    removeStorageSync: (k) => { delete storageMock[k]; },
    showToast: (opts) => { toastLog.push(opts); },
    hideLoading: () => {},
    showLoading: () => {},
    reLaunch: () => {},
    uploadFile: (opts) => {
      if (mockRequestBehavior === 'network_error') {
        opts.fail && opts.fail({ errMsg: 'upload:fail connection refused' });
      } else {
        opts.success && opts.success({
          statusCode: 200,
          data: JSON.stringify({ code: 200, data: [{ url: 'https://cdn.example.com/uploaded.png' }] })
        });
      }
    },
    request: (options) => {
      lastRequestOptions = options;
      if (mockRequestBehavior === 'network_error') {
        options.fail && options.fail({ errMsg: 'request:fail connection refused' });
      } else if (mockRequestBehavior === 'http_400') {
        options.success && options.success({
          statusCode: 400,
          data: { code: 400, message: '发布课评学习内容不能少于 5 个字符' },
        });
      } else if (mockRequestBehavior === 'http_500') {
        options.success && options.success({
          statusCode: 500,
          data: { code: 500, message: '数据库事务死锁，履约回滚' },
        });
      } else if (mockRequestBehavior === 'http_401') {
        options.success && options.success({
          statusCode: 401,
          data: { message: 'Unauthorized token expired' },
        });
      } else if (typeof mockRequestBehavior === 'function') {
        mockRequestBehavior(options);
      } else {
        // default success empty
        options.success && options.success({
          statusCode: 200,
          data: { code: 200, data: { success: true } },
        });
      }
    },
  };

  global.wx = global.uni = mockWx;

  // Clear require cache to ensure fresh import
  delete require.cache[require.resolve(compiledEduPath)];
  const { eduApi } = require(compiledEduPath);

  // =========================================================================
  // 1. Inbound Normalizer Stress-Testing (getFulfillmentWorkbench)
  // =========================================================================
  console.log('--- 1. Inbound Normalizer Stress-Testing ---');

  await runChallenge('1.1 Inbound Normalizer: Maps NestJS coordinator response into UI model', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            schedule: {
              id: 'sch-nest-999',
              campusId: 'campus-sh-pudong',
              classId: 'cls-adv-01',
              className: '高级创客班-01',
              courseId: 'crs-robot',
              courseName: '机器人创客',
              teacherId: 't-zhang',
              teacherName: '张老师',
              advisorName: '李教务',
              classroomId: 'cr-301',
              classroomName: '创客实验室-301',
              date: '2026-10-20',
              startTime: '14:00',
              endTime: '16:00',
              timeSlot: '2026-10-20 14:00-16:00',
              status: 'in_progress',
              classType: '线下实验课',
            },
            students: [
              {
                studentId: 's-nest-01',
                studentNo: 'STU1001',
                studentName: '王小明',
                recordedStatus: 'present',
                defaultDeductLessons: 1,
                remainingLessons: 15,
                bonusLessons: 0,
                currentComment: '表现优秀',
              },
              {
                studentId: 's-nest-02',
                studentNo: 'STU1002',
                studentName: '李小红',
                recordedStatus: 'leave',
                deductLessons: 0,
                remainingLessons: 8,
                bonusLessons: 2,
                currentComment: null,
              },
            ],
            summary: {
              totalStudents: 2,
              defaultPresentCount: 1,
            },
            evaluationDraft: {
              templateId: 'tpl-robot',
              templateName: '机器人通用模板',
              studyContentHtml: '<p>齿轮传动比实验</p>',
              teacherComment: '动手能力强',
              photoList: ['https://cdn.example.com/p1.png'],
              videoUrl: 'https://cdn.example.com/v1.mp4',
            },
          },
        },
      });
    };

    const res = await eduApi.getFulfillmentWorkbench('sch-nest-999');

    // Assert Schedule normalization
    assert.strictEqual(res.schedule.id, 'sch-nest-999');
    assert.strictEqual(res.schedule.campusId, 'campus-sh-pudong');
    assert.strictEqual(res.schedule.className, '高级创客班-01');
    assert.strictEqual(res.schedule.expectedCount, 2);
    assert.strictEqual(res.schedule.actualCount, 1);

    // Assert Student 1 normalization
    assert.strictEqual(res.students.length, 2);
    const stu1 = res.students[0];
    assert.strictEqual(stu1.name, '王小明');
    assert.strictEqual(stu1.status, 'present');
    assert.strictEqual(stu1.deductLessons, 1);
    assert.strictEqual(stu1.tag, '正'); // bonusLessons === 0 -> '正'
    assert.strictEqual(stu1.evaluated, true); // has currentComment -> true

    // Assert Student 2 normalization
    const stu2 = res.students[1];
    assert.strictEqual(stu2.name, '李小红');
    assert.strictEqual(stu2.status, 'leave');
    assert.strictEqual(stu2.deductLessons, 0);
    assert.strictEqual(stu2.tag, '赠'); // bonusLessons > 0 -> '赠'
    assert.strictEqual(stu2.evaluated, false); // no comment/rating -> false

    // Assert Evaluation summary draft
    assert.strictEqual(res.evaluationSummary.templateId, 'tpl-robot');
    assert.strictEqual(res.evaluationSummary.studyContent, '<p>齿轮传动比实验</p>');
  });

  await runChallenge('1.2 Offline Fallback: Graceful degradation with standard benchmark dataset when network down', async () => {
    mockRequestBehavior = 'network_error';

    const fallbackWb = await eduApi.getFulfillmentWorkbench('sch-offline-test');
    assert.ok(fallbackWb, 'Fallback returned null');
    assert.ok(fallbackWb.schedule, 'Fallback schedule is missing');
    assert.strictEqual(fallbackWb.schedule.className, '周二18.30周六10.00班-12');
    assert.ok(Array.isArray(fallbackWb.students) && fallbackWb.students.length >= 10, 'Expected at least 10 fallback students');
    assert.strictEqual(fallbackWb.students[0].name, '董御');
  });

  // =========================================================================
  // 2. Outbound Normalizer Stress-Testing (fulfillLesson)
  // =========================================================================
  console.log('\n--- 2. Outbound Normalizer: fulfillLesson ---');

  await runChallenge('2.1 fulfillLesson: Synthesizes both anomalyOverrides and overrides from frontend input', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({ statusCode: 200, data: { success: true, receiptId: 'REC-001' } });
    };

    const frontendPayload = {
      scheduleEventId: 'sch-evt-100',
      overrides: [
        { studentId: 's-01', status: 'present', deductLessons: 1, comment: '积极回答问题' },
        { studentId: 's-02', status: 'leave', deductLessons: 0, comment: '病假' },
      ],
      studyContentHtml: '少儿趣味英语 Unit 3',
      teacherComment: '全班互动效果极佳',
    };

    const result = await eduApi.fulfillLesson(frontendPayload);
    assert.ok(result.success, 'Fulfill did not succeed');

    // Verify outbound request shape
    assert.strictEqual(lastRequestOptions.url, 'http://127.0.0.1:3001/api/educational/fulfillment/fulfill');
    assert.strictEqual(lastRequestOptions.method, 'POST');
    const sentData = lastRequestOptions.data;

    assert.strictEqual(sentData.scheduleEventId, 'sch-evt-100');
    assert.strictEqual(sentData.mode, 'FULL_SETTLE');
    assert.strictEqual(sentData.studyContentHtml, '少儿趣味英语 Unit 3');

    // Verify backend NestJS domain coordinator key: anomalyOverrides
    assert.ok(Array.isArray(sentData.anomalyOverrides), 'anomalyOverrides missing');
    assert.strictEqual(sentData.anomalyOverrides.length, 2);
    assert.strictEqual(sentData.anomalyOverrides[0].studentId, 's-01');
    assert.strictEqual(sentData.anomalyOverrides[0].status, 'present');
    assert.strictEqual(sentData.anomalyOverrides[0].deductLessons, 1);
    assert.strictEqual(sentData.anomalyOverrides[0].personalizedComment, '积极回答问题');

    assert.strictEqual(sentData.anomalyOverrides[1].studentId, 's-02');
    assert.strictEqual(sentData.anomalyOverrides[1].status, 'leave');
    assert.strictEqual(sentData.anomalyOverrides[1].deductLessons, 0);
    assert.strictEqual(sentData.anomalyOverrides[1].personalizedComment, '病假');

    // Verify frontend backward compatibility key: overrides
    assert.ok(Array.isArray(sentData.overrides), 'overrides missing');
  });

  // =========================================================================
  // 3. Outbound Normalizer Stress-Testing (commitEvaluation)
  // =========================================================================
  console.log('\n--- 3. Outbound Normalizer: commitEvaluation ---');

  await runChallenge('3.1 commitEvaluation: Packages flat frontend parameters into coordinator payload structure', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({ statusCode: 200, data: { success: true, receiptId: 'REC-EVAL-001' } });
    };

    const evalInput = {
      scheduleEventId: 'sch-evt-100',
      studyContent: '英语音标综合复习',
      teacherComment: '发音非常地道，掌握迅速！',
      photoList: ['https://cdn.example.com/photo1.jpg'],
      videoUrl: 'https://cdn.example.com/video1.mp4',
      templateName: '通用课评模板',
      studentComments: [
        { studentId: 's-01', comment: '发音非常地道，掌握迅速！', rating: 5.0 },
      ],
    };

    const res = await eduApi.commitEvaluation(evalInput);
    assert.ok(res.success, 'Commit evaluation failed');

    const sent = lastRequestOptions.data;
    assert.strictEqual(lastRequestOptions.url, 'http://127.0.0.1:3001/api/educational/lesson-evaluations/commit');
    assert.strictEqual(sent.scheduleEventId, 'sch-evt-100');
    assert.strictEqual(sent.publish, true);

    // CRITICAL: Must contain nested payload object for lesson-evaluation.coordinator.ts line 279:
    // const { payload, publish } = command;
    assert.ok(sent.payload, 'payload property must exist in request body for coordinator destructuring');
    assert.strictEqual(typeof sent.payload, 'object');
    assert.strictEqual(sent.payload.studyContentHtml, '英语音标综合复习');
    assert.strictEqual(sent.payload.teacherComment, '发音非常地道，掌握迅速！');
    assert.strictEqual(sent.payload.overallRating, 5.0);
    assert.strictEqual(sent.payload.templateName, '通用课评模板');
    assert.deepStrictEqual(sent.payload.photoList, ['https://cdn.example.com/photo1.jpg']);
    assert.strictEqual(sent.payload.videoUrl, 'https://cdn.example.com/video1.mp4');

    // Must map studentComments into studentOverrides
    assert.ok(Array.isArray(sent.payload.studentOverrides), 'studentOverrides missing in payload');
    assert.strictEqual(sent.payload.studentOverrides.length, 1);
    assert.strictEqual(sent.payload.studentOverrides[0].studentId, 's-01');
    assert.strictEqual(sent.payload.studentOverrides[0].personalizedComment, '发音非常地道，掌握迅速！');
  });

  // =========================================================================
  // 4. Zero Exception Swallowed & Real Error Propagation
  // =========================================================================
  console.log('\n--- 4. Zero Swallowed Exceptions & Real Error Toast Verification ---');

  await runChallenge('4.1 fulfillLesson: HTTP 400 Bad Request throws and propagates message without fake success', async () => {
    mockRequestBehavior = 'http_400';
    toastLog = [];

    let caughtError = null;
    try {
      await eduApi.fulfillLesson({ scheduleEventId: 'sch-err-400' });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected fulfillLesson to reject on HTTP 400');
    assert.strictEqual(caughtError.message, '发布课评学习内容不能少于 5 个字符');
    
    // Check toast behavior
    const hasErrorToast = toastLog.some(t => t.title && t.title.includes('发布课评学习内容不能少于 5 个字符'));
    assert.ok(hasErrorToast, 'Expected error toast displaying actual backend validation error');

    const hasFakeSuccessToast = toastLog.some(t => t.icon === 'success' || (t.title && t.title.includes('成功')));
    assert.strictEqual(hasFakeSuccessToast, false, 'VIOLATION: Fake success toast was triggered on 400 error!');
  });

  await runChallenge('4.2 fulfillLesson: HTTP 500 Server Error throws and propagates without swallow', async () => {
    mockRequestBehavior = 'http_500';
    toastLog = [];

    let caughtError = null;
    try {
      await eduApi.fulfillLesson({ scheduleEventId: 'sch-err-500' });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected fulfillLesson to reject on HTTP 500');
    assert.strictEqual(caughtError.message, '数据库事务死锁，履约回滚');

    const hasFakeSuccessToast = toastLog.some(t => t.icon === 'success');
    assert.strictEqual(hasFakeSuccessToast, false, 'VIOLATION: Fake success toast triggered on 500 error!');
  });

  await runChallenge('4.3 commitEvaluation: Network disconnection throws and alerts user', async () => {
    mockRequestBehavior = 'network_error';
    toastLog = [];

    let caughtError = null;
    try {
      await eduApi.commitEvaluation({ scheduleEventId: 'sch-err-net' });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected commitEvaluation to throw when network fails');
    const hasNetworkToast = toastLog.some(t => t.title && t.title.includes('无法连接到后端服务') || t.title.includes('网络连接异常'));
    assert.ok(hasNetworkToast, 'Expected network failure toast to be shown');
  });

  await runChallenge('4.4 401 Unauthorized clears token and rejects request', async () => {
    mockRequestBehavior = 'http_401';
    storageMock.token = 'will-expire';

    let caughtError = null;
    try {
      await eduApi.fulfillLesson({ scheduleEventId: 'sch-err-401' });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected request to reject on 401');
    assert.strictEqual(storageMock.token, undefined, 'Token was not removed on 401');
  });

  // =========================================================================
  // 5. Multi-media Upload Reliability
  // =========================================================================
  console.log('\n--- 5. Multi-media Upload Reliability ---');

  await runChallenge('5.1 uploadPhoto: Returns CDN URL upon success and gracefully returns tempPath on failure', async () => {
    mockRequestBehavior = null; // success
    const cdnUrl = await eduApi.uploadPhoto('/tmp/local_photo.png', 'sch-001');
    assert.strictEqual(cdnUrl, 'https://cdn.example.com/uploaded.png');

    mockRequestBehavior = 'network_error';
    const fallbackPath = await eduApi.uploadPhoto('/tmp/local_photo.png', 'sch-001');
    assert.strictEqual(fallbackPath, '/tmp/local_photo.png', 'Fallback did not preserve local path');
  });

  console.log('\n================================================================================');
  console.log(`🎉 Phase 2 Empirical Challenger Test Suite PASSED! All ${passCount}/${totalCount} challenges met.`);
  console.log('================================================================================\n');
}

run().catch((err) => {
  console.error('\n❌ EMPIRICAL CHALLENGER TEST FAILED:', err);
  process.exit(1);
});
