<template>
  <LoadState :loading="workbench.loading.value" :error="workbench.error.value" :has-data="!!workbench.data.value" @retry="workbench.load">
    <p v-if="workbench.data.value && !student" class="tp-card tp-state tp-m-0">该学员不在本课次名单中</p>
    <div v-if="student && schedule" class="tp-stack">
      <section class="tp-list">
        <div class="tp-row">
          <TpAvatar :name="student.studentName" :seed="student.studentId" />
          <span class="tp-row__body">
            <p class="tp-row__title">{{ student.studentName }}</p>
            <p class="tp-row__meta">{{ schedule.className }} · {{ friendlyDate(schedule.date) }} {{ shortTime(schedule.startTime) }}</p>
          </span>
          <span class="tp-tag" :class="isPublished ? 'tp-tag-success' : 'tp-tag-muted'">{{ isPublished ? '家长可见' : '未推送' }}</span>
        </div>
        <div class="tp-row">
          <span class="tp-row__body tp-text-small">出勤：{{ attendanceLabel(student.recordedStatus || student.defaultStatus) }}</span>
          <span class="review-stars" role="img" :aria-label="`课堂评分 ${rating} 星`">
            <Star v-for="n in 5" :key="n" :size="16" :class="n <= rating ? 'star-on' : 'star-off'" aria-hidden="true" />
          </span>
        </div>
      </section>

      <section class="tp-card">
        <h2 class="review-heading">专属评语</h2>
        <p class="review-text">{{ student.currentComment || '未填写' }}</p>
      </section>

      <section v-if="studyContent" class="tp-card">
        <h2 class="review-heading">学习内容与知识点 <small>全班共享</small></h2>
        <p class="review-text">{{ studyContent }}</p>
      </section>

      <section v-if="(student.photos?.length || 0) > 0 || student.videoUrl" class="tp-card">
        <h2 class="review-heading">照片与视频</h2>
        <div v-if="student.photos?.length" class="review-grid">
          <el-image
            v-for="(photo, idx) in student.photos"
            :key="photo"
            :src="student.photoThumbs?.[idx] || photo"
            lazy
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

      <RouterLink :to="`/teacher/lessons/${lessonId}/evaluate/${studentId}`" class="tp-btn tp-btn-tinted tp-btn-block">修改课评</RouterLink>
    </div>
  </LoadState>
</template>

<script setup lang="ts">
import TpAvatar from './components/TpAvatar.vue'
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
  color: var(--tp-rating-line);
  fill: var(--tp-rating);
}
.star-off {
  color: var(--tp-line-strong);
  fill: var(--tp-rating-off);
}
/* 三张卡片同一种层级：13 号灰色小标题 + 15 号正文 */
.review-heading {
  margin: 0 0 var(--tp-space-2);
  font-size: var(--tp-fs-small);
  font-weight: 500;
  color: var(--tp-text-3);
}
.review-heading small {
  font-size: var(--tp-fs-caption);
  font-weight: 400;
}
.review-text {
  margin: 0;
  font-size: var(--tp-fs-body);
  line-height: var(--tp-lh-body);
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
  background: var(--tp-media-bg);
}
</style>
