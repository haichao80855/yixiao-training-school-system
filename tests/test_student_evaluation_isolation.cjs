/**
 * 微信小程序端课评修改数据防串改与学员独立性自动化验收测试
 *
 * 验证目标：
 * 修改班级中某一位学员（学员 A）的课评并保存后，
 * 同班其他学员（学员 B）的课评保持独立且完全不变，
 * 目标学员 A 的数据正确更新落盘，且重新进入后依然正确。
 */

const assert = require('assert');
const http = require('http');

function postJson(url, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJson(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('='.repeat(80));
  console.log('🧪 课评修改数据防串改与多学员独立隔离专项验收测试');
  console.log('='.repeat(80));

  // 0. 登录获取 Token
  const loginRes = await postJson('http://127.0.0.1:3001/api/auth/login', {
    account: 'donghaichao',
    password: '123456',
  });
  const token = loginRes.data?.data?.accessToken || loginRes.data?.token || loginRes.data?.accessToken;

  const { PrismaClient } = require('../server/node_modules/@prisma/client');
  const prisma = new PrismaClient();

  try {
    const campus = (await prisma.campus.findFirst({ where: { status: 'active' } })) || (await prisma.campus.findFirst());
    const teacher = (await prisma.user.findFirst({ where: { campusId: campus.id } })) || (await prisma.user.findFirst());
    const classroom = (await prisma.classroom.findFirst({ where: { campusId: campus.id } })) || (await prisma.classroom.findFirst());
    const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());

    const tag = Math.floor(100000 + Math.random() * 900000);

    const cls = await prisma.class.create({
      data: {
        campusId: campus.id,
        courseId: course.id,
        teacherId: teacher.id,
        classroomId: classroom.id,
        name: `防串改测试班-${tag}`,
        code: `CLS-ISO-${tag}`,
        capacity: 10,
        status: 'in_progress',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2027-06-30'),
      },
    });

    // 2. 创建学员 A 与 学员 B
    const studentA = await prisma.student.create({
      data: {
        campusId: campus.id,
        name: `独立学员A-${tag}`,
        studentNo: `STU-A-${tag}`,
        gender: 'male',
        phone: `138${tag}`,
        wechatOpenId: `wx-openid-A-${tag}`,
      },
    });

    const studentB = await prisma.student.create({
      data: {
        campusId: campus.id,
        name: `独立学员B-${tag}`,
        studentNo: `STU-B-${tag}`,
        gender: 'male',
        phone: `139${tag}`,
        wechatOpenId: `wx-openid-B-${tag}`,
      },
    });

    // 创建课包
    const pkgA = await prisma.studentCoursePackage.create({
      data: {
        studentId: studentA.id,
        courseId: course.id,
        classId: cls.id,
        totalLessons: 20,
        remainingLessons: 20,
        consumedLessons: 0,
        status: 'active',
      },
    });

    const pkgB = await prisma.studentCoursePackage.create({
      data: {
        studentId: studentB.id,
        courseId: course.id,
        classId: cls.id,
        totalLessons: 20,
        remainingLessons: 20,
        consumedLessons: 0,
        status: 'active',
      },
    });

    // 3. 创建排课
    const schedule = await prisma.scheduleEvent.create({
      data: {
        campusId: campus.id,
        classId: cls.id,
        teacherId: teacher.id,
        classroomId: classroom.id,
        date: '2026-10-18',
        startTime: '10:00',
        endTime: '11:30',
        status: 'scheduled',
      },
    });

    // 4. 初次全班履约结课，给学员 A 和 学员 B 赋予各自不同的初始独立评语与照片
    const initPayload = {
      scheduleEventId: schedule.id,
      mode: 'FULL_SETTLE',
      lessonTitle: `第1讲 创意交互与物理碰撞`,
      studyContentHtml: '全班掌握基础广播机制与变量',
      overallRating: 5,
      teacherComment: '全班整体表现优异',
      photoList: ['http://127.0.0.1:3001/uploads/class_common.jpg'],
      anomalyOverrides: [
        {
          studentId: studentA.id,
          status: 'present',
          deductLessons: 1,
          rating: 5,
          personalizedComment: '学员A专属初始评语：专注度极高！',
          photos: ['http://127.0.0.1:3001/uploads/studentA_original.jpg'],
          videoUrl: 'http://127.0.0.1:3001/uploads/videoA.mp4',
        },
        {
          studentId: studentB.id,
          status: 'present',
          deductLessons: 1,
          rating: 4,
          personalizedComment: '学员B专属初始评语：动手能力很强！',
          photos: ['http://127.0.0.1:3001/uploads/studentB_original.jpg'],
          videoUrl: 'http://127.0.0.1:3001/uploads/videoB.mp4',
        },
      ],
    };

    console.log('\n--- [阶段 1: 初次全班履约结课] ---');
    const initRes = await postJson('http://127.0.0.1:3001/api/educational/fulfillment/fulfill', initPayload, token);
    assert.strictEqual(initRes.status, 201, `初次履约应返回 201: ${JSON.stringify(initRes)}`);
    console.log('✓ PASS: 初次履约结课成功！');

    // 验证初始状态下工作台数据
    const wb1Res = await getJson(`http://127.0.0.1:3001/api/educational/fulfillment/workbench/${schedule.id}`, token);
    const wb1 = wb1Res.data?.data || wb1Res.data;
    const stA1 = wb1.students.find((s) => s.studentId === studentA.id);
    const stB1 = wb1.students.find((s) => s.studentId === studentB.id);
    assert.strictEqual(stA1.currentComment, '学员A专属初始评语：专注度极高！');
    assert.strictEqual(stB1.currentComment, '学员B专属初始评语：动手能力很强！');
    console.log(`  学员 A 初始评语: [${stA1.currentComment}]`);
    console.log(`  学员 B 初始评语: [${stB1.currentComment}]`);

    // 5. 模拟微信小程序进入「课次详情 → 看学情 → 修改课评」
    // 仅修改学员 A 的课评为全新评语和照片
    console.log('\n--- [阶段 2: 仅修改学员 A 的课评并保存] ---');
    const updateAPayload = {
      scheduleEventId: schedule.id,
      mode: 'PUBLISH_EVALUATION',
      targetStudentId: studentA.id,
      anomalyOverrides: [
        {
          studentId: studentA.id,
          status: 'present',
          deductLessons: 1,
          personalizedComment: '学员A深度修改后的新课评：逻辑思维大爆发！★★★',
          rating: 5,
          photos: ['http://127.0.0.1:3001/uploads/studentA_revised.png'],
          videoUrl: 'http://127.0.0.1:3001/uploads/videoA_revised.mp4',
          isEvaluated: true,
        },
      ],
      overrides: [
        {
          studentId: studentA.id,
          status: 'present',
          deductLessons: 1,
          comment: '学员A深度修改后的新课评：逻辑思维大爆发！★★★',
          photos: ['http://127.0.0.1:3001/uploads/studentA_revised.png'],
          videoUrl: 'http://127.0.0.1:3001/uploads/videoA_revised.mp4',
        },
      ],
      studyContentHtml: '学员A深度修改后的新课评：逻辑思维大爆发！★★★',
      teacherComment: '学员A深度修改后的新课评：逻辑思维大爆发！★★★',
      photoList: ['http://127.0.0.1:3001/uploads/studentA_revised.png'],
      videoUrl: 'http://127.0.0.1:3001/uploads/videoA_revised.mp4',
      overallRating: 5,
      templateName: '通用课评模板',
      templateId: 'tpl-std',
      idempotencyKey: `mp-rev-test-${schedule.id}-${studentA.id}-${Date.now()}`,
    };

    const reviseRes = await postJson('http://127.0.0.1:3001/api/educational/fulfillment/fulfill', updateAPayload, token);
    console.log('reviseRes response:', JSON.stringify(reviseRes));
    assert.strictEqual(reviseRes.status, 201, `单学员修改课评应成功: ${JSON.stringify(reviseRes)}`);
    console.log('✓ PASS: 单学员修改课评请求成功返回！');

    // 6. 验证核心断言：学员 A 成功更新，学员 B 绝对未被串改！
    console.log('\n--- [阶段 3: 核心防串改与数据独立性断言] ---');
    const wb2Res = await getJson(`http://127.0.0.1:3001/api/educational/fulfillment/workbench/${schedule.id}`, token);
    const wb2 = wb2Res.data?.data || wb2Res.data;
    const stA2 = wb2.students.find((s) => s.studentId === studentA.id);
    const stB2 = wb2.students.find((s) => s.studentId === studentB.id);

    console.log(`  更新后学员 A 评语: [${stA2.currentComment}]`);
    console.log(`  更新后学员 B 评语: [${stB2.currentComment}]`);
    console.log(`  更新后学员 A 照片: [${JSON.stringify(stA2.photos)}]`);
    console.log(`  更新后学员 B 照片: [${JSON.stringify(stB2.photos)}]`);
    console.log('wb2.evaluationSummary (排课公共信息):', JSON.stringify(wb2.evaluationSummary));

    // 断言 1: 学员 A 的数据正确保存
    assert.strictEqual(
      stA2.currentComment,
      '学员A深度修改后的新课评：逻辑思维大爆发！★★★',
      '学员 A 的评语必须已更新为最新修改内容'
    );
    assert.deepStrictEqual(
      stA2.photos,
      ['http://127.0.0.1:3001/uploads/studentA_revised.png'],
      '学员 A 的照片必须已更新为最新修改照片'
    );
    assert.strictEqual(
      stA2.videoUrl,
      'http://127.0.0.1:3001/uploads/videoA_revised.mp4',
      '学员 A 的视频必须已更新为最新修改视频'
    );

    // 断言 2: 学员 B 的数据完全未被修改（未被串改）！
    assert.strictEqual(
      stB2.currentComment,
      '学员B专属初始评语：动手能力很强！',
      '学员 B 的评语必须保持初始内容不变，严禁被学员 A 串改！'
    );
    assert.deepStrictEqual(
      stB2.photos,
      ['http://127.0.0.1:3001/uploads/studentB_original.jpg'],
      '学员 B 的专属照片必须保持不变，严禁被学员 A 串改！'
    );
    assert.strictEqual(
      stB2.videoUrl,
      'http://127.0.0.1:3001/uploads/videoB.mp4',
      '学员 B 的专属视频必须保持不变，严禁被学员 A 串改！'
    );

    // 断言 3: 出站信箱检查：最新 revision 的 outbox 仅包含被修改的目标学员 A，绝对不能向学员 B 推送学员 A 的课评
    const latestOutbox = await prisma.lessonEvaluationOutbox.findMany({
      where: {
        evaluation: { scheduleEventId: schedule.id },
        revisionNumber: 2,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Revision 2 出站信箱记录数:', latestOutbox.length);
    for (const o of latestOutbox) {
      console.log('  Revision 2 Outbox student:', o.studentId, 'payload:', o.payload);
    }

    assert.strictEqual(
      latestOutbox.length,
      1,
      `单学员修改课评时，仅应为被修改的目标学员下发出站信箱，实际产生了 ${latestOutbox.length} 条`
    );
    assert.strictEqual(
      latestOutbox[0].studentId,
      studentA.id,
      '最新出站信箱必须仅针对被修改的目标学员 A'
    );
    const outboxPayloadA = JSON.parse(latestOutbox[0].payload);
    assert.strictEqual(
      outboxPayloadA.teacherComment,
      '学员A深度修改后的新课评：逻辑思维大爆发！★★★',
      '学员 A 出站信箱评语必须为学员 A 的最新课评'
    );

    // 断言 4: 排课公共记录保护：单学员课评修改绝不能覆盖排课公共原大纲/评语
    const dbEval = await prisma.lessonEvaluation.findUnique({
      where: { scheduleEventId: schedule.id },
    });
    assert.notStrictEqual(
      dbEval.teacherComment,
      '学员A深度修改后的新课评：逻辑思维大爆发！★★★',
      '排课公共主记录 teacherComment 严禁被单学员 A 的专属评语污染覆盖'
    );

    // 断言 5: 小程序端投影引擎与学情卡私有化防穿透验证
    console.log('\n--- [阶段 4: 小程序端学情成长卡私有化投影断言] ---');
    // 模拟小程序端从 wb2 进行 mapFromWorkbench 投影
    function mockProject(wb, targetStudentId) {
      const schedule = wb.schedule;
      const targetStudent = wb.students.find((s) => s.studentId === targetStudentId);
      const studentPhotos = Array.isArray(targetStudent?.photos) && targetStudent.photos.length > 0
        ? targetStudent.photos
        : [];
      const photos = studentPhotos.length > 0
        ? studentPhotos.map((p) => ({ url: p, thumbUrl: p }))
        : (wb.evaluationSummary?.photoList || []).map((p) => ({ url: p, thumbUrl: p }));
      const videoUrl = targetStudent?.videoUrl || wb.evaluationSummary?.videoUrl || '';
      const comment = targetStudent?.currentComment || targetStudent?.comment || wb.evaluationSummary?.teacherComment || '';
      return { photos, videoUrl, comment };
    }

    const cardA = mockProject(wb2, studentA.id);
    const cardB = mockProject(wb2, studentB.id);

    assert.strictEqual(
      cardA.comment,
      '学员A深度修改后的新课评：逻辑思维大爆发！★★★',
      '学员 A 学情卡评语必须为学员 A 的新评语'
    );
    assert.deepStrictEqual(
      cardA.photos.map((p) => p.url),
      ['http://127.0.0.1:3001/uploads/studentA_revised.png'],
      '学员 A 学情卡相册必须包含最新上传照片'
    );
    assert.strictEqual(
      cardA.videoUrl,
      'http://127.0.0.1:3001/uploads/videoA_revised.mp4',
      '学员 A 学情卡视频必须为最新实操视频'
    );

    assert.strictEqual(
      cardB.comment,
      '学员B专属初始评语：动手能力很强！',
      '学员 B 学情卡评语绝对不能被学员 A 污染！'
    );
    assert.deepStrictEqual(
      cardB.photos.map((p) => p.url),
      ['http://127.0.0.1:3001/uploads/studentB_original.jpg'],
      '学员 B 学情卡相册绝对不能显示学员 A 的照片！'
    );
    assert.strictEqual(
      cardB.videoUrl,
      'http://127.0.0.1:3001/uploads/videoB.mp4',
      '学员 B 学情卡视频绝对不能显示学员 A 的视频！'
    );

    console.log('✓ PASS [断言 5]: 小程序端看学情投影严格遵循单学员多媒体私有化隔离！');

    console.log('\n' + '='.repeat(80));
    console.log('🎉 验证成功！课评修改数据防串改与多学员独立隔离全部断言通过！');
    console.log('='.repeat(80));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
