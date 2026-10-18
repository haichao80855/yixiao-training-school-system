<template>
  <div class="app-pagination-container flex items-center justify-between py-3 px-1 select-none">
    <!-- 左侧信息区或批量操作插槽 -->
    <div class="app-pagination-left flex items-center gap-2">
      <slot name="left">
        <span v-if="summaryText" class="text-xs text-st-muted">{{ summaryText }}</span>
      </slot>
    </div>

    <!-- 右侧标准 Element Plus 分页器 -->
    <div class="app-pagination-right ml-auto">
      <el-pagination
        v-model:current-page="currentPageModel"
        v-model:page-size="pageSizeModel"
        :page-sizes="pageSizes"
        :total="total"
        :layout="layout"
        :background="background"
        :small="small"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PAGINATION_CONFIG } from '@/constants/ui'

interface Props {
  total: number
  currentPage?: number
  pageSize?: number
  pageSizes?: number[]
  layout?: string
  small?: boolean
  background?: boolean
  summaryText?: string
}

const props = withDefaults(defineProps<Props>(), {
  currentPage: 1,
  pageSize: 20,
  pageSizes: () => [...PAGINATION_CONFIG.pageSizes],
  layout: PAGINATION_CONFIG.layout,
  small: true,
  background: true,
  summaryText: '',
})

const emit = defineEmits<{
  (e: 'update:currentPage', val: number): void
  (e: 'update:pageSize', val: number): void
  (e: 'change', payload: { page: number; limit: number }): void
}>()

const currentPageModel = computed({
  get: () => props.currentPage,
  set: (val: number) => emit('update:currentPage', val),
})

const pageSizeModel = computed({
  get: () => props.pageSize,
  set: (val: number) => emit('update:pageSize', val),
})

function handleSizeChange(val: number) {
  emit('update:pageSize', val)
  emit('change', { page: currentPageModel.value, limit: val })
}

function handleCurrentChange(val: number) {
  emit('update:currentPage', val)
  emit('change', { page: val, limit: pageSizeModel.value })
}
</script>

<style scoped>
.app-pagination-container :deep(.el-pagination) {
  --el-pagination-button-bg-color: #f4f4f5;
  --el-pagination-hover-color: var(--st-color-primary, #1890ff);
}
</style>
