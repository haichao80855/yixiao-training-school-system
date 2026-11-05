<template>
  <LoadState :loading="workbench.loading.value" :error="workbench.error.value" :has-data="!!student" @retry="init">
    <p v-if="workbench.data.value && !student" class="tp-card text-center text-st-muted m-0">该学员不在本课次名单中</p>
    <div v-if="student && schedule" class="grid gap-3">
      <section class="tp-card">
        <div class="flex items-center justify-between gap-2">
          <p class="m-0 text-[16px] font-medium text-st-title break-words">{{ student.studentName }}</p>
          <span v-if="isRevision" class="tp-tag tp-tag-warning">修改已推送的课评</span>
          <span v-else-if="!isAttended(attendanceStatus)" class="tp-tag tp-tag-muted">{{ attendanceLabel(attendanceStatus) }}</span>
        </div>
        <p class="m-0 mt-1 text-[13px] text-st-muted break-words">
          {{ schedule.className }} · {{ friendlyDate(schedule.date) }} {{ shortTime(schedule.startTime) }}
        </p>
      </section>

      <section class="tp-card">
        <p class="field-label">课堂评分</p>
        <div class="flex gap-1" role="radiogroup" aria-label="课堂评分">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="star-btn"
            role="radio"
            :aria-checked="rating === n"
            :aria-label="`${n} 星`"
            @click="rating = n"
          >
            <Star class="w-7 h-7" :class="n <= rating ? 'fill-amber-400 text-amber-400' : 'text-st-border-dark'" />
          </button>
        </div>
      </section>

      <section class="tp-card">
        <label class="field-label" for="study-content">
          课程学习内容与知识点<span v-if="studyContentRequired" class="text-st-danger"> *</span>
          <span class="font-normal text-st-muted">（全班共享）</span>
        </label>
        <textarea
          id="study-content"
          v-model="studyContent"
          class="tp-input"
          rows="4"
          maxlength="1000"
          placeholder="这节课学了什么、重点知识点"
        />

        <label class="field-label !mt-3" for="comment">
          {{ student.studentName }} 的专属评语<span class="text-st-danger"> *</span>
        </label>
        <textarea
          id="comment"
          v-model="comment"
          class="tp-input"
          rows="5"
          maxlength="1000"
          placeholder="写下孩子这节课的表现、进步与建议"
        />
        <p class="m-0 mt-1 text-right text-[12px] text-st-muted tabular-nums">{{ comment.length }}/1000</p>
      </section>

      <section class="tp-card">
        <p class="field-label">照片与视频 <span class="font-normal text-st-muted">（照片最多 9 张，视频 1 个）</span></p>
        <div class="grid grid-cols-3 gap-2">
          <div v-for="(photo, idx) in photos" :key="photo" class="media-cell">
            <img :src="photo" alt="课堂照片" class="w-full h-full object-cover" loading="lazy" />
            <button type="button" class="media-remove" :aria-label="`移除第 ${idx + 1} 张照片`" @click="photos.splice(idx, 1)">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div v-if="videoUrl" class="media-cell bg-black">
            <video :src="videoUrl" class="w-full h-full object-cover" controls playsinline preload="metadata" />
            <button type="button" class="media-remove" aria-label="移除视频" @click="videoUrl = ''">
              <X class="w-4 h-4" />
            </button>
          </div>
          <label v-if="photos.length < 9" class="media-add" :class="{ 'opacity-50 pointer-events-none': uploading }">
            <ImagePlus class="w-6 h-6" />
            <span>{{ uploading === 'photo' ? '上传中…' : '加照片' }}</span>
            <input type="file" accept="image/*" multiple class="sr-only" :disabled="!!uploading" @change="onPickPhotos" />
          </label>
          <label v-if="!videoUrl" class="media-add" :class="{ 'opacity-50 pointer-events-none': uploading }">
            <Video class="w-6 h-6" />
            <span>{{ uploading === 'video' ? '上传中…' : '加视频' }}</span>
            <input type="file" accept="video/*" class="sr-only" :disabled="!!uploading" @change="onPickVideo" />
          </label>
        </div>
      </section>

      <div class="tp-action-bar !mt-0">
        <button type="button" class="tp-btn tp-btn-secondary" :disabled="submitting || !!uploading" @click="saveDraft">保存草稿</button>
        <button type="button" class="tp-btn tp-btn-primary flex-1" :disabled="submitting || !!uploading" @click="submit">
          {{ submitting ? '提交中…' : isRevision ? '保存并更新' : '推送给家长' }}
        </button>
      </div>
    </div>
  </LoadState>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ImagePlus, Star, Video, X } from 'lucide-vue-next'
