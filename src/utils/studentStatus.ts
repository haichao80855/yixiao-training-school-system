/**
 * 学员在读状态展示口径（单一真值源）
 *
 * 档案状态 (student.status) 由报读 / 编班 / 异动流程推进；
 * 「未报读」是派生状态：档案正常 (normal / in_class) 但名下没有未全额退费的课包。
 * 钱包充值不产生课包，因此有余额但未报读的学员仍为「未报读」；
 * 唯一课包全额退费后，学员回到「未报读」。
 */
export type StudentDisplayStatus =
  | 'not_enrolled'
  | 'normal'
  | 'in_class'
  | 'suspended'
  | 'transferred'
  | 'dropped_out'

interface StatusSource {
  status?: string
  isEnrolled?: boolean
  coursePackages?: { status?: string }[]
}

export function isStudentEnrolled(s: StatusSource): boolean {
  // 列表接口返回 isEnrolled（不计全额退费课包）；画像接口返回全部课包，按同一口径判断
  if (typeof s.isEnrolled === 'boolean') return s.isEnrolled
  return (s.coursePackages || []).some((p) => p.status !== 'refunded')
}

export function resolveStudentStatus(s: StatusSource): StudentDisplayStatus {
  const status = (s.status || 'normal') as StudentDisplayStatus
  if ((status === 'normal' || status === 'in_class') && !isStudentEnrolled(s)) {
    return 'not_enrolled'
  }
  return status
}

export function getStudentStatusLabel(s: StatusSource): string {
  switch (resolveStudentStatus(s)) {
    case 'not_enrolled': return '未报读'
    case 'normal':
    case 'in_class':
      return '正常在读'
    case 'suspended': return '停课休学'
    case 'transferred': return '已转校'
    case 'dropped_out': return '已结课流失'
    default: return s.status || ''
  }
}

export function getStudentStatusTagType(s: StatusSource): 'success' | 'warning' | 'info' | 'danger' | 'primary' {
  switch (resolveStudentStatus(s)) {
    case 'not_enrolled': return 'primary'
    case 'normal':
    case 'in_class':
      return 'success'
    case 'suspended': return 'warning'
    case 'dropped_out': return 'danger'
    default: return 'info'
  }
}
