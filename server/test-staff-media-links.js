/**
 * 管理端 / 教师端媒体访问控制测试
 * 覆盖：/uploads/ 不再公开访问、上传回执与业务接口返回限时签名链接、签名防篡改、
 *       保存时回传的签名链接还原为 /uploads/<key> 存储引用、品牌等非学员媒体字段原样透传。
 * 运行前提：后端已在 3001 端口启动 (本地存储模式)，且已执行 prisma db push 与 seed。
 * 运行方式：cd server && node test-staff-media-links.js
 */
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const { of, lastValueFrom } = require('rxjs');
const { MediaLinkInterceptor } = require('./dist/modules/upload/media-link.interceptor');
const { LocalStorageEngineAdapter } = require('./dist/modules/upload/domain/adapters/local-storage-engine.adapter');

const { BASE_URL } = require('./test-utils/target');
const prisma = new PrismaClient();

function request(method, urlPath, { body, headers = {}, raw } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const req = http.request(url, { method, headers }, (res) => {
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
        resolve({ status: res.statusCode, body: payload, buffer: buf, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    else if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

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

function jpeg(size = 512) {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf;
}

function multipart(fields, file) {
  const boundary = `----staffmedia${Date.now()}`;
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.name}"\r\nContent-Type: image/jpeg\r\n\r\n`,
  ));
  parts.push(file.buffer, Buffer.from(`\r\n--${boundary}--\r\n`));
  return { boundary, raw: Buffer.concat(parts) };
}

/** 直接驱动拦截器：模拟一次 HTTP 调用，返回 [处理后的请求体, 处理后的响应] */
async function runInterceptor(interceptor, reqBody, responseData) {
  const req = { body: reqBody };
  const context = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) };
  const out = await lastValueFrom(interceptor.intercept(context, { handle: () => of(responseData) }));
  return [req.body, out];
}

async function testInterceptorUnit() {
  console.log('\n▶ [Case 1] 拦截器：出参签名、入参还原、非学员媒体透传');
  const interceptor = new MediaLinkInterceptor(new LocalStorageEngineAdapter('/tmp/unused'));
  const key = 'photos/campus-a/sch-1/20261102/abc.jpg';
  const [, out] = await runInterceptor(interceptor, undefined, {
    photoList: [`http://localhost:3001/uploads/${key}`],
    thumbnailUrl: `/uploads/${key}?w=300&h=300&fit=crop`,
    photosJson: JSON.stringify([`/uploads/${key}`]),
    videoUrl: '/uploads/videos/campus-a/sch-1/20261102/v.mp4',
    logoUrl: '/uploads/branding/logo.png',
    external: 'https://cdn.example.com/photos/shot-1.jpg',
    createdAt: new Date('2026-11-02T00:00:00Z'),
  });
  assert(/^\/api\/media\/photos\/campus-a\/sch-1\/20261102\/abc\.jpg\?exp=\d+&sig=/.test(out.photoList[0]), '绝对 /uploads/ 地址签名为 /api/media 限时链接');
  assert(out.thumbnailUrl.startsWith(`/api/media/${key}?exp=`), '缩略图地址同样签名');
  assert(JSON.parse(out.photosJson)[0].startsWith('/api/media/'), 'JSON 字符串数组中的地址同样签名');
  assert(out.videoUrl.startsWith('/api/media/videos/'), '视频地址签名');
  assert(out.logoUrl === '/uploads/branding/logo.png', '品牌 LOGO 等非学员媒体原样透传');
  assert(out.external === 'https://cdn.example.com/photos/shot-1.jpg', '第三方外链原样透传');
  assert(out.createdAt instanceof Date, '非纯对象 (Date) 保持原样');

  const [body] = await runInterceptor(interceptor, {
    photoList: [out.photoList[0], 'https://cdn.example.com/photos/shot-1.jpg'],
    videoUrl: out.videoUrl,
    nested: { photos: JSON.stringify([out.photoList[0]]) },
    tampered: `/api/media/${key}?exp=1`,
  }, null);
  assert(body.photoList[0] === `/uploads/${key}`, '回传签名链接还原为 /uploads/<key>');
  assert(body.photoList[1] === 'https://cdn.example.com/photos/shot-1.jpg', '回传外链原样保存');
  assert(body.videoUrl === '/uploads/videos/campus-a/sch-1/20261102/v.mp4', '回传视频签名链接还原');
  assert(JSON.parse(body.nested.photos)[0] === `/uploads/${key}`, '嵌套 JSON 字符串数组同样还原');
  assert(body.tampered === `/api/media/${key}?exp=1`, '缺少 sig 的地址不识别为签名链接');
}

