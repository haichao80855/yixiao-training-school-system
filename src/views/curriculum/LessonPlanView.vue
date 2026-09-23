<template>
  <div class="p-5 space-y-4 bg-[#F0F2F5] min-h-[calc(100vh-60px)]">
    <!-- 顶部概览与操作栏 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center space-x-2">
          <span class="text-xs text-gray-500">教研</span>
          <span class="text-xs text-gray-400">/</span>
          <h2 class="text-base font-bold text-gray-800">上课进度树与教案课件 (课次大纲)</h2>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          支持“单元 (Unit) → 课次 (Lesson)”二级层级目录编排，统一挂接标准化 PPT 互动白板教案与源码模板。
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <el-button size="small" @click="handleBatchDownload">
          一键打包下载课件
        </el-button>
        <el-button type="primary" size="small" class="!px-4 font-medium" @click="openAddPlanDialog">
          + 录入课时大纲
        </el-button>
      </div>
    </div>

    <!-- 课程选择与快速筛选条 -->
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center space-x-3 text-xs">
        <span class="text-gray-600 font-medium">当前查看课程：</span>
        <el-select v-model="selectedCourseId" placeholder="请选择课程" size="small" class="!w-64" @change="handleCourseChange">
          <el-option
            v-for="course in courses"
            :key="course.id"
            :label="course.name"
            :value="course.id"
          />
        </el-select>
        <span class="text-gray-400">|</span>
        <span class="text-gray-500">课件类型：</span>
        <el-radio-group v-model="selectedCodeType" size="small">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="Scratch">Scratch</el-radio-button>
          <el-radio-button label="Python">Python</el-radio-button>
          <el-radio-button label="C++">C++</el-radio-button>
        </el-radio-group>
      </div>

      <div class="flex items-center space-x-2">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索课次名称或知识要点..."
          size="small"
          clearable
          class="!w-56"
        />
      </div>
    </div>

    <!-- 课件与教案大纲列表 -->
    <div class="space-y-4">
      <div
        v-for="unit in currentUnits"
        :key="unit.id"
        class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
      >
        <!-- 单元大纲头 -->
        <div class="bg-gradient-to-r from-gray-50 to-white px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <span class="w-2.5 h-2.5 rounded-full bg-[#1890FF]"></span>
            <span class="font-bold text-sm text-gray-800">{{ unit.title }}</span>
            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              共 {{ unit.lessons ? unit.lessons.length : 0 }} 讲
            </span>
          </div>
          <div class="flex items-center space-x-2">
            <el-button link type="primary" size="small" @click="handleExportUnit(unit)">
              导出单元大纲
            </el-button>
          </div>
        </div>

        <!-- 课次清单与课件信息 -->
        <div class="divide-y divide-gray-100">
          <div
            v-for="lesson in unit.lessons"
            :key="lesson.id"
            class="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-blue-50/20 transition-colors text-xs"
          >
            <!-- 左侧课次与目标 -->
            <div class="flex items-start space-x-3.5 flex-1 min-w-[280px]">
              <div class="w-8 h-8 rounded-full bg-blue-50 text-[#1890FF] font-bold font-mono flex items-center justify-center shrink-0 mt-0.5">
                {{ lesson.order }}
              </div>
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-gray-800 text-sm hover:text-[#1890FF] transition-colors">
                    {{ lesson.title }}
                  </span>
                  <span class="px-1.5 py-0.2 rounded text-[10px] bg-gray-100 text-gray-600 font-mono">
                    {{ lesson.duration }} 分钟
                  </span>
                  <el-tag size="small" :type="lesson.hasMedia ? 'success' : 'info'">
                    {{ lesson.hasMedia ? '白板互动课件' : '基础教案' }}
                  </el-tag>
                </div>
                <div class="text-gray-500 text-xs">
                  <span class="font-medium text-gray-600">教学目标：</span>
                  {{ lesson.objective || '引导学员掌握核心语法要点并完成当堂作品' }}
                </div>
              </div>
            </div>

            <!-- 右侧课件版本与操作 -->
            <div class="flex items-center space-x-4 shrink-0">
              <div class="text-right space-y-0.5 text-[11px] text-gray-400">
                <div class="font-mono text-gray-600">课件版本：<span class="text-[#1890FF] font-semibold">v2.4</span></div>
                <div>随堂互动题：{{ lesson.quizCount || 5 }} 道</div>
              </div>

              <div class="flex items-center space-x-1.5">
                <el-button size="small" type="primary" plain @click="handleDownloadPpt(lesson)">
                  PPT课件
                </el-button>
                <el-button size="small" @click="handleDownloadCode(lesson)">
                  代码工程
                </el-button>
                <el-button link type="primary" size="small" @click="handlePreview(lesson)">
                  在线白板
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 课件资源库汇总表格 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-200/80 space-y-3 mt-4">
      <div class="flex items-center justify-between pb-2 border-b border-gray-100">
        <div>
          <h3 class="text-sm font-bold text-gray-800">标准化课件资源仓库与下载统计</h3>
          <p class="text-xs text-gray-400">全校区教师授课课件下载追踪与版本审计</p>
        </div>
        <span class="text-xs text-gray-500">累计收录 {{ lessonPlans.length }} 份数字化课件</span>
      </div>

      <el-table :data="filteredPlans" style="width: 100%" stripe size="small" class="text-xs">
        <el-table-column prop="lessonName" label="课件名称" min-width="180">
          <template #default="{ row }">
            <span class="font-semibold text-gray-800">{{ row.lessonName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="courseName" label="所属课程" min-width="160" />
        <el-table-column prop="codeType" label="课件格式" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.codeType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pptVersion" label="版本" width="90" align="center" />
        <el-table-column prop="fileSize" label="大小" width="100" align="center" />
        <el-table-column prop="downloadCount" label="下载次数" width="110" align="center">
          <template #default="{ row }">
            <span class="font-mono font-bold text-emerald-600">{{ row.downloadCount }}</span> 次
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="最后更新" width="110" align="center" />
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDownloadPpt(row)">下载</el-button>
            <el-button link type="primary" size="small" @click="handlePreview(row)">预览</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 录入新课时教案弹窗 -->
    <el-dialog v-model="addPlanDialogVisible" title="录入课时教案与课件" width="560px" class="rounded-xl">
      <el-form :model="planForm" label-width="90px" size="default" class="pr-4 py-2">
        <el-form-item label="所属课程">
          <el-select v-model="planForm.courseId" class="w-full">
            <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="单元名称">
          <el-input v-model="planForm.unitTitle" placeholder="例如：第一单元：基础语法" />
        </el-form-item>
        <el-form-item label="课次名称">
          <el-input v-model="planForm.lessonName" placeholder="例如：第 01 讲：变量与基本运算" />
        </el-form-item>
        <el-form-item label="代码类型">
          <el-select v-model="planForm.codeType" class="w-full">
            <el-option label="Scratch (.sb3)" value="Scratch" />
            <el-option label="Python (.py)" value="Python" />
            <el-option label="C++ (.cpp)" value="C++" />
            <el-option label="机器人工程" value="Robotics" />
          </el-select>
        </el-form-item>
        <el-form-item label="课件版本">
          <el-input v-model="planForm.pptVersion" placeholder="例如：v1.0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="flex justify-end space-x-2">
          <el-button @click="addPlanDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSavePlan">保存并发布</el-button>
        </div>
      </template>
    </el-dialog>
    <!-- 随堂授课互动白板弹窗 -->
    <CoursewarePlayerDialog ref="playerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import CoursewarePlayerDialog from './components/CoursewarePlayerDialog.vue'
import { MOCK_COURSES, MOCK_LESSON_PLANS, restoreCoursesFromStorage } from '@/mocks'
import type { CourseItem, CourseUnit, LessonPlanItem } from '@/types/curriculum'

const courses = ref<CourseItem[]>([])

function reloadCourses() {
  restoreCoursesFromStorage()
  courses.value = [...MOCK_COURSES]
}

onMounted(() => {
  reloadCourses()
})

const selectedCourseId = ref('course-scratch-001')
const selectedCodeType = ref('all')
const searchKeyword = ref('')

const lessonPlans = ref<LessonPlanItem[]>([...MOCK_LESSON_PLANS])

const currentCourse = computed(() => {
  return courses.value.find(c => c.id === selectedCourseId.value) || courses.value[0]
})

const currentUnits = computed<CourseUnit[]>(() => {
  if (currentCourse.value && currentCourse.value.units && currentCourse.value.units.length > 0) {
    return currentCourse.value.units
  }
  // 默认占位单元
  return [
    {
      id: 'default-u1',
      title: '第一单元：课程综合实训与核心素养',
      order: 1,
      lessons: [
        {
          id: 'def-l1',
          title: `${currentCourse.value?.name || '课程'} - 第 01 讲：导入与大纲说明`,
          name: '导入与大纲说明',
          duration: currentCourse.value?.standardDuration || 60,
          order: 1,
          objective: '教学目标导入与基本原理概述',
          hasMedia: true,
          quizCount: 4
        },
        {
          id: 'def-l2',
          title: `${currentCourse.value?.name || '课程'} - 第 02 讲：核心任务工程交付`,
          name: '核心任务工程交付',
          duration: currentCourse.value?.standardDuration || 60,
          order: 2,
          objective: '课堂工程实作与随堂过关考核',
          hasMedia: true,
          quizCount: 6
        }
      ]
    }
  ]
})

const filteredPlans = computed(() => {
  return lessonPlans.value.filter(p => {
    if (selectedCodeType.value !== 'all' && p.codeType !== selectedCodeType.value) {
      return false
    }
    if (searchKeyword.value && searchKeyword.value.trim().length > 0) {
      const kw = searchKeyword.value.trim().toLowerCase()
      const m1 = p.lessonName.toLowerCase().includes(kw)
      const m2 = p.courseName.toLowerCase().includes(kw)
      if (!m1 && !m2) return false
    }
    return true
  })
})

function handleCourseChange() {
  ElMessage.info(`已切换至「${currentCourse.value?.name}」教案视图`)
}

function handleDownloadPpt(lesson: any) {
  ElMessage.success(`正在下载「${lesson.title || lesson.lessonName}」课件 PPT (标准白板格式)...`)
}

function handleDownloadCode(lesson: any) {
  ElMessage.success(`正在打包「${lesson.title || lesson.lessonName}」当堂代码工程模板...`)
}

const playerRef = ref<InstanceType<typeof CoursewarePlayerDialog> | null>(null)

function handlePreview(lesson: any) {
  if (playerRef.value) {
    playerRef.value.open({
      sessionName: lesson.title || lesson.lessonName || '随堂课件',
      pptUrl: lesson.pptUrl || 'https://pro-img-brtm.baijiayun.com/0baijiacloud/live_ppt/516587/516587_ppt_html/index.html',
      pptFileName: lesson.pptName || '第1课-C++基本框架 - 课件.pptx',
      downloadUrl: lesson.downloadUrl || 'https://public-prod-shengtong.oss-cn-zhangjiakou.aliyuncs.com/3/2025-03-01/document/1740834516929-0-%E7%AC%AC1%E8%AF%BE-C%2B%2B%E5%9F%BA%E6%9C%AC%E6%A1%86%E6%9E%B6%20-%20%E8%AF%BE%E4%BB%B6.pptx'
    });
  } else {
    ElMessage.info('正在打开白板实时互动预览器...');
  }
}

function handleExportUnit(unit: CourseUnit) {
  ElMessage.success(`已导出「${unit.title}」教学计划与课标规范文档！`)
}

function handleBatchDownload() {
  ElMessage.success('已加入后台任务：打包本课全套课件与源码工程！')
}

// 录入教案弹窗
const addPlanDialogVisible = ref(false)
const planForm = ref({
  courseId: '',
  unitTitle: '',
  lessonName: '',
  codeType: 'Scratch' as const,
  pptVersion: 'v1.0'
})

function openAddPlanDialog() {
  planForm.value = {
    courseId: selectedCourseId.value,
    unitTitle: '新单元：进阶技能训练',
    lessonName: '新课时：专题剖析与代码实操',
    codeType: 'Scratch',
    pptVersion: 'v1.0'
  }
  addPlanDialogVisible.value = true
}

function handleSavePlan() {
  if (!planForm.value.lessonName) {
    ElMessage.warning('请输入课次名称')
    return
  }
  const course = courses.value.find(c => c.id === planForm.value.courseId)
  lessonPlans.value.unshift({
    id: `plan-${Date.now()}`,
    courseId: planForm.value.courseId,
    courseName: course ? course.name : '自选课程',
    unitId: `unit-${Date.now()}`,
    unitTitle: planForm.value.unitTitle,
    lessonId: `l-${Date.now()}`,
    lessonName: planForm.value.lessonName,
    order: lessonPlans.value.length + 1,
    duration: 60,
    targetAudience: '对应学段',
    pptVersion: planForm.value.pptVersion,
    codeType: planForm.value.codeType,
    downloadCount: 0,
    fileSize: '12.5 MB',
    updatedAt: new Date().toISOString().split('T')[0],
    status: 'published'
  })
  addPlanDialogVisible.value = false
  ElMessage.success('新课时大纲与课件发布成功！')
}
</script>
