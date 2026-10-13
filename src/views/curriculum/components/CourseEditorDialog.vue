<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? `编辑课程：${form.name}` : '新建教研课程向导'"
    width="900px"
    destroy-on-close
    :close-on-click-modal="false"
    class="course-editor-dialog rounded-xl"
  >
    <!-- 步骤指示器 -->
    <div class="px-8 pb-4 pt-1 border-b border-gray-100">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="基础信息" description="课程参数与单价" />
        <el-step title="校区授权" description="跨校区开课权限" />
        <el-step title="单元与课时" description="教学大纲层级编排" />
      </el-steps>
    </div>

    <!-- 步骤一：基础信息 -->
    <div v-show="currentStep === 0" class="py-5 px-6 max-h-[60vh] overflow-y-auto">
      <el-form
        ref="step1FormRef"
        :model="form"
        :rules="step1Rules"
        label-width="110px"
        size="default"
        class="pr-4"
      >
        <el-row :gutter="20">
          <el-col :span="14">
            <el-form-item label="课程名称" prop="name">
              <el-input
                v-model="form.name"
                placeholder="例如：Scratch创意图形编程高阶班"
                maxlength="80"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="课程编码" prop="code">
              <el-input v-model="form.code" placeholder="例如：012-SCRATCH-ADV" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="所属科目" prop="subject">
              <el-select v-model="form.subject" placeholder="请选择科目" class="w-full">
                <el-option label="软件编程" value="软件编程" />
                <el-option label="信息学竞赛" value="信息学竞赛" />
                <el-option label="硬件机器人" value="硬件机器人" />
                <el-option label="科技启蒙" value="科技启蒙" />
                <el-option label="教师培训" value="教师培训" />
                <el-option label="考级竞赛" value="考级竞赛" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="适用年级" prop="grade">
              <el-select v-model="form.grade" placeholder="请选择年级学段" class="w-full">
                <el-option label="全部" value="全部" />
                <el-option label="初级课程" value="初级课程" />
                <el-option label="中级课程" value="中级课程" />
                <el-option label="高级课程" value="高级课程" />
                <el-option label="幼儿园" value="幼儿园" />
                <el-option label="小学低" value="小学低" />
                <el-option label="小学高" value="小学高" />
                <el-option label="中学" value="中学" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="课程属性" prop="attribute">
              <el-select v-model="form.attribute" placeholder="请选择课程属性" class="w-full">
                <el-option label="常规课程" value="regular" />
                <el-option label="扩科课程" value="extended" />
                <el-option label="活动课程" value="activity" />
                <el-option label="体验课程" value="trial" />
                <el-option label="教师培训" value="training" />
                <el-option label="服务费" value="service_fee" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开课状态" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio label="enabled">立即启用</el-radio>
                <el-radio label="disabled">暂存下架</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="总课时数" prop="totalLessons">
              <el-input-number
                v-model="form.totalLessons"
                :min="1"
                :max="300"
                class="!w-full"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="课时单价" prop="pricePerLesson">
              <el-input-number
                v-model="form.pricePerLesson"
                :min="0"
                :step="50"
                :max="999999"
                class="!w-full"
                controls-position="right"
              >
                <template #suffix>元/次</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="标准课时时长">
              <el-select v-model="form.standardDuration" class="w-full">
                <el-option :value="45" label="45 分钟 / 课次" />
                <el-option :value="60" label="60 分钟 / 课次" />
                <el-option :value="90" label="90 分钟 / 课次" />
                <el-option :value="120" label="120 分钟 / 课次" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="满班人数上限">
              <el-input-number
                v-model="form.maxCapacity"
                :min="1"
                :max="100"
                class="!w-full"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="年份">
              <el-select v-model="form.year" class="w-full">
                <el-option value="2025" label="2025 年" />
                <el-option value="2026" label="2026 年" />
                <el-option value="2027" label="2027 年" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="期段">
              <el-select v-model="form.period" class="w-full">
                <el-option value="常规班" label="常规班" />
                <el-option value="春季班" label="春季班" />
                <el-option value="秋季班" label="秋季班" />
                <el-option value="暑期班" label="暑期班" />
                <el-option value="寒假班" label="寒假班" />
                <el-option value="师训专班" label="师训专班" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 封面快选与预览 -->
        <el-form-item label="课程封面">
          <div class="w-full space-y-3">
            <div class="flex items-center space-x-4">
              <div class="w-40 aspect-video rounded border border-gray-200 overflow-hidden bg-gray-50 shrink-0 shadow-sm">
                <img :src="form.cover" alt="封面预览" class="w-full h-full object-cover" />
              </div>
              <div class="flex-1 text-xs text-gray-500">
                <div class="font-medium text-gray-700 mb-1">封面推荐预设（点击直接选用）：</div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="(url, key) in presetCovers"
                    :key="key"
                    type="button"
                    @click="form.cover = url"
                    :class="[
                      'px-2 py-1 rounded text-xs border transition-all',
                      form.cover === url
                        ? 'border-[#1890FF] bg-blue-50 text-[#1890FF] font-semibold'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                    ]"
                  >
                    {{ coverLabels[key] || key }}
                  </button>
                </div>
              </div>
            </div>
            <el-input v-model="form.cover" placeholder="或输入自定义封面图片 URL (建议 16:9 比例)" size="small">
              <template #prepend>封面 URL</template>
            </el-input>
          </div>
        </el-form-item>

        <el-form-item label="课程简介">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="输入课程亮点、学习前置要求及预期达成成果..."
            maxlength="300"
            show-word-limit
          />
        </el-form-item>
      </el-form>
    </div>

    <!-- 步骤二：跨校区授权穿梭树 -->
    <div v-show="currentStep === 1" class="py-5 px-6 max-h-[60vh] overflow-y-auto">
      <div class="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 mb-4 flex items-center justify-between">
        <div class="text-xs text-blue-900">
          <span class="font-bold">跨校区授权规则：</span>
          被勾选授权的实体校区，其学员中心可报名该课，教务排课可指派该课。总部校区拥有超级排课权。
        </div>
        <div class="flex items-center space-x-2">
          <el-button size="small" type="primary" plain @click="selectAllCampuses">
            一键全选
          </el-button>
          <el-button size="small" @click="clearCampuses">
            一键清空
          </el-button>
          <el-button size="small" @click="selectHqOnly">
            仅留总部
          </el-button>
        </div>
      </div>

      <div class="text-xs font-medium text-gray-500 mb-2 flex items-center justify-between">
        <span>可选实体校区列表 ({{ form.authorizedCampusIds.length }} / {{ allCampuses.length }} 已授权)</span>
        <span class="text-gray-400">点击卡片切换授权状态</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="campus in allCampuses"
          :key="campus.id"
          @click="toggleCampus(campus.id)"
          :class="[
            'p-3.5 rounded-lg border cursor-pointer transition-all duration-200 flex items-start justify-between select-none',
            form.authorizedCampusIds.includes(campus.id)
              ? 'border-[#1890FF] bg-blue-50/40 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300'
          ]"
        >
          <div class="flex items-start space-x-3">
            <el-checkbox
              :model-value="form.authorizedCampusIds.includes(campus.id)"
              @change="toggleCampus(campus.id)"
              class="!mr-0 mt-0.5"
            />
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-bold text-sm text-gray-800">{{ campus.name }}</span>
                <span
                  v-if="campus.isHeadquarter"
                  class="px-1.5 py-0.2 text-[10px] rounded bg-orange-100 text-orange-700 font-semibold border border-orange-200"
                >
                  总部直属
                </span>
              </div>
              <div class="text-xs text-gray-500 mt-1">校区编号：{{ campus.code }}</div>
              <div class="text-xs text-gray-400 mt-0.5 truncate max-w-[260px]">{{ campus.address }}</div>
            </div>
          </div>
          <div class="text-xs font-medium pt-0.5">
            <span v-if="form.authorizedCampusIds.includes(campus.id)" class="text-[#1890FF]">
              已授权 ✓
            </span>
            <span v-else class="text-gray-400">
              未授权
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 步骤三：单元与课时编排 -->
    <div v-show="currentStep === 2" class="py-5 px-6 max-h-[60vh] overflow-y-auto space-y-4">
      <div class="flex items-center justify-between pb-2 border-b border-gray-100">
        <div>
          <h4 class="text-sm font-bold text-gray-800">课程教学次序与大纲编排</h4>
          <p class="text-xs text-gray-500">支持建立“单元 (Unit) → 课次 (Lesson)”二级层级目录与上下移动重新排序</p>
        </div>
        <el-button type="primary" size="small" @click="addUnit">
          + 新增单元
        </el-button>
      </div>

      <div v-if="!form.units || form.units.length === 0" class="py-12 text-center text-gray-400 text-xs">
        <div class="mb-2">暂无编排单元目录</div>
        <el-button size="small" type="primary" plain @click="addUnit">
          创建第一个单元
        </el-button>
      </div>

      <div v-for="(unit, uIdx) in form.units" :key="unit.id" class="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <!-- 单元表头 -->
        <div class="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
          <div class="flex items-center space-x-2 flex-1 mr-4">
            <span class="w-2.5 h-2.5 rounded-full bg-[#1890FF] shrink-0"></span>
            <el-input
              v-model="unit.title"
              placeholder="单元标题，例如：第一单元：基础语法"
              size="small"
              class="font-semibold text-sm max-w-sm"
            />
            <span class="text-xs text-gray-500 font-normal">({{ unit.lessons ? unit.lessons.length : 0 }} 课次)</span>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <el-button
              link
              type="primary"
              size="small"
              :disabled="uIdx === 0"
              @click="moveUnit(uIdx, -1)"
            >
              上移
            </el-button>
            <el-button
              link
              type="primary"
              size="small"
              :disabled="uIdx === (form.units?.length || 0) - 1"
              @click="moveUnit(uIdx, 1)"
            >
              下移
            </el-button>
            <el-button link type="primary" size="small" @click="addLesson(unit)">
              + 添加课时
            </el-button>
            <el-button link type="danger" size="small" @click="deleteUnit(uIdx)">
              删除单元
            </el-button>
          </div>
        </div>

        <!-- 课时列表 -->
        <div class="divide-y divide-gray-100 p-2 space-y-2">
          <div
            v-if="!unit.lessons || unit.lessons.length === 0"
            class="py-4 text-center text-xs text-gray-400"
          >
            本单元暂无课次，点击上方“+ 添加课时”录入大纲
          </div>
          <div
            v-for="(lesson, lIdx) in unit.lessons"
            :key="lesson.id"
            class="p-2.5 rounded hover:bg-blue-50/30 transition-colors flex items-center justify-between text-xs space-x-3 bg-gray-50/50 border border-gray-100"
          >
            <div class="flex items-center space-x-2 flex-1">
              <span class="font-mono text-gray-400 font-semibold w-8 text-center shrink-0">
                #{{ lesson.order }}
              </span>
              <el-input
                v-model="lesson.title"
                placeholder="课次名称，例如：第 1 讲：变量与基本运算"
                size="small"
                class="flex-1"
              />
              <el-input-number
                v-model="lesson.duration"
                :min="15"
                :max="240"
                :step="15"
                size="small"
                class="!w-24 shrink-0"
              >
                <template #suffix>分</template>
              </el-input-number>
              <el-input
                v-model="lesson.objective"
                placeholder="教学目标/重点"
                size="small"
                class="w-56 shrink-0"
              />
            </div>
            <div class="flex items-center space-x-1 shrink-0">
              <el-button
                link
                type="primary"
                size="small"
                :disabled="lIdx === 0"
                @click="moveLesson(unit, lIdx, -1)"
              >
                ↑
              </el-button>
              <el-button
                link
                type="primary"
                size="small"
                :disabled="lIdx === unit.lessons.length - 1"
                @click="moveLesson(unit, lIdx, 1)"
              >
                ↓
              </el-button>
              <el-button link type="danger" size="small" @click="deleteLesson(unit, lIdx)">
                ✕
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部按钮栏 -->
    <template #footer>
      <div class="flex items-center justify-between px-4 py-2 border-t border-gray-100">
        <el-button @click="visible = false">取消</el-button>
        <div class="space-x-2">
          <el-button v-if="currentStep > 0" @click="currentStep--">
            上一步
          </el-button>
          <el-button v-if="currentStep < 2" type="primary" @click="handleNextStep">
            下一步
          </el-button>
          <el-button v-if="currentStep === 2" type="primary" @click="handleSave">
            完成并保存课程
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useTenantStore } from '@/stores/tenantStore'
import { curriculumApi } from '@/api'
import { COURSE_COVERS } from '@/constants/curriculum'
import type { CourseItem, CourseUnit, LessonItem } from '@/types/curriculum'

