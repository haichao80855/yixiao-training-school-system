<template>
  <el-dialog
    v-model="visible"
    title="随堂课评工作台 (学员专属透视与双端同步)"
    :width="DIALOG_SIZE.xl"
    destroy-on-close
    :close-on-click-modal="false"
    class="lesson-evaluation-dialog !rounded-xl"
  >
    <div v-loading="loading" class="space-y-3.5 max-h-[80vh] overflow-y-auto px-1 pr-2">
      <!-- 1. 顶部排课全景与模板选择栏 -->
      <div class="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-3 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-white bg-indigo-600 px-2 py-0.5 rounded shadow-xs">
              {{ currentLesson?.className }}
            </span>
            <span class="text-sm font-extrabold text-st-title">
              {{ form.lessonTitle || currentLesson?.lessonTitle }}
            </span>
          </div>
          <div class="text-xs text-st-secondary flex items-center gap-3">
            <span>📅 {{ currentLesson?.date }} {{ currentLesson?.startTime }} - {{ currentLesson?.endTime }}</span>
            <span>🏫 {{ currentLesson?.classroomName }}</span>
            <span>👨‍🏫 {{ currentLesson?.teacherName }}</span>
          </div>
        </div>

        <!-- 教学大纲模板选择器 -->
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold text-st-title shrink-0">大纲模板:</label>
          <el-select
            v-model="selectedTemplateId"
            placeholder="切换大纲模板"
            size="small"
            class="!w-48"
            @change="handleApplyTemplate"
          >
            <el-option
              v-for="tpl in templateList"
              :key="tpl.id"
              :label="tpl.name"
              :value="tpl.id"
            >
              <span class="float-left text-xs">{{ tpl.name }}</span>
              <span class="float-right text-xs text-st-muted font-normal ml-2">[{{ tpl.category }}]</span>
            </el-option>
          </el-select>
        </div>
      </div>

      <!-- 2. 主体两栏布局：左侧学员名册进度矩阵 (35%)，右侧专属多媒体点评 (65%) -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        <!-- 左侧：班级学员名册与双端课评进度矩阵 (4列) -->
        <div class="md:col-span-5 flex flex-col border border-st-border rounded-xl bg-gray-50/50 p-3 space-y-3">
          <!-- 顶部完成度大盘与筛选 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-st-title flex items-center gap-1.5">
                <span>📋</span>
                <span>学员名册与课评进度</span>
              </span>
              <span class="font-mono font-bold text-indigo-600">
                {{ evaluatedStudentsCount }} / {{ activeStudentsCount }} 人 ({{ progressPercent }}%)
              </span>
            </div>

            <!-- 进度条 -->
            <el-progress
              :percentage="progressPercent"
              :status="progressPercent === 100 ? 'success' : undefined"
              :stroke-width="6"
              :show-text="false"
            />

            <!-- 快捷筛选药丸 -->
            <div class="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                :class="[
                  'px-2.5 py-0.5 text-xs rounded-full font-medium transition-colors border',
                  filterTab === 'all'
                    ? 'bg-white text-indigo-700 border-indigo-300 shadow-xs'
                    : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'
                ]"
                @click="filterTab = 'all'"
              >
                全部 ({{ rosterList.length }})
              </button>
              <button
                type="button"
                :class="[
                  'px-2.5 py-0.5 text-xs rounded-full font-medium transition-colors border',
                  filterTab === 'pending'
                    ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs'
                    : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'
                ]"
                @click="filterTab = 'pending'"
              >
                待评 ({{ pendingStudentsCount }})
              </button>
              <button
                type="button"
                :class="[
                  'px-2.5 py-0.5 text-xs rounded-full font-medium transition-colors border',
                  filterTab === 'evaluated'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                    : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'
                ]"
                @click="filterTab = 'evaluated'"
              >
                已评 ({{ evaluatedStudentsCount }})
              </button>
            </div>
          </div>

          <!-- 学员卡片流 -->
          <div class="space-y-2 max-h-[56vh] overflow-y-auto pr-1">
            <div
              v-for="st in filteredRosterList"
              :key="st.studentId"
              :class="[
                'p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-2',
                activeStudentId === st.studentId
                  ? 'bg-indigo-50/70 border-indigo-400 shadow-xs ring-1 ring-indigo-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              ]"
              @click="handleSelectStudent(st)"
            >
              <!-- 顶部行：姓名、微信标、考勤切换 -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-st-title text-sm">{{ st.studentName }}</span>
                  <span
                    v-if="st.isWechatBound"
                    class="text-[11px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100"
                    title="已绑定微信公众号，可接收推送"
                  >
                    📱 微信已绑
                  </span>
                  <span
                    v-else
                    class="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-100"
                    title="未绑定微信"
                  >
                    未绑微信
                  </span>
                </div>

                <!-- 考勤状态快捷切换 -->
                <el-dropdown trigger="click" @command="(cmd: any) => handleUpdateAttendance(st, cmd)">
                  <span
                    :class="[
                      'text-xs font-semibold px-2 py-0.5 rounded cursor-pointer border flex items-center gap-1',
                      st.attendanceStatus === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      st.attendanceStatus === 'late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      st.attendanceStatus === 'leave' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    ]"
                  >
                    <span>{{ getAttendanceText(st.attendanceStatus) }}</span>
                    <span class="text-[9px]">▼</span>
                  </span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="present">🟢 到课</el-dropdown-item>
                      <el-dropdown-item command="late">🟡 迟到</el-dropdown-item>
                      <el-dropdown-item command="leave">🔵 请假 (自动免评)</el-dropdown-item>
                      <el-dropdown-item command="absent">🔴 缺席 (自动免评)</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>

              <!-- 底部行：课评状态徽章与多媒体统计 -->
              <div class="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                <!-- 课评状态 -->
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="st.isExempt"
                    class="text-gray-400 text-[11px] font-medium flex items-center gap-1"
                  >
                    <span>⚪</span>
                    <span>请假免评</span>
                  </span>
                  <span
                    v-else-if="st.isEvaluated"
                    class="text-emerald-700 font-bold text-[11px] flex items-center gap-1"
                  >
                    <span>🟢 已评定</span>
                    <span v-if="st.evaluatedSource === 'mp'" class="text-[10px] text-indigo-600 bg-indigo-50 px-1 rounded">
                      📱 手机端
                    </span>
                    <span v-else class="text-[10px] text-gray-500 bg-gray-100 px-1 rounded">
                      💻 网页
                    </span>
                  </span>
                  <span
                    v-else
                    class="text-amber-600 font-medium text-[11px] flex items-center gap-1"
                  >
                    <span>🟡 待评价</span>
                  </span>
                </div>

                <!-- 专属多媒体计数 -->
                <div class="flex items-center gap-2 text-xs text-st-muted font-mono">
                  <span v-if="st.videoUrl" class="text-blue-600 font-semibold" title="已有专属实操视频">
                    🎥 1视频
                  </span>
                  <span v-if="st.photos && st.photos.length > 0" class="text-purple-600 font-semibold" title="专属相册照片数">
                    📷 {{ st.photos.length }}张
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：当前选中学员专属多媒体与个性化学情创作区 (7列) -->
        <div class="md:col-span-7 flex flex-col border border-st-border rounded-xl bg-white p-3.5 space-y-4">
          <!-- 选中学员标题头 -->
          <div v-if="activeStudent" class="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="text-base font-extrabold text-st-title">
                【{{ activeStudent.studentName }}】专属课评
              </span>
              <el-tag
                :type="activeStudent.isExempt ? 'info' : (activeStudent.isEvaluated ? 'success' : 'warning')"
                size="small"
                effect="plain"
              >
                {{ activeStudent.isExempt ? '请假免评' : (activeStudent.isEvaluated ? '已评定' : '待评价') }}
              </el-tag>
            </div>

            <div class="text-xs text-st-muted">
              <span>扣减课时: {{ activeStudent.deductLessons }} 课时</span>
            </div>
          </div>

          <!-- 若当前学员请假或缺席：给出友好的免评提示与快捷切回入口 -->
          <div v-if="activeStudent?.isExempt" class="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 space-y-3">
            <div class="text-3xl">☕</div>
            <div class="font-bold text-sm text-st-title">该学员当前出勤为「{{ getAttendanceText(activeStudent.attendanceStatus) }}」</div>
            <div class="text-xs text-st-muted max-w-sm mx-auto">
              未实际到课学员已由系统自动置为「请假免评」并锁定，不会扣减误消课时，也不会向家长推送随堂评价，从根源杜绝客诉风险。
            </div>
            <el-button size="small" type="primary" plain @click="handleUpdateAttendance(activeStudent, 'present')">
              若为误记，点击恢复为「到课」并开放课评
            </el-button>
          </div>

          <!-- 到课学员：专属课评创作表单 -->
          <div v-else-if="activeStudent" class="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
            <!-- 1. 班级学习内容与教学大纲 (可折叠查看，全班基线共享) -->
            <el-collapse v-model="outlineCollapseNames" class="!border-none">
              <el-collapse-item name="outline" class="!border-none">
                <template #title>
                  <div class="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span>📖 课程学习内容与知识点大纲</span>
                    <span class="text-[11px] font-normal text-st-muted">（全班教学主题背景）</span>
                  </div>
                </template>
                <div class="pt-1.5 space-y-1.5">
                  <el-input
                    v-model="form.studyContent"
                    type="textarea"
                    :rows="2"
                    placeholder="请输入本堂课的核心知识点与学习内容..."
                    class="!text-xs leading-relaxed"
                  />
                </div>
              </el-collapse-item>
            </el-collapse>

            <!-- 2. 该学员专属实操视频 (最多 1 个，限制 100MB) -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-st-title flex items-center gap-1.5">
                  <span>🎥</span>
                  <span>{{ activeStudent.studentName }} 的专属实操视频</span>
                  <span class="text-[11px] font-normal text-st-muted">(单视频 ≤ 100MB，独享不公开)</span>
                </span>
                <span v-if="activeStudent.videoUrl" class="text-xs text-emerald-600 font-medium">
                  ✓ 专属视频已就绪
                </span>
              </div>

              <div class="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :loading="uploadingVideo"
                  @click="handleSelectStudentVideo"
                >
                  {{ uploadingVideo ? '正在上传专属视频...' : (activeStudent.videoUrl ? '重新上传视频' : '上传课堂实操视频') }}
                </el-button>

                <template v-if="activeStudent.videoUrl">
                  <el-button link type="primary" size="small" @click="handlePreviewVideo(activeStudent.videoUrl)">
                    ▶ 在线播放预览
                  </el-button>
                  <el-button link type="danger" size="small" @click="handleRemoveStudentVideo">
                    移除视频
                  </el-button>
                </template>
                <div v-else class="text-xs text-st-muted">
                  支持 mp4/mov 格式，上传后该视频将专属呈现于该学员家长的学情报告中。
                </div>
              </div>
            </div>

            <!-- 3. 该学员专属现场照片 (最多 9 张) -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-st-title flex items-center gap-1.5">
                  <span>📷</span>
                  <span>{{ activeStudent.studentName }} 的专属现场照片</span>
                  <span class="text-[11px] font-normal text-st-muted">(最多 9 张，每张 ≤ 10MB)</span>
                </span>
                <span class="text-xs font-mono font-semibold text-purple-700">
                  {{ activeStudent.photos.length }} / 9 张
                </span>
              </div>

              <!-- 照片网格 -->
              <div class="flex flex-wrap gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <!-- 添加照片小方块 -->
                <div
                  v-if="activeStudent.photos.length < 9"
                  class="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-gray-400 hover:text-indigo-600"
                  :class="{ 'opacity-60 pointer-events-none': uploadingPhotos }"
                  @click="handleAddStudentPhotos"
                >
                  <span v-if="!uploadingPhotos" class="text-xl font-light leading-none">+</span>
                  <span v-else class="text-xs animate-spin">⏳</span>
                  <span class="text-[10px] mt-1">{{ uploadingPhotos ? '上传中' : '添加照片' }}</span>
                </div>

                <!-- 缩略图卡片 -->
                <div
                  v-for="(photo, pIdx) in activeStudent.photos"
                  :key="pIdx"
                  class="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-xs group"
                >
                  <img :src="photo" class="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="现场照片" />
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span class="text-white text-xs cursor-pointer hover:underline" @click="handlePreviewPhoto(photo)">查看</span>
                    <span class="text-red-300 text-xs cursor-pointer hover:underline" @click="handleRemoveStudentPhoto(pIdx)">删除</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. 老师个性化点评 (配备 AI 润色与 AI 重写) -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-st-title flex items-center gap-1.5">
                  <span>✍️</span>
                  <span>{{ activeStudent.studentName }} 的随堂特写评语</span>
                </span>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded-full transition-all border border-indigo-200"
                    @click="handleAiRewriteForStudent"
                  >
                    <span>✨</span>
                    <span>AI 帮我重写</span>
                  </button>
                  <span class="text-[11px] text-gray-400 font-mono">已输入 {{ (activeStudent.comment || '').length }} 字</span>
                </div>
              </div>

              <!-- 点评输入框 -->
              <el-input
                v-model="activeStudent.comment"
                type="textarea"
                :rows="3"
                :placeholder="`请输入针对 ${activeStudent.studentName} 的个性化学习反馈、专注力与表扬建议...`"
                class="w-full !text-xs leading-relaxed"
              />

              <!-- 辅助工具栏 -->
              <div class="flex items-center justify-between text-xs pt-0.5">
                <el-button
                  type="warning"
                  plain
                  size="small"
                  class="!px-2.5 !py-0.5 !text-xs font-medium"
                  :loading="polishing"
                  @click="handleAiPolishForStudent"
                >
                  🪄 AI 润色
                </el-button>

                <div class="flex items-center gap-2">
                  <el-button link type="primary" size="small" class="!text-xs" @click="handleCycleCommentTemplateForStudent">
                    🔄 快速载入预设评语
                  </el-button>
                  <span v-if="activeStudent.aiPolished" class="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    ✓ 已 AI 润色
                  </span>
                </div>
              </div>
            </div>

            <!-- 5. 五维素养星级打分与特长标签 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div class="space-y-1">
                <span class="text-xs font-bold text-slate-700">五维核心素养评级:</span>
                <div class="flex items-center gap-2">
                  <el-rate
                    v-model="activeStudent.rating"
                    allow-half
                    size="default"
                    :colors="['#F7BA2A', '#F7BA2A', '#FF9900']"
                  />
                  <span class="text-xs font-bold text-amber-600">{{ activeStudent.rating }} 星</span>
                </div>
              </div>

              <div class="space-y-1">
                <span class="text-xs font-bold text-slate-700">当堂特长表现标签:</span>
                <el-select
                  v-model="activeStudent.performanceTag"
                  placeholder="选择特长能力标签"
                  size="small"
                  clearable
                  class="w-full"
                >
                  <el-option label="动手达人" value="动手达人" />
                  <el-option label="逻辑缜密" value="逻辑缜密" />
                  <el-option label="专注投入" value="专注投入" />
                  <el-option label="创意丰富" value="创意丰富" />
                  <el-option label="积极互动" value="积极互动" />
                  <el-option label="抗挫力强" value="抗挫力强" />
                </el-select>
              </div>
            </div>

            <!-- 6. 底部流线穿梭操作条 -->
            <div class="flex items-center justify-between pt-2 border-t border-gray-100">
              <el-button size="small" @click="handleSaveCurrentStudentDraft">
                暂存当前学员
              </el-button>

              <el-button type="primary" size="small" class="!px-3.5" @click="handleSaveAndNextStudent">
                暂存并评下一位 →
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗底部操作按钮 -->
    <template #footer>
      <div class="flex items-center justify-between pt-2 border-t border-st-border">
        <div class="text-xs text-st-muted flex items-center gap-3">
          <span>共 {{ rosterList.length }} 人</span>
          <span class="text-emerald-600 font-semibold">已评定: {{ evaluatedStudentsCount }} 人</span>
          <span class="text-amber-600 font-semibold">待评价: {{ pendingStudentsCount }} 人</span>
          <span v-if="exemptStudentsCount > 0" class="text-gray-400">请假免评: {{ exemptStudentsCount }} 人</span>
        </div>

        <div class="flex items-center gap-2.5">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="info" plain :loading="saving" @click="handleSaveAll(false)">
            暂存全班草稿
          </el-button>
          <el-button type="primary" :loading="saving" @click="handleSaveAll(true)">
            正式发布并推送家长微信
          </el-button>
        </div>
      </div>
    </template>

    <!-- 视频在线播放弹窗 -->
    <el-dialog
      v-model="videoPreviewVisible"
      title="课堂实操视频预览"
      :width="DIALOG_SIZE.md"
      append-to-body
      destroy-on-close
    >
      <div class="flex justify-center p-2 bg-black rounded-lg">
        <video
          v-if="currentPreviewVideoUrl"
          :src="currentPreviewVideoUrl"
          controls
          autoplay
          class="max-h-[60vh] max-w-full rounded"
        ></video>
      </div>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'
