<template>
  <LoadState :loading="workbench.loading.value" :error="workbench.error.value" :has-data="!!schedule" @retry="reload">
    <div v-if="schedule" class="lesson">
      <section class="tp-card lesson__summary">
        <div class="lesson__summary-head">
          <span class="tp-text-meta tp-num">{{ friendlyDate(schedule.date) }} {{ shortTime(schedule.startTime) }}–{{ shortTime(schedule.endTime) }}</span>
          <span class="tp-tag" :class="isSettled ? 'tp-tag-success' : 'tp-tag-muted'">{{ lessonStatusLabel(schedule.status) }}</span>
        </div>
        <h2 class="lesson__class">{{ schedule.className }}</h2>
        <p class="tp-text-meta" style="margin: 4px 0 0">{{ schedule.courseName }} · {{ schedule.classroomName }}</p>
        <div class="tp-metrics">
          <div class="tp-metric">
            <span class="tp-metric__value">{{ attendedCount }}<small>/{{ students.length }}</small></span>
            <span class="tp-metric__label">到课</span>
          </div>
          <div class="tp-metric">
            <span class="tp-metric__value">{{ totalDeduct }}</span>
            <span class="tp-metric__label">{{ isSettled ? '已扣课时' : '将扣课时' }}</span>
          </div>
          <div class="tp-metric">
            <span class="tp-metric__value">{{ evaluatedCount }}<small>/{{ attendedCount }}</small></span>
            <span class="tp-metric__label">已推送课评</span>
          </div>
        </div>
      </section>

      <section class="lesson__roster">
        <div class="tp-section-head tp-sticky-heading">
          <div class="roster-heading">
            <h2 class="tp-section-title">点名</h2>
            <button v-if="syncState === 'failed'" type="button" class="sync-retry" @click="flushSync">保存失败，点此重试</button>
            <span v-else-if="syncText" class="tp-text-meta" role="status">{{ syncText }}</span>
          </div>
          <button v-if="!isSettled && attendedCount < students.length" type="button" class="tp-link" @click="markAllPresent">全部到课</button>
        </div>

        <p v-if="students.length === 0" class="tp-card tp-state" style="margin: 0">本班暂无在读学员</p>
        <div v-else class="tp-list">
          <article v-for="stu in students" :key="stu.studentId" class="roster-row" :class="`is-${stu.status}`">
            <RouterLink :to="`/teacher/students/${stu.studentId}`" class="roster-row__person">
              <span class="tp-avatar" aria-hidden="true">{{ stu.studentName.slice(0, 1) }}</span>
              <span class="tp-row__body">
                <span class="tp-row__title" style="display: block">{{ stu.studentName }}</span>
                <span class="tp-row__meta tp-num" style="display: block">
                  剩余 <span :class="{ 'is-low': stu.isLowBalance }">{{ stu.remainingLessons }}</span> 课时
                </span>
              </span>
            </RouterLink>

            <div class="roster-row__controls">
              <div class="tp-segment attendance" role="group" :aria-label="`${stu.studentName} 出勤`">
                <button
                  v-for="opt in ATTENDANCE_OPTIONS"
                  :key="opt.value"
                  type="button"
                  class="tp-segment-item"
                  :class="[`attendance--${opt.value}`, { 'is-active': stu.status === opt.value }]"
                  :aria-pressed="stu.status === opt.value"
                  @click="setStatus(stu, opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>
              <select
                class="deduct-select tp-num"
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

            <RouterLink
              v-if="stu.isEvaluated"
              :to="`/teacher/lessons/${lessonId}/review/${stu.studentId}`"
              class="tp-link roster-row__eval roster-row__eval--done"
            >
              <CircleCheck class="eval-done" aria-hidden="true" />看学情
            </RouterLink>
            <!-- 家长端只给到课学员显示课评：请假、缺勤写了家长也看不到 -->
            <span v-else-if="!isAttended(stu.status)" class="tp-text-meta roster-row__eval roster-row__eval--none">无需课评</span>
            <RouterLink
              v-else
              :to="`/teacher/lessons/${lessonId}/evaluate/${stu.studentId}`"
              class="tp-link roster-row__eval"
            >
              {{ stu.hasDraft ? '继续写' : '写课评' }}
            </RouterLink>
          </article>
        </div>
      </section>

      <div v-if="students.length > 0" class="tp-action-bar lesson__actions">
        <button v-if="!isSettled" type="button" class="tp-btn tp-btn-primary" style="flex: 1" :disabled="isFuture || busy" @click="settle">
          {{ isFuture ? '未到上课日期' : '结课消课' }}
        </button>
        <button v-else-if="hasUnsavedChanges" type="button" class="tp-btn tp-btn-primary" style="flex: 1" :disabled="busy" @click="saveSettledChanges">
          保存考勤修改
        </button>
        <button v-if="draftStudents.length > 0" type="button" class="tp-btn tp-btn-secondary" style="flex: 1" :disabled="busy" @click="pushDrafts">
          <Send aria-hidden="true" />推送草稿 ({{ draftStudents.length }})
        </button>
        <p v-if="isSettled && !hasUnsavedChanges && draftStudents.length === 0" class="tp-text-meta" style="margin: 4px 0">
          已结课。修改出勤会按差额调整学员课时。
        </p>
      </div>
    </div>
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
import { usePageRefresh } from './utils/pageRefresh'
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
const totalDeduct = computed(() => students.value.reduce((sum, s) => sum + (isAttended(s.status) ? s.deduct : 0), 0))
const evaluatedCount = computed(() => students.value.filter((s) => s.isEvaluated).length)
const draftStudents = computed(() => students.value.filter((s) => s.hasDraft && !s.isEvaluated && isAttended(s.status)))
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
  if (syncTimer || syncState.value === 'failed') await flushSync()
  const lost = hasUnsavedChanges.value || syncState.value === 'failed'
  if (!lost) return true
  try {
    await ElMessageBox.confirm(
      syncState.value === 'failed' ? '点名没能保存到服务器，请检查网络。离开后本次修改将丢失。' : '考勤修改尚未保存，离开后将丢失。',
      '放弃修改？',
      { confirmButtonText: '放弃修改', cancelButtonText: '留在此页' },
    )
    return true
  } catch {
    return false
  }
})

