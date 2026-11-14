<template>
  <LoadState :loading="workbench.loading.value" :error="workbench.error.value" :has-data="!!student" @retry="init">
    <p v-if="workbench.data.value && !student" class="tp-card tp-state tp-m-0">该学员不在本课次名单中</p>
    <template v-if="student && schedule">
      <!-- 完成页：本节课到课学员的课评都已推送 -->
      <template v-if="finished">
        <section class="tp-card tp-state finish" role="status">
          <span class="tp-state__icon tp-state__icon--success"><CircleCheck aria-hidden="true" /></span>
          <p class="tp-state__title finish__title">本节课课评已全部推送</p>
          <p class="tp-num">到课 {{ finished.attended }} 人 · 已推送 {{ finished.pushed }} 人</p>
          <p v-if="finished.leave + finished.absent > 0" class="tp-text-small">{{ skippedText(finished) }}无需课评</p>
        </section>
        <div class="tp-action-bar">
          <button type="button" class="tp-btn tp-btn-secondary" @click="openPicker">逐个回看</button>
          <button type="button" class="tp-btn tp-btn-primary tp-grow" @click="backToLesson">返回课次</button>
        </div>
      </template>

      <!-- 请假 / 缺勤：家长端只给到课学员显示课评，写了家长也看不到 -->
      <template v-else-if="!needsEvaluation(student)">
        <section class="tp-card tp-state">
          <span class="tp-state__icon tp-state__icon--notice"><CalendarX aria-hidden="true" /></span>
          <p class="tp-state__title">{{ student.studentName }}本节课{{ attendanceLabel(attendanceStatus) }}，无需课评</p>
          <p>家长端只显示到课学员的课评。如需填写，请先在点名中改为到课或迟到。</p>
        </section>
        <div class="tp-action-bar">
          <button type="button" class="tp-btn tp-btn-primary tp-grow" @click="backToLesson">返回课次</button>
        </div>
      </template>

      <template v-else>
      <!-- 学员栏固定在顶部：写评语、传视频时始终知道是在给谁写 -->
      <div class="student-bar tp-sticky-heading">
        <button
          type="button"
          class="tp-icon-btn"
          :disabled="!nav.prev || isBusy"
          :aria-label="nav.prev ? `上一位：${nav.prev.studentName}` : '没有上一位'"
          @click="nav.prev && switchTo(nav.prev.studentId)"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" class="student-bar__who" aria-haspopup="dialog" :disabled="isBusy" @click="openPicker">
          <TpAvatar :name="student.studentName" :seed="student.studentId" />
          <span class="student-bar__text">
            <span class="student-bar__name">
              <span class="student-bar__name-text">{{ student.studentName }}</span>
              <ChevronDown class="student-bar__caret" aria-hidden="true" />
              <span v-if="isRevision" class="tp-tag tp-tag-success">已推送</span>
              <span v-else-if="attendanceStatus === 'late'" class="tp-tag tp-tag-warning">迟到</span>
            </span>
            <span class="tp-row__meta tp-num student-bar__meta">第 {{ nav.index + 1 }} / {{ nav.total }} 位 · 已推送 {{ summary.pushed }}</span>
          </span>
        </button>
        <button
          type="button"
          class="tp-icon-btn"
          :disabled="!nav.next || isBusy"
          :aria-label="nav.next ? `下一位：${nav.next.studentName}` : '没有下一位'"
          @click="nav.next && switchTo(nav.next.studentId)"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div class="tp-stack">
        <p v-if="restoredFromAutosave" class="tp-stale-notice tp-notice-info tp-m-0 tp-notice-static" role="status">已恢复你上次未保存的内容，记得保存或推送</p>
        <p class="tp-text-meta tp-m-0">{{ schedule.className }} · {{ friendlyDate(schedule.date) }} {{ shortTime(schedule.startTime) }}</p>

        <section class="tp-list">
          <div class="tp-row rating-row">
            <span class="tp-label tp-m-0">课堂评分</span>
            <div class="rating" role="radiogroup" aria-label="课堂评分">
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
                <Star :size="24" :class="n <= rating ? 'star-on' : 'star-off'" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section class="tp-card">
          <div class="tp-field">
            <label class="tp-label" for="comment">专属评语 <span class="tp-required">*</span></label>
            <textarea id="comment" v-model="comment" class="tp-input tp-input--lg" rows="5" maxlength="1000" placeholder="写下孩子这节课的表现、进步与建议" />
            <span class="tp-help tp-num tp-text-right">{{ comment.length }}/1000</span>
          </div>
          <div class="tp-field">
            <label class="tp-label" for="study-content">
              学习内容与知识点 <span v-if="studyContentRequired" class="tp-required">*</span> <small>全班共享</small>
            </label>
            <textarea id="study-content" v-model="studyContent" class="tp-input" rows="3" maxlength="1000" placeholder="这节课学了什么、重点知识点" />
          </div>
        </section>

        <section class="tp-card">
          <p class="tp-label"><strong class="media-owner">{{ student.studentName }}</strong>的照片与视频 <small>照片最多 9 张，视频 1 个，上传前自动压缩</small></p>
          <p v-if="uploading" class="tp-text-meta tp-num media-status" role="status">{{ uploadingText }}</p>
          <div class="media-grid">
            <div v-for="(photo, idx) in photos" :key="photo" class="media-cell">
              <img :src="photoThumbs.get(photo) || photo" alt="课堂照片" loading="lazy" />
              <button type="button" class="media-remove" :aria-label="`移除第 ${idx + 1} 张照片`" @click="photos.splice(idx, 1)">
                <X :size="16" aria-hidden="true" />
              </button>
            </div>
            <div v-if="videoUrl" class="media-cell media-cell--video">
              <video :src="videoUrl" :poster="videoPoster || undefined" :preload="videoPoster ? 'none' : 'metadata'" controls playsinline />
              <button type="button" class="media-remove" aria-label="移除视频" @click="removeVideo">
                <X :size="16" aria-hidden="true" />
              </button>
            </div>
            <label v-if="photos.length < 9" class="media-add" :class="{ 'is-disabled': uploading }">
              <ImagePlus :size="24" aria-hidden="true" />
              <span class="tp-num">{{ uploading === 'photo' ? `上传 ${photoProgress}` : '加照片' }}</span>
              <input type="file" accept="image/*" multiple class="sr-only" :disabled="!!uploading" @change="onPickPhotos" />
            </label>
            <button v-if="uploading === 'video'" type="button" class="media-add" @click="cancelVideoUpload">
              <span class="media-add__progress tp-num">{{ videoProgress }}%</span>
              <span>{{ videoStage === 'compress' ? '压缩中' : '上传中' }}，点此取消</span>
            </button>
            <label v-else-if="!videoUrl" class="media-add" :class="{ 'is-disabled': uploading }">
              <Video :size="24" aria-hidden="true" />
              <span>加视频</span>
              <input type="file" accept="video/*" class="sr-only" :disabled="!!uploading" @change="onPickVideo" />
            </label>
          </div>
        </section>
      </div>

      <div class="tp-action-bar">
        <button type="button" class="tp-btn tp-btn-secondary" :disabled="isBusy" @click="saveDraft">存草稿</button>
        <button type="button" class="tp-btn tp-btn-primary submit-btn" :disabled="isBusy" @click="submit">
          <span class="submit-btn__text">{{ submitText }}</span>
        </button>
        <button v-if="updatedNext" type="button" class="tp-link next-link" @click="switchTo(updatedNext.studentId)">
          继续写下一位：{{ updatedNext.studentName }}<ChevronRight aria-hidden="true" />
        </button>
      </div>
      </template>
    </template>

    <!-- 学员名单：点学员栏的姓名打开，可直接跳到任意一位 -->
    <TpSheet :open="pickerOpen && !!workbench.data.value" title="选择学员" @close="pickerOpen = false">
      <template #meta>
        <span class="tp-text-meta tp-num">已推送 {{ summary.pushed }}/{{ summary.attended }}</span>
      </template>
        <ul v-if="workbench.data.value" class="picker__list">
          <li v-for="s in workbench.data.value.students" :key="s.studentId">
            <button
              type="button"
              class="picker__row"
              :class="{ 'is-current': s.studentId === studentId }"
              :disabled="!needsEvaluation(s)"
              :aria-current="s.studentId === studentId ? 'true' : undefined"
              @click="switchTo(s.studentId)"
            >
              <TpAvatar :name="s.studentName" :seed="s.studentId" />
              <span class="picker__name">{{ s.studentName }}</span>
              <span class="tp-tag" :class="pickerTag(s).cls">{{ pickerTag(s).text }}</span>
            </button>
          </li>
        </ul>
    </TpSheet>
  </LoadState>
