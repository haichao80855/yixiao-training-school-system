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

        <!-- 语音点评 -->
        <el-form-item>
          <template #label>
            <span class="text-xs text-st-secondary">语音点评</span>
          </template>
          <div class="flex items-center gap-3 w-full">
            <el-button
              size="small"
              :type="form.voiceUrl ? 'success' : 'default'"
              plain
              @click="handleToggleVoice"
            >
              🎙️ {{ form.voiceUrl ? '重新录制语音' : '添加语音' }}
            </el-button>
            <div v-if="form.voiceUrl" class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-full text-xs animate-pulse">
              <span>▶ 教师语音讲解录音已生成</span>
              <span class="font-mono text-[11px] font-bold">({{ form.voiceDuration || 45 }}s)</span>
              <el-button link type="danger" size="small" class="!p-0 ml-1" @click="handleRemoveVoice">✕</el-button>
            </div>
            <span v-else class="text-[11px] text-st-muted">可录制 30~60 秒随堂个性化口播反馈</span>
          </div>
        </el-form-item>

        <!-- 课堂视频 -->
        <el-form-item>
          <template #label>
            <span class="text-xs text-st-secondary">课堂视频</span>
          </template>
          <div class="flex items-center gap-3">
            <el-button size="small" plain @click="handleSelectVideo">
              {{ form.videoUrl ? '重新选择' : '上传课堂实操视频' }}
            </el-button>
            <div v-if="form.videoUrl" class="flex items-center gap-1.5 text-xs text-emerald-600 font-medium cursor-pointer" @click="handlePreviewVideo">
              <span>查看视频</span>
              <span class="text-emerald-700 bg-emerald-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✓</span>
            </div>
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
                @click="handleAddPhoto"
              >
                <span class="text-2xl font-light leading-none">+</span>
                <span class="text-[10px] mt-1">添加现场照</span>
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
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { WorkbenchLessonCard, EvaluationTemplate, LessonEvaluation } from '@/types/educational'
import {
  getEvaluationTemplates,
  getLessonEvaluationByLessonId,
  saveLessonEvaluation
} from '@/mocks/educational'

const emit = defineEmits<{
  (e: 'success', evaluation: LessonEvaluation): void
}>()

const visible = ref(false)
const saving = ref(false)
const polishing = ref(false)
const editorRef = ref<HTMLDivElement>()

const currentLesson = ref<WorkbenchLessonCard | null>(null)
const templateList = ref<EvaluationTemplate[]>([])
const selectedTemplateId = ref('')

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
  voiceUrl: string
  voiceDuration: number
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
  voiceUrl: '',
  voiceDuration: 0,
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
  }).catch(() => {})
}

// 语音点评录制与清除
function handleToggleVoice() {
  if (!form.voiceUrl) {
    form.voiceUrl = 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/audio/eval_sample.mp3'
    form.voiceDuration = 48
    ElMessage.success('模拟录音完成！已录入 48 秒个性化随堂语音点评。')
  } else {
    form.voiceDuration = Math.floor(30 + Math.random() * 30)
    ElMessage.success(`语音已重新录制完成 (${form.voiceDuration}s)`)
  }
}

function handleRemoveVoice() {
  form.voiceUrl = ''
  form.voiceDuration = 0
  ElMessage.info('已移除语音点评')
}

// 视频选择与预览
function handleSelectVideo() {
  form.videoUrl = 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/video/classroom_sample.mp4'
  ElMessage.success('已关联本堂课精彩回放视频片段！')
}

function handlePreviewVideo() {
  ElMessageBox.alert('课堂实况录像：单片机舵机避障对抗实录.mp4 (在线预览流播放正常)', '课堂视频回放预览', {
    confirmButtonText: '关闭'
  })
}

// 课堂照片墙管理
function handleAddPhoto() {
  if (form.photoList.length >= 9) {
    ElMessage.warning('照片与视频合计最多支持 9 个')
    return
  }
  const nextImg = defaultPhotos[form.photoList.length % defaultPhotos.length]
  form.photoList.push(nextImg)
  ElMessage.success(`已添加现场实录照片，当前共计 ${form.photoList.length} 张`)
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

// 打开弹窗并载入
function open(lesson: WorkbenchLessonCard) {
  currentLesson.value = lesson
  templateList.value = getEvaluationTemplates()

  // 尝试读取已存课评
  const existing = getLessonEvaluationByLessonId(lesson.id)
  if (existing) {
    Object.assign(form, existing)
    selectedTemplateId.value = existing.templateId || 'tmpl-common'
  } else {
    // 默认初始值
    const tpl = templateList.value[0]
    form.lessonTimeId = lesson.id
    form.classId = lesson.classId || ''
    form.className = lesson.className || ''
    form.lessonTitle = lesson.lessonTitle || `${lesson.className || '教学班'}-${lesson.lessonNumber || 1}`
    form.templateId = tpl?.id || 'tmpl-common'
    form.templateName = tpl?.name || '通用课评模板'
    form.studyContent = tpl?.defaultStudyContent || ''
    form.rating = 5
    form.voiceUrl = 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/audio/eval_sample.mp3'
    form.voiceDuration = 45
    form.videoUrl = 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/video/classroom_sample.mp4'
    form.photoList = [...defaultPhotos]
    form.teacherComment = tpl?.defaultTeacherComment || ''
    form.aiPolished = false
    form.status = 'draft'
    selectedTemplateId.value = form.templateId
  }

  visible.value = true

  nextTick(() => {
    if (editorRef.value) {
      editorRef.value.innerHTML = form.studyContent
    }
  })
}

// 提交保存
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
    const saved = saveLessonEvaluation({
      ...form,
      status: publish ? 'published' : 'draft'
    }, publish)

    if (publish) {
      ElMessage.success({
        message: `课评发布成功！已即时同步并向「${form.className}」全部家长端推送随堂学情报告与课堂相册！`,
        duration: 4000
      })
    } else {
      ElMessage.success('课评草稿暂存成功！数据已持久化落盘。')
    }

    emit('success', saved)
    visible.value = false
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
