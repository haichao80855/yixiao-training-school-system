<template>
  <div
    class="teacher-portal tp-shell"
    :class="{ 'tp-keyboard-open': keyboardOpen, 'tp-shell--wide': route.meta.teacherWide }"
    :style="shellHeight ? { height: `${shellHeight}px` } : undefined"
  >
    <aside class="tp-sidebar">
      <div class="tp-sidebar__brand">
        <span class="tp-brand-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </span>
        <span class="tp-sidebar__brand-name">一校教师端</span>
      </div>
      <nav class="tp-sidebar__nav" aria-label="教师端导航">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.key"
          :to="tab.to"
          class="tp-nav-item"
          :class="{ 'is-active': activeSection === tab.key }"
          :aria-current="activeSection === tab.key ? 'page' : undefined"
          @click="onTabClick(tab.to)"
        >
          <component :is="tab.icon" aria-hidden="true" />
          {{ tab.label }}
        </RouterLink>
      </nav>
      <div class="tp-sidebar__user">
        <p class="tp-sidebar__user-name">{{ authStore.user?.realName }}</p>
        <p class="tp-sidebar__user-meta">{{ authStore.user?.campusName }}</p>
      </div>
    </aside>

    <div class="tp-workspace">
      <!-- 标签页在内容里放大标题 (PageTitle)，只有详情页需要固定的返回栏 -->
      <div v-if="isTabPage" class="tp-header-spacer" />
      <header v-else class="tp-header">
        <div class="tp-container tp-header__inner">
          <button type="button" class="tp-back" aria-label="返回" @click="goBack">
            <ChevronLeft :size="24" />
          </button>
          <h1 class="tp-header__title">{{ route.meta.title }}</h1>
        </div>
      </header>

      <p v-if="offline" class="tp-offline" role="status">
        <WifiOff aria-hidden="true" />网络已断开，修改暂时无法保存到服务器
      </p>

      <div class="tp-scroll-area">
        <div v-if="pullDistance > 0" class="tp-pull-indicator" :style="{ height: `${pullDistance}px` }" role="status">
          <Loader2 v-if="pullRefreshing" class="tp-spin" aria-hidden="true" />
          <ArrowDown v-else :style="{ transform: pullDistance >= pullTrigger ? 'rotate(180deg)' : undefined }" aria-hidden="true" />
          {{ pullRefreshing ? '刷新中…' : pullDistance >= pullTrigger ? '松开刷新' : '下拉刷新' }}
        </div>
        <main ref="mainEl" class="tp-main">
          <div
            ref="pageEl"
            class="tp-container tp-page"
            :style="pullDistance > 0 ? { transform: `translateY(${pullDistance}px)` } : undefined"
          >
            <RouterView v-slot="{ Component, route: viewRoute }">
              <!-- 列表页缓存：从详情返回时保留日期、筛选、搜索和已加载的数据 -->
              <KeepAlive :include="CACHED_PAGES" :max="10">
                <component :is="Component" :key="viewRoute.fullPath" />
              </KeepAlive>
            </RouterView>
          </div>
        </main>
      </div>

      <nav v-if="isTabPage && !keyboardOpen" class="tp-tabbar" aria-label="教师端导航">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.key"
          :to="tab.to"
          class="tp-tabbar__item"
          :class="{ 'is-active': currentTab === tab.key }"
          :aria-current="currentTab === tab.key ? 'page' : undefined"
          @click="onTabClick(tab.to)"
        >
          <component :is="tab.icon" aria-hidden="true" />
          <span class="tp-tabbar__label">{{ tab.label }}</span>
        </RouterLink>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, CalendarDays, ChevronLeft, House, Loader2, MessageSquareText, UserRound, Users, WifiOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'
import { PAGE_REFRESH_KEY, type PageRefreshFn } from '@/views/teacher/utils/pageRefresh'
import { useKeyboardViewport } from '@/views/teacher/utils/useKeyboardViewport'
import { usePullToRefresh } from '@/views/teacher/utils/usePullToRefresh'
import '@/views/teacher/teacher.css'

const CACHED_PAGES = [
  'TeacherHome',
  'TeacherSchedule',
  'TeacherEvaluations',
  'TeacherStudents',
  'TeacherClasses',
  'TeacherWarnings',
  'TeacherClassDetail',
  'TeacherStudentDetail',
]
/** 切回前台时，离开超过这么久才自动刷新，避免来回切应用时频繁请求 */
const RESUME_REFRESH_AFTER_MS = 60_000
const SCROLL_RESTORE_TIMEOUT_MS = 2000

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const mainEl = ref<HTMLElement | null>(null)
const pageEl = ref<HTMLElement | null>(null)
const offline = ref(typeof navigator !== 'undefined' && navigator.onLine === false)

