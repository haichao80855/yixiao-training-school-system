<template>
  <div>
    <template v-if="overdueMode">
      <div class="tp-card flex items-center justify-between gap-3 mb-3">
        <p class="m-0 text-[14px] text-st-secondary">近 30 天已过上课日期、尚未结课的课次</p>
        <RouterLink to="/teacher/schedule" replace class="tp-btn tp-btn-secondary tp-btn-sm">看课表</RouterLink>
      </div>
      <LoadState
        :loading="overdue.loading.value"
        :error="overdue.error.value"
        :has-data="!!overdue.data.value"
        :is-empty="overdue.data.value?.length === 0"
        empty-text="没有逾期未结课的课次"
        @retry="overdue.load"
      >
        <div class="grid gap-2.5">
          <LessonCard v-for="lesson in overdue.data.value" :key="lesson.id" :lesson="lesson" show-date />
        </div>
      </LoadState>
    </template>

    <template v-else>
      <section class="tp-card !p-3" @touchstart.passive="onSwipeStart" @touchend.passive="onSwipeEnd">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[15px] font-semibold text-st-title tabular-nums">{{ headerText }}</span>
          <div class="flex items-center gap-1">
            <button type="button" class="cal-nav" aria-label="上一段" @click="shift(-1)"><ChevronLeft class="w-5 h-5" /></button>
            <button type="button" class="tp-btn tp-btn-secondary tp-btn-sm" @click="goToday">今天</button>
            <button type="button" class="cal-nav" aria-label="下一段" @click="shift(1)"><ChevronRight class="w-5 h-5" /></button>
            <button type="button" class="cal-nav" :aria-label="expanded ? '收起月历' : '展开月历'" @click="toggleExpanded">
              <ChevronUp v-if="expanded" class="w-5 h-5" />
              <ChevronDown v-else class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-7 mt-2">
          <span v-for="w in WEEK_NAMES" :key="w" class="text-center text-[12px] text-st-muted">{{ w }}</span>
        </div>
        <div class="grid grid-cols-7 mt-1 gap-y-0.5">
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
            <span class="day-num" :class="{ 'is-today': day.date === today }">{{ day.dateNum }}</span>
            <span class="day-dot" :class="{ 'opacity-0': !day.hasLesson }" />
          </button>
        </div>
      </section>

      <div class="tp-segment mt-3" role="group" aria-label="课次状态筛选">
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

      <h2 class="tp-section-title !mt-3">{{ friendlyDate(selectedDate) }}</h2>
      <LoadState
        :loading="lessons.loading.value"
        :error="lessons.error.value"
        :has-data="!!lessons.data.value"
        :is-empty="dayLessons.length === 0"
        empty-text="当天没有符合条件的课次"
        @retry="lessons.load"
      >
        <div class="grid gap-2.5">
          <LessonCard v-for="lesson in dayLessons" :key="lesson.id" :lesson="lesson" />
        </div>
      </LoadState>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LessonCard from './components/LessonCard.vue'
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
const expanded = ref(false)
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
.cal-nav {
  width: 40px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--st-color-secondary);
  cursor: pointer;
}
.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 46px;
  padding: 3px 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}
.day-num {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  color: var(--st-color-title);
  font-variant-numeric: tabular-nums;
}
.day-num.is-today {
  color: var(--st-color-primary-active);
  font-weight: 700;
}
.day-cell.is-other .day-num {
  color: var(--st-color-placeholder);
}
.day-cell.is-selected .day-num {
  background: var(--st-color-primary-active);
  color: #fff;
  font-weight: 600;
}
.day-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--st-color-primary-hover);
}
</style>
