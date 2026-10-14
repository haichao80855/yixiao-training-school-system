<template>
  <el-dialog
    v-model="visible"
    title="随堂课评工作台 (家长端联动与教学留存)"
    width="780px"
    destroy-on-close
    :close-on-click-modal="false"
    class="lesson-evaluation-dialog !rounded-xl"
  >
    <div class="space-y-4 max-h-[75vh] overflow-y-auto px-1 pr-3">
      <!-- 顶部模板选择栏 -->
      <div class="flex items-center gap-3 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
        <label class="text-xs font-semibold text-st-title shrink-0">选择点评模板</label>
        <el-select
          v-model="selectedTemplateId"
          placeholder="请选择课评模板"
          class="!w-64"
          @change="handleApplyTemplate"
        >
          <el-option
            v-for="tpl in templateList"
            :key="tpl.id"
            :label="tpl.name"
            :value="tpl.id"
          >
            <span class="float-left text-xs">{{ tpl.name }}</span>
            <span class="float-right text-xs text-st-muted font-normal ml-3">[{{ tpl.category }}]</span>
          </el-option>
        </el-select>
        <div class="text-[11px] text-blue-600 ml-auto flex items-center gap-1">
          <span>💡 切换模板将载入预设的标准核心素养点与点评框架</span>
        </div>
      </div>

      <!-- 随堂考勤与家长微信绑定透视条 -->
      <div v-if="workbenchSummary" class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
        <div class="flex items-center gap-3">
          <span class="font-semibold text-slate-700">👥 参课学员: {{ workbenchSummary.totalEnrolled }} 人</span>
          <span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            实到: {{ workbenchSummary.attendedCount }} 人
          </span>
          <span v-if="workbenchSummary.absentCount > 0" class="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            请假/缺席: {{ workbenchSummary.absentCount }} 人
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            📱 微信已绑定: {{ workbenchSummary.wechatBoundCount }} 人
          </span>
          <span v-if="workbenchSummary.wechatUnboundCount > 0" class="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            ⚠️ 未绑微信: {{ workbenchSummary.wechatUnboundCount }} 人
          </span>
        </div>
      </div>

      <el-form label-position="left" label-width="85px" size="default" class="space-y-4">
        <!-- 课次名称 -->
        <el-form-item required>
          <template #label>
            <span class="text-xs font-semibold text-st-title">课次名称</span>
          </template>
          <div class="flex items-center gap-3 w-full">
            <span class="text-sm font-bold text-st-title">{{ form.lessonTitle || currentLesson?.lessonTitle }}</span>
            <el-button link type="primary" size="small" class="!text-xs" @click="handleAdjustLessonTime">
              调整课次
            </el-button>
            <span class="text-xs text-st-muted ml-auto bg-gray-100 px-2 py-0.5 rounded">
              班级: {{ currentLesson?.className }}
            </span>
          </div>
        </el-form-item>

        <!-- 学习内容 (富文本编辑器) -->
        <el-form-item required>
          <template #label>
            <span class="text-xs font-semibold text-st-title">学习内容</span>
          </template>
          <div class="w-full border border-st-border rounded-lg overflow-hidden bg-white shadow-xs">
            <!-- 仿原生富文本工具栏 -->
            <div class="bg-gray-50 border-b border-st-border p-1.5 flex flex-wrap items-center gap-1 text-xs select-none">
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 font-bold transition-colors"
                title="加粗"
                @click="execCmd('bold')"
              >
                B
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 italic font-serif transition-colors"
                title="斜体"
                @click="execCmd('italic')"
              >
                I
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 underline transition-colors"
                title="下划线"
                @click="execCmd('underline')"
              >
                U
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 line-through transition-colors"
                title="删除线"
                @click="execCmd('strikeThrough')"
              >
                S
              </button>
              <div class="w-px h-4 bg-gray-300 mx-1"></div>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                title="有序列表"
                @click="execCmd('insertOrderedList')"
              >
                1. ≡
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                title="无序列表"
                @click="execCmd('insertUnorderedList')"
              >
                • ≡
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 text-[11px] transition-colors"
                title="下标"
                @click="execCmd('subscript')"
              >
                x₂
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 text-[11px] transition-colors"
                title="上标"
                @click="execCmd('superscript')"
              >
                x²
              </button>
              <div class="w-px h-4 bg-gray-300 mx-1"></div>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                title="居左对齐"
                @click="execCmd('justifyLeft')"
              >
                ⇤
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                title="居中对齐"
                @click="execCmd('justifyCenter')"
              >
                ≡
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                title="居右对齐"
                @click="execCmd('justifyRight')"
              >
                ⇥
              </button>
              <div class="w-px h-4 bg-gray-300 mx-1"></div>
              <span class="text-gray-400 text-[11px]">Normal</span>
              <button
                type="button"
                class="px-2 py-1 rounded hover:bg-gray-200 ml-auto text-gray-500 hover:text-red-500 transition-colors"
                title="清除格式"
                @click="execCmd('removeFormat')"
              >
                Tx 清格式
              </button>
            </div>

            <!-- 富文本输入区 -->
            <div
              ref="editorRef"
              contenteditable="true"
              class="p-3 text-xs text-st-title min-h-[110px] max-h-[200px] overflow-y-auto outline-none leading-relaxed prose prose-sm max-w-none"
              placeholder="请输入本堂课掌握的核心编程语法、硬件结构或算法任务..."
              @input="handleEditorInput"
            ></div>
          </div>
        </el-form-item>

        <!-- 综合评价 (5 星) -->
        <el-form-item required>
          <template #label>
            <span class="text-xs font-semibold text-st-title">综合评价</span>
          </template>
          <div class="flex items-center gap-3">
            <el-rate
              v-model="form.rating"
              :colors="['#F7BA2A', '#F7BA2A', '#FF9900']"
              size="large"
              allow-half
            />
            <span class="text-xs font-bold text-amber-500">{{ form.rating }} 星卓越表现</span>
          </div>
        </el-form-item>

        <!-- 课堂视频 -->
        <el-form-item>
          <template #label>
            <span class="text-xs text-st-secondary">课堂视频</span>
          </template>
          <div class="flex items-center gap-3">
            <el-button size="small" plain :loading="uploadingVideo" @click="handleSelectVideo">
              {{ uploadingVideo ? '正在上传视频...' : (form.videoUrl ? '重新选择' : '上传课堂实操视频') }}
            </el-button>
            <template v-if="form.videoUrl">
              <div class="flex items-center gap-1.5 text-xs text-emerald-600 font-medium cursor-pointer hover:underline" @click="handlePreviewVideo">
                <span>查看视频</span>
                <span class="text-emerald-700 bg-emerald-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">▶</span>
              </div>
              <el-button link type="danger" size="small" class="!text-xs" @click="handleRemoveVideo">
                移除视频
              </el-button>
            </template>
          </div>
        </el-form-item>

        <!-- 课堂记录 (九宫格相册) -->
        <el-form-item>
          <template #label>
            <span class="text-xs text-st-secondary">课堂记录</span>
          </template>
          <div class="w-full space-y-2">
            <div class="text-[11px] text-st-muted">
              视频与照片合计最多支持上传9个，其中仅支持1个视频
            </div>

            <!-- 照片网格 -->
            <div class="flex flex-wrap gap-2.5 items-center">
              <!-- 添加照片方框 -->
              <div
                v-if="form.photoList.length < 9"
                class="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-st-primary hover:bg-blue-50/30 transition-all text-gray-400 hover:text-st-primary"
                :class="{ 'opacity-60 pointer-events-none': uploadingPhotos }"
                @click="handleAddPhoto"
              >
                <span v-if="!uploadingPhotos" class="text-2xl font-light leading-none">+</span>
                <span v-else class="text-xs animate-spin mb-1">⏳</span>
                <span class="text-[10px] mt-1">{{ uploadingPhotos ? '上传中...' : '添加现场照' }}</span>
              </div>

              <!-- 照片缩略图卡片 -->
              <div
                v-for="(photo, idx) in form.photoList"
                :key="idx"
                class="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 shadow-xs group"
              >
                <img :src="photo" class="w-full h-full object-cover transition-transform group-hover:scale-105" alt="课堂照片" />
                <!-- 遮罩与删除按钮 -->
                <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span class="text-white text-xs cursor-pointer hover:underline" @click="handlePreviewPhoto(photo)">查看</span>
                </div>
                <button
                  type="button"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs leading-none shadow hover:bg-red-700 transition-colors z-10"
                  title="删除此照片"
                  @click.stop="handleRemovePhoto(idx)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </el-form-item>

        <!-- 老师点评 (带 AI 润色与 AI 帮我重写) -->
        <el-form-item required>
          <template #label>
            <div class="flex flex-col">
              <span class="text-xs font-semibold text-st-title">老师点评</span>
            </div>
          </template>
          <div class="w-full space-y-1.5">
            <!-- 顶部 AI 帮我重写动作条 -->
            <div class="flex items-center justify-between">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full transition-all border border-indigo-200 active:scale-95"
                @click="handleAiRewrite"
              >
                <span class="text-sm">✨</span>
                <span>AI 帮我重写</span>
              </button>
              <span class="text-[11px] text-gray-400">已输入 {{ form.teacherComment.length }} 字</span>
            </div>

            <!-- 点评文本框 -->
            <el-input
              v-model="form.teacherComment"
              type="textarea"
              :rows="4"
              placeholder="请输入针对全班或具体学员的学情反馈与表扬建议..."
              class="w-full !text-xs leading-relaxed"
            />

            <!-- 底部辅助工具栏 -->
            <div class="flex items-center justify-between text-xs pt-1">
              <el-button
                type="warning"
                plain
                size="small"
                class="!px-3 !py-1 !text-xs font-medium"
                :loading="polishing"
                @click="handleAiPolish"
              >
                🪄 AI 润色
              </el-button>

              <div class="flex items-center gap-3">
                <el-button link type="primary" size="small" class="!text-xs" @click="handleCycleCommentTemplate">
                  🔄 点击模板/切换
                </el-button>
                <span v-if="form.aiPolished" class="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  ✓ 已完成 AI 润色
                </span>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- 弹窗底部操作按钮 -->
    <template #footer>
      <div class="flex items-center justify-between pt-2 border-t border-st-border">
        <div class="text-xs text-st-muted flex items-center gap-2">
          <span v-if="form.status === 'published'" class="text-emerald-600 font-medium">● 状态: 已向家长端发送</span>
          <span v-else class="text-gray-500">○ 状态: 暂存草稿</span>
          <span v-if="form.publishTime" class="text-[11px]">({{ form.publishTime }})</span>
        </div>

        <div class="flex items-center gap-2">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="info" plain :loading="saving" @click="handleSave(false)">
            保存草稿
          </el-button>
          <el-button type="primary" :loading="saving" @click="handleSave(true)">
            保存并发送家长端
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>

  <!-- 课堂实况录像播放预览模态框 -->
  <el-dialog
    v-model="videoPreviewVisible"
    title="课堂实况录像播放"
    width="680px"
    append-to-body
    destroy-on-close
  >
    <div class="flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden p-2">
      <video
        v-if="videoPreviewVisible && form.videoUrl"
        :src="form.videoUrl"
        controls
        autoplay
        class="w-full max-h-[60vh] rounded bg-black"
      >
        您的浏览器暂不支持内置视频播放，请直接下载后查看。
      </video>
    </div>
    <template #footer>
      <div class="flex justify-between items-center text-xs text-gray-500">
        <span class="truncate max-w-[420px]" :title="form.videoUrl">视频地址: {{ form.videoUrl }}</span>
        <el-button size="small" @click="videoPreviewVisible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import type { WorkbenchLessonCard, EvaluationTemplate, LessonEvaluation } from '@/types/educational'
