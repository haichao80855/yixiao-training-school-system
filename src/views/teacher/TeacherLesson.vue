<template>
  <LoadState :loading="workbench.loading.value" :error="workbench.error.value" :has-data="!!schedule" @retry="reload">
    <template v-if="schedule">
      <section class="tp-card">
        <div class="flex items-center justify-between gap-3">
          <span class="text-[15px] font-semibold text-st-title tabular-nums">
            {{ friendlyDate(schedule.date) }} {{ shortTime(schedule.startTime) }}–{{ shortTime(schedule.endTime) }}
          </span>
          <span class="tp-tag" :class="isSettled ? 'tp-tag-success' : 'tp-tag-muted'">{{ lessonStatusLabel(schedule.status) }}</span>
        </div>
        <p class="m-0 mt-1.5 text-[16px] font-medium text-st-title break-words">{{ schedule.className }}</p>
        <p class="m-0 mt-1 text-[13px] text-st-muted break-words">
          {{ schedule.courseName }} · {{ schedule.classroomName }} · {{ schedule.teacherName }}
        </p>
      </section>

      <div class="flex items-center justify-between gap-2 mt-4 mb-2">
        <h2 class="m-0 text-[15px] font-semibold text-st-title tabular-nums">
          点名 {{ attendedCount }}/{{ students.length }}
        </h2>
        <span class="text-[12px]" :class="syncState === 'failed' ? 'text-st-danger' : 'text-st-muted'" role="status">{{ syncText }}</span>
      </div>

      <p v-if="students.length === 0" class="tp-card text-center text-st-muted text-[14px] m-0">本班暂无在读学员</p>

      <div class="grid gap-2.5">
        <article v-for="stu in students" :key="stu.studentId" class="tp-card">
          <div class="flex items-start justify-between gap-2">
            <RouterLink :to="`/teacher/students/${stu.studentId}`" class="min-w-0 no-underline text-inherit">
              <span class="text-[15px] font-medium text-st-title break-words">{{ stu.studentName }}</span>
              <span class="block text-[12px] text-st-muted tabular-nums">
                {{ stu.studentNo }} · 剩余
                <span :class="stu.isLowBalance ? 'text-st-danger font-medium' : ''">{{ stu.remainingLessons }}</span> 课时
              </span>
            </RouterLink>
            <RouterLink
              v-if="stu.isEvaluated"
              :to="`/teacher/lessons/${lessonId}/review/${stu.studentId}`"
              class="tp-btn tp-btn-secondary tp-btn-sm shrink-0"
            >
              <CircleCheck class="w-4 h-4 text-st-success" />看学情
            </RouterLink>
            <RouterLink
              v-else
              :to="`/teacher/lessons/${lessonId}/evaluate/${stu.studentId}`"
              class="tp-btn tp-btn-secondary tp-btn-sm shrink-0"
            >
              {{ stu.hasDraft ? '继续写课评' : '写课评' }}
            </RouterLink>
          </div>

          <div class="flex items-center gap-2 mt-2.5">
            <div class="tp-segment flex-1" role="group" :aria-label="`${stu.studentName} 出勤`">
              <button
                v-for="opt in ATTENDANCE_OPTIONS"
                :key="opt.value"
                type="button"
                class="tp-segment-item"
                :class="{ 'is-active': stu.status === opt.value }"
                :aria-pressed="stu.status === opt.value"
                @click="setStatus(stu, opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
            <select
              class="deduct-select"
              :value="stu.deduct"
              :disabled="!isAttended(stu.status)"
              :aria-label="`${stu.studentName} 扣减课时`"
              @change="setDeduct(stu, Number(($event.target as HTMLSelectElement).value))"
            >
              <option :value="0">免扣</option>
              <option :value="1">扣1</option>
              <option :value="2">扣2</option>
            </select>
          </div>
        </article>
      </div>

      <div v-if="students.length > 0" class="tp-action-bar flex-wrap">
        <template v-if="!isSettled">
          <button type="button" class="tp-btn tp-btn-secondary" @click="markAllPresent">全部到课</button>
          <button type="button" class="tp-btn tp-btn-primary flex-1" :disabled="isFuture || busy" @click="settle">
            {{ isFuture ? '未到上课日期' : '结课消课' }}
          </button>
        </template>
        <button
          v-else-if="hasUnsavedChanges"
          type="button"
          class="tp-btn tp-btn-primary flex-1"
          :disabled="busy"
          @click="saveSettledChanges"
        >
          保存考勤修改
        </button>
        <button v-if="draftStudents.length > 0" type="button" class="tp-btn tp-btn-secondary flex-1" :disabled="busy" @click="pushDrafts">
          <Send class="w-4 h-4" />推送草稿 ({{ draftStudents.length }})
        </button>
        <p v-if="isSettled && !hasUnsavedChanges && draftStudents.length === 0" class="m-0 py-1 text-[13px] text-st-muted">
          已结课。修改出勤会按差额调整学员课时。
        </p>
      </div>
    </template>
  </LoadState>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, Send } from 'lucide-vue-next'
