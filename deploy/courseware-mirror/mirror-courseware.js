#!/usr/bin/env node
// 课件镜像：按清单从盛通原链接下载 -> 校验 sha256 -> 上传到自有 OSS (courseware/ 前缀)
// 用法: node mirror-courseware.js <backup-manifest.tsv> [并发=4]
// OSS 配置读取 /opt/yixiao/server/.env (与后端同一组 OSS_* 变量)，可重复运行：已存在且校验一致的对象会跳过。
const fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const { execFileSync } = require('child_process');
const OSS = require('/opt/yixiao/server/node_modules/ali-oss');

const env = Object.fromEntries(fs.readFileSync('/opt/yixiao/server/.env', 'utf8').split('\n')
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '').trim()]; }));
const client = new OSS({ region: env.OSS_REGION, bucket: env.OSS_BUCKET, accessKeyId: env.OSS_ACCESS_KEY_ID,
  accessKeySecret: env.OSS_ACCESS_KEY_SECRET, secure: true, internal: env.OSS_INTERNAL === 'true', timeout: 600000 });

const [manifest, conc = '4'] = process.argv.slice(2);
const lines = fs.readFileSync(manifest, 'utf8').split('\n').filter(Boolean);
const hdr = lines[0].split('\t');
const rows = lines.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [hdr[i], v])));
// OSS 不允许在签名链接里改写 Content-Type，上传时按本地文件扩展名写对 (部分盛通 PDF 的路径没有扩展名)
const MIME = { pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint',
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip: 'application/zip' };
const mimeOf = (r) => MIME[((r['本地路径'] || r.oss_key).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase()] || 'application/octet-stream';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-'));
const report = path.join(path.dirname(path.resolve(manifest)), 'mirror-report.tsv');
fs.writeFileSync(report, 'oss_key\t结果\t说明\n');
const log = (r, res, note = '') => fs.appendFileSync(report, `${r.oss_key}\t${res}\t${note}\n`);

function sha256File(p) {
  return new Promise((ok, no) => { const h = crypto.createHash('sha256');
    fs.createReadStream(p).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', no); });
}
async function already(r) {
  try { const h = await client.head(r.oss_key);
    return String(h.res.headers['content-length']) === r['字节'] && h.meta && h.meta.sha256 === r.sha256;
  } catch (e) { if (e.status === 404) return false; throw e; }
}
async function one(r) {
  if (await already(r)) return log(r, 'skip', '已存在且一致');
  const tmp = path.join(tmpDir, crypto.randomBytes(8).toString('hex'));
  try {
    execFileSync('curl', ['-sSfL', '--retry', '3', '--retry-all-errors', '-m', '1800', '-o', tmp, r['原链接']]);
    const sum = await sha256File(tmp);
    if (sum !== r.sha256) return log(r, 'MISMATCH', `盛通当前文件 sha256=${sum}，需从本地归档上传`);
    await client.multipartUpload(r.oss_key, tmp, { partSize: 16 * 1024 * 1024, parallel: 4, mime: mimeOf(r),
      meta: { sha256: r.sha256, source: 'shengtong' }, headers: { 'x-oss-storage-class': 'Standard' } });
    if (!(await already(r))) return log(r, 'FAIL', '上传后核对不一致');
    log(r, 'ok');
  } catch (e) { log(r, 'FAIL', String(e.message || e).slice(0, 200)); }
  finally { fs.rmSync(tmp, { force: true }); }
}
(async () => {
  let i = 0, done = 0; const n = Number(conc);
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < rows.length) { const r = rows[i++]; await one(r);
      if (++done % 25 === 0 || done === rows.length) console.log(`${new Date().toISOString()} ${done}/${rows.length}`); }
  }));
  fs.rmSync(tmpDir, { recursive: true, force: true });
  const out = fs.readFileSync(report, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')[1]);
  const c = {}; out.forEach((x) => (c[x] = (c[x] || 0) + 1)); console.log('完成', c, '报告:', report);
})();
