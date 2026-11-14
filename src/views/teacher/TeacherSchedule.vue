<template>
  <div v-if="overdueMode" class="tp-stack">
    <PageTitle title="逾期未结课" overline="近 30 天已过上课日期、尚未结课">
      <RouterLink to="/teacher/schedule" replace class="tp-link">看课表</RouterLink>
    </PageTitle>
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

  <div v-else class="tp-stack">
    <PageTitle title="课表" :overline="headerText">
      <button v-if="selectedDate !== today" type="button" class="tp-link" @click="goToday">回到今天</button>
    </PageTitle>

    <div class="schedule">
      <section class="schedule__calendar" aria-label="日历" @touchstart.passive="onSwipeStart" @touchend.passive="onSwipeEnd">
        <div class="cal-head">
          <span class="cal-title tp-num">{{ rangeLabel }}</span>
          <span class="cal-spacer" />
          <button type="button" class="tp-icon-btn" :aria-label="expanded ? '上个月' : '上一周'" @click="shift(-1)"><ChevronLeft aria-hidden="true" /></button>
          <button type="button" class="tp-icon-btn" :aria-label="expanded ? '下个月' : '下一周'" @click="shift(1)"><ChevronRight aria-hidden="true" /></button>
          <button type="button" class="tp-icon-btn" :aria-label="expanded ? '收起月历' : '展开月历'" :aria-expanded="expanded" @click="toggleExpanded">
            <ChevronUp v-if="expanded" aria-hidden="true" />
            <ChevronDown v-else aria-hidden="true" />
          </button>
        </div>
        <div class="tp-card cal-card">
          <div v-if="expanded" class="cal-grid cal-week" aria-hidden="true">
            <span v-for="w in WEEK_NAMES" :key="w">{{ w }}</span>
          </div>
          <div class="cal-grid">
            <button
              v-for="day in days"
              :key="day.date"
              type="button"
              class="day-cell"
              :class="{ 'is-selected': day.date === selectedDate, 'is-other': !day.inMonth, 'is-today': day.date === today }"
              :aria-label="`${friendlyDate(day.date)}${day.hasLesson ? ' 有课' : ''}`"
              :aria-pressed="day.date === selectedDate"
              @click="selectDate(day.date)"
            >
              <span v-if="!expanded" class="day-week" aria-hidden="true">{{ day.weekday }}</span>
              <span class="day-num tp-figure">{{ day.dateNum }}</span>
              <span class="day-dot" :class="{ 'is-hidden': !day.hasLesson }" />
            </button>
          </div>
        </div>
      </section>

      <section class="schedule__list tp-stack">
        <h2 class="tp-section-title">{{ friendlyDate(selectedDate) }}</h2>
        <LoadState
          :loading="lessons.loading.value"
          :error="lessons.error.value"
          :has-data="!!lessons.data.value"
          :is-empty="dayLessons.length === 0"
          empty-text="这天没有课"
          empty-hint="选择带圆点的日期查看课程"
          @retry="lessons.load"
        >
          <LessonTimeline :lessons="dayLessons" />
        </LoadState>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LessonRow from './components/LessonRow.vue'
import LessonTimeline from './components/LessonTimeline.vue'
import LoadState from './components/LoadState.vue'
import PageTitle from './components/PageTitle.vue'
import { formatDateStr, friendlyDate, parseDateStr, shiftDays, todayStr, weekStartStr } from './utils/format'
import { usePageRefresh } from './utils/pageRefresh'
import { useLoad } from './utils/useLoad'

const WEEK_NAMES = ['一', '二', '三', '四', '五', '六', '日']

const route = useRoute()
const authStore = useAuthStore()
const today = ref(todayStr())
const teacherId = authStore.user?.id || ''

// 页面被缓存时 useRoute 会跟着后续路由变化，查询参数只在创建时读取一次
const overdueMode = route.query.filter === 'overdue'
const selectedDate = ref(today.value)
// 电脑屏幕空间充足，默认显示整月
const expanded = ref(window.matchMedia('(min-width: 1024px)').matches)

const anchor = ref(today.value)

const range = computed(() => {
  if (!expanded.value) {
    const start = weekStartStr(anchor.value)
    return { start, end: shiftDays(start, 6) }
  }
  const d = parseDateStr(anchor.value)
  const start = weekStartStr(formatDateStr(new Date(d.getFullYear(), d.getMonth(), 1, 12)))
  const end = shiftDays(weekStartStr(formatDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))), 6)
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
  const result: Array<{ date: string; weekday: string; dateNum: number; inMonth: boolean; hasLesson: boolean }> = []
  for (let cur = range.value.start; cur <= range.value.end; cur = shiftDays(cur, 1)) {
    const d = parseDateStr(cur)
    result.push({
      date: cur,
      weekday: WEEK_NAMES[(d.getDay() + 6) % 7],
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

const rangeLabel = computed(() => {
  if (expanded.value) return `${parseDateStr(anchor.value).getMonth() + 1}月`
  const fmt = (s: string) => {
    const d = parseDateStr(s)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
  return `${fmt(range.value.start)} – ${fmt(range.value.end)}`
})

const dayLessons = computed(() => (lessons.data.value || []).filter((l) => l.date === selectedDate.value))

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
.cal-head {
  display: flex;
  align-items: center;
  gap: var(--tp-space-1);
  margin: 0 -10px var(--tp-space-1) 0;
}
.cal-title {
  font-size: var(--tp-fs-body);
  font-weight: 600;
}
.cal-spacer {
  flex: 1;
}
.cal-card {
  padding: var(--tp-space-2) 6px;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.cal-week {
  padding-bottom: var(--tp-space-1);
  text-align: center;
  font-size: var(--tp-fs-caption);
  color: var(--tp-text-3);
}
/* 星期和日期是一个完整的点按目标，选中时整块填充 */
.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 46px;
  padding: 6px 0;
  border: 0;
  border-radius: var(--tp-radius-md);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--tp-motion), transform var(--tp-motion);
}
.day-cell:active {
  transform: scale(0.96);
}
@media (hover: hover) {
  .day-cell:not(.is-selected):hover {
    background: var(--tp-surface-sunken);
  }
}
.day-week {
  font-size: var(--tp-fs-caption);
  line-height: 16px;
  color: var(--tp-text-3);
}
.day-num {
  font-size: var(--tp-fs-title);
  font-weight: 600;
  line-height: 22px;
  color: var(--tp-text-1);
}
.day-cell.is-today .day-num {
  color: var(--tp-accent);
}
.day-cell.is-other .day-num {
  color: var(--tp-text-placeholder);
  font-weight: 400;
}
.day-cell.is-selected {
  background: var(--tp-accent);
}
.day-cell.is-selected .day-week {
  color: var(--tp-on-hero-2);
}
.day-cell.is-selected .day-num {
  color: var(--tp-on-accent);
}
.day-cell.is-selected .day-dot {
  background: var(--tp-on-accent);
}
.day-dot {
  width: 5px;
  height: 5px;
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
