#!/usr/bin/env node
/**
 * 学员历史成长档案：扫描本地档案文件夹，上传到 OSS 并生成导入清单 (可重复执行，已传过的文件自动跳过)
 *
 * 目录结构：<根目录>/<姓名>_<学号>/<YYYY-MM-DD>/<文件>
 * 运行 (在 Mac 上，直连 OSS 公网)：
 *   cd server && node scripts/archive-upload.cjs --root <根目录> --manifest <清单.json> [--only S747209,S747210] [--dry-run]
 * 之后把清单交给 archive-register.cjs 在服务器上写入数据库。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const HEIC_EXT = new Set(['.heic', '.heif']);
const VIDEO_EXT = new Set(['.mp4', '.m4v', '.mov']);
const STUDENT_DIR = /^(.+)_(S\d+)$/;
const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;
const CONCURRENCY = 4;
const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

/** key 只含 ASCII 且不含姓名：学号 + 日期 + 类型 + 原文件名哈希，同一文件重跑时 key 不变 */
function archiveKey(studentNo, date, type, fileName, ext) {
  const hash = crypto.createHash('sha1').update(fileName).digest('hex').slice(0, 12);
  return `archive/${studentNo}/${date}/${type}_${hash}${ext}`;
}

/** 扫描档案目录，返回待上传条目与无法识别的路径 */
function scanArchive(root, only) {
  const entries = [];
  const skipped = [];
  for (const dir of fs.readdirSync(root).sort()) {
    const studentPath = path.join(root, dir);
    if (!fs.statSync(studentPath).isDirectory()) continue;
    const match = dir.match(STUDENT_DIR);
    if (!match) {
      skipped.push(dir);
      continue;
    }
    const [, name, studentNo] = match;
    if (only && !only.has(studentNo)) continue;
    for (const date of fs.readdirSync(studentPath).sort()) {
      const datePath = path.join(studentPath, date);
      if (!fs.statSync(datePath).isDirectory()) continue;
      if (!DATE_DIR.test(date)) {
        skipped.push(path.join(dir, date));
        continue;
      }
      let sortOrder = 0;
      for (const file of fs.readdirSync(datePath).sort()) {
        if (file.startsWith('.')) continue;
        const ext = path.extname(file).toLowerCase();
        const isHeic = HEIC_EXT.has(ext);
        const type = VIDEO_EXT.has(ext) ? 'video' : PHOTO_EXT.has(ext) || isHeic ? 'photo' : null;
        if (!type) {
          skipped.push(path.join(dir, date, file));
          continue;
        }
        const outExt = isHeic ? '.jpg' : ext === '.jpeg' ? '.jpg' : ext;
        entries.push({
          name: name.trim(),
          studentNo,
          date,
          type,
          sortOrder: sortOrder++,
          source: path.join(datePath, file),
          convert: isHeic,
          key: archiveKey(studentNo, date, type, file, outExt),
        });
      }
    }
  }
  return { entries, skipped };
}

function readEnvFile(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime' };

async function uploadOne(client, entry, tmpDir) {
  let file = entry.source;
  if (entry.convert) {
    file = path.join(tmpDir, `${path.basename(entry.key)}`);
    execFileSync('sips', ['-s', 'format', 'jpeg', entry.source, '--out', file], { stdio: 'ignore' });
  }
  const size = fs.statSync(file).size;
  try {
    const head = await client.head(entry.key);
    if (Number(head.res.headers['content-length']) === size) return { size, uploaded: false };
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  const headers = { 'Content-Type': CONTENT_TYPES[path.extname(entry.key)] || 'application/octet-stream' };
  if (size > MULTIPART_THRESHOLD) {
    await client.multipartUpload(entry.key, file, { headers, parallel: 3, partSize: 5 * 1024 * 1024, timeout: 300000 });
  } else {
    await client.put(entry.key, file, { headers, timeout: 120000 });
  }
  return { size, uploaded: true };
}

async function main() {
  const root = arg('root');
  const manifestPath = arg('manifest');
  if (!root || !manifestPath) throw new Error('用法: --root <目录> --manifest <清单.json> [--only 学号,学号] [--dry-run]');
  const only = arg('only') ? new Set(arg('only').split(',').map((s) => s.trim())) : null;
  const { entries, skipped } = scanArchive(root, only);
  const totalBytes = entries.reduce((sum, e) => sum + fs.statSync(e.source).size, 0);
  console.log(`待处理 ${entries.length} 个文件，共 ${(totalBytes / 1e9).toFixed(2)} GB；HEIC 转换 ${entries.filter((e) => e.convert).length} 个；跳过 ${skipped.length} 个`);
  skipped.forEach((s) => console.log(`  跳过: ${s}`));
  if (process.argv.includes('--dry-run')) return;

  const OSS = require('ali-oss');
  const env = readEnvFile(arg('env') || path.join(__dirname, '..', '.env'));
  // 从 Mac 上传走公网 endpoint，不使用服务器的内网配置；密钥只从 .env 读取，不输出
  const client = new OSS({
    region: env.OSS_REGION,
    bucket: env.OSS_BUCKET,
    accessKeyId: env.OSS_ACCESS_KEY_ID,
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
    secure: true,
    timeout: 300000,
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-heic-'));
  const manifest = [];
  const failed = [];
  let index = 0;
  let done = 0;
  let uploaded = 0;
  const worker = async () => {
    while (index < entries.length) {
      const entry = entries[index++];
      try {
        const { size, uploaded: didUpload } = await uploadOne(client, entry, tmpDir);
        if (didUpload) uploaded++;
        manifest.push({ name: entry.name, studentNo: entry.studentNo, date: entry.date, type: entry.type, key: entry.key, size, sortOrder: entry.sortOrder });
      } catch (err) {
        failed.push(`${path.relative(root, entry.source)}: ${err.code || err.message}`);
      }
      done++;
      if (done % 50 === 0 || done === entries.length) console.log(`进度 ${done}/${entries.length} (新上传 ${uploaded}，失败 ${failed.length})`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.rmSync(tmpDir, { recursive: true, force: true });

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`清单已写入 ${manifestPath}，共 ${manifest.length} 条`);
  if (failed.length) {
    failed.slice(0, 20).forEach((f) => console.error(`  失败: ${f}`));
    console.error(`有 ${failed.length} 个文件失败，请重新运行本脚本 (已成功的会跳过)`);
    process.exit(1);
  }
}

module.exports = { archiveKey, scanArchive };
if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
