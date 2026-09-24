<template>
  <div class="p-4 space-y-4 bg-[#F5F7FA] min-h-[calc(100vh-60px)]">
    <!-- 顶部状态栏与统计信息 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-lg bg-blue-50 text-[#1890FF] flex items-center justify-center font-bold text-lg">
          002599
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="text-base font-bold text-gray-900">拓视未来教育·资源平台课程库</h1>
            <span class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-[#1890FF] font-medium">企业级数据同步</span>
            <span class="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">全量课件互动白板已接入</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            已同步拓视未来教育 118 门精品课程，涵盖 2,029 个随堂课次与互动白板课件，点击课程即可随时调出互动大纲进行在线授课！
          </p>
        </div>
      </div>

      <div class="flex items-center space-x-6 text-sm text-gray-600 bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-100">
        <div>
          <span class="text-gray-400 text-xs block">总课程数</span>
          <span class="text-lg font-bold text-[#1890FF]">{{ totalCourses }}</span> 门
        </div>
        <div class="h-6 w-px bg-gray-200"></div>
        <div>
          <span class="text-gray-400 text-xs block">在线互动课件课次</span>
          <span class="text-lg font-bold text-emerald-600">2,029</span> 节
        </div>
        <div class="h-6 w-px bg-gray-200"></div>
        <div>
          <span class="text-gray-400 text-xs block">涵盖学科科目</span>
          <span class="text-lg font-bold text-gray-800">{{ uniqueSubjects.length }}</span> 个
        </div>
      </div>
    </div>

    <!-- 筛选面板 -->
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100 space-y-3">
      <!-- 快捷科目/类别筛选 -->
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <span class="text-xs font-semibold text-gray-500 w-16">所属学科:</span>
        <button
          @click="selectedSubject = ''"
          :class="[
            'px-2.5 py-1 text-xs rounded-md transition-colors',
            selectedSubject === ''
              ? 'bg-[#1890FF] text-white font-medium'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          全部 ({{ totalCourses }})
        </button>
        <button
          v-for="sub in topSubjects"
          :key="sub.name"
          @click="selectedSubject = sub.name"
          :class="[
            'px-2.5 py-1 text-xs rounded-md transition-colors',
            selectedSubject === sub.name
              ? 'bg-[#1890FF] text-white font-medium'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          {{ sub.name }} ({{ sub.count }})
        </button>
      </div>

      <!-- 输入框与下拉选择搜索 -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <div class="flex flex-wrap items-center gap-3">
          <el-input
            v-model="keyword"
            placeholder="搜索课程名称或别名..."
            prefix-icon="Search"
            size="small"
            clearable
            class="!w-64"
          />

          <el-select
            v-model="selectedType"
            placeholder="课程类型"
            size="small"
            clearable
            class="!w-40"
          >
            <el-option label="全部类型" value="" />
            <el-option
              v-for="t in uniqueTypes"
              :key="t"
              :label="t"
              :value="t"
            />
          </el-select>

          <el-select
            v-model="selectedSubject"
            placeholder="更多学科筛选"
            size="small"
            clearable
            class="!w-48"
          >
            <el-option label="全部学科" value="" />
            <el-option
              v-for="s in uniqueSubjects"
              :key="s"
              :label="s"
              :value="s"
            />
          </el-select>

          <el-button size="small" type="primary" @click="handleFilter">
            查询
          </el-button>
          <el-button size="small" @click="handleReset">
            重置
          </el-button>
        </div>

        <div class="text-xs text-gray-500">
          已筛选出 <span class="font-bold text-[#1890FF]">{{ filteredCourses.length }}</span> 门课程
        </div>
      </div>
    </div>

    <!-- 课程卡片瀑布流网格 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <div
        v-for="course in pagedCourses"
        :key="course.id"
        class="bg-white rounded-lg overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between cursor-pointer"
        @click="openCoursewareDrawer(course)"
      >
        <!-- 封面图 -->
        <div class="relative w-full aspect-[16/9] bg-gray-100 overflow-hidden">
          <img
            :src="course.courseCover"
            :alt="course.courseName"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            @error="handleImgError"
          />
          <!-- 课程类型角标 -->
          <span
            v-if="course.configCourseTypeName"
            class="absolute top-2 left-2 px-2 py-0.5 text-[11px] rounded bg-black/60 text-white backdrop-blur-xs font-medium"
          >
            {{ course.configCourseTypeName }}
          </span>

          <!-- 授权来源 -->
          <span class="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] rounded bg-[#1890FF]/85 text-white font-medium">
            盛通授权
          </span>
        </div>

        <!-- 课程信息主体 -->
        <div class="p-3.5 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-1 mb-1.5">
              <h3 class="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-[#1890FF] transition-colors" :title="course.courseName">
                {{ course.courseName }}
              </h3>
            </div>
            <p v-if="course.courseNameAlias && course.courseNameAlias !== course.courseName" class="text-xs text-gray-400 mb-2 line-clamp-1">
              别名: {{ course.courseNameAlias }}
            </p>

            <div class="flex flex-wrap gap-1 mb-2">
              <span class="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-[#1890FF] border border-blue-100">
                {{ course.configCourseSubjectName || '综合素养' }}
              </span>
              <span v-if="course.planLessonTotal" class="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                {{ course.planLessonTotal }} 课时
              </span>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>创建人: {{ course.createUserName || '教研组' }}</span>
            <el-button
              type="primary"
              size="small"
              class="!text-xs !px-2.5 !py-1"
              @click.stop="openCoursewareDrawer(course)"
            >
              授课课件
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="filteredCourses.length === 0"
      class="bg-white rounded-lg p-12 text-center border border-gray-100 shadow-sm"
    >
      <el-empty description="未找到符合筛选条件的资源课程" />
    </div>

    <!-- 分页器 -->
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center justify-between">
      <span class="text-xs text-gray-500">
        共 {{ filteredCourses.length }} 项数据，当前第 {{ currentPage }} / {{ Math.ceil(filteredCourses.length / pageSize) || 1 }} 页
      </span>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[15, 20, 30, 50]"
        layout="sizes, prev, pager, next, jumper"
        :total="filteredCourses.length"
        size="small"
      />
    </div>

    <!-- 课件与课次详情抽屉 -->
    <PlatformCourseDetailDrawer ref="detailDrawerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import platformData from '@/mocks/shengtongPlatformCourses.json'
import PlatformCourseDetailDrawer from './components/PlatformCourseDetailDrawer.vue'

interface PlatformCourse {
  id: number
  courseName: string
  courseNameAlias?: string
  courseCode: string
  courseCover: string
  configCourseSubjectName: string
  configCourseTypeName: string
  configCourseGradeName?: string
  planLessonTotal: number
  createUserName: string
  companyId: number
}

const courses = ref<PlatformCourse[]>(platformData.list as PlatformCourse[])
const totalCourses = computed(() => courses.value.length)

// 筛选字段
const keyword = ref('')
const selectedSubject = ref('')
const selectedType = ref('')

// 分页字段
const currentPage = ref(1)
const pageSize = ref(20)

// 课件抽屉引用
const detailDrawerRef = ref<InstanceType<typeof PlatformCourseDetailDrawer> | null>(null)

// 提取学科与类型
const uniqueSubjects = computed(() => {
  const set = new Set<string>()
  courses.value.forEach(c => {
    if (c.configCourseSubjectName) set.add(c.configCourseSubjectName)
  })
  return Array.from(set)
})

const topSubjects = computed(() => {
  const map: Record<string, number> = {}
  courses.value.forEach(c => {
    const name = c.configCourseSubjectName || '其他'
    map[name] = (map[name] || 0) + 1
  })
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))
})

