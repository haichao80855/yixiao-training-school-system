<template>
  <div class="tp-stack">
    <div class="tp-segment" role="group" aria-label="课评状态">
      <button
        v-for="m in metricCards"
        :key="m.key"
        type="button"
        class="tp-segment-item"
        :class="{ 'is-active': status === m.key }"
        :aria-pressed="status === m.key"
        @click="setStatus(m.key)"
      >
        {{ m.label }} <span class="tp-count">{{ m.value }}</span>
      </button>
    </div>

    <SearchBox v-model="keyword" placeholder="搜索学员姓名、学号" @search="roster.load" />

    <div class="tp-chips" role="group" aria-label="时间范围">
      <button
        v-for="r in RANGES"
        :key="r.key"
        type="button"
        class="tp-chip"
        :class="{ 'is-active': rangeKey === r.key }"
        :aria-pressed="rangeKey === r.key"
        @click="setRange(r.key)"
      >
        {{ r.label }}
      </button>
    </div>

    <LoadState
      :loading="roster.loading.value"
      :error="roster.error.value"
      :has-data="!!roster.data.value"
      :is-empty="roster.data.value?.items.length === 0"
      :empty-text="status === 'pending' ? '这段时间的课评都写完了' : '这段时间没有已结课的到课记录'"
      @retry="roster.load"
    >
      <!-- 按课次分组：老师是一节课一节课地写课评 -->
      <section v-for="group in lessonGroups" :key="group.scheduleId">
        <div class="tp-section-head group-head">
          <h2 class="tp-section-title group-title">{{ group.className }}</h2>
          <span class="tp-text-meta tp-num" style="flex-shrink: 0">{{ friendlyDate(group.date) }} {{ shortTime(group.startTime) }}</span>
        </div>
        <div class="tp-list">
          <RouterLink
            v-for="item in group.items"
            :key="item.studentId"
            :to="`/teacher/lessons/${item.scheduleId}/${item.isPushed ? 'review' : 'evaluate'}/${item.studentId}`"
            class="tp-row"
          >
            <span class="tp-avatar" aria-hidden="true">{{ item.studentName.slice(0, 1) }}</span>
            <span class="tp-row__body">
              <p class="tp-row__title">{{ item.studentName }}</p>
              <p class="tp-row__meta tp-num">{{ item.studentNo }}</p>
            </span>
            <span class="tp-tag" :class="tagClass(item)">{{ tagText(item) }}</span>
            <ChevronRight class="tp-row__chevron" aria-hidden="true" />
          </RouterLink>
        </div>
      </section>
    </LoadState>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'
import { teacherPortalApi, type EvaluationRosterItem } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LoadState from './components/LoadState.vue'
import SearchBox from './components/SearchBox.vue'
import { readDraft } from './utils/evaluationDraft'
import { friendlyDate, parseDateStr, shiftDays, shortTime, todayStr } from './utils/format'
import { usePageRefresh } from './utils/pageRefresh'
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
// 默认看还没写的：这个页面的首要任务是把课评写完
const status = ref<StatusKey>('pending')
const keyword = ref('')

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
    { key: 'pending' as const, label: '待写', value: m?.pendingCount ?? 0 },
    { key: 'pushed' as const, label: '已推送', value: m?.pushedCount ?? 0 },
    { key: 'all' as const, label: '全部', value: m?.totalCount ?? 0 },
  ]
})

const lessonGroups = computed(() => {
  const groups = new Map<string, { scheduleId: string; className: string; date: string; startTime: string; items: EvaluationRosterItem[] }>()
  for (const item of roster.data.value?.items || []) {
    const group = groups.get(item.scheduleId)
    if (group) group.items.push(item)
    else groups.set(item.scheduleId, { scheduleId: item.scheduleId, className: item.className, date: item.date, startTime: item.startTime, items: [item] })
  }
  return Array.from(groups.values())
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

usePageRefresh(roster.load)
onActivated(roster.load)
</script>

<style scoped>
.group-head {
  min-height: 36px;
  margin-bottom: var(--tp-space-1);
}
.group-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
</style>
