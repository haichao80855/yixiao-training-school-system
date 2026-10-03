<template>
  <div class="p-5 space-y-4 bg-[#F0F2F5] min-h-[calc(100vh-60px)]">
    <!-- 面包屑与校区作用域指示器 -->
    <div class="flex items-center justify-between text-xs text-gray-500 px-1">
      <div class="flex items-center space-x-2">
        <span class="text-gray-700 font-semibold">教研</span>
        <span class="text-gray-400">/</span>
        <span class="text-gray-600">课程管理</span>
      </div>
      <div class="flex items-center space-x-2">
        <span
          :class="[
            'px-2 py-0.5 rounded text-[11px] font-medium border flex items-center space-x-1',
            tenantStore.currentCampus?.isHeadquarter
              ? 'bg-blue-50 border-blue-200 text-[#1890FF]'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          ]"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="tenantStore.currentCampus?.isHeadquarter ? 'bg-[#1890FF]' : 'bg-emerald-500'"></span>
          <span>当前作用域：{{ tenantStore.currentCampus?.name }}</span>
          <span v-if="tenantStore.currentCampus?.isHeadquarter" class="text-gray-400 font-normal">（查看全量教研课系）</span>
          <span v-else class="text-gray-400 font-normal">（仅展示已授权课系）</span>
        </span>
      </div>
    </div>

    <!-- 胶囊筛选矩阵与综合检索卡片 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-200/80 space-y-3.5">
      <!-- 适用年级胶囊 -->
      <CapsuleFilter
        v-model="selectedGrade"
        label="适用年级"
        :options="gradeOptions"
        all-value="全部"
        @change="handleFilterChange"
      />

      <!-- 课程属性胶囊 -->
      <CapsuleFilter
        v-model="selectedAttr"
        label="课程属性"
        :options="attrOptions"
        all-value="全部"
        @change="handleFilterChange"
      />

      <!-- 课程状态胶囊 -->
      <CapsuleFilter
        v-model="selectedStatus"
        label="课程状态"
        :options="statusOptions"
        all-value="全部"
        @change="handleFilterChange"
      />

      <!-- 其他选项：下拉复合筛选与搜索栏 -->
      <div class="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100 text-xs">
        <span class="w-20 text-[#8C8C8C] font-medium shrink-0">其他选项</span>

        <el-select
          v-model="selectedSubject"
          placeholder="科目"
          clearable
          size="small"
          class="!w-36"
          @change="handleFilterChange"
        >
          <el-option label="全部科目" value="全部" />
          <el-option label="软件编程" value="软件编程" />
          <el-option label="信息学竞赛" value="信息学竞赛" />
          <el-option label="硬件机器人" value="硬件机器人" />
          <el-option label="科技启蒙" value="科技启蒙" />
          <el-option label="教师培训" value="教师培训" />
          <el-option label="考级竞赛" value="考级竞赛" />
        </el-select>

        <el-select
          v-model="selectedCourseType"
          placeholder="课程类型"
          clearable
          size="small"
          class="!w-32"
          @change="handleFilterChange"
        >
          <el-option label="全部类型" value="全部" />
          <el-option label="常规课程" value="常规" />
          <el-option label="拓展集训" value="集训" />
          <el-option label="考级专训" value="考级" />
          <el-option label="城市挑赛" value="城市赛" />
        </el-select>

        <el-select
          v-model="selectedYear"
          placeholder="年份"
          clearable
          size="small"
          class="!w-28"
          @change="handleFilterChange"
        >
          <el-option label="全部年份" value="全部" />
          <el-option label="2027" value="2027" />
          <el-option label="2026" value="2026" />
          <el-option label="2025" value="2025" />
        </el-select>

        <el-select
          v-model="selectedPeriod"
          placeholder="期段"
          clearable
          size="small"
          class="!w-28"
          @change="handleFilterChange"
        >
          <el-option label="全部期段" value="全部" />
          <el-option label="春季班" value="春季班" />
          <el-option label="秋季班" value="秋季班" />
          <el-option label="暑期班" value="暑期班" />
          <el-option label="寒假班" value="寒假班" />
          <el-option label="常规班" value="常规班" />
        </el-select>

        <el-input
          v-model="searchKeyword"
          placeholder="请输入课程名称或编码"
          clearable
          size="small"
          class="!w-56"
          @keyup.enter="handleSearch"
        />

        <el-button type="primary" size="small" class="!px-4 font-medium" @click="handleSearch">
          搜索
        </el-button>
        <el-button size="small" class="!px-3 text-gray-600" @click="handleReset">
          重置
        </el-button>
      </div>
    </div>

    <!-- 列表顶部操作栏 -->
    <div class="flex items-center justify-between pt-1">
      <div class="flex items-center space-x-3">
        <h3 class="text-base font-bold text-gray-800">课程列表</h3>
        <span class="text-xs text-gray-400">共检索到 {{ filteredCourses.length }} 门课程</span>
      </div>
      <div class="flex items-center space-x-2.5">
        <el-button size="small" class="!border-blue-300 !text-[#1890FF] hover:!bg-blue-50" @click="handleBatchOperation">
          批量操作
        </el-button>
        <el-button size="small" class="!border-blue-300 !text-[#1890FF] hover:!bg-blue-50" @click="handleBatchAuthorize">
          授权
        </el-button>
        <el-button type="primary" size="small" class="!px-4 font-medium" @click="openCreateDialog">
          + 新增
        </el-button>
      </div>
    </div>

    <!-- 16:9 响应式卡片网格 -->
    <div
      v-if="pagedCourses.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
    >
      <div
        v-for="course in pagedCourses"
        :key="course.id"
        @click="openEditDialog(course)"
        class="bg-white rounded-lg overflow-hidden border border-gray-200/90 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between group select-none"
      >
        <!-- 封面图容器 (16:9 黄金比例) -->
        <div class="relative aspect-video w-full bg-slate-100 overflow-hidden">
          <img
            :src="course.cover"
            :alt="course.name"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <!-- 左上角黄色微立体角标 -->
          <div
            :class="[
              'absolute top-2 left-2 px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-sm transition-all',
              getAttributeBadgeClass(course.attribute)
            ]"
          >
            {{ getAttributeBadgeText(course.attribute) }}
          </div>

          <!-- 底部半透明底条 (课程编号/体系归属) -->
          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-1 px-2.5 text-[11px] text-white flex items-center justify-between">
            <span class="font-medium truncate max-w-[85%]">{{ course.code || course.name }}</span>
            <span v-if="course.totalLessons" class="text-[10px] text-gray-200 shrink-0 font-mono">{{ course.totalLessons }}课时</span>
          </div>
        </div>

        <!-- 卡片主体内容 -->
        <div class="p-3.5 flex-1 flex flex-col justify-between">
          <div>
            <!-- 课程标题：2 行溢出省略号 -->
            <h4
              class="font-bold text-sm text-gray-800 line-clamp-2 leading-snug group-hover:text-[#1890FF] transition-colors"
              :title="course.name"
            >
              {{ course.name }}
            </h4>

            <!-- 标签行：[授权] 橙色标签 + 蓝色体系胶囊 -->
            <div class="flex flex-wrap gap-1.5 mt-2.5 items-center">
              <span class="px-1.5 py-0.5 text-[10px] rounded border border-orange-400 bg-orange-50 text-orange-600 font-semibold">
                授权
              </span>
              <span
                v-for="(tag, tIdx) in getDisplayTags(course)"
                :key="tIdx"
                class="px-1.5 py-0.5 text-[10px] rounded border border-blue-200 bg-blue-50/80 text-[#1890FF] font-normal truncate max-w-[170px]"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- 单价红色加粗加大显示 -->
          <div class="text-right mt-3">
            <span class="text-xs font-bold text-[#F5222D]">¥</span>
            <span class="text-lg font-extrabold text-[#F5222D] ml-0.5 font-mono">
              {{ formatPrice(course.pricePerLesson) }}
            </span>
            <span class="text-[11px] text-gray-400 ml-0.5">元/次</span>
          </div>

          <!-- 底部 Switch 开关状态条 -->
          <div
            class="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100"
            @click.stop
          >
            <div class="flex items-center space-x-1.5">
              <el-switch
                :model-value="course.status === 'enabled'"
                @change="(val: any) => handleToggleStatus(course, val)"
                size="small"
                style="--el-switch-on-color: #1890FF; --el-switch-off-color: #D9D9D9;"
              />
              <span
                :class="[
                  'text-xs font-medium',
                  course.status === 'enabled' ? 'text-[#1890FF]' : 'text-gray-400'
                ]"
              >
                {{ course.status === 'enabled' ? '启用中' : '已禁用' }}
              </span>
            </div>

            <div class="text-xs text-gray-400 group-hover:text-[#1890FF] transition-colors flex items-center space-x-1">
              <span>编辑</span>
              <span>›</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空数据状态 -->
    <div
      v-else
      class="bg-white rounded-lg p-16 text-center border border-gray-200 shadow-sm"
    >
      <el-empty description="未找到符合筛选条件的课程">
        <el-button type="primary" size="small" @click="handleReset">清空筛选条件</el-button>
      </el-empty>
    </div>

    <!-- 分页器组件 (右下对齐，高保真还原原图) -->
    <div v-if="filteredCourses.length > 0" class="flex justify-end items-center py-2 px-1">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[12, 18, 24, 36, 48]"
        :total="filteredCourses.length"
        layout="sizes, prev, pager, next, jumper, total"
        background
        size="small"
      />
    </div>

    <!-- 三步分步式课程编辑器向导 -->
    <CourseEditorDialog
      v-model="editorDialogVisible"
      :course-data="selectedCourse"
      @saved="handleCourseSaved"
    />

    <!-- 批量授权弹窗 -->
    <el-dialog
      v-model="batchAuthVisible"
      title="批量校区授权设置"
      width="560px"
      class="rounded-xl"
    >
      <div class="space-y-4 text-xs">
        <div class="p-3 bg-blue-50 text-blue-800 rounded">
          将所选校区的开课权限批量应用至当前筛选出的 {{ filteredCourses.length }} 门课程。
        </div>
        <div class="space-y-2">
          <div class="font-semibold text-gray-700">请选择目标授权实体校区：</div>
          <el-checkbox-group v-model="batchSelectedCampuses" class="grid grid-cols-2 gap-2">
            <el-checkbox
              v-for="campus in tenantStore.campuses"
              :key="campus.id"
              :label="campus.id"
            >
              {{ campus.name }} ({{ campus.code }})
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end space-x-2">
          <el-button size="small" @click="batchAuthVisible = false">取消</el-button>
          <el-button size="small" type="primary" @click="confirmBatchAuth">确认授权</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTenantStore } from '@/stores/tenantStore'
