/**
 * 课评对家长可见的判定 (家长端 H5 / 成长报告分享页共用)。
 *
 * 课评聚合根 LessonEvaluation 一节课只有一条，它的 status 是整节课的状态：
 * 老师只给一位学员推送时，它同样会变成 published。所以「已发布」不能代表这位学员的家长可见。
 *
 * 推送给谁，以出站信箱 LessonEvaluationOutbox 为准：每次发布都会为本次推送的每位学员写一行
 * (家长未绑定微信时也会写一行 skipped_no_openid)。单人推送只写目标学员，全班发布写所有到课学员。
 * 因此：课评已发布，且曾向这位学员推送过 → 这位学员的家长可见。
 */

/** Prisma where：课评对该学员家长可见 (用在 evaluation 关系过滤上) */
export function parentVisibleEvaluationWhere(studentId: string) {
  return { status: 'published', outboxMessages: { some: { studentId } } };
}

/** Prisma include 片段：带出是否向该学员推送过，配合 isEvaluationVisibleToParent 使用 */
export function pushedToStudentInclude(studentId: string) {
  return { outboxMessages: { where: { studentId }, select: { id: true }, take: 1 } } as const;
}

export function isEvaluationVisibleToParent(
  evaluation: { status: string; outboxMessages?: unknown[] } | null | undefined,
): boolean {
  return evaluation?.status === 'published' && (evaluation.outboxMessages?.length ?? 0) > 0;
}
