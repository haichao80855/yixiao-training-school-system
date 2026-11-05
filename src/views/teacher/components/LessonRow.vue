<template>
  <RouterLink :to="`/teacher/lessons/${lesson.id}`" class="tp-row">
    <span class="tp-row__time">
      <strong>{{ shortTime(lesson.startTime) }}</strong>
      <span>{{ shortTime(lesson.endTime) }}</span>
    </span>
    <span class="tp-row__body">
      <p class="tp-row__title">{{ lesson.className }}</p>
      <p class="tp-row__meta">{{ meta }}</p>
    </span>
    <span class="tp-tag" :class="statusClass">{{ lessonStatusLabel(lesson.status) }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TeacherLessonItem } from '@/api'
import { classTypeLabel, friendlyDate, lessonStatusLabel, shortTime } from '../utils/format'

const props = defineProps<{ lesson: TeacherLessonItem; showDate?: boolean }>()

const statusClass = computed(() => {
  if (props.lesson.status === 'completed') return 'tp-tag-success'
  if (props.lesson.status === 'in_progress') return 'tp-tag-primary'
  return 'tp-tag-muted'
})

const meta = computed(() => {
  const l = props.lesson
  return [
    props.showDate ? friendlyDate(l.date) : '',
    l.lessonNumber ? `第${l.lessonNumber}讲` : '',
    l.classType && l.classType !== 'formal' ? classTypeLabel(l.classType) : '',
    l.classroomName,
    l.status === 'completed' ? `到课 ${l.actualCount}/${l.expectedCount}` : `${l.expectedCount} 人`,
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>