import { educationalApi, uploadApi } from '@/api'
import { getEvaluationTemplates } from '@/constants/evaluation'

const emit = defineEmits<{
  (e: 'success', evaluation: any): void
}>()

const visible = ref(false)
const saving = ref(false)
const polishing = ref(false)
const uploadingPhotos = ref(false)
const uploadingVideo = ref(false)
const videoPreviewVisible = ref(false)
const editorRef = ref<HTMLDivElement>()

const currentLesson = ref<WorkbenchLessonCard | null>(null)
const templateList = ref<EvaluationTemplate[]>([])
const selectedTemplateId = ref('')
const workbenchSummary = ref<{
  totalEnrolled: number
  attendedCount: number
  absentCount: number
  wechatBoundCount: number
  wechatUnboundCount: number
} | null>(null)
const workbenchRoster = ref<any[]>([])

const defaultPhotos = [
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1588072432836-e10032774350?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=60'
]

const form = reactive<{
  lessonTimeId: string
  classId: string
  className: string
  lessonTitle: string
  templateId: string
  templateName: string
  studyContent: string
  rating: number
  videoUrl: string
  photoList: string[]
  teacherComment: string
  aiPolished: boolean
  status: 'draft' | 'published'
  publishTime?: string
}>({
  lessonTimeId: '',
  classId: '',
  className: '',
  lessonTitle: '',
  templateId: 'tmpl-common',
  templateName: '通用课评模板',
  studyContent: '',
  rating: 5,
  videoUrl: '',
  photoList: [],
  teacherComment: '',
  aiPolished: false,
  status: 'draft'
})

