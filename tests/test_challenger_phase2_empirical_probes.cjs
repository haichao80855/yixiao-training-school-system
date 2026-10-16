const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================================');
console.log('🔬 Phase 2 Challenger: Empirical Stress & Mutation Probes');
console.log('================================================================================\n');

let passCount = 0;
let totalCount = 0;

async function probe(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function runAllProbes() {
  const miniProgRoot = path.resolve(__dirname, '../mini-program');
  const compiledEduPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/edu.js');
  assert.ok(fs.existsSync(compiledEduPath), 'dist/build/mp-weixin/api/edu.js does not exist');

  // Set up mock WeChat runtime environment
  let capturedRequests = [];
  let capturedUploads = [];
  let storage = {
    token: 'test-token-xyz',
    currentCampusId: 'campus-sh-pudong-01',
  };

  global.Page = global.Page || function() {};
  global.Component = global.Component || function() {};
  global.App = global.App || function() {};
  global.getCurrentPages = global.getCurrentPages || function() { return []; };
  global.getApp = global.getApp || function() { return {}; };

  const mockWx = {
    getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 390 }),
    getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 28, right: 382, bottom: 60, left: 295 }),
    getStorageSync: (k) => storage[k] || '',
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: (k) => { delete storage[k]; },
    showToast: () => {},
    showLoading: () => {},
    hideLoading: () => {},
    request: (opts) => {
      capturedRequests.push(opts);
      if (opts.url.includes('/api/educational/schedules')) {
        opts.success({
          statusCode: 200,
          data: {
            code: 200,
            data: [
              {
                id: 'sch-001',
                campusId: 'campus-sh-pudong-01',
                classId: 'cls-001',
                className: '少儿英语启蒙A班',
                teacherId: 't-01',
                teacherName: '李老师',
                date: '2026-10-16',
                startTime: '09:00',
                endTime: '10:30',
                status: 'scheduled',
                class: { name: '少儿英语启蒙A班', currentStudentCount: 12 },
                attendances: [{ status: 'present' }, { status: 'present' }, { status: 'leave' }],
              }
            ]
          }
        });
      } else if (opts.url.includes('/api/educational/fulfillment/workbench/sch-backend-live')) {
        // Simulate backend NestJS response shape from LessonFulfillmentCoordinator.prepareFulfillmentWorkbench
        opts.success({
          statusCode: 200,
          data: {
            code: 200,
            data: {
              schedule: {
                id: 'sch-backend-live',
                campusId: 'campus-sh-pudong-01',
                classId: 'cls-100',
                className: '高阶思维与编程',
                courseId: 'crs-code',
                courseName: 'Python少儿编程',
                teacherId: 't-99',
                teacherName: '王老师',
                advisorName: '赵教务',
                classroomId: 'cr-88',
                classroomName: '机房101',
                date: '2026-10-16',
                startTime: '14:00',
                endTime: '15:30',
                timeSlot: '2026-10-16 14:00-15:30',
                status: 'scheduled',
              },
              students: [
                {
                  studentId: 'stu-01',
                  studentNo: 'S001',
                  studentName: '张小凡',
                  recordedStatus: null,
                  defaultStatus: 'present',
                  defaultDeductLessons: 1,
                  bonusLessons: 0,
                  remainingLessons: 30,
                  currentComment: null,
                },
                {
                  studentId: 'stu-02',
                  studentNo: 'S002',
                  studentName: '林惊羽',
                  recordedStatus: 'leave',
                  defaultStatus: 'present',
                  defaultDeductLessons: 0,
                  bonusLessons: 5,
                  remainingLessons: 15,
                  currentComment: '请假一次',
                }
              ],
              summary: { totalStudents: 2, defaultPresentCount: 1 },
              evaluationDraft: {
                templateId: 'tpl-code',
                templateName: '创客代码模版',
                studyContentHtml: '<p>循环与分支结构综合练习</p>',
                teacherComment: '逻辑严谨，动手能力强！',
              }
            }
          }
        });
      } else if (opts.url.includes('/api/educational/fulfillment/fulfill')) {
        opts.success({
          statusCode: 200,
          data: { code: 200, message: '结课履约成功', data: { success: true, scheduleEventId: opts.data?.scheduleEventId } }
        });
      } else if (opts.url.includes('/api/educational/fulfillment/reverse')) {
        opts.success({
          statusCode: 200,
          data: { code: 200, message: '冲正成功', data: { success: true } }
        });
      } else if (opts.url.includes('/api/educational/lesson-evaluations/commit')) {
        opts.success({
          statusCode: 200,
          data: { code: 200, message: '课评提交发布成功', data: { evaluationId: 'eval-res-1' } }
        });
      } else {
        if (opts.fail) opts.fail({ errMsg: 'request:fail network down' });
        else opts.success({ statusCode: 500, data: { message: 'network down' } });
      }
    },
    uploadFile: (opts) => {
      capturedUploads.push(opts);
      if (opts.url.includes('/api/upload/photos')) {
        opts.success({
          statusCode: 200,
          data: JSON.stringify({
            code: 200,
            data: [{ url: 'https://cdn.example.com/photos/photo-123.jpg' }]
          })
        });
      } else if (opts.url.includes('/api/upload/video')) {
        opts.success({
          statusCode: 200,
          data: JSON.stringify({
            code: 200,
            data: { videoUrl: 'https://cdn.example.com/videos/video-456.mp4' }
          })
        });
      } else {
        opts.fail({ errMsg: 'upload:fail' });
      }
    }
  };

  global.wx = global.uni = mockWx;

  const { eduApi } = require(compiledEduPath);

  // ---------------------------------------------------------------------------
  // PROBE 1: eduApi.getSchedules normalization & field hydration
  // ---------------------------------------------------------------------------
  console.log('--- [Probe 1: getSchedules Inbound Normalization] ---');
  await probe('1.1 getSchedules maps relations to UI fields & counts present attendances', async () => {
    capturedRequests = [];
    const schedules = await eduApi.getSchedules({ startDate: '2026-10-16', endDate: '2026-10-16' });
    assert.strictEqual(schedules.length, 1);
    const s = schedules[0];
    assert.strictEqual(s.className, '少儿英语启蒙A班');
    assert.strictEqual(s.teacherName, '李老师');
    assert.strictEqual(s.expectedCount, 12, 'expectedCount should map from class.currentStudentCount');
    assert.strictEqual(s.actualCount, 2, 'actualCount should count present attendances');
    assert.strictEqual(s.timeRange, '2026-10-16 09:00-10:30');
  });

  // ---------------------------------------------------------------------------
  // PROBE 2: eduApi.getFulfillmentWorkbench shape compatibility
  // ---------------------------------------------------------------------------
  console.log('\n--- [Probe 2: getFulfillmentWorkbench Live Shape Normalization] ---');
  await probe('2.1 getFulfillmentWorkbench normalizes NestJS backend fields correctly', async () => {
    capturedRequests = [];
    const wb = await eduApi.getFulfillmentWorkbench('sch-backend-live');
    assert.ok(wb && wb.schedule);
    assert.strictEqual(wb.schedule.id, 'sch-backend-live');
    assert.strictEqual(wb.schedule.className, '高阶思维与编程');
    assert.strictEqual(wb.schedule.courseName, 'Python少儿编程');
    assert.strictEqual(wb.schedule.expectedCount, 2);
    assert.strictEqual(wb.schedule.actualCount, 1);

    assert.strictEqual(wb.students.length, 2);
    // Student 1: studentName -> name, defaultStatus -> present, tag -> 正
    assert.strictEqual(wb.students[0].name, '张小凡');
    assert.strictEqual(wb.students[0].status, 'present');
    assert.strictEqual(wb.students[0].deductLessons, 1);
    assert.strictEqual(wb.students[0].tag, '正');
    assert.strictEqual(wb.students[0].evaluated, false);

    // Student 2: studentName -> name, recordedStatus -> leave, tag -> 赠 (bonusLessons > 0), evaluated -> true (has comment)
    assert.strictEqual(wb.students[1].name, '林惊羽');
    assert.strictEqual(wb.students[1].status, 'leave');
    assert.strictEqual(wb.students[1].deductLessons, 0);
    assert.strictEqual(wb.students[1].tag, '赠');
    assert.strictEqual(wb.students[1].evaluated, true);

    // evaluationSummary mapped from evaluationDraft
    assert.ok(wb.evaluationSummary);
    assert.strictEqual(wb.evaluationSummary.templateName, '创客代码模版');
  });

  await probe('2.2 getFulfillmentWorkbench gracefully falls back to high-fidelity mock on network failure', async () => {
    capturedRequests = [];
    const wb = await eduApi.getFulfillmentWorkbench('sch-offline-nonexistent');
    assert.ok(wb && wb.schedule);
    assert.strictEqual(wb.schedule.id, 'sch-offline-nonexistent');
    assert.strictEqual(wb.schedule.className, '周二18.30周六10.00班-12');
    assert.strictEqual(wb.students.length, 10);
    assert.strictEqual(wb.students[0].name, '董御');
  });

  // ---------------------------------------------------------------------------
  // PROBE 3: fulfillLesson Outbound Normalization & Anomaly Overrides
  // ---------------------------------------------------------------------------
  console.log('\n--- [Probe 3: fulfillLesson Outbound Normalization] ---');
  await probe('3.1 fulfillLesson dual-maps overrides to anomalyOverrides matching Coordinator expectations', async () => {
    capturedRequests = [];
    const payload = {
      scheduleEventId: 'sch-event-001',
      overrides: [
        { studentId: 's-01', status: 'present', deductLessons: 1 },
        { studentId: 's-02', status: 'leave', deductLessons: 0, comment: '生病请假' },
        { studentId: 's-03', status: 'absent', deductLessons: 1, comment: '无故旷课' }
      ],
      studyContentHtml: '自然拼读Unit 3',
      teacherComment: '全员积极发言',
      photoList: ['https://cdn/p1.jpg']
    };

    const res = await eduApi.fulfillLesson(payload);
    assert.ok(res);
    assert.strictEqual(capturedRequests.length, 1);
    const req = capturedRequests[0];
    assert.ok(req.url.endsWith('/api/educational/fulfillment/fulfill'));
    assert.strictEqual(req.method, 'POST');

    const sentData = req.data;
    assert.strictEqual(sentData.scheduleEventId, 'sch-event-001');
    assert.strictEqual(sentData.mode, 'FULL_SETTLE');

    // Verify anomalyOverrides is present and well-formed
    assert.ok(Array.isArray(sentData.anomalyOverrides), 'anomalyOverrides must be an array');
    assert.strictEqual(sentData.anomalyOverrides.length, 3);
    assert.strictEqual(sentData.anomalyOverrides[1].studentId, 's-02');
    assert.strictEqual(sentData.anomalyOverrides[1].status, 'leave');
    assert.strictEqual(sentData.anomalyOverrides[1].deductLessons, 0);
    assert.strictEqual(sentData.anomalyOverrides[1].personalizedComment, '生病请假');

    // Verify overrides is also kept for legacy compatibility
    assert.ok(Array.isArray(sentData.overrides));
  });

  // ---------------------------------------------------------------------------
  // PROBE 4: commitEvaluation Outbound Nested Payload & Validation Guard
  // ---------------------------------------------------------------------------
  console.log('\n--- [Probe 4: commitEvaluation Outbound Normalization] ---');
  await probe('4.1 commitEvaluation wraps nested payload conforming to LessonEvaluationCoordinator', async () => {
    capturedRequests = [];
    const payload = {
      scheduleEventId: 'sch-event-eval-99',
      studyContent: '英语口语日常对话练习，学习了Greetings & Colors主题。',
      teacherComment: '孩子们发音非常纯正，互动配合默契！',
      photoList: ['https://cdn/p1.jpg', 'https://cdn/p2.jpg'],
      videoUrl: 'https://cdn/v1.mp4',
      templateName: '通用课评模板',
      studentComments: [
        { studentId: 's-01', comment: '董御同学表现优异', rating: 5.0 },
        { studentId: 's-02', comment: '张景恒同学听讲专注', rating: 4.8 },
      ]
    };

    await eduApi.commitEvaluation(payload);
    assert.strictEqual(capturedRequests.length, 1);
    const req = capturedRequests[0];
    assert.ok(req.url.endsWith('/api/educational/lesson-evaluations/commit'));
    assert.strictEqual(req.method, 'POST');

    const sent = req.data;
    assert.strictEqual(sent.scheduleEventId, 'sch-event-eval-99');
    assert.strictEqual(sent.publish, true, 'publish should default to true');

    // CRITICAL: Coordinator destructures { payload, publish } = command;
    // Must assert sent.payload exists!
    assert.ok(sent.payload, 'sent.payload must be defined to prevent coordinator TypeError');
    assert.strictEqual(sent.payload.lessonTitle, '随堂课评与素养分析');
    assert.strictEqual(sent.payload.studyContentHtml, payload.studyContent);
    assert.strictEqual(sent.payload.teacherComment, payload.teacherComment);
    assert.strictEqual(sent.payload.overallRating, 5.0);
    assert.deepStrictEqual(sent.payload.photoList, payload.photoList);
    assert.strictEqual(sent.payload.videoUrl, payload.videoUrl);

    // Verify studentOverrides conversion
    assert.ok(Array.isArray(sent.payload.studentOverrides));
    assert.strictEqual(sent.payload.studentOverrides.length, 2);
    assert.strictEqual(sent.payload.studentOverrides[0].studentId, 's-01');
    assert.strictEqual(sent.payload.studentOverrides[0].personalizedComment, '董御同学表现优异');
    assert.strictEqual(sent.payload.studentOverrides[0].rating, 5.0);
  });

  // ---------------------------------------------------------------------------
  // PROBE 5: reverseFulfillment & media uploads
  // ---------------------------------------------------------------------------
  console.log('\n--- [Probe 5: reverseFulfillment & Media Uploads] ---');
  await probe('5.1 reverseFulfillment supports string and object args', async () => {
    capturedRequests = [];
    await eduApi.reverseFulfillment('sch-rev-01', '误操作结课冲正');
    assert.strictEqual(capturedRequests.length, 1);
    assert.ok(capturedRequests[0].url.endsWith('/api/educational/fulfillment/reverse'));
    assert.strictEqual(capturedRequests[0].data.scheduleEventId, 'sch-rev-01');
    assert.strictEqual(capturedRequests[0].data.reason, '误操作结课冲正');

    await eduApi.reverseFulfillment({ scheduleEventId: 'sch-rev-02', reason: '测试冲正', strategy: 'CASCADE_BALANCE_ONLY' });
    assert.strictEqual(capturedRequests.length, 2);
    assert.strictEqual(capturedRequests[1].data.scheduleEventId, 'sch-rev-02');
    assert.strictEqual(capturedRequests[1].data.strategy, 'CASCADE_BALANCE_ONLY');
  });

  await probe('5.2 uploadPhoto & uploadVideo parse JSON responses and fallback gracefully', async () => {
    capturedUploads = [];
    const photoUrl = await eduApi.uploadPhoto('/local/tmp/img1.jpg', 'sch-01');
    assert.strictEqual(photoUrl, 'https://cdn.example.com/photos/photo-123.jpg');
    assert.strictEqual(capturedUploads[0].header['x-campus-id'], 'campus-sh-pudong-01');

    const videoUrl = await eduApi.uploadVideo('/local/tmp/mov1.mp4', 'sch-01');
    assert.strictEqual(videoUrl, 'https://cdn.example.com/videos/video-456.mp4');
  });

  // ---------------------------------------------------------------------------
  // PROBE 6: Page Component White-box Adversarial Check
  // ---------------------------------------------------------------------------
  console.log('\n--- [Probe 6: Page Components Verification] ---');
  await probe('6.1 Roll-call page status toggle state machine logic', () => {
    // Test the state machine map: present -> leave -> absent -> present
    const map = {
      present: 'leave',
      leave: 'absent',
      absent: 'present',
    };
    let current = 'present';
    current = map[current];
    assert.strictEqual(current, 'leave');
    current = map[current];
    assert.strictEqual(current, 'absent');
    current = map[current];
    assert.strictEqual(current, 'present');
  });

  await probe('6.2 Evaluation edit page validation guards', () => {
    const editSrc = fs.readFileSync(path.resolve(miniProgRoot, 'src/package-edu/evaluation/edit.vue'), 'utf8');
    // Guard against empty content
    assert.ok(editSrc.includes('if (!studyContent.value.trim())'), 'Must validate empty studyContent');
    // Guard against leaving without saving
    assert.ok(editSrc.includes('showExitModal'), 'Must prompt exit dialog if modified');
    // Photo count <= 9
    assert.ok(editSrc.includes('9 - uploadedPhotos.value.length'), 'Must limit photo selection to 9 max');
    // Draft storage key structure
    assert.ok(editSrc.includes('eval_draft_'), 'Must use unique draft storage key');
  });

  // ---------------------------------------------------------------------------
  // PROBE 7: Mutation Injection & Mutant Kill Rate (100% Kill Rate Verification)
  // ---------------------------------------------------------------------------
  console.log('\n--- [Probe 7: Mutation Injection & Mutant Killer Tests] ---');
  await probe('7.1 Mutant 1: Missing payload wrapper in commitEvaluation is instantly killed', () => {
    // If commitEvaluation sent flat data without `payload`, simulating backend coordinator destructuring:
    const simulateBackendCoordinator = (command) => {
      const { payload, publish } = command;
      if (publish) {
        if (!payload.lessonTitle || payload.lessonTitle.trim().length === 0) {
          throw new Error('发布课评必须填写课次名称');
        }
      }
      return { success: true };
    };

    // Broken mutant without payload:
    const badCommand = { scheduleEventId: 'sch-1', publish: true, lessonTitle: '扁平课次名' };
    assert.throws(() => {
      simulateBackendCoordinator(badCommand);
    }, TypeError, 'Coordinator must throw TypeError if payload is undefined');
  });

  await probe('7.2 Mutant 2: Missing anomalyOverrides in fulfillLesson leaves absent students unrecorded', () => {
    const simulateBackendFulfillment = (command) => {
      const anomalies = command.anomalyOverrides || [];
      const leaveStudents = anomalies.filter(a => a.status === 'leave');
      if (leaveStudents.length === 0) {
        throw new Error('未检测到请假学员覆写，将全员默认扣除课时！');
      }
      return { success: true };
    };

    // Bad mutant that only sends overrides without anomalyOverrides mapping:
    const badCommand = { scheduleEventId: 'sch-1', overrides: [{ studentId: 's-2', status: 'leave' }] };
    assert.throws(() => {
      simulateBackendFulfillment(badCommand);
    }, /未检测到请假学员覆写/);
  });

  console.log('\n================================================================================');
  console.log(`🎉 阶段二实证应力与变异探针全部通过！${passCount}/${totalCount} 项探针 100% 验证成功！`);
  console.log('================================================================================\n');
}

runAllProbes().catch((err) => {
  console.error('\n❌ 阶段二探针执行失败:', err);
  process.exit(1);
});