/** 接电话、切应用时立刻保存，不等防抖：页面可能随后被系统回收 */
function onVisibilityChange() {
  if (document.hidden && syncTimer) flushSync()
}

function onOnline() {
  if (syncState.value === 'failed') flushSync()
}

/** 有未保存的点名时不刷新，否则服务端旧数据会覆盖老师刚点的内容 */
function refresh() {
  if (syncTimer || syncState.value === 'saving' || syncState.value === 'failed' || hasUnsavedChanges.value || busy.value) return
  return reload()
}

usePageRefresh(refresh)

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)
  reload()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', onOnline)
  if (syncTimer) clearTimeout(syncTimer)
})
</script>

<style scoped>
.lesson {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--tp-space-3);
}
.lesson__summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tp-space-2);
}
.lesson__class {
  margin: var(--tp-space-1) 0 0;
  font-size: var(--tp-fs-title);
  font-weight: 600;
  line-height: var(--tp-lh-tight);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.tp-metric__value small {
  font-size: var(--tp-fs-small);
  font-weight: 400;
  color: var(--tp-text-3);
}

.roster-heading {
  display: flex;
  align-items: center;
  gap: var(--tp-space-2);
  min-width: 0;
}
.roster-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'person eval'
    'controls controls';
  align-items: center;
  gap: var(--tp-space-2) var(--tp-space-3);
  padding: var(--tp-space-3) var(--tp-space-4);
}
.roster-row__person {
  grid-area: person;
  display: flex;
  align-items: center;
  gap: var(--tp-space-3);
  min-width: 0;
  min-height: var(--tp-control);
  color: inherit;
  text-decoration: none;
}
.roster-row__controls {
  grid-area: controls;
  display: flex;
  align-items: center;
  gap: var(--tp-space-2);
  min-width: 0;
}
/* 点名时的次要操作：做成文字，整列名单才不会被一排方框打断 */
.roster-row__eval {
  grid-area: eval;
  justify-content: flex-end;
  gap: var(--tp-space-1);
  font-size: 14px;
}
.roster-row__eval svg {
  width: 16px;
  height: 16px;
}
.roster-row__eval--done {
  color: var(--tp-text-2);
}
.roster-row__eval--none {
  display: flex;
  align-items: center;
  min-height: var(--tp-control);
  white-space: nowrap;
  color: var(--tp-text-3);
}
.is-low {
  color: var(--tp-danger);
  font-weight: 600;
}
.eval-done {
  color: var(--tp-success);
}
.attendance {
  flex: 1;
  min-width: 0;
}
/* 到课是常态，保持中性；迟到、请假、缺勤这些异常才显色，全班扫一眼就能找到 */
.attendance--late.is-active {
  background: var(--tp-warning-soft);
  color: var(--tp-warning);
}
.attendance--leave.is-active {
  background: var(--tp-accent-soft);
  color: var(--tp-accent);
}
.attendance--absent.is-active {
  background: var(--tp-danger-soft);
  color: var(--tp-danger);
}
.deduct-select {
  flex-shrink: 0;
  min-height: 48px;
  padding: 0 var(--tp-space-1);
  border: 1px solid var(--tp-line-strong);
  border-radius: var(--tp-radius-md);
  background: var(--tp-surface);
  color: var(--tp-text-1);
  font-size: 16px;
  font-family: inherit;
}
.deduct-select:disabled {
  background: var(--tp-surface-sunken);
  border-color: transparent;
  color: var(--tp-text-3);
  opacity: 1;
}
.sync-retry {
  min-height: 32px;
  padding: 0 var(--tp-space-3);
  border: 0;
  border-radius: var(--tp-radius-sm);
  background: var(--tp-danger-soft);
  color: var(--tp-danger);
  font-size: var(--tp-fs-small);
  font-family: inherit;
  cursor: pointer;
}
/* 平板以上：一个学员一行，便于快速扫读 */
@media (min-width: 768px) {
  .roster-row {
    grid-template-columns: minmax(120px, 1fr) minmax(320px, 2fr) 104px;
    grid-template-areas: 'person controls eval';
  }
}
/* 电脑：左边是课次概览和主操作，右边是名单 */
@media (min-width: 1024px) {
  .lesson {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    grid-template-rows: auto auto 1fr;
    grid-template-areas:
      'summary roster'
      'actions roster'
      '. roster';
    align-items: start;
    column-gap: var(--tp-space-6);
  }
  .lesson__summary {
    grid-area: summary;
  }
  .lesson__roster {
    grid-area: roster;
    min-width: 0;
  }
  .lesson__actions {
    grid-area: actions;
    position: static;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }
  .tp-sticky-heading {
    margin: 0;
    padding: 0;
  }
  .roster-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'person eval'
      'controls controls';
  }
}
@media (min-width: 1280px) {
  .roster-row {
    grid-template-columns: minmax(120px, 1fr) minmax(300px, 2fr) 104px;
    grid-template-areas: 'person controls eval';
  }
}
</style>
