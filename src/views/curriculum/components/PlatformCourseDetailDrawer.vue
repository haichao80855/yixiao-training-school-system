<template>
  <el-drawer
    v-model="visible"
    :title="course?.courseName || '课程详情与课件大纲'"
    size="72%"
    destroy-on-close
    class="platform-course-detail-drawer"
  >
    <div v-if="course" class="space-y-6 pb-8">
      <!-- 课程头部全景 Hero Card -->
      <div class="rounded-xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 text-white p-6 shadow-md flex flex-col md:flex-row gap-6 items-center">
        <!-- 封面图 -->
        <div class="w-full md:w-72 aspect-[16/9] rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black/20 shadow-inner">
          <img :src="course.courseCover" :alt="course.courseName" class="w-full h-full object-cover" />
        </div>

        <!-- 课程信息 -->
        <div class="flex-1 space-y-3">
          <div class="flex items-center space-x-2">
            <span class="px-2 py-0.5 rounded bg-emerald-500/80 text-white text-xs font-semibold">
              盛通官方授权
            </span>
            <span class="px-2 py-0.5 rounded bg-blue-500/80 text-white text-xs font-semibold">
              {{ course.configCourseTypeName || '标准研发课程' }}
            </span>
            <span class="text-xs text-gray-300">
              共 {{ lessonList.length }} 个课次项目
            </span>
          </div>

          <h2 class="text-xl font-bold tracking-wide">
            {{ course.courseName }}
          </h2>
          <p v-if="course.courseNameAlias && course.courseNameAlias !== course.courseName" class="text-xs text-gray-300">
            别名: {{ course.courseNameAlias }}
          </p>

          <div class="flex flex-wrap gap-4 text-xs text-gray-200 pt-2 border-t border-white/10">
            <div><span class="text-gray-300">学科分类:</span> {{ course.configCourseSubjectName || '综合素养' }}</div>
            <div><span class="text-gray-300">适用学段:</span> {{ course.configCourseGradeName || '少儿/青少年' }}</div>
            <div><span class="text-gray-300">标准课时:</span> {{ course.planLessonTotal || lessonList.length }} 课时</div>
            <div><span class="text-gray-300">主创作者:</span> {{ course.createUserName || '盛通教研总院' }}</div>
          </div>
        </div>
      </div>

      <!-- 课次与课件交互列表 -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <h3 class="text-base font-bold text-gray-800">授课大纲与随堂互动课件</h3>
            <span class="px-2 py-0.5 bg-blue-50 text-st-primary text-xs rounded-full font-medium">
              支持一键进入在线互动课件授课
            </span>
          </div>
          <span class="text-xs text-st-secondary">点击课次卡片或播放按钮即可启动随堂课件白板</span>
        </div>

        <!-- 课件卡片网格 (高保真还原盛通原系统暗黑/科技蓝卡片流) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          <div
            v-for="(lesson, idx) in lessonList"
            :key="lesson.sessionId || idx"
            class="group relative rounded-xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between h-36 bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-blue-900/50 hover:border-st-primary hover:shadow-lg hover:-translate-y-0.5"
            @click="handlePlayCourseware(lesson)"
          >
            <!-- 课次编号 -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-extrabold text-emerald-400 font-mono tracking-wider">
                  {{ String(idx + 1).padStart(2, '0') }}
                </span>
                <span
                  v-if="lesson.pptUrl"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30"
                >
                  在线白板
                </span>
                <span
                  v-else-if="lesson.downloadUrl"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-300"
                >
                  源文件
                </span>
              </div>

              <!-- 课次名称 -->
              <h4 class="text-sm font-bold text-gray-100 group-hover:text-emerald-300 line-clamp-2 transition-colors">
                {{ lesson.sessionName }}
              </h4>
            </div>

            <!-- 底部播放按钮与状态 -->
            <div class="flex items-center justify-between pt-2 border-t border-white/5">
              <span class="text-[11px] text-gray-300 truncate max-w-[130px]">
                {{ lesson.pptFileName ? '含课件PPT' : '授课资料' }}
              </span>

              <div class="w-8 h-8 rounded-full bg-blue-600/40 group-hover:bg-st-primary flex items-center justify-center transition-colors text-white shadow-sm">
                <svg class="w-4 h-4 translate-x-0.5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- 空课件状态 -->
        <div v-if="lessonList.length === 0" class="p-8 text-center bg-gray-50 rounded-lg text-st-secondary text-sm">
          暂无关联课次与课件数据
        </div>
      </div>
    </div>

    <!-- 课件播放弹窗 -->
    <CoursewarePlayerDialog ref="playerRef" />
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { curriculumApi } from '@/api'
import { normalizePlatformLessons } from '@/api/normalizers/curriculum'
import { allCoursewaresData } from '@/constants/platformCourse'
import CoursewarePlayerDialog from './CoursewarePlayerDialog.vue'

interface CourseItem {
  id: number
  courseName: string
  courseNameAlias?: string
  courseCode: string
  courseCover: string
  configCourseSubjectName?: string
  configCourseTypeName?: string
  configCourseGradeName?: string
  planLessonTotal?: number
  createUserName?: string
}

interface LessonItem {
  sessionId: number
  sessionCode: string
  sessionName: string
  pptUrl?: string
  pptFileName?: string
  downloadUrl?: string
  resources?: any[]
}

const visible = ref(false)
const course = ref<CourseItem | null>(null)
const lessonList = ref<LessonItem[]>([])
const playerRef = ref<InstanceType<typeof CoursewarePlayerDialog> | null>(null)

async function open(targetCourse: CourseItem) {
  course.value = targetCourse

  // 优先从服务端数据库读取最新课次与白板课件链接
  try {
    const res = await curriculumApi.getCourseById(targetCourse.courseCode)
    if (res && res.success && res.data) {
      const dbLessons = normalizePlatformLessons(res.data.units || [], targetCourse.courseCode)
      if (dbLessons.length > 0) {
        lessonList.value = dbLessons
        visible.value = true
        return
      }
    }
  } catch (err) {
    console.warn('[PlatformCourseDetailDrawer] 远程课件拉取未就绪，使用本地双轨模式:', err)
  }

  const details = (allCoursewaresData as Record<string, any>)[targetCourse.courseCode]
  if (details && details.lessons) {
    lessonList.value = details.lessons
  } else {
    // 自动按 planLessonTotal 生成标准课次占位
    const total = targetCourse.planLessonTotal || 16
    lessonList.value = Array.from({ length: total }, (_, i) => ({
      sessionId: i + 1,
      sessionCode: `${targetCourse.courseCode}_${i + 1}`,
      sessionName: `第 ${i + 1} 课：${targetCourse.courseName} - 实战应用`,
      pptUrl: '',
      pptFileName: ''
    }))
  }
  visible.value = true
}

function handlePlayCourseware(lesson: LessonItem) {
  if (playerRef.value) {
    playerRef.value.open(lesson)
  }
}

defineExpose({ open })
</script>

<style scoped>
:deep(.el-drawer__body) {
  padding: 20px 24px !important;
  background-color: var(--st-color-bg, #f8fafc);
}
</style>
