<template>
  <div class="h-9 bg-white border-b border-st-border flex items-center justify-between px-3 select-none z-10">
    <!-- 标签列表 -->
    <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar flex-1 mr-2">
      <div
        v-for="tag in visitedViews"
        :key="tag.path"
        @click="handleSelectTag(tag)"
        :class="[
          'group flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border transition-all cursor-pointer whitespace-nowrap',
          isActive(tag)
            ? 'bg-st-primary-light border-st-primary-border text-st-primary font-semibold shadow-xs'
            : 'bg-gray-50 border-gray-200 text-st-regular hover:bg-gray-100'
        ]"
      >
        <span
          v-if="isActive(tag)"
          class="w-1.5 h-1.5 rounded-full bg-st-primary inline-block"
        ></span>
        <span>{{ tag.title }}</span>
        <!-- 关闭按钮 (固定项不显示关闭) -->
        <span
          v-if="!tag.affix"
          @click.stop="handleCloseTag(tag)"
          class="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] text-gray-400 group-hover:text-gray-600 hover:!bg-red-100 hover:!text-red-600 transition-colors ml-0.5"
        >
          ×
        </span>
      </div>
    </div>

    <!-- 右侧标签快捷操作 -->
    <el-dropdown trigger="click" @command="handleCommand">
      <el-button link size="small" class="!p-1 text-st-muted hover:!text-st-primary hover:!bg-gray-100 transition-colors">
        <el-icon><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="closeOthers">关闭其他标签</el-dropdown-item>
          <el-dropdown-item command="closeAll">关闭所有非固定标签</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTagsViewStore } from '@/stores/tagsViewStore'
import type { TagViewItem } from '@/types'

const route = useRoute()
const router = useRouter()
const tagsViewStore = useTagsViewStore()

const visitedViews = computed(() => tagsViewStore.visitedViews)

function isActive(tag: TagViewItem) {
  return tag.path === route.path
}

function addCurrentView() {
  if (route.meta && route.meta.title) {
    tagsViewStore.addVisitedView({
      name: (route.name as string) || 'View',
      path: route.path,
      fullPath: route.fullPath,
      title: route.meta.title as string,
      affix: route.path === '/dashboard'
    })
  }
}

watch(
  () => route.path,
  () => {
    addCurrentView()
  },
  { immediate: true }
)

function handleSelectTag(tag: TagViewItem) {
  if (tag.path !== route.path) {
    router.push(tag.path)
  }
}

function handleCloseTag(tag: TagViewItem) {
  const views = tagsViewStore.delVisitedView(tag)
  if (isActive(tag)) {
    const latestView = views.slice(-1)[0]
    if (latestView) {
      router.push(latestView.path)
    } else {
      router.push('/dashboard')
    }
  }
}

function handleCommand(cmd: string) {
  const currentTag = visitedViews.value.find(v => v.path === route.path)
  if (cmd === 'closeOthers' && currentTag) {
    tagsViewStore.delOthersViews(currentTag)
  } else if (cmd === 'closeAll') {
    tagsViewStore.delAllViews()
    router.push('/dashboard')
  }
}
</script>
