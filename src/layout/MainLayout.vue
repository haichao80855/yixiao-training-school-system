<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-st-bg">
    <!-- 60px 顶部导航栏 -->
    <TopHeader @toggle-sidebar="toggleSidebar" />

    <div class="flex-1 flex overflow-hidden relative">
      <!-- 手机宽度：侧边栏改为从左侧滑出的抽屉，点遮罩或切换页面后收起 -->
      <transition name="sidebar-mask">
        <div
          v-if="isMobile && mobileOpen"
          class="absolute inset-0 z-30 bg-black/30"
          aria-hidden="true"
          @click="mobileOpen = false"
        />
      </transition>
      <div
        :class="
          isMobile
            ? [
                'absolute left-0 top-0 bottom-0 z-40 shadow-xl transition-transform duration-st ease-st',
                mobileOpen ? 'translate-x-0' : '-translate-x-full',
              ]
            : 'contents'
        "
      >
        <!-- 220px/64px 折叠侧边栏；屏幕窄于 1280px 时默认收起 -->
        <AppSidebar :collapsed="isMobile ? false : collapsed" />
      </div>

      <!-- 主工作区 -->
      <main class="flex-1 flex flex-col overflow-hidden min-w-0">
        <!-- 面包屑导航条 -->
        <div class="h-10 px-5 bg-white border-b border-st-border flex items-center shrink-0">
          <Breadcrumb />
        </div>

        <!-- 页面主视图内容区 (自适应滚动) -->
        <div class="flex-1 overflow-y-auto bg-st-bg">
          <router-view v-slot="{ Component }">
            <transition name="fade-transform" mode="out-in">
              <!-- 切换校区时重建当前页面，保证所有页面按新校区重载，旧页面的迟到响应也不会再显示 -->
              <component :is="Component" :key="tenantStore.currentCampusId" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import TopHeader from './TopHeader.vue'
import AppSidebar from './AppSidebar.vue'
import Breadcrumb from './Breadcrumb.vue'
import { useTenantStore } from '@/stores/tenantStore'

const tenantStore = useTenantStore()
const route = useRoute()

/** 窄于 1280px (如平板横屏、小笔记本) 时侧边栏默认收起成图标栏 */
const narrowQuery = window.matchMedia('(max-width: 1279px)')
/** 窄于 768px (手机) 时侧边栏改为抽屉 */
const mobileQuery = window.matchMedia('(max-width: 767px)')

const collapsed = ref(narrowQuery.matches)
const isMobile = ref(mobileQuery.matches)
const mobileOpen = ref(false)

function onNarrowChange(e: MediaQueryListEvent) {
  collapsed.value = e.matches
}
function onMobileChange(e: MediaQueryListEvent) {
  isMobile.value = e.matches
  mobileOpen.value = false
}
narrowQuery.addEventListener('change', onNarrowChange)
mobileQuery.addEventListener('change', onMobileChange)
onBeforeUnmount(() => {
  narrowQuery.removeEventListener('change', onNarrowChange)
  mobileQuery.removeEventListener('change', onMobileChange)
})

function toggleSidebar() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else collapsed.value = !collapsed.value
}

// 手机上点了菜单跳转后自动收起抽屉
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)
</script>

<style scoped>
.fade-transform-leave-active,
.fade-transform-enter-active {
  transition: opacity var(--st-transition), transform var(--st-transition);
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.sidebar-mask-enter-active,
.sidebar-mask-leave-active {
  transition: opacity var(--st-transition);
}

.sidebar-mask-enter-from,
.sidebar-mask-leave-to {
  opacity: 0;
}
</style>
