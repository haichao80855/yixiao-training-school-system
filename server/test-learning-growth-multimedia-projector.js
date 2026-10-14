const http = require('http');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
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

async function runTests() {
  console.log('================================================================================');
  console.log('学情成长投影深模块（LearningGrowthProjector）多媒体相册流与双重视角专属验证套件');
  console.log('覆盖：Ports & Adapters 双适配器、4 级多媒体平滑降级、HMAC-SHA256 防越权令牌、双重视角 API');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;
  function assert(condition, desc) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS [${passed}]: ${desc}`);
    } else {
      console.error(`  ✗ FAIL [${total}]: ${desc}`);
      process.exit(1);
    }
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const HOST = '127.0.0.1';

  // 1. 登录超管
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

  // 2. 准备基础测试数据
  const campus = (await prisma.campus.findFirst({ where: { status: 'active' } })) || (await prisma.campus.findFirst());
  assert(!!campus, '数据库存在测试校区');

  const teacher = (await prisma.user.findFirst({
    where: { campusId: campus.id, userRoles: { some: { role: { code: 'teacher' } } } },
  })) || (await prisma.user.findFirst());
  assert(!!teacher, '校区存在授课讲师');

  const classroom = (await prisma.classroom.findFirst({ where: { campusId: campus.id } })) || (await prisma.classroom.findFirst());
  assert(!!classroom, '校区存在上课教室');

  const course = (await prisma.course.findFirst({ where: { status: 'enabled' } })) || (await prisma.course.findFirst());
  assert(!!course, '存在有效授课课程');

  const uniqueSuffix = Date.now().toString().slice(-6);
  const testClass = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      name: `多媒体学情测试班-${uniqueSuffix}`,
      code: `CLS-MM-${uniqueSuffix}`,
      capacity: 10,
      currentStudentCount: 1,
      status: 'in_progress',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
    },
  });

  const testStudent = await prisma.student.create({
    data: {
      campusId: campus.id,
      studentNo: `S-MM-${uniqueSuffix}`,
      name: '张子豪',
      gender: 'male',
      phone: '13811223344',
      status: 'normal',
    },
  });

  const testPkg = await prisma.studentCoursePackage.create({
    data: {
      studentId: testStudent.id,
      courseId: course.id,
      classId: testClass.id,
      totalLessons: 20,
      consumedLessons: 0,
      remainingLessons: 20,
      bonusLessons: 4,
      status: 'active',
    },
  });

  // 创建排课 1：全量多媒体课评课次 (Level 1)
  const scheduleEvent1 = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-14',
      startTime: '09:00',
      endTime: '10:30',
      status: 'completed',
    },
  });

  // 点名考勤 1
  const attendance1 = await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: scheduleEvent1.id,
      studentId: testStudent.id,
      status: 'present',
      deductLessons: 1,
      score: 100,
      rating: 'A+',
      operator: '主讲老师',
    },
  });

  // 多媒体课评 1 (包含 9 张照片、视频、语音、大纲、学员特写标签)
  const photoListJson = JSON.stringify([
    'https://oss.yixiao.com/photos/lesson1_01.jpg',
    'https://oss.yixiao.com/photos/lesson1_02.jpg',
    'https://oss.yixiao.com/photos/lesson1_03.jpg',
  ]);

  const evaluation1 = await prisma.lessonEvaluation.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      scheduleEventId: scheduleEvent1.id,
      lessonTitle: '第18讲：Scratch双人坦克大战碰撞与血条系统',
      studyContent: '1. 理解广播与克隆体生命周期\n2. 掌握坐标碰撞检测核心算法\n3. 独立实现双人对战计分器',
      overallRating: 5.0,
      teacherComment: '全班本节课课堂纪律优异，全部完成坦克发射子弹与积分系统！',
      photoList: photoListJson,
      voiceUrl: 'https://oss.yixiao.com/audio/voice_lesson1.mp3',
      voiceDuration: 68,
      videoUrl: 'https://oss.yixiao.com/video/scratch_tank.mp4',
      status: 'published',
      currentRevision: 1,
      studentItems: {
        create: [
          {
            studentId: testStudent.id,
            rating: 5.0,
            comment: '子豪同学动手极快，并在血条基础上扩展了拾取医药箱回血机制，算法逻辑严谨！',
            performanceTag: '算法标兵',
          },
        ],
      },
    },
  });

  // 创建排课 2：历史老旧无课评课次 (Level 3 老数据)
  const scheduleEvent2 = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-10-07',
      startTime: '09:00',
      endTime: '10:30',
      status: 'completed',
    },
  });

  const attendance2 = await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: scheduleEvent2.id,
      studentId: testStudent.id,
      status: 'present',
      deductLessons: 1,
      score: 90,
      rating: 'A',
      comment: '老旧考勤纯文本评语：课上积极听讲。',
      operator: '主讲老师',
    },
  });

  // 创建排课 3：已反结课冲正课次 (Level 4 冲正噪点)
  const scheduleEvent3 = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: testClass.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-09-30',
      startTime: '09:00',
      endTime: '10:30',
      status: 'scheduled',
    },
  });

  const attendance3 = await prisma.attendanceRecord.create({
    data: {
      scheduleEventId: scheduleEvent3.id,
      studentId: testStudent.id,
      status: 'present',
      deductLessons: 1,
      isReversed: true,
      reversalReason: '点名误操作冲正',
      operator: '教务管理',
    },
  });

  console.log('\n--- [Test Phase 1] 4 级多媒体平滑优雅降级验证 ---');

  // 1. 测试后台抽屉画像 projectAdminDossier
  const dossierRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/students/${testStudent.id}/admin-dossier`,
    method: 'GET',
    headers: authHeaders,
  });

  assert(dossierRes.status === 200, '后台 360° 学情画像 (admin-dossier) 返回 200 OK');
  const dossier = dossierRes.body.data || dossierRes.body;

  assert(dossier.timeline && dossier.timeline.length === 2, '时间轴默认过滤已冲正记录，包含 2 条正常课次');
  const timelineItem1 = dossier.timeline.find((t) => t.scheduleEventId === scheduleEvent1.id);
  assert(!!timelineItem1, '成功折叠多媒体课次 1');

  // Level 1: 全量多媒体属性校验
  assert(timelineItem1.lessonTitle.includes('坦克大战'), '课次主题大纲正确透出');
  assert(timelineItem1.performanceTag === '算法标兵', '个性化表现亮点标签正确透出');
  assert(timelineItem1.comment.includes('回血机制'), '个人专属特写评语优先展示');
  assert(timelineItem1.score === 100, '5 星折算得分为 100 分');
  assert(timelineItem1.rating === 'A+', '评级为 A+');
  assert(timelineItem1.photos && timelineItem1.photos.length === 3, '标准 9 宫格相册输出 3 张照片');
  assert(
    timelineItem1.photos[0].thumbnailUrl.includes('x-oss-process=image/resize'),
    'AliyunOssMediaAdapter 动态缩略图参数正确追加',
  );
  assert(timelineItem1.photos[0].previewList.length === 3, '自动预装配 previewList 全量预览序列');
  assert(timelineItem1.voiceUrl.includes('.mp3'), '语音点评原链接正确保留');
  assert(timelineItem1.voiceMeta && timelineItem1.voiceMeta.durationFormatted === '01:08', '语音时长正确格式化为 01:08');
  assert(timelineItem1.voiceMeta.waveformPeaks.length === 20, '正确采样 20 点波形序列');
  assert(timelineItem1.videoUrl.includes('.mp4'), '随堂实操视频链接正确保留');
  assert(timelineItem1.videoMeta && timelineItem1.videoMeta.posterUrl.includes('x-oss-process=video/snapshot'), '视频自动追加首帧封面截图参数');
  assert(!!timelineItem1.shareToken, '单课安全免密分享令牌自动生成');

  // Level 3: 老旧历史无课评课次优雅降级校验
  const timelineItem2 = dossier.timeline.find((t) => t.scheduleEventId === scheduleEvent2.id);
  assert(!!timelineItem2, '成功优雅展示历史无课评考勤 2');
  assert(timelineItem2.photos.length === 0, '无相册时安全输出空数组，无 NPE 报错');
  assert(timelineItem2.videoUrl === undefined, '无视频时安全输出 undefined');
  assert(timelineItem2.voiceUrl === undefined, '无语音时安全输出 undefined');
  assert(timelineItem2.comment === '老旧考勤纯文本评语：课上积极听讲。', '考勤评语正常兜底保留');

  // 相册大盘画廊校验
  assert(dossier.albumGallery.length === 3, '全量相册画廊大盘成功汇聚 3 张照片');
  assert(!!dossier.portfolioShareToken, '全景大盘免登录分享令牌成功签发');

  console.log('\n--- [Test Phase 2] 家长端免密安全令牌与防越权 (HMAC-SHA256 & Anti-IDOR) ---');

  const shareToken = timelineItem1.shareToken;

  // 1. 合法访问单课课评报告
  const singleLessonRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/public/growth/lesson?token=${encodeURIComponent(shareToken)}&scheduleEventId=${scheduleEvent1.id}`,
    method: 'GET',
  });

  assert(singleLessonRes.status === 200, '免密单课课评落地页接口返回 200 OK (无需账号密码)');
  const singleLessonData = singleLessonRes.body.data || singleLessonRes.body;
  assert(singleLessonData.studentName === '张*豪', '商业隐私脱敏沙箱生效：姓名安全脱敏为 张*豪');
  assert(singleLessonData.lesson.lessonTitle.includes('坦克大战'), '单课卡片展示正确课次主题');
  assert(singleLessonData.lesson.performanceTag === '算法标兵', '单课卡片透出特写标签');
  assert(singleLessonData.lesson.badges.length >= 1, '激励勋章成功自动授予');
  assert(singleLessonData.lesson.syllabusPoints.length >= 1, '大纲核心重难点切片成功提炼');

  // 2. 商业隐私安全性：绝不泄漏财务与内部成本
  assert(singleLessonData.lesson.pricePerLesson === undefined, 'Zero-Leak: 课包单价严格隐藏');
  assert(singleLessonData.lesson.regularBurned === undefined, 'Zero-Leak: 正课消课成本严格隐藏');
  assert(singleLessonData.lesson.reversalReason === undefined, 'Zero-Leak: 内部审计冲正原因不泄露给家长');

  // 3. 防越权拘束 (Anti-IDOR)：使用单课 Token 尝试越权访问其他排课
  const illegalAccessRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/public/growth/lesson?token=${encodeURIComponent(shareToken)}&scheduleEventId=${scheduleEvent2.id}`,
    method: 'GET',
  });
  assert(
    illegalAccessRes.status === 403,
    'Anti-IDOR 越权拦截：单课令牌访问非授权排课日程，硬性阻断 403 Forbidden',
  );

  // 4. 防篡改校验：篡改 Token 密文字符
  const tamperedToken = shareToken.slice(0, -6) + 'xxxxxx';
  const tamperRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/public/growth/lesson?token=${encodeURIComponent(tamperedToken)}&scheduleEventId=${scheduleEvent1.id}`,
    method: 'GET',
  });
  assert(
    tamperRes.status === 401,
    'HMAC-SHA256 防篡改校验：篡改 Token 密文，系统硬性拦截 401 Unauthorized',
  );

  console.log('\n--- [Test Phase 3] 家长端全景瀑布流与反结课冲正噪点清洗 ---');

  const portfolioToken = dossier.portfolioShareToken;

  const feedRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/public/growth/feed?token=${encodeURIComponent(portfolioToken)}`,
    method: 'GET',
  });

  assert(feedRes.status === 200, '免密全景瀑布流接口返回 200 OK');
  const feedData = feedRes.body.data || feedRes.body;
  assert(feedData.studentSummary.studentName === '张*豪', '家长全景大盘学员姓名脱敏');
  assert(feedData.feed.length === 2, '家长端全景瀑布流只包含 2 条有效出勤课次');

  // Level 4: 冲正噪点物理过滤断言
  const hasReversedInParentFeed = feedData.feed.some((f) => f.scheduleEventId === scheduleEvent3.id);
  assert(
    !hasReversedInParentFeed,
    '冲正噪点清洗不变量：已反结课冲正的课次 3 在家长端物理完全清除，绝不骚扰家长',
  );

  console.log('\n--- [Test Phase 4] 后台一键生成家长分享安全链接端点 ---');

  const issueRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/students/${testStudent.id}/growth-token`,
      method: 'POST',
      headers: authHeaders,
    },
    { scheduleEventId: scheduleEvent1.id },
  );

  assert(issueRes.status === 201 || issueRes.status === 200, '签发分享访问令牌端点响应成功');
  const issueData = issueRes.body.data || issueRes.body;
  assert(!!issueData.token, '返回合法 Token 密文字符串');
  assert(issueData.scope === 'single_lesson', '作用域正确标注为 single_lesson');
  assert(issueData.h5ReportUrl.includes('/public/growth-report?token='), '自动生成开箱即用的 H5 落地页直达链接');

  console.log('\n--- [Test Phase 5] 清理测试临时数据 ---');
  await prisma.lessonEvaluationStudentItem.deleteMany({ where: { evaluationId: evaluation1.id } });
  await prisma.lessonEvaluation.deleteMany({ where: { id: evaluation1.id } });
  await prisma.attendanceRecord.deleteMany({ where: { studentId: testStudent.id } });
  await prisma.scheduleEvent.deleteMany({ where: { id: { in: [scheduleEvent1.id, scheduleEvent2.id, scheduleEvent3.id] } } });
  await prisma.studentCoursePackage.deleteMany({ where: { studentId: testStudent.id } });
  await prisma.student.deleteMany({ where: { id: testStudent.id } });
  await prisma.class.deleteMany({ where: { id: testClass.id } });
  console.log('✓ 测试数据已完全安全清理');

  console.log('\n================================================================================');
  console.log(`🎉 恭喜！学情成长投影多媒体相册流与双重视角全部 ${passed} 项严苛断言 100% 绿色通过！`);
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('测试运行异常失败:', err);
  process.exit(1);
});
