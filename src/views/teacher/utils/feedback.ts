import { reactive } from 'vue';

/**
 * 教师端的确认框与轻提示。
 * 代替 Element Plus 的 ElMessageBox / ElMessage：那是后台样式 (居中弹窗、小按钮、提示弹在顶部遮住页头)。
 * 由 TeacherLayout 里的 TpFeedbackHost 统一渲染：确认框从底部弹出，提示显示在底部操作区上方。
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 会丢失内容或退出的操作：确认按钮用红色 */
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  /** 只有一个按钮的提示框 */
  alert: boolean;
  resolve: (ok: boolean) => void;
}

export type ToastType = 'success' | 'warning' | 'error';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

export const feedbackState = reactive({
  hostMounted: false,
  confirm: null as ConfirmRequest | null,
  toast: null as ToastItem | null,
});

let seq = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** 确认框：确认返回 true，取消、点遮罩返回 false */
export function tpConfirm(options: ConfirmOptions): Promise<boolean> {
  // 布局还没挂载 (理论上不会发生)：退回浏览器自带确认框，至少不会卡住流程
  if (!feedbackState.hostMounted) return Promise.resolve(window.confirm(`${options.title}\n${options.message}`));
  // 已有确认框时先按取消结束它，同一时间只显示一个
  feedbackState.confirm?.resolve(false);
  return new Promise((resolve) => {
    feedbackState.confirm = { ...options, id: ++seq, alert: false, resolve };
  });
}

/** 只有「知道了」一个按钮的提示框 */
export function tpAlert(options: Omit<ConfirmOptions, 'cancelText' | 'danger'>): Promise<void> {
  if (!feedbackState.hostMounted) {
    window.alert(`${options.title}\n${options.message}`);
    return Promise.resolve();
  }
  feedbackState.confirm?.resolve(false);
  return new Promise((resolve) => {
    feedbackState.confirm = { ...options, id: ++seq, alert: true, resolve: () => resolve() };
  });
}

export function settleConfirm(ok: boolean) {
  const current = feedbackState.confirm;
  if (!current) return;
  feedbackState.confirm = null;
  current.resolve(ok);
}

function show(type: ToastType, message: string) {
  if (toastTimer) clearTimeout(toastTimer);
  feedbackState.toast = { id: ++seq, type, message };
  // 出错的提示多留一会儿，留出读完原因的时间
  toastTimer = setTimeout(() => {
    feedbackState.toast = null;
    toastTimer = null;
  }, type === 'success' ? 2000 : 3500);
}

export const tpToast = {
  success: (message: string) => show('success', message),
  warning: (message: string) => show('warning', message),
  error: (message: string) => show('error', message),
};
