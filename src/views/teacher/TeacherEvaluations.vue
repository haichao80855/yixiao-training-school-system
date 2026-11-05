<template>
  <div>
    <div class="grid grid-cols-3 gap-2 mb-3">
      <button
        v-for="m in metricCards"
        :key="m.key"
        type="button"
        class="tp-card !p-2.5 text-left cursor-pointer"
        :class="{ '!border-st-primary': status === m.key }"
        :aria-pressed="status === m.key"
        @click="setStatus(m.key)"
      >
        <span class="block text-[20px] leading-tight font-semibold text-st-title tabular-nums">{{ m.value }}</span>
        <span class="block text-[12px] text-st-muted">{{ m.label }}</span>
      </button>
    </div>

    <div class="tp-segment mb-2.5" role="group" aria-label="时间范围">
      <button
        v-for="r in RANGES"
        :key="r.key"
        type="button"
        class="tp-segment-item"
        :class="{ 'is-active': rangeKey === r.key }"
        :aria-pressed="rangeKey === r.key"
        @click="setRange(r.key)"
      >
        {{ r.label }}
      </button>
    </div>

    <div class="tp-search mb-3">
      <Search />
      <input v-model="keyword" class="tp-input" type="search" placeholder="搜索学员姓名、学号" aria-label="搜索学员" @input="onKeywordInput" />
    </div>

    <LoadState
      :loading="roster.loading.value"
      :error="roster.error.value"
      :has-data="!!roster.data.value"
      :is-empty="roster.data.value?.items.length === 0"
      :empty-text="status === 'pending' ? '这段时间没有待写课评' : '这段时间没有已结课的到课记录'"
      @retry="roster.load"
    >
      <div class="grid gap-2">
        <RouterLink
          v-for="item in roster.data.value?.items"
          :key="`${item.scheduleId}-${item.studentId}`"
          :to="`/teacher/lessons/${item.scheduleId}/${item.isPushed ? 'review' : 'evaluate'}/${item.studentId}`"
          class="tp-card flex items-center gap-3 no-underline text-inherit active:bg-st-header"
        >
          <div class="min-w-0 flex-1">
            <p class="m-0 text-[15px] font-medium text-st-title break-words">
              {{ item.studentName }}
              <span class="text-[12px] font-normal text-st-muted tabular-nums">{{ item.studentNo }}</span>
            </p>
            <p class="m-0 mt-0.5 text-[13px] text-st-muted break-words">
              {{ friendlyDate(item.date) }} {{ shortTime(item.startTime) }} · {{ item.className }}
            </p>
          </div>
          <span class="tp-tag" :class="tagClass(item)">{{ tagText(item) }}</span>
        </RouterLink>
      </div>
    </LoadState>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { teacherPortalApi, type EvaluationRosterItem } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LoadState from './components/LoadState.vue'
import { readDraft } from './utils/evaluationDraft'
import { friendlyDate, parseDateStr, shiftDays, shortTime, todayStr } from './utils/format'
import { useLoad } from './utils/useLoad'

const RANGES = [
  { key: 'week', label: '本周' },
  { key: 'lastWeek', label: '上周' },
  { key: '30', label: '近 30 天' },
] as const
type RangeKey = (typeof RANGES)[number]['key']
type StatusKey = 'all' | 'pending' | 'pushed'

const route = useRoute()
const authStore = useAuthStore()
const userId = authStore.user?.id || ''

const rangeKey = ref<RangeKey>(route.query.range === '30' ? '30' : 'week')
const status = ref<StatusKey>(route.query.status === 'pending' ? 'pending' : 'all')
const keyword = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function dateRange(key: RangeKey) {
  const today = todayStr()
  if (key === '30') return { startDate: shiftDays(today, -30), endDate: today }
  const sunday = shiftDays(today, -parseDateStr(today).getDay())
  if (key === 'lastWeek') return { startDate: shiftDays(sunday, -7), endDate: shiftDays(sunday, -1) }
  return { startDate: sunday, endDate: today }
}

const roster = useLoad(async () => {
  const res = await teacherPortalApi.getEvaluations({
    ...dateRange(rangeKey.value),
    status: status.value === 'all' ? undefined : status.value,
    keyword: keyword.value.trim() || undefined,
  })
  return res.data
})

const metricCards = computed(() => {
  const m = roster.data.value?.metrics
  return [
    { key: 'all' as const, label: '全部人次', value: m?.totalCount ?? 0 },
    { key: 'pending' as const, label: '待写课评', value: m?.pendingCount ?? 0 },
    { key: 'pushed' as const, label: '已推送', value: m?.pushedCount ?? 0 },
  ]
})

function hasDraft(item: EvaluationRosterItem) {
  return !item.isPushed && !!readDraft(userId, item.scheduleId, item.studentId)?.comment.trim()
}

function tagText(item: EvaluationRosterItem) {
  if (item.isPushed) return '已推送'
  return hasDraft(item) ? '有草稿' : '待写'
}

function tagClass(item: EvaluationRosterItem) {
  if (item.isPushed) return 'tp-tag-success'
  return hasDraft(item) ? 'tp-tag-primary' : 'tp-tag-warning'
}

function setStatus(next: StatusKey) {
  status.value = next
  roster.load()
}

function setRange(next: RangeKey) {
  rangeKey.value = next
  roster.load()
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(roster.load, 300)
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

onMounted(roster.load)
</script>
