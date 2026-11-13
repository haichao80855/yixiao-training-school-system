<template>
  <div class="p-5 space-y-4 bg-st-bg min-h-[calc(100vh-60px)]">
    <!-- 页头 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-st-title">课次进度大纲</h2>
        <p class="text-xs text-st-muted mt-1">按“单元 → 课次”编排每门课程的上课进度，并挂接课件链接。</p>
      </div>
      <el-button type="primary" @click="openAddPlanDialog">+ 录入课次</el-button>
    </div>

    <!-- 课程选择与搜索 -->
    <div class="bg-white rounded-lg p-4 shadow-card border border-st-border flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3 text-sm">
        <span class="text-st-secondary">当前课程</span>
        <el-select v-model="selectedCourseId" placeholder="请选择课程" class="!w-64" filterable @change="handleCourseChange">
          <el-option v-for="course in courses" :key="course.id" :label="course.name" :value="course.id" />
        </el-select>
      </div>
      <el-input v-model="searchKeyword" placeholder="搜索课次名称" clearable class="!w-56" />
    </div>

    <!-- 单元与课次 -->
    <div v-loading="unitsLoading" class="space-y-4 min-h-[120px]">
      <div
        v-for="unit in visibleUnits"
        :key="unit.id"
        class="bg-white rounded-lg border border-st-border shadow-card overflow-hidden"
      >
        <div class="bg-st-header px-5 py-3 border-b border-st-border flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="font-semibold text-sm text-st-title">{{ unit.title }}</span>
            <span class="text-xs text-st-muted">共 {{ unit.lessons.length }} 讲</span>
          </div>
          <el-button link type="primary" @click="handleExportUnit(unit)">导出单元大纲</el-button>
        </div>

        <div class="divide-y divide-st-border">
          <div
            v-for="lesson in unit.lessons"
            :key="lesson.id"
            class="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-st-header transition-colors"
          >
            <div class="flex items-center gap-3.5 flex-1 min-w-[280px]">
              <div class="w-8 h-8 rounded-full bg-st-primary-light text-st-primary font-semibold tabular-nums flex items-center justify-center shrink-0">
                {{ lesson.order }}
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-st-title text-sm">{{ lesson.title }}</span>
                  <span class="text-xs text-st-muted tabular-nums">{{ lesson.duration }} 分钟</span>
                  <el-tag size="small" :type="lesson.pptUrl ? 'success' : 'info'">
                    {{ lesson.pptUrl ? '有课件' : '未挂课件' }}
                  </el-tag>
                </div>
                <div v-if="lesson.objective" class="text-xs text-st-secondary">教学目标：{{ lesson.objective }}</div>
              </div>
            </div>

            <el-button v-if="lesson.pptUrl" type="primary" plain @click="handlePreview(lesson)">打开课件</el-button>
          </div>
          <div v-if="unit.lessons.length === 0" class="px-5 py-4 text-xs text-st-muted">这个单元还没有课次</div>
        </div>
      </div>

      <AppEmpty
        v-if="!unitsLoading && visibleUnits.length === 0"
        :title="searchKeyword ? '没有匹配的课次' : '这门课程还没有录入课次大纲'"
        :description="searchKeyword ? '换个关键词试试' : '点击右上角“录入课次”开始编排'"
      />
    </div>

    <!-- 录入课次弹窗 -->
    <el-dialog v-model="addPlanDialogVisible" title="录入课次" :width="DIALOG_SIZE.md">
      <el-form ref="planFormRef" :model="planForm" :rules="planRules" :label-width="FORM_LABEL_WIDTH.md">
        <el-form-item label="所属课程" prop="courseId">
          <el-select v-model="planForm.courseId" class="w-full" filterable>
            <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="单元名称" prop="unitTitle">
          <el-input v-model="planForm.unitTitle" placeholder="例如：第一单元：基础语法" />
        </el-form-item>
        <el-form-item label="课次名称" prop="lessonName">
          <el-input v-model="planForm.lessonName" placeholder="例如：第 01 讲：变量与基本运算" />
        </el-form-item>
        <el-form-item label="课时长度">
          <el-input-number v-model="planForm.durationMin" :min="15" :max="240" :step="15" />
          <span class="ml-2 text-sm text-st-secondary">分钟</span>
        </el-form-item>
        <el-form-item label="课件链接" prop="courseware">
          <el-input v-model="planForm.courseware" placeholder="选填，PPT 下载链接或在线白板链接" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addPlanDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSavePlan">保存</el-button>
      </template>
    </el-dialog>

    <CoursewarePlayerDialog ref="playerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import CoursewarePlayerDialog from './components/CoursewarePlayerDialog.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { curriculumApi } from '@/api'
