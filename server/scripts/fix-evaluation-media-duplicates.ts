/**
 * 修复历史课评数据：学员专属照片 / 视频 / 评语被同时写入课次公共字段的问题
 *
 * 成因：Web 端课评弹窗与小程序单学员课评提交时，把「当前选中学员」的照片、视频、评语
 * 同时作为课次公共 photoList / videoUrl / teacherComment 提交。结果：
 *   - 该学员家长端同一张照片 / 同一个视频 / 同一段评语显示两次 (专属 + 课堂记录)；
 *   - 同班其他学员的家长会在「课堂记录」里看到这位学员的个人照片与评语。
 *
 * 本脚本找出公共字段内容完全来自某一位学员专属内容的课评并清空对应公共字段；
 * 同时列出同一学员同一课次存在多条有效考勤的记录 (仅报告，不自动删除，涉及课时账务)。
 *
 * 运行：
 *   npx ts-node scripts/fix-evaluation-media-duplicates.ts          # 仅预览
 *   npx ts-node scripts/fix-evaluation-media-duplicates.ts --apply  # 写入
 */
import { PrismaClient } from '@prisma/client';
import { parseMediaList, toStorageKey } from '../src/modules/upload/domain/media-key.util';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const evaluations = await prisma.lessonEvaluation.findMany({ include: { studentItems: true } });
  let fixed = 0;

  for (const ev of evaluations) {
    const classPhotoKeys = parseMediaList(ev.photoList).map(toStorageKey);
    const classVideoKey = ev.videoUrl ? toStorageKey(ev.videoUrl) : null;
    const data: { photoList?: string; videoUrl?: null; teacherComment?: string } = {};
    const reasons: string[] = [];

    for (const item of ev.studentItems) {
      const ownKeys = new Set(parseMediaList(item.photos).map(toStorageKey));
      if (classPhotoKeys.length > 0 && classPhotoKeys.every((k) => ownKeys.has(k))) {
        data.photoList = '[]';
        reasons.push(`班级照片与学员 ${item.studentId} 的专属照片相同`);
      }
      if (classVideoKey && item.videoUrl && toStorageKey(item.videoUrl) === classVideoKey) {
        data.videoUrl = null;
        reasons.push(`班级视频与学员 ${item.studentId} 的专属视频相同`);
      }
      if (ev.teacherComment && item.comment && ev.teacherComment.trim() === item.comment.trim() && ev.studentItems.length > 1) {
        // 多名学员的课次里，公共评语等于某一位学员的专属评语 → 是被误写入的个人评语
        data.teacherComment = '';
        reasons.push(`课堂评语与学员 ${item.studentId} 的专属评语相同`);
      }
    }

    if (Object.keys(data).length > 0) {
      fixed++;
      console.log(`- 课评 ${ev.id} (课次 ${ev.scheduleEventId})：${[...new Set(reasons)].join('；')}`);
      if (APPLY) await prisma.lessonEvaluation.update({ where: { id: ev.id }, data });
    }
  }
  console.log(`\n${APPLY ? '已修复' : '待修复 (预览)'} ${fixed} / ${evaluations.length} 条课评。${APPLY ? '' : '确认无误后加 --apply 执行。'}`);

  // 重复考勤报告
  const groups = await prisma.attendanceRecord.groupBy({
    by: ['scheduleEventId', 'studentId'],
    where: { isReversed: false },
    _count: { _all: true },
  });
  const duplicates = groups.filter((g) => g._count._all > 1);
  if (duplicates.length) {
    console.log(`\n⚠️  ${duplicates.length} 组「同一学员同一课次」存在多条有效考勤 (需教务核对课时后在 Web 端反结课处理)：`);
    for (const d of duplicates) {
      const rows = await prisma.attendanceRecord.findMany({
        where: { scheduleEventId: d.scheduleEventId, studentId: d.studentId, isReversed: false },
        select: { id: true, status: true, deductLessons: true, packageId: true, operator: true, createdAt: true },
      });
      console.log(`   课次 ${d.scheduleEventId} / 学员 ${d.studentId}:`, JSON.stringify(rows));
    }
  } else {
    console.log('\n未发现重复的有效考勤记录。');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
