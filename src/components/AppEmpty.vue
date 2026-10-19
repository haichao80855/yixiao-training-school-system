<template>
  <div class="app-empty flex flex-col items-center justify-center p-8 text-center select-none">
    <!-- 图标/插画展示区 -->
    <div class="empty-icon-wrap w-16 h-16 rounded-2xl flex items-center justify-center mb-3.5 transition-transform hover:scale-105" :class="themeConfig.bgClass">
      <slot name="icon">
        <!-- 搜索无结果 -->
        <SearchX v-if="type === 'search'" class="w-8 h-8" :class="themeConfig.iconClass" />
        <!-- 加载失败/错误 -->
        <AlertTriangle v-else-if="type === 'error'" class="w-8 h-8" :class="themeConfig.iconClass" />
        <!-- 网络断开 -->
        <WifiOff v-else-if="type === 'network'" class="w-8 h-8" :class="themeConfig.iconClass" />
        <!-- 基础无数据 -->
        <Inbox v-else class="w-8 h-8" :class="themeConfig.iconClass" />
      </slot>
    </div>

    <!-- 标题 -->
    <h4 class="text-sm font-semibold text-st-title mb-1.5">
      <slot name="title">{{ computedTitle }}</slot>
    </h4>

    <!-- 辅助描述信息 -->
    <p class="text-xs text-st-secondary max-w-sm mb-4 leading-relaxed">
      <slot name="description">{{ computedDescription }}</slot>
    </p>

    <!-- 操作引导区域 -->
    <div v-if="showAction || $slots.action" class="empty-action flex items-center gap-2">
      <slot name="action">
        <el-button
          v-if="type === 'search'"
          size="small"
          plain
          @click="handleAction"
        >
          <RotateCcw class="w-3.5 h-3.5 mr-1" />
          {{ actionText || '重置筛选条件' }}
        </el-button>
        <el-button
          v-else-if="type === 'error' || type === 'network'"
          size="small"
          type="primary"
          @click="handleRetry"
        >
          <RefreshCw class="w-3.5 h-3.5 mr-1" />
          {{ actionText || '重新加载' }}
        </el-button>
        <el-button
          v-else-if="actionText"
          size="small"
          type="primary"
          @click="handleAction"
        >
          <Plus class="w-3.5 h-3.5 mr-1" />
          {{ actionText }}
        </el-button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Inbox,
  SearchX,
  AlertTriangle,
  WifiOff,
  RotateCcw,
  RefreshCw,
  Plus
} from 'lucide-vue-next'

export type EmptyType = 'data' | 'search' | 'error' | 'network'

const props = withDefaults(
  defineProps<{
    type?: EmptyType
    title?: string
    description?: string
    actionText?: string
    showAction?: boolean
  }>(),
  {
    type: 'data',
    title: '',
    description: '',
    actionText: '',
    showAction: true
  }
)

const emit = defineEmits<{
  (e: 'action'): void
  (e: 'retry'): void
}>()

const themeConfig = computed(() => {
  switch (props.type) {
    case 'search':
      return {
        bgClass: 'bg-blue-50/70 border border-blue-100',
        iconClass: 'text-blue-500'
      }
    case 'error':
      return {
        bgClass: 'bg-amber-50/70 border border-amber-100',
        iconClass: 'text-amber-500'
      }
    case 'network':
      return {
        bgClass: 'bg-rose-50/70 border border-rose-100',
        iconClass: 'text-rose-500'
      }
    case 'data':
    default:
      return {
        bgClass: 'bg-gray-50 border border-gray-100',
        iconClass: 'text-st-secondary'
      }
  }
})

const computedTitle = computed(() => {
  if (props.title) return props.title
  switch (props.type) {
    case 'search':
      return '未找到匹配结果'
    case 'error':
      return '数据加载异常'
    case 'network':
      return '网络连接失败'
    case 'data':
    default:
      return '暂无相关数据'
  }
})

const computedDescription = computed(() => {
  if (props.description) return props.description
  switch (props.type) {
    case 'search':
      return '尝试调整搜索关键词或重置筛选条件'
    case 'error':
      return '未能成功获取数据，请检查网络或点击重新加载'
    case 'network':
      return '请检查您的网络连接是否畅通后重试'
    case 'data':
    default:
      return '当前列表内容为空，暂无记录'
  }
})

const handleAction = () => {
  emit('action')
}

const handleRetry = () => {
  emit('retry')
}
</script>

<style scoped>
.empty-icon-wrap {
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.04);
}
</style>
