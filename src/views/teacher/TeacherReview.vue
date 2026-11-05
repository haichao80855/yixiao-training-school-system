<template>
  <LoadState :loading="workbench.loading.value" :error="workbench.error.value" :has-data="!!workbench.data.value" @retry="workbench.load">
    <p v-if="workbench.data.value && !student" class="tp-card text-center text-st-muted m-0">该学员不在本课次名单中</p>
    <div v-if="student && schedule" class="grid gap-3">
      <section class="tp-card">
        <div class="flex items-center justify-between gap-2">
          <p class="m-0 text-[16px] font-medium text-st-title break-words">{{ student.studentName }}</p>
          <span class="tp-tag" :class="isPublished ? 'tp-tag-success' : 'tp-tag-muted'">{{ isPublished ? '家长可见' : '未推送' }}</span>
        </div>
        <p class="m-0 mt-1 text-[13px] text-st-muted break-words">
          {{ schedule.className }} · {{ friendlyDate(schedule.date) }} {{ shortTime(schedule.startTime) }}
        </p>
        <div class="flex items-center gap-1 mt-2" :aria-label="`课堂评分 ${rating} 星`">
          <Star v-for="n in 5" :key="n" class="w-4 h-4" :class="n <= rating ? 'fill-amber-400 text-amber-400' : 'text-st-border-dark'" />
          <span class="ml-2 text-[13px] text-st-muted">{{ attendanceLabel(student.recordedStatus || student.defaultStatus) }}</span>
        </div>
      </section>

      <section class="tp-card">
        <h2 class="m-0 mb-1.5 text-[14px] font-semibold text-st-title">专属评语</h2>
        <p class="m-0 text-[15px] text-st-regular whitespace-pre-wrap break-words">{{ student.currentComment || '未填写' }}</p>
      </section>

      <section v-if="studyContent" class="tp-card">
        <h2 class="m-0 mb-1.5 text-[14px] font-semibold text-st-title">学习内容与知识点</h2>
        <p class="m-0 text-[14px] text-st-secondary whitespace-pre-wrap break-words">{{ studyContent }}</p>
      </section>

      <section v-if="(student.photos?.length || 0) > 0 || student.videoUrl" class="tp-card">
        <h2 class="m-0 mb-2 text-[14px] font-semibold text-st-title">照片与视频</h2>
        <div v-if="student.photos?.length" class="grid grid-cols-3 gap-2">
          <el-image
            v-for="(photo, idx) in student.photos"
            :key="photo"
            :src="photo"
            :preview-src-list="student.photos"
            :initial-index="idx"
            preview-teleported
            fit="cover"
            class="aspect-square w-full rounded-lg"
            alt="课堂照片"
          />
        </div>
        <video v-if="student.videoUrl" :src="student.videoUrl" class="w-full mt-2 rounded-lg bg-black" controls playsinline preload="metadata" />
      </section>

      <RouterLink :to="`/teacher/lessons/${lessonId}/evaluate/${studentId}`" class="tp-btn tp-btn-primary w-full">修改课评</RouterLink>
    </div>
  </LoadState>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Star } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import LoadState from './components/LoadState.vue'
import { attendanceLabel, friendlyDate, htmlToText, shortTime } from './utils/format'
import { useLoad } from './utils/useLoad'

const route = useRoute()
const lessonId = route.params.id as string
const studentId = route.params.studentId as string

const workbench = useLoad(async () => (await teacherPortalApi.getLessonWorkbench(lessonId)).data)
const schedule = computed(() => workbench.data.value?.schedule)
const student = computed(() => workbench.data.value?.students.find((s) => s.studentId === studentId))
const isPublished = computed(() => Boolean(student.value?.isPublished))
const rating = computed(() => Math.round(student.value?.currentRating || 0))
const studyContent = computed(() => {
  const draft = workbench.data.value?.evaluationDraft
  return draft?.isExisting ? htmlToText(draft.studyContentHtml) : ''
})

onMounted(workbench.load)
</script>