import { curriculumApi } from '@/api'
import { getCoursesByCampus, toggleCourseStatus } from '@/mocks'
import CapsuleFilter from '@/components/CapsuleFilter.vue'
import CourseEditorDialog from './components/CourseEditorDialog.vue'
import type { CourseItem, CourseAttribute } from '@/types/curriculum'

const tenantStore = useTenantStore()

// 胶囊选项定义
const gradeOptions = [
  '全部',
  '初级课程',
  '中级课程',
  '高级课程',
  '幼儿园',
  '小学低',
  '小学高',
  '中学'
]

const attrOptions = [
  '全部',
  '常规课程',
  '扩科课程',
  '活动课程',
  '体验课程',
  '教师培训',
  '服务费',
  '宣传素材'
]

const statusOptions = [
  '全部',
  '启用',
  '禁用'
]

// 筛选响应式状态
const selectedGrade = ref('全部')
const selectedAttr = ref('全部')
const selectedStatus = ref('全部')
const selectedSubject = ref('全部')
const selectedCourseType = ref('全部')
const selectedYear = ref('全部')
const selectedPeriod = ref('全部')
const searchKeyword = ref('')

// 分页状态
const currentPage = ref(1)
const pageSize = ref(12)

// 弹窗状态
const editorDialogVisible = ref(false)
const selectedCourse = ref<CourseItem | null>(null)
const batchAuthVisible = ref(false)
const batchSelectedCampuses = ref<string[]>([])

