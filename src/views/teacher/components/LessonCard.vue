<template>
  <RouterLink :to="`/teacher/lessons/${lesson.id}`" class="tp-card block no-underline text-inherit active:bg-st-header">
    <div class="flex items-center justify-between gap-3">
      <span class="text-[15px] font-semibold text-st-title tabular-nums">
        {{ shortTime(lesson.startTime) }}–{{ shortTime(lesson.endTime) }}
      </span>
      <span class="tp-tag" :class="statusClass">{{ lessonStatusLabel(lesson.status) }}</span>
    </div>
    <p class="mt-1.5 mb-0 text-[15px] font-medium text-st-title break-words">
      {{ lesson.className }}<template v-if="lesson.lessonNumber"> · 第{{ lesson.lessonNumber }}讲</template>
    </p>
    <p v-if="lesson.lessonTitle" class="mt-0.5 mb-0 text-[13px] text-st-secondary break-words">{{ lesson.lessonTitle }}</p>
    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-st-muted">
      <span v-if="showDate">{{ friendlyDate(lesson.date) }}</span>
      <span class="inline-flex items-center gap-1"><MapPin class="w-3.5 h-3.5" />{{ lesson.classroomName || '未安排教室' }}</span>
      <span class="inline-flex items-center gap-1 tabular-nums"><Users class="w-3.5 h-3.5" />实到 {{ lesson.actualCount }}/应到 {{ lesson.expectedCount }}</span>
      <span v-if="lesson.classType && lesson.classType !== 'formal'" class="text-st-warning">{{ classTypeLabel(lesson.classType) }}</span>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MapPin, Users } from 'lucide-vue-next'
import type { TeacherLessonItem } from '@/api'
import { classTypeLabel, friendlyDate, lessonStatusLabel, shortTime } from '../utils/format'

const props = defineProps<{ lesson: TeacherLessonItem; showDate?: boolean }>()

const statusClass = computed(() => {
  if (props.lesson.status === 'completed') return 'tp-tag-success'
  if (props.lesson.status === 'in_progress') return 'tp-tag-primary'
  return 'tp-tag-muted'
})
</script>