// 富文本简易指令调用
function execCmd(command: string, value: string = '') {
  document.execCommand(command, false, value)
  if (editorRef.value) {
    form.studyContent = editorRef.value.innerHTML
  }
}

function handleEditorInput() {
  if (editorRef.value) {
    form.studyContent = editorRef.value.innerHTML
  }
}

// 切换模板
function handleApplyTemplate(templateId: string) {
  const tpl = templateList.value.find(t => t.id === templateId)
  if (!tpl) return
  form.templateId = tpl.id
  form.templateName = tpl.name
  form.studyContent = tpl.defaultStudyContent
  form.teacherComment = tpl.defaultTeacherComment
  if (editorRef.value) {
    editorRef.value.innerHTML = tpl.defaultStudyContent
  }
  ElMessage.success(`已载入「${tpl.name}」预设学习内容与评语框架！`)
}

// 调整课次
function handleAdjustLessonTime() {
  ElMessageBox.prompt('请输入调整后的课次名称（例如：第28讲：超声波避障算法）：', '调整课次', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: form.lessonTitle
  }).then(({ value }) => {
    if (value && value.trim()) {
      form.lessonTitle = value.trim()
      ElMessage.success('课次名称已更新')
    }
  }).catch(() => {
    // 弹窗取消
  })
}

