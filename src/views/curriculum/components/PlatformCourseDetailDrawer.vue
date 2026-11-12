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
            <span class="px-2 py-0.5 rounded bg-st-primary/80 text-white text-xs font-semibold">
              {{ course.configCourseTypeName || '标准研发课程' }}
            </span>
            <span class="text-xs text-st-placeholder">
              共 {{ lessonList.length }} 个课次项目
            </span>
          </div>

          <h2 class="text-xl font-bold tracking-wide">
            {{ course.courseName }}
          </h2>
          <p v-if="course.courseNameAlias && course.courseNameAlias !== course.courseName" class="text-xs text-st-placeholder">
            别名: {{ course.courseNameAlias }}
          </p>

          <div class="flex flex-wrap gap-4 text-xs text-gray-200 pt-2 border-t border-white/10">
            <div><span class="text-st-placeholder">学科分类:</span> {{ course.configCourseSubjectName || '综合素养' }}</div>
            <div><span class="text-st-placeholder">适用学段:</span> {{ course.configCourseGradeName || '少儿/青少年' }}</div>
            <div><span class="text-st-placeholder">标准课时:</span> {{ course.planLessonTotal || lessonList.length }} 课时</div>
            <div><span class="text-st-placeholder">主创作者:</span> {{ course.createUserName || '盛通教研总院' }}</div>
          </div>
        </div>
      </div>

      <!-- 课次与课件交互列表 -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <h3 class="text-base font-bold text-st-title">授课大纲与随堂互动课件</h3>
            <span class="px-2 py-0.5 bg-st-primary-light text-st-primary text-xs rounded-full font-medium">
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
                <span class="text-sm font-extrabold text-st-success font-mono tracking-wider">
                  {{ String(idx + 1).padStart(2, '0') }}
                </span>
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="lesson.pptUrl"
                    class="text-xs px-1.5 py-0.5 rounded bg-st-primary/20 text-blue-300 border border-st-primary/30"
                  >
                    在线白板
                  </span>
                  <span
                    v-else-if="lesson.downloadUrl"
                    class="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-st-placeholder"
                  >
                    源文件
                  </span>

                  <!-- 程序下载 (仅阿里云 OSS 托管的初始/完整程序) -->
                  <el-dropdown
                    v-if="getLessonPrograms(lesson).length > 0"
                    trigger="click"
                    @command="handleDownloadProgram"
                    @click.stop
                  >
                    <button
                      type="button"
                      title="下载程序" aria-label="下载程序"
                      class="w-6 h-6 rounded-md bg-white/10 hover:bg-st-primary text-gray-200 hover:text-white flex items-center justify-center transition-colors"
                      @click.stop
                    >
                      <el-icon :size="14"><Download /></el-icon>
                    </button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item
                          v-for="program in getLessonPrograms(lesson)"
                          :key="program.kind"
                          :command="program"
                        >
                          {{ program.label }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>

              <!-- 课次名称 -->
              <h4 class="text-sm font-bold text-gray-100 group-hover:text-emerald-300 line-clamp-2 transition-colors">
                {{ lesson.sessionName }}
              </h4>
            </div>

            <!-- 底部播放按钮与状态 -->
            <div class="flex items-center justify-between pt-2 border-t border-white/5">
              <span class="text-xs text-st-placeholder truncate max-w-[130px]">
                {{ lesson.pptFileName ? '含课件PPT' : '授课资料' }}
              </span>

              <div class="w-8 h-8 rounded-full bg-st-primary/40 group-hover:bg-st-primary flex items-center justify-center transition-colors text-white shadow-sm">
                <svg class="w-4 h-4 translate-x-0.5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- 空课件状态 -->
        <div v-if="lessonList.length === 0" class="p-8 text-center bg-st-header rounded-lg text-st-secondary text-sm">
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
import { Download } from 'lucide-vue-next'
import { curriculumApi } from '@/api'
import { normalizePlatformLessons } from '@/api/normalizers/curriculum'
import { loadPlatformCoursewares } from '@/constants/platformCourse'
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
  resources?: unknown[]
}

type ProgramKind = 'starter' | 'complete'

interface LessonProgram {
  kind: ProgramKind
  label: string
  url: string
}

// 盛通 OSS 归档约定：单片机机器人配套程序统一存放于
// public-prod-shengtong/course/publicMaterial/{机器人名称}预置程序.rsp | {机器人名称}完整程序.rsp
const ROBOT_PROGRAM_BASE_URL = 'https://public-prod-shengtong.oss-cn-zhangjiakou.aliyuncs.com/course/publicMaterial/'

