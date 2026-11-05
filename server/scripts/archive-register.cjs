#!/usr/bin/env node
/**
 * 学员历史成长档案：把 archive-upload.cjs 生成的清单写入数据库 (可重复执行)
 * 清单里的每个学员必须按「学号 + 姓名」唯一对上系统学员，否则整批不写入。
 *
 * 运行：cd server && node scripts/archive-register.cjs --manifest <清单.json> [--batch 批次名] [--dry-run]
 */
const fs = require('fs');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 校验清单并按学号分组；任何一条不合规都抛错，避免把别人的照片挂到错误的孩子名下 */
function resolveManifest(manifest, students) {
  const byNo = new Map(students.map((s) => [s.studentNo, s]));
  const keys = new Set();
  const problems = [];
  const rows = [];
  for (const item of manifest) {
    const student = byNo.get(item.studentNo);
    if (!student) problems.push(`学号不存在: ${item.studentNo}`);
    else if (student.name.trim() !== item.name.trim()) problems.push(`姓名不符: ${item.studentNo}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) problems.push(`日期不合法: ${item.key}`);
    if (!['photo', 'video'].includes(item.type)) problems.push(`类型不合法: ${item.key}`);
    if (!/^archive\/[\w\-./]+$/.test(item.key) || item.key.includes('..')) problems.push(`key 不合法: ${item.key}`);
    if (keys.has(item.key)) problems.push(`key 重复: ${item.key}`);
    keys.add(item.key);
    if (student) rows.push({ studentId: student.id, lessonDate: item.date, type: item.type, storageKey: item.key, sizeBytes: item.size || 0, sortOrder: item.sortOrder || 0 });
  }
  return { rows, problems: [...new Set(problems)] };
}

async function main() {
  const manifestPath = arg('manifest');
  if (!manifestPath) throw new Error('用法: --manifest <清单.json> [--batch 批次名] [--dry-run]');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const nos = [...new Set(manifest.map((m) => m.studentNo))];
    const students = await prisma.student.findMany({ where: { studentNo: { in: nos } }, select: { id: true, studentNo: true, name: true } });
    const { rows, problems } = resolveManifest(manifest, students);
    if (problems.length) {
      problems.slice(0, 20).forEach((p) => console.error(`  ${p}`));
      throw new Error(`清单校验失败 (${problems.length} 项)，未写入任何数据`);
    }
    const existing = new Set(
      (await prisma.studentArchiveMedia.findMany({ where: { storageKey: { in: rows.map((r) => r.storageKey) } }, select: { storageKey: true } })).map((r) => r.storageKey),
    );
    const fresh = rows.filter((r) => !existing.has(r.storageKey));
    console.log(`清单 ${rows.length} 条，涉及 ${students.length} 名学员；已存在 ${existing.size}，待写入 ${fresh.length}`);
    if (process.argv.includes('--dry-run')) return;
    const batch = arg('batch') || null;
    await prisma.$transaction(fresh.map((r) => prisma.studentArchiveMedia.create({ data: { ...r, importBatch: batch } })));
    console.log(`已写入 ${fresh.length} 条`);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { resolveManifest };
if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
