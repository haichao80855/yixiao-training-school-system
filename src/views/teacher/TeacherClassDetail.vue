<template>
  <LoadState :loading="detail.loading.value" :error="detail.error.value" :has-data="!!cls" @retry="detail.load">
    <div v-if="cls" class="tp-stack">
      <section class="tp-card">
        <div class="class-head">
          <h2 class="class-name">{{ cls.name }}</h2>
          <span class="tp-tag" :class="cls.status === 'completed' ? 'tp-tag-muted' : 'tp-tag-primary'">{{ classStatusLabel(cls.status) }}</span>
        </div>
        <p class="tp-text-meta tp-m-0 tp-mt-1">
          {{ cls.courseName }} · {{ cls.classroomName }} · 讲师 {{ cls.teacherName }}<template v-if="cls.advisorName"> · 教务 {{ cls.advisorName }}</template>
        </p>
        <div class="tp-metrics">
          <div class="tp-metric"><span class="tp-metric__value">{{ cls.students.length }}</span><span class="tp-metric__label">在读学员</span></div>
          <div class="tp-metric"><span class="tp-metric__value">{{ cls.completedLessons }}</span><span class="tp-metric__label">已结课</span></div>
          <div class="tp-metric"><span class="tp-metric__value">{{ cls.totalLessons }}</span><span class="tp-metric__label">全部课次</span></div>
        </div>
      </section>

      <div class="tp-segment" role="group" aria-label="班级内容">
        <button type="button" class="tp-segment-item" :class="{ 'is-active': tab === 'schedules' }" :aria-pressed="tab === 'schedules'" @click="tab = 'schedules'">课次 <span class="tp-count">{{ cls.schedules.length }}</span></button>
        <button type="button" class="tp-segment-item" :class="{ 'is-active': tab === 'students' }" :aria-pressed="tab === 'students'" @click="tab = 'students'">学员 <span class="tp-count">{{ cls.students.length }}</span></button>
      </div>

      <template v-if="tab === 'schedules'">
        <p v-if="cls.schedules.length === 0" class="tp-state">还没有排课</p>
        <div v-else class="tp-list">
          <component
            :is="s.canOperate ? RouterLink : 'div'"
            v-for="s in cls.schedules"
            :key="s.id"
            :to="s.canOperate ? `/teacher/lessons/${s.id}` : undefined"
            class="tp-row"
          >
            <span class="tp-row__body">
              <p class="tp-row__title tp-num">{{ friendlyDate(s.date) }} {{ shortTime(s.startTime) }}–{{ shortTime(s.endTime) }}</p>
              <p class="tp-row__meta">{{ s.teacherName }} · {{ s.classroomName }}<template v-if="s.recordedCount"> · 到课 {{ s.attendedCount }}/{{ s.recordedCount }}</template></p>
            </span>
            <span v-if="s.status !== 'scheduled'" class="tp-tag" :class="s.status === 'in_progress' ? 'tp-tag-primary' : 'tp-tag-muted'">{{ lessonStatusLabel(s.status) }}</span>
            <ChevronRight v-if="s.canOperate" class="tp-row__chevron" aria-hidden="true" />
          </component>
        </div>
      </template>

      <template v-else>
        <p v-if="cls.students.length === 0" class="tp-state">本班暂无在读学员</p>
        <div v-else class="tp-list">
          <RouterLink v-for="stu in cls.students" :key="stu.id" :to="`/teacher/students/${stu.id}`" class="tp-row">
            <TpAvatar :name="stu.name" :seed="stu.id" />
            <span class="tp-row__body">
              <p class="tp-row__title">{{ stu.name }}</p>
              <p class="tp-row__meta tp-num">{{ stu.studentNo }}</p>
            </span>
            <span class="tp-text-meta tp-num tp-shrink-0">剩 {{ stu.remainingLessons }}/{{ stu.totalLessons }} 课时</span>
            <ChevronRight class="tp-row__chevron" aria-hidden="true" />
          </RouterLink>
        </div>
      </template>
    </div>
  </LoadState>
</template>

<script setup lang="ts">
import TpAvatar from './components/TpAvatar.vue'
import { computed, onActivated, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'
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

<style scoped>
.class-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tp-space-2);
}
.class-name {
  margin: 0;
  min-width: 0;
  font-size: var(--tp-fs-title);
  font-weight: 600;
  line-height: var(--tp-lh-tight);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
</style>
