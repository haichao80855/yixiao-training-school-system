/**
 * 拓视未来教育「一校教培系统」
 * AliyunOssStorageAdapter 测试套件 (离线：桩客户端 + 真实 SDK 本地签名，不访问网络)
 */

const assert = require('assert');
const {
  AliyunOssStorageAdapter,
  readAliyunOssConfigFromEnv,
} = require('./dist/modules/upload/domain/adapters/aliyun-oss-storage.adapter');
const { MediaUploadCoordinator } = require('./dist/modules/upload/domain/media-upload.coordinator');

/** 内存版 OSS 客户端桩：记录调用，模拟 head 404、分页 list */
function createFakeOssClient() {
  const objects = new Map();
  const calls = [];
  return {
    objects,
    calls,
    async put(name, buffer, options) {
      calls.push({ op: 'put', name, options });
      objects.set(name, { buffer, mime: options && options.mime });
      return { name };
    },
    async head(name) {
      calls.push({ op: 'head', name });
      if (!objects.has(name)) {
        const err = new Error('Object not exists');
        err.status = 404;
        err.code = 'NoSuchKey';
        throw err;
      }
      return { status: 200 };
    },
    async delete(name) {
      calls.push({ op: 'delete', name });
      objects.delete(name);
      return {};
    },
    async list(query) {
      calls.push({ op: 'list', query });
      const all = Array.from(objects.keys()).filter((k) => k.startsWith(query.prefix)).sort();
      const start = query.marker ? all.indexOf(query.marker) + 1 : 0;
      const pageSize = 2; // 小页尺寸以覆盖分页逻辑
      const page = all.slice(start, start + pageSize);
      const isTruncated = start + pageSize < all.length;
      return { objects: page.map((name) => ({ name })), isTruncated, nextMarker: isTruncated ? page[page.length - 1] : null };
    },
    async deleteMulti(names) {
      calls.push({ op: 'deleteMulti', names });
      names.forEach((n) => objects.delete(n));
      return {};
    },
    signatureUrl(name, options) {
      calls.push({ op: 'sign', name, options });
      return `https://signed.example/${name}?expires=${options.expires}${options.process ? `&process=${options.process}` : ''}`;
    },
  };
}

