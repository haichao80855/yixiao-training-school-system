<template>
  <ol class="timeline">
    <li v-for="lesson in lessons" :key="lesson.id" class="timeline__item" :class="`is-${lesson.status}`">
      <span class="tp-row__time timeline__time">
        <strong>{{ shortTime(lesson.startTime) }}</strong>
        <span>{{ shortTime(lesson.endTime) }}</span>
      </span>
      <span class="timeline__rail" aria-hidden="true"><i /></span>
      <RouterLink :to="`/teacher/lessons/${lesson.id}`" class="tp-card timeline__card">
        <span class="tp-row__body">
          <p class="tp-row__title">{{ lesson.className }}</p>
          <p class="tp-row__meta">{{ lessonMeta(lesson) }}</p>
        </span>
        <span v-if="lesson.status !== 'scheduled'" class="tp-tag" :class="lesson.status === 'in_progress' ? 'tp-tag-primary' : 'tp-tag-muted'">{{ lessonStatusLabel(lesson.status) }}</span>
      </RouterLink>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { TeacherLessonItem } from '@/api'
import { lessonMeta, lessonStatusLabel, shortTime } from '../utils/format'

defineProps<{ lessons: TeacherLessonItem[] }>()
</script>

<style scoped>
.timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}
.timeline__item {
  display: flex;
  align-items: stretch;
}
.timeline__time {
  padding-top: var(--tp-space-4);
  text-align: right;
}
.timeline__rail {
  position: relative;
  flex-shrink: 0;
  width: 28px;
}
/* 虚线只连接相邻的两节课：第一节上方、最后一节下方不留线头 */
.timeline__rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  border-left: 1px dashed var(--tp-line-strong);
}
.timeline__item:first-child .timeline__rail::before {
  top: 24px;
}
.timeline__item:last-child .timeline__rail::before {
  bottom: auto;
  height: 24px;
}
.timeline__item:only-child .timeline__rail::before {
  display: none;
}
.timeline__rail i {
  position: absolute;
  top: 19px;
  left: calc(50% - 4.5px);
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  border: 2px solid var(--tp-accent);
  border-radius: 50%;
  background: var(--tp-bg);
}
.is-in_progress .timeline__rail i {
  background: var(--tp-accent);
}
/* 已结束的课次退后：节点变灰并实心 */
.is-completed .timeline__rail i {
  border-color: var(--tp-text-placeholder);
  background: var(--tp-text-placeholder);
}
.timeline__card {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--tp-space-3);
  margin-bottom: var(--tp-space-3);
  color: inherit;
  text-decoration: none;
  transition: transform var(--tp-motion);
}
.timeline__item:last-child .timeline__card {
  margin-bottom: 0;
}
/* 手机上卡片较窄：标签放到底部，不挤压课程名 */
@media (max-width: 767px) {
  .timeline__card {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--tp-space-2);
  }
  .timeline__card .tp-row__body {
    width: 100%;
  }
}
.timeline__card:active {
  transform: scale(0.985);
}
@media (hover: hover) {
  .timeline__card:hover {
    background: var(--tp-surface-hover);
  }
}
</style>
