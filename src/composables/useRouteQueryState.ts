import { ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type QueryValue = string | number

/**
 * 把列表页的筛选、标签、页码存进地址栏 (?status=pending&page=2)。
 * 从详情页返回、刷新页面、把链接发给同事时，列表还停在原来的筛选和页码。
 * 用 router.replace 写回地址栏，不会多出浏览记录。和默认值相同的项不写进地址栏。
 */
export function useRouteQueryState<T extends QueryValue>(key: string, defaultValue: T): Ref<T> {
  const route = useRoute()
  const router = useRouter()
  const read = (): T => {
    const raw = route.query[key]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value === undefined || value === null || value === '') return defaultValue
    if (typeof defaultValue === 'number') {
      const n = Number(value)
      return (Number.isFinite(n) ? n : defaultValue) as T
    }
    return String(value) as T
  }
  const state = ref(read()) as Ref<T>
  const path = route.path

  watch(state, (value) => {
    // 已经离开这个页面时不再改地址栏
    if (router.currentRoute.value.path !== path) return
    const query = { ...router.currentRoute.value.query }
    if (value === defaultValue || value === '') delete query[key]
    else query[key] = String(value)
    void router.replace({ query })
  })
  return state
}