import { teacherPortalApi, type AttendanceStatus, type WorkbenchStudent } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import LoadState from './components/LoadState.vue'
import { readDraft, removeDraft } from './utils/evaluationDraft'
import { ATTENDANCE_OPTIONS, friendlyDate, isAttended, lessonStatusLabel, shortTime, todayStr } from './utils/format'
import { useLoad } from './utils/useLoad'

interface RosterRow extends WorkbenchStudent {
  status: AttendanceStatus
  deduct: number
  isEvaluated: boolean
  hasDraft: boolean
}

const route = useRoute()
const authStore = useAuthStore()
const lessonId = route.params.id as string
const userId = authStore.user?.id || ''

const workbench = useLoad(async () => (await teacherPortalApi.getLessonWorkbench(lessonId)).data)
const students = ref<RosterRow[]>([])
const baseline = ref(new Map<string, { status: AttendanceStatus; deduct: number }>())
const syncState = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle')
const busy = ref(false)
let syncTimer: ReturnType<typeof setTimeout> | null = null

const schedule = computed(() => workbench.data.value?.schedule)
const isSettled = computed(() => schedule.value?.status === 'completed')
const isFuture = computed(() => !!schedule.value && schedule.value.date > todayStr())
const attendedCount = computed(() => students.value.filter((s) => isAttended(s.status)).length)
const draftStudents = computed(() => students.value.filter((s) => s.hasDraft && !s.isEvaluated))
const changedStudents = computed(() =>
  students.value.filter((s) => {
    const base = baseline.value.get(s.studentId)
    return !base || base.status !== s.status || base.deduct !== s.deduct
  }),
)
const hasUnsavedChanges = computed(() => isSettled.value && changedStudents.value.length > 0)

const syncText = computed(() => {
  if (syncState.value === 'saving') return '保存中…'
  if (syncState.value === 'saved') return '点名已保存'
  if (syncState.value === 'failed') return '保存失败，修改后会自动重试'
  return isSettled.value ? '' : '点名自动保存'
})

/** 课评是否已送达家长：以老师对该学员写过并发布的专属课评为准 */
function toRow(s: WorkbenchStudent): RosterRow {
  const status = s.recordedStatus || s.defaultStatus
  const isEvaluated = Boolean(s.isPublished && s.hasPersonalEvaluation)
  const draft = readDraft(userId, lessonId, s.studentId)
  const draftIsStale = draft && isEvaluated && s.evaluatedAt && draft.savedAt < s.evaluatedAt
  if (draftIsStale) removeDraft(userId, lessonId, s.studentId)
  return {
    ...s,
    status,
    deduct: isAttended(status) ? s.defaultDeductLessons : 0,
    isEvaluated,
    hasDraft: Boolean(draft && !draftIsStale && draft.comment.trim()),
  }
}

async function reload() {
  await workbench.load()
  const data = workbench.data.value
  if (!data) return
  students.value = data.students.map(toRow)
  baseline.value = new Map(students.value.map((s) => [s.studentId, { status: s.status, deduct: s.deduct }]))
}

function afterAttendanceChange() {
  // 已结课的修改会变动学员课时，必须由老师确认后再保存；未结课的点名自动保存
  if (isSettled.value) return
  syncState.value = 'saving'
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(flushSync, 400)
}

async function flushSync() {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  if (students.value.length === 0) return
  syncState.value = 'saving'
  try {
    await teacherPortalApi.syncAttendance(
      lessonId,
      students.value.map((s) => ({ studentId: s.studentId, attendanceStatus: s.status, deductLessons: s.deduct })),
    )
    syncState.value = 'saved'
    students.value.forEach((s) => {
      s.isRecorded = true
    })
    baseline.value = new Map(students.value.map((s) => [s.studentId, { status: s.status, deduct: s.deduct }]))
  } catch {
    syncState.value = 'failed'
  }
}

function setStatus(stu: RosterRow, status: AttendanceStatus) {
  if (stu.status === status) return
  stu.status = status
  if (!isAttended(status)) stu.deduct = 0
  else if (stu.deduct === 0) stu.deduct = 1
  afterAttendanceChange()
}

function setDeduct(stu: RosterRow, deduct: number) {
  stu.deduct = deduct
  afterAttendanceChange()
}

function markAllPresent() {
  students.value.forEach((s) => {
    if (!isAttended(s.status)) {
      s.status = 'present'
      s.deduct = 1
    }
  })
  afterAttendanceChange()
}