import { educationalApi, uploadApi } from '@/api'
import { getEvaluationTemplates } from '@/constants/evaluation'
import { DIALOG_SIZE } from '@/constants/ui'
import type { WorkbenchLessonCard, EvaluationTemplate } from '@/types/educational'

const emit = defineEmits<{
  (e: 'success', receipt: any): void
}>()

const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const uploadingVideo = ref(false)
const uploadingPhotos = ref(false)
const polishing = ref(false)

const currentLesson = ref<WorkbenchLessonCard | null>(null)
const templateList = ref<EvaluationTemplate[]>([])
const selectedTemplateId = ref('tmpl-common')
const outlineCollapseNames = ref<string[]>(['outline'])

// 视频预览
const videoPreviewVisible = ref(false)
const currentPreviewVideoUrl = ref('')

// 筛选 Tab: 'all' | 'pending' | 'evaluated'
const filterTab = ref<'all' | 'pending' | 'evaluated'>('all')

// 全班大纲公共字段
const form = reactive({
  lessonTimeId: '',
  classId: '',
  className: '',
  lessonTitle: '',
  templateId: 'tmpl-common',
  templateName: '通用课评模板',
  studyContent: '',
  rating: 5,
  teacherComment: '',
  aiPolished: false,
})

// 单学员草稿模型契约
export interface StudentRosterDraft {
  studentId: string
  studentName: string
  studentNo: string
  avatar?: string
  wechatOpenId?: string | null
  isWechatBound: boolean
  attendanceStatus: 'present' | 'late' | 'leave' | 'absent' | 'unrecorded'
  deductLessons: number
  isEvaluated: boolean
  isExempt: boolean
  evaluatedAt?: string
  evaluatedSource?: string
  rating: number
  comment: string
  performanceTag: string
  photos: string[]
  videoUrl: string
  aiPolished?: boolean
}

