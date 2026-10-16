const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================================');
console.log('⚔️  Phase 3 Empirical Challenger Adversarial Stress-Test Harness');
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
  const compiledStudentPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/student.js');
  const compiledClassPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/class.js');
  const compiledCatalogPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/catalog.js');

  assert.ok(fs.existsSync(compiledStudentPath), `Compiled student.js does not exist: ${compiledStudentPath}`);
  assert.ok(fs.existsSync(compiledClassPath), `Compiled class.js does not exist: ${compiledClassPath}`);
  assert.ok(fs.existsSync(compiledCatalogPath), `Compiled catalog.js does not exist: ${compiledCatalogPath}`);

  // -------------------------------------------------------------------------
  // MOCK ENVIRONMENT SETUP
  // -------------------------------------------------------------------------
  let lastRequestOptions = null;
  let mockRequestBehavior = null;
  let toastLog = [];
  let storageMock = {
    token: 'test-jwt-token-phase3',
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
    request: (options) => {
      lastRequestOptions = options;
      if (mockRequestBehavior === 'network_error') {
        options.fail && options.fail({ errMsg: 'request:fail connection refused' });
      } else if (mockRequestBehavior === 'http_400') {
        options.success && options.success({
          statusCode: 400,
          data: { code: 400, message: 'totalLessons 必须大于等于 1' },
        });
      } else if (mockRequestBehavior === 'http_500') {
        options.success && options.success({
          statusCode: 500,
          data: { code: 500, message: '数据库事务异常，开单失败' },
        });
      } else if (mockRequestBehavior === 'http_401') {
        options.success && options.success({
          statusCode: 401,
          data: { message: 'Unauthorized token expired' },
        });
      } else if (typeof mockRequestBehavior === 'function') {
        mockRequestBehavior(options);
      } else {
        options.success && options.success({
          statusCode: 200,
          data: { code: 200, data: { success: true } },
        });
      }
    },
  };

  global.wx = global.uni = mockWx;

  // Clear require cache
  delete require.cache[require.resolve(compiledStudentPath)];
  delete require.cache[require.resolve(compiledClassPath)];
  delete require.cache[require.resolve(compiledCatalogPath)];

  const { studentApi } = require(compiledStudentPath);
  const { classApi } = require(compiledClassPath);
  const { catalogApi } = require(compiledCatalogPath);

  // =========================================================================
  // 1. studentApi.getStudentProfile Inbound Normalizer & Fallback
  // =========================================================================
  console.log('--- 1. studentApi.getStudentProfile Inbound Normalizer ---');

  await runChallenge('1.1 Unwraps NestJS nested envelope { studentInfo, packages, attendances, walletSummary }', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            studentInfo: {
              id: 'stu-nest-001',
              name: '李小冉',
              studentNo: 'S990001',
              gender: 'female',
              phone: '13900001111',
              guardianRelation: '母亲',
              expireDateText: '2027-12-31',
              channelSource: '线下地推',
              status: 'normal',
              campus: { id: 'campus-bj-hq', name: '北京总部' },
            },
            walletSummary: {
              principalBalance: 1200,
              bonusBalance: 300,
            },
            packages: [
              {
                id: 'pkg-01',
                courseId: 'crs-math',
                remainingLessons: 30,
                pricePerLesson: 100,
                totalLessons: 40,
                course: { id: 'crs-math', name: '奥数培优' },
                class: { id: 'cls-math-01', name: '奥数一班' },
              },
              {
                id: 'pkg-02',
                courseId: 'crs-eng',
                remainingLessons: 10,
                pricePerLesson: 80,
                totalLessons: 20,
                status: 'frozen',
                course: { id: 'crs-eng', name: '少儿英语' },
              },
            ],
            attendances: [
              {
                id: 'att-101',
                status: 'present',
                deductLessons: 1,
                courseName: '奥数培优',
                scheduleEvent: {
                  id: 'sch-101',
                  date: '2026-10-14',
                  startTime: '09:00',
                  endTime: '11:00',
                  class: { name: '奥数一班' },
                  semanticType: 'regular',
                },
                teacherName: '张老师',
              },
            ],
          },
        },
      });
    };

    const profile = await studentApi.getStudentProfile('stu-nest-001');

    assert.strictEqual(profile.id, 'stu-nest-001');
    assert.strictEqual(profile.name, '李小冉');
    assert.strictEqual(profile.gender, '女', 'Expected female to normalize to 女');
    assert.strictEqual(profile.walletBalance, 1500, 'Expected wallet balance to be 1200 + 300 = 1500');
    assert.strictEqual(profile.totalRemainingLessons, 40, 'Expected remaining lessons 30 + 10 = 40');
    assert.strictEqual(profile.totalRemainingAmount, 3800, 'Expected remaining amount 30*100 + 10*80 = 3800');
    assert.strictEqual(profile.campusName, '北京总部');

    // Packages check
    assert.strictEqual(profile.courses.length, 2);
    assert.strictEqual(profile.courses[0].courseName, '奥数培优');
    assert.strictEqual(profile.courses[0].className, '奥数一班');
    assert.strictEqual(profile.courses[0].isEnrolledClass, true);
    assert.strictEqual(profile.courses[1].courseName, '少儿英语');
    assert.strictEqual(profile.courses[1].isEnrolledClass, false);

    // Attendances check
    assert.strictEqual(profile.attendances.length, 1);
    assert.strictEqual(profile.attendances[0].statusText, '已签到');
    assert.strictEqual(profile.attendances[0].className, '奥数一班');
    assert.strictEqual(profile.attendances[0].classType, '常规课');
  });

  await runChallenge('1.2 Graceful fallback when backend is unreachable', async () => {
    mockRequestBehavior = 'network_error';
    const profile = await studentApi.getStudentProfile('stu-fallback');
    assert.ok(profile, 'Profile fallback returned null');
    assert.strictEqual(profile.id, 'stu-fallback');
    assert.ok(profile.name, 'Fallback profile missing name');
    assert.ok(Array.isArray(profile.courses), 'Fallback courses must be array');
    assert.ok(Array.isArray(profile.attendances), 'Fallback attendances must be array');
  });

  // =========================================================================
  // 2. studentApi.enrollStudent Outbound Normalizer & DTO Alignment
  // =========================================================================
  console.log('\n--- 2. studentApi.enrollStudent Outbound Normalizer ---');

  await runChallenge('2.1 Synthesizes totalLessons, pricePerLesson, sanitized paymentMethod and channel', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({ statusCode: 200, data: { orderId: 'ord-123', success: true } });
    };

    const payload = {
      studentId: 's-test-01',
      courseId: 'crs-test-01',
      classId: 'cls-test-01',
      className: '少儿绘画-01班',
      amount: 3200,
      lessons: 32,
      payMethod: 'wx',
    };

    const res = await studentApi.enrollStudent(payload);
    assert.ok(res, 'enrollStudent result null');

    assert.strictEqual(lastRequestOptions.url, 'http://127.0.0.1:3001/api/students/enroll');
    assert.strictEqual(lastRequestOptions.method, 'POST');
    const sent = lastRequestOptions.data;

    assert.strictEqual(sent.studentId, 's-test-01');
    assert.strictEqual(sent.courseId, 'crs-test-01');
    assert.strictEqual(sent.classId, 'cls-test-01');
    assert.strictEqual(sent.totalLessons, 32);
    assert.strictEqual(sent.pricePerLesson, 100);
    assert.strictEqual(sent.paymentMethod, 'wechat', 'wx must be normalized to wechat');
    assert.strictEqual(sent.channel, 'ground');
    assert.strictEqual(sent.remark, '报读班级: 少儿绘画-01班');
  });

  await runChallenge('2.2 Defaults safely when optional fields are omitted or aliases used', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({ statusCode: 200, data: { success: true } });
    };

    // ali alias
    await studentApi.enrollStudent({
      studentId: 's-02',
      courseId: 'crs-02',
      payMethod: 'ali',
    });
    assert.strictEqual(lastRequestOptions.data.paymentMethod, 'alipay');
    assert.strictEqual(lastRequestOptions.data.totalLessons, 48, 'Should default totalLessons to 48');
    assert.strictEqual(lastRequestOptions.data.pricePerLesson, 64, 'Should default pricePerLesson to 64');

    // invalid payment method fallback
    await studentApi.enrollStudent({
      studentId: 's-03',
      courseId: 'crs-03',
      paymentMethod: 'bitcoin',
    });
    assert.strictEqual(lastRequestOptions.data.paymentMethod, 'wechat');
  });

  // =========================================================================
  // 3. studentApi.createStudent & updateStudent Gender & Campus Normalizers
  // =========================================================================
  console.log('\n--- 3. studentApi.createStudent & updateStudent Normalizers ---');

  await runChallenge('3.1 createStudent maps Chinese gender to English enum and sources campusId from storage', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({ statusCode: 200, data: { id: 's-created', success: true } });
    };

    storageMock.currentCampusId = 'campus-sh-pudong';

    await studentApi.createStudent({
      name: '陈小萌',
      phone: '13800002222',
      gender: '女',
    });

    const sent = lastRequestOptions.data;
    assert.strictEqual(sent.name, '陈小萌');
    assert.strictEqual(sent.phone, '13800002222');
    assert.strictEqual(sent.gender, 'female', 'Expected 女 to map to female');
    assert.strictEqual(sent.campusId, 'campus-sh-pudong', 'Expected campusId from storage');
  });

  await runChallenge('3.2 updateStudent normalizes gender on payload', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({ statusCode: 200, data: { success: true } });
    };

    await studentApi.updateStudent('s-99', {
      name: '王小帅',
      gender: '男',
    });

    assert.strictEqual(lastRequestOptions.url, 'http://127.0.0.1:3001/api/students/s-99');
    assert.strictEqual(lastRequestOptions.method, 'PUT');
    assert.strictEqual(lastRequestOptions.data.gender, 'male', 'Expected 男 to map to male');
  });

  // =========================================================================
  // 4. classApi & catalogApi Paginated & Relational Normalizers
  // =========================================================================
  console.log('\n--- 4. classApi & catalogApi Paginated & Relational Normalizers ---');

  await runChallenge('4.1 catalogApi.getCourses normalizes paginated envelope { total, list }', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            total: 1,
            page: 1,
            pageSize: 10,
            list: [
              {
                id: 'crs-robot-1',
                name: '创客机器人初级',
                subject: 'STEAM',
                grade: '三年级',
                unitPrice: 120,
                totalLessons: 30,
              },
            ],
          },
        },
      });
    };

    const courses = await catalogApi.getCourses();
    assert.strictEqual(courses.length, 1);
    assert.strictEqual(courses[0].id, 'crs-robot-1');
    assert.strictEqual(courses[0].name, '创客机器人初级');
    assert.strictEqual(courses[0].subjectName, 'STEAM');
    assert.strictEqual(courses[0].pricePerLesson, 120);
    assert.strictEqual(courses[0].totalLessons, 30);
    assert.strictEqual(courses[0].totalPrice, 3600);
  });

  await runChallenge('4.2 classApi.getClasses normalizes paginated envelope and calculates enrolledCount', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            total: 1,
            list: [
              {
                id: 'cls-nest-1',
                name: '创意编程01班',
                status: 'active',
                type: 'regular',
                plannedLessons: 60,
                completedLessons: 12,
                enrolledCount: 8,
                capacity: 12,
                teacher: { id: 't-1', realName: '韩老师' },
                course: { id: 'crs-1', name: 'Scratch创意编程' },
              },
            ],
          },
        },
      });
    };

    const classes = await classApi.getClasses();
    assert.strictEqual(classes.length, 1);
    assert.strictEqual(classes[0].name, '创意编程01班');
    assert.strictEqual(classes[0].classType, '常规班');
    assert.strictEqual(classes[0].completedLessons, 12);
    assert.strictEqual(classes[0].totalLessons, 60);
    assert.strictEqual(classes[0].currentStudentCount, 8);
    assert.strictEqual(classes[0].teacherName, '韩老师');
  });

  await runChallenge('4.3 classApi.getClassDetail unpacks studentPackages relation', async () => {
    mockRequestBehavior = (opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            id: 'cls-rel-1',
            name: '少儿书法-01班',
            status: 'active',
            capacity: 15,
            course: { name: '少儿书法' },
            teacher: { realName: '王老师' },
            studentPackages: [
              {
                studentId: 'stu-rel-1',
                remainingLessons: 42,
                createdAt: '2026-09-15T08:00:00.000Z',
                student: {
                  id: 'stu-rel-1',
                  name: '赵子轩',
                  studentNo: 'S990099',
                  phone: '13888889999',
                },
              },
            ],
          },
        },
      });
    };

    const detail = await classApi.getClassDetail('cls-rel-1');
    assert.strictEqual(detail.id, 'cls-rel-1');
    assert.strictEqual(detail.name, '少儿书法-01班');
    assert.strictEqual(detail.currentStudentCount, 1);
    assert.strictEqual(detail.students.length, 1);
    assert.strictEqual(detail.students[0].name, '赵子轩');
    assert.strictEqual(detail.students[0].studentNo, 'S990099');
    assert.strictEqual(detail.students[0].phone, '13888889999');
    assert.strictEqual(detail.students[0].availableLessons, 42);
    assert.strictEqual(detail.students[0].joinDateText, '2026-09-15');
  });

  // =========================================================================
  // 5. Zero Swallowed Exceptions & Real Error Toast Verification
  // =========================================================================
  console.log('\n--- 5. Zero Swallowed Exceptions & Real Error Toasts ---');

  await runChallenge('5.1 studentApi.enrollStudent: Rejects on HTTP 400 and shows real error toast', async () => {
    mockRequestBehavior = 'http_400';
    toastLog = [];

    let caughtError = null;
    try {
      await studentApi.enrollStudent({ studentId: 's-err', courseId: 'crs-err' });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected enrollStudent to reject on HTTP 400');
    assert.strictEqual(caughtError.message, 'totalLessons 必须大于等于 1');

    const hasErrorToast = toastLog.some((t) => t.title && t.title.includes('totalLessons 必须大于等于 1'));
    assert.ok(hasErrorToast, 'Expected error toast displaying actual backend validation error');

    const hasFakeSuccessToast = toastLog.some((t) => t.icon === 'success' || (t.title && t.title.includes('成功')));
    assert.strictEqual(hasFakeSuccessToast, false, 'VIOLATION: Fake success toast triggered on 400 error!');
  });

  await runChallenge('5.2 studentApi.enrollStudent: Rejects on HTTP 500 without fake success', async () => {
    mockRequestBehavior = 'http_500';
    toastLog = [];

    let caughtError = null;
    try {
      await studentApi.enrollStudent({ studentId: 's-err500', courseId: 'crs-err500' });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected enrollStudent to reject on HTTP 500');
    assert.strictEqual(caughtError.message, '数据库事务异常，开单失败');

    const hasFakeSuccessToast = toastLog.some((t) => t.icon === 'success');
    assert.strictEqual(hasFakeSuccessToast, false, 'VIOLATION: Fake success toast triggered on 500 error!');
  });

  await runChallenge('5.3 studentApi.createStudent: Rejects on HTTP 400 and toasts backend message', async () => {
    mockRequestBehavior = 'http_400';
    toastLog = [];

    let caughtError = null;
    try {
      await studentApi.createStudent({ name: '测试', phone: '13800000000' });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected createStudent to reject on HTTP 400');
    assert.strictEqual(caughtError.message, 'totalLessons 必须大于等于 1');
  });

  await runChallenge('5.4 classApi.completeClass: Rejects on HTTP 500 and prevents fake completion', async () => {
    mockRequestBehavior = 'http_500';
    toastLog = [];

    let caughtError = null;
    try {
      await classApi.completeClass('cls-err-500');
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected completeClass to reject on HTTP 500');
    assert.strictEqual(caughtError.message, '数据库事务异常，开单失败');
  });

  await runChallenge('5.5 classApi.addClassStudents: Rejects on HTTP 400 without swallowing', async () => {
    mockRequestBehavior = 'http_400';
    let caughtError = null;
    try {
      await classApi.addClassStudents('cls-err', ['stu-1']);
    } catch (e) {
      caughtError = e;
    }
    assert.ok(caughtError, 'Expected addClassStudents to reject on HTTP 400');
  });

  await runChallenge('5.6 401 Unauthorized clears token and rejects request', async () => {
    mockRequestBehavior = 'http_401';
    storageMock.token = 'will-expire';

    let caughtError = null;
    try {
      await studentApi.enrollStudent({ studentId: 's-401', courseId: 'crs-401' });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Expected request to reject on 401');
    assert.strictEqual(storageMock.token, undefined, 'Token was not removed on 401');
  });

  // =========================================================================
  // 6. Static View Anti-Swallowing & Anti-Fake-Success Audit
  // =========================================================================
  console.log('\n--- 6. Static View Anti-Swallowing & Anti-Fake-Success Audit ---');

  await runChallenge('6.1 Phase 3 views have no swallowed error blocks or fake success in catch', async () => {
    const phase3Views = [
      'mini-program/src/package-student/enroll/wizard.vue',
      'mini-program/src/package-student/detail/index.vue',
      'mini-program/src/package-student/list/index.vue',
      'mini-program/src/package-student/edit/index.vue',
      'mini-program/src/package-edu/class/index.vue',
      'mini-program/src/package-edu/class/detail.vue',
      'mini-program/src/package-edu/warning/index.vue',
    ];

    for (const relPath of phase3Views) {
      const fullPath = path.resolve(__dirname, '..', relPath);
      assert.ok(fs.existsSync(fullPath), `View file not found: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check for empty catch block: catch (e) {} or catch {}
      const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
      const matches = content.match(emptyCatchRegex);
      if (matches) {
        // Ensure no empty catch around writing api calls
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('catch') && (lines[i].includes('{}') || (lines[i + 1] && lines[i + 1].trim() === '}'))) {
            // Check context for critical writes
            const surrounding = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join('\n');
            assert.ok(
              !surrounding.includes('enrollStudent') &&
              !surrounding.includes('createStudent') &&
              !surrounding.includes('updateStudent') &&
              !surrounding.includes('completeClass') &&
              !surrounding.includes('rechargeWallet'),
              `VIOLATION: Empty catch block around critical write in ${relPath}:${i + 1}`
            );
          }
        }
      }

      // Check for fake success toast in catch block
      const lines = content.split('\n');
      let inCatchBlock = false;
      let braceDepth = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('catch') && line.includes('{')) {
          inCatchBlock = true;
          braceDepth = 1;
          continue;
        }
        if (inCatchBlock) {
          if (line.includes('{')) braceDepth++;
          if (line.includes('}')) braceDepth--;
          if (line.includes("icon: 'success'") || line.includes('成功')) {
            assert.fail(`VIOLATION: Found success toast inside catch block in ${relPath}:${i + 1}`);
          }
          if (braceDepth <= 0) {
            inCatchBlock = false;
          }
        }
      }
    }
  });

  console.log('\n================================================================================');
  console.log(`🎉 Phase 3 Empirical Challenger Test Suite PASSED! All ${passCount}/${totalCount} challenges met.`);
  console.log('================================================================================\n');
}

run().catch((err) => {
  console.error('\n❌ PHASE 3 EMPIRICAL CHALLENGER TEST FAILED:', err);
  process.exit(1);
});
