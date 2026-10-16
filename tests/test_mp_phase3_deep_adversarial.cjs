const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('================================================================================');
console.log('🛡️  Challenger 1 — Phase 3 Empirical Adversarial Stress Harness');
console.log('    (Student 360 Profile & Enrollment Wizard & Class Normalizers)');
console.log('================================================================================\n');

let passCount = 0;
let totalCount = 0;

async function runTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

// 辅助环境初始化：为 uni-app 编译产物提供运行时 mock
let currentRequestHandler = (opts) => {
  if (opts.fail) {
    opts.fail({ errMsg: 'request:fail connection refused' });
  } else {
    opts.success({ statusCode: 500, data: { message: 'offline' } });
  }
};

function setupMockRuntime() {
  const storage = {
    token: 'test-jwt-token',
    currentCampusId: 'campus-bj-hq',
  };

  global.Page = global.Page || function() {};
  global.Component = global.Component || function() {};
  global.App = global.App || function() {};
  global.getCurrentPages = global.getCurrentPages || function() { return []; };
  global.getApp = global.getApp || function() { return {}; };

  let lastRequestOpts = null;

  const mockWx = {
    getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375, platform: 'devtools' }),
    getSystemInfo: (opts) => opts && opts.success && opts.success({ statusBarHeight: 20, windowWidth: 375 }),
    canIUse: () => true,
    getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 24, right: 368, bottom: 56, left: 281 }),
    getStorageSync: (k) => storage[k] || '',
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: (k) => { delete storage[k]; },
    showToast: () => {},
    reLaunch: () => {},
    request: (opts) => {
      lastRequestOpts = opts;
      return currentRequestHandler(opts);
    }
  };

  global.wx = global.uni = mockWx;

  return {
    storage,
    getLastRequestOpts: () => lastRequestOpts,
    setMockRequest: (fn) => { currentRequestHandler = fn; }
  };
}

const runtime = setupMockRuntime();