import { teacherPortalApi, uploadApi, type AttendanceStatus } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LoadState from './components/LoadState.vue'
import { compressImage } from './utils/compressImage'
import { readDraft, removeDraft, writeDraft } from './utils/evaluationDraft'
import { attendanceLabel, friendlyDate, htmlToText, isAttended, shortTime } from './utils/format'
import { useLoad } from './utils/useLoad'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const lessonId = route.params.id as string
const studentId = route.params.studentId as string
const userId = authStore.user?.id || ''

const workbench = useLoad(async () => (await teacherPortalApi.getLessonWorkbench(lessonId)).data)
const schedule = computed(() => workbench.data.value?.schedule)
const student = computed(() => workbench.data.value?.students.find((s) => s.studentId === studentId))
const attendanceStatus = computed<AttendanceStatus>(() => student.value?.recordedStatus || student.value?.defaultStatus || 'present')
const isRevision = computed(() => Boolean(student.value?.isPublished && student.value?.hasPersonalEvaluation))
const studyContentRequired = computed(() => !workbench.data.value?.evaluationDraft.isExisting)

const comment = ref('')
const studyContent = ref('')
const rating = ref(5)
const photos = ref<string[]>([])
const videoUrl = ref('')
const uploading = ref<'' | 'photo' | 'video'>('')
const submitting = ref(false)
const isDirty = ref(false)
let serverStudyContent = ''
let hydrated = false

watch([comment, studyContent, rating, videoUrl, () => photos.value.length], () => {
  if (hydrated) isDirty.value = true
})

async function init() {
  hydrated = false
  await workbench.load()
  const data = workbench.data.value
  const stu = student.value
  if (!data || !stu) return

  // 服务端在尚无课评时返回教研模板文案作占位：不能当成老师写的内容预填
  serverStudyContent = data.evaluationDraft.isExisting ? htmlToText(data.evaluationDraft.studyContentHtml) : ''
  const draft = readDraft(userId, lessonId, studentId)
  const isDraftUsable = draft && !(stu.evaluatedAt && draft.savedAt < stu.evaluatedAt)

  studyContent.value = (isDraftUsable && draft.studyContent) || serverStudyContent
  // 只回显老师对该学员写过的评语；没有专属课评时 currentComment 可能是考勤记录上的模板文案
  comment.value = (isDraftUsable && draft.comment) || (stu.hasPersonalEvaluation ? stu.currentComment || '' : '')
  rating.value = (isDraftUsable && draft.rating) || (stu.hasPersonalEvaluation ? stu.currentRating || 5 : 5)
  photos.value = isDraftUsable ? [...draft.photos] : [...(stu.photos || [])]
  videoUrl.value = isDraftUsable ? draft.videoUrl : stu.videoUrl || ''

  // 等上面的赋值触发完 watch 再开始记录修改
  queueMicrotask(() => {
    hydrated = true
    isDirty.value = false
  })
}

