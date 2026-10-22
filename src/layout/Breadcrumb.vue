<template>
  <nav aria-label="面包屑" class="flex items-center gap-1.5 text-[13px] text-st-muted select-none">
    <span
      class="cursor-pointer hover:text-st-primary transition-colors"
      @click="$router.push('/dashboard')"
    >
      首页
    </span>
    <span v-for="(item, index) in breadcrumbs" :key="index" class="flex items-center gap-1.5">
      <el-icon class="text-st-placeholder" :size="12"><ArrowRight /></el-icon>
      <span
        :class="index === breadcrumbs.length - 1 ? 'font-medium text-st-title cursor-default' : 'hover:text-st-primary cursor-pointer transition-colors'"
        @click="index !== breadcrumbs.length - 1 && item.path && $router.push(item.path)"
      >
        {{ item.title }}
      </span>
    </span>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'

const route = useRoute()

interface CrumbItem {
  title: string
  path?: string
}

const modulePathMap: Record<string, string> = {
  '教研中心': '/curriculum/courseManage',
  '学员中心': '/studentCenter/allStudent',
  '教务中心': '/educational/timeSchedule',
  '财务中心': '/financial/orderManagement',
  '系统设置': '/systemSetting/authoritiesInfo'
}

const breadcrumbs = computed<CrumbItem[]>(() => {
  const crumbs: CrumbItem[] = []

  // 若当前为控制台首页，则仅展示“首页”
  if (route.path === '/' || route.path === '/dashboard') {
    return crumbs
  }

  // 1. 如果路由配置了 meta.module，先推入所属一级业务模块
  const currentModule = route.meta?.module as string | undefined
  if (currentModule) {
    crumbs.push({
      title: currentModule,
      path: modulePathMap[currentModule]
    })
  }

  // 2. 遍历匹配的具体页面
  const matched = route.matched.filter(item => item.meta && item.meta.title)
  matched.forEach(item => {
    if (item.path !== '/' && item.path !== '/dashboard') {
      const pageTitle = item.meta.title as string
      // 避免与模块名重复
      if (pageTitle !== currentModule) {
        crumbs.push({
          title: pageTitle,
          path: item.path
        })
      }
    }
  })

  return crumbs
})
</script>