const props = defineProps<{
  modelValue: boolean
  courseData?: CourseItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', course: CourseItem): void
}>()

const tenantStore = useTenantStore()
const visible = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
})

const isEdit = computed(() => !!props.courseData?.id)
const currentStep = ref(0)
const step1FormRef = ref<FormInstance>()

const allCampuses = computed(() => tenantStore.campuses)

const presetCovers = COURSE_COVERS
const coverLabels: Record<string, string> = {
  boutiqueScratch: '精品课-Scratch',
  boutiquePython: '精品课-Python',
  cityZhongming: '城市赛-中鸣',
  cityKiro: '城市赛-KIRO',
  cityMcu: '城市赛-单片机',
  teacherTraining: '教师培训',
  dreamCpp: '梦想家-C++',
  dreamPython: '梦想家-Python',
  dreamScratch: '梦想家-Scratch'
}

const defaultForm: CourseItem = {
  id: '',
  name: '',
  code: '',
  cover: COURSE_COVERS.boutiqueScratch,
  pricePerLesson: 300,
  totalLessons: 48,
  subject: '软件编程',
  grade: '小学低',
  attribute: 'extended',
  status: 'enabled',
  authorizedCampusIds: ['campus-bj-hq'],
  description: '',
  standardDuration: 60,
  maxCapacity: 16,
  year: '2026',
  period: '秋季班',
  tags: ['授权', '扩科-实践-总部-软编'],
  units: []
}

