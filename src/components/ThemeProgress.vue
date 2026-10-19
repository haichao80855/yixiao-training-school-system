<template>
  <div class="theme-progress inline-flex items-center" :class="{ 'flex-col': type === 'ring' && showValue }">
    <!-- 环形进度 -->
    <template v-if="type === 'ring'">
      <div class="relative inline-flex items-center justify-center" :style="{ width: `${size}px`, height: `${size}px` }">
        <svg :viewBox="`0 0 ${size} ${size}`" class="w-full h-full -rotate-90 transform">
          <!-- 背景底环 -->
          <circle
            :cx="size / 2"
            :cy="size / 2"
            :r="radius"
            fill="none"
            :stroke="trackColor"
            :stroke-width="strokeWidth"
          />
          <!-- 进度环 -->
          <circle
            :cx="size / 2"
            :cy="size / 2"
            :r="radius"
            fill="none"
            :stroke="themeColor"
            :stroke-width="strokeWidth"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeDashoffset"
            class="transition-all duration-500 ease-out"
          />
        </svg>
        <!-- 环中文字或插槽 -->
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <slot>
            <span class="text-xs font-bold font-mono text-st-title leading-none">{{ percentage }}%</span>
            <span v-if="label" class="text-[9px] text-st-secondary mt-0.5 leading-none">{{ label }}</span>
          </slot>
        </div>
      </div>
    </template>

    <!-- 条形进度 -->
    <template v-else>
      <div class="w-full flex items-center gap-2">
        <div class="flex-1 bg-gray-100 rounded-full overflow-hidden" :style="{ height: `${strokeWidth}px` }">
          <div
            class="h-full rounded-full transition-all duration-500 ease-out"
            :style="{ width: `${clampedPercentage}%`, backgroundColor: themeColor }"
          />
        </div>
        <span v-if="showValue" class="text-xs font-mono font-medium text-st-title shrink-0">
          {{ percentage }}%
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    percentage: number
    type?: 'ring' | 'bar'
    colorTheme?: 'primary' | 'success' | 'warning' | 'danger'
    size?: number
    strokeWidth?: number
    showValue?: boolean
    label?: string
  }>(),
  {
    percentage: 0,
    type: 'ring',
    colorTheme: 'primary',
    size: 56,
    strokeWidth: 5,
    showValue: true,
    label: ''
  }
)

const clampedPercentage = computed(() => {
  return Math.min(100, Math.max(0, props.percentage))
})

const radius = computed(() => {
  return (props.size - props.strokeWidth) / 2
})

const circumference = computed(() => {
  return 2 * Math.PI * radius.value
})

const strokeDashoffset = computed(() => {
  return circumference.value - (clampedPercentage.value / 100) * circumference.value
})

const themeColor = computed(() => {
  switch (props.colorTheme) {
    case 'success':
      return 'var(--st-success, #15803d)'
    case 'warning':
      return 'var(--st-warning, #b45309)'
    case 'danger':
      return 'var(--st-danger, #be123c)'
    case 'primary':
    default:
      return 'var(--st-primary, #1d4ed8)'
  }
})

const trackColor = computed(() => {
  return '#f1f5f9'
})
</script>

<style scoped>
.theme-progress {
  display: inline-flex;
}
</style>
