import type { RouteLocationNormalized, RouteMeta } from 'vue-router'
import type { useAuthStore } from '@/stores/authStore'

type AuthStore = ReturnType<typeof useAuthStore>

/**
 * 当前账号能否打开某个页面。路由守卫、侧边栏、首页入口共用这一处判断：
 * - meta.requiresPermission：满足其中任一权限码即可
 * - meta.requiresLeader：只有校区负责人 (执行校长) 及以上，如老师课酬
 */
export function canAccessMeta(metas: RouteMeta[], authStore: AuthStore): boolean {
  for (const meta of metas) {
    if (meta.requiresLeader && !authStore.isCampusLeader) return false
    const required = meta.requiresPermission as string | string[] | undefined
    if (required && !authStore.hasAnyPermission(required)) return false
  }
  return true
}

export function canAccessRoute(route: Pick<RouteLocationNormalized, 'matched'>, authStore: AuthStore): boolean {
  return canAccessMeta(
    route.matched.map((r) => r.meta),
    authStore,
  )
}
