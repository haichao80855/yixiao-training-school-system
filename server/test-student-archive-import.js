/**
 * 学员历史档案导入脚本离线测试：目录扫描、key 生成、清单校验 (不连接 OSS 与数据库)
 * 运行方式：cd server && node test-student-archive-import.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanArchive, archiveKey } = require('./scripts/archive-upload.cjs');
const { resolveManifest } = require('./scripts/archive-register.cjs');

let passed = 0;
function check(cond, desc) {
  assert.ok(cond, `❌ ${desc}`);
  passed++;
  console.log(`  ✓ ${desc}`);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-test-'));
const touch = (rel) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'x');
};
touch('小明_S100001/2025-07-22/2025-07-22_照片_01.jpg');
touch('小明_S100001/2025-07-22/2025-07-22_照片_02.HEIC');
touch('小明_S100001/2025-07-22/2025-07-22_视频_01_210457792.mp4');
touch('小明_S100001/2025-07-22/.DS_Store');
touch('小明_S100001/2025-07-22/说明.txt');
touch('小明_S100001/未分类/a.jpg');
touch('小红_S100002/2025-07-23/a.jpg');
touch('杂项文件夹/2025-07-23/a.jpg');
touch('.DS_Store');

try {
  console.log('【1】目录扫描');
  const { entries, skipped } = scanArchive(root);
  const ming = entries.filter((e) => e.studentNo === 'S100001');
  check(entries.length === 4 && ming.length === 3, '识别 4 个媒体文件，隐藏文件不计入');
  check(ming.filter((e) => e.type === 'photo').length === 2 && ming.filter((e) => e.type === 'video').length === 1, '按扩展名区分照片与视频');
  const heic = ming.find((e) => e.convert);
  check(heic && heic.key.endsWith('.jpg'), 'HEIC 标记为需转换，key 以 .jpg 结尾');
  check(skipped.some((s) => s.endsWith('说明.txt')) && skipped.some((s) => s.includes('未分类')) && skipped.includes('杂项文件夹'), '无法识别的文件和文件夹被跳过并报告');
  check(entries.every((e) => /^archive\/S\d+\/\d{4}-\d{2}-\d{2}\/(photo|video)_[0-9a-f]{12}\.\w+$/.test(e.key)), 'key 只含 ASCII，不含学员姓名');
  check(scanArchive(root, new Set(['S100002'])).entries.length === 1, '--only 只处理指定学号');
  check(new Set(entries.map((e) => e.key)).size === entries.length, 'key 不重复');
  check(archiveKey('S1', '2025-01-01', 'photo', 'a.jpg', '.jpg') === archiveKey('S1', '2025-01-01', 'photo', 'a.jpg', '.jpg'), '同一文件重跑 key 不变 (支持断点续传)');

  console.log('\n【2】清单校验');
  const students = [{ id: 'id-1', studentNo: 'S100001', name: '小明 ' }];
  const item = { name: '小明', studentNo: 'S100001', date: '2025-07-22', type: 'photo', key: 'archive/S100001/2025-07-22/photo_a.jpg', size: 3, sortOrder: 1 };
  const ok = resolveManifest([item], students);
  check(ok.problems.length === 0 && ok.rows[0].studentId === 'id-1' && ok.rows[0].lessonDate === '2025-07-22', '学号与姓名对上时绑定学员 ID (姓名前后空格不影响)');
  check(resolveManifest([{ ...item, name: '小红' }], students).problems.some((p) => p.includes('姓名不符')), '学号对上但姓名不符时拒绝，避免挂到错误的孩子名下');
  check(resolveManifest([{ ...item, studentNo: 'S999999' }], students).problems.some((p) => p.includes('学号不存在')), '学号不存在时拒绝');
  check(resolveManifest([{ ...item, key: 'archive/../secret.jpg' }], students).problems.some((p) => p.includes('key 不合法')), '路径穿越 key 被拒绝');
  check(resolveManifest([item, item], students).problems.some((p) => p.includes('key 重复')), '清单内 key 重复被拒绝');
  check(resolveManifest([{ ...item, date: '2025-7-2' }], students).problems.some((p) => p.includes('日期不合法')), '日期格式错误被拒绝');

  console.log(`\n🎉 全部 ${passed} 项断言通过`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
