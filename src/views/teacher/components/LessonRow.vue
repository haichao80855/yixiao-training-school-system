<template>
  <RouterLink :to="`/teacher/lessons/${lesson.id}`" class="tp-row">
    <span class="tp-row__time">
      <strong>{{ shortTime(lesson.startTime) }}</strong>
      <span>{{ shortTime(lesson.endTime) }}</span>
    </span>
    <span class="tp-row__body">
      <p class="tp-row__title">{{ lesson.className }}</p>
      <p class="tp-row__meta">{{ lessonMeta(lesson, showDate) }}</p>
    </span>
    <!-- 「未上」是常态，不占位；只标上课中和已结束的课次 -->
    <span v-if="lesson.status !== 'scheduled'" class="tp-tag" :class="lesson.status === 'in_progress' ? 'tp-tag-primary' : 'tp-tag-muted'">{{ lessonStatusLabel(lesson.status) }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import type { TeacherLessonItem } from '@/api'
import { lessonMeta, lessonStatusLabel, shortTime } from '../utils/format'

defineProps<{ lesson: TeacherLessonItem; showDate?: boolean }>()
</script>