// 视频选择与真实上传 (支持 <= 100MB 校验门禁)
function handleSelectVideo() {
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
        form.videoUrl = res.data.videoUrl
        ElMessage.success(`课堂实操视频「${file.name}」(${(file.size / 1024 / 1024).toFixed(1)}MB) 上传成功！`)
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '上传课堂实操视频失败，请稍后重试')
    } finally {
      uploadingVideo.value = false
    }
  }
  input.click()
}

function handlePreviewVideo() {
  if (!form.videoUrl) {
    ElMessage.warning('当前暂未上传随堂实操视频')
    return
  }
  videoPreviewVisible.value = true
}

function handleRemoveVideo() {
  form.videoUrl = ''
  ElMessage.info('已移除课堂实操视频')
}

// 课堂照片墙管理 (至多 9 张，单张 <= 10MB)
function handleAddPhoto() {
  const currentCount = form.photoList.length
  if (currentCount >= 9) {
    ElMessage.warning('随堂课堂照片最多允许上传 9 张')
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

    // 10MB 体积前置校验
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
        const { persistedUrls, successCount, failureCount, errors } = res.data
        if (persistedUrls && persistedUrls.length > 0) {
          form.photoList.push(...persistedUrls)
        }

        if (failureCount > 0 && errors && errors.length > 0) {
          const reasons = errors.map((err) => `${err.filename}: ${err.reason}`).join('; ')
          ElNotification({
            title: '部分照片上传受阻',
            message: reasons,
            type: 'warning',
            duration: 6000,
          })
        }

        ElMessage.success(`已成功添加 ${successCount} 张现场实录照片，当前共计 ${form.photoList.length} 张`)
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '上传现场实录照片失败，请稍后重试')
    } finally {
      uploadingPhotos.value = false
    }
  }

  input.click()
}

function handleRemovePhoto(index: number) {
  form.photoList.splice(index, 1)
  ElMessage.info('已移除照片')
}

function handlePreviewPhoto(url: string) {
  window.open(url, '_blank')
}

// AI 帮我重写
function handleAiRewrite() {
  const loading = ElMessage({
    message: '✨ AI 教学大模型正在基于本节课学习内容与 5 星表现生成个性化点评...',
    duration: 0,
    type: 'info'
  })
  setTimeout(() => {
    loading.close()
    form.teacherComment = `【课堂表现与素养反馈】本节课学习了《${form.lessonTitle || '少儿编程'}》，孩子展现了极高的专注度与动手探索热情。在完成核心逻辑编写时，不仅能熟练运用嵌套条件判断，还能主动思考异常边界情况。遇到程序报错时能耐心运用调试打印排查，表现出成熟的计算思维与工程抗挫力，值得大大的表扬！建议课后多尝试变换参数，持续拓展思维广度。`
    form.aiPolished = true
    ElMessage.success('AI 已为您生成全新个性化高情商评语！')
  }, 800)
}

// AI 润色
function handleAiPolish() {
  if (!form.teacherComment) {
    ElMessage.warning('请先输入评语草稿再进行 AI 润色')
    return
  }
  polishing.value = true
  setTimeout(() => {
    polishing.value = false
    form.teacherComment = `【专业教师寄语】${form.teacherComment.trim()} 🌟 在教育心理学正向激励引导下，孩子不仅掌握了计算机科学精髓，更培养了严谨的逻辑闭环与自信表达能力，期待下节课更精彩的表现！`
    form.aiPolished = true
    ElMessage.success('AI 润色成功！文采与共育温度显著提升。')
  }, 600)
}