const form = reactive<CourseItem>({ ...defaultForm })

watch(
  () => props.modelValue,
  val => {
    if (val) {
      currentStep.value = 0
      if (props.courseData) {
        Object.assign(form, JSON.parse(JSON.stringify(props.courseData)))
        if (!form.units) form.units = []
        if (!form.authorizedCampusIds) form.authorizedCampusIds = ['campus-bj-hq']
      } else {
        Object.assign(form, JSON.parse(JSON.stringify(defaultForm)))
        form.id = `course-${Date.now()}`
        form.code = `012-CRS-${Math.floor(Math.random() * 900 + 100)}`
        // 默认全选实体校区
        form.authorizedCampusIds = tenantStore.campuses.map(c => c.id)
      }
    }
  }
)

// 校验规则
const step1Rules: FormRules = {
  name: [
    { required: true, message: '请输入课程名称', trigger: 'blur' },
    { min: 2, max: 80, message: '课程名称长度在 2 到 80 个字符之间', trigger: 'blur' }
  ],
  code: [{ required: true, message: '请输入课程编码', trigger: 'blur' }],
  subject: [{ required: true, message: '请选择所属科目', trigger: 'change' }],
  grade: [{ required: true, message: '请选择适用年级', trigger: 'change' }],
  attribute: [{ required: true, message: '请选择课程属性', trigger: 'change' }],
  totalLessons: [
    { required: true, message: '请输入总课时数', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (!value || value <= 0) {
          callback(new Error('总课时数必须严格大于 0'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  pricePerLesson: [
    { required: true, message: '请输入课时单价', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value === undefined || value === null || value < 0) {
          callback(new Error('课时单价必须为非负数'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

async function handleNextStep() {
  if (currentStep.value === 0) {
    if (!step1FormRef.value) return
    await step1FormRef.value.validate(valid => {
      if (valid) {
        currentStep.value++
      } else {
        ElMessage.warning('请检查基础信息表单中的必填项！')
      }
    })
  } else if (currentStep.value === 1) {
    if (form.authorizedCampusIds.length === 0) {
      ElMessage.warning('请至少为该课程授权一个校区！')
      return
    }
    currentStep.value++
  }
}

// 校区授权操作
function toggleCampus(campusId: string) {
  const index = form.authorizedCampusIds.indexOf(campusId)
  if (index > -1) {
    form.authorizedCampusIds.splice(index, 1)
  } else {
    form.authorizedCampusIds.push(campusId)
  }
}

function selectAllCampuses() {
  form.authorizedCampusIds = allCampuses.value.map(c => c.id)
}

function clearCampuses() {
  form.authorizedCampusIds = []
}

function selectHqOnly() {
  form.authorizedCampusIds = ['campus-bj-hq']
}

// 单元与课时管理
function addUnit() {
  if (!form.units) form.units = []
  const newOrder = form.units.length + 1
  const newUnit: CourseUnit = {
    id: `unit-${Date.now()}`,
    title: `第 ${newOrder} 单元：新编教学模块`,
    order: newOrder,
    lessons: [
      {
        id: `lesson-${Date.now()}-1`,
        title: `第 01 课：模块初识与目标`,
        name: `第 01 课：模块初识与目标`,
        duration: form.standardDuration || 60,
        order: 1,
        objective: '教学导入与目标说明',
        hasMedia: false
      }
    ]
  }
  form.units.push(newUnit)
}

function deleteUnit(index: number) {
  if (form.units) {
    form.units.splice(index, 1)
    form.units.forEach((u, i) => {
      u.order = i + 1
    })
  }
}

function moveUnit(index: number, direction: -1 | 1) {
  if (!form.units) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= form.units.length) return
  const [moved] = form.units.splice(index, 1)
  form.units.splice(targetIndex, 0, moved)
  form.units.forEach((u, i) => {
    u.order = i + 1
  })
}

function addLesson(unit: CourseUnit) {
  if (!unit.lessons) unit.lessons = []
  const nextOrder = unit.lessons.length + 1
  const newLesson: LessonItem = {
    id: `lesson-${Date.now()}-${nextOrder}`,
    title: `第 ${nextOrder < 10 ? '0' + nextOrder : nextOrder} 课：知识要点与拓展`,
    name: `第 ${nextOrder < 10 ? '0' + nextOrder : nextOrder} 课：知识要点与拓展`,
    duration: form.standardDuration || 60,
    order: nextOrder,
    objective: '核心语法与工程实作',
    hasMedia: false
  }
  unit.lessons.push(newLesson)
}

function deleteLesson(unit: CourseUnit, index: number) {
  unit.lessons.splice(index, 1)
  unit.lessons.forEach((l, i) => {
    l.order = i + 1
  })
}

function moveLesson(unit: CourseUnit, index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= unit.lessons.length) return
  const [moved] = unit.lessons.splice(index, 1)
  unit.lessons.splice(targetIndex, 0, moved)
  unit.lessons.forEach((l, i) => {
    l.order = i + 1
  })
}

// 保存
async function handleSave() {
  if (!form.name || form.name.trim().length === 0) {
    ElMessage.error('课程名称不可为空！')
    currentStep.value = 0
    return
  }
  if (form.pricePerLesson < 0) {
    ElMessage.error('课程单价不可为负数！')
    currentStep.value = 0
    return
  }
  if (form.totalLessons <= 0) {
    ElMessage.error('总课时数必须大于0！')
    currentStep.value = 0
    return
  }

  let savedCourse: any = null
  try {
    if (isEdit.value && form.id) {
      const res = await curriculumApi.updateCourse(form.id, {
        name: form.name,
        pricePerLesson: Number(form.pricePerLesson),
        totalLessons: Number(form.totalLessons),
        subject: form.subject,
        grade: form.grade,
        attribute: form.attribute,
        cover: form.cover,
        description: form.description
      })
      if (res && res.data) {
        savedCourse = res.data
      }
    } else {
      const res = await curriculumApi.createCourse({
        code: form.code || `CRS-${Date.now().toString().slice(-6)}`,
        name: form.name,
        cover: form.cover,
        pricePerLesson: Number(form.pricePerLesson),
        totalLessons: Number(form.totalLessons),
        subject: form.subject || 'scratch',
        grade: form.grade || 'middle',
        attribute: form.attribute || 'regular',
        description: form.description || '',
        campusIds: form.authorizedCampusIds || ['campus-bj-hq']
      })
      if (res && res.data) {
        savedCourse = res.data
      }
    }
    ElMessage.success(isEdit.value ? '课程修改已成功保存至数据库！' : '新课程已成功发布入库！')
    emit('saved', savedCourse || { ...form })
    visible.value = false
  } catch (err: any) {
    ElMessage.error(err.message || '保存课程失败')
  }
}
</script>

<style scoped>
.course-editor-dialog :deep(.el-step__title) {
  font-size: 13px;
}
.course-editor-dialog :deep(.el-step__description) {
  font-size: 11px;
}
</style>
