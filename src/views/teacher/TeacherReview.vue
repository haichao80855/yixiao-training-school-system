<template>
  <LoadState :loading="workbench.loading.value" :error="workbench.error.value" :has-data="!!workbench.data.value" @retry="workbench.load">
    <p v-if="workbench.data.value && !student" class="tp-card tp-state" style="margin: 0">该学员不在本课次名单中</p>
    <div v-if="student && schedule" class="tp-stack">
      <section class="tp-list">
        <div class="tp-row">
          <span class="tp-avatar" aria-hidden="true">{{ student.studentName.slice(0, 1) }}</span>
          <span class="tp-row__body">
            <p class="tp-row__title">{{ student.studentName }}</p>
            <p class="tp-row__meta">{{ schedule.className }} · {{ friendlyDate(schedule.date) }} {{ shortTime(schedule.startTime) }}</p>
          </span>
          <span class="tp-tag" :class="isPublished ? 'tp-tag-success' : 'tp-tag-muted'">{{ isPublished ? '家长可见' : '未推送' }}</span>
        </div>
        <div class="tp-row">
          <span class="tp-row__body tp-text-meta">{{ attendanceLabel(student.recordedStatus || student.defaultStatus) }}</span>
          <span class="review-stars" role="img" :aria-label="`课堂评分 ${rating} 星`">
            <Star v-for="n in 5" :key="n" :size="16" :class="n <= rating ? 'star-on' : 'star-off'" aria-hidden="true" />
          </span>
        </div>
      </section>

      <section class="tp-card">
        <h2 class="tp-label">专属评语</h2>
        <p class="review-text">{{ student.currentComment || '未填写' }}</p>
      </section>

      <section v-if="studyContent" class="tp-card">
        <h2 class="tp-label">学习内容与知识点</h2>
        <p class="review-text tp-text-small">{{ studyContent }}</p>
      </section>

      <section v-if="(student.photos?.length || 0) > 0 || student.videoUrl" class="tp-card">
        <h2 class="tp-label">照片与视频</h2>
        <div v-if="student.photos?.length" class="review-grid">
          <el-image
            v-for="(photo, idx) in student.photos"
            :key="photo"
            :src="student.photoThumbs?.[idx] || photo"
            :preview-src-list="student.photoPreviews?.length ? student.photoPreviews : student.photos"
            :initial-index="idx"
            preview-teleported
            fit="cover"
            class="review-photo"
            alt="课堂照片"
          />
        </div>
        <video
          v-if="student.videoUrl"
          :src="student.videoUrl"
          :poster="student.videoPoster || undefined"
          :preload="student.videoPoster ? 'none' : 'metadata'"
          class="review-video"
          controls
          playsinline
        />
      </section>

      <RouterLink :to="`/teacher/lessons/${lessonId}/evaluate/${studentId}`" class="tp-btn tp-btn-secondary tp-btn-block">修改课评</RouterLink>
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
import { usePageRefresh } from './utils/pageRefresh'
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

usePageRefresh(workbench.load)
onMounted(workbench.load)
</script>

<style scoped>
.review-stars {
  display: inline-flex;
  gap: 2px;
}
.star-on {
  color: #d97706;
  fill: #f59e0b;
}
.star-off {
  color: var(--tp-line-strong);
}
.review-text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.review-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--tp-space-2);
}
.review-photo {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--tp-radius-sm);
}
.review-video {
  display: block;
  width: 100%;
  margin-top: var(--tp-space-2);
  border-radius: var(--tp-radius-sm);
  background: #000;
}
</style>
