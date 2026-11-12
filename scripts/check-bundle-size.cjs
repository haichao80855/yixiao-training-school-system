#!/usr/bin/env node
/**
 * 首屏体积检查：统计 dist/index.html 首屏要下载的 JS (入口 + modulepreload) 和 CSS 的 gzip 体积。
 * 超过上限时退出码为 1，CI 里用来防止首屏体积回涨 (见 AGENTS.md「Frontend Performance Conventions」)。
 *
 * 用法：npm run build && node scripts/check-bundle-size.cjs [--limit=187]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LIMIT_KB = Number((process.argv.find((a) => a.startsWith('--limit=')) || '--limit=187').split('=')[1]);
const dist = path.resolve(__dirname, '../dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const assets = new Set();
for (const m of html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) assets.add(m[1]);
for (const m of html.matchAll(/<link[^>]*rel="(?:modulepreload|stylesheet)"[^>]*href="([^"]+)"/g)) assets.add(m[1]);

let total = 0;
const rows = [];
for (const url of assets) {
  if (/^(https?:)?\/\//.test(url)) continue;
  const file = path.join(dist, url.replace(/^\//, ''));
  const gz = zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
  total += gz;
  rows.push([url, gz]);
}

for (const [url, gz] of rows.sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(gz / 1024).toFixed(1).padStart(7)} KB  ${url}`);
}
const totalKb = total / 1024;
console.log(`首屏 gzip 合计 ${totalKb.toFixed(1)} KB，上限 ${LIMIT_KB} KB`);
if (totalKb > LIMIT_KB) {
  console.error(`❌ 首屏体积超过上限 ${(totalKb - LIMIT_KB).toFixed(1)} KB。请检查是否把大依赖打进了首屏 (见 AGENTS.md)。`);
  process.exit(1);
}
console.log('✓ 首屏体积在上限之内');
