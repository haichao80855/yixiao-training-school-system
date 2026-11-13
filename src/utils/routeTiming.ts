import type { Router } from 'vue-router'

/**
 * 页面切换耗时埋点 (流畅度改进第 3 期)：从点击菜单到新页面第一次绘制的时间，包括下载页面代码。
 * - 记录写进 performance 时间线 (Performance 面板里能看到 route:/xxx)；
 * - 开发环境在控制台打印，超过 300ms 用 warn；
 * - 最近 50 次保存在 window.__routeTimings，排查时可以直接看。
 */
export interface RouteTiming {
  path: string
  ms: number
  at: number
}

export function installRouteTiming(router: Router) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return
  let start = 0
  const records: RouteTiming[] = []
  ;(window as any).__routeTimings = records

  router.beforeEach((to, from) => {
    if (to.path !== from.path) start = performance.now()
  })

  router.afterEach((to, from, failure) => {
    if (failure || !start || to.path === from.path) return
    const begin = start
    start = 0
    // 两帧之后新页面已经绘制
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const ms = Math.round(performance.now() - begin)
        records.push({ path: to.path, ms, at: Date.now() })
        if (records.length > 50) records.shift()
        try {
          performance.measure(`route:${to.path}`, { start: begin, end: begin + ms })
        } catch {
          // 旧浏览器不支持带参数的 measure，忽略
        }
        if (import.meta.env.DEV) {
          const log = ms > 300 ? console.warn : console.info
          log(`[route] ${to.path} ${ms}ms`)
        }
      }),
    )
  })
}
