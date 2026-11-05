<template>
  <div v-if="overdueMode" class="tp-stack">
    <div class="tp-section-head" style="margin: 0">
      <p class="tp-text-small" style="margin: 0">近 30 天已过上课日期、尚未结课的课次</p>
      <RouterLink to="/teacher/schedule" replace class="tp-link">看课表</RouterLink>
    </div>
    <LoadState
      :loading="overdue.loading.value"
      :error="overdue.error.value"
      :has-data="!!overdue.data.value"
      :is-empty="overdue.data.value?.length === 0"
      empty-text="没有逾期未结课的课次"
      @retry="overdue.load"
    >
      <div class="tp-list">
        <LessonRow v-for="lesson in overdue.data.value" :key="lesson.id" :lesson="lesson" show-date />
      </div>
    </LoadState>
  </div>

  <div v-else class="schedule">
    <section class="tp-card schedule__calendar" aria-label="日历" @touchstart.passive="onSwipeStart" @touchend.passive="onSwipeEnd">
      <div class="cal-head">
        <span class="cal-title tp-num">{{ headerText }}</span>
        <button v-if="selectedDate !== today" type="button" class="tp-link" @click="goToday">回到今天</button>
        <span class="cal-spacer" />
        <button type="button" class="tp-icon-btn" :aria-label="expanded ? '上个月' : '上一周'" @click="shift(-1)"><ChevronLeft aria-hidden="true" /></button>
        <button type="button" class="tp-icon-btn" :aria-label="expanded ? '下个月' : '下一周'" @click="shift(1)"><ChevronRight aria-hidden="true" /></button>
        <button type="button" class="tp-icon-btn" :aria-label="expanded ? '收起月历' : '展开月历'" :aria-expanded="expanded" @click="toggleExpanded">
          <ChevronUp v-if="expanded" aria-hidden="true" />
          <ChevronDown v-else aria-hidden="true" />
        </button>
      </div>
      <div class="cal-grid cal-week" aria-hidden="true">
        <span v-for="w in WEEK_NAMES" :key="w">{{ w }}</span>
      </div>
      <div class="cal-grid">
        <button
          v-for="day in days"
          :key="day.date"
          type="button"
          class="day-cell"
          :class="{ 'is-selected': day.date === selectedDate, 'is-other': !day.inMonth }"
          :aria-label="`${day.date}${day.hasLesson ? ' 有课' : ''}`"
          :aria-pressed="day.date === selectedDate"
          @click="selectDate(day.date)"
        >
          <span class="day-num tp-num" :class="{ 'is-today': day.date === today }">{{ day.dateNum }}</span>
          <span class="day-dot" :class="{ 'is-hidden': !day.hasLesson }" />
        </button>
      </div>
    </section>

    <section class="schedule__list tp-stack">
      <h2 class="tp-section-title">{{ friendlyDate(selectedDate) }}</h2>
      <div class="tp-segment" role="group" aria-label="课次状态筛选">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="tp-segment-item"
          :class="{ 'is-active': statusFilter === f.key }"
          :aria-pressed="statusFilter === f.key"
          @click="statusFilter = f.key"
        >
          {{ f.label }}
        </button>
      </div>
      <LoadState
        :loading="lessons.loading.value"
        :error="lessons.error.value"
        :has-data="!!lessons.data.value"
        :is-empty="dayLessons.length === 0"
        :empty-text="statusFilter === 'all' ? '这天没有课' : '这天没有符合条件的课次'"
        @retry="lessons.load"
      >
        <div class="tp-list">
          <LessonRow v-for="lesson in dayLessons" :key="lesson.id" :lesson="lesson" />
        </div>
      </LoadState>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LessonRow from './components/LessonRow.vue'
import LoadState from './components/LoadState.vue'
import { formatDateStr, friendlyDate, parseDateStr, shiftDays, todayStr } from './utils/format'
import { usePageRefresh } from './utils/pageRefresh'
import { useLoad } from './utils/useLoad'

const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '未上' },
  { key: 'completed', label: '已结课' },
] as const

const route = useRoute()
const authStore = useAuthStore()
const today = ref(todayStr())
const teacherId = authStore.user?.id || ''

// 页面被缓存时 useRoute 会跟着后续路由变化，查询参数只在创建时读取一次
const overdueMode = route.query.filter === 'overdue'
const selectedDate = ref(today.value)
// 电脑屏幕空间充足，默认显示整月
const expanded = ref(window.matchMedia('(min-width: 1024px)').matches)
const statusFilter = ref<(typeof FILTERS)[number]['key']>('all')

function weekStart(date: string) {
  return shiftDays(date, -parseDateStr(date).getDay())
}

const anchor = ref(today.value)

const range = computed(() => {
  if (!expanded.value) {
    const start = weekStart(anchor.value)
    return { start, end: shiftDays(start, 6) }
  }
  const d = parseDateStr(anchor.value)
  const start = weekStart(formatDateStr(new Date(d.getFullYear(), d.getMonth(), 1, 12)))
  const end = shiftDays(weekStart(formatDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))), 6)
  return { start, end }
})

