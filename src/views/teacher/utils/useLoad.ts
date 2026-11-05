import { ref, shallowRef } from 'vue';

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
      if (id === requestId) data.value = result;
    } catch (err: any) {
      if (id === requestId) error.value = err?.message || '加载失败，请重试';
    } finally {
      if (id === requestId) loading.value = false;
    }
  }

  return { data, loading, error, load };
}