</template>

<script setup lang="ts">
import TpSheet from './components/TpSheet.vue'
import TpAvatar from './components/TpAvatar.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { tpConfirm, tpToast } from './utils/feedback'
import { CalendarX, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, ImagePlus, Star, Video, X } from 'lucide-vue-next'
import { teacherPortalApi, uploadApi, type AttendanceStatus, type WorkbenchStudent } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LoadState from './components/LoadState.vue'
import { compressImage } from './utils/compressImage'
import { readAutosave, readDraft, removeAutosave, removeDraft, writeAutosave, writeDraft, type EvaluationDraft } from './utils/evaluationDraft'
import { attendanceLabel, friendlyDate, htmlToText, isAttended, shortTime } from './utils/format'
import { isPushed, needsEvaluation, neighbours, submitLabel, submitPlan, summarize, type QueueSummary } from './utils/evaluationQueue'
import { compressVideo } from './utils/compressVideo'
import { uploadVideoWithProgress } from './utils/uploadVideo'
import { useLoad } from './utils/useLoad'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)}MB`
}

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
const students = computed(() => workbench.data.value?.students || [])
const nav = computed(() => neighbours(students.value, studentId))
const summary = computed(() => summarize(students.value))
const plan = computed(() => submitPlan(students.value, studentId))
/** 推送完最后一位后显示完成页 */
const finished = ref<QueueSummary | null>(null)
/** 修改已推送的课评后，队列里还有没写的人：在按钮下提示继续写 */
const updatedNext = ref<WorkbenchStudent | null>(null)
const pickerOpen = ref(false)

const comment = ref('')
const studyContent = ref('')
const rating = ref(5)
const photos = ref<string[]>([])
const videoUrl = ref('')
const uploading = ref<'' | 'photo' | 'video'>('')
const submitting = ref(false)
const isDirty = ref(false)
const restoredFromAutosave = ref(false)
const photoProgress = ref('')
const videoProgress = ref(0)
const videoStage = ref<'compress' | 'upload'>('compress')
const videoPoster = ref('')
/** 缩略图只用于显示；保存课评时仍提交原始链接 */
const photoThumbs = new Map<string, string>()
let cancelVideoTask: (() => void) | null = null

const isBusy = computed(() => submitting.value || !!uploading.value)
const uploadingText = computed(() => {
  const name = student.value?.studentName || ''
  if (uploading.value === 'photo') return `正在上传${name}的照片 ${photoProgress.value}`
  if (uploading.value === 'video') return `${name}的视频${videoStage.value === 'compress' ? '压缩中' : '上传中'} ${videoProgress.value}%`
  return ''
})
const submitText = computed(() => {
  if (submitting.value) return '提交中…'
  // 上传完才能推送：否则照片、视频可能落到下一位学员
  if (uploading.value === 'video') return `视频${videoStage.value === 'compress' ? '压缩中' : '上传中'} ${videoProgress.value}%`
  if (uploading.value === 'photo') return `照片上传中 ${photoProgress.value}`
  return submitLabel(plan.value)
})

function skippedText(s: QueueSummary) {
  return [s.leave ? `请假 ${s.leave} 人` : '', s.absent ? `缺勤 ${s.absent} 人` : ''].filter(Boolean).join('、')
}

function pickerTag(s: WorkbenchStudent): { text: string; cls: string } {
  if (!needsEvaluation(s)) return { text: `${attendanceLabel(s.recordedStatus || s.defaultStatus)} · 无需课评`, cls: 'tp-tag-muted' }
  if (s.studentId === studentId && !finished.value) return { text: '当前', cls: 'tp-tag-primary' }
  if (isPushed(s)) return { text: '已推送', cls: 'tp-tag-success' }
  const draft = readDraft(userId, lessonId, s.studentId) || readAutosave(userId, lessonId, s.studentId)
  if (draft?.comment.trim()) return { text: '草稿', cls: 'tp-tag-warning' }
  return { text: '未写', cls: 'tp-tag-muted' }
}

function openPicker() {
  pickerOpen.value = true
}

function evaluatePath(id: string) {
  return `/teacher/lessons/${lessonId}/evaluate/${id}`
}

/** 在本节课的学员之间切换：替换当前记录，返回键仍回到进来前的页面 */
function switchTo(id: string) {
  pickerOpen.value = false
  if (id === studentId) {
    // 完成页上点回刚推送的学员：重新加载，以「已推送」状态打开
    if (finished.value) {
      finished.value = null
      init()
    }
    return
  }
  router.replace(evaluatePath(id))
}

function backToLesson() {
  const lessonPath = `/teacher/lessons/${lessonId}`
  if (window.history.state?.back === lessonPath) router.back()
  else router.replace(lessonPath)
}
let serverStudyContent = ''
let hydrated = false
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

function currentContent(): EvaluationDraft {
  return {
    comment: comment.value,
    studyContent: studyContent.value,
    rating: rating.value,
    photos: [...photos.value],
    videoUrl: videoUrl.value,
    savedAt: new Date().toISOString(),
  }
}

function flushAutosave() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  if (isDirty.value) writeAutosave(userId, lessonId, studentId, currentContent())
}

function clearAutosave() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  removeAutosave(userId, lessonId, studentId)
}

watch([comment, studyContent, rating, videoUrl, () => photos.value.length], () => {
  if (!hydrated) return
  isDirty.value = true
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(flushAutosave, 800)
})

/** 接电话、切应用时立刻暂存：页面可能随后被系统回收 */
function onVisibilityChange() {
  if (document.hidden) flushAutosave()
}

async function init() {
  hydrated = false
  await workbench.load()
  const data = workbench.data.value
  const stu = student.value
  if (!data || !stu) return

  // 服务端在尚无课评时返回教研模板文案作占位：不能当成老师写的内容预填
  serverStudyContent = data.evaluationDraft.isExisting ? htmlToText(data.evaluationDraft.studyContentHtml) : ''
  const savedDraft = readDraft(userId, lessonId, studentId)
  const autosave = readAutosave(userId, lessonId, studentId)
  const useAutosave = !!autosave && (!savedDraft || autosave.savedAt > savedDraft.savedAt)
  const draft = useAutosave ? autosave : savedDraft
  const isDraftUsable = draft && !(stu.evaluatedAt && draft.savedAt < stu.evaluatedAt)
  const isRestoring = useAutosave && !!isDraftUsable
  restoredFromAutosave.value = isRestoring

  studyContent.value = (isDraftUsable && draft.studyContent) || serverStudyContent
  // 只回显老师对该学员写过的评语；没有专属课评时 currentComment 可能是考勤记录上的模板文案
  comment.value = (isDraftUsable && draft.comment) || (stu.hasPersonalEvaluation ? stu.currentComment || '' : '')
  rating.value = (isDraftUsable && draft.rating) || (stu.hasPersonalEvaluation ? stu.currentRating || 5 : 5)
  photos.value = isDraftUsable ? [...draft.photos] : [...(stu.photos || [])]
  videoUrl.value = isDraftUsable ? draft.videoUrl : stu.videoUrl || ''
  ;(stu.photos || []).forEach((photo, i) => {
    const thumb = stu.photoThumbs?.[i]
    if (thumb) photoThumbs.set(photo, thumb)
  })
  videoPoster.value = videoUrl.value && videoUrl.value === stu.videoUrl ? stu.videoPoster || '' : ''

  // 等上面的赋值触发完 watch 再开始记录修改
  queueMicrotask(() => {
    hydrated = true
    isDirty.value = isRestoring
  })
}

async function onPickPhotos(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files || [])
  input.value = ''
  if (picked.length === 0) return

  const room = 9 - photos.value.length
  if (picked.length > room) tpToast.warning(`最多 9 张，已取前 ${room} 张`)

  uploading.value = 'photo'
  const queue = picked.slice(0, room)
  let oversized = 0
  const failures: string[] = []
  // 逐张压缩上传：同时解码多张手机原图容易让低端机内存不足导致页面崩溃；弱网下也能保住已传成功的照片
  for (let i = 0; i < queue.length; i++) {
    photoProgress.value = `${i + 1}/${queue.length}`
    try {
      const file = await compressImage(queue[i])
      if (file.size > MAX_PHOTO_BYTES) {
        oversized += 1
        continue
      }
      const res = await uploadApi.uploadClassroomPhotos({ files: [file], scheduleEventId: lessonId })
      res.data.persistedUrls?.forEach((url, index) => {
        const thumb = res.data.items?.[index]?.thumbnailUrl
        if (thumb) photoThumbs.set(url, thumb)
      })
      photos.value.push(...(res.data.persistedUrls || []))
      if (res.data.failureCount > 0) failures.push(res.data.errors?.[0]?.reason || '上传失败')
    } catch (err: any) {
      failures.push(err?.message || '上传失败')
    }
  }
  uploading.value = ''
  if (oversized > 0) tpToast.warning(`${oversized} 张照片超过 10MB，已跳过`)
  if (failures.length > 0) tpToast.error(`${failures.length} 张照片未上传：${failures[0]}`)
}

async function onPickVideo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploading.value = 'video'
  try {
    videoStage.value = 'compress'
    videoProgress.value = 0
    const compression = compressVideo(file, (percent) => {
      videoProgress.value = percent
    })
    cancelVideoTask = compression.cancel
    const { file: output, compressed } = await compression.promise

    if (output.size > MAX_VIDEO_BYTES) {
      tpToast.error(`视频压缩后仍有 ${formatMb(output.size)}，超过 100MB 上限，请剪短后重试`)
      return
    }

    videoStage.value = 'upload'
    videoProgress.value = 0
    const upload = uploadVideoWithProgress(output, lessonId, (percent) => {
      videoProgress.value = percent
    })
    cancelVideoTask = upload.abort
    const uploaded = await upload.promise
    videoPoster.value = uploaded.posterUrl
    videoUrl.value = uploaded.videoUrl
    if (compressed) tpToast.success(`视频已压缩：${formatMb(file.size)} → ${formatMb(output.size)}`)
  } catch (err: any) {
    if (err?.name !== 'AbortError') tpToast.error(err?.message || '视频上传失败，请重试')
  } finally {
    cancelVideoTask = null
    uploading.value = ''
  }
}

function cancelVideoUpload() {
  cancelVideoTask?.()
}

function removeVideo() {
  videoUrl.value = ''
  videoPoster.value = ''
}

function saveDraft() {
  const saved = writeDraft(userId, lessonId, studentId, currentContent())
  if (!saved) {
    tpToast.error('当前浏览器无法保存草稿，请直接推送或关闭隐私模式')
    return
  }
  clearAutosave()
  isDirty.value = false
  restoredFromAutosave.value = false
  tpToast.success('草稿已保存在本机，尚未推送')
}

async function submit() {
  const stu = student.value
  const sch = schedule.value
  if (!stu || !sch) return
  const text = comment.value.trim()
  const content = studyContent.value.trim()
  if (!text) {
    tpToast.warning('请填写专属评语')
    return
  }
  if (studyContentRequired.value && !content) {
    tpToast.warning('本节课首次推送课评，请填写学习内容')
    return
  }

  // 按点击时的名单决定推送后去哪：推送过程中名单不会变
  const current = plan.value
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
    clearAutosave()
    isDirty.value = false
    restoredFromAutosave.value = false
    if (current.kind === 'update') {
      tpToast.success('课评已更新')
      if (current.next) updatedNext.value = current.next.student
      else backToLesson()
    } else if (current.kind === 'next') {
      tpToast.success(`已推送给${stu.studentName}的家长`)
      router.replace(evaluatePath(current.next.student.studentId))
    } else {
      finished.value = { ...summary.value, pushed: current.pushedAfter }
      // 后台刷新名单：「逐个回看」里刚推送的学员显示为已推送
      workbench.load()
    }
  } catch (err: any) {
    tpToast.error(err?.message || '提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

onBeforeRouteLeave(async () => {
  if (uploading.value === 'video') {
    const leave = await tpConfirm({
      title: '离开此页？',
      message: '视频还在压缩或上传，离开后会中断。',
      confirmText: '离开',
      cancelText: '继续等待',
      danger: true,
    })
    if (!leave) return false
    cancelVideoTask?.()
  }
  if (!isDirty.value) return true
  const discard = await tpConfirm({
    title: '离开此页？',
    message: '内容尚未保存，离开后将丢失。',
    confirmText: '离开',
    cancelText: '继续编辑',
    danger: true,
  })
  if (!discard) return false
  clearAutosave()
  return true
})

/** 切换学员：写到一半的内容留在本机，切回来时自动恢复；视频上传中切换会中断上传 */
onBeforeRouteUpdate(async () => {
  pickerOpen.value = false
  if (uploading.value === 'video') {
    const go = await tpConfirm({
      title: '切换学员？',
      message: '视频还在压缩或上传，切换学员后会中断。',
      confirmText: '切换',
      cancelText: '继续等待',
      danger: true,
    })
    if (!go) return false
    cancelVideoTask?.()
  }
  flushAutosave()
  return true
})

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', flushAutosave)
  init()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', flushAutosave)
  if (autosaveTimer) clearTimeout(autosaveTimer)
})
</script>

<style scoped>
.rating-row {
  justify-content: space-between;
  flex-wrap: wrap;
  padding-top: var(--tp-space-1);
  padding-bottom: var(--tp-space-1);
}
.rating {
  display: flex;
  margin-right: calc(-1 * var(--tp-space-2));
}
.star-btn {
  width: var(--tp-control);
  height: var(--tp-control);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.star-btn svg {
  transition: transform var(--tp-spring-bouncy-dur) var(--tp-spring-bouncy);
}
.star-btn:active svg {
  transform: scale(0.82);
  transition-duration: 90ms;
  transition-timing-function: var(--tp-ease-out);
}
/* 新点亮的星依次弹一下 */
.star-btn .star-on {
  animation: star-pop var(--tp-spring-bouncy-dur) var(--tp-spring-bouncy) backwards;
}
/* 只写起止两点，回弹来自弹簧曲线 */
@keyframes star-pop {
  from { transform: scale(0.7); }
  to { transform: scale(1); }
}
.star-on {
  color: var(--tp-rating-line);
  fill: var(--tp-rating);
}
.star-off {
  color: var(--tp-line-strong);
  fill: var(--tp-rating-off);
}
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--tp-space-2);
}
@media (min-width: 768px) {
  .media-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
.media-cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--tp-radius-sm);
  overflow: hidden;
  background: var(--tp-surface-sunken);
}
.media-cell--video {
  background: var(--tp-media-bg);
}
.media-cell img,
.media-cell video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.media-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: var(--tp-control);
  height: var(--tp-control);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: var(--tp-space-1);
  border: 0;
  background: transparent;
  color: var(--tp-on-accent);
  cursor: pointer;
}
.media-remove svg {
  box-sizing: content-box;
  padding: 3px;
  border-radius: 50%;
  background: var(--tp-scrim);
}
.media-add {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--tp-space-1);
  padding: var(--tp-space-1);
  border: 1.5px dashed var(--tp-line-strong);
  border-radius: var(--tp-radius-md);
  background: var(--tp-surface-hover);
  color: var(--tp-text-2);
  font-size: var(--tp-fs-small);
  font-family: inherit;
  text-align: center;
  cursor: pointer;
  transition: background var(--tp-motion);
}
.media-add:hover {
  background: var(--tp-surface-hover);
}
.media-add.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}
.media-add__progress {
  font-size: var(--tp-fs-title);
  font-weight: 600;
  color: var(--tp-text-1);
}
/* 学员栏：吸顶，左右切换，点姓名打开名单 */
.student-bar {
  display: flex;
  align-items: center;
  gap: var(--tp-space-1);
  margin-bottom: var(--tp-space-3);
  padding-top: var(--tp-space-1);
  padding-bottom: var(--tp-space-1);
  border-bottom: 1px solid var(--tp-line);
}
.student-bar .tp-icon-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.student-bar__who {
  flex: 1;
  min-width: 0;
  min-height: var(--tp-control);
  display: flex;
  align-items: center;
  gap: var(--tp-space-2);
  padding: var(--tp-space-1) var(--tp-space-2);
  border: 0;
  border-radius: var(--tp-radius-sm);
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.student-bar__who:hover {
  background: var(--tp-surface-hover);
}
.student-bar__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.student-bar__name {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: var(--tp-fs-title);
  font-weight: 600;
  color: var(--tp-text-1);
}
.student-bar__name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.student-bar__name .tp-tag {
  flex-shrink: 0;
  margin-left: var(--tp-space-1);
}
.student-bar__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.student-bar__caret {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--tp-text-3);
}
.media-owner {
  color: var(--tp-text-1);
  font-weight: 600;
}
.media-status {
  margin: 0 0 var(--tp-space-2);
}
/* 主按钮文字可能较长 (含下一位姓名)：占满剩余宽度，放不下时省略 */
.submit-btn {
  flex: 1;
  min-width: 0;
}
.submit-btn__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.next-link {
  flex-basis: 100%;
  justify-content: center;
  margin-right: 0;
}
.next-link svg {
  width: var(--tp-icon-sm);
  height: var(--tp-icon-sm);
}
.finish__title {
  font-size: var(--tp-fs-title);
  font-weight: 600;
}
/* 学员名单 (放在 TpSheet 里)：整行可点，弹层自带内边距，这里抵消掉让行贴边 */
.picker__list {
  margin: calc(-1 * var(--tp-space-4));
  padding: var(--tp-space-1) 0;
  list-style: none;
}
.picker__row {
  width: 100%;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: var(--tp-space-3);
  padding: var(--tp-space-2) var(--tp-space-4);
  border: 0;
  background: transparent;
  color: var(--tp-text-1);
  font-family: inherit;
  font-size: var(--tp-fs-body);
  text-align: left;
  cursor: pointer;
}
.picker__row:hover:not(:disabled) {
  background: var(--tp-surface-hover);
}
.picker__row.is-current {
  background: var(--tp-accent-soft);
}
.picker__row:disabled {
  color: var(--tp-text-3);
  cursor: default;
}
.picker__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
