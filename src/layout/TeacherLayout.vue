<template>
  <div class="teacher-portal h-[100dvh] flex flex-col bg-st-bg select-text">
    <header class="shrink-0 bg-white border-b border-st-border pt-[env(safe-area-inset-top)]">
      <div class="tp-container flex items-center gap-2 h-[50px]">
        <button
          v-if="!isTabPage"
          type="button"
          class="-ml-2 w-11 h-11 flex items-center justify-center text-st-regular bg-transparent border-0 cursor-pointer"
          aria-label="返回"
          @click="goBack"
        >
          <ChevronLeft class="w-6 h-6" />
        </button>
        <h1 class="m-0 text-[17px] font-semibold text-st-title truncate">{{ route.meta.title }}</h1>
        <nav class="hidden md:flex items-center gap-1 ml-auto" aria-label="教师端导航">
          <RouterLink
            v-for="tab in tabs"
            :key="tab.key"
            :to="tab.to"
            class="px-3 h-9 inline-flex items-center gap-1.5 rounded-lg text-[14px] no-underline"
            :class="currentTab === tab.key ? 'bg-st-primary-light text-st-primary font-medium' : 'text-st-secondary hover:bg-st-header'"
          >
            <component :is="tab.icon" class="w-4 h-4" />{{ tab.label }}
          </RouterLink>
        </nav>
      </div>
    </header>

    <main ref="mainEl" class="flex-1 overflow-y-auto overscroll-contain">
      <div class="tp-container tp-page py-3">
        <RouterView :key="route.fullPath" />
      </div>
    </main>

    <nav
      v-if="isTabPage"
      class="md:hidden shrink-0 bg-white border-t border-st-border pb-[env(safe-area-inset-bottom)] flex"
      aria-label="教师端导航"
    >
      <RouterLink
        v-for="tab in tabs"
        :key="tab.key"
        :to="tab.to"
        class="flex-1 min-h-[54px] flex flex-col items-center justify-center gap-0.5 text-[11px] no-underline"
        :class="currentTab === tab.key ? 'text-st-primary font-medium' : 'text-st-muted'"
      >
        <component :is="tab.icon" class="w-[22px] h-[22px]" />
        {{ tab.label }}
      </RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, ChevronLeft, House, MessageSquareText, UserRound, Users } from 'lucide-vue-next'
import '@/views/teacher/teacher.css'

const route = useRoute()
const router = useRouter()
const mainEl = ref<HTMLElement | null>(null)

const tabs = [
  { key: 'home', label: '首页', to: '/teacher', icon: House },
  { key: 'schedule', label: '课表', to: '/teacher/schedule', icon: CalendarDays },
  { key: 'evaluations', label: '课评', to: '/teacher/evaluations', icon: MessageSquareText },
  { key: 'students', label: '学员', to: '/teacher/students', icon: Users },
  { key: 'me', label: '我的', to: '/teacher/me', icon: UserRound },
]

const currentTab = computed(() => route.meta.teacherTab as string | undefined)
const isTabPage = computed(() => !!currentTab.value)

// 页面滚动发生在 main 内部，路由自带的 scrollBehavior 不起作用
watch(() => route.path, () => {
  mainEl.value?.scrollTo({ top: 0 })
})

function goBack() {
  // 从分享链接 / 书签直接打开时没有上一页
  if (window.history.state?.back) router.back()
  else router.replace('/teacher')
}
</script>
