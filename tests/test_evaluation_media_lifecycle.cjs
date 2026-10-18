/**
 * 微信小程序课评媒体生命周期专项验收测试 (新增、删除、清空、重新加载与多学员隔离)
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
  console.log('🧪 课评媒体完整生命周期 (新增/部分删除/全部清空/重载/学员隔离) 验收测试');
  console.log('='.repeat(80));

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
        name: `媒体测试班-${tag}`,
        code: `CLS-MED-${tag}`,
        capacity: 10,
        status: 'in_progress',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2027-06-30'),
      },
    });

    const studentA = await prisma.student.create({
      data: {
        campusId: campus.id,
        name: `学员A-${tag}`,
        studentNo: `STU-A-${tag}`,
        gender: 'female',
        phone: `136${tag}`,
        wechatOpenId: `wx-a-${tag}`,
      },
    });

    const studentB = await prisma.student.create({
      data: {
        campusId: campus.id,
        name: `学员B-${tag}`,
        studentNo: `STU-B-${tag}`,
        gender: 'male',
        phone: `137${tag}`,
        wechatOpenId: `wx-b-${tag}`,
      },
    });

    await prisma.studentCoursePackage.create({
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

    await prisma.studentCoursePackage.create({
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

    const schedule = await prisma.scheduleEvent.create({
      data: {
        campusId: campus.id,
        classId: cls.id,
        teacherId: teacher.id,
        classroomId: classroom.id,
        date: '2026-10-18',
        startTime: '16:00',
        endTime: '17:30',
        status: 'scheduled',
      },
    });

    // 1. 初次履约结课：排课带有公共照片与公共视频；学员A与学员B各有专属多媒体
    const initPayload = {
      scheduleEventId: schedule.id,
      mode: 'FULL_SETTLE',
      lessonTitle: `第1课 媒体生命周期`,
      studyContentHtml: '全班学习基础动画',
      overallRating: 5,
      teacherComment: '全班整体良好',
      photoList: ['http://127.0.0.1:3001/uploads/class_common.jpg'],
      videoUrl: 'http://127.0.0.1:3001/uploads/class_video.mp4',
      anomalyOverrides: [
        {
          studentId: studentA.id,
          status: 'present',
          deductLessons: 1,
          rating: 5,
          personalizedComment: '学员A初始评语',
          photos: [
            'http://127.0.0.1:3001/uploads/stuA_pic1.jpg',
            'http://127.0.0.1:3001/uploads/stuA_pic2.jpg',
          ],
          videoUrl: 'http://127.0.0.1:3001/uploads/stuA_video.mp4',
        },
        {
          studentId: studentB.id,
          status: 'present',
          deductLessons: 1,
          rating: 4,
          personalizedComment: '学员B专属初始评语',
          photos: ['http://127.0.0.1:3001/uploads/stuB_pic1.jpg'],
          videoUrl: 'http://127.0.0.1:3001/uploads/stuB_video.mp4',
        },
      ],
    };

    console.log('\n--- [阶段 1: 初次全班履约结课] ---');
    const initRes = await postJson('http://127.0.0.1:3001/api/educational/fulfillment/fulfill', initPayload, token);
    assert.strictEqual(initRes.status, 201);
    console.log('✓ PASS: 初次履约成功');

    // 检查初始工作台
    const wb1Res = await getJson(`http://127.0.0.1:3001/api/educational/fulfillment/workbench/${schedule.id}`, token);
    const wb1 = wb1Res.data?.data || wb1Res.data;
    const stA1 = wb1.students.find((s) => s.studentId === studentA.id);
    const stB1 = wb1.students.find((s) => s.studentId === studentB.id);

    assert.strictEqual(stA1.photos.length, 2);
    assert.strictEqual(stA1.videoUrl, 'http://127.0.0.1:3001/uploads/stuA_video.mp4');
    assert.strictEqual(stA1.hasPersonalEvaluation, true);
    assert.strictEqual(stB1.photos.length, 1);
    assert.strictEqual(stB1.videoUrl, 'http://127.0.0.1:3001/uploads/stuB_video.mp4');
    console.log('✓ PASS: 初始学员 A (2张图, 1视频) 与学员 B 均已正确落盘');

    // 模拟小程序投影函数 (严格对应 projector.ts 逻辑)
    function projectGrowth(wb, studentId) {
      const targetStudent = wb.students.find((s) => s.studentId === studentId) || {};
      const isPersonalized = Boolean(
        targetStudent.hasPersonalEvaluation ||
        targetStudent.evaluatedAt ||
        (Array.isArray(targetStudent?.photos) && targetStudent.photos.length > 0) ||
        targetStudent.videoUrl
      );

      const photos = [];
      if (isPersonalized) {
        if (Array.isArray(targetStudent?.photos)) {
          for (const p of targetStudent.photos) {
            if (p) photos.push({ url: p, thumbUrl: p });
          }
        }
      } else if (Array.isArray(wb.evaluationSummary?.photoList)) {
        for (const p of wb.evaluationSummary.photoList) {
          if (p) photos.push({ url: p, thumbUrl: p });
        }
      }

      const rawVideoUrl = isPersonalized
        ? (targetStudent?.videoUrl || '')
        : (targetStudent?.videoUrl || wb.evaluationSummary?.videoUrl || '');

      return {
        photos,
        video: rawVideoUrl ? { videoUrl: rawVideoUrl } : undefined,
        comment: targetStudent.currentComment || targetStudent.comment || '',
      };
    }

    // 模拟小程序草稿水化函数 (严格对应 coordinator.ts hydrateStudentDraft 逻辑)
    function hydrateDraft(wb, studentId, singleDraft) {
      const targetStudent = wb.students.find((s) => s.studentId === studentId) || {};
      const isPersonalized = Boolean(
        targetStudent?.hasPersonalEvaluation ||
        targetStudent?.evaluatedAt ||
        (Array.isArray(targetStudent?.photos) && targetStudent.photos.length > 0) ||
        targetStudent?.videoUrl
      );

      let photos = [];
      if (Array.isArray(singleDraft?.uploadedPhotos)) {
        photos = singleDraft.uploadedPhotos;
      } else if (Array.isArray(singleDraft?.photos)) {
        photos = singleDraft.photos;
      } else if (isPersonalized || Array.isArray(targetStudent?.photos)) {
        photos = Array.isArray(targetStudent?.photos) ? targetStudent.photos : [];
      } else if (targetStudent?.isEvaluated || targetStudent?.evaluated) {
        photos = [];
      } else {
        photos = wb.evaluationSummary?.photoList || [];
      }

      let videoUrl = '';
      if (singleDraft?.uploadedVideo !== undefined && singleDraft?.uploadedVideo !== null) {
        videoUrl = singleDraft.uploadedVideo;
      } else if (singleDraft?.videoUrl !== undefined && singleDraft?.videoUrl !== null) {
        videoUrl = singleDraft.videoUrl;
      } else if (isPersonalized || targetStudent?.videoUrl) {
        videoUrl = targetStudent?.videoUrl || '';
      } else if (targetStudent?.isEvaluated || targetStudent?.evaluated) {
        videoUrl = '';
      } else {
        videoUrl = wb.evaluationSummary?.videoUrl || '';
      }

      return {
        photos,
        videoUrl,
        studyContent: targetStudent.currentComment || targetStudent.comment || '',
      };
    }

    // -------------------------------------------------------------------------
    // 阶段 2: 部分删除 (学员A删除1张照片，并删除视频，更新文字)
    // -------------------------------------------------------------------------
    console.log('\n--- [阶段 2: 部分删除 (学员A保留1张照片，清空视频)] ---');
    const partDelPayload = {
      scheduleEventId: schedule.id,
      mode: 'PUBLISH_EVALUATION',
      targetStudentId: studentA.id,
      anomalyOverrides: [
        {
          studentId: studentA.id,
          status: 'present',
          deductLessons: 1,
          personalizedComment: '学员A评语已修改：动手能力增强！',
          rating: 5,
          photos: ['http://127.0.0.1:3001/uploads/stuA_pic1.jpg'], // 仅留 1 张
          videoUrl: '', // 视频清空
          isEvaluated: true,
        },
      ],
      studyContentHtml: '学员A评语已修改：动手能力增强！',
      teacherComment: '学员A评语已修改：动手能力增强！',
      photoList: ['http://127.0.0.1:3001/uploads/stuA_pic1.jpg'],
      videoUrl: '',
      overallRating: 5,
      templateName: '通用课评模板',
      templateId: 'tpl-std',
      idempotencyKey: `mp-part-del-${schedule.id}-${studentA.id}-${Date.now()}`,
    };

    const res2 = await postJson('http://127.0.0.1:3001/api/educational/fulfillment/fulfill', partDelPayload, token);
    assert.strictEqual(res2.status, 201);

    const wb2Res = await getJson(`http://127.0.0.1:3001/api/educational/fulfillment/workbench/${schedule.id}`, token);
    const wb2 = wb2Res.data?.data || wb2Res.data;
    const stA2 = wb2.students.find((s) => s.studentId === studentA.id);
    const stB2 = wb2.students.find((s) => s.studentId === studentB.id);

    // 断言工作台学员 A
    assert.strictEqual(stA2.photos.length, 1);
    assert.strictEqual(stA2.photos[0], 'http://127.0.0.1:3001/uploads/stuA_pic1.jpg');
    assert.strictEqual(stA2.videoUrl, undefined);
    assert.strictEqual(stA2.currentComment, '学员A评语已修改：动手能力增强！');

    // 断言看学情投影
    const growth2 = projectGrowth(wb2, studentA.id);
    assert.strictEqual(growth2.photos.length, 1);
    assert.strictEqual(growth2.photos[0].url, 'http://127.0.0.1:3001/uploads/stuA_pic1.jpg');
    assert.strictEqual(growth2.video, undefined, '已删除视频绝不回退至公共视频');
    console.log('✓ PASS: 学员 A 看学情投影照片精准保留 1 张，视频已被清空');

    // 断言草稿水化重入
    const draft2 = hydrateDraft(wb2, studentA.id, null);
    assert.strictEqual(draft2.photos.length, 1);
    assert.strictEqual(draft2.videoUrl, '', '草稿水化重载时视频严格为空字符串');
    console.log('✓ PASS: 学员 A 再次进入修改课评页面，水化数据与保存时完全一致');

    // 断言学员 B 绝对未受任何影响
    assert.strictEqual(stB2.photos.length, 1);
    assert.strictEqual(stB2.photos[0], 'http://127.0.0.1:3001/uploads/stuB_pic1.jpg');
    assert.strictEqual(stB2.videoUrl, 'http://127.0.0.1:3001/uploads/stuB_video.mp4');
    assert.strictEqual(stB2.currentComment, '学员B专属初始评语');
    console.log('✓ PASS: 同班学员 B 数据绝对独立且未变');

    // -------------------------------------------------------------------------
    // 阶段 3: 全部清空 (学员A清空剩余的全部照片，无媒体纯文字)
    // -------------------------------------------------------------------------
    console.log('\n--- [阶段 3: 全部清空 (清空学员A所有照片，变为纯文字课评)] ---');
    const fullDelPayload = {
      scheduleEventId: schedule.id,
      mode: 'PUBLISH_EVALUATION',
      targetStudentId: studentA.id,
      anomalyOverrides: [
        {
          studentId: studentA.id,
          status: 'present',
          deductLessons: 1,
          personalizedComment: '学员A评语更新为纯文字！无图无视频',
          rating: 5,
          photos: [], // 全部清空
          videoUrl: '', // 保持无视频
          isEvaluated: true,
        },
      ],
      studyContentHtml: '学员A评语更新为纯文字！无图无视频',
      teacherComment: '学员A评语更新为纯文字！无图无视频',
      photoList: [],
      videoUrl: '',
      overallRating: 5,
      templateName: '通用课评模板',
      templateId: 'tpl-std',
      idempotencyKey: `mp-full-del-${schedule.id}-${studentA.id}-${Date.now()}`,
    };

    const res3 = await postJson('http://127.0.0.1:3001/api/educational/fulfillment/fulfill', fullDelPayload, token);
    assert.strictEqual(res3.status, 201);

    const wb3Res = await getJson(`http://127.0.0.1:3001/api/educational/fulfillment/workbench/${schedule.id}`, token);
    const wb3 = wb3Res.data?.data || wb3Res.data;
    const stA3 = wb3.students.find((s) => s.studentId === studentA.id);
    const stB3 = wb3.students.find((s) => s.studentId === studentB.id);

    // 断言工作台学员 A
    assert.strictEqual(stA3.photos.length, 0);
    assert.strictEqual(stA3.videoUrl, undefined);
    assert.strictEqual(stA3.currentComment, '学员A评语更新为纯文字！无图无视频');

    // 断言看学情投影
    const growth3 = projectGrowth(wb3, studentA.id);
    assert.strictEqual(growth3.photos.length, 0, '已全部清空照片绝不回退至公共相册！');
    assert.strictEqual(growth3.video, undefined, '已清空视频绝不回退至公共视频！');
    console.log('✓ PASS: 学员 A 看学情投影照片数为 0，视频为 undefined');

    // 断言草稿水化重入
    const draft3 = hydrateDraft(wb3, studentA.id, null);
    assert.strictEqual(draft3.photos.length, 0, '草稿水化重载时照片数组严格为空');
    assert.strictEqual(draft3.videoUrl, '', '草稿水化重载时视频严格为空');
    console.log('✓ PASS: 学员 A 再次进入修改课评页面，媒体全部为清空状态');

    // 断言学员 B 依然未变
    assert.strictEqual(stB3.photos.length, 1);
    assert.strictEqual(stB3.videoUrl, 'http://127.0.0.1:3001/uploads/stuB_video.mp4');
    console.log('✓ PASS: 学员 B 数据依旧稳固独立');

    // -------------------------------------------------------------------------
    // 阶段 4: 媒体新增 (为学员A重新上传新照片与新视频)
    // -------------------------------------------------------------------------
    console.log('\n--- [阶段 4: 媒体新增 (为学员A上传新照片与新视频)] ---');
    const addMediaPayload = {
      scheduleEventId: schedule.id,
      mode: 'PUBLISH_EVALUATION',
      targetStudentId: studentA.id,
      anomalyOverrides: [
        {
          studentId: studentA.id,
          status: 'present',
          deductLessons: 1,
          personalizedComment: '学员A上传了全新实操抓拍与视频！',
          rating: 5,
          photos: [
            'http://127.0.0.1:3001/uploads/stuA_brand_new_1.png',
            'http://127.0.0.1:3001/uploads/stuA_brand_new_2.png',
          ],
          videoUrl: 'http://127.0.0.1:3001/uploads/stuA_brand_new_video.mp4',
          isEvaluated: true,
        },
      ],
      studyContentHtml: '学员A上传了全新实操抓拍与视频！',
      teacherComment: '学员A上传了全新实操抓拍与视频！',
      photoList: [
        'http://127.0.0.1:3001/uploads/stuA_brand_new_1.png',
        'http://127.0.0.1:3001/uploads/stuA_brand_new_2.png',
      ],
      videoUrl: 'http://127.0.0.1:3001/uploads/stuA_brand_new_video.mp4',
      overallRating: 5,
      templateName: '通用课评模板',
      templateId: 'tpl-std',
      idempotencyKey: `mp-add-med-${schedule.id}-${studentA.id}-${Date.now()}`,
    };

    const res4 = await postJson('http://127.0.0.1:3001/api/educational/fulfillment/fulfill', addMediaPayload, token);
    assert.strictEqual(res4.status, 201);

    const wb4Res = await getJson(`http://127.0.0.1:3001/api/educational/fulfillment/workbench/${schedule.id}`, token);
    const wb4 = wb4Res.data?.data || wb4Res.data;
    const stA4 = wb4.students.find((s) => s.studentId === studentA.id);

    assert.strictEqual(stA4.photos.length, 2);
    assert.strictEqual(stA4.photos[0], 'http://127.0.0.1:3001/uploads/stuA_brand_new_1.png');
    assert.strictEqual(stA4.videoUrl, 'http://127.0.0.1:3001/uploads/stuA_brand_new_video.mp4');

    const growth4 = projectGrowth(wb4, studentA.id);
    assert.strictEqual(growth4.photos.length, 2);
    assert.strictEqual(growth4.video.videoUrl, 'http://127.0.0.1:3001/uploads/stuA_brand_new_video.mp4');
    console.log('✓ PASS: 新增媒体在工作台与看学情卡均已准确呈现');

    // -------------------------------------------------------------------------
    // 阶段 5: 排课公共主记录与学员 B 保护断言
    // -------------------------------------------------------------------------
    console.log('\n--- [阶段 5: 排课公共实体与学员 B 保护断言] ---');
    const finalDbEval = await prisma.lessonEvaluation.findUnique({
      where: { scheduleEventId: schedule.id },
    });
    const parsedClassPhotos = JSON.parse(finalDbEval.photoList);
    assert.strictEqual(parsedClassPhotos[0], 'http://127.0.0.1:3001/uploads/class_common.jpg', '排课公共相册未被篡改');
    assert.strictEqual(finalDbEval.videoUrl, 'http://127.0.0.1:3001/uploads/class_video.mp4', '排课公共视频未被篡改');
    console.log('✓ PASS: 排课公共原大纲与公共相册/视频完好无损');

    console.log('\n' + '='.repeat(80));
    console.log('🎉 课评媒体新增/删除/清空/重载与学员隔离所有断言 100% 全部通过！');
    console.log('='.repeat(80));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