async function testHttp() {
  console.log('\n▶ [Case 2] 上传回执签名、/uploads/ 不可匿名访问、签名防篡改');
  const login = await request('POST', '/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    body: { account: 'donghaichao', password: '123456' },
  });
  const token = login.body?.accessToken || login.body?.token;
  assert(!!token, '管理员登录成功');
  const auth = { Authorization: `Bearer ${token}` };

  const campus = await prisma.campus.findFirst({ where: { status: 'active' } }) || await prisma.campus.findFirst();
  const cls = await prisma.class.findFirst({ where: { campusId: campus.id } });
  const teacher = await prisma.user.findFirst({ where: { campusId: campus.id } });
  const classroom = await prisma.classroom.findFirst({ where: { campusId: campus.id } }) || await prisma.classroom.findFirst();
  const schedule = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: cls.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      date: '2026-11-02',
      startTime: '09:00',
      endTime: '10:00',
      status: 'scheduled',
      semanticType: 'regular',
      classType: 'formal',
    },
  });

  try {
    const form = multipart({ scheduleEventId: schedule.id, campusId: campus.id }, { name: 'staff.jpg', buffer: jpeg() });
    const upload = await request('POST', '/api/upload/photos', {
      raw: form.raw,
      headers: { ...auth, 'Content-Type': `multipart/form-data; boundary=${form.boundary}` },
    });
    assert(upload.status === 201 || upload.status === 200, `照片上传成功 (HTTP ${upload.status})`);
    const signedUrl = upload.body?.persistedUrls?.[0] || '';
    assert(/\/api\/media\/photos\/.+\?exp=\d+&sig=/.test(signedUrl), '上传回执返回限时签名链接而非 /uploads/ 原始路径');
    assert(!JSON.stringify(upload.body).includes('/uploads/'), '上传回执中不出现 /uploads/ 原始路径');
    const key = decodeURIComponent(new URL(signedUrl, BASE_URL).pathname.replace(/^\/api\/media\//, ''));

    const anonymous = await request('GET', `/uploads/${key}`);
    assert(anonymous.status === 404, `匿名访问 /uploads/<key> 不再返回媒体 (HTTP ${anonymous.status})`);
    const withToken = await request('GET', `/uploads/${key}`, { headers: auth });
    assert(withToken.status === 404, '/uploads/ 路由已下线 (携带令牌同样 404)');

    const media = await request('GET', new URL(signedUrl, BASE_URL).pathname + new URL(signedUrl, BASE_URL).search);
    assert(media.status === 200 && media.buffer[0] === 0xff && media.buffer[1] === 0xd8, '签名链接无需 Authorization 头即可读取 (img/video 标签可用)');
    const tampered = await request('GET', `/api/media/${key}?exp=${Math.floor(Date.now() / 1000) + 600}&sig=forged`);
    assert(tampered.status === 403, '伪造签名被拒绝 (403)');

    console.log('\n▶ [Case 3] 保存课评时回传签名链接 → 库内存 /uploads/<key>；读取时再次签名');
    const commit = await request('POST', '/api/educational/lesson-evaluations/commit', {
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: {
        scheduleEventId: schedule.id,
        campusId: campus.id,
        publish: false,
        payload: {
          lessonTitle: '媒体访问控制测试课',
          studyContentHtml: '<p>测试</p>',
          overallRating: 5,
          teacherComment: '测试评语',
          photoList: [signedUrl],
          studentOverrides: [],
        },
      },
    });
    assert(commit.status === 200 || commit.status === 201, `课评草稿保存成功 (HTTP ${commit.status})`);
    const saved = await prisma.lessonEvaluation.findUnique({ where: { scheduleEventId: schedule.id } });
    assert(saved && JSON.parse(saved.photoList)[0] === `/uploads/${key}`, '数据库存储与介质无关的 /uploads/<key> 引用，不含签名');

    const workbench = await request('GET', `/api/educational/lesson-evaluations/workbench/${schedule.id}`, { headers: auth });
    const photo = workbench.body?.evaluation?.photoList?.[0] || '';
    assert(photo.startsWith(`/api/media/${key}?exp=`), '课评工作台读取时返回签名链接');
    assert(!JSON.stringify(workbench.body).includes('/uploads/photos/'), '工作台响应中不出现 /uploads/ 原始路径');

    await new LocalStorageEngineAdapter().delete(key);
  } finally {
    await prisma.lessonEvaluation.deleteMany({ where: { scheduleEventId: schedule.id } });
    await prisma.scheduleEvent.delete({ where: { id: schedule.id } });
  }
}

async function main() {
  console.log('================================================================');
  console.log('🚀 开始执行管理端媒体访问控制测试...');
  console.log('================================================================');
  await testInterceptorUnit();
  await testHttp();
  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error('❌ 测试运行失败:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
