import { describe, expect, it } from 'vitest'
import { groupCoursePackages } from '@/utils/coursePackageGroups'
import { getStudentStatusLabel, getStudentStatusTagType, isStudentEnrolled, resolveStudentStatus } from '@/utils/studentStatus'
import type { StudentCoursePackage } from '@/types/student'

function pkg(p: Partial<StudentCoursePackage>): StudentCoursePackage {
  return {
    id: Math.random().toString(36).slice(2),
    courseId: 'c-scratch',
    courseName: 'Scratch 创意编程',
    totalLessons: 20,
    remainingLessons: 20,
    status: 'active',
    ...p,
  } as StudentCoursePackage
}

describe('coursePackageGroups：学员列表里同一门课的课包合并为一行', () => {
  it('续费产生的多个课包合并：课时相加、课包数计数 (回归：以前同一课程显示成多行)', () => {
    const groups = groupCoursePackages([
      pkg({ classId: 'k1', className: '周六班', totalLessons: 20, remainingLessons: 5 }),
      pkg({ classId: 'k1', className: '周六班', totalLessons: 30, remainingLessons: 30 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ courseName: 'Scratch 创意编程', totalLessons: 50, remainingLessons: 35, packageCount: 2, classNames: '周六班', hasUnassigned: false })
  })

  it('不同课程分成不同行', () => {
    const groups = groupCoursePackages([pkg({}), pkg({ courseId: 'c-python', courseName: 'Python' })])
    expect(groups.map((g) => g.courseName)).toEqual(['Scratch 创意编程', 'Python'])
  })

  it('全额退费的课包不显示', () => {
    const groups = groupCoursePackages([pkg({ status: 'refunded' }), pkg({ courseId: 'c-python', courseName: 'Python' })])
    expect(groups.map((g) => g.courseName)).toEqual(['Python'])
  })

  it('多个班用「、」连接，同一个班不重复；有课包没分班时标记待分班', () => {
    const groups = groupCoursePackages([
      pkg({ classId: 'k1', className: '周六班' }),
      pkg({ classId: 'k2', className: '周日班' }),
      pkg({ classId: 'k1', className: '周六班' }),
      pkg({ classId: undefined }),
    ])
    expect(groups[0].classNames).toBe('周六班、周日班')
    expect(groups[0].hasUnassigned).toBe(true)
  })

  it('合并后的状态取最「活跃」的那个：有一个在读就显示在读', () => {
    expect(groupCoursePackages([pkg({ status: 'completed' }), pkg({ status: 'active' })])[0].status).toBe('active')
    expect(groupCoursePackages([pkg({ status: 'completed' }), pkg({ status: 'frozen' })])[0].status).toBe('frozen')
  })

  it('课时缺失按 0 计，不会出现 NaN (回归：总课时为 0 的课包显示 NaN)', () => {
    const groups = groupCoursePackages([pkg({ totalLessons: undefined as any, remainingLessons: undefined as any }), pkg({ totalLessons: 10, remainingLessons: 4 })])
    expect(groups[0].totalLessons).toBe(10)
    expect(groups[0].remainingLessons).toBe(4)
    expect(Number.isNaN(groups[0].totalLessons)).toBe(false)
  })

  it('没有课包或传入空值时返回空列表', () => {
    expect(groupCoursePackages([])).toEqual([])
    expect(groupCoursePackages(undefined)).toEqual([])
  })
})

describe('studentStatus：学员在读状态显示口径', () => {
  it('档案正常但没有有效课包 = 未报读 (钱包充值不算报读)', () => {
    expect(resolveStudentStatus({ status: 'normal', coursePackages: [] })).toBe('not_enrolled')
    expect(getStudentStatusLabel({ status: 'normal', coursePackages: [] })).toBe('未报读')
    expect(getStudentStatusTagType({ status: 'normal', coursePackages: [] })).toBe('primary')
  })

  it('唯一课包全额退费后回到未报读', () => {
    expect(resolveStudentStatus({ status: 'in_class', coursePackages: [{ status: 'refunded' }] })).toBe('not_enrolled')
  })

  it('有有效课包显示正常在读', () => {
    const s = { status: 'in_class', coursePackages: [{ status: 'refunded' }, { status: 'active' }] }
    expect(resolveStudentStatus(s)).toBe('in_class')
    expect(getStudentStatusLabel(s)).toBe('正常在读')
    expect(getStudentStatusTagType(s)).toBe('success')
  })

  it('列表接口直接给 isEnrolled 时以它为准', () => {
    expect(isStudentEnrolled({ isEnrolled: false, coursePackages: [{ status: 'active' }] })).toBe(false)
    expect(isStudentEnrolled({ isEnrolled: true })).toBe(true)
  })

  it('停课、转校、流失等档案状态不受课包影响', () => {
    expect(getStudentStatusLabel({ status: 'suspended', coursePackages: [] })).toBe('停课休学')
    expect(getStudentStatusTagType({ status: 'suspended' })).toBe('warning')
    expect(getStudentStatusLabel({ status: 'transferred' })).toBe('已转校')
    expect(getStudentStatusLabel({ status: 'dropped_out' })).toBe('已结课流失')
    expect(getStudentStatusTagType({ status: 'dropped_out' })).toBe('danger')
  })

  it('没有状态字段时按正常档案处理', () => {
    expect(resolveStudentStatus({ coursePackages: [{ status: 'active' }] })).toBe('normal')
  })
})
