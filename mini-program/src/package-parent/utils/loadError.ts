/**
 * 把加载失败的原因转成家长看得懂的一句话 (家长端 UI 改进第 2 期)。
 * 以前所有页面出错都显示成「还没有课评 / 这一天没有课」，家长会以为真的没有数据。
 */
export function describeLoadError(err: unknown): string {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline) return '网络已断开，连上网络后点「重新加载」';
  const status = Number((err as { statusCode?: number })?.statusCode || 0);
  if (status === 404) return '内容不存在，可能已被老师撤回';
  if (status === 403) return '暂时没有查看权限，请联系校区老师';
  if (status >= 500) return '服务暂时出了点问题，请稍后重新加载';
  return '网络不太稳定，没能加载出来，请重新加载';
}
