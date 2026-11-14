<template>
  <div class="tp-stack">
    <PageTitle title="课评" :overline="rangeText" />

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

    <!-- 搜索与时间范围放在同一行：筛选只占两行，列表更早出现在屏幕上 -->
    <div class="filter-row">
      <SearchBox v-model="keyword" class="tp-grow" placeholder="搜索姓名、学号" @search="roster.load" />
      <label class="range-select">
        <span class="sr-only">时间范围</span>
        <select class="tp-num" :value="rangeKey" @change="setRange(($event.target as HTMLSelectElement).value as RangeKey)">
          <option v-for="r in RANGES" :key="r.key" :value="r.key">{{ r.label }}</option>
        </select>
        <ChevronDown aria-hidden="true" />
      </label>
    </div>

    <LoadState
      :loading="roster.loading.value"
      :error="roster.error.value"
      :has-data="!!roster.data.value"
      :is-empty="roster.data.value?.items.length === 0"
      :empty-text="status === 'pending' ? '这段时间没有待写的课评' : '这段时间没有已结课的到课记录'"
      empty-hint="结课后，到课学员会出现在这里"
      @retry="roster.load"
    >
      <!-- 按课次分组：老师是一节课一节课地写课评 -->
      <section v-for="group in lessonGroups" :key="group.scheduleId">
        <div class="tp-section-head group-head">
          <h2 class="tp-section-title group-title">{{ group.className }}</h2>
          <span class="tp-text-meta tp-num tp-shrink-0">{{ friendlyDate(group.date) }} {{ shortTime(group.startTime) }}</span>
        </div>
        <div class="tp-list">
          <RouterLink
            v-for="item in group.items"
            :key="item.studentId"
            :to="`/teacher/lessons/${item.scheduleId}/${item.isPushed ? 'review' : 'evaluate'}/${item.studentId}`"
            class="tp-row"
          >
            <TpAvatar :name="item.studentName" :seed="item.studentId" />
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
import TpAvatar from './components/TpAvatar.vue'
import { computed, onActivated, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { teacherPortalApi, type EvaluationRosterItem } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LoadState from './components/LoadState.vue'
import PageTitle from './components/PageTitle.vue'
import SearchBox from './components/SearchBox.vue'
import { readDraft } from './utils/evaluationDraft'
import { friendlyDate, shiftDays, shortTime, todayStr, weekStartStr } from './utils/format'
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

const today = ref(todayStr())
const rangeKey = ref<RangeKey>(route.query.range === '30' ? '30' : 'week')
// 默认看还没写的：这个页面的首要任务是把课评写完
const status = ref<StatusKey>('pending')
const keyword = ref('')

function dateRange(key: RangeKey) {
  const now = todayStr()
  if (key === '30') return { startDate: shiftDays(now, -30), endDate: now }
  const monday = weekStartStr(now)
  if (key === 'lastWeek') return { startDate: shiftDays(monday, -7), endDate: shiftDays(monday, -1) }
  return { startDate: monday, endDate: now }
}

/** 标题上方写当前列表的时间范围，与下方的时间筛选对应 */
const rangeText = computed(() => {
  // 依赖 today：跨过零点后回到页面时范围随之更新
  void today.value
  const { startDate, endDate } = dateRange(rangeKey.value)
  const md = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`
  return startDate === endDate ? md(startDate) : `${md(startDate)} – ${md(endDate)}`
})

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
// 手机页面可能隔天还开着：每次回到页面都重新取「今天」
onActivated(() => {
  today.value = todayStr()
  return roster.load()
})
</script>

<style scoped>
.filter-row {
  display: flex;
  gap: var(--tp-space-2);
}
/* 与搜索框同高、同描边：看起来是一组筛选；点开是系统自带的选择器，手机上最顺手 */
.range-select {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.range-select select {
  min-height: var(--tp-control);
  padding: 0 32px 0 var(--tp-space-3);
  border: 1px solid var(--tp-line-strong);
  border-radius: var(--tp-radius-md);
  background: var(--tp-surface);
  color: var(--tp-text-1);
  font-size: var(--tp-fs-input);
  font-family: inherit;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}
.range-select select:focus-visible {
  border-color: var(--tp-accent);
  outline: 2px solid var(--tp-accent-soft);
}
.range-select svg {
  position: absolute;
  right: var(--tp-space-2);
  width: var(--tp-icon-sm);
  height: var(--tp-icon-sm);
  color: var(--tp-text-3);
  pointer-events: none;
}
.group-head {
  min-height: 36px;
  margin-bottom: var(--tp-space-1);
}
.group-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tp-fs-control);
}
</style>
