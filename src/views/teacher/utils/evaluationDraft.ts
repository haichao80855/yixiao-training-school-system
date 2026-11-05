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
const AUTOSAVE_PREFIX = 'yixiao_teacher_eval_autosave';

function draftKey(prefix: string, userId: string, lessonId: string, studentId: string) {
  return `${prefix}:${userId}:${lessonId}:${studentId}`;
}

function read(key: string): EvaluationDraft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as EvaluationDraft) : null;
  } catch {
    return null;
  }
}

/** 存储不可用 (隐私模式 / 配额已满) 时返回 false，由调用方提示老师 */
function write(key: string, draft: EvaluationDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // 存储不可用时无内容可删
  }
}

export function readDraft(userId: string, lessonId: string, studentId: string) {
  return read(draftKey(KEY_PREFIX, userId, lessonId, studentId));
}

export function writeDraft(userId: string, lessonId: string, studentId: string, draft: EvaluationDraft) {
  return write(draftKey(KEY_PREFIX, userId, lessonId, studentId), draft);
}

export function removeDraft(userId: string, lessonId: string, studentId: string) {
  remove(draftKey(KEY_PREFIX, userId, lessonId, studentId));
}

/**
 * 编辑中的自动暂存：手机接电话、切后台时页面可能被系统回收，回来后要能恢复。
 * 与草稿分开存放：「推送草稿」只推送老师主动保存过的内容，不会把写到一半的文字发给家长。
 */
export function readAutosave(userId: string, lessonId: string, studentId: string) {
  return read(draftKey(AUTOSAVE_PREFIX, userId, lessonId, studentId));
}

export function writeAutosave(userId: string, lessonId: string, studentId: string, draft: EvaluationDraft) {
  return write(draftKey(AUTOSAVE_PREFIX, userId, lessonId, studentId), draft);
}

export function removeAutosave(userId: string, lessonId: string, studentId: string) {
  remove(draftKey(AUTOSAVE_PREFIX, userId, lessonId, studentId));
}
