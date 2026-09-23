<template>
  <div class="high-density-grid bg-white rounded-lg p-3.5 shadow-card border border-st-border space-y-2.5">
    <!-- 网格核心排布区 -->
    <div
      class="grid gap-2"
      :class="gridColsClass"
    >
      <slot />
    </div>

    <!-- 底部操作/筛选联动工具栏 -->
    <div
      v-if="$slots.footer"
      class="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-gray-100"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    cols?: number
  }>(),
  {
    cols: 8
  }
)

const gridColsClass = computed(() => {
  switch (props.cols) {
    case 4:
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    case 6:
      return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
    case 8:
    default:
      return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8'
  }
})
</script>

<style scoped>
.high-density-grid :deep(.el-input__wrapper),
.high-density-grid :deep(.el-select__wrapper),
.high-density-grid :deep(.el-date-editor.el-input__wrapper) {
  height: 32px;
  line-height: 32px;
  font-size: 12px;
  padding: 0 8px;
}

.high-density-grid :deep(.el-input__inner) {
  font-size: 12px;
}

.high-density-grid :deep(.el-select) {
  width: 100%;
}
</style>
