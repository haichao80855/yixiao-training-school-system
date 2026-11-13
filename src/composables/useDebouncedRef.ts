import { ref, watch, onScopeDispose, type Ref } from 'vue'

/**
 * 输入框关键字的防抖副本：停止输入 delay 毫秒后才更新。
 * 列表在前端过滤时用它代替原始关键字，打字时不会每按一个键就把整张表重新过滤、重新渲染一遍。
 * 清空关键字时立即生效。
 */
export function useDebouncedRef<T>(source: Ref<T>, delay = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null
  watch(source, (value) => {
    if (timer) clearTimeout(timer)
    if (value === '' || value === null || value === undefined) {
      debounced.value = value
      return
    }
    timer = setTimeout(() => {
      debounced.value = value
    }, delay)
  })
  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })
  return debounced
}