const rosterList = ref<StudentRosterDraft[]>([])
const activeStudentId = ref<string>('')

const activeStudent = computed<StudentRosterDraft | undefined>(() => {
  return rosterList.value.find((s) => s.studentId === activeStudentId.value)
})

// 过滤后的学员名册
const filteredRosterList = computed(() => {
  if (filterTab.value === 'pending') {
    return rosterList.value.filter((s) => !s.isExempt && !s.isEvaluated)
  }
  if (filterTab.value === 'evaluated') {
    return rosterList.value.filter((s) => !s.isExempt && s.isEvaluated)
  }
  return rosterList.value
})

// 统计指标
const exemptStudentsCount = computed(() => rosterList.value.filter((s) => s.isExempt).length)
const activeStudentsCount = computed(() => rosterList.value.filter((s) => !s.isExempt).length)
const evaluatedStudentsCount = computed(() => rosterList.value.filter((s) => !s.isExempt && s.isEvaluated).length)
const pendingStudentsCount = computed(() => rosterList.value.filter((s) => !s.isExempt && !s.isEvaluated).length)

const progressPercent = computed(() => {
  const active = activeStudentsCount.value
  if (active === 0) return 100
  return Math.min(100, Math.round((evaluatedStudentsCount.value / active) * 100))
})

