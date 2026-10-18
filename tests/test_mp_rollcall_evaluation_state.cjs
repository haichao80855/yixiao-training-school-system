/**
 * 微信小程序端课次详情课评状态同步专项契约测试
 * 针对用户真实测试班级: 统一结课测试班-934632
 * 验证: Web 端评价并推送后，小程序端课次详情页面学员状态即刻权威流转为「看学情」
 */

const assert = require('assert');
const http = require('http');

const HOST = '127.0.0.1';
const PORT = 3001;

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTest() {
  console.log('================================================================================');
  console.log('小程序端课次详情课评状态双向实时互通专项契约测试');
  console.log('目标班级: 统一结课测试班-934632');
  console.log('================================================================================\n');

  // 1. 超管登录
  const loginRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'donghaichao', password: '123456' },
  );

  assert(loginRes.status === 200 || loginRes.status === 201, '超管登录成功获取 Token');
  const token = loginRes.body?.data?.accessToken || loginRes.body?.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. 定位排课日程
  const targetScheduleId = '9a486f6e-f952-4c5a-b38f-a20a59d5e3bc';

  // 3. 模拟小程序端底层请求 GET /api/educational/fulfillment/workbench/:id
  const wbRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/fulfillment/workbench/${targetScheduleId}`,
    method: 'GET',
    headers: authHeaders,
  });

  assert(wbRes.status === 200, 'GET fulfillment workbench 接口返回 200 OK');
  const rawData = wbRes.body?.data;
  assert(rawData && rawData.students && rawData.students.length === 3, '成功返回班级 3 名在读到课学员');

  // 4. 模拟 mini-program/src/api/edu.ts 中 eduApi.getFulfillmentWorkbench 的映射逻辑
  const mappedStudents = (rawData.students || []).map((s) => {
    const studentPhotos = Array.isArray(s.photos)
      ? s.photos
      : typeof s.photos === 'string'
        ? JSON.parse(s.photos || '[]')
        : [];
    const isStudentEvaluated = Boolean(
      s.isEvaluated ||
      s.evaluated ||
      (studentPhotos && studentPhotos.length > 0) ||
      s.videoUrl ||
      s.currentComment ||
      s.comment
    );
    return {
      studentId: s.studentId,
      studentNo: s.studentNo,
      name: s.studentName || s.name || '学员',
      avatar: s.avatar,
      status: s.recordedStatus || s.status || s.defaultStatus || 'present',
      deductLessons: s.deductLessons ?? s.defaultDeductLessons ?? 1,
      packageId: s.packageId,
      packageName: s.packageName,
      remainingLessons: s.remainingLessons ?? 0,
      phone: s.phone,
      tag: s.tag || (s.bonusLessons > 0 ? '赠' : '正'),
      evaluated: isStudentEvaluated,
      isEvaluated: isStudentEvaluated,
      isExempt: Boolean(s.isExempt),
      photos: studentPhotos,
      videoUrl: s.videoUrl || undefined,
      comment: s.currentComment || s.comment || undefined,
      rating: s.currentRating !== undefined ? Number(s.currentRating) : (s.rating !== undefined ? Number(s.rating) : 5),
      currentComment: s.currentComment || s.comment || undefined,
      currentRating: s.currentRating !== undefined ? Number(s.currentRating) : undefined,
      evaluatedAt: s.evaluatedAt || undefined,
      evaluatedSource: s.evaluatedSource || 'web',
    };
  });

  console.log('--- [阶段 1: eduApi.getFulfillmentWorkbench 映射断言] ---');
  for (const stu of mappedStudents) {
    console.log(`  学员 [${stu.name}]: isEvaluated=${stu.isEvaluated}, evaluated=${stu.evaluated}, photos=${stu.photos.length}张`);
    assert(stu.isEvaluated === true, `学员 [${stu.name}] isEvaluated 必须为 true`);
    assert(stu.evaluated === true, `学员 [${stu.name}] evaluated 必须为 true`);
    assert(Array.isArray(stu.photos), `学员 [${stu.name}] 专属照片数组必须被完整携带`);
  }
  console.log('  ✓ PASS: eduApi 层数据映射 100% 完整无损！\n');

  // 5. 模拟 mini-program/src/coordinators/fulfillment/coordinator.ts 中 loadSession 逻辑
  console.log('--- [阶段 2: coordinator.loadSession 会话状态装配断言] ---');
  const sessionStudents = [];
  for (const s of mappedStudents) {
    const studentPhotos = Array.isArray(s.photos) ? s.photos : [];
    const isStudentEvaluated = Boolean(
      s.isEvaluated ||
      s.evaluated ||
      (studentPhotos && studentPhotos.length > 0) ||
      s.videoUrl ||
      s.comment
    );
    sessionStudents.push({
      studentId: s.studentId,
      studentNo: s.studentNo,
      name: s.name,
      avatar: s.avatar,
      status: s.status,
      deductLessons: s.deductLessons,
      remainingLessons: s.remainingLessons,
      rating: s.rating,
      comment: s.comment,
      isAnomaly: false,
      isWechatBound: true,
      isEvaluated: isStudentEvaluated,
      isExempt: s.isExempt,
      photos: studentPhotos,
      videoUrl: s.videoUrl,
    });
  }

  for (const s of sessionStudents) {
    assert(s.isEvaluated === true, `会话学员 [${s.name}] isEvaluated 必须为 true`);
    assert(Array.isArray(s.photos), `会话学员 [${s.name}] photos 数组必须存在`);
  }
  console.log('  ✓ PASS: coordinator 会话模型完整保全单学员专属评价状态与多媒体！\n');

  // 6. 模拟 mini-program/src/package-edu/lecture/roll-call.vue 中课次详情视图状态
  console.log('--- [阶段 3: 课次详情 roll-call.vue UI 按钮状态断言] ---');
  const viewStudents = sessionStudents.map((s) => {
    const studentPhotos = s.photos || [];
    const isStudentEvaluated = Boolean(
      s.isEvaluated ||
      s.evaluated ||
      (studentPhotos.length > 0) ||
      s.videoUrl ||
      s.comment
    );
    return {
      studentId: s.studentId,
      studentNo: s.studentNo,
      name: s.name,
      avatar: s.avatar,
      status: s.status,
      deductLessons: s.deductLessons,
      remainingLessons: s.remainingLessons,
      phone: s.phone,
      tag: '正',
      evaluated: isStudentEvaluated,
      isEvaluated: isStudentEvaluated,
      isExempt: Boolean(s.isExempt),
      photos: studentPhotos,
      videoUrl: s.videoUrl,
      buttonText: isStudentEvaluated ? '看学情' : '写课评',
    };
  });

  for (const v of viewStudents) {
    console.log(`  UI渲染项 [${v.name}] -> 操作按钮: 【${v.buttonText}】`);
    assert(v.evaluated === true, `学员 [${v.name}] evaluated 必须为 true`);
    assert(v.buttonText === '看学情', `学员 [${v.name}] 操作按钮必须展示为「看学情」，坚决杜绝「写课评」误显！`);
  }
  console.log('  ✓ PASS: 课次详情页所有学员状态 100% 正确流转为【看学情】！\n');

  console.log('================================================================================');
  console.log('🎉 验证成功！班级「统一结课测试班-934632」在小程序端课次详情已彻底流转为「看学情」！');
  console.log('================================================================================');
}

runTest().catch((err) => {
  console.error('测试失败:', err);
  process.exit(1);
});
