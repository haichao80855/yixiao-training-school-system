import { ref, shallowRef } from 'vue';
import { whenTransitionIdle } from './navTransition';

/** 页面数据加载：统一 loading / error，并丢弃过期请求的响应 */
export function useLoad<T>(fetcher: () => Promise<T>) {
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
      // 页面正在推入时先不换内容，等转场结束再提交，避免滑动中整页重排
      await whenTransitionIdle();
      if (id === requestId) data.value = result;
    } catch (err: any) {
      if (id === requestId) error.value = err?.message || '加载失败，请重试';
    } finally {
      if (id === requestId) loading.value = false;
    }
  }

  return { data, loading, error, load };
}
