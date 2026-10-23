/**
 * 课次展示名：「班级名称-第N讲」
 * N 由服务端按班级未取消课次的 日期+开始时间 顺序派生（getSchedules 下发 lessonNumber），
 * Web 讲台与小程序讲台共用同一口径；无序号时退回班级名称。
 */
export function formatLessonLabel(lesson: { className?: string; lessonNumber?: number } | null | undefined): string {
  if (!lesson) return ''
  const name = lesson.className || ''
  return lesson.lessonNumber ? `${name}-第${lesson.lessonNumber}讲` : name
}
