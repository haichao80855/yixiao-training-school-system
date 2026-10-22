/**
 * 家长端上线前的一次性数据回填 (可重复执行)
 *  1. Student.phoneNormalized ← 规范化 Student.phone，并列出无法识别的手机号供教务修正
 *  2. Student.leftAt ← 已转校 / 已流失但缺少离校时间的学员，以 updatedAt 近似
 *  3. 媒体地址 → 存储 key：去掉 http(s)://host 与 /uploads/ 前缀
 *
 * 运行：cd server && npx ts-node scripts/backfill-parent-portal.ts
 */
import { PrismaClient } from '@prisma/client';
import { normalizeCnMobile } from '../src/common/phone.util';
import { toStorageKey } from '../src/modules/upload/domain/media-key.util';

const prisma = new PrismaClient();

function keysInJsonList(raw: string | null): string | null {
  if (!raw) return raw;
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return raw;
    return JSON.stringify(list.map((u: unknown) => (typeof u === 'string' ? toStorageKey(u) : u)));
  } catch {
    return raw;
  }
}

async function main() {
  // 1 + 2. 学员
  const students = await prisma.student.findMany({
    select: { id: true, studentNo: true, name: true, phone: true, status: true, leftAt: true, updatedAt: true },
  });
  const invalid: string[] = [];
  for (const s of students) {
    const normalized = normalizeCnMobile(s.phone);
    if (!normalized) invalid.push(`${s.studentNo} ${s.name}: "${s.phone}"`);
    const needsLeftAt = ['transferred', 'dropped_out'].includes(s.status) && !s.leftAt;
    await prisma.student.update({
      where: { id: s.id },
      data: {
        phoneNormalized: normalized,
        ...(needsLeftAt ? { leftAt: s.updatedAt } : {}),
      },
    });
  }
  console.log(`学员 ${students.length} 名已回填规范化手机号。`);
  if (invalid.length) {
    console.log(`\n⚠️  ${invalid.length} 名学员的家长手机号无法识别，家长将无法登录，请在 Web 端修正：`);
    invalid.forEach((line) => console.log(`   - ${line}`));
  }

  // 3. 媒体地址
  const evaluations = await prisma.lessonEvaluation.findMany({
    select: { id: true, photoList: true, videoUrl: true, voiceUrl: true },
  });
  for (const e of evaluations) {
    await prisma.lessonEvaluation.update({
      where: { id: e.id },
      data: {
        photoList: keysInJsonList(e.photoList) ?? '[]',
        videoUrl: e.videoUrl ? toStorageKey(e.videoUrl) : e.videoUrl,
        voiceUrl: e.voiceUrl ? toStorageKey(e.voiceUrl) : e.voiceUrl,
      },
    });
  }
  const items = await prisma.lessonEvaluationStudentItem.findMany({
    select: { id: true, photos: true, videoUrl: true },
  });
  for (const it of items) {
    await prisma.lessonEvaluationStudentItem.update({
      where: { id: it.id },
      data: {
        photos: keysInJsonList(it.photos),
        videoUrl: it.videoUrl ? toStorageKey(it.videoUrl) : it.videoUrl,
      },
    });
  }
  console.log(`课评媒体地址已转换为存储 key：${evaluations.length} 条课评，${items.length} 条学员课评。`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