const uniqueTypes = computed(() => {
  const set = new Set<string>()
  courses.value.forEach(c => {
    if (c.configCourseTypeName) set.add(c.configCourseTypeName)
  })
  return Array.from(set)
})

// 过滤列表
const filteredCourses = computed(() => {
  return courses.value.filter(c => {
    if (keyword.value) {
      const kw = keyword.value.trim().toLowerCase()
      const matchName = c.courseName?.toLowerCase().includes(kw)
      const matchAlias = c.courseNameAlias?.toLowerCase().includes(kw)
      if (!matchName && !matchAlias) return false
    }
    if (selectedSubject.value && c.configCourseSubjectName !== selectedSubject.value) {
      return false
    }
    if (selectedType.value && c.configCourseTypeName !== selectedType.value) {
      return false
    }
    return true
  })
})

// 分页列表
const pagedCourses = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredCourses.value.slice(start, start + pageSize.value)
})

function handleFilter() {
  currentPage.value = 1
}

function handleReset() {
  keyword.value = ''
  selectedSubject.value = ''
  selectedType.value = ''
  currentPage.value = 1
}

function handleImgError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/resourcePlatform/myCourse/blank_img.png'
}

function openCoursewareDrawer(course: PlatformCourse) {
  if (detailDrawerRef.value) {
    detailDrawerRef.value.open(course)
  }
}
</script>
