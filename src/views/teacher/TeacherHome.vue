<template>
  <div>
    <div class="mb-3">
      <p class="m-0 text-[18px] font-semibold text-st-title break-words">{{ authStore.user?.realName }}，你好</p>
      <p class="m-0 mt-0.5 text-[13px] text-st-muted">{{ friendlyDate(today) }} · {{ authStore.user?.campusName }}</p>
    </div>

    <LoadState :loading="overview.loading.value" :error="overview.error.value" :has-data="!!overview.data.value" @retry="overview.load">
      <div v-if="overview.data.value" class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <RouterLink
          v-for="todo in todos"
          :key="todo.label"
          :to="todo.to"
          class="tp-card block no-underline"
        >
          <p class="m-0 text-[13px] text-st-muted">{{ todo.label }}</p>
          <p class="m-0 mt-1 text-[24px] leading-none font-semibold tabular-nums" :class="todo.count > 0 && todo.alert ? 'text-st-danger-deep' : 'text-st-title'">
            {{ todo.count }}
          </p>
        </RouterLink>
      </div>
    </LoadState>

    <div class="flex items-center justify-between">
      <h2 class="tp-section-title">今日课程</h2>
      <RouterLink to="/teacher/schedule" class="mt-2.5 text-[13px] text-st-primary no-underline">查看课表</RouterLink>
    </div>
    <LoadState
      :loading="lessons.loading.value"
      :error="lessons.error.value"
      :has-data="!!lessons.data.value"
      :is-empty="lessons.data.value?.length === 0"
      empty-text="今天没有课"
      @retry="lessons.load"
    >
      <div class="grid gap-2.5">
        <LessonCard v-for="lesson in lessons.data.value" :key="lesson.id" :lesson="lesson" />
      </div>
    </LoadState>

    <h2 class="tp-section-title">常用</h2>
    <div class="grid grid-cols-2 gap-2.5">
      <RouterLink to="/teacher/classes" class="tp-card flex items-center gap-2.5 no-underline text-st-title">
        <School class="w-5 h-5 text-st-primary shrink-0" />我的班级
      </RouterLink>
      <RouterLink to="/teacher/students" class="tp-card flex items-center gap-2.5 no-underline text-st-title">
        <Users class="w-5 h-5 text-st-primary shrink-0" />我的学员
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { School, Users } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LessonCard from './components/LessonCard.vue'
import LoadState from './components/LoadState.vue'
import { friendlyDate, todayStr } from './utils/format'
import { useLoad } from './utils/useLoad'

const authStore = useAuthStore()
const today = todayStr()

const overview = useLoad(async () => (await teacherPortalApi.getOverview()).data)
const lessons = useLoad(() =>
  teacherPortalApi.getMyLessons({ teacherId: authStore.user?.id || '', startDate: today, endDate: today }),
)

const todos = computed(() => {
  const o = overview.data.value
  return [
    { label: '今日待上课', count: o?.todayPendingCount ?? 0, to: '/teacher/schedule', alert: false },
    { label: '逾期未结课', count: o?.overdueLessonCount ?? 0, to: '/teacher/schedule?filter=overdue', alert: true },
    { label: '待写课评', count: o?.pendingEvaluationCount ?? 0, to: '/teacher/evaluations?status=pending&range=30', alert: false },
    { label: '学员预警', count: o?.warningCount ?? 0, to: '/teacher/warnings', alert: true },
  ]
})

onMounted(() => {
  overview.load()
  lessons.load()
})
</script>