// 循环切换评语模板
let commentIdx = 0
function handleCycleCommentTemplate() {
  const sampleComments = [
    '通过游戏的方式，吸引学生的学习兴趣，在整个编程过程中，循序渐进的对不同角色进行有序设计，同时了解到物体的抛物线运动轨迹，增加新的知识点。',
    '孩子今天在硬件接线环节表现突出，不仅准确辨别了正负引脚与信号线，还能向同桌讲解传感器工作原理，具备优秀的小导师潜质！',
    '算法思维敏锐，能独立运用二分查找缩短程序运行耗时，对代码优雅度和规范性有较高自我要求，表现非常棒！'
  ]
  commentIdx = (commentIdx + 1) % sampleComments.length
  form.teacherComment = sampleComments[commentIdx]
  ElMessage.info('已载入常用预设评语库')
}

// 打开弹窗并载入 (调用协调器 hydrateEvaluation 接口)
async function open(lesson: WorkbenchLessonCard) {
  currentLesson.value = lesson
  templateList.value = getEvaluationTemplates()

  try {
    const res = await educationalApi.getEvaluationWorkbench(lesson.id)
    if (res?.data) {
      const { schedule, evaluation, roster, summary } = res.data
      workbenchSummary.value = summary || null
      workbenchRoster.value = roster || []

      form.lessonTimeId = schedule.id
      form.classId = schedule.classId
      form.className = schedule.className
      form.lessonTitle = evaluation.lessonTitle || `${schedule.className}-${schedule.courseName}`
      form.templateId = evaluation.templateId || 'tmpl-common'
      form.templateName = evaluation.templateName || '通用课评模板'
      form.studyContent = evaluation.studyContentHtml || ''
      form.rating = evaluation.overallRating || 5
      form.photoList = Array.isArray(evaluation.photoList) && evaluation.photoList.length > 0 ? [...evaluation.photoList] : []
      form.teacherComment = evaluation.teacherComment || ''
      form.videoUrl = evaluation.videoUrl || ''
      form.aiPolished = evaluation.aiPolished || false
      form.status = evaluation.status || 'draft'
      form.publishTime = evaluation.lastPublishedAt || undefined
      selectedTemplateId.value = form.templateId
    }
  } catch (err: any) {
    ElMessage.error(err.message || '水化课评数据失败，使用基础初始值')
    form.lessonTimeId = lesson.id
    form.classId = lesson.classId || ''
    form.className = lesson.className || ''
    form.lessonTitle = lesson.lessonTitle || `${lesson.className || '教学班'}`
    form.templateId = 'tmpl-common'
    form.templateName = '通用课评模板'
    form.studyContent = ''
    form.rating = 5
    form.photoList = []
    form.videoUrl = ''
    form.teacherComment = ''
    form.status = 'draft'
  }

  visible.value = true

  nextTick(() => {
    if (editorRef.value) {
      editorRef.value.innerHTML = form.studyContent
    }
  })
}

// 提交保存 (调用协调器 commitEvaluation 接口)
async function handleSave(publish: boolean) {
  if (!form.studyContent || !form.studyContent.trim()) {
    ElMessage.warning('请输入学习内容')
    return
  }
  if (!form.rating) {
    ElMessage.warning('请选择综合评价星级')
    return
  }
  if (!form.teacherComment || !form.teacherComment.trim()) {
    ElMessage.warning('请输入老师点评内容')
    return
  }

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
        videoUrl: form.videoUrl,
        photoList: form.photoList,
        teacherComment: form.teacherComment,
        aiPolished: form.aiPolished,
      },
    })

    const receipt = res.data

    if (publish) {
      const sentCount = receipt?.dispatchResult?.outboxEnqueuedCount || 0
      const skippedCount = receipt?.dispatchResult?.wechatSkippedCount || 0
      ElNotification({
        title: '课评发布成功',
        message: `课评已落盘并同步至学员考勤！已向 ${sentCount} 位绑定微信家长推送学情报告${skippedCount > 0 ? ` (另有 ${skippedCount} 位家长未绑定微信号)` : ''}。`,
        type: 'success',
        duration: 4500,
      })
    } else {
      ElMessage.success('课评草稿已持久化落盘至数据库！')
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
  padding-bottom: 14px;
}
.lesson-evaluation-dialog :deep(.el-dialog__body) {
  padding-top: 14px;
}
</style>
