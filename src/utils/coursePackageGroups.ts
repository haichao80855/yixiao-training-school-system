import type { StudentCoursePackage } from '@/types/student'

/** 学员列表里同一门课的课包合并为一行 (续费会产生多个课包) */
export interface CoursePackageGroup {
  key: string
  courseName: string
  /** 所在班级，多个班用「、」连接；全部未分班时为空 */
  classNames: string
  /** 有课包还没分班 */
  hasUnassigned: boolean
  remainingLessons: number
  totalLessons: number
  packageCount: number
  status: StudentCoursePackage['status']
}

const STATUS_RANK: Record<string, number> = { active: 0, frozen: 1, completed: 2, refunded: 3 }

export function groupCoursePackages(packages: StudentCoursePackage[] | undefined): CoursePackageGroup[] {
  const groups = new Map<string, CoursePackageGroup & { classSet: Set<string> }>()
  for (const p of packages || []) {
    if (p.status === 'refunded') continue
    const key = p.courseId || p.courseName
    let g = groups.get(key)
    if (!g) {
      g = {
        key,
        courseName: p.courseName,
        classNames: '',
        classSet: new Set<string>(),
        hasUnassigned: false,
        remainingLessons: 0,
        totalLessons: 0,
        packageCount: 0,
        status: p.status,
      }
      groups.set(key, g)
    }
    if (p.classId) g.classSet.add(p.className || '已分班')
    else g.hasUnassigned = true
    g.remainingLessons += p.remainingLessons || 0
    g.totalLessons += p.totalLessons || 0
    g.packageCount += 1
    if ((STATUS_RANK[p.status] ?? 9) < (STATUS_RANK[g.status] ?? 9)) g.status = p.status
  }
  return Array.from(groups.values()).map(({ classSet, ...g }) => ({
    ...g,
    classNames: Array.from(classSet).join('、'),
  }))
}
