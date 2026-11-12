import { ref } from 'vue'

/**
 * 列表加载状态：加载中、加载失败的原因。
 *
 * 用法：
 *   const { loading, loadError, track, fail } = useLoadState()
 *   function loadData() { return track(fetchList) }
 *   async function fetchList() {
 *     try { ... } catch (err) { fail(err, '获取列表失败') }
 *   }
 *
 * 表格用 v-loading="loading"；空状态区按 loadError 区分“没有数据”和“加载失败 (可重试)”，
 * 避免加载失败时只弹一下提示、表格却显示“暂无数据”，让人误以为真的没有数据。
 */
export function useLoadState() {
  const loading = ref(false)
  const loadError = ref('')
  let seq = 0

  async function track(task: () => Promise<unknown>): Promise<void> {
    const current = ++seq
    loading.value = true
    loadError.value = ''
    try {
      await task()
    } catch (err) {
      if (current === seq) fail(err, '加载失败')
    } finally {
      // 连续触发时只让最后一次请求结束加载状态
      if (current === seq) loading.value = false
    }
  }

  function fail(err: unknown, fallback: string) {
    // 断网、后端没启动时浏览器抛出的是英文 TypeError ("Failed to fetch")，换成能看懂的说明
    if (err instanceof TypeError) {
      loadError.value = '网络连接失败，请检查网络后重新加载'
      return
    }
    loadError.value = err instanceof Error && err.message ? err.message : fallback
  }

  return { loading, loadError, track, fail }
}
