/**
 * 拓视未来教育「一校教培系统」
 * MediaUploadCoordinator & StorageEnginePort 专属架构与功能测试套件
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 导入编译后的模块
const { MediaUploadCoordinator } = require('./dist/modules/upload/domain/media-upload.coordinator');
const { MemoryMockStorageAdapter } = require('./dist/modules/upload/domain/adapters/memory-mock-storage.adapter');
const { LocalStorageEngineAdapter } = require('./dist/modules/upload/domain/adapters/local-storage-engine.adapter');

// 模拟二进制图像 Buffer 构造工具
function createMockJpegBuffer(sizeBytes = 1024) {
  const buf = Buffer.alloc(sizeBytes);
  // JPEG Magic Number: FF D8 FF E0
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf;
}

function createMockPngBuffer(sizeBytes = 1024) {
  const buf = Buffer.alloc(sizeBytes);
  // PNG Magic Number: 89 50 4E 47 0D 0A 1A 0A
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  return buf;
}

function createMockWebpBuffer(sizeBytes = 1024) {
  const buf = Buffer.alloc(sizeBytes);
  // WEBP Magic Number: RIFF .... WEBP
  buf[0] = 0x52; // 'R'
  buf[1] = 0x49; // 'I'
  buf[2] = 0x46; // 'F'
  buf[3] = 0x46; // 'F'
  buf[8] = 0x57; // 'W'
  buf[9] = 0x45; // 'E'
  buf[10] = 0x42; // 'B'
  buf[11] = 0x50; // 'P'
  return buf;
}

function createMockMp4Buffer(sizeBytes = 1024) {
  const buf = Buffer.alloc(sizeBytes);
  // MP4 box: offset 4 is 'ftyp'
  buf.writeUInt32BE(0x00000020, 0);
  buf.write('ftyp', 4, 4, 'ascii');
  buf.write('isom', 8, 4, 'ascii');
  return buf;
}

function createMockWebmBuffer(sizeBytes = 1024) {
  const buf = Buffer.alloc(sizeBytes);
  // WebM: 1A 45 DF A3
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;
  return buf;
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 开始执行 MediaUploadCoordinator 随堂照片上传深度模块测试套件');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: MemoryMockStorageAdapter 基础契约 (0 I/O)
  // -------------------------------------------------------------
  console.log('▶ [Case 1] 验证 MemoryMockStorageAdapter 内存桩存储契约 (0 磁盘 I/O)...');
  const mockStorage = new MemoryMockStorageAdapter('/uploads/');
  const writeRes = await mockStorage.write('photos/campus-test/sch-01/20261014/test.jpg', createMockJpegBuffer(200));
  assert.strictEqual(writeRes.url, '/uploads/photos/campus-test/sch-01/20261014/test.jpg');
  assert.strictEqual(await mockStorage.exists('photos/campus-test/sch-01/20261014/test.jpg'), true);
  assert.strictEqual(await mockStorage.exists('photos/campus-test/sch-01/20261014/non_exist.jpg'), false);
  console.log('  ✔ MemoryMockStorageAdapter 读写与存在性检查验证通过！');

  // -------------------------------------------------------------
  // Test 2: 二进制魔数真实格式嗅探 (Sniffing) 与防脚本伪造
  // -------------------------------------------------------------
  console.log('\n▶ [Case 2] 验证二进制 Magic Number 真实格式嗅探与恶意脚本注入拦截...');
  const coordinator = new MediaUploadCoordinator(mockStorage);

  const jpegFmt = coordinator.sniffImageFormat(createMockJpegBuffer());
  assert.strictEqual(jpegFmt.ext, 'jpg');
  assert.strictEqual(jpegFmt.mime, 'image/jpeg');

  const pngFmt = coordinator.sniffImageFormat(createMockPngBuffer());
  assert.strictEqual(pngFmt.ext, 'png');
  assert.strictEqual(pngFmt.mime, 'image/png');

  const webpFmt = coordinator.sniffImageFormat(createMockWebpBuffer());
  assert.strictEqual(webpFmt.ext, 'webp');
  assert.strictEqual(webpFmt.mime, 'image/webp');

  // 伪装可执行脚本注入攻击测试
  const maliciousShellScript = Buffer.from('#!/bin/bash\necho "pwned"\n');
  const maliciousFmt = coordinator.sniffImageFormat(maliciousShellScript);
  assert.strictEqual(maliciousFmt, null, '伪装脚本必须被 Magic Number 拦截');
  console.log('  ✔ JPEG/PNG/WEBP 格式嗅探正确，恶意伪装脚本成功被拒之门外！');

  // -------------------------------------------------------------
  // Test 3: 多图并发批处理与课次自愈归档目录
  // -------------------------------------------------------------
  console.log('\n▶ [Case 3] 验证多选随堂实录照片并发批处理与课次归集...');
  const files = [
    {
      originalname: 'classroom_robot_1.jpg',
      buffer: createMockJpegBuffer(2048),
      mimetype: 'image/jpeg',
    },
    {
      originalname: 'classroom_board_2.png',
      buffer: createMockPngBuffer(4096),
      mimetype: 'image/png',
    },
    {
      originalname: 'classroom_code_3.webp',
      buffer: createMockWebpBuffer(1024),
      mimetype: 'image/webp',
    },
  ];

  const batchResult = await coordinator.uploadClassroomPhotos({
    files,
    campusId: 'campus-bj-hq',
    scheduleEventId: 'sch-event-9988',
  });

  assert.strictEqual(batchResult.successCount, 3);
  assert.strictEqual(batchResult.failureCount, 0);
  assert.strictEqual(batchResult.persistedUrls.length, 3);
  assert.strictEqual(batchResult.items.length, 3);

  // 验证路径包含校区与排课日程
  batchResult.persistedUrls.forEach((url) => {
    assert(url.includes('/uploads/photos/campus-bj-hq/sch-event-9988/'), `URL 应包含课次路径: ${url}`);
  });

  // 验证缩略图 URL 组装
  batchResult.items.forEach((item) => {
    assert(item.thumbnailUrl.includes('w=300&h=300'), `缩略图必须具备 300x300 规格: ${item.thumbnailUrl}`);
  });
  console.log(`  ✔ 批量处理 3 张实录照片全部成功落盘，归集目录与 300x300 缩略图生成正确！`);

  // -------------------------------------------------------------
  // Test 4: SHA-256 内容寻址秒传去重 (Deduplication)
  // -------------------------------------------------------------
  console.log('\n▶ [Case 4] 验证 SHA-256 内容寻址秒传去重特性...');
  const duplicateFile = {
    originalname: 'classroom_robot_1_copy.jpg',
    buffer: files[0].buffer, // 相同 buffer
    mimetype: 'image/jpeg',
  };

  const dedupeResult = await coordinator.uploadClassroomPhotos({
    files: [duplicateFile],
    campusId: 'campus-bj-hq',
    scheduleEventId: 'sch-event-9988',
  });

  assert.strictEqual(dedupeResult.successCount, 1);
  assert.strictEqual(dedupeResult.persistedUrls[0], batchResult.persistedUrls[0], '相同内容必须返回相同 URL');
  assert.strictEqual(dedupeResult.items[0].sha256, batchResult.items[0].sha256);
  console.log('  ✔ 相同文件内容寻址秒传去重生效，未重复消耗磁盘空间！');

  // -------------------------------------------------------------
  // Test 5: 容错批处理流水线 (Promise.allSettled 容错与 10MB 门禁)
  // -------------------------------------------------------------
  console.log('\n▶ [Case 5] 验证 Promise.allSettled 容错批处理与 10MB 门禁拦截...');
  const mixedFiles = [
    {
      originalname: 'valid_pic.jpg',
      buffer: createMockJpegBuffer(1024),
    },
    {
      originalname: 'oversized_pic.jpg',
      buffer: Buffer.alloc(11 * 1024 * 1024), // 11MB 超标
    },
    {
      originalname: 'fake_virus.jpg',
      buffer: Buffer.from('echo "fake script"'), // 伪装成 jpg 的脚本
    },
  ];

  const tolerantResult = await coordinator.uploadClassroomPhotos({
    files: mixedFiles,
    campusId: 'campus-bj-hq',
    scheduleEventId: 'sch-event-mixed',
  });

  assert.strictEqual(tolerantResult.successCount, 1, '仅合法文件应上传成功');
  assert.strictEqual(tolerantResult.failureCount, 2, '超标及伪装文件应被跳过');
  assert.strictEqual(tolerantResult.errors.length, 2);
  assert(tolerantResult.errors.some((e) => e.filename === 'oversized_pic.jpg' && e.reason.includes('10MB')));
  assert(tolerantResult.errors.some((e) => e.filename === 'fake_virus.jpg' && e.reason.includes('格式非法')));
  console.log('  ✔ 批处理容错流水线正常工作：合法文件正常落盘，超标和恶意文件被安全捕获！');

  // -------------------------------------------------------------
  // Test 6: 反结课级联冲正清理接缝 (purgeSchedulePhotos)
  // -------------------------------------------------------------
  console.log('\n▶ [Case 6] 验证反结课级联照片清理接缝...');
  const purgeRes = await coordinator.purgeSchedulePhotos('sch-event-9988', 'campus-bj-hq');
  assert(purgeRes.deletedCount >= 3, `应清理 sch-event-9988 下的照片，实际清理: ${purgeRes.deletedCount}`);
  console.log(`  ✔ 反结课级联冲正成功清理关联物理照片 ${purgeRes.deletedCount} 张！`);

  // -------------------------------------------------------------
  // Test 7: LocalStorageEngineAdapter 物理文件落盘验证
  // -------------------------------------------------------------
  console.log('\n▶ [Case 7] 验证生产 LocalStorageEngineAdapter 本地物理文件落盘与存在性...');
  const tmpUploadDir = path.join(__dirname, 'tmp-test-uploads');
  const localAdapter = new LocalStorageEngineAdapter(tmpUploadDir, '/uploads/');
  const localWriteRes = await localAdapter.write('photos/test-campus/test.jpg', createMockJpegBuffer(512));

  assert.strictEqual(localWriteRes.url, '/uploads/photos/test-campus/test.jpg');
  assert(fs.existsSync(localWriteRes.absolutePath), '物理磁盘上必须生成实际文件');
  assert.strictEqual(await localAdapter.exists('photos/test-campus/test.jpg'), true);

  // 清理临时测试目录
  await localAdapter.deleteByPrefix('photos/test-campus');
  assert.strictEqual(await localAdapter.exists('photos/test-campus/test.jpg'), false);
  fs.rmSync(tmpUploadDir, { recursive: true, force: true });
  console.log('  ✔ LocalStorageEngineAdapter 本地磁盘读写、存在性与前缀清理完全正常！');

  // -------------------------------------------------------------
  // Test 8: 视频二进制 Magic Number 格式嗅探与恶意脚本拦截
  // -------------------------------------------------------------
  console.log('\n▶ [Case 8] 验证课堂实操视频 Magic Number 嗅探与格式拦截...');
  const mp4Fmt = coordinator.sniffVideoFormat(createMockMp4Buffer());
  assert.strictEqual(mp4Fmt.ext, 'mp4');
  assert.strictEqual(mp4Fmt.mime, 'video/mp4');

  const webmFmt = coordinator.sniffVideoFormat(createMockWebmBuffer());
  assert.strictEqual(webmFmt.ext, 'webm');
  assert.strictEqual(webmFmt.mime, 'video/webm');

  // 伪造视频脚本
  const fakeVideoScript = Buffer.from('#!/usr/bin/env python3\nprint("malicious")\n');
  const fakeVideoFmt = coordinator.sniffVideoFormat(fakeVideoScript);
  assert.strictEqual(fakeVideoFmt, null, '伪造视频脚本必须被 Magic Number 拦截');
  console.log('  ✔ MP4/WebM 格式嗅探正确，伪造可执行脚本被拦截拒收！');

  // -------------------------------------------------------------
  // Test 9: 课堂视频真实上传、课次归集与 SHA-256 秒传去重
  // -------------------------------------------------------------
  console.log('\n▶ [Case 9] 验证课堂视频真实上传、自愈路径归集与秒传去重...');
  const validVideoFile = {
    originalname: 'robot_car_demo.mp4',
    buffer: createMockMp4Buffer(1024 * 50), // 50KB MP4
    mimetype: 'video/mp4',
  };

  const videoUploadRes = await coordinator.uploadClassroomVideo({
    file: validVideoFile,
    campusId: 'campus-bj-hq',
    scheduleEventId: 'sch-event-robot-01',
  });

  assert(videoUploadRes.videoUrl.includes('/uploads/videos/campus-bj-hq/sch-event-robot-01/'), '视频路径必须归集到校区与课次目录');
  assert.strictEqual(videoUploadRes.mimeType, 'video/mp4');
  assert.strictEqual(typeof videoUploadRes.sha256, 'string');

  // 再次上传相同视频 -> 秒传去重返回同一 URL
  const duplicateVideoRes = await coordinator.uploadClassroomVideo({
    file: validVideoFile,
    campusId: 'campus-bj-hq',
    scheduleEventId: 'sch-event-robot-01',
  });
  assert.strictEqual(duplicateVideoRes.videoUrl, videoUploadRes.videoUrl, '相同视频内容必须触发秒传去重');
  console.log('  ✔ 课堂视频真实落盘归集成功，SHA-256 秒传去重有效！');

  // -------------------------------------------------------------
  // Test 10: 课堂视频 100MB 体积门禁拦截
  // -------------------------------------------------------------
  console.log('\n▶ [Case 10] 验证课堂视频 100MB 体积上限硬门禁...');
  let sizeLimitCaught = false;
  try {
    await coordinator.uploadClassroomVideo({
      file: {
        originalname: 'huge_lesson.mp4',
        buffer: Buffer.alloc(101 * 1024 * 1024), // 101MB
        mimetype: 'video/mp4',
      },
      campusId: 'campus-bj-hq',
    });
  } catch (err) {
    sizeLimitCaught = true;
    assert(err.message.includes('100MB'), '异常信息应指出超出 100MB 限制');
  }
  assert.strictEqual(sizeLimitCaught, true, '超 100MB 视频必须被拦截');
  console.log('  ✔ 超 100MB 视频文件被安全拦截！');

  console.log('\n================================================================');
  console.log('🎉 恭喜！MediaUploadCoordinator 全部 10 项架构与核心功能测试 100% 绿色通过！');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