import { DIALOG_SIZE, FORM_LABEL_WIDTH, OPTION_LIST_PAGE_SIZE } from '@/constants/ui'
import { downloadCsv, todayStamp } from '@/utils/csvExport'
import type { CourseItem, CourseUnit, LessonItem } from '@/types/curriculum'

const courses = ref<CourseItem[]>([])
const loadedUnits = ref<CourseUnit[]>([])
const unitsLoading = ref(false)
const selectedCourseId = ref('')
const searchKeyword = ref('')

async function reloadCourses() {
  try {
    const res = await curriculumApi.getCourses({ pageSize: OPTION_LIST_PAGE_SIZE })
    const data = res?.data
    const list = Array.isArray(data) ? data : (data?.items || data?.list || [])
    courses.value = Array.isArray(list) ? list : []
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '获取课程列表失败')
    courses.value = []
  }
  if (!courses.value.some((c) => c.id === selectedCourseId.value)) {
    selectedCourseId.value = courses.value[0]?.id || ''
  }
  await loadCourseUnits(selectedCourseId.value)
}

async function loadCourseUnits(courseId: string) {
  loadedUnits.value = []
  if (!courseId) return
  unitsLoading.value = true
  try {
    const res = await curriculumApi.getUnits(courseId)
    loadedUnits.value = Array.isArray(res?.data) ? res.data : []
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '加载课程大纲失败')
  } finally {
    unitsLoading.value = false
  }
}

onMounted(reloadCourses)

const currentCourse = computed(() => courses.value.find((c) => c.id === selectedCourseId.value))

/** 搜索时只保留有匹配课次的单元 */
const visibleUnits = computed<CourseUnit[]>(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  const units = loadedUnits.value.map((u) => ({ ...u, lessons: Array.isArray(u.lessons) ? u.lessons : [] }))
  if (!kw) return units
  return units
    .map((u) => ({ ...u, lessons: u.lessons.filter((l) => (l.title || '').toLowerCase().includes(kw)) }))
    .filter((u) => u.lessons.length > 0)
})

function handleCourseChange() {
  searchKeyword.value = ''
  loadCourseUnits(selectedCourseId.value)
}

const playerRef = ref<InstanceType<typeof CoursewarePlayerDialog> | null>(null)

function handlePreview(lesson: LessonItem) {
  if (!lesson.pptUrl) return
  playerRef.value?.open({
    sessionName: lesson.title || '课件',
    pptUrl: lesson.pptUrl,
    pptFileName: `${lesson.title || '课件'}.pptx`,
    downloadUrl: lesson.pptUrl,
  })
}

function handleExportUnit(unit: CourseUnit) {
  const courseName = currentCourse.value?.name || '课程'
  downloadCsv(
    `${courseName}-${unit.title}-课次大纲-${todayStamp()}`,
    [
      { title: '序号', value: (l: LessonItem) => l.order },
      { title: '课次名称', value: (l) => l.title },
      { title: '时长 (分钟)', value: (l) => l.duration },
      { title: '教学目标', value: (l) => l.objective },
      { title: '课件链接', value: (l) => l.pptUrl },
    ],
    unit.lessons || [],
  )
}

// 录入课次
const addPlanDialogVisible = ref(false)
const saving = ref(false)
const planFormRef = ref<FormInstance>()
const planForm = ref({ courseId: '', unitTitle: '', lessonName: '', durationMin: 90, courseware: '' })
const planRules: FormRules = {
  courseId: [{ required: true, message: '请选择课程', trigger: 'change' }],
  unitTitle: [{ required: true, message: '请输入单元名称', trigger: 'blur' }],
  lessonName: [{ required: true, message: '请输入课次名称', trigger: 'blur' }],
  courseware: [
    {
      validator: (_rule, value: string, callback) => {
        if (value && !/^https?:\/\//i.test(value.trim())) callback(new Error('请输入以 http:// 或 https:// 开头的链接'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

function openAddPlanDialog() {
  planForm.value = { courseId: selectedCourseId.value, unitTitle: '', lessonName: '', durationMin: 90, courseware: '' }
  addPlanDialogVisible.value = true
}

async function handleSavePlan() {
  if (!planFormRef.value || saving.value) return
  const valid = await planFormRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await curriculumApi.createUnit(planForm.value.courseId, {
      unitName: planForm.value.unitTitle.trim(),
      lessons: [
        {
          lessonName: planForm.value.lessonName.trim(),
          durationMin: planForm.value.durationMin,
          courseware: planForm.value.courseware.trim() || undefined,
        },
      ],
    })
    addPlanDialogVisible.value = false
    ElMessage.success('课次已保存')
    if (planForm.value.courseId !== selectedCourseId.value) selectedCourseId.value = planForm.value.courseId
    await loadCourseUnits(selectedCourseId.value)
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>