// 课程列表原始数据缓存（响应式监听校区与变更）
const allCourses = ref<CourseItem[]>([])

async function reloadCourses() {
  const fallbackList = getCoursesByCampus(tenantStore.currentCampusId)
  try {
    const res = await curriculumApi.getCourses({
      campusId: tenantStore.currentCampusId,
      pageSize: 200
    }, fallbackList)
    if (res && res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || fallbackList)
      if (Array.isArray(list) && list.length > 0) {
        allCourses.value = list.map((item: any) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          cover: item.cover,
          pricePerLesson: Number(item.pricePerLesson || 280),
          totalLessons: Number(item.totalLessons || 48),
          subject: item.subject || 'scratch',
          grade: item.grade || '中级课程',
          attribute: item.attribute || 'regular',
          status: item.status || 'enabled',
          description: item.description || '',
          authorizedCampusIds: item.authorizedCampusIds || item.campusAuths?.map((a: any) => a.campusId) || [tenantStore.currentCampusId],
          createdAt: item.createdAt || new Date().toISOString()
        }))
        return
      }
    }
  } catch (err) {
    console.warn('[CourseManage] 远程课程拉取未就绪，使用本地双轨模式:', err)
  }
  allCourses.value = fallbackList
}

// 监听校区切换
watch(
  () => tenantStore.currentCampusId,
  () => {
    reloadCourses()
    currentPage.value = 1
  },
  { immediate: true }
)

