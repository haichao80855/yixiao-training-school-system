// 独立核对：列出 courseware/ 下全部对象，与清单逐个比对大小和 sha256 元数据
const fs = require('fs');
const OSS = require('/opt/yixiao/server/node_modules/ali-oss');
const env = Object.fromEntries(fs.readFileSync('/opt/yixiao/server/.env', 'utf8').split('\n')
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '').trim()]; }));
const c = new OSS({ region: env.OSS_REGION, bucket: env.OSS_BUCKET, accessKeyId: env.OSS_ACCESS_KEY_ID,
  accessKeySecret: env.OSS_ACCESS_KEY_SECRET, secure: true, internal: env.OSS_INTERNAL === 'true' });
const L = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean); const h = L[0].split('\t');
const rows = L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [h[i], v])));
(async () => {
  const listed = new Map(); let marker;
  do { const p = await c.list({ prefix: 'courseware/', marker, 'max-keys': 1000 }, {});
    (p.objects || []).forEach((o) => listed.set(o.name, o.size)); marker = p.isTruncated ? p.nextMarker : undefined; } while (marker);
  let bad = 0, bytes = 0;
  for (let i = 0; i < rows.length; i += 20) await Promise.all(rows.slice(i, i + 20).map(async (r) => {
    const hd = await c.head(r.oss_key).catch((e) => ({ err: e.status }));
    const okSize = String(listed.get(r.oss_key)) === r['字节'];
    const okSha = hd.meta && hd.meta.sha256 === r.sha256;
    if (!okSize || !okSha) { bad++; console.log('BAD', r.oss_key, listed.get(r.oss_key), r['字节'], hd.err || ''); } else bytes += Number(r['字节']);
  }));
  const extra = [...listed.keys()].filter((k) => !rows.some((r) => r.oss_key === k));
  console.log(JSON.stringify({ manifest: rows.length, listed: listed.size, bad, extra: extra.length, GB: (bytes / 1e9).toFixed(2) }));
})();
