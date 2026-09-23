<template>
  <div class="bg-gray-50 border border-gray-200/90 rounded-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
    <!-- 左侧统计小计文案 -->
    <div class="flex items-center space-x-2">
      <slot name="left">
        <span class="inline-block w-1.5 h-3.5 bg-st-primary rounded-sm"></span>
        <div class="text-st-regular">
          <template v-if="summaryText">
            <span>{{ summaryText }}</span>
          </template>
          <template v-else>
            当前条件下：共计
            <span class="font-bold text-st-primary font-mono text-sm px-0.5">{{ totalCount }}</span>
            {{ unit }}，实缴金额
            <span class="font-bold text-st-danger font-mono text-sm px-0.5">
              ¥ {{ displayAmount }}
            </span>
            {{ currency }}
          </template>
        </div>
      </slot>
    </div>

    <!-- 右侧操作栏：选择列 & 导出 -->
    <div class="flex items-center space-x-2">
      <slot name="right">
        <!-- 选择列 Popover -->
        <el-popover
          v-if="columnList && columnList.length > 0"
          placement="bottom-end"
          :width="220"
          trigger="click"
        >
          <template #reference>
            <el-button size="small" plain class="!border-st-primary !text-st-primary hover:!bg-blue-50">
              <el-icon class="mr-1"><Setting /></el-icon>
              选择列
            </el-button>
          </template>

          <div class="py-1">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 text-xs font-bold text-st-title">
              <span>自定义表格列</span>
              <el-button link type="primary" size="small" @click="resetColumns">恢复默认</el-button>
            </div>
            <div class="max-h-60 overflow-y-auto space-y-1.5">
              <div
                v-for="col in columnList"
                :key="col.key"
                class="flex items-center"
              >
                <el-checkbox
                  v-model="col.visible"
                  :disabled="col.disabled"
                  size="small"
                  @change="handleColumnChange"
                >
                  <span class="text-xs">{{ col.title }}</span>
                </el-checkbox>
              </div>
            </div>
          </div>
        </el-popover>

        <!-- 导出操作 -->
        <el-button
          size="small"
          plain
          :loading="loading"
          class="!border-st-primary !text-st-primary hover:!bg-blue-50"
          @click="$emit('export')"
        >
          <el-icon class="mr-1"><Download /></el-icon>
          导出
        </el-button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Setting, Download } from '@element-plus/icons-vue'
import type { ColumnConfig } from '@/types/financial'

const props = withDefaults(
  defineProps<{
    totalCount?: number
    totalAmount?: number
    formattedAmount?: string
    summaryText?: string
    columns?: ColumnConfig[]
    storageKey?: string
    loading?: boolean
    unit?: string
    currency?: string
  }>(),
  {
    totalCount: 0,
    totalAmount: 0,
    formattedAmount: '',
    summaryText: '',
    columns: () => [],
    storageKey: 'yixiao_financial_table_columns',
    loading: false,
    unit: '笔缴费',
    currency: '元'
  }
)

const emit = defineEmits<{
  (e: 'export'): void
  (e: 'update:columns', value: ColumnConfig[]): void
}>()

const columnList = ref<ColumnConfig[]>([])

const displayAmount = computed(() => {
  if (props.formattedAmount) return props.formattedAmount
  return props.totalAmount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
})

function initColumns() {
  if (!props.columns || props.columns.length === 0) return

  const copy = props.columns.map(c => ({ ...c }))
  if (props.storageKey) {
    try {
      const saved = localStorage.getItem(props.storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>
        for (const col of copy) {
          if (parsed[col.key] !== undefined && !col.disabled) {
            col.visible = parsed[col.key]
          }
        }
      }
    } catch {
      // ignore parse error
    }
  }
  columnList.value = copy
}

function handleColumnChange() {
  if (props.storageKey) {
    const map: Record<string, boolean> = {}
    for (const col of columnList.value) {
      map[col.key] = col.visible
    }
    try {
      localStorage.setItem(props.storageKey, JSON.stringify(map))
    } catch {
      // ignore storage error
    }
  }
  emit('update:columns', columnList.value)
}

function resetColumns() {
  if (!props.columns) return
  columnList.value = props.columns.map(c => ({ ...c }))
  if (props.storageKey) {
    localStorage.removeItem(props.storageKey)
  }
  emit('update:columns', columnList.value)
}

watch(
  () => props.columns,
  () => {
    initColumns()
  },
  { deep: true }
)

onMounted(() => {
  initColumns()
})
</script>
