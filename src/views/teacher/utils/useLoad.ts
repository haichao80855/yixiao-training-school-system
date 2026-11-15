import { ref, shallowRef } from 'vue';
import { whenTransitionIdle } from './navTransition';
import { takeData, type PageDataSource } from './pageData';

/**
 * 页面数据加载：统一 loading / error，并丢弃过期请求的响应。
 * 传入 PageDataSource (见 pageData.ts) 时会先用点按时预取好的数据，页面一出现就有内容。
 */
export function useLoad<T>(source: (() => Promise<T>) | PageDataSource<T>) {
  const fetcher = typeof source === 'function' ? source : () => takeData(source);
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const error = ref('');
  let requestId = 0;

  async function load() {
    const id = ++requestId;
    loading.value = true;
    error.value = '';
    try {
      const result = await fetcher();
      // 已有内容的页面 (缓存页切回、刷新) 在转场中先不换内容，滑完再替换，避免滑动中整页重排；
      // 还在骨架屏的页面拿到数据立刻显示，不让老师多看一眼骨架屏
      if (data.value !== null) await whenTransitionIdle();
      if (id === requestId) data.value = result;
    } catch (err: any) {
      if (id === requestId) error.value = err?.message || '加载失败，请重试';
    } finally {
      if (id === requestId) loading.value = false;
    }
  }

  return { data, loading, error, load };
}
