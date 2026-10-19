<template>
  <el-dialog
    v-model="visible"
    title="一键结课履约工作台 (随堂消课 · 随堂课评 · 家长通知)"
    :width="DIALOG_SIZE.lg"
    destroy-on-close
    :close-on-click-modal="false"
    class="lesson-fulfillment-dialog !rounded-xl"
  >
    <div v-loading="loading" class="space-y-4 max-h-[78vh] overflow-y-auto px-1 pr-2">
      <!-- 1. 顶部排课全景与履约模式切换 -->
      <div class="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-3.5 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-white bg-indigo-600 px-2 py-0.5 rounded shadow-xs">
              {{ currentLesson?.className }}
            </span>
            <span class="text-sm font-extrabold text-st-title">
              {{ currentLesson?.lessonTitle || currentLesson?.courseName }}
            </span>
          </div>
          <div class="text-xs text-st-secondary flex items-center gap-3">
            <span class="inline-flex items-center gap-1"><Calendar class="w-3.5 h-3.5 text-st-primary" />{{ currentLesson?.date }} {{ currentLesson?.startTime }} - {{ currentLesson?.endTime }}</span>
            <span class="inline-flex items-center gap-1"><MapPin class="w-3.5 h-3.5 text-amber-500" />{{ currentLesson?.classroomName }}</span>
            <span class="inline-flex items-center gap-1"><User class="w-3.5 h-3.5 text-st-primary" />{{ currentLesson?.teacherName }}</span>
          </div>
        </div>

        <!-- 履约模式切换 -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-st-title">结课模式:</span>
          <el-radio-group v-model="fulfillmentMode" size="small">
            <el-radio-button label="FULL_SETTLE">
              一键全量结课 (消课+课评+通知)
            </el-radio-button>
            <el-radio-button label="ATTENDANCE_ONLY">
              仅随堂打卡 (课后补评)
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- 2. 全景看板指标透视 (Zero-ceremony 就绪态) -->
      <div v-if="workbenchSummary" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center text-xs">
        <div class="bg-white p-2 rounded border border-gray-100">
          <div class="text-st-muted text-[11px]">参课学员总数</div>
          <div class="text-base font-extrabold text-st-title font-mono">{{ workbenchSummary.totalStudents }} 人</div>
        </div>
        <div class="bg-white p-2 rounded border border-gray-100">
          <div class="text-st-muted text-[11px]">实到打卡人次</div>
          <div class="text-base font-extrabold text-emerald-600 font-mono">{{ presentCount }} 人</div>
        </div>
        <div class="bg-white p-2 rounded border border-gray-100">
          <div class="text-st-muted text-[11px]">预计课消学时</div>
          <div class="text-base font-extrabold text-amber-600 font-mono">{{ totalEstimatedDeduct }} 课时</div>
        </div>
        <div class="bg-white p-2 rounded border border-gray-100">
          <div class="text-st-muted text-[11px]">微信推送就绪</div>
          <div class="text-base font-extrabold text-indigo-600 font-mono">
            {{ workbenchSummary.wechatBoundCount }} / {{ workbenchSummary.totalStudents }}
          </div>
        </div>
      </div>

      <!-- 3. 随堂花名册与点名考勤区 (默认全勤到课 Present-by-default) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-st-title flex items-center gap-1.5">
              <ClipboardList class="w-4 h-4 text-st-primary" />
              <span>学员考勤与个性化学情 (全员默认出勤打卡)</span>
            </span>
            <span class="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
              <Lightbulb class="w-3.5 h-3.5 text-emerald-600" />
              <span>90% 课堂无需逐项修改，点击异常学员即可快速切换</span>
            </span>
          </div>
          <el-button link type="primary" size="small" @click="handleBatchAllPresent">
            一键全员置为到课
          </el-button>
        </div>

        <div class="border border-st-border rounded-lg overflow-hidden bg-white shadow-xs divide-y divide-gray-100">
          <div
            v-for="(st, idx) in rosterList"
            :key="st.studentId"
            class="p-2.5 transition-colors hover:bg-gray-50/80 flex flex-wrap items-center justify-between gap-3 text-xs"
            :class="[st.status !== 'present' ? 'bg-amber-50/30' : '']"
          >
            <!-- 学员基本信息与课包告警 -->
            <div class="flex items-center gap-2.5 min-w-[200px]">
              <span class="w-5 text-center text-st-muted font-mono font-bold">{{ idx + 1 }}</span>
              <span class="font-bold text-st-title text-sm">{{ st.studentName }}</span>
              <el-tag
                v-if="st.isLowBalance"
                size="small"
                type="danger"
                effect="plain"
                class="!text-[10px] !px-1.5 inline-flex items-center gap-0.5"
              >
                <AlertTriangle class="w-3 h-3 text-danger" />
                <span>余 {{ st.remainingLessons }} 课时</span>
              </el-tag>
              <el-tag
                v-else
                size="small"
                type="info"
                effect="plain"
                class="!text-[10px] !px-1.5"
              >
                余 {{ st.remainingLessons }} 课时
              </el-tag>
              <span v-if="st.isWechatBound" class="text-emerald-600 text-[11px] inline-flex items-center" title="已绑定微信公众号">
                <Smartphone class="w-3.5 h-3.5" />
              </span>
              <span v-else class="text-gray-300 text-[11px] inline-flex items-center" title="未绑定微信公众号">
                <Smartphone class="w-3.5 h-3.5 opacity-40" />
              </span>
            </div>

            <!-- 出勤状态切换按钮组 -->
            <el-button-group size="small">
              <el-button
                :type="st.status === 'present' ? 'success' : 'default'"
                @click="changeStudentStatus(st, 'present')"
              >
                到课
              </el-button>
              <el-button
                :type="st.status === 'late' ? 'warning' : 'default'"
                @click="changeStudentStatus(st, 'late')"
              >
                迟到
              </el-button>
              <el-button
                :type="st.status === 'leave' ? 'primary' : 'default'"
                @click="changeStudentStatus(st, 'leave')"
              >
                请假
              </el-button>
              <el-button
                :type="st.status === 'absent' ? 'danger' : 'default'"
                @click="changeStudentStatus(st, 'absent')"
              >
                缺席
              </el-button>
            </el-button-group>

            <!-- 扣减课时显示 -->
            <div class="flex items-center gap-1 min-w-[70px]">
              <span class="text-st-muted text-[11px]">扣除:</span>
              <span class="font-mono font-bold text-st-title" :class="[st.deductLessons > 0 ? 'text-indigo-600' : 'text-st-secondary']">
                {{ st.deductLessons }} 课时
              </span>
            </div>

            <!-- 个性化能力标签与星级折叠展开 -->
            <div v-if="fulfillmentMode === 'FULL_SETTLE'" class="flex items-center gap-2">
              <el-rate
                v-model="st.rating"
                allow-half
                size="small"
                class="!scale-90"
              />
              <el-input
                v-model="st.personalizedComment"
                size="small"
                placeholder="个性化学情随堂特写（可选）"
                class="!w-48"
              />
              <!-- 快捷能力标签 -->
              <el-select
                v-model="st.performanceTag"
                placeholder="特长标签"
                size="small"
                clearable
                class="!w-24"
              >
                <el-option label="动手达人" value="动手达人" />
                <el-option label="思维敏捷" value="思维敏捷" />
                <el-option label="专注自律" value="专注自律" />
                <el-option label="创意卓越" value="创意卓越" />
                <el-option label="逻辑严密" value="逻辑严密" />
              </el-select>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 随堂课评内容区 (仅在 FULL_SETTLE 模式下展开) -->
      <div v-if="fulfillmentMode === 'FULL_SETTLE'" class="space-y-3 pt-2 border-t border-gray-100">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-st-title flex items-center gap-1">
            <span>⭐</span> 随堂综合课评与标准知识点大纲
          </span>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-st-title">综合评级:</span>
            <el-rate v-model="form.overallRating" allow-half size="default" />
          </div>
        </div>

        <el-form label-position="top" size="default" class="space-y-3">
          <!-- 课评标题 -->
          <el-form-item label="随堂主题">
            <el-input v-model="form.lessonTitle" placeholder="随堂大纲标题" class="w-full font-bold" />
          </el-form-item>

          <!-- 教学重难点富文本 -->
          <el-form-item label="随堂核心素养与知识点 (抽取自标准教研大纲)">
            <div class="w-full border border-st-border rounded-lg bg-gray-50/50 p-2.5 max-h-36 overflow-y-auto text-xs leading-relaxed">
              <div v-html="form.studyContentHtml"></div>
            </div>
          </el-form-item>

          <!-- 教师综合评语 -->
          <el-form-item label="教师随堂评语与课堂总评">
            <el-input
              v-model="form.teacherComment"
              type="textarea"
              :rows="2"
              placeholder="请填写课堂综合表现评语..."
            />
          </el-form-item>

          <!-- 多媒体资产直传 (< 100MB 拦截) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50/70 p-3 rounded-lg border border-gray-200">
            <div>
              <label class="text-xs font-semibold text-st-title block mb-1 inline-flex items-center gap-1"><Image class="w-3.5 h-3.5 text-st-primary" />课堂随堂相册 (最多 9 张)</label>
              <div class="flex items-center gap-2">
                <el-button size="small" type="primary" plain @click="handleAddPhoto">
                  添加现场照片
                </el-button>
                <span class="text-[11px] text-st-muted">已选 {{ form.photoList.length }} 张</span>
              </div>
              <div v-if="form.photoList.length > 0" class="flex flex-wrap gap-2 mt-2">
                <div
                  v-for="(p, idx) in form.photoList"
                  :key="idx"
                  class="relative w-12 h-12 rounded border overflow-hidden group"
                >
                  <img :src="p" class="w-full h-full object-cover" />
                  <el-button
                    link
                    type="danger"
                    class="!absolute !inset-0 !m-0 !p-0 !text-white !bg-black/60 !rounded-none opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    @click="handleRemovePhoto(idx)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold text-st-title block mb-1 inline-flex items-center gap-1"><Video class="w-3.5 h-3.5 text-st-primary" />课堂视频亮点 (限制 &le; 100MB)</label>
              <div class="flex items-center gap-2">
                <input
                  ref="videoInputRef"
                  type="file"
                  accept="video/*"
                  class="hidden"
                  @change="handleVideoUpload"
                />
                <el-button size="small" type="primary" plain @click="videoInputRef?.click()">
                  上传随堂视频
                </el-button>
                <span v-if="form.videoUrl" class="text-[11px] text-emerald-600 font-bold truncate max-w-[150px] inline-flex items-center gap-1">
                  <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                  <span>已就绪 ({{ form.videoUrl.slice(-15) }})</span>
                </span>
                <span v-else class="text-[11px] text-st-muted">单视频不得超过 100MB</span>
              </div>
            </div>
          </div>
        </el-form>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between px-1">
        <div class="text-xs text-st-muted flex items-center gap-2">
          <span class="inline-flex items-center gap-1"><Zap class="w-3.5 h-3.5 text-amber-500" />正课优先消耗 (Regular-First)</span>
          <span class="text-gray-300">|</span>
          <span class="inline-flex items-center gap-1"><Lock class="w-3.5 h-3.5 text-blue-500" />SHA-256 不可变数字指纹</span>
          <span class="text-gray-300">|</span>
          <span class="inline-flex items-center gap-1"><Shield class="w-3.5 h-3.5 text-emerald-500" />ACB 财务防腐屏障</span>
        </div>
        <div class="flex items-center gap-2">
          <el-button @click="visible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :class="[
              fulfillmentMode === 'FULL_SETTLE'
                ? '!bg-gradient-to-r !from-amber-500 !to-orange-600 hover:!opacity-90 !border-none text-white font-bold'
                : '!bg-indigo-600 text-white font-bold'
            ]"
            @click="handleSubmitFulfillment"
          >
            {{ fulfillmentMode === 'FULL_SETTLE' ? '一键极速结课并推送家长端' : '立即随堂打卡点名' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import {
  Calendar,
  MapPin,
  User,
  Zap,
  Clock,
  ClipboardList,
  Lightbulb,
  Image,
  Video,
  CheckCircle2,
  Shield,
  Lock,
  AlertTriangle,
  Smartphone
} from 'lucide-vue-next'
import { educationalApi } from '@/api/modules/educational'
import { DIALOG_SIZE } from '@/constants/ui'

const emit = defineEmits<{
  (e: 'success', receipt: any): void
}>()

const visible = ref(false)
const loading = ref(false)
const submitting = ref(false)
const fulfillmentMode = ref<'FULL_SETTLE' | 'ATTENDANCE_ONLY'>('FULL_SETTLE')

const currentLesson = ref<any>(null)
const workbenchSummary = ref<any>(null)
const videoInputRef = ref<HTMLInputElement>()

interface RosterStudentItem {
  studentId: string
  studentNo: string
  studentName: string
  phone: string
  gender?: string
  packageId?: string
  remainingLessons: number
  bonusLessons: number
  totalLessons: number
  isLowBalance: boolean
  wechatOpenId: string | null
  isWechatBound: boolean
  status: 'present' | 'late' | 'leave' | 'absent'
  deductLessons: number
  rating: number
  personalizedComment: string
  performanceTag: string
}

const rosterList = ref<RosterStudentItem[]>([])

const form = reactive({
  lessonTitle: '',
  studyContentHtml: '',
  overallRating: 5.0,
  teacherComment: '',
  voiceUrl: '',
  videoUrl: '',
  photoList: [] as string[],
  templateId: 'tmpl-common',
  templateName: '通用课评模板',
})

const presentCount = computed(() =>
  rosterList.value.filter(s => s.status === 'present' || s.status === 'late').length
)

const totalEstimatedDeduct = computed(() =>
  rosterList.value.reduce((sum, s) => sum + s.deductLessons, 0)
)

async function open(card: any) {
  currentLesson.value = card
  fulfillmentMode.value = 'FULL_SETTLE'
  visible.value = true
  loading.value = true

  try {
    const res = await educationalApi.getFulfillmentWorkbench(card.id)
    if (res && res.data) {
      const data = res.data
      workbenchSummary.value = data.summary

      // 水化草稿
      if (data.evaluationDraft) {
        form.lessonTitle = data.evaluationDraft.lessonTitle || `${card.className} - 随堂教研大纲`
        form.studyContentHtml = data.evaluationDraft.studyContentHtml || ''
        form.overallRating = data.evaluationDraft.overallRating ?? 5.0
        form.teacherComment = data.evaluationDraft.teacherComment || ''
        form.photoList = Array.isArray(data.evaluationDraft.photoList) ? data.evaluationDraft.photoList : []
        form.videoUrl = data.evaluationDraft.videoUrl || ''
        form.voiceUrl = data.evaluationDraft.voiceUrl || ''
        form.templateId = data.evaluationDraft.templateId || 'tmpl-common'
        form.templateName = data.evaluationDraft.templateName || '通用课评模板'
      }

      // 水化花名册（默认到课 present-by-default）
      if (Array.isArray(data.students)) {
        rosterList.value = data.students.map((st: any) => ({
          studentId: st.studentId,
          studentNo: st.studentNo,
          studentName: st.studentName,
          phone: st.phone,
          gender: st.gender,
          packageId: st.packageId,
          remainingLessons: st.remainingLessons,
          bonusLessons: st.bonusLessons,
          totalLessons: st.totalLessons,
          isLowBalance: st.isLowBalance,
          wechatOpenId: st.wechatOpenId,
          isWechatBound: st.isWechatBound,
          status: st.recordedStatus || st.defaultStatus || 'present',
          deductLessons: st.isRecorded ? st.defaultDeductLessons : 1,
          rating: typeof st.currentRating === 'number' ? st.currentRating : (st.defaultRating || 5.0),
          personalizedComment: st.currentComment || '',
          performanceTag: '',
        }))
      }
    }
  } catch (err: any) {
    ElMessage.error(err.message || '水化结课履约工作台数据失败')
  } finally {
    loading.value = false
  }
}

function changeStudentStatus(st: RosterStudentItem, status: 'present' | 'late' | 'leave' | 'absent') {
  st.status = status
  if (status === 'present' || status === 'late') {
    st.deductLessons = 1
  } else {
    st.deductLessons = 0
  }
}

function handleBatchAllPresent() {
  rosterList.value.forEach(s => {
    s.status = 'present'
    s.deductLessons = 1
  })
  ElMessage.info('已将全员设为到课 (扣减 1 课时)')
}

function handleAddPhoto() {
  if (form.photoList.length >= 9) {
    ElMessage.warning('随堂相册最多支持上传 9 张照片')
    return
  }
  const samplePhotos = [
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300',
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=300',
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300',
  ]
  const picked = samplePhotos[form.photoList.length % samplePhotos.length]
  form.photoList.push(picked)
  ElMessage.success('已添加随堂现场照片')
}

function handleRemovePhoto(index: number) {
  form.photoList.splice(index, 1)
}

function handleVideoUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 硬拦截：单视频不得超过 100MB
  const maxBytes = 100 * 1024 * 1024
  if (file.size > maxBytes) {
    ElMessageBox.alert(
      `当前选择的视频大小为 ${(file.size / (1024 * 1024)).toFixed(1)}MB，超过系统规定的 100MB 上限。请压缩后再上传。`,
      '视频超限拦截',
      { type: 'error' }
    )
    target.value = ''
    return
  }

  // 模拟直传成功
  form.videoUrl = `https://storage.yixiao.com/videos/${Date.now()}_${file.name}`
  ElMessage.success(`随堂精彩视频已就绪: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`)
  target.value = ''
}

async function handleSubmitFulfillment() {
  if (!currentLesson.value) return
  if (rosterList.value.length === 0) {
    ElMessage.warning('当前班级暂无可履约结课学员')
    return
  }

  // 计算异常学员差异覆写 (Anomaly Overrides)
  // 仅将非默认状态 (非 present 或 rating!=5 或 有特殊评语/标签) 作为增量传给深模块
  const anomalyOverrides = rosterList.value
    .filter(
      s =>
        s.status !== 'present' ||
        s.deductLessons !== 1 ||
        s.rating !== 5.0 ||
        Boolean(s.personalizedComment) ||
        Boolean(s.performanceTag)
    )
    .map(s => ({
      studentId: s.studentId,
      status: s.status,
      deductLessons: s.deductLessons,
      rating: s.rating,
      personalizedComment: s.personalizedComment || undefined,
      performanceTag: s.performanceTag || undefined,
    }))

  submitting.value = true
  try {
    const res = await educationalApi.fulfillLesson({
      scheduleEventId: currentLesson.value.id,
      mode: fulfillmentMode.value,
      lessonTitle: form.lessonTitle,
      studyContentHtml: form.studyContentHtml,
      overallRating: form.overallRating,
      teacherComment: form.teacherComment,
      photoList: form.photoList,
      videoUrl: form.videoUrl || undefined,
      voiceUrl: form.voiceUrl || undefined,
      templateId: form.templateId,
      templateName: form.templateName,
      anomalyOverrides: anomalyOverrides.length > 0 ? anomalyOverrides : undefined,
      dispatchStrategy: 'ATTENDED_ONLY',
      idempotencyKey: `flm_${currentLesson.value.id}_${Date.now()}`,
    })

    if (res && res.data) {
      const receipt = res.data
      ElMessageBox.alert(
        `<div class="space-y-2 text-xs">
          <p class="font-bold text-sm text-emerald-600">${receipt.message}</p>
          <div class="bg-gray-50 p-2.5 rounded border border-gray-200 font-mono space-y-1">
            <p>流水单号: <strong>${receipt.receiptId}</strong></p>
            <p>实消总学时: <strong>${receipt.settlement?.totalDeductedLessons ?? 0} 课时</strong> (实收正课: ${receipt.settlement?.regularBurned ?? 0}, 赠课: ${receipt.settlement?.bonusBurned ?? 0})</p>
            <p>到课打卡: <strong>${receipt.settlement?.presentCount ?? 0} 人</strong> | 请假/缺席: <strong>${(receipt.settlement?.leaveCount ?? 0) + (receipt.settlement?.absentCount ?? 0)} 人</strong></p>
            ${receipt.outbox ? `<p>微信推送信箱: <strong>已灌装排队 ${receipt.outbox.enqueuedCount} 条通知</strong> (跳过未绑: ${receipt.outbox.skippedCount})</p>` : ''}
            ${receipt.evaluation?.fingerprint ? `<p class="truncate">数字指纹: ${receipt.evaluation.fingerprint.slice(0, 16)}...</p>` : ''}
          </div>
        </div>`,
        '结课履约执行凭单',
        {
          dangerouslyUseHTMLString: true,
          confirmButtonText: '确定',
          type: 'success',
        }
      )
      visible.value = false
      emit('success', receipt)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '一键结课履约失败')
  } finally {
    submitting.value = false
  }
}

defineExpose({
  open,
})
</script>

<style scoped>
.lesson-fulfillment-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
  padding-bottom: 12px;
}
</style>
