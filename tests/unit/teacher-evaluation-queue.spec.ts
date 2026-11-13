import { describe, expect, it } from 'vitest'
import type { AttendanceStatus, WorkbenchStudent } from '@/api'
import {
  neighbours,
  nextPending,
  submitLabel,
  submitPlan,
  summarize,
} from '@/views/teacher/utils/evaluationQueue'

function stu(id: string, status: AttendanceStatus, pushed = false): WorkbenchStudent {
  return {
    studentId: id,
    studentNo: id,
    studentName: `学员${id}`,
    phone: '',
    remainingLessons: 10,
    isLowBalance: false,
    defaultStatus: 'present',
    defaultDeductLessons: 1,
    isRecorded: true,
    recordedStatus: status,
    isPublished: pushed,
    hasPersonalEvaluation: pushed,
  }
}

describe('老师端课评队列', () => {
  // 名单顺序：A 到课、B 请假、C 迟到、D 缺勤、E 到课
  const roster = () => [stu('A', 'present'), stu('B', 'leave'), stu('C', 'late'), stu('D', 'absent'), stu('E', 'present')]

  it('下一位跳过请假和缺勤，迟到算到课', () => {
    expect(nextPending(roster(), 'A')?.student.studentId).toBe('C')
    expect(nextPending(roster(), 'C')?.student.studentId).toBe('E')
  })

  it('后面没人时回到之前跳过的人，并标记为跳过', () => {
    const next = nextPending(roster(), 'E')
    expect(next?.student.studentId).toBe('A')
    expect(next?.isSkipped).toBe(true)
    expect(submitLabel(submitPlan(roster(), 'E'))).toBe('推送，回到跳过的 · 学员A')
  })

  it('已推送的学员不再进入下一位', () => {
    const list = roster()
    list[2] = stu('C', 'late', true)
    expect(nextPending(list, 'A')?.student.studentId).toBe('E')
  })

  it('当前是最后一位待写：按钮为「推送并完成」，并显示推送后的进度', () => {
    const list = [stu('A', 'present', true), stu('B', 'leave'), stu('C', 'late', true), stu('D', 'absent'), stu('E', 'present')]
    const plan = submitPlan(list, 'E')
    expect(plan).toEqual({ kind: 'finish', pushedAfter: 3, attended: 3 })
    expect(submitLabel(plan)).toBe('推送并完成（3/3）')
  })

  it('修改已推送的课评：按钮为「保存并更新」，仍告诉老师下一位待写', () => {
    const list = [stu('A', 'present', true), stu('C', 'late')]
    const plan = submitPlan(list, 'A')
    expect(submitLabel(plan)).toBe('保存并更新')
    expect(plan.kind === 'update' && plan.next?.student.studentId).toBe('C')
    expect(submitPlan([stu('A', 'present', true)], 'A')).toEqual({ kind: 'update', next: undefined })
  })

  it('左右切换只在到课 / 迟到学员之间，不循环', () => {
    const nav = neighbours(roster(), 'C')
    expect([nav.index, nav.total, nav.prev?.studentId, nav.next?.studentId]).toEqual([1, 3, 'A', 'E'])
    expect(neighbours(roster(), 'A').prev).toBeUndefined()
    expect(neighbours(roster(), 'E').next).toBeUndefined()
  })

  it('完成页统计：到课、已推送、请假、缺勤', () => {
    const list = roster()
    list[0] = stu('A', 'present', true)
    expect(summarize(list)).toEqual({ attended: 3, pushed: 1, leave: 1, absent: 1 })
  })

  it('未点名的学员按默认出勤计算', () => {
    const s = { ...stu('A', 'present'), isRecorded: false, recordedStatus: undefined, defaultStatus: 'leave' as const }
    expect(summarize([s, stu('B', 'present')]).attended).toBe(1)
    expect(nextPending([stu('B', 'present'), s], 'B')).toBeUndefined()
  })
})
