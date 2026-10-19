<template>
  <div class="theme-sparkline inline-flex items-center" :style="{ width: `${width}px`, height: `${height}px` }">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="w-full h-full overflow-visible"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="themeColor" stop-opacity="0.28" />
          <stop offset="100%" :stop-color="themeColor" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- 柱形微走势模式 -->
      <template v-if="type === 'bar'">
        <rect
          v-for="(bar, idx) in barData"
          :key="idx"
          :x="bar.x"
          :y="bar.y"
          :width="bar.w"
          :height="bar.h"
          :fill="themeColor"
          :rx="barRadius"
          class="transition-all duration-300 hover:opacity-80"
        />
      </template>

      <!-- 折线微走势模式 -->
      <template v-else>
        <!-- 面积渐变底衬 -->
        <polygon
          v-if="filled && areaPath"
          :points="areaPath"
          :fill="`url(#${gradientId})`"
        />
        <!-- 折线本体 -->
        <polyline
          fill="none"
          :stroke="themeColor"
          :stroke-width="strokeWidth"
          stroke-linecap="round"
          stroke-linejoin="round"
          :points="polylinePoints"
        />
        <!-- 终点圆点指示 -->
        <circle
          v-if="showLastDot && lastPoint"
          :cx="lastPoint.x"
          :cy="lastPoint.y"
          :r="strokeWidth + 1.2"
          :fill="themeColor"
          class="animate-pulse"
        />
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    data: number[]
    type?: 'line' | 'bar'
    colorTheme?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
    width?: number
    height?: number
    strokeWidth?: number
    filled?: boolean
    showLastDot?: boolean
    barRadius?: number
  }>(),
  {
    data: () => [10, 20, 15, 30, 25, 40],
    type: 'line',
    colorTheme: 'primary',
    width: 100,
    height: 32,
    strokeWidth: 2,
    filled: true,
    showLastDot: true,
    barRadius: 1.5
  }
)

const uniqueId = Math.random().toString(36).slice(2, 9)
const gradientId = `spark-grad-${uniqueId}`

const themeColor = computed(() => {
  switch (props.colorTheme) {
    case 'success':
      return 'var(--st-success, #15803d)'
    case 'warning':
      return 'var(--st-warning, #b45309)'
    case 'danger':
      return 'var(--st-danger, #be123c)'
    case 'info':
      return 'var(--st-muted, #4b5563)'
    case 'primary':
    default:
      return 'var(--st-primary, #1d4ed8)'
  }
})

// 计算归一化坐标点
const normalizedPoints = computed(() => {
  const list = props.data.length > 0 ? props.data : [0, 0]
  const min = Math.min(...list)
  const max = Math.max(...list)
  const range = max - min === 0 ? 1 : max - min

  const pad = 4
  const availW = props.width - pad * 2
  const availH = props.height - pad * 2
  const step = list.length > 1 ? availW / (list.length - 1) : availW

  return list.map((val, idx) => {
    const x = pad + idx * step
    // Y 轴反转，max 在最顶部
    const y = props.height - pad - ((val - min) / range) * availH
    return { x, y }
  })
})

const polylinePoints = computed(() => {
  return normalizedPoints.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
})

const areaPath = computed(() => {
  if (normalizedPoints.value.length === 0) return ''
  const first = normalizedPoints.value[0]
  const last = normalizedPoints.value[normalizedPoints.value.length - 1]
  const points = polylinePoints.value
  return `${first.x.toFixed(1)},${props.height} ${points} ${last.x.toFixed(1)},${props.height}`
})

const lastPoint = computed(() => {
  if (normalizedPoints.value.length === 0) return null
  return normalizedPoints.value[normalizedPoints.value.length - 1]
})

// 柱状微走势数据计算
const barData = computed(() => {
  const list = props.data.length > 0 ? props.data : [0]
  const min = 0
  const max = Math.max(...list, 1)
  const pad = 2
  const availW = props.width - pad * 2
  const availH = props.height - pad * 2
  const count = list.length
  const gap = 3
  const totalGap = gap * (count - 1)
  const barW = Math.max(2, (availW - totalGap) / count)

  return list.map((val, idx) => {
    const x = pad + idx * (barW + gap)
    const h = Math.max(2, (val / max) * availH)
    const y = props.height - pad - h
    return { x, y, w: barW, h }
  })
})
</script>

<style scoped>
.theme-sparkline {
  vertical-align: middle;
}
</style>
