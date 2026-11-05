<template>
  <div
    class="teacher-portal tp-shell flex flex-col bg-st-bg select-text"
    :class="{ 'tp-keyboard-open': keyboardOpen }"
    :style="shellHeight ? { height: `${shellHeight}px` } : undefined"
  >
    <header class="shrink-0 bg-white border-b border-st-border pt-[env(safe-area-inset-top)]">
      <div class="tp-container flex items-center gap-1 h-[50px]">
        <button v-if="!isTabPage" type="button" class="tp-back" aria-label="返回" @click="goBack">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <h1 class="m-0 text-[17px] font-semibold text-st-title truncate">{{ route.meta.title }}</h1>
        <nav class="hidden md:flex items-center gap-1 ml-auto" aria-label="教师端导航">
          <RouterLink
            v-for="tab in tabs"
            :key="tab.key"
            :to="tab.to"
            class="px-3 h-[40px] inline-flex items-center gap-1.5 rounded-lg text-[14px] no-underline"
            :class="currentTab === tab.key ? 'bg-st-primary-light text-st-primary font-medium' : 'text-st-secondary hover:bg-st-header'"
            @click="onTabClick(tab.to)"
          >
            <component :is="tab.icon" class="w-4 h-4" />{{ tab.label }}
          </RouterLink>
        </nav>
      </div>
    </header>

    <p v-if="offline" class="tp-offline" role="status">
      <WifiOff class="w-4 h-4 shrink-0" />网络已断开，修改暂时无法保存到服务器
    </p>

    <div class="relative flex-1 min-h-0">
      <div
        v-if="pullDistance > 0"
        class="tp-pull-indicator"
        :style="{ height: `${pullDistance}px` }"
        role="status"
      >
        <Loader2 v-if="pullRefreshing" class="w-4 h-4 animate-spin" />
        <ArrowDown v-else class="w-4 h-4 transition-transform" :class="{ 'rotate-180': pullDistance >= pullTrigger }" />
        {{ pullRefreshing ? '刷新中…' : pullDistance >= pullTrigger ? '松开刷新' : '下拉刷新' }}
      </div>
      <main ref="mainEl" class="h-full overflow-y-auto overscroll-contain">
        <div
          ref="pageEl"
          class="tp-container tp-page py-3"
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

    <nav
      v-if="isTabPage && !keyboardOpen"
      class="tp-tabbar md:hidden shrink-0 bg-white border-t border-st-border flex"
      aria-label="教师端导航"
    >
      <RouterLink
        v-for="tab in tabs"
        :key="tab.key"
        :to="tab.to"
        class="tp-tabbar-item flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] no-underline"
        :class="currentTab === tab.key ? 'text-st-primary font-medium' : 'text-st-muted'"
        @click="onTabClick(tab.to)"
      >
        <component :is="tab.icon" class="w-[22px] h-[22px]" />
        <span class="tp-tabbar-label">{{ tab.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, CalendarDays, ChevronLeft, House, Loader2, MessageSquareText, UserRound, Users, WifiOff } from 'lucide-vue-next'
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

onMounted(() => {
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  removeBeforeEach()
  removeAfterEach()
  cancelRestore?.()
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>