function getAttendanceText(status: string): string {
  switch (status) {
    case 'present': return '🟢 到课'
    case 'late': return '🟡 迟到'
    case 'leave': return '🔵 请假'
    case 'absent': return '🔴 缺席'
    default: return '⚪ 待打卡'
  }
}

// 选中某学员
function handleSelectStudent(student: StudentRosterDraft) {
  activeStudentId.value = student.studentId
}

// 切换考勤
function handleUpdateAttendance(student: StudentRosterDraft, status: 'present' | 'late' | 'leave' | 'absent') {
  student.attendanceStatus = status
  if (status === 'leave' || status === 'absent') {
    student.isExempt = true
    student.deductLessons = 0
    ElMessage.info(`已将 ${student.studentName} 考勤标记为「${getAttendanceText(status)}」，系统自动设为免评`)
  } else {
    student.isExempt = false
    student.deductLessons = 1
    ElMessage.success(`已将 ${student.studentName} 考勤标记为「${getAttendanceText(status)}」，已开放课评录入`)
  }
}

// 切换模板
function handleApplyTemplate(templateId: string) {
  const tpl = templateList.value.find((t) => t.id === templateId)
  if (!tpl) return
  form.templateId = tpl.id
  form.templateName = tpl.name
  form.studyContent = tpl.defaultStudyContent
  form.teacherComment = tpl.defaultTeacherComment

  // 若当前学员没有个性化评语，自动灌装
  if (activeStudent.value && !activeStudent.value.comment) {
    activeStudent.value.comment = tpl.defaultTeacherComment
  }
  ElMessage.success(`已载入「${tpl.name}」标准学习内容与评语框架！`)
}

