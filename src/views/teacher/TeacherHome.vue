<template>
  <div class="home">
    <PageTitle class="home__intro" :title="`${greeting}，${authStore.user?.realName ?? ''}`" :overline="`${friendlyDate(today)} · ${authStore.user?.campusName ?? ''}`">
      <RouterLink to="/teacher/me" replace class="home__me tp-pressable" aria-label="我的">
        <TpAvatar :name="authStore.user?.realName" :seed="authStore.user?.id" size="lg" />
      </RouterLink>
    </PageTitle>

    <div class="home__primary tp-stack">
      <LoadState :loading="lessons.loading.value" :error="lessons.error.value" :has-data="!!lessons.data.value" skeleton="hero" @retry="lessons.load">
        <!-- 全页唯一的主角：下一节课 -->
        <section v-if="nextLesson" class="hero" aria-label="下一节课">
          <div class="hero__head">
            <span class="hero__status" :class="`is-${lessonPhase.tone}`"><i class="hero__dot" aria-hidden="true" />{{ lessonPhase.label }}</span>
            <span class="hero__count tp-num">{{ nextLesson.expectedCount }} 人</span>
          </div>
          <p class="hero__time tp-figure">
            {{ shortTime(nextLesson.startTime) }}<span class="hero__end">–{{ shortTime(nextLesson.endTime) }}</span>
          </p>
          <p class="hero__class">{{ nextLesson.className }}</p>
          <p class="hero__meta">
            <template v-if="nextLesson.lessonNumber">第{{ nextLesson.lessonNumber }}讲<template v-if="nextLesson.lessonTitle"> {{ nextLesson.lessonTitle }}</template> · </template>{{ nextLesson.classroomName }}
          </p>
          <div
            v-if="lessonPhase.progress !== null"
            class="hero__progress"
            role="progressbar"
            aria-label="本节课进度"
            :aria-valuenow="Math.round(lessonPhase.progress * 100)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <i :style="{ transform: `scaleX(${lessonPhase.progress})` }" />
          </div>
          <RouterLink :to="`/teacher/lessons/${nextLesson.id}`" class="tp-btn tp-btn-primary tp-btn-block hero__action">
            {{ nextLesson.actualCount > 0 ? '继续点名' : '开始点名' }}
          </RouterLink>
        </section>
        <section v-else class="tp-card">
          <p class="tp-row__title">{{ todayLessons.length > 0 ? '今天的课都上完了' : '今天没有课' }}</p>
          <RouterLink to="/teacher/schedule" replace class="tp-link home__more">查看课表<ChevronRight :size="16" aria-hidden="true" /></RouterLink>
        </section>
      </LoadState>
    </div>

    <!-- 紧跟下一节课：逾期未结课不能被今天的课程列表压到首屏以下；没有待办时退到最后 -->
    <section class="home__todos" :class="{ 'is-clear': overview.data.value && pendingTodos.length === 0 }">
      <div class="tp-section-head">
        <h2 class="tp-section-title">待处理</h2>
      </div>
      <LoadState :loading="overview.loading.value" :error="overview.error.value" :has-data="!!overview.data.value" :rows="1" @retry="overview.load">
        <div v-if="pendingTodos.length > 0" class="tp-list">
          <RouterLink v-for="todo in pendingTodos" :key="todo.label" :to="todo.to" replace class="tp-row">
            <span class="tp-icon-tile" :class="todo.tone === 'accent' ? '' : `tp-icon-tile--${todo.tone}`"><component :is="todo.icon" aria-hidden="true" /></span>
            <span class="tp-row__body">
              <p class="tp-row__title">{{ todo.label }}</p>
              <p class="tp-row__meta">{{ todo.hint }}</p>
            </span>
            <span class="todo-count tp-figure">{{ todo.count }}</span>
            <ChevronRight class="tp-row__chevron" aria-hidden="true" />
          </RouterLink>
        </div>
        <div v-else class="tp-card todo-clear">
          <CircleCheck :size="20" aria-hidden="true" />
          <span>都处理完了</span>
        </div>
      </LoadState>
    </section>

    <section v-if="otherLessons.length > 0" class="home__today">
      <div class="tp-section-head">
        <h2 class="tp-section-title">{{ nextLesson ? '今日其他课程' : '今日课程' }} <span class="tp-count">{{ otherLessons.length }}</span></h2>
        <RouterLink to="/teacher/schedule" replace class="tp-link">课表<ChevronRight :size="16" aria-hidden="true" /></RouterLink>
      </div>
      <div class="tp-list">
        <LessonRow v-for="lesson in otherLessons" :key="lesson.id" :lesson="lesson" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onBeforeUnmount, ref } from 'vue'