async function settle() {
  const count = (status: AttendanceStatus) => students.value.filter((s) => s.status === status).length
  const totalDeduct = students.value.reduce((sum, s) => sum + (isAttended(s.status) ? s.deduct : 0), 0)
  try {
    await ElMessageBox.confirm(
      `到课 ${count('present')}，迟到 ${count('late')}，请假 ${count('leave')}，缺勤 ${count('absent')}，合计扣减 ${totalDeduct} 课时。结课后不会自动通知家长，课评可继续填写并推送。`,
      '确认结课消课',
      { confirmButtonText: '确认结课', cancelButtonText: '再看看' },
    )
  } catch {
    return
  }

  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  busy.value = true
  try {
    await teacherPortalApi.settleLesson(
      lessonId,
      students.value.map((s) => ({ studentId: s.studentId, status: s.status, deductLessons: s.deduct })),
    )
    ElMessage.success('已结课')
    syncState.value = 'idle'
    await reload()
  } catch (err: any) {
    ElMessage.error(err?.message || '结课失败，请重试')
  } finally {
    busy.value = false
  }
}

async function saveSettledChanges() {
  const changed = changedStudents.value
  const detail = changed
    .map((s) => {
      const base = baseline.value.get(s.studentId)
      return `${s.studentName}：扣 ${base?.deduct ?? 0} → 扣 ${s.deduct} 课时`
    })
    .join('；')
  try {
    await ElMessageBox.confirm(`${detail}。保存后学员课时按差额调整。`, '确认修改考勤', {
      confirmButtonText: '确认修改',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  busy.value = true
  try {
    await teacherPortalApi.syncAttendance(
      lessonId,
      changed.map((s) => ({ studentId: s.studentId, attendanceStatus: s.status, deductLessons: s.deduct })),
    )
    ElMessage.success('考勤已修改')
    await reload()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败，请重试')
  } finally {
    busy.value = false
  }
}

async function pushDrafts() {
  const targets = draftStudents.value
  const data = workbench.data.value
  if (!data) return
  try {
    await ElMessageBox.confirm(`将向 ${targets.length} 位学员的家长推送已保存的课评草稿。`, '推送草稿', {
      confirmButtonText: '确认推送',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  busy.value = true
  await flushSyncIfNeeded()
  const failures: string[] = []
  for (const stu of targets) {
    const draft = readDraft(userId, lessonId, stu.studentId)
    if (!draft) continue
    // 课次首次发布必须有大纲，否则服务端会写入教研模板文案
    if (!data.evaluationDraft.isExisting && !draft.studyContent.trim()) {
      failures.push(`${stu.studentName}（未填写学习内容）`)
      continue
    }
    try {
      await teacherPortalApi.publishStudentEvaluation({
        scheduleEventId: lessonId,
        studentId: stu.studentId,
        status: stu.status,
        deductLessons: stu.deduct,
        comment: draft.comment.trim(),
        rating: draft.rating,
        photos: draft.photos,
        videoUrl: draft.videoUrl,
        studyContent: draft.studyContent.trim() || undefined,
        lessonTitle: `${data.schedule.className} ${data.schedule.date} 随堂课评`,
      })
      removeDraft(userId, lessonId, stu.studentId)
      // 首条发布后课次已有课评，同批后续学员不再受「首次发布」校验限制
      data.evaluationDraft.isExisting = true
    } catch (err: any) {
      failures.push(`${stu.studentName}（${err?.message || '推送失败'}）`)
    }
  }
  busy.value = false
  await reload()

  if (failures.length > 0) {
    ElMessageBox.alert(`未推送：${failures.join('、')}`, '部分课评未推送', { confirmButtonText: '知道了' })
  } else {
    ElMessage.success('已推送')
  }
}

/** 推送前把未结课课次的点名落库：没有考勤记录的学员收不到课评通知 */
async function flushSyncIfNeeded() {
  if (!isSettled.value && (syncTimer || students.value.some((s) => !s.isRecorded))) {
    await flushSync()
  }
}

onBeforeRouteLeave(async () => {
  if (syncTimer) await flushSync()
  if (!hasUnsavedChanges.value) return true
  try {
    await ElMessageBox.confirm('考勤修改尚未保存，离开后将丢失。', '放弃修改？', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '留在此页',
    })
    return true
  } catch {
    return false
  }
})

onBeforeUnmount(() => {
  if (syncTimer) clearTimeout(syncTimer)
})

onMounted(reload)
</script>

<style scoped>
.deduct-select {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 6px;
  border: 1px solid var(--st-color-border-dark);
  border-radius: 10px;
  background: #fff;
  color: var(--st-color-title);
  font-size: 16px;
  font-family: inherit;
}
.deduct-select:disabled {
  background: #f1f5f9;
  color: var(--st-color-placeholder);
}
</style>