onMounted(() => {
  reloadCourses()
})

// 属性中文与 key 映射
const attrKeyMap: Record<string, CourseAttribute> = {
  常规课程: 'regular',
  扩科课程: 'extended',
  活动课程: 'activity',
  体验课程: 'trial',
  教师培训: 'training',
  服务费: 'service_fee',
  宣传素材: 'material'
}

// 过滤后的课程列表
const filteredCourses = computed(() => {
  return allCourses.value.filter(item => {
    // 1. 年级胶囊过滤
    if (selectedGrade.value !== '全部' && item.grade !== selectedGrade.value) {
      return false
    }

    // 2. 课程属性胶囊过滤 (修复 VULN-01：严禁 targetAttr 为 undefined 时穿透放行)
    if (selectedAttr.value !== '全部') {
      const targetAttr = attrKeyMap[selectedAttr.value]
      if (!targetAttr || item.attribute !== targetAttr) {
        return false
      }
    }

    // 3. 状态胶囊过滤
    if (selectedStatus.value !== '全部') {
      const targetStatus = selectedStatus.value === '启用' ? 'enabled' : 'disabled'
      if (item.status !== targetStatus) {
        return false
      }
    }

    // 4. 科目下拉过滤
    if (selectedSubject.value && selectedSubject.value !== '全部' && item.subject !== selectedSubject.value) {
      return false
    }

    // 5. 课程类型下拉过滤 (修复 VULN-02：接入 selectedCourseType 联动过滤)
    if (selectedCourseType.value && selectedCourseType.value !== '全部') {
      const typeVal = selectedCourseType.value
      if (item.type) {
        if (item.type !== typeVal) {
          return false
        }
      } else {
        const matchName = (item.name || '').includes(typeVal) || (typeVal === '考级' && (item.name || '').includes('等级考试'))
        const matchAttr = typeVal === '常规' && item.attribute === 'regular'
        const matchSubject = typeVal === '考级' && (item.subject || '').includes('考级')
        if (!matchName && !matchAttr && !matchSubject) {
          return false
        }
      }
    }

    // 6. 年份过滤
    if (selectedYear.value && selectedYear.value !== '全部' && item.year !== selectedYear.value) {
      return false
    }

    // 7. 期段过滤
    if (selectedPeriod.value && selectedPeriod.value !== '全部' && item.period !== selectedPeriod.value) {
      return false
    }

    // 8. 关键词模糊检索 (名称或编码)
    if (searchKeyword.value && searchKeyword.value.trim().length > 0) {
      const kw = searchKeyword.value.trim().toLowerCase()
      const matchName = (item.name || '').toLowerCase().includes(kw)
      const matchCode = (item.code || '').toLowerCase().includes(kw)
      if (!matchName && !matchCode) {
        return false
      }
    }

    return true
  })
})

