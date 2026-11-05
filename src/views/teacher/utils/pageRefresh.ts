import { inject, onActivated, onBeforeUnmount, onDeactivated, onMounted, type InjectionKey } from 'vue';

export type PageRefreshFn = () => Promise<unknown> | unknown;

export interface PageRefreshRegistry {
  register: (fn: PageRefreshFn) => void;
  unregister: (fn: PageRefreshFn) => void;
}

export const PAGE_REFRESH_KEY: InjectionKey<PageRefreshRegistry> = Symbol('teacher-page-refresh');

/**
 * 声明当前页面如何刷新：下拉刷新、从后台切回、网络恢复时由布局调用。
 * 不调用本函数的页面 (如写课评) 不响应刷新，避免打断正在编辑的内容。
 */
export function usePageRefresh(fn: PageRefreshFn) {
  const registry = inject(PAGE_REFRESH_KEY, null);
  if (!registry) return;
  const register = () => registry.register(fn);
  const unregister = () => registry.unregister(fn);
  onMounted(register);
  onActivated(register);
  onDeactivated(unregister);
  onBeforeUnmount(unregister);
}
