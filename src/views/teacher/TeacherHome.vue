<template>
  <div class="home">
    <div class="home__intro">
      <p class="home__greeting">{{ greeting }}，{{ authStore.user?.realName }}</p>
      <p class="tp-text-meta" style="margin: 2px 0 0">{{ friendlyDate(today) }} · {{ authStore.user?.campusName }}</p>
    </div>

    <div class="home__primary tp-stack">
      <LoadState :loading="lessons.loading.value" :error="lessons.error.value" :has-data="!!lessons.data.value" @retry="lessons.load">
        <!-- 今天最重要的一件事：下一节课 -->
        <section v-if="nextLesson" class="tp-card next-lesson" aria-label="下一节课">
          <div class="next-lesson__head">
            <span class="tp-tag" :class="isHappeningNow ? 'tp-tag-primary' : 'tp-tag-muted'">{{ isHappeningNow ? '正在上课' : '下一节' }}</span>
            <span class="tp-text-meta tp-num">共 {{ nextLesson.expectedCount }} 人</span>
          </div>
          <p class="next-lesson__time tp-num">{{ shortTime(nextLesson.startTime) }}–{{ shortTime(nextLesson.endTime) }}</p>
          <p class="next-lesson__class">{{ nextLesson.className }}</p>
          <p class="tp-text-meta" style="margin: 2px 0 0">
            <template v-if="nextLesson.lessonNumber">第{{ nextLesson.lessonNumber }}讲<template v-if="nextLesson.lessonTitle"> {{ nextLesson.lessonTitle }}</template> · </template>{{ nextLesson.classroomName }}
          </p>
          <RouterLink :to="`/teacher/lessons/${nextLesson.id}`" class="tp-btn tp-btn-primary tp-btn-block" style="margin-top: 16px">
            {{ nextLesson.actualCount > 0 ? '继续点名' : '开始点名' }}
          </RouterLink>
        </section>
        <section v-else class="tp-card">
          <p class="tp-row__title">{{ todayLessons.length > 0 ? '今天的课都上完了' : '今天没有课' }}</p>
          <RouterLink to="/teacher/schedule" class="tp-link" style="margin: 4px 0 -8px -6px">查看课表<ChevronRight :size="14" aria-hidden="true" /></RouterLink>
        </section>

        <section v-if="todayLessons.length > 1">
          <div class="tp-section-head">
            <h2 class="tp-section-title">今日课程 <span class="tp-count">{{ todayLessons.length }}</span></h2>
            <RouterLink to="/teacher/schedule" class="tp-link">课表<ChevronRight :size="14" aria-hidden="true" /></RouterLink>
          </div>
          <div class="tp-list">
            <LessonRow v-for="lesson in todayLessons" :key="lesson.id" :lesson="lesson" />
          </div>
        </section>
      </LoadState>
    </div>

    <section class="home__todos">
      <div class="tp-section-head">
        <h2 class="tp-section-title">待处理</h2>
      </div>
      <LoadState :loading="overview.loading.value" :error="overview.error.value" :has-data="!!overview.data.value" @retry="overview.load">
        <div v-if="pendingTodos.length > 0" class="tp-list">
          <RouterLink v-for="todo in pendingTodos" :key="todo.label" :to="todo.to" class="tp-row">
            <span class="todo-icon" :class="`todo-icon--${todo.tone}`"><component :is="todo.icon" :size="18" aria-hidden="true" /></span>
            <span class="tp-row__body">
              <p class="tp-row__title">{{ todo.label }}</p>
              <p class="tp-row__meta">{{ todo.hint }}</p>
            </span>
            <span class="todo-count tp-num">{{ todo.count }}</span>
            <ChevronRight class="tp-row__chevron" aria-hidden="true" />
          </RouterLink>
        </div>
        <div v-else class="tp-card todo-clear">
          <CircleCheck :size="18" aria-hidden="true" />
          <span>都处理完了</span>
        </div>
      </LoadState>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { CalendarClock, ChevronRight, CircleCheck, MessageSquareText, TriangleAlert } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LessonRow from './components/LessonRow.vue'
import LoadState from './components/LoadState.vue'
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
const isHappeningNow = computed(() => {
  const l = nextLesson.value
  if (!l) return false
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return l.status === 'in_progress' || (shortTime(l.startTime) <= time && time <= shortTime(l.endTime))
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
onActivated(refresh)
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--tp-space-5);
}
.home__greeting {
  margin: 0;
  font-size: var(--tp-fs-heading);
  font-weight: 600;
  line-height: var(--tp-lh-tight);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.next-lesson__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tp-space-2);
}
.next-lesson__time {
  margin: var(--tp-space-3) 0 0;
  font-size: var(--tp-fs-display);
  font-weight: 600;
  line-height: var(--tp-lh-tight);
  letter-spacing: -0.02em;
}
.next-lesson__class {
  margin: var(--tp-space-1) 0 0;
  font-size: var(--tp-fs-title);
  font-weight: 500;
  line-height: var(--tp-lh-tight);
  overflow-wrap: anywhere;
}
.todo-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--tp-radius-md);
}
.todo-icon--danger { background: var(--tp-danger-soft); color: var(--tp-danger); }
.todo-icon--accent { background: var(--tp-accent-soft); color: var(--tp-accent); }
.todo-icon--warning { background: var(--tp-warning-soft); color: var(--tp-warning); }
.todo-count {
  font-size: var(--tp-fs-title);
  font-weight: 600;
}
.todo-clear {
  display: flex;
  align-items: center;
  gap: var(--tp-space-2);
  color: var(--tp-success);
  font-size: 14px;
}
/* 电脑上双栏：左边是今天的课，右边是待处理 */
@media (min-width: 1024px) {
  .home {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    grid-template-areas:
      'intro intro'
      'primary todos';
    align-items: start;
    column-gap: var(--tp-space-6);
  }
  .home__intro { grid-area: intro; }
  .home__primary { grid-area: primary; }
  .home__todos { grid-area: todos; }
}
</style>