import { CalendarClock, ChevronRight, CircleCheck, MessageSquareText, TriangleAlert } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LessonRow from './components/LessonRow.vue'
import LoadState from './components/LoadState.vue'
import PageTitle from './components/PageTitle.vue'
import TpAvatar from './components/TpAvatar.vue'
import { friendlyDate, shortTime, todayStr } from './utils/format'
import { usePageRefresh } from './utils/pageRefresh'
import { useLoad } from './utils/useLoad'

const authStore = useAuthStore()
const today = ref(todayStr())

const overview = useLoad(async () => (await teacherPortalApi.getOverview()).data)
const lessons = useLoad(() =>
  teacherPortalApi.getMyLessons({ teacherId: authStore.user?.id || '', startDate: today.value, endDate: today.value }),
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '上午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const todayLessons = computed(() => lessons.data.value || [])
const nextLesson = computed(() => todayLessons.value.find((l) => l.status !== 'completed') || null)
const otherLessons = computed(() => todayLessons.value.filter((l) => l.id !== nextLesson.value?.id))
// 每 30 秒刷新一次「还有几分钟 / 已上几分钟」；页面不在前台时停掉
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null
function startTicker() {
  stopTicker()
  now.value = Date.now()
  ticker = setInterval(() => (now.value = Date.now()), 30_000)
}
function stopTicker() {
  if (ticker) clearInterval(ticker)
  ticker = null
}
onDeactivated(stopTicker)
onBeforeUnmount(stopTicker)

function minutesOf(hhmm: string) {
  const [h, m] = shortTime(hhmm).split(':').map(Number)
  return h * 60 + m
}

// 下课后还没结课的课次仍排在最前，不能继续称它为「下一节」
const lessonPhase = computed(() => {
  const l = nextLesson.value
  if (!l) return { label: '', tone: 'next', progress: null as number | null }
  const d = new Date(now.value)
  const current = d.getHours() * 60 + d.getMinutes()
  const start = minutesOf(l.startTime)
  const end = minutesOf(l.endTime)
  if (l.status === 'in_progress' || (start <= current && current <= end)) {
    const elapsed = Math.max(0, current - start)
    return { label: `正在上课 · 已上 ${elapsed} 分钟`, tone: 'now', progress: Math.min(1, elapsed / Math.max(1, end - start)) }
  }
  if (current > end) return { label: '已下课 · 待结课', tone: 'ended', progress: null }
  const left = start - current
  const label = left <= 120 ? `下一节 · 还有 ${left} 分钟` : '下一节'
  return { label, tone: 'next', progress: null }
})

// 只列真正要处理的事，按紧急程度排序；没有待办时不用一排 0 占位
const pendingTodos = computed(() => {
  const o = overview.data.value
  return [
    { label: '逾期未结课', hint: '已过上课日期，学员课时还没扣', count: o?.overdueLessonCount ?? 0, to: '/teacher/schedule?filter=overdue', tone: 'danger', icon: CalendarClock },
    { label: '待写课评', hint: '近 30 天到课学员', count: o?.pendingEvaluationCount ?? 0, to: '/teacher/evaluations?status=pending&range=30', tone: 'accent', icon: MessageSquareText },
    { label: '学员预警', hint: '课时不足、连续缺勤等', count: o?.warningCount ?? 0, to: '/teacher/warnings', tone: 'warning', icon: TriangleAlert },
  ].filter((todo) => todo.count > 0)
})

// 手机页面可能隔天还开着：每次刷新都重新取「今天」
function refresh() {
  today.value = todayStr()
  return Promise.all([overview.load(), lessons.load()])
}

usePageRefresh(refresh)
onActivated(() => {
  startTicker()
  return refresh()
})
</script>

<style scoped>
.home__more {
  margin: var(--tp-space-1) 0 calc(-1 * var(--tp-space-2)) -6px;
}
.home {
  display: flex;
  flex-direction: column;
  gap: var(--tp-space-5);
}
.home__me {
  display: block;
  border-radius: 50%;
}
/* 主角卡片：白底大圆角，靠超大时间和一个强调色按钮成为全页焦点 */
.hero {
  padding: var(--tp-space-5);
  border-radius: var(--tp-radius-lg);
  background: var(--tp-surface);
  animation: tp-rise var(--tp-dur-slow) var(--tp-ease-out) backwards;
}
.hero__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tp-space-2);
  font-size: var(--tp-fs-small);
  color: var(--tp-text-3);
}
.hero__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: var(--tp-text-2);
}
.hero__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tp-accent);
}
.hero__status.is-now { color: var(--tp-success); }
.hero__status.is-now .hero__dot {
  background: var(--tp-success);
  animation: hero-pulse 1.8s var(--tp-ease-out) infinite;
}
.hero__status.is-ended { color: var(--tp-warning); }
.hero__status.is-ended .hero__dot { background: var(--tp-warning); }
@keyframes hero-pulse {
  0% { box-shadow: 0 0 0 0 var(--tp-success-soft); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.hero__time {
  margin: var(--tp-space-3) 0 0;
  font-size: var(--tp-fs-display);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.035em;
  color: var(--tp-text-1);
}
.hero__end {
  margin-left: 2px;
  font-size: var(--tp-fs-heading);
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--tp-text-placeholder);
}
.hero__class {
  margin: var(--tp-space-2) 0 0;
  font-size: var(--tp-fs-title);
  font-weight: 600;
  line-height: var(--tp-lh-tight);
  overflow-wrap: anywhere;
}
.hero__meta {
  margin: var(--tp-space-1) 0 0;
  font-size: var(--tp-fs-small);
  color: var(--tp-text-3);
  overflow-wrap: anywhere;
}
.hero__progress {
  height: 4px;
  margin-top: var(--tp-space-4);
  border-radius: var(--tp-radius-pill);
  background: var(--tp-surface-sunken);
  overflow: hidden;
}
.hero__progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tp-success);
  transform-origin: left;
  transition: transform var(--tp-dur-slow) var(--tp-ease-out);
}
.hero__action {
  margin-top: var(--tp-space-5);
  min-height: var(--tp-control-lg);
}
.todo-count {
  font-size: var(--tp-fs-heading);
  font-weight: 700;
  letter-spacing: var(--tp-tracking-tight);
}
.todo-clear {
  display: flex;
  align-items: center;
  gap: var(--tp-space-2);
  color: var(--tp-success);
  font-size: var(--tp-fs-control);
}
.home__todos.is-clear {
  order: 1;
}
/* 电脑上双栏：左边是今天的课，右边是待处理 */
@media (min-width: 1024px) {
  .home {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    grid-template-rows: auto auto 1fr;
    grid-template-areas:
      'intro intro'
      'primary todos'
      'today todos';
    align-items: start;
    column-gap: var(--tp-space-6);
  }
  .home__intro { grid-area: intro; }
  .home__primary { grid-area: primary; }
  .home__todos { grid-area: todos; }
  .home__today { grid-area: today; }
}
</style>
