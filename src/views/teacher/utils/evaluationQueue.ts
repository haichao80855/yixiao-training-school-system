import type { AttendanceStatus, WorkbenchStudent } from '@/api';
import { isAttended } from './format';

/**
 * 一节课的课评队列：老师写完一位直接进入下一位。
 * - 只有到课 / 迟到的学员需要课评：家长端只给到课学员显示课评，请假、缺勤写了家长也看不到。
 * - 顺序与课次页点名名单一致。
 * - 「已推送」以老师对该学员写过并发布的专属课评为准 (与课次页一致)。
 */

export function attendanceOf(s: WorkbenchStudent): AttendanceStatus {
  return s.recordedStatus || s.defaultStatus;
}

export function isPushed(s: WorkbenchStudent): boolean {
  return Boolean(s.isPublished && s.hasPersonalEvaluation);
}

export function needsEvaluation(s: WorkbenchStudent): boolean {
  return isAttended(attendanceOf(s));
}

/** 可以在写课评页之间切换的学员：到课 / 迟到 (含已推送的，便于回头修改) */
export function evaluableStudents(students: WorkbenchStudent[]): WorkbenchStudent[] {
  return students.filter(needsEvaluation);
}

/** 当前学员在可切换名单中的前一位 / 后一位 (不循环) */
export function neighbours(students: WorkbenchStudent[], currentId: string) {
  const list = evaluableStudents(students);
  const index = list.findIndex((s) => s.studentId === currentId);
  return {
    index,
    total: list.length,
    prev: index > 0 ? list[index - 1] : undefined,
    next: index >= 0 && index < list.length - 1 ? list[index + 1] : undefined,
  };
}

export interface NextPending {
  student: WorkbenchStudent;
  /** 名单里排在当前学员之前：是之前跳过的人 */
  isSkipped: boolean;
}

/** 当前学员之后第一位还没推送的到课学员；后面没有了就从名单开头找之前跳过的人 */
export function nextPending(students: WorkbenchStudent[], currentId: string): NextPending | undefined {
  const index = students.findIndex((s) => s.studentId === currentId);
  const pending = (s: WorkbenchStudent) => s.studentId !== currentId && needsEvaluation(s) && !isPushed(s);
  const after = students.slice(index + 1).find(pending);
  if (after) return { student: after, isSkipped: false };
  const before = students.slice(0, Math.max(index, 0)).find(pending);
  return before ? { student: before, isSkipped: true } : undefined;
}

export interface QueueSummary {
  attended: number;
  pushed: number;
  leave: number;
  absent: number;
}

export function summarize(students: WorkbenchStudent[]): QueueSummary {
  const list = evaluableStudents(students);
  return {
    attended: list.length,
    pushed: list.filter(isPushed).length,
    leave: students.filter((s) => attendanceOf(s) === 'leave').length,
    absent: students.filter((s) => attendanceOf(s) === 'absent').length,
  };
}

/**
 * 底部主按钮该做什么：
 * - next：推送后进入下一位
 * - finish：当前是最后一位，推送后进入完成页
 * - update：修改已推送的课评
 */
export type SubmitPlan =
  | { kind: 'next'; next: NextPending }
  | { kind: 'finish'; pushedAfter: number; attended: number }
  | { kind: 'update'; next?: NextPending };

export function submitPlan(students: WorkbenchStudent[], currentId: string): SubmitPlan {
  const current = students.find((s) => s.studentId === currentId);
  const next = nextPending(students, currentId);
  if (current && isPushed(current)) return { kind: 'update', next };
  if (next) return { kind: 'next', next };
  const { attended, pushed } = summarize(students);
  return { kind: 'finish', pushedAfter: Math.min(pushed + 1, attended), attended };
}

export function submitLabel(plan: SubmitPlan): string {
  if (plan.kind === 'update') return '保存并更新';
  if (plan.kind === 'finish') return `推送并完成（${plan.pushedAfter}/${plan.attended}）`;
  // 姓名放在最后：按钮放不下时省略的是前面的说明，不是姓名
  return plan.next.isSkipped
    ? `推送，回到跳过的 · ${plan.next.student.studentName}`
    : `推送，下一位 · ${plan.next.student.studentName}`;
}
