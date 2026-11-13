/**
 * 家长端演示数据 (只用于冒烟和截图，写在临时库里)。
 * 给种子家长 13900000125 的孩子张子豪 (stu-001) 造一个班、过去 3 节已结课并发布课评 (带照片和评语)、
 * 1 节请假、2 节未来的课，让课评、课表、课程、成长几个页面都有内容可看。
 */
const zlib = require('zlib');
const { api, apiLogin, BASE_URL } = require('./helpers.cjs');

const PARENT = { phone: '13900000125', password: '000125', childId: 'stu-001' };

/** 生成一张纯色 PNG (不依赖图片库)，用作随堂照片 */
function solidPng(width, height, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 2; // RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function uploadPhotos(token, campusId, scheduleEventId, colors) {
  const form = new FormData();
  colors.forEach((c, i) => form.append('files', new Blob([solidPng(480, 360, c)], { type: 'image/png' }), `photo-${i}.png`));
  form.append('scheduleEventId', scheduleEventId);
  form.append('campusId', campusId);
  const res = await fetch(`${BASE_URL}/api/upload/photos`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const body = await res.json();
  return body?.data?.persistedUrls || [];
}

const day = (offset) => new Date(Date.now() + 8 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);

/** 建好演示数据，返回清理函数 */
async function seedParentDemo(prisma) {
  const { token } = await apiLogin('superAdmin');
  const child = await prisma.student.findUnique({ where: { id: PARENT.childId } });
  const tag = `__t_${Date.now().toString(36)}`;
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());
  const teacher = await prisma.user.findFirst({ where: { account: 'zhaolp' } });
  const classroom = await prisma.classroom.create({ data: { campusId: child.campusId, code: `CR-${tag}`, name: '创客实验室 A' } });
  const cls = await prisma.class.create({
    data: {
      campusId: child.campusId, courseId: course.id, teacherId: teacher.id, classroomId: classroom.id, name: '周六上午创意编程班', code: `CLS-${tag}`,
      capacity: 10, status: 'in_progress', startDate: new Date(Date.now() - 86400000 * 30), endDate: new Date(Date.now() + 86400000 * 90),
    },
  });
  const pkg = await prisma.studentCoursePackage.create({
    data: { studentId: child.id, courseId: course.id, classId: cls.id, totalLessons: 24, remainingLessons: 24, consumedLessons: 0, bonusLessons: 2, pricePerLesson: 180, status: 'active', expiryDate: new Date(Date.now() + 86400000 * 200) },
  });
  const mk = (offset, time) =>
    prisma.scheduleEvent.create({ data: { campusId: child.campusId, classId: cls.id, teacherId: teacher.id, classroomId: classroom.id, date: day(offset), startTime: time[0], endTime: time[1], status: 'scheduled' } });

  const palette = [[99, 132, 255], [255, 170, 80], [90, 200, 150], [240, 110, 130], [160, 120, 240]];
  const lessons = [
    { offset: -14, title: '认识角色与舞台', photos: 1, comment: '第一次上课就能独立让角色动起来，课堂上很专注，下节课可以试试加上声音。' },
    { offset: -7, title: '循环与重复', photos: 3, comment: '理解了「重复执行」的用法，用循环画出了漂亮的花朵图案。遇到问题会先自己思考，再举手提问，很棒！' },
    { offset: -3, title: '条件判断小游戏', photos: 5, comment: '完成了接苹果小游戏，还主动给游戏加了计分功能。' },
  ];
  const events = [];
  for (const l of lessons) {
    const ev = await mk(l.offset, ['09:00', '10:30']);
    events.push(ev);
    const photos = await uploadPhotos(token, child.campusId, ev.id, palette.slice(0, l.photos));
    await api(token, 'POST', '/api/educational/fulfillment/fulfill', {
      scheduleEventId: ev.id,
      mode: 'FULL_SETTLE',
      lessonTitle: l.title,
      studyContentHtml: `<p>本节课我们学习了「${l.title}」。</p><ul><li>理解核心概念</li><li>完成课堂练习</li><li>课后小任务：和家长分享作品</li></ul>`,
      overallRating: 5,
      teacherComment: '全班同学都很投入。',
      photoList: photos,
      anomalyOverrides: [{ studentId: child.id, packageId: pkg.id, status: 'present', deductLessons: 1, rating: 5, personalizedComment: l.comment, photos, isEvaluated: true }],
    });
  }
  const leave = await mk(-10, ['09:00', '10:30']);
  events.push(leave);
  await api(token, 'POST', '/api/educational/attendances/roll-call', { scheduleEventId: leave.id, items: [{ studentId: child.id, packageId: pkg.id, status: 'leave', deductLessons: 0 }] });
  events.push(await mk(1, ['09:00', '10:30']));
  events.push(await mk(8, ['09:00', '10:30']));

  return async function cleanup() {
    const ids = events.map((e) => e.id);
    const evals = await prisma.lessonEvaluation.findMany({ where: { scheduleEventId: { in: ids } }, select: { id: true } });
    const evalIds = evals.map((e) => e.id);
    await prisma.lessonEvaluationOutbox.deleteMany({ where: { evaluationId: { in: evalIds } } }).catch(() => {});
    await prisma.lessonEvaluationRevision.deleteMany({ where: { evaluationId: { in: evalIds } } }).catch(() => {});
    await prisma.lessonEvaluationStudentItem.deleteMany({ where: { evaluationId: { in: evalIds } } }).catch(() => {});
    await prisma.lessonEvaluation.deleteMany({ where: { id: { in: evalIds } } }).catch(() => {});
    await prisma.parentReadState.deleteMany({ where: { scheduleEventId: { in: ids } } }).catch(() => {});
    await prisma.attendanceRecord.deleteMany({ where: { scheduleEventId: { in: ids } } });
    await prisma.scheduleEvent.deleteMany({ where: { id: { in: ids } } });
    await prisma.studentCoursePackage.deleteMany({ where: { id: pkg.id } });
    await prisma.class.deleteMany({ where: { id: cls.id } });
    await prisma.classroom.deleteMany({ where: { id: classroom.id } });
  };
}

module.exports = { PARENT, seedParentDemo, solidPng };