const lessons = useLoad(() =>
  teacherPortalApi.getMyLessons({ teacherId, startDate: range.value.start, endDate: range.value.end }),
)
const overdue = useLoad(async () => {
  const list = await teacherPortalApi.getMyLessons({
    teacherId,
    startDate: shiftDays(today.value, -30),
    endDate: shiftDays(today.value, -1),
  })
  return list.filter((l) => l.status !== 'completed').reverse()
})

const lessonDates = computed(() => new Set((lessons.data.value || []).map((l) => l.date)))

const days = computed(() => {
  const month = parseDateStr(anchor.value).getMonth()
  const result: Array<{ date: string; dateNum: number; inMonth: boolean; hasLesson: boolean }> = []
  for (let cur = range.value.start; cur <= range.value.end; cur = shiftDays(cur, 1)) {
    const d = parseDateStr(cur)
    result.push({
      date: cur,
      dateNum: d.getDate(),
      inMonth: !expanded.value || d.getMonth() === month,
      hasLesson: lessonDates.value.has(cur),
    })
  }
  return result
})

const headerText = computed(() => {
  const d = parseDateStr(anchor.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const dayLessons = computed(() =>
  (lessons.data.value || []).filter((l) => {
    if (l.date !== selectedDate.value) return false
    if (statusFilter.value === 'completed') return l.status === 'completed'
    if (statusFilter.value === 'pending') return l.status !== 'completed'
    return true
  }),
)

function selectDate(date: string) {
  selectedDate.value = date
  anchor.value = date
}

function shift(direction: 1 | -1) {
  if (expanded.value) {
    const d = parseDateStr(anchor.value)
    const target = new Date(d.getFullYear(), d.getMonth() + direction, 1, 12)
    // 翻到当前月时回到今天，否则默认选该月 1 号
    const now = parseDateStr(today.value)
    const isCurrentMonth = target.getMonth() === now.getMonth() && target.getFullYear() === now.getFullYear()
    selectDate(isCurrentMonth ? today.value : formatDateStr(target))
  } else {
    selectDate(shiftDays(selectedDate.value, direction * 7))
  }
}

function goToday() {
  today.value = todayStr()
  selectDate(today.value)
}

// 日历区域左右滑动翻周 / 翻月
let swipeStart: { x: number; y: number } | null = null
function onSwipeStart(event: TouchEvent) {
  swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }
}
function onSwipeEnd(event: TouchEvent) {
  if (!swipeStart) return
  const dx = event.changedTouches[0].clientX - swipeStart.x
  const dy = event.changedTouches[0].clientY - swipeStart.y
  swipeStart = null
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) shift(dx < 0 ? 1 : -1)
}

function toggleExpanded() {
  expanded.value = !expanded.value
  anchor.value = selectedDate.value
}

// range 每次重算都是新对象：按日期值比较，同一周内切换日期不重新请求
watch(() => `${range.value.start}|${range.value.end}`, () => lessons.load())

function refresh() {
  today.value = todayStr()
  return overdueMode ? overdue.load() : lessons.load()
}

usePageRefresh(refresh)
onActivated(refresh)
</script>

<style scoped>
.schedule {
  display: flex;
  flex-direction: column;
  gap: var(--tp-space-4);
}
.schedule__calendar {
  padding: var(--tp-space-2) var(--tp-space-2) var(--tp-space-2) var(--tp-space-4);
}
.cal-head {
  display: flex;
  align-items: center;
  gap: var(--tp-space-1);
}
.cal-title {
  font-size: var(--tp-fs-body);
  font-weight: 600;
}
.cal-spacer {
  flex: 1;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin-left: calc(-1 * var(--tp-space-2));
}
.cal-week {
  margin-top: var(--tp-space-1);
  text-align: center;
  font-size: var(--tp-fs-caption);
  color: var(--tp-text-3);
}
.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 48px;
  padding: var(--tp-space-1) 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}
.day-num {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--tp-radius-sm);
  font-size: 14px;
  color: var(--tp-text-1);
  transition: background var(--tp-motion);
}
.day-cell:hover .day-num {
  background: var(--tp-surface-sunken);
}
.day-num.is-today {
  color: var(--tp-accent);
  font-weight: 700;
}
.day-cell.is-other .day-num {
  color: var(--tp-text-placeholder);
}
.day-cell.is-selected .day-num {
  background: var(--tp-accent);
  color: #fff;
  font-weight: 600;
}
.day-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--tp-accent);
}
.day-dot.is-hidden {
  visibility: hidden;
}
@media (min-width: 1024px) {
  .schedule {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    align-items: start;
    gap: var(--tp-space-6);
  }
  .schedule__calendar {
    position: sticky;
    top: 0;
  }
}
</style>