// 专属视频上传 (限制 ≤ 100MB)
function handleSelectStudentVideo() {
  if (!activeStudent.value) return
  const currentTarget = activeStudent.value

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/mp4,video/quicktime,video/webm'
  input.onchange = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const maxBytes = 100 * 1024 * 1024
    if (file.size > maxBytes) {
      ElMessageBox.alert(
        `您选择的视频文件大小为 ${(file.size / 1024 / 1024).toFixed(1)}MB，超过系统 100MB 上限！请截取课堂核心亮点片段重新上传。`,
        '视频文件超出限制',
        { type: 'warning' }
      )
      return
    }

    uploadingVideo.value = true
    try {
      const campusId = currentLesson.value?.campusId || localStorage.getItem('yixiao_current_campus_id') || 'campus-bj-hq'
      const scheduleEventId = currentLesson.value?.id || form.lessonTimeId || undefined

      const res = await uploadApi.uploadClassroomVideo({
        file,
        campusId,
        scheduleEventId,
      })

      if (res && res.data?.videoUrl) {
        currentTarget.videoUrl = res.data.videoUrl
        currentTarget.isEvaluated = true
        ElMessage.success(`已为【${currentTarget.studentName}】成功上传专属课堂实操视频！`)
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '上传专属实操视频失败，请稍后重试')
    } finally {
      uploadingVideo.value = false
    }
  }
  input.click()
}