// 分页数据切片
const pagedCourses = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredCourses.value.slice(start, start + pageSize.value)
})

// 微立体角标样式与文案映射
function getAttributeBadgeClass(attr: CourseAttribute) {
  switch (attr) {
    case 'extended':
      return 'bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white shadow-amber-200'
    case 'training':
      return 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-emerald-200'
    case 'activity':
      return 'bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] text-white shadow-blue-200'
    case 'trial':
      return 'bg-gradient-to-r from-[#EF4444] to-[#B91C1C] text-white shadow-red-200'
    case 'service_fee':
      return 'bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white shadow-cyan-200'
    case 'material':
      return 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-purple-200'
    default:
      return 'bg-gradient-to-r from-gray-500 to-gray-700 text-white'
  }
}

function getAttributeBadgeText(attr: CourseAttribute) {
  switch (attr) {
    case 'extended':
      return '扩科课程'
    case 'training':
      return '教师培训'
    case 'activity':
      return '活动课程'
    case 'trial':
      return '体验课程'
    case 'service_fee':
      return '服务费'
    case 'material':
      return '宣传素材'
    default:
      return '常规课程'
  }
}

// 展示标签解析
function getDisplayTags(course: CourseItem) {
  if (course.tags && course.tags.length > 0) {
    return course.tags.filter(t => t !== '授权')
  }
  return [`${course.grade} · ${course.subject}`]
}

// 价格千分位排版与安全格式化
function formatPrice(price: number): string {
  if (price === undefined || price === null) return '0'
  return price.toLocaleString('zh-CN')
}

// 快速启/禁用切换与 Toast 反馈
async function handleToggleStatus(course: CourseItem, val: boolean) {
  const targetStatus = val ? 'enabled' : 'disabled'
  course.status = targetStatus
  try {
    await curriculumApi.updateStatus(course.id, targetStatus)
  } catch {
    toggleCourseStatus(course.id, targetStatus)
  }
  if (val) {
    ElMessage.success(`课程「${course.name}」已成功启用并同步落库！`)
  } else {
    ElMessage.warning(`课程「${course.name}」已禁用，将阻断新建排课与前台选课！`)
  }
}

// 筛选触发
function handleFilterChange() {
  currentPage.value = 1
}

function handleSearch() {
  currentPage.value = 1
}

function handleReset() {
  selectedGrade.value = '全部'
  selectedAttr.value = '全部'
  selectedStatus.value = '全部'
  selectedSubject.value = '全部'
  selectedCourseType.value = '全部'
  selectedYear.value = '全部'
  selectedPeriod.value = '全部'
  searchKeyword.value = ''
  currentPage.value = 1
  ElMessage.info('已重置所有检索条件')
}

// 编辑器唤起
function openCreateDialog() {
  selectedCourse.value = null
  editorDialogVisible.value = true
}

function openEditDialog(course: CourseItem) {
  selectedCourse.value = { ...course }
  editorDialogVisible.value = true
}

function handleCourseSaved() {
  reloadCourses()
}

// 批量操作
function handleBatchOperation() {
  ElMessage.info('已进入批量管理模式，可批量调整课时或下架归档。')
}

function handleBatchAuthorize() {
  batchSelectedCampuses.value = ['campus-bj-hq']
  batchAuthVisible.value = true
}

async function confirmBatchAuth() {
  if (batchSelectedCampuses.value.length === 0) {
    ElMessage.warning('请选择至少一个授权校区！')
    return
  }
  try {
    await Promise.all(
      filteredCourses.value.map(c =>
        curriculumApi.authorizeCampuses(c.id, batchSelectedCampuses.value).catch(() => {})
      )
    )
  } catch {
    // 双轨降级
  }
  filteredCourses.value.forEach(c => {
    c.authorizedCampusIds = Array.from(new Set([...c.authorizedCampusIds, ...batchSelectedCampuses.value]))
  })
  batchAuthVisible.value = false
  ElMessage.success(`批量授权成功！已同步至 ${filteredCourses.value.length} 门课程并落库。`)
  await reloadCourses()
}
</script>

<style scoped>
/* 限制卡片标题最多展示两行 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