async function main() {
  const miniProgRoot = path.resolve(__dirname, '../mini-program');
  const compiledStudentPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/student.js');
  const compiledClassPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/class.js');
  const compiledCatalogPath = path.resolve(miniProgRoot, 'dist/build/mp-weixin/api/catalog.js');

  assert.ok(fs.existsSync(compiledStudentPath), 'compiled student.js 不存在');
  assert.ok(fs.existsSync(compiledClassPath), 'compiled class.js 不存在');
  assert.ok(fs.existsSync(compiledCatalogPath), 'compiled catalog.js 不存在');

  const { studentApi } = require(compiledStudentPath);
  const { classApi } = require(compiledClassPath);
  const { catalogApi } = require(compiledCatalogPath);


  // -----------------------------------------------------------------------------
  // 【SECTION 1】studentApi.getStudentProfile: 嵌套信封解包与多维边缘情况
  // -----------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('【SECTION 1】studentApi.getStudentProfile 嵌套信封解包与边缘数据核验');
  console.log('----------------------------------------------------------------');

  await runTest('1.1 后端标准嵌套信封 (studentInfo + walletSummary + packages + attendances) 解包完整性', async () => {
    runtime.setMockRequest((opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            studentInfo: {
              id: 'stu-adv-001',
              studentNo: 'S990001',
              name: '对抗学员甲',
              gender: 'male',
              phone: '13900001111',
              parentName: '甲父',
              status: 'normal',
              campus: { id: 'campus-bj-hq', name: '总部校区' },
            },
            walletSummary: {
              principalBalance: 2500,
              bonusBalance: 500,
              goldPoints: 100,
            },
            packages: [
              {
                id: 'pkg-1',
                courseId: 'crs-1',
                course: { id: 'crs-1', name: '高阶C++算法' },
                classId: 'cls-1',
                class: { id: 'cls-1', name: 'C++精英班' },
                remainingLessons: 20,
                pricePerLesson: 150,
                totalLessons: 40,
                status: 'active',
              },
              {
                id: 'pkg-2',
                courseId: 'crs-2',
                course: { id: 'crs-2', name: 'Python少儿编程' },
                remainingLessons: 10,
                pricePerLesson: 100,
                totalLessons: 20,
                status: 'frozen',
              }
            ],
            attendances: [
              {
                id: 'att-1',
                status: 'present',
                deductLessons: 2,
                scheduleEvent: {
                  id: 'sch-1',
                  date: '2026-10-14',
                  startTime: '10:00',
                  endTime: '12:00',
                  semanticType: 'regular',
                  class: { name: 'C++精英班' }
                },
                teacherName: '李老师',
              },
              {
                id: 'att-2',
                status: 'leave',
                deductLessons: 0,
                scheduleEvent: null,
                className: 'Python周末班',
                timeRangeText: '2026-10-12 14:00-16:00',
                teacherName: '张老师',
              }
            ],
            communications: [
              {
                id: 'comm-1',
                type: 'after_sale',
                dateText: '2026-10-15 09:30',
                communicator: '学管小王',
                method: '微信',
                content: '学员算法竞赛获奖跟进',
              }
            ]
          }
        }
      });
    });

    const profile = await studentApi.getStudentProfile('stu-adv-001');

    assert.strictEqual(profile.id, 'stu-adv-001');
    assert.strictEqual(profile.name, '对抗学员甲');
    assert.strictEqual(profile.studentNo, 'S990001');
    assert.strictEqual(profile.gender, '男', 'male 未正确归一化为男');
    assert.strictEqual(profile.walletBalance, 3000, 'walletBalance 未正确累加 principal + bonus');
    assert.strictEqual(profile.totalRemainingLessons, 30, 'packages 剩余课次汇总错误 (20 + 10 = 30)');
    assert.strictEqual(profile.totalRemainingAmount, 4000, 'packages 剩余金额汇总错误 (20*150 + 10*100 = 4000)');
    assert.strictEqual(profile.courses.length, 2);
    assert.strictEqual(profile.courses[0].courseName, '高阶C++算法');
    assert.strictEqual(profile.courses[0].className, 'C++精英班');
    assert.strictEqual(profile.courses[0].isEnrolledClass, true);
    assert.strictEqual(profile.courses[1].isEnrolledClass, false);
    assert.strictEqual(profile.attendances.length, 2);
    assert.strictEqual(profile.attendances[0].statusText, '已签到');
    assert.strictEqual(profile.attendances[1].statusText, '请假');
    assert.strictEqual(profile.attendances[0].timeRangeText, '2026-10-14 10:00 -12:00');
    assert.strictEqual(profile.communications.length, 1);
  });

  await runTest('1.2 性别映射双向容错 (male/female/男/女/未知)', async () => {
    const testCases = [
      { input: 'female', expected: '女' },
      { input: '女', expected: '女' },
      { input: 'male', expected: '男' },
      { input: '男', expected: '男' },
      { input: undefined, expected: '男' },
      { input: 'unknown', expected: '男' },
    ];

    for (const tc of testCases) {
      runtime.setMockRequest((opts) => {
        opts.success({
          statusCode: 200,
          data: {
            code: 200,
            data: {
              studentInfo: {
                id: 's-gender-test',
                name: '性别测试',
                gender: tc.input,
              },
              packages: [],
            }
          }
        });
      });
      const res = await studentApi.getStudentProfile('s-gender-test');
      assert.strictEqual(res.gender, tc.expected, `输入 ${tc.input} 期望得到 ${tc.expected}，实际为 ${res.gender}`);
    }
  });

  await runTest('1.3 钱包与课包为空或为零时的边界健壮性 (零透支与零除)', async () => {
    runtime.setMockRequest((opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            studentInfo: { id: 's-zero', name: '零资产学员' },
            walletSummary: { principalBalance: 0, bonusBalance: 0 },
            packages: [],
            attendances: [],
          }
        }
      });
    });

    const res = await studentApi.getStudentProfile('s-zero');
    assert.strictEqual(res.walletBalance, 0);
    assert.ok(typeof res.totalRemainingLessons === 'number' && !isNaN(res.totalRemainingLessons));
    assert.ok(typeof res.totalRemainingAmount === 'number' && !isNaN(res.totalRemainingAmount));
  });

  // -----------------------------------------------------------------------------
  // 【SECTION 2】studentApi.enrollStudent: 报名开单出参规整与后端 DTO 强校验
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【SECTION 2】studentApi.enrollStudent 报名单规整与后端 DTO 对齐核验');
  console.log('----------------------------------------------------------------');

  await runTest('2.1 前端输入 lessons 与 amount 自动推导 totalLessons 和 pricePerLesson', async () => {
    let capturedDto = null;
    runtime.setMockRequest((opts) => {
      capturedDto = opts.data;
      opts.success({ statusCode: 200, data: { code: 200, data: { orderId: 'ord-123' } } });
    });

    await studentApi.enrollStudent({
      studentId: 'stu-001',
      courseId: 'crs-001',
      lessons: 30,
      amount: 2400,
      payMethod: 'weixin',
    });

    assert.ok(capturedDto, '后端 DTO 载荷未捕获');
    assert.strictEqual(capturedDto.studentId, 'stu-001');
    assert.strictEqual(capturedDto.courseId, 'crs-001');
    assert.strictEqual(capturedDto.totalLessons, 30, 'totalLessons 未正确映射自 lessons');
    assert.strictEqual(capturedDto.pricePerLesson, 80, 'pricePerLesson 未正确推导为 2400/30=80');
    assert.strictEqual(capturedDto.paymentMethod, 'wechat', 'weixin 未正确规整为 wechat');
    assert.strictEqual(capturedDto.channel, 'ground');
  });

  await runTest('2.2 支付方式多源枚举值归一化 (wx -> wechat, ali -> alipay, 异常 -> wechat)', async () => {
    const matrix = [
      { input: 'wx', expected: 'wechat' },
      { input: 'weixin', expected: 'wechat' },
      { input: 'wechat', expected: 'wechat' },
      { input: 'ali', expected: 'alipay' },
      { input: 'alipay', expected: 'alipay' },
      { input: 'bank_transfer', expected: 'bank_transfer' },
      { input: 'pos', expected: 'pos' },
      { input: 'wallet', expected: 'wallet' },
      { input: 'bitcoin', expected: 'wechat' }, // 非法值兜底
      { input: undefined, expected: 'wechat' },
    ];

    for (const item of matrix) {
      let captured = null;
      runtime.setMockRequest((opts) => {
        captured = opts.data;
        opts.success({ statusCode: 200, data: { code: 200, data: { ok: true } } });
      });

      await studentApi.enrollStudent({
        studentId: 's-1',
        courseId: 'c-1',
        totalLessons: 10,
        pricePerLesson: 50,
        paymentMethod: item.input,
      });

      assert.strictEqual(captured.paymentMethod, item.expected, `支付方式 ${item.input} 规整结果不匹配`);
    }
  });

  await runTest('2.3 零元/赠送单 pricePerLesson = 0 边界值保护 (不得被假值默认替换)', async () => {
    let captured = null;
    runtime.setMockRequest((opts) => {
      captured = opts.data;
      opts.success({ statusCode: 200, data: { code: 200, data: { ok: true } } });
    });

    await studentApi.enrollStudent({
      studentId: 's-1',
      courseId: 'c-1',
      totalLessons: 10,
      pricePerLesson: 0,
      amount: 0,
    });

    assert.strictEqual(captured.pricePerLesson, 0, '单价为 0 时被错误改写');
    assert.strictEqual(captured.totalLessons, 10);
  });

  await runTest('2.4 报读班级时 classId 与 className 关联 remark 透传', async () => {
    let captured = null;
    runtime.setMockRequest((opts) => {
      captured = opts.data;
      opts.success({ statusCode: 200, data: { code: 200, data: { ok: true } } });
    });

    await studentApi.enrollStudent({
      studentId: 's-1',
      courseId: 'c-1',
      classId: 'cls-spring-01',
      className: '2026春季高阶少儿编程',
      totalLessons: 48,
    });

    assert.strictEqual(captured.classId, 'cls-spring-01');
    assert.ok(captured.remark && captured.remark.includes('2026春季高阶少儿编程'), '班级名称未写入备注');
  });

  // -----------------------------------------------------------------------------
  // 【SECTION 3】studentApi.createStudent / updateStudent: 性别与校区兜底
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【SECTION 3】studentApi.createStudent / updateStudent 入参出参契约核验');
  console.log('----------------------------------------------------------------');

  await runTest('3.1 createStudent 中文性别转英文枚举 (男->male, 女->female)', async () => {
    let captured = null;
    runtime.setMockRequest((opts) => {
      captured = opts.data;
      opts.success({ statusCode: 200, data: { code: 200, data: { id: 'new-stu' } } });
    });

    await studentApi.createStudent({
      name: '小明',
      phone: '13811112222',
      gender: '女',
    });

    assert.strictEqual(captured.gender, 'female', '女 未转为 female');
    assert.strictEqual(captured.campusId, 'campus-bj-hq', '未自动注入默认校区');
  });

  // -----------------------------------------------------------------------------
  // 【SECTION 4】classApi & catalogApi: 列表与详情规整健壮性
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【SECTION 4】classApi & catalogApi 集合结构智能解包与映射');
  console.log('----------------------------------------------------------------');

  await runTest('4.1 classApi.getClasses 兼容分 envelope: { total, list } 与 raw array', async () => {
    // 形式 1: { total: 1, list: [...] }
    runtime.setMockRequest((opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            total: 1,
            list: [
              {
                id: 'cls-e1',
                name: 'Scratch创意编程-01班',
                status: 'active',
                type: 'regular',
                course: { id: 'crs-sc', name: 'Scratch创意编程' },
                teacher: { id: 't-1', realName: '陈老师' },
                advisor: { id: 'a-1', realName: '李老师' },
                capacity: 15,
                enrolledCount: 12,
              }
            ]
          }
        }
      });
    });

    const list1 = await classApi.getClasses();
    assert.strictEqual(list1.length, 1);
    assert.strictEqual(list1[0].name, 'Scratch创意编程-01班');
    assert.strictEqual(list1[0].teacherName, '陈老师');
    assert.strictEqual(list1[0].currentStudentCount, 12);
    assert.strictEqual(list1[0].classType, '常规班');

    // 形式 2: 直接数组
    runtime.setMockRequest((opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: [
            {
              id: 'cls-e2',
              name: 'Python高阶-02班',
              courseName: 'Python高阶',
              teacherName: '王老师',
              capacity: 20,
              currentStudentCount: 18,
            }
          ]
        }
      });
    });

    const list2 = await classApi.getClasses();
    assert.strictEqual(list2.length, 1);
    assert.strictEqual(list2[0].name, 'Python高阶-02班');
    assert.strictEqual(list2[0].currentStudentCount, 18);
  });

  await runTest('4.2 classApi.getClassDetail 映射 studentPackages 且 0 剩余课次不失真', async () => {
    runtime.setMockRequest((opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            id: 'cls-detail-test',
            name: 'C++精英特训班',
            capacity: 20,
            studentPackages: [
              {
                studentId: 'stu-p1',
                student: { id: 'stu-p1', name: '零课次学员', studentNo: 'S00001', phone: '13800000000' },
                remainingLessons: 0, // 0 课次不能回退为默认 57
                createdAt: '2026-10-01T08:00:00Z',
              },
              {
                studentId: 'stu-p2',
                student: { id: 'stu-p2', name: '正常课次学员', studentNo: 'S00002', phone: '13800000001' },
                remainingLessons: 24,
                createdAt: '2026-10-02T08:00:00Z',
              }
            ]
          }
        }
      });
    });

    const detail = await classApi.getClassDetail('cls-detail-test');
    assert.strictEqual(detail.id, 'cls-detail-test');
    assert.strictEqual(detail.students.length, 2);
    assert.strictEqual(detail.students[0].name, '零课次学员');
    assert.strictEqual(detail.students[0].availableLessons, 0, '0 剩余课次被错误改写或兜底');
    assert.strictEqual(detail.students[1].availableLessons, 24);
  });

  await runTest('4.3 catalogApi.getCourses 兼容 { total, list } 与价格汇总推导', async () => {
    runtime.setMockRequest((opts) => {
      opts.success({
        statusCode: 200,
        data: {
          code: 200,
          data: {
            total: 2,
            list: [
              {
                id: 'crs-c1',
                name: 'Python人工智能',
                subject: 'AI编程',
                grade: '初中',
                unitPrice: 120,
                totalLessons: 30,
              },
              {
                id: 'crs-c2',
                name: '少儿机甲大师',
                subjectName: '机器人',
                pricePerLesson: 150,
                totalLessons: 20,
                totalPrice: 3000,
              }
            ]
          }
        }
      });
    });

    const courses = await catalogApi.getCourses();
    assert.strictEqual(courses.length, 2);
    assert.strictEqual(courses[0].pricePerLesson, 120);
    assert.strictEqual(courses[0].totalPrice, 3600, '30 * 120 乘积计算有误');
    assert.strictEqual(courses[1].totalPrice, 3000);
  });

  // -----------------------------------------------------------------------------
  // 【SECTION 5】真实在线后端全流程端到端连通性核验 (Live Backend Round-Trip)
  // -----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('【SECTION 5】真实在线 NestJS 后端实测与往返契约核验 (Port 3001)');
  console.log('----------------------------------------------------------------');

  let liveToken = null;
  let testStudentId = null;
  let testCourseId = null;
  let testClassId = null;

  await runTest('5.1 登录后台获取真实 JWT AccessToken', async () => {
    const postData = JSON.stringify({ account: 'donghaichao', password: '123456' });
    const res = await new Promise((resolve, reject) => {
      const req = http.request('http://127.0.0.1:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        }
      }, (resp) => {
        let raw = '';
        resp.on('data', chunk => raw += chunk);
        resp.on('end', () => resolve(JSON.parse(raw)));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    assert.strictEqual(res.code, 200, `登录返回非 200: ${res.message}`);
    assert.ok(res.data && res.data.accessToken, '未获取到 accessToken');
    liveToken = res.data.accessToken;
  });

  // 配置真实的 HTTP 客户端至 uni.request，完成真实网络调用
  function useLiveBackend() {
    runtime.storage.token = liveToken;
    runtime.storage.currentCampusId = 'campus-bj-hq';

    runtime.setMockRequest((opts) => {
      const postData = opts.data && ['POST', 'PUT', 'PATCH'].includes(opts.method) ? JSON.stringify(opts.data) : null;
      let queryUrl = opts.url;
      if (opts.method === 'GET' && opts.data) {
        const q = new URLSearchParams(opts.data).toString();
        queryUrl += (queryUrl.includes('?') ? '&' : '?') + q;
      }
      const targetUrl = new URL(queryUrl);

      const headers = { ...opts.header };
      if (postData) {
        headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = http.request(targetUrl, {
        method: opts.method || 'GET',
        headers,
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          opts.success({
            statusCode: res.statusCode,
            data: parsed,
          });
        });
      });

      req.on('error', (err) => {
        if (opts.fail) opts.fail(err);
      });

      if (postData) req.write(postData);
      req.end();
    });
  }


  await runTest('5.2 实测 studentApi.getStudents() 获取真实在线学员列表', async () => {
    useLiveBackend();
    const res = await studentApi.getStudents({ page: 1, pageSize: 5 });
    assert.ok(res && Array.isArray(res.list), '在线学员返回不是列表');
    assert.ok(res.list.length > 0, '在线学员列表为空');
    const first = res.list[0];
    assert.ok(first.id, '学员缺少 id');
    assert.ok(first.name, '学员缺少 name');
    assert.ok(first.studentNo, '学员缺少 studentNo');
    assert.ok(typeof first.remainingLessons === 'number', '学员缺少 remainingLessons');
    testStudentId = first.id;
  });

  await runTest('5.3 实测 studentApi.getStudentProfile() 获取并归一化真实学员 360° 画像', async () => {
    useLiveBackend();
    assert.ok(testStudentId, '缺少测试学员 ID');
    const profile = await studentApi.getStudentProfile(testStudentId);

    assert.strictEqual(profile.id, testStudentId);
    assert.ok(profile.name, '学员名称缺失');
    assert.ok(['男', '女'].includes(profile.gender), `性别不符合规范: ${profile.gender}`);
    assert.ok(typeof profile.walletBalance === 'number', '钱包余额非数值');
    assert.ok(Array.isArray(profile.courses), 'courses 必须为数组');
    assert.ok(Array.isArray(profile.attendances), 'attendances 必须为数组');
  });

  await runTest('5.4 实测 studentApi.createStudent() 新建学员落库 (含中文性别归一化)', async () => {
    useLiveBackend();
    const phone = `138${Math.floor(10000000 + Math.random() * 90000000)}`;
    const name = `实测对抗学员_${Date.now().toString().slice(-4)}`;
    
    const res = await studentApi.createStudent({
      name,
      phone,
      gender: '男',
    });

    assert.ok(res && res.id, '新建学员未返回创建对象');
    assert.strictEqual(res.name, name);
    // 验证可通过 profile 查询出新创建学员
    const newProfile = await studentApi.getStudentProfile(res.id);
    assert.strictEqual(newProfile.name, name);
    assert.strictEqual(newProfile.gender, '男');
    testStudentId = res.id; // 后续开单复用该学员
  });

  await runTest('5.5 实测 catalogApi.getCourses() 获取真实在线课程', async () => {
    useLiveBackend();
    const courses = await catalogApi.getCourses();
    assert.ok(Array.isArray(courses) && courses.length > 0, '真实课程目录为空');
    testCourseId = courses[0].id;
    assert.ok(testCourseId, '测试课程 ID 缺失');
  });

  await runTest('5.6 实测 classApi.getClasses() 与 getClassDetail() 获取真实班级与学员花名册', async () => {
    useLiveBackend();
    const classes = await classApi.getClasses();
    assert.ok(Array.isArray(classes) && classes.length > 0, '真实班级列表为空');
    testClassId = classes[0].id;

    const detail = await classApi.getClassDetail(testClassId);
    assert.strictEqual(detail.id, testClassId);
    assert.ok(detail.name, '班级详情缺少名称');
    assert.ok(Array.isArray(detail.students), '班级学员必须为数组');
  });

  await runTest('5.7 实测 studentApi.enrollStudent() 全链路报名落库并产生课包', async () => {
    useLiveBackend();
    assert.ok(testStudentId && testCourseId, '缺少学员或课程 ID');

    // 选课报名开单 (使用前端入参格式)
    const enrollRes = await studentApi.enrollStudent({
      studentId: testStudentId,
      courseId: testCourseId,
      classId: testClassId,
      lessons: 24,
      amount: 1920,
      payMethod: 'wx',
    });

    assert.ok(enrollRes && (enrollRes.orderId || enrollRes.orderNo || enrollRes.success !== false), 
      '报名开单返回失败');

    // 重新查学员档案，验证课包已成功落库
    const updatedProfile = await studentApi.getStudentProfile(testStudentId);
    assert.ok(updatedProfile.courses.length > 0, '报名后学员课包列表仍为空');
    const matchedPkg = updatedProfile.courses.find(c => c.courseId === testCourseId);
    assert.ok(matchedPkg, '未在学员课包中找到刚报名的课程');
    assert.ok(matchedPkg.totalLessons >= 24, `课包总课次不足 24: ${matchedPkg.totalLessons}`);
  });

  await runTest('5.8 实测 studentApi.getWarningRoster() 获取消课预警大盘统计与清单', async () => {
    useLiveBackend();
    const roster = await studentApi.getWarningRoster();
    assert.ok(roster, '预警大盘数据为空');
    assert.ok(roster.statistics, '缺少 statistics 统计大盘');
    assert.ok(typeof roster.statistics.criticalCount === 'number', '缺少 criticalCount');
    assert.ok(typeof roster.statistics.warningCount === 'number', '缺少 warningCount');
    assert.ok(Array.isArray(roster.list), '缺少预警学员列表');
  });

  console.log('\n================================================================================');
  console.log(`🎉 Phase 3 对抗性实证挑战套件全部通过！${passCount}/${totalCount} 项挑战断言 100% 验证成功！`);
  console.log('================================================================================\n');
}

main().catch(err => {
  console.error('\n❌ Phase 3 对抗性测试套件执行异常:', err);
  process.exit(1);
});