function handlePreviewVideo(url?: string) {
  if (!url) return
  currentPreviewVideoUrl.value = url
  videoPreviewVisible.value = true
}

function handleRemoveStudentVideo() {
  if (!activeStudent.value) return
  activeStudent.value.videoUrl = ''
  ElMessage.info(`已移除【${activeStudent.value.studentName}】的专属视频`)
}

// 专属照片上传 (最多 9 张)
function handleAddStudentPhotos() {
  if (!activeStudent.value) return
  const currentTarget = activeStudent.value
  const currentCount = currentTarget.photos.length
  if (currentCount >= 9) {
    ElMessage.warning('专属课堂照片最多允许上传 9 张')
    return
  }

  const maxAllowed = 9 - currentCount
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp,image/gif'
  input.multiple = true

  input.onchange = async (e: any) => {
    const rawFiles: File[] = Array.from(e.target?.files || [])
    if (rawFiles.length === 0) return

    let selectedFiles = rawFiles
    if (selectedFiles.length > maxAllowed) {
      ElMessage.warning(`最多还可添加 ${maxAllowed} 张照片，已自动选取前 ${maxAllowed} 张`)
      selectedFiles = selectedFiles.slice(0, maxAllowed)
    }

    const MAX_BYTES = 10 * 1024 * 1024
    const validFiles: File[] = []
    const oversizedFiles: string[] = []

    for (const file of selectedFiles) {
      if (file.size > MAX_BYTES) {
        oversizedFiles.push(file.name)
      } else {
        validFiles.push(file)
      }
    }

    if (oversizedFiles.length > 0) {
      ElMessageBox.alert(
        `以下文件体积超过 10MB 系统上限，已自动跳过：\n${oversizedFiles.join('\n')}`,
        '照片体积超出限制',
        { type: 'warning' }
      )
    }

    if (validFiles.length === 0) return

    uploadingPhotos.value = true
    try {
      const campusId = currentLesson.value?.campusId || localStorage.getItem('yixiao_current_campus_id') || 'campus-bj-hq'
      const scheduleEventId = currentLesson.value?.id || form.lessonTimeId || undefined

      const res = await uploadApi.uploadClassroomPhotos({
        files: validFiles,
        campusId,
        scheduleEventId,
      })

      if (res && res.data) {
        const { persistedUrls, successCount } = res.data
        if (persistedUrls && persistedUrls.length > 0) {
          currentTarget.photos.push(...persistedUrls)
          currentTarget.isEvaluated = true
        }
        ElMessage.success(`已为【${currentTarget.studentName}】添加 ${successCount} 张专属照片！`)
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '上传专属照片失败，请稍后重试')
    } finally {
      uploadingPhotos.value = false
    }
  }

  input.click()
}

function handleRemoveStudentPhoto(index: number) {
  if (!activeStudent.value) return
  activeStudent.value.photos.splice(index, 1)
  ElMessage.info('已移除照片')
}

function handlePreviewPhoto(url: string) {
  window.open(url, '_blank')
}

