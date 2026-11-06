export type LoadErrorKind = 'forbidden' | 'failed';

// 页面加载失败时区分「无权限」和其他失败。request 已弹出后端原因的 Toast，这里只决定页面状态。
export function classifyLoadError(error: any): LoadErrorKind {
  const status = error?.statusCode ?? error?.status;
  return status === 403 ? 'forbidden' : 'failed';
}