async function onPickPhotos(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files || [])
  input.value = ''
  if (picked.length === 0) return

  const room = 9 - photos.value.length
  if (picked.length > room) ElMessage.warning(`最多 9 张，已取前 ${room} 张`)

  uploading.value = 'photo'
  try {
    const files = await Promise.all(picked.slice(0, room).map(compressImage))
    const oversized = files.filter((f) => f.size > MAX_PHOTO_BYTES)
    const valid = files.filter((f) => f.size <= MAX_PHOTO_BYTES)
    if (oversized.length > 0) ElMessage.warning(`${oversized.length} 张照片超过 10MB，已跳过`)
    if (valid.length === 0) return
    const res = await uploadApi.uploadClassroomPhotos({ files: valid, scheduleEventId: lessonId })
    photos.value.push(...(res.data.persistedUrls || []))
    if (res.data.failureCount > 0) ElMessage.warning(`${res.data.failureCount} 张照片上传失败`)
  } catch (err: any) {
    ElMessage.error(err?.message || '照片上传失败，请重试')
  } finally {
    uploading.value = ''
  }
}

async function onPickVideo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > MAX_VIDEO_BYTES) {
    ElMessage.warning('视频不能超过 100MB')
    return
  }
  uploading.value = 'video'
  try {
    const res = await uploadApi.uploadClassroomVideo({ file, scheduleEventId: lessonId })
    videoUrl.value = res.data.videoUrl
  } catch (err: any) {
    ElMessage.error(err?.message || '视频上传失败，请重试')
  } finally {
    uploading.value = ''
  }
}

function saveDraft() {
  const saved = writeDraft(userId, lessonId, studentId, {
    comment: comment.value,
    studyContent: studyContent.value,
    rating: rating.value,
    photos: [...photos.value],
    videoUrl: videoUrl.value,
    savedAt: new Date().toISOString(),
  })
  if (!saved) {
    ElMessage.error('当前浏览器无法保存草稿，请直接推送或关闭隐私模式')
    return
  }
  isDirty.value = false
  ElMessage.success('草稿已保存在本机，尚未推送')
}

async function submit() {
  const stu = student.value
  const sch = schedule.value
  if (!stu || !sch) return
  const text = comment.value.trim()
  const content = studyContent.value.trim()
  if (!text) {
    ElMessage.warning('请填写专属评语')
    return
  }
  if (studyContentRequired.value && !content) {
    ElMessage.warning('本节课首次推送课评，请填写学习内容')
    return
  }

  submitting.value = true
  try {
    // 未结课时先落一条考勤：服务端按考勤记录给家长发课评通知
    if (sch.status !== 'completed' && !stu.isRecorded) {
      await teacherPortalApi.syncAttendance(lessonId, [
        {
          studentId,
          attendanceStatus: attendanceStatus.value,
          deductLessons: isAttended(attendanceStatus.value) ? stu.defaultDeductLessons : 0,
        },
      ])
    }
    await teacherPortalApi.publishStudentEvaluation({
      scheduleEventId: lessonId,
      studentId,
      status: attendanceStatus.value,
      deductLessons: stu.defaultDeductLessons,
      comment: text,
      rating: rating.value,
      photos: photos.value,
      videoUrl: videoUrl.value,
      // 大纲没改动时不提交：Web 端写的富文本大纲不会被转换成纯文本覆盖
      studyContent: content && content !== serverStudyContent ? content : undefined,
      lessonTitle: `${sch.className} ${sch.date} 随堂课评`,
    })
    removeDraft(userId, lessonId, studentId)
    isDirty.value = false
    ElMessage.success(isRevision.value ? '课评已更新' : '已推送给家长')
    router.back()
  } catch (err: any) {
    ElMessage.error(err?.message || '提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

onBeforeRouteLeave(async () => {
  if (!isDirty.value) return true
  try {
    await ElMessageBox.confirm('内容尚未保存，离开后将丢失。', '离开此页？', {
      confirmButtonText: '离开',
      cancelButtonText: '继续编辑',
    })
    return true
  } catch {
    return false
  }
})

onMounted(init)
</script>

<style scoped>
.field-label {
  display: block;
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--st-color-title);
}
.star-btn {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.media-cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
}
.media-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.65);
  color: #fff;
  cursor: pointer;
}
.media-add {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px dashed var(--st-color-border-dark);
  border-radius: 8px;
  color: var(--st-color-secondary);
  font-size: 13px;
  cursor: pointer;
}
</style>
