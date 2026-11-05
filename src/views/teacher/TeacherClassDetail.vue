<template>
  <LoadState :loading="detail.loading.value" :error="detail.error.value" :has-data="!!cls" @retry="detail.load">
    <template v-if="cls">
      <section class="tp-card">
        <div class="flex items-start justify-between gap-2">
          <p class="m-0 text-[16px] font-medium text-st-title break-words min-w-0">{{ cls.name }}</p>
          <span class="tp-tag" :class="cls.status === 'completed' ? 'tp-tag-muted' : 'tp-tag-primary'">{{ classStatusLabel(cls.status) }}</span>
        </div>
        <p class="m-0 mt-1 text-[13px] text-st-muted break-words">{{ cls.courseName }} · {{ cls.classroomName }}</p>
        <p class="m-0 mt-0.5 text-[13px] text-st-muted break-words">
          讲师 {{ cls.teacherName }}<template v-if="cls.advisorName"> · 教务 {{ cls.advisorName }}</template>
        </p>
        <div class="grid grid-cols-3 gap-2 mt-3 text-center">
          <div><span class="block text-[18px] font-semibold text-st-title tabular-nums">{{ cls.students.length }}</span><span class="text-[12px] text-st-muted">在读学员</span></div>
          <div><span class="block text-[18px] font-semibold text-st-title tabular-nums">{{ cls.completedLessons }}</span><span class="text-[12px] text-st-muted">已结课</span></div>
          <div><span class="block text-[18px] font-semibold text-st-title tabular-nums">{{ cls.totalLessons }}</span><span class="text-[12px] text-st-muted">全部课次</span></div>
        </div>
      </section>

      <div class="tp-segment my-3" role="group" aria-label="班级内容">
        <button type="button" class="tp-segment-item" :class="{ 'is-active': tab === 'schedules' }" :aria-pressed="tab === 'schedules'" @click="tab = 'schedules'">课次 ({{ cls.schedules.length }})</button>
        <button type="button" class="tp-segment-item" :class="{ 'is-active': tab === 'students' }" :aria-pressed="tab === 'students'" @click="tab = 'students'">学员 ({{ cls.students.length }})</button>
      </div>

      <div v-if="tab === 'schedules'" class="grid gap-2">
        <p v-if="cls.schedules.length === 0" class="py-8 m-0 text-center text-st-muted text-[14px]">还没有排课</p>
        <component
          :is="s.canOperate ? RouterLink : 'div'"
          v-for="s in cls.schedules"
          :key="s.id"
          :to="s.canOperate ? `/teacher/lessons/${s.id}` : undefined"
          class="tp-card flex items-center gap-3 no-underline text-inherit"
        >
          <div class="min-w-0 flex-1">
            <p class="m-0 text-[14px] font-medium text-st-title tabular-nums">{{ friendlyDate(s.date) }} {{ shortTime(s.startTime) }}–{{ shortTime(s.endTime) }}</p>
            <p class="m-0 mt-0.5 text-[13px] text-st-muted break-words">
              {{ s.teacherName }} · {{ s.classroomName }}<template v-if="s.recordedCount"> · 到课 {{ s.attendedCount }}/{{ s.recordedCount }}</template>
            </p>
          </div>
          <span class="tp-tag" :class="s.status === 'completed' ? 'tp-tag-success' : 'tp-tag-muted'">{{ lessonStatusLabel(s.status) }}</span>
        </component>
      </div>

      <div v-else class="grid gap-2">
        <p v-if="cls.students.length === 0" class="py-8 m-0 text-center text-st-muted text-[14px]">本班暂无在读学员</p>
        <RouterLink
          v-for="stu in cls.students"
          :key="stu.id"
          :to="`/teacher/students/${stu.id}`"
          class="tp-card flex items-center justify-between gap-3 no-underline text-inherit"
        >
          <span class="text-[15px] font-medium text-st-title break-words min-w-0">
            {{ stu.name }}
            <span class="text-[12px] font-normal text-st-muted tabular-nums">{{ stu.studentNo }}</span>
          </span>
          <span class="text-[13px] text-st-secondary tabular-nums shrink-0">剩 {{ stu.remainingLessons }}/{{ stu.totalLessons }} 课时</span>
        </RouterLink>
      </div>
    </template>
  </LoadState>
</template>

<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { teacherPortalApi } from '@/api'
import LoadState from './components/LoadState.vue'
import { classStatusLabel, friendlyDate, lessonStatusLabel, shortTime } from './utils/format'
import { usePageRefresh } from './utils/pageRefresh'
import { useLoad } from './utils/useLoad'

const route = useRoute()
const tab = ref<'schedules' | 'students'>('schedules')
// 页面被缓存时 useRoute 会跟着后续路由变化，id 只在创建时读取一次
const classId = route.params.id as string
const detail = useLoad(async () => (await teacherPortalApi.getClassDetail(classId)).data)
const cls = computed(() => detail.data.value)

usePageRefresh(detail.load)
onActivated(detail.load)
</script>
