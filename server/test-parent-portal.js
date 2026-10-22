/**
 * 家长端接口集成测试 (/api/parent/*)
 * 覆盖：登录与锁定、多家长同时在线、家长/教职工令牌边界、子女越权 (IDOR)、
 *       已离校 3 个月只读窗口、课评仅发布可见、无默认文案、签名媒体链接、按周相册。
 * 运行前提：后端已在 3001 端口启动，且已执行 prisma db push。
 * 运行方式：cd server && node test-parent-portal.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();
const RUN = Date.now().toString().slice(-6);
const PHONE_A = `1770${RUN}1`.slice(0, 11); // 家庭 A (多个子女)
const PHONE_B = `1771${RUN}2`.slice(0, 11); // 家庭 B (越权对照 + 锁定测试)
const DAY = 86400000;

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const req = http.request(url, { method, headers: { 'Content-Type': 'application/json', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let parsed;
        try {
          parsed = JSON.parse(buf.toString('utf8'));
        } catch {
          parsed = buf;
        }
        const payload = parsed && typeof parsed === 'object' && parsed.data !== undefined ? parsed.data : parsed;
        resolve({ status: res.statusCode, body: payload, raw: parsed, buffer: buf, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${msg}`);
  } else {
    fail++;
    console.error(`  ❌ ${msg}`);
  }
}

const ids = { students: [], events: [], evaluations: [], packages: [] };

async function setupFixtures() {
  const cls = await prisma.class.findFirst({ where: { campusId: 'campus-bj-hq' } });
  if (!cls) throw new Error('缺少总部校区班级，请先执行 npm run prisma:seed');
  const otherCampus = (await prisma.campus.findFirst({ where: { id: { not: 'campus-bj-hq' } } }))?.id || 'campus-bj-hq';

  const mk = (suffix, data) =>
    prisma.student.create({
      data: {
        studentNo: `PT${RUN}${suffix}`,
        gender: 'male',
        campusId: 'campus-bj-hq',
        status: 'normal',
        ...data,
      },
    });
  const s1 = await mk('1', { name: '测试甲', phone: PHONE_A, phoneNormalized: PHONE_A });
  const s2 = await mk('2', { name: '测试乙', phone: PHONE_A, phoneNormalized: PHONE_A, campusId: otherCampus });
  const s3 = await mk('3', { name: '测试丙', phone: PHONE_A, phoneNormalized: PHONE_A, status: 'dropped_out', leftAt: new Date(Date.now() - 30 * DAY) });
  const s4 = await mk('4', { name: '测试丁', phone: PHONE_A, phoneNormalized: PHONE_A, status: 'transferred', leftAt: new Date(Date.now() - 120 * DAY) });
  const s5 = await mk('5', { name: '测试戊', phone: PHONE_B, phoneNormalized: PHONE_B });
  ids.students = [s1.id, s2.id, s3.id, s4.id, s5.id];

  const pkg = await prisma.studentCoursePackage.create({
    data: { studentId: s1.id, courseId: cls.courseId, classId: cls.id, totalLessons: 20, remainingLessons: 3, consumedLessons: 17, pricePerLesson: 200 },
  });
  ids.packages.push(pkg.id);

  // 媒体文件 (签名链接测试)
  const key = `test-parent/${RUN}/own.jpg`;
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
  fs.mkdirSync(path.join(uploadsDir, 'test-parent', RUN), { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, key), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]));

  const event = async (n, date, evaluation) => {
    const e = await prisma.scheduleEvent.create({
      data: {
        id: `pt-${RUN}-${n}`,
        campusId: 'campus-bj-hq',
        classId: cls.id,
        teacherId: cls.teacherId,
        classroomId: cls.classroomId,
        date,
        startTime: '09:00',
        endTime: '10:30',
        status: 'completed',
      },
    });
    ids.events.push(e.id);
    await prisma.attendanceRecord.create({
      data: { scheduleEventId: e.id, studentId: s1.id, status: 'present', packageId: pkg.id, operator: 'test' },
    });
    await prisma.attendanceRecord.create({
      data: { scheduleEventId: e.id, studentId: s3.id, status: 'present', operator: 'test' },
    });
    if (evaluation) {
      const ev = await prisma.lessonEvaluation.create({
        data: {
          campusId: 'campus-bj-hq',
          scheduleEventId: e.id,
          classId: cls.id,
          teacherId: cls.teacherId,
          lessonTitle: `测试课次 ${n}`,
          studyContent: '<p>循环结构</p><p>条件判断<script>alert(1)</script></p>',
          teacherComment: evaluation.teacherComment,
          status: evaluation.status,
          publishedAt: evaluation.status === 'published' ? new Date() : null,
          photoList: JSON.stringify([`http://localhost:3001/uploads/test-parent/${RUN}/class.jpg`]),
        },
      });
      ids.evaluations.push(ev.id);
      if (evaluation.own) {
        await prisma.lessonEvaluationStudentItem.create({
          data: { evaluationId: ev.id, studentId: s1.id, rating: 4.5, comment: '本节课独立完成作品', photos: JSON.stringify([`/uploads/${key}`]) },
        });
      }
    }
    return e;
  };
  const e1 = await event(1, '2026-10-12', { status: 'published', teacherComment: '', own: true }); // 周一
  const e2 = await event(2, '2026-10-14', { status: 'published', teacherComment: '全班表现稳定', own: false }); // 同周周三
  const e3 = await event(3, '2026-10-07', { status: 'draft', teacherComment: '草稿评语不应外泄', own: true }); // 上一周，草稿
  // 回归场景：老师端把学员专属照片/视频/评语同时写进了课次公共字段，且同一课次有两条有效考勤
  const e4 = await prisma.scheduleEvent.create({
    data: {
      id: `pt-${RUN}-4`,
      campusId: 'campus-bj-hq',
      classId: cls.id,
      teacherId: cls.teacherId,
      classroomId: cls.classroomId,
      date: '2026-10-20',
      startTime: '09:00',
      endTime: '10:30',
      status: 'completed',
    },
  });
  ids.events.push(e4.id);
  for (let i = 0; i < 2; i++) {
    await prisma.attendanceRecord.create({
      data: { scheduleEventId: e4.id, studentId: s5.id, status: 'present', operator: i ? 'roll-call' : 'evaluation-draft' },
    });
  }
  const dupComment = '今天独立完成了迷宫闯关';
  const ev4 = await prisma.lessonEvaluation.create({
    data: {
      campusId: 'campus-bj-hq',
      scheduleEventId: e4.id,
      classId: cls.id,
      teacherId: cls.teacherId,
      lessonTitle: '回归课次',
      studyContent: '<p>迷宫</p>',
      teacherComment: dupComment,
      status: 'published',
      publishedAt: new Date(),
      photoList: JSON.stringify([`http://localhost:3001/uploads/${key}`]),
      videoUrl: `/uploads/test-parent/${RUN}/own.mp4`,
    },
  });
  ids.evaluations.push(ev4.id);
  await prisma.lessonEvaluationStudentItem.create({
    data: {
      evaluationId: ev4.id,
      studentId: s5.id,
      rating: 5,
      comment: dupComment,
      photos: JSON.stringify([`/uploads/${key}`]),
      videoUrl: `http://localhost:3001/uploads/test-parent/${RUN}/own.mp4`,
    },
  });

  return { s1, s2, s3, s4, s5, pkg, e1, e2, e3, e4, key };
}

async function cleanup() {
  await prisma.parentReadState.deleteMany({ where: { studentId: { in: ids.students } } });
  await prisma.lessonEvaluation.deleteMany({ where: { id: { in: ids.evaluations } } });
  await prisma.attendanceRecord.deleteMany({ where: { scheduleEventId: { in: ids.events } } });
  await prisma.scheduleEvent.deleteMany({ where: { id: { in: ids.events } } });
  await prisma.studentCoursePackage.deleteMany({ where: { id: { in: ids.packages } } });
  await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
  await prisma.parentAccount.deleteMany({ where: { phone: { in: [PHONE_A, PHONE_B] } } });
  fs.rmSync(path.join(process.env.UPLOADS_DIR || path.join(__dirname, 'uploads'), 'test-parent', RUN), { recursive: true, force: true });
}

async function run() {
  console.log('🚀 家长端接口集成测试\n');
  const f = await setupFixtures();
  const login = (phone, password) => request('POST', '/api/parent/auth/login', { phone, password });

  console.log('— 登录');
  const wrong = await login(PHONE_A, '000000');
  const unknown = await login('13000000000', '000000');
  assert(wrong.status === 401 && unknown.status === 401, '错误密码与未登记手机号均返回 401');
  assert(wrong.raw?.message === unknown.raw?.message, '两种失败提示一致，不暴露手机号是否登记');

  const okA1 = await login(`+86 ${PHONE_A.slice(0, 3)}-${PHONE_A.slice(3)}`, PHONE_A.slice(-6));
  assert(okA1.status === 200 && !!okA1.body?.accessToken, '手机号带 +86 与短横线也能登录 (后 6 位密码)');
  const tokenA1 = okA1.body.accessToken;
  const childIds = (okA1.body.children || []).map((c) => c.studentId);
  assert(childIds.includes(f.s1.id) && childIds.includes(f.s2.id), '同一手机号返回多个子女 (含跨校区)');
  const c3 = (okA1.body.children || []).find((c) => c.studentId === f.s3.id);
  assert(c3 && c3.access === 'read_only' && !!c3.readOnlyUntil, '离校 30 天的学员只读可见并带截止日期');
  assert(!childIds.includes(f.s4.id), '离校 120 天的学员不再可见');

  const okA2 = await login(PHONE_A, PHONE_A.slice(-6));
  const tokenA2 = okA2.body.accessToken;
  const meA1 = await request('GET', '/api/parent/me', null, auth(tokenA1));
  const meA2 = await request('GET', '/api/parent/me', null, auth(tokenA2));
  assert(meA1.status === 200 && meA2.status === 200, '同一手机号两位家长同时在线，互不挤占');
  const sessions = await request('GET', '/api/parent/sessions', null, auth(tokenA1));
  assert(Array.isArray(sessions.body) && sessions.body.length >= 2, '会话列表包含两个登录设备');

  console.log('— 令牌边界');
  const staffLogin = await request('POST', '/api/auth/login', { account: 'donghaichao', password: '123456' });
  const staffToken = staffLogin.body?.accessToken || staffLogin.body?.token;
  const p1 = await request('GET', '/api/students', null, auth(tokenA1));
  const p2 = await request('GET', '/api/educational/schedules', null, auth(tokenA1));
  const p3 = await request('POST', '/api/upload/photos', {}, auth(tokenA1));
  assert(p1.status === 403 && p2.status === 403 && p3.status === 403, '家长令牌访问教职工接口一律 403');
  const s1 = await request('GET', '/api/parent/me', null, auth(staffToken));
  assert(s1.status === 403, '教职工令牌访问家长接口 403');
  const anonUpload = await request('POST', '/api/upload/photos', {});
  assert(anonUpload.status === 401, '未登录上传照片被拒绝 (401)');

  console.log('— 子女越权');
  const idor = await request('GET', `/api/parent/students/${f.s5.id}/evaluations`, null, auth(tokenA1));
  assert(idor.status === 404, '查看非本人子女返回 404');

  console.log('— 课评');
  const feed = await request('GET', `/api/parent/students/${f.s1.id}/evaluations`, null, auth(tokenA1));
  const items = feed.body?.items || [];
  const it1 = items.find((i) => i.scheduleEventId === f.e1.id);
  const it3 = items.find((i) => i.scheduleEventId === f.e3.id);
  assert(feed.status === 200 && items.length === 3, '课评流包含 3 次出勤课');
  assert(it3 && it3.evaluation === null, '草稿课评不出现在家长端');
  assert(it1?.evaluation?.unread === true && it1.evaluation.rating === 4.5, '已发布课评带本人评分与未读标记');
  assert(it1?.evaluation?.commentPreview === '本节课独立完成作品', '优先展示本人专属评语');
  const draftDetail = await request('GET', `/api/parent/students/${f.s1.id}/evaluations/${f.e3.id}`, null, auth(tokenA1));
  assert(draftDetail.status === 404, '草稿课评详情 404');
  const detail = await request('GET', `/api/parent/students/${f.s1.id}/evaluations/${f.e1.id}`, null, auth(tokenA1));
  assert(detail.status === 200 && detail.body.overall.comment === null, '教师未填写总评时返回 null，不填充默认文案');
  assert(!/script/i.test(detail.body.content.html || ''), '课程内容 HTML 已清除 script');
  const ownPhoto = detail.body.forChild?.photos?.[0]?.url || '';
  assert(/\/api\/media\/test-parent\/.+\?exp=\d+&sig=/.test(ownPhoto), '本人照片输出为限时签名链接');
  assert(!JSON.stringify(detail.body).includes('/uploads/'), '响应中不出现原始 /uploads/ 存储路径');

  const media = await request('GET', ownPhoto.replace(/^https?:\/\/[^/]+/, ''));
  assert(media.status === 200 && media.buffer[0] === 0xff, '签名链接可读取文件');
  const tampered = await request('GET', ownPhoto.replace(/^https?:\/\/[^/]+/, '').replace(/sig=[^&]+/, 'sig=bad'));
  assert(tampered.status === 403, '篡改签名被拒绝');

  await request('POST', `/api/parent/students/${f.s1.id}/evaluations/${f.e1.id}/read`, null, auth(tokenA1));
  const feed2 = await request('GET', `/api/parent/students/${f.s1.id}/evaluations`, null, auth(tokenA2));
  const it1b = (feed2.body?.items || []).find((i) => i.scheduleEventId === f.e1.id);
  assert(it1b?.evaluation?.unread === false, '已读状态在同一手机号的两位家长间共享');

  console.log('— 相册与成长');
  const album = await request('GET', `/api/parent/students/${f.s1.id}/album`, null, auth(tokenA1));
  const weeks = album.body?.weeks || [];
  assert(weeks.length === 1 && weeks[0].weekStart === '2026-10-12', '同一周两节课汇总为一个周相册，草稿周不出现');
  assert(weeks[0]?.lessonCount === 2 && weeks[0]?.photos?.[0]?.isOwn === true, '周相册内本人照片排在班级照片之前');
  const summary = await request('GET', `/api/parent/students/${f.s1.id}/growth/summary`, null, auth(tokenA1));
  assert(summary.body?.lessonsAttended === 3 && summary.body?.evaluations === 2, '成长概览：出勤 3 次、已发布课评 2 篇');

  console.log('— 课表与课程');
  const schedule = await request('GET', `/api/parent/students/${f.s1.id}/schedule?from=2026-10-12&to=2026-10-18`, null, auth(tokenA1));
  const lessons = schedule.body?.lessons || [];
  assert(schedule.status === 200 && lessons.some((l) => l.scheduleEventId === f.e1.id && l.status === 'present' && l.evaluationReady), '课表含出勤状态与课评就绪标记');
  const courses = await request('GET', `/api/parent/students/${f.s1.id}/courses`, null, auth(tokenA1));
  const course = (courses.body || []).find((c) => c.packageId === f.pkg.id);
  assert(course && course.remainingLessons === 3 && course.lowHours === true, '课程显示剩余课时与低课时提醒');
  assert(!JSON.stringify(courses.body).match(/price|amount|balance/i), '课程接口不含任何金额字段');
  const usage = await request('GET', `/api/parent/students/${f.s1.id}/courses/${f.pkg.id}/usage`, null, auth(tokenA1));
  assert(usage.status === 200 && usage.body.entries.length === 3, '课时消耗明细 3 条');
  const leftSchedule = await request('GET', `/api/parent/students/${f.s3.id}/schedule`, null, auth(tokenA1));
  const leftFeed = await request('GET', `/api/parent/students/${f.s3.id}/evaluations`, null, auth(tokenA1));
  assert(leftSchedule.status === 403 && leftFeed.status === 200, '离校学员：课表不可见，历史课评可见');

  console.log('— 会话管理');
  const otherSession = sessions.body.find((s) => !s.isCurrent);
  const del = await request('DELETE', `/api/parent/sessions/${otherSession.id}`, null, auth(tokenA1));
  const afterDel = await request('GET', '/api/parent/me', null, auth(tokenA2));
  assert(del.status === 200 && afterDel.status === 401, '结束另一位家长的会话后其令牌失效');
  const revoke = await request('POST', `/api/students/${f.s1.id}/parent-sessions/revoke`, null, auth(staffToken));
  const afterRevoke = await request('GET', '/api/parent/me', null, auth(tokenA1));
  assert(revoke.status === 200 && afterRevoke.status === 401, '教职工一键注销后该手机号全部家长会话失效');

  console.log('— 回归：专属媒体被重复写入课次公共字段 + 重复考勤');
  const okB = await login(PHONE_B, PHONE_B.slice(-6));
  const tokenB = okB.body.accessToken;
  const feedB = await request('GET', `/api/parent/students/${f.s5.id}/evaluations`, null, auth(tokenB));
  const feedBItems = (feedB.body?.items || []).filter((i) => i.scheduleEventId === f.e4.id);
  assert(feedBItems.length === 1, '同一课次两条有效考勤时，课评流只出现一次');
  assert(feedBItems[0]?.evaluation?.photoCount === 1, '同一张照片只计一次');
  const detailB = await request('GET', `/api/parent/students/${f.s5.id}/evaluations/${f.e4.id}`, null, auth(tokenB));
  assert(detailB.body?.forChild?.photos?.length === 1 && !!detailB.body?.forChild?.video, '照片与视频保留在本人专属评价中');
  assert(detailB.body?.classMedia?.photos?.length === 0 && detailB.body?.classMedia?.video === null, '课堂记录不再重复展示同一张照片和同一个视频');
  assert(detailB.body?.overall?.comment === null, '课堂评语与专属评语相同时不重复展示');
  const albumB = await request('GET', `/api/parent/students/${f.s5.id}/album`, null, auth(tokenB));
  const albumBVideo = await request('GET', `/api/parent/students/${f.s5.id}/album?type=video`, null, auth(tokenB));
  assert(albumB.body?.weeks?.[0]?.photos?.length === 1, '成长相册中照片只出现一次');
  assert(albumBVideo.body?.weeks?.[0]?.videos?.length === 1, '成长相册中视频只出现一次');
  const summaryB = await request('GET', `/api/parent/students/${f.s5.id}/growth/summary`, null, auth(tokenB));
  assert(
    summaryB.body?.lessonsAttended === 1 && summaryB.body?.photos === 1 && summaryB.body?.videos === 1,
    '成长概览按课次与文件去重计数',
  );

  console.log('— 回归：先存课评草稿、后点名不再产生第二条考勤');
  const e5 = await prisma.scheduleEvent.create({
    data: {
      id: `pt-${RUN}-5`,
      campusId: 'campus-bj-hq',
      classId: f.e4.classId,
      teacherId: f.e4.teacherId,
      classroomId: f.e4.classroomId,
      date: '2026-10-21',
      startTime: '14:00',
      endTime: '15:30',
      status: 'scheduled',
    },
  });
  ids.events.push(e5.id);
  const draft = await request(
    'POST',
    '/api/educational/lesson-evaluations/commit',
    {
      scheduleEventId: e5.id,
      publish: false,
      payload: {
        lessonTitle: '草稿后点名',
        studyContentHtml: '<p>测试</p>',
        studentOverrides: [{ studentId: f.s5.id, attendanceStatus: 'present', deductLessons: 1, personalizedComment: '草稿', photos: [] }],
      },
    },
    auth(staffToken),
  );
  const rollCall = await request(
    'POST',
    '/api/educational/attendances/roll-call',
    { scheduleEventId: e5.id, items: [{ studentId: f.s5.id, status: 'present' }] },
    auth(staffToken),
  );
  const e5Rows = await prisma.attendanceRecord.count({ where: { scheduleEventId: e5.id, studentId: f.s5.id, isReversed: false } });
  assert(draft.status < 300 && rollCall.status < 300, `课评草稿与点名接口调用成功 (${draft.status} / ${rollCall.status})`);
  assert(e5Rows === 1, `点名复用课评草稿建立的考勤记录，有效考勤 ${e5Rows} 条 (应为 1)`);
  const evDraft = await prisma.lessonEvaluation.findUnique({ where: { scheduleEventId: e5.id } });
  if (evDraft) ids.evaluations.push(evDraft.id);

  console.log('— 锁定');
  for (let i = 0; i < 5; i++) await login(PHONE_B, '999999');
  const locked = await login(PHONE_B, PHONE_B.slice(-6));
  assert(locked.status === 429, '连续 5 次密码错误后正确密码也被暂时锁定 (429)');
}

run()
  .catch((err) => {
    fail++;
    console.error('💥 测试异常中断:', err);
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('清理失败:', e.message));
    await prisma.$disconnect();
    console.log(`\n结果：${pass} 通过，${fail} 失败`);
    process.exit(fail > 0 ? 1 : 0);
  });