const tabs = [
  { key: 'home', label: '首页', to: '/teacher', icon: House },
  { key: 'schedule', label: '课表', to: '/teacher/schedule', icon: CalendarDays },
  { key: 'evaluations', label: '课评', to: '/teacher/evaluations', icon: MessageSquareText },
  { key: 'students', label: '学员', to: '/teacher/students', icon: Users },
  { key: 'me', label: '我的', to: '/teacher/me', icon: UserRound },
]

const currentTab = computed(() => route.meta.teacherTab as string | undefined)
const isTabPage = computed(() => !!currentTab.value)
/** 详情页没有自己的标签，侧边栏高亮它所属的模块 */
const activeSection = computed(() => {
  if (currentTab.value) return currentTab.value
  if (route.path.startsWith('/teacher/lessons')) return 'schedule'
  if (route.path.startsWith('/teacher/classes') || route.path.startsWith('/teacher/students')) return 'students'
  return 'home'
})

const { keyboardOpen, shellHeight } = useKeyboardViewport()

// ---------- 页面刷新 ----------
const pageRefresh = shallowRef<PageRefreshFn | null>(null)
provide(PAGE_REFRESH_KEY, {
  register: (fn) => {
    pageRefresh.value = fn
  },
  unregister: (fn) => {
    if (pageRefresh.value === fn) pageRefresh.value = null
  },
})

const {
  distance: pullDistance,
  refreshing: pullRefreshing,
  triggerDistance: pullTrigger,
} = usePullToRefresh(mainEl, () => pageRefresh.value)

let hiddenAt = 0
function onVisibilityChange() {
  if (document.hidden) {
    hiddenAt = Date.now()
  } else if (hiddenAt && Date.now() - hiddenAt > RESUME_REFRESH_AFTER_MS) {
    pageRefresh.value?.()
  }
}
function onOnline() {
  offline.value = false
  pageRefresh.value?.()
}
function onOffline() {
  offline.value = true
}

// ---------- 滚动位置 ----------
// 页面滚动发生在 main 内部，vue-router 的 scrollBehavior 管不到
const scrollPositions = new Map<string, number>()
let cancelRestore: (() => void) | null = null
// 用 vue-router 写入 history.state 的位置序号判断返回：popstate 监听器之间会清空微任务，
// 路由导航可能在我们的监听器运行前就已完成，靠事件打标记不可靠
let historyPosition: number = window.history.state?.position ?? 0

/** 未缓存的页面要等数据加载、内容撑高后才能滚到原位置 */
function restoreScroll(top: number) {
  const main = mainEl.value
  const page = pageEl.value
  if (!main || !page) return
  cancelRestore?.()
  main.scrollTop = top
  if (top === 0 || main.scrollTop >= top - 1) return

  const observer = new ResizeObserver(() => {
    main.scrollTop = top
    if (main.scrollTop >= top - 1) stop()
  })
  const timer = setTimeout(() => stop(), SCROLL_RESTORE_TIMEOUT_MS)
  function stop() {
    observer.disconnect()
    clearTimeout(timer)
    main!.removeEventListener('touchstart', stop)
    cancelRestore = null
  }
  // 老师已经开始滑动就不再抢滚动位置
  main.addEventListener('touchstart', stop, { passive: true, once: true })
  observer.observe(page)
  cancelRestore = stop
}

const removeBeforeEach = router.beforeEach((_to, from) => {
  if (mainEl.value) scrollPositions.set(from.fullPath, mainEl.value.scrollTop)
})
const removeAfterEach = router.afterEach((to, from, failure) => {
  // 被离开确认拦下的导航也会走到这里，此时页面并没有变化
  if (failure || to.fullPath === from.fullPath) return
  const position: number = window.history.state?.position ?? 0
  const isBack = position < historyPosition
  historyPosition = position
  // 返回，或切换底部标签时回到原位置；打开新页面从顶部开始
  const shouldRestore = isBack || !!to.meta.teacherTab
  nextTick(() => restoreScroll(shouldRestore ? scrollPositions.get(to.fullPath) ?? 0 : 0))
})

/** 再次点击当前标签回到顶部 */
function onTabClick(to: string) {
  if (route.fullPath === to) mainEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function goBack() {
  // 从分享链接 / 书签直接打开时没有上一页
  if (window.history.state?.back) router.back()
  else router.replace('/teacher')
}

// 手机浏览器的状态栏跟随页面底色；离开教师端时还原，后台和登录页仍是白色
const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
const originalThemeColor = themeColorMeta?.content

onMounted(() => {
  themeColorMeta?.setAttribute('content', '#f4f6fa')
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (originalThemeColor) themeColorMeta?.setAttribute('content', originalThemeColor)
  removeBeforeEach()
  removeAfterEach()
  cancelRestore?.()
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>
