<template>
  <div class="panel-card">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="panel-title">教学经营指标</h2>
        <p class="mt-0.5 text-xs text-st-muted">按排课日期统计 {{ rangeLabel }}，只算已点名的课次</p>
      </div>
      <el-segmented v-model="period" :options="PERIOD_OPTIONS" @change="load" />
    </div>

    <div v-if="loadError" class="flex items-center justify-between gap-3 rounded-lg bg-st-danger-light px-4 py-3 text-[13px] text-st-danger">
      <span>{{ loadError }}</span>
      <el-button size="small" @click="load">重新加载</el-button>
    </div>

    <div v-else v-loading="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <component
        :is="tile.path ? 'button' : 'div'"
        v-for="tile in tiles"
        :key="tile.key"
        :type="tile.path ? 'button' : undefined"
        :class="['metric-tile text-left', tile.path ? 'metric-tile--link' : '']"
        :title="tile.definition"
        @click="tile.path && router.push(tile.path)"
      >
        <div class="flex items-center justify-between text-[13px] text-st-secondary">
          <span>{{ tile.label }}</span>
          <ChevronRight v-if="tile.path" class="w-4 h-4 text-st-placeholder" />
        </div>
        <div class="mt-2 flex items-baseline gap-1">
          <template v-if="tile.rate !== null">
            <span :class="['text-[28px] font-semibold tabular-nums leading-none', tile.tone]">{{ tile.rate }}</span>
            <span class="text-[13px] text-st-muted">%</span>
          </template>
          <span v-else class="text-[15px] text-st-placeholder leading-[28px]">暂无数据</span>
        </div>
        <p class="mt-2 text-xs text-st-muted tabular-nums">{{ tile.detail }}</p>
      </component>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'
import { educationalApi } from '@/api'
import type { TeachingMetrics } from '@/api/modules/educational'
import { useLoadState } from '@/composables/useLoadState'
import { toDateKey, mondayOf } from '@/utils/dateKey'
import { useAuthStore } from '@/stores/authStore'

type Period = 'week' | 'month' | 'lastMonth'

const PERIOD_OPTIONS = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '上月', value: 'lastMonth' },
]

const router = useRouter()
const authStore = useAuthStore()
const { loading, loadError, track } = useLoadState()

const period = ref<Period>('month')
const metrics = ref<TeachingMetrics | null>(null)

function rangeOf(p: Period): { start: string; end: string } {
  const today = new Date()
  if (p === 'week') {
    const monday = mondayOf(today)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { start: toDateKey(monday), end: toDateKey(sunday) }
  }
  const offset = p === 'lastMonth' ? -1 : 0
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const last = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0)
  return { start: toDateKey(first), end: toDateKey(last) }
}

const rangeLabel = computed(() => {
  const { start, end } = rangeOf(period.value)
  return `${start.slice(5)} 至 ${end.slice(5)}`
})

function load() {
  return track(async () => {
    const res = await educationalApi.getTeachingMetrics(rangeOf(period.value))
    metrics.value = res.data
  })
}

/** 有权限才给跳转，免得点进去被送回首页 */
function linkIfAllowed(path: string): string | undefined {
  const required = router.resolve(path).meta.requiresPermission as string | string[] | undefined
  return !required || authStore.hasAnyPermission(required) ? path : undefined
}

const tiles = computed(() => {
  const m = metrics.value
  const n = (v: number | undefined) => (v ?? 0).toLocaleString()
  return [
    {
      key: 'attendance',
      label: '到课率',
      rate: m?.attendance.rate ?? null,
      tone: 'text-st-title',
      detail: `到课 ${n(m?.attendance.numerator)} / 应到 ${n(m?.attendance.denominator)} 人次 · ${n(m?.lessonCount)} 节课`,
      definition: '到课率 = (出勤 + 迟到) ÷ 点名总人次，反结课冲正的记录不算',
      path: linkIfAllowed('/educational/attendance'),
    },
    {
      key: 'leave',
      label: '请假率',
      rate: m?.leave.rate ?? null,
      tone: 'text-st-title',
      detail: `请假 ${n(m?.leave.numerator)} 人次 · 缺勤 ${n(m?.absentCount)} 人次`,
      definition: '请假率 = 请假人次 ÷ 点名总人次；缺勤指既没请假也没到',
      path: linkIfAllowed('/educational/attendance'),
    },
    {
      key: 'evaluationView',
      label: '课评查看率',
      rate: m?.evaluationView.rate ?? null,
      tone: 'text-st-title',
      detail: `家长看过 ${n(m?.evaluationView.numerator)} / 已发布 ${n(m?.evaluationView.denominator)} 份`,
      definition: '课评查看率 = 有家长在家长端打开过的学员课评 ÷ 已发布的学员课评',
      path: undefined,
    },
    {
      key: 'classFill',
      label: '满班率',
      rate: m?.classFill.rate ?? null,
      tone: 'text-st-title',
      detail: `在读 ${n(m?.classFill.numerator)} / 容量 ${n(m?.classFill.denominator)} · 满班 ${n(m?.fullClassCount)} / ${n(m?.activeClassCount)} 个班`,
      definition: '满班率 = 在读人数 ÷ 班级容量，只算招生中和上课中的班级，不受统计区间影响',
      path: linkIfAllowed('/educational/classManagement'),
    },
  ]
})

onMounted(load)
</script>

<style scoped>
.panel-card {
  padding: 20px;
  background: var(--st-color-card);
  border: 1px solid var(--st-color-border);
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-card);
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--st-color-title);
}
.metric-tile {
  padding: 14px 16px;
  border-radius: var(--st-radius-md, 10px);
  background: var(--st-color-header);
  border: 1px solid transparent;
  transition: border-color var(--st-transition), background-color var(--st-transition);
}
.metric-tile--link {
  cursor: pointer;
}
.metric-tile--link:hover {
  background: var(--st-color-card);
  border-color: var(--st-color-border-dark);
}
</style>
