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
    <!-- 「未上」是常态，不占位；只标上课中和已结束的课次 -->
    <span v-if="lesson.status !== 'scheduled'" class="tp-tag" :class="lesson.status === 'in_progress' ? 'tp-tag-primary' : 'tp-tag-muted'">{{ lessonStatusLabel(lesson.status) }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TeacherLessonItem } from '@/api'
import { classTypeLabel, friendlyDate, lessonStatusLabel, shortTime } from '../utils/format'

const props = defineProps<{ lesson: TeacherLessonItem; showDate?: boolean }>()

// 教室名最长，放最后折行；不间断空格避免「5 人」被拆到两行
const meta = computed(() => {
  const l = props.lesson
  return [
    props.showDate ? friendlyDate(l.date) : '',
    l.lessonNumber ? `第${l.lessonNumber}讲` : '',
    l.classType && l.classType !== 'formal' ? classTypeLabel(l.classType) : '',
    l.status === 'completed' ? `到课 ${l.actualCount}/${l.expectedCount}` : `${l.expectedCount} 人`,
    l.classroomName,
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>
