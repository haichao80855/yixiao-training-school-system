<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-st-bg">
    <!-- 60px 顶部导航栏 -->
    <TopHeader @toggle-sidebar="collapsed = !collapsed" />

    <div class="flex-1 flex overflow-hidden">
      <!-- 220px/64px 折叠侧边栏 -->
      <AppSidebar :collapsed="collapsed" />

      <!-- 主工作区 -->
      <main class="flex-1 flex flex-col overflow-hidden">
        <!-- 分段多 Tab 标签栏 -->
        <TagsView />

        <!-- 面包屑导航条 -->
        <div class="h-9 px-4 bg-white/70 border-b border-st-border flex items-center shrink-0">
          <Breadcrumb />
        </div>

        <!-- 页面主视图内容区 (自适应滚动) -->
        <div class="flex-1 overflow-y-auto bg-st-bg">
          <router-view v-slot="{ Component }">
            <transition name="fade-transform" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TopHeader from './TopHeader.vue'
import AppSidebar from './AppSidebar.vue'
import TagsView from './TagsView.vue'
import Breadcrumb from './Breadcrumb.vue'

const collapsed = ref(false)
</script>

<style scoped>
.fade-transform-leave-active,
.fade-transform-enter-active {
  transition: all 0.18s ease;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