function jpeg(size = 1024) {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf;
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 开始执行 AliyunOssStorageAdapter 测试...');
  console.log('================================================================');

  const fake = createFakeOssClient();
  const adapter = new AliyunOssStorageAdapter(undefined, { write: fake, sign: fake });

  console.log('\n▶ [Case 1] 写入：私有 ACL、正确 Content-Type、返回 /uploads/<key> 以兼容 key 还原');
  const res = await adapter.write('/photos/campus-a/sch-1/20261102/abc.jpg', jpeg());
  assert.strictEqual(res.relativePath, 'photos/campus-a/sch-1/20261102/abc.jpg');
  assert.strictEqual(res.url, '/uploads/photos/campus-a/sch-1/20261102/abc.jpg');
  const put = fake.calls.find((c) => c.op === 'put');
  assert.strictEqual(put.options.mime, 'image/jpeg');
  assert.strictEqual(put.options.headers['x-oss-object-acl'], 'private');
  console.log('  ✔ 通过');

  console.log('\n▶ [Case 2] exists：404 返回 false，其它错误向上抛出');
  assert.strictEqual(await adapter.exists('photos/campus-a/sch-1/20261102/abc.jpg'), true);
  assert.strictEqual(await adapter.exists('photos/none.jpg'), false);
  const broken = new AliyunOssStorageAdapter(undefined, {
    write: { ...fake, head: async () => { const e = new Error('AccessDenied'); e.status = 403; throw e; } },
    sign: fake,
  });
  await assert.rejects(() => broken.exists('x.jpg'), /AccessDenied/);
  console.log('  ✔ 通过');

  console.log('\n▶ [Case 3] 签名链接：原图无处理参数，缩略图使用图片缩放 / 视频截帧');
  const original = adapter.signedUrl('photos/a.jpg', { expiresInSeconds: 3600 });
  assert(!original.includes('process='), '原图不应携带处理参数');
  assert(adapter.signedUrl('photos/a.jpg', { variant: 'thumb' }).includes('process=image/resize'));
  assert(adapter.signedUrl('videos/a.mp4', { variant: 'thumb' }).includes('process=video/snapshot'));
  assert(adapter.signedUrl('/videos/a.mp4').includes('expires=3600'), '默认有效期 3600 秒');
  console.log('  ✔ 通过');

  console.log('\n▶ [Case 4] deleteByPrefix：分页批量删除，空前缀拒绝执行');
  for (let i = 0; i < 5; i++) await adapter.write(`photos/campus-a/sch-9/2026/${i}.jpg`, jpeg());
  await adapter.write('photos/campus-a/sch-10/2026/keep.jpg', jpeg());
  const deleted = await adapter.deleteByPrefix('photos/campus-a/sch-9/');
  assert.strictEqual(deleted, 5);
  assert.strictEqual(await adapter.exists('photos/campus-a/sch-10/2026/keep.jpg'), true);
  assert.strictEqual(await adapter.deleteByPrefix('/'), 0, '空前缀不得删除整个 Bucket');
  console.log('  ✔ 通过');

  console.log('\n▶ [Case 5] 与 MediaUploadCoordinator 集成：秒传去重不重复上传');
  const coordinator = new MediaUploadCoordinator(adapter);
  const file = { originalname: 'class.jpg', buffer: jpeg(2048), mimetype: 'image/jpeg' };
  const first = await coordinator.uploadClassroomPhotos({ files: [file], campusId: 'campus-a', scheduleEventId: 'sch-2' });
  const putsBefore = fake.calls.filter((c) => c.op === 'put').length;
  const second = await coordinator.uploadClassroomPhotos({ files: [file], campusId: 'campus-a', scheduleEventId: 'sch-2' });
  assert.strictEqual(fake.calls.filter((c) => c.op === 'put').length, putsBefore, '重复内容不应再次上传');
  assert.strictEqual(first.items[0].key, second.items[0].key);
  console.log('  ✔ 通过');

  console.log('\n▶ [Case 6] 真实 SDK 本地签名：自定义域名 + HTTPS + 过期时间');
  const real = new AliyunOssStorageAdapter({
    region: 'oss-cn-hangzhou',
    bucket: 'demo-bucket',
    accessKeyId: 'TEST_AK_ID',
    accessKeySecret: 'TEST_AK_SECRET',
    customDomain: 'media.example.com',
  });
  const signed = new URL(real.signedUrl('photos/a b.jpg', { variant: 'thumb', expiresInSeconds: 600 }));
  assert.strictEqual(signed.protocol, 'https:');
  assert.strictEqual(signed.host, 'media.example.com');
  assert(signed.searchParams.get('Signature'), '必须带签名');
  assert(signed.searchParams.get('x-oss-process').startsWith('image/resize'));
  const expires = Number(signed.searchParams.get('Expires'));
  const now = Math.floor(Date.now() / 1000);
  assert(expires > now + 590 && expires <= now + 601, '过期时间应为 600 秒');
  const defaultDomain = new URL(new AliyunOssStorageAdapter({
    region: 'oss-cn-hangzhou', bucket: 'demo-bucket', accessKeyId: 'a', accessKeySecret: 'b', internal: true,
  }).signedUrl('videos/x.mp4'));
  assert.strictEqual(defaultDomain.host, 'demo-bucket.oss-cn-hangzhou.aliyuncs.com', '签名链接不得使用内网域名');
  console.log('  ✔ 通过');

  console.log('\n▶ [Case 7] 环境变量校验：缺项时报出具体变量名');
  assert.throws(() => readAliyunOssConfigFromEnv({ OSS_REGION: 'oss-cn-hangzhou' }), /OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET/);
  const cfg = readAliyunOssConfigFromEnv({
    OSS_REGION: ' oss-cn-hangzhou ', OSS_BUCKET: 'b', OSS_ACCESS_KEY_ID: 'i', OSS_ACCESS_KEY_SECRET: 's', OSS_INTERNAL: 'true',
  });
  assert.strictEqual(cfg.region, 'oss-cn-hangzhou');
  assert.strictEqual(cfg.internal, true);
  assert.strictEqual(cfg.customDomain, undefined);
  console.log('  ✔ 通过');

  console.log('\n🎉 AliyunOssStorageAdapter 全部 7 项测试通过！\n');
}

runTests().catch((err) => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
