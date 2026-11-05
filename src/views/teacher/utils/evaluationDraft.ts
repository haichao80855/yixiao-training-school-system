/** 课评草稿只保存在本机，点「推送」后才落库；按账号隔离，避免同一设备换账号串稿 */
export interface EvaluationDraft {
  comment: string;
  studyContent: string;
  rating: number;
  photos: string[];
  videoUrl: string;
  savedAt: string;
}

const KEY_PREFIX = 'yixiao_teacher_eval_draft';

function draftKey(userId: string, lessonId: string, studentId: string) {
  return `${KEY_PREFIX}:${userId}:${lessonId}:${studentId}`;
}

export function readDraft(userId: string, lessonId: string, studentId: string): EvaluationDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId, lessonId, studentId));
    return raw ? (JSON.parse(raw) as EvaluationDraft) : null;
  } catch {
    return null;
  }
}

/** 存储不可用 (隐私模式 / 配额已满) 时返回 false，由调用方提示老师 */
export function writeDraft(userId: string, lessonId: string, studentId: string, draft: EvaluationDraft): boolean {
  try {
    localStorage.setItem(draftKey(userId, lessonId, studentId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(userId: string, lessonId: string, studentId: string) {
  try {
    localStorage.removeItem(draftKey(userId, lessonId, studentId));
  } catch {
    // 存储不可用时无草稿可删
  }
}