const PROGRAM_FILES: { kind: ProgramKind; suffix: string; label: string }[] = [
  { kind: 'starter', suffix: '预置程序', label: '下载预置程序' },
  { kind: 'complete', suffix: '完整程序', label: '下载完整程序' }
]

const visible = ref(false)
const course = ref<CourseItem | null>(null)
const lessonList = ref<LessonItem[]>([])
const playerRef = ref<InstanceType<typeof CoursewarePlayerDialog> | null>(null)
// 机器人名称 -> OSS 上实际存在的配套程序
const robotPrograms = ref<Record<string, LessonProgram[]>>({})
let programProbeToken = 0

function isAliyunOssUrl(url?: string) {
  if (!url) return false
  try {
    return /\.aliyuncs\.com$/i.test(new URL(url).hostname)
  } catch {
    return false
  }
}

function isOssMicrocontrollerCourse(targetCourse: CourseItem, lessons: LessonItem[]) {
  const isMicrocontroller = [targetCourse.configCourseSubjectName, targetCourse.courseName]
    .some(name => name?.includes('单片机'))
  return isMicrocontroller && lessons.some(l => isAliyunOssUrl(l.downloadUrl))
}

// 课次名前缀（如「选学老鼠机器人」「3.0体验课竞速机器人」）不属于机器人名称
const LESSON_NAME_PREFIX = /^(选学|体验课|体验)/
const OSS_PROBE_RETRIES = 3

// 课次名形如「攀爬机器人（上）」「01-体验初阶-赛车机器人-系统」，取出不含「机器人」的名称主干
function getRobotName(lesson: LessonItem) {
  const core = lesson.sessionName.match(/([一-龥]+)机器人/)?.[1].replace(LESSON_NAME_PREFIX, '')
  return core || null
}

// 404 视为不存在；网络异常重试，避免偶发失败把已有程序判成缺失
async function ossFileExists(url: string) {
  for (let attempt = 0; attempt < OSS_PROBE_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      return res.ok
    } catch {
      // 继续重试
    }
  }
  return false
}

// OSS 上的文件名有「攀爬机器人预置程序.rsp」与「兔子预置程序.rsp」两种写法，
// 同一机器人的两个程序也可能写法不同，因此逐个程序依次尝试
async function findRobotPrograms(robotName: string): Promise<LessonProgram[]> {
  const programs = await Promise.all(PROGRAM_FILES.map(async file => {
    for (const name of [`${robotName}机器人`, robotName]) {
      const url = ROBOT_PROGRAM_BASE_URL + encodeURIComponent(`${name}${file.suffix}.rsp`)
      if (await ossFileExists(url)) return { kind: file.kind, label: file.label, url }
    }
    return null
  }))
  return programs.filter((p): p is LessonProgram => p !== null)
}

async function probeRobotPrograms(targetCourse: CourseItem, lessons: LessonItem[]) {
  const token = ++programProbeToken
  robotPrograms.value = {}
  if (!isOssMicrocontrollerCourse(targetCourse, lessons)) return

  const robotNames = Array.from(new Set(lessons.map(getRobotName).filter((n): n is string => !!n)))
  // 每个机器人查到即显示按钮，不必等整门课全部查完
  await Promise.all(robotNames.map(async name => {
    const programs = await findRobotPrograms(name)
    // 抽屉已切换到其他课程时丢弃过期结果
    if (token !== programProbeToken || programs.length === 0) return
    robotPrograms.value = { ...robotPrograms.value, [name]: programs }
  }))
}

function getLessonPrograms(lesson: LessonItem): LessonProgram[] {
  const robotName = getRobotName(lesson)
  return robotName ? robotPrograms.value[robotName] || [] : []
}

function handleDownloadProgram(program: LessonProgram) {
  // .rsp 以 application/octet-stream 下发，直接导航即触发下载
  const link = document.createElement('a')
  link.href = program.url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

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
        void probeRobotPrograms(targetCourse, dbLessons)
        return
      }
    }
  } catch (err) {
    console.warn('[PlatformCourseDetailDrawer] 远程课件拉取未就绪，使用本地双轨模式:', err)
  }

  const details = await loadPlatformCoursewares(targetCourse.courseCode)
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
  void probeRobotPrograms(targetCourse, lessonList.value)
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