// AI 重写
function handleAiRewriteForStudent() {
  if (!activeStudent.value) return
  const target = activeStudent.value

  const loadingMsg = ElMessage({
    message: `✨ AI 正在为【${target.studentName}】生成高情商个性化随堂评语...`,
    duration: 0,
    type: 'info'
  })

  setTimeout(() => {
    loadingMsg.close()
    target.comment = `【${target.studentName}随堂学情反馈】在本节课中，${target.studentName}展现出极高的课堂专注力与探索求知欲。面对新授核心知识点时吸收迅速，逻辑结构清晰。在实操练习环节，不仅能独立解决问题，还具备成熟的排查能力，表现非常出色！建议继续保持探索热情，期待下节课更亮眼的发挥！`
    target.aiPolished = true
    target.isEvaluated = true
    ElMessage.success(`AI 已为【${target.studentName}】生成专属评语！`)
  }, 700)
}

// AI 润色
function handleAiPolishForStudent() {
  if (!activeStudent.value) return
  const target = activeStudent.value
  if (!target.comment) {
    ElMessage.warning('请先输入评语草稿再进行 AI 润色')
    return
  }

  polishing.value = true
  setTimeout(() => {
    polishing.value = false
    target.comment = `【专属学情特写】${target.comment.trim()} 🌟 在课堂探究中，孩子的思维发散性与动手闭环能力均有亮眼突破，展现出坚韧的专注品质！`
    target.aiPolished = true
    target.isEvaluated = true
    ElMessage.success(`已完成【${target.studentName}】评语的 AI 深度润色！`)
  }, 500)
}

// 循环常用评语
let commentIdx = 0
function handleCycleCommentTemplateForStudent() {
  if (!activeStudent.value) return
  const target = activeStudent.value
  const sampleComments = [
    `${target.studentName}今天在课堂上思维非常活跃，在核心难点环节能举一反三，表现可圈可点！`,
    `${target.studentName}动手实操能力过硬，对细节把控到位，遇到问题能耐心排查，进步十分显著！`,
    `课堂注意力集中，听讲认真踏实，顺利完成了本节课的全部进阶任务，值得大大的表扬！`
  ]
  commentIdx = (commentIdx + 1) % sampleComments.length
  target.comment = sampleComments[commentIdx]
  target.isEvaluated = true
  ElMessage.info('已载入常用预设评语')
}

// 暂存当前学员草稿
function handleSaveCurrentStudentDraft() {
  if (!activeStudent.value) return
  activeStudent.value.isEvaluated = true
  ElMessage.success(`【${activeStudent.value.studentName}】的课评草稿已暂存！`)
}

// 暂存并评下一位
function handleSaveAndNextStudent() {
  if (!activeStudent.value) return
  activeStudent.value.isEvaluated = true

  // 寻找下一个待评价且未免评的学员
  const nextPending = rosterList.value.find((s) => !s.isExempt && !s.isEvaluated && s.studentId !== activeStudent.value?.studentId)
  if (nextPending) {
    activeStudentId.value = nextPending.studentId
    ElMessage.success(`已暂存！已自动切换至待评学员【${nextPending.studentName}】`)
    return
  }

  // 若无待评价学员，切换到下一个学员
  const currentIndex = rosterList.value.findIndex((s) => s.studentId === activeStudent.value?.studentId)
  if (currentIndex >= 0 && currentIndex < rosterList.value.length - 1) {
    activeStudentId.value = rosterList.value[currentIndex + 1].studentId
    ElMessage.success(`已暂存！已切换至下一位学员【${rosterList.value[currentIndex + 1].studentName}】`)
  } else {
    ElMessage.success('🎉 恭喜！当前班级所有在读到课学员课评已全部录入完毕！')
  }
}

