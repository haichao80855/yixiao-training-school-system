export interface EvaluationRosterStudent {
  studentId: string
  attendanceStatus: string
  deductLessons: number
  isEvaluated: boolean
  rating: number
  comment: string
  performanceTag: string
  photos: string[]
  videoUrl: string
}

const DEFAULT_RATING = 5

/**
 * 组装保存课评时单个学员的提交内容。
 * 老师没有动过的学员只同步出勤：带上默认评分会让服务端为其新建没有内容的课评条目。
 */
export function buildEvaluationOverride(s: EvaluationRosterStudent) {
  const attendance = {
    studentId: s.studentId,
    attendanceStatus: s.attendanceStatus,
    deductLessons: s.deductLessons,
  }
  const hasContent = Boolean(s.comment || s.photos.length > 0 || s.videoUrl)
  if (!hasContent && !s.isEvaluated && !s.performanceTag && s.rating === DEFAULT_RATING) {
    return attendance
  }
  return {
    ...attendance,
    personalizedComment: s.comment,
    rating: s.rating,
    performanceTag: s.performanceTag,
    photos: s.photos,
    videoUrl: s.videoUrl,
    isEvaluated: s.isEvaluated || hasContent,
  }
}