// 打开弹窗并载入数据 (权威水化)
async function open(lesson: WorkbenchLessonCard) {
  currentLesson.value = lesson
  templateList.value = getEvaluationTemplates()
  filterTab.value = 'all'
  loading.value = true

  try {
    const res = await educationalApi.getEvaluationWorkbench(lesson.id)
    if (res?.data) {
      const { schedule, evaluation, roster } = res.data

      form.lessonTimeId = schedule.id
      form.classId = schedule.classId
      form.className = schedule.className
      form.lessonTitle = evaluation.lessonTitle || `${schedule.className}-${schedule.courseName}`
      form.templateId = evaluation.templateId || 'tmpl-common'
      form.templateName = evaluation.templateName || '通用课评模板'
      form.studyContent = evaluation.studyContentHtml || ''
      form.rating = evaluation.overallRating || 5
      form.teacherComment = evaluation.teacherComment || ''
      selectedTemplateId.value = form.templateId

      // 将 roster 转换为单学员独立维护的 Draft 列表
      const rawRoster: any[] = Array.isArray(roster) ? roster : []
      rosterList.value = rawRoster.map((item) => {
        const isExempt = item.attendanceStatus === 'leave' || item.attendanceStatus === 'absent' || item.isExempt
        const studentPhotos = Array.isArray(item.photos) ? item.photos : []
        const studentVideo = item.videoUrl || ''
        const hasEvaluated = Boolean(item.isEvaluated || item.personalizedComment || studentPhotos.length > 0 || studentVideo)

        return {
          studentId: item.studentId,
          studentName: item.studentName,
          studentNo: item.studentNo || '',
          avatar: item.avatar || undefined,
          wechatOpenId: item.wechatOpenId,
          isWechatBound: Boolean(item.isWechatBound),
          attendanceStatus: item.attendanceStatus || 'present',
          deductLessons: isExempt ? 0 : (item.deductLessons ?? 1),
          isEvaluated: hasEvaluated,
          isExempt,
          evaluatedAt: item.evaluatedAt,
          evaluatedSource: item.evaluatedSource || 'web',
          rating: item.studentRating ?? 5.0,
          comment: item.personalizedComment || (hasEvaluated ? '' : evaluation.teacherComment) || '',
          performanceTag: item.performanceTag || '专注投入',
          photos: [...studentPhotos],
          videoUrl: studentVideo,
          aiPolished: false,
        }
      })

      // 默认选中第一个待评价学员，若全已评则选中第一个学员
      const firstPending = rosterList.value.find((s) => !s.isExempt && !s.isEvaluated)
      if (firstPending) {
        activeStudentId.value = firstPending.studentId
      } else if (rosterList.value.length > 0) {
        activeStudentId.value = rosterList.value[0].studentId
      }
    }
  } catch (err: any) {
    ElMessage.error(err.message || '加载课评工作台失败')
  } finally {
    loading.value = false
  }

  visible.value = true
}

// 统一保存或正式发布
async function handleSaveAll(publish: boolean) {
  if (!form.studyContent || !form.studyContent.trim()) {
    ElMessage.warning('请输入课程学习内容大纲')
    return
  }

  // 组装所有学员的专属数据 (studentOverrides)
  const studentOverrides = rosterList.value.map((s) => ({
    studentId: s.studentId,
    attendanceStatus: s.attendanceStatus,
    deductLessons: s.deductLessons,
    personalizedComment: s.comment,
    rating: s.rating,
    performanceTag: s.performanceTag,
    photos: s.photos,
    videoUrl: s.videoUrl,
    isEvaluated: s.isEvaluated || Boolean(s.comment || s.photos.length > 0 || s.videoUrl),
  }))

  saving.value = true
  try {
    const res = await educationalApi.commitEvaluation({
      scheduleEventId: form.lessonTimeId,
      publish,
      dispatchStrategy: 'ATTENDED_ONLY',
      payload: {
        templateId: form.templateId,
        templateName: form.templateName,
        lessonTitle: form.lessonTitle,
        studyContentHtml: form.studyContent,
        overallRating: form.rating,
        videoUrl: activeStudent.value?.videoUrl || '',
        photoList: activeStudent.value?.photos || [],
        teacherComment: activeStudent.value?.comment || form.teacherComment || '随堂学习进展顺利',
        aiPolished: form.aiPolished,
        studentOverrides,
      },
    })

    const receipt = res.data

    if (publish) {
      const sentCount = receipt?.dispatchResult?.outboxEnqueuedCount || 0
      const skippedCount = receipt?.dispatchResult?.wechatSkippedCount || 0
      ElNotification({
        title: '课评发布成功',
        message: `学员专属课评已落盘并同步至双端！已向 ${sentCount} 位绑定微信家长下发独立学情报告${skippedCount > 0 ? ` (另有 ${skippedCount} 位家长未绑定微信)` : ''}。`,
        type: 'success',
        duration: 5000,
      })
    } else {
      ElMessage.success('全班学员专属课评草稿已持久化落盘至数据库！')
    }

    emit('success', receipt)
    visible.value = false
  } catch (err: any) {
    ElMessage.error(err.message || '提交课评失败')
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.lesson-evaluation-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid #eef2f6;
  margin-right: 0;
  padding-bottom: 12px;
}
.lesson-evaluation-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
  padding-bottom: 12px;
}
</style>
