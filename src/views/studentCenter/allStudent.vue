<template>
  <div class="p-5 space-y-4">
    <!-- 1. 顶部胶囊状态快捷筛选 (CapsuleFilter 集成) -->
    <div class="bg-white rounded-lg p-3.5 shadow-card border border-st-border">
      <CapsuleFilter
        v-model="selectedStatus"
        :options="statusCapsuleOptions"
        label="学员状态"
        @update:model-value="handleStatusCapsuleChange"
      />
    </div>

    <!-- 2. 复合搜索栏 (HighDensityGrid 集成) -->
    <HighDensityGrid :cols="8">
      <!-- 搜索词 -->
      <div class="sm:col-span-2">
        <label class="block text-xs text-st-secondary mb-1">学员姓名 / 学号 / 手机</label>
        <el-input
          v-model="keyword"
          placeholder="输入姓名、S948918 或手机号..."
          clearable
          @keyup.enter="handleSearch"
        />
      </div>

      <!-- 所属校区 -->
      <div class="sm:col-span-2">
        <label class="block text-xs text-st-secondary mb-1">所属校区</label>
        <el-select v-model="selectedCampus" placeholder="全部校区" class="w-full">
          <el-option label="全部校区 (全集团)" value="all" />
          <el-option
            v-for="c in tenantStore.campuses"
            :key="c.id"
            :label="c.name"
            :value="c.id"
          />
        </el-select>
      </div>

      <!-- 年级筛选 -->
      <div>
        <label class="block text-xs text-st-secondary mb-1">在读公立年级</label>
        <el-select v-model="selectedGrade" placeholder="全部年级" class="w-full" clearable>
          <el-option label="全部年级" value="" />
          <el-option label="幼儿园大班" value="幼儿园大班" />
          <el-option label="小学一年级" value="小学一年级" />
          <el-option label="小学二年级" value="小学二年级" />
          <el-option label="小学三年级" value="小学三年级" />
          <el-option label="小学四年级" value="小学四年级" />
          <el-option label="小学五年级" value="小学五年级" />
          <el-option label="小学六年级" value="小学六年级" />
          <el-option label="初中一年级" value="初中一年级" />
          <el-option label="初中二年级" value="初中二年级" />
        </el-select>
      </div>

      <!-- 课消风控与续费决策 -->
      <div>
        <label class="block text-xs text-st-secondary mb-1">课消风控与续约</label>
        <el-select v-model="selectedWarningLevel" placeholder="全部风控" class="w-full" clearable>
          <el-option label="全部风控状态" value="all" />
          <el-option label="紧急续约 (<=4课时)" value="critical" />
          <el-option label="预警跟进 (<=8课时)" value="warning" />
          <el-option label="停消休眠 (>=14天)" value="dormant" />
          <el-option label="课消充沛正常" value="normal" />
        </el-select>
      </div>

      <!-- 录入时间 -->
      <div class="sm:col-span-2">
        <label class="block text-xs text-st-secondary mb-1">建档录入时间</label>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          class="!w-full"
          value-format="YYYY-MM-DD"
        />
      </div>

      <!-- 底部操作与统计联动 -->
      <template #footer>
        <div class="text-xs text-st-muted flex items-center space-x-2">
          <span>匹配结果：共 <b class="text-st-primary font-bold">{{ totalCount }}</b> 位学员档案</span>
          <span v-if="selectedRows.length > 0" class="text-st-primary font-semibold">
            (已勾选 {{ selectedRows.length }} 项)
          </span>
        </div>
        <div class="space-x-2">
          <el-button @click="handleReset">重置筛选</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </template>
    </HighDensityGrid>

    <!-- 3. 数据小计与操作栏 (SummaryStrip 集成) -->
    <SummaryStrip
      :total-count="totalCount"
      unit="名学员"
      :summary-text="`当前校区学员：共计 ${campusStats.total} 名，其中正常在读 ${campusStats.normal} 名，未报读 ${campusStats.notEnrolled} 名，停课休学 ${campusStats.suspended} 名，待分班 ${campusStats.unassigned} 名`"
    >
      <template #right>
        <el-button type="primary" @click="handleAddStudent">
          + 新增学员建档
        </el-button>
        <el-button plain :loading="exporting" @click="handleExportFiltered">
          导出学员
        </el-button>
      </template>
    </SummaryStrip>

    <!-- 3. 高保真学员数据表格 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <div class="overflow-x-auto w-full min-w-0">
        <el-table
          v-loading="loading"
          :data="studentList"
          style="width: 100%"
          stripe
          @selection-change="handleSelectionChange"
        >
          <template #empty>
            <AppEmpty
              :type="keyword || selectedStatus !== 'all' ? 'search' : 'data'"
              :action-text="keyword || selectedStatus !== 'all' ? '重置筛选条件' : '新增学员建档'"
              @action="keyword || selectedStatus !== 'all' ? handleReset() : handleAddStudent()"
            />
          </template>

          <el-table-column type="selection" width="45" align="center" />

          <!-- 学员姓名与学号 -->
          <el-table-column label="学员姓名 / 学号" min-width="160">
            <template #default="{ row }">
              <div class="flex items-center space-x-2.5 cursor-pointer py-1" @click="handleOpenDrawer(row as any)">
                <StudentAvatar :seed="row.id" :name="row.name" :gender="row.gender" :size="36" />
                <div>
                  <div class="font-bold text-st-primary hover:underline text-xs flex items-center space-x-1">
                    <span>{{ row.name }}</span>
                    <span class="text-xs text-st-secondary font-normal">({{ row.gender === 'male' ? '男' : '女' }}{{ row.age ? `/${row.age}岁` : '' }})</span>
                  </div>
                  <div class="text-xs text-st-muted font-mono font-semibold">{{ row.studentNo }}</div>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 联系电话与微信号 -->
          <el-table-column label="联系电话 / 微信" min-width="140">
            <template #default="{ row }">
              <div class="text-xs">
                <div class="font-mono flex items-center space-x-1">
                  <span>{{ row.phone }}</span>
                  <a
                    v-if="row.parentPhone || row.phone"
                    :href="`tel:${row.parentPhone || row.phone}`"
                    class="inline-flex text-st-primary hover:text-st-primary-hover"
                    title="拨打家长电话"
                    aria-label="拨打家长电话"
                  >
                    <Phone class="w-4 h-4 ml-0.5" />
                  </a>
                </div>
                <div class="text-xs text-st-secondary mt-0.5 flex items-center space-x-1">
                  <span v-if="row.wechatBound" class="text-st-success">● 微信已绑</span>
                  <span v-else class="text-st-secondary">○ 微信未绑</span>
                </div>
              </div>
            </template>
          </el-table-column>

        <!-- 家长联系人 -->
        <el-table-column label="家长联系人" min-width="120">
          <template #default="{ row }">
            <div class="text-xs">
              <span class="font-medium text-st-title">{{ row.parentName || '家长' }}</span>
              <div class="text-xs text-st-muted font-mono">{{ row.parentPhone || row.phone }}</div>
            </div>
          </template>
        </el-table-column>

        <!-- 归属校区 -->
        <el-table-column label="归属校区" min-width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" type="info">
              {{ row.campusName }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 学校与公立年级 -->
        <el-table-column label="公立学校与年级" min-width="150">
          <template #default="{ row }">
            <div class="text-xs">
              <div class="font-medium text-st-title">{{ row.grade || '年级未录入' }}</div>
              <div class="text-xs text-st-muted truncate max-w-[130px]">{{ row.school || row.publicSchool || '未录入' }}</div>
            </div>
          </template>
        </el-table-column>

        <!-- 有效课包与剩余课时 -->
        <el-table-column label="在读课包与剩余课时" min-width="180">
          <template #default="{ row }">
            <div v-if="groupCoursePackages(row.coursePackages).length > 0" class="text-xs space-y-1">
              <div v-for="g in groupCoursePackages(row.coursePackages).slice(0, 2)" :key="g.key">
                <div
                  class="font-medium text-st-title truncate max-w-[170px]"
                  :title="g.classNames ? `${g.courseName} · ${g.classNames}` : g.courseName"
                >
                  {{ g.courseName }}
                </div>
                <div
                  class="text-xs text-st-muted truncate max-w-[170px]"
                  :title="[g.classNames, g.hasUnassigned ? '含待分班课包' : '', g.packageCount > 1 ? `${g.packageCount} 个课包` : ''].filter(Boolean).join(' · ')"
                >
                  <span v-if="g.packageCount > 1">{{ g.packageCount }} 个课包 · </span>
                  <span v-if="g.classNames">{{ g.classNames }}</span>
                  <span v-if="g.hasUnassigned" class="text-st-warning">{{ g.classNames ? ' · 含待分班' : '待分班' }}</span>
                </div>
                <div class="text-xs flex items-center justify-between text-st-secondary">
                  <span>剩余: <b class="text-st-success font-bold font-mono">{{ g.remainingLessons }}</b> / {{ g.totalLessons }} 课时</span>
                  <el-tag size="small" :type="g.status === 'active' ? 'success' : 'warning'" class="scale-90">
                    {{ g.status === 'active' ? '正常' : g.status === 'frozen' ? '冻结' : '结课' }}
                  </el-tag>
                </div>
              </div>
              <div v-if="groupCoursePackages(row.coursePackages).length > 2" class="text-xs text-st-primary">
                + 查看其余 {{ groupCoursePackages(row.coursePackages).length - 2 }} 门课程...
              </div>
            </div>
            <span v-else class="text-xs text-st-muted">暂无有效课包</span>
          </template>
        </el-table-column>

        <!-- 课消风控与续费决策 -->
        <el-table-column label="课消风控 / 续约建议" min-width="160">
          <template #default="{ row }">
            <div class="text-xs space-y-1">
              <div class="flex items-center space-x-1.5">
                <el-tag
                  v-if="row.warningLevel === 'urgent' || row.warningLevel === 'critical'"
                  type="danger"
                  size="small"
                  effect="dark"
                >
                  极度枯竭
                </el-tag>
                <el-tag
                  v-else-if="row.warningLevel === 'warning'"
                  type="warning"
                  size="small"
                  effect="light"
                >
                  续费预警
                </el-tag>
                <!-- 无在读课时（仅有已退费/冻结课包或尚未购课）：不参与预警，但绝不能显示「充沛」 -->
                <el-tag
                  v-else-if="remainingOf(row) <= 0"
                  type="info"
                  size="small"
                  effect="plain"
                >
                  无可用课时
                </el-tag>
                <el-tag
                  v-else
                  type="success"
                  size="small"
                  effect="plain"
                >
                  充沛正常
                </el-tag>
                <span class="font-mono text-st-muted text-xs">
                  余 {{ remainingOf(row) }} 课时
                </span>
              </div>
              <div v-if="row.consumptionHealth?.dormantRisk && row.consumptionHealth.dormantRisk !== 'active'" class="text-xs text-st-purple font-semibold">
                停消休眠 {{ typeof row.consumptionHealth.inactiveDays === 'number' ? `${row.consumptionHealth.inactiveDays} 天` : '超 14 天' }}
              </div>
              <div v-else-if="typeof row.consumptionHealth?.estimatedDepletionDays === 'number' && remainingOf(row) > 0" class="text-xs text-st-muted">
                预计 {{ row.consumptionHealth.estimatedDepletionDays }} 天后课时耗尽
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 电子钱包余额 -->
        <el-table-column label="电子钱包余额" width="120" align="right">
          <template #default="{ row }">
            <div class="text-xs">
              <div class="font-mono font-bold text-st-danger-deep">
                ¥ {{ ((row.wallet?.principalBalance || 0) + (row.wallet?.bonusBalance || 0)).toFixed(2) }}
              </div>
              <div class="text-xs text-st-muted">
                本 ¥{{ (row.wallet?.principalBalance || 0).toFixed(0) }} / 赠 ¥{{ (row.wallet?.bonusBalance || 0).toFixed(0) }}
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 在读状态 -->
        <el-table-column label="在读状态" width="95" align="center">
          <template #default="{ row }">
            <el-tag :type="getStudentStatusTagType(row)" size="small" :effect="resolveStudentStatus(row) === 'not_enrolled' ? 'plain' : 'light'">
              {{ getStudentStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 建档时间 -->
        <el-table-column prop="createdAt" label="建档时间" width="105">
          <template #default="{ row }">
            <span class="text-xs text-st-muted font-mono">{{ row.createdAt }}</span>
          </template>
        </el-table-column>

        <!-- 操作栏 -->
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="flex items-center space-x-1.5">
              <el-button link type="primary" size="small" @click="handleOpenDrawer(row as any)">
                360°画像
              </el-button>
              <el-button
                v-if="row.warningLevel === 'urgent' || row.warningLevel === 'critical' || row.warningLevel === 'warning' || row.consumptionHealth?.visualBadge"
                link
                type="warning"
                size="small"
                @click="handleQuickRenewal(row as any)"
              >
                一键续费
              </el-button>
              <el-button link type="success" size="small" @click="handleEnroll(row as any)">
                报读
              </el-button>
              <el-button link type="warning" size="small" @click="handleMovement(row as any)">
                异动
              </el-button>
              <el-button link type="primary" size="small" @click="handleEdit(row as any)">
                编辑
              </el-button>

              <!-- 更多下拉操作 -->
              <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, row as any)">
                <el-button link type="info" size="small">
                  更多▼
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="row.wechatBound" command="wechat">解除微信绑定</el-dropdown-item>
                    <el-dropdown-item command="delete" :divided="!!row.wechatBound" class="text-st-danger">删除档案</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 表格底部批量与分页 -->
      <div class="mt-4 pt-4 border-t border-st-divider">
        <AppPagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalCount"
        >
          <template #left>
            <div class="flex items-center space-x-2">
              <span class="text-xs text-st-muted">批量操作：</span>
              <el-button :disabled="selectedRows.length === 0" @click="handleExportSelected">导出选中 ({{ selectedRows.length }})</el-button>
            </div>
          </template>
        </AppPagination>
      </div>
    </div>

    <!-- 弹窗体系 -->
    <!-- 360° 学员全景画像抽屉 -->
    <StudentProfileDrawer
      v-model="drawerVisible"
      :student="activeStudent"
      @open-enroll="handleEnroll"
      @open-movement="handleMovement"
      @updated="refreshData"
    />

    <!-- 学员报读开单弹窗 -->
    <EnrollDialog
      v-model="enrollDialogVisible"
      :student="activeStudent"
      :renewal-draft="activeRenewalDraft"
      @success="refreshData"
    />

    <!-- 7 种异常状态流转弹窗 -->
    <AbnormalMovementDialog
      v-model="movementDialogVisible"
      :student="activeStudent"
      @success="refreshData"
    />

    <!-- 新增 / 编辑学员建档弹窗 -->
    <StudentFormDialog
      v-model="formDialogVisible"
      :student="formStudent"
      @success="refreshData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Phone } from 'lucide-vue-next'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'
import { studentApi } from '@/api'
import { groupCoursePackages } from '@/utils/coursePackageGroups'
import { downloadCsv, todayStamp, type CsvColumn } from '@/utils/csvExport'
import AppPagination from '@/components/AppPagination.vue'
import CapsuleFilter from '@/components/CapsuleFilter.vue'
import SummaryStrip from '@/components/SummaryStrip.vue'
import HighDensityGrid from '@/components/HighDensityGrid.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import type { Student } from '@/types/student'

import StudentProfileDrawer from './components/StudentProfileDrawer.vue'
import EnrollDialog from './components/EnrollDialog.vue'
import AbnormalMovementDialog from './components/AbnormalMovementDialog.vue'
import StudentFormDialog from './components/StudentFormDialog.vue'
import StudentAvatar from '@/components/StudentAvatar.vue'
import { resolveStudentStatus, getStudentStatusLabel, getStudentStatusTagType } from '@/utils/studentStatus'

const tenantStore = useTenantStore()
const authStore = useAuthStore()

// 胶囊快捷状态筛选选项
const statusCapsuleOptions = [
  { label: '全部状态', value: 'all' },
  { label: '未报读', value: 'not_enrolled' },
  { label: '正常在读', value: 'normal' },
  { label: '停课休学', value: 'suspended' },
  { label: '已转校', value: 'transferred' },
  { label: '已结课流失', value: 'dropped_out' }
]

function handleStatusCapsuleChange(val: string) {
  // 回到第 1 页并重新查询由筛选条件的 watch 统一处理
  selectedStatus.value = val
}

const loading = ref(false)

// 搜索条件
const keyword = ref('')
// 默认跟随顶部当前校区（与控制台看板、待分班池同一校区口径），可手动切换「全部校区」
const selectedCampus = ref(tenantStore.currentCampusId || 'all')
const selectedGrade = ref('')
const selectedStatus = ref('all')
const selectedWarningLevel = ref('all')
const dateRange = ref<[string, string] | null>(null)

// 分页
const currentPage = ref(1)
const pageSize = ref(10)
const selectedRows = ref<Student[]>([])

// 弹窗状态
const drawerVisible = ref(false)
const enrollDialogVisible = ref(false)
const movementDialogVisible = ref(false)
const formDialogVisible = ref(false)

const activeStudent = ref<Student | null>(null)
const activeRenewalDraft = ref<any>(null)
const formStudent = ref<Student | null>(null)

// 校区标题展示
const currentCampusDisplayName = computed(() => {
  if (selectedCampus.value === 'all') {
    return `全集团 · 当前工作校区: ${tenantStore.currentCampus.name}`
  }
  const c = tenantStore.campuses.find(x => x.id === selectedCampus.value)
  return c ? c.name : tenantStore.currentCampus.name
})

// 当前页学员 (翻页、搜索、筛选都交给后端，避免一次拉全部学员后在前端切片)
const studentList = ref<Student[]>([])
const totalCount = ref(0)

// 顶部统计按所选校区由后端计数，不受列表筛选与翻页影响
const campusStats = ref({ total: 0, normal: 0, notEnrolled: 0, suspended: 0, unassigned: 0 })

let listRequestSeq = 0
let appliedKeyword = ''

async function loadStudents() {
  const seq = ++listRequestSeq
  loading.value = true
  appliedKeyword = keyword.value.trim()
  const [createdFrom, createdTo] = dateRange.value && dateRange.value.length === 2 ? dateRange.value : [undefined, undefined]
  try {
    const res = await studentApi.getStudents({
      page: currentPage.value,
      pageSize: pageSize.value,
      campusId: selectedCampus.value,
      keyword: appliedKeyword || undefined,
      status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
      warningLevel: selectedWarningLevel.value && selectedWarningLevel.value !== 'all' ? selectedWarningLevel.value : undefined,
      grade: selectedGrade.value || undefined,
      createdFrom,
      createdTo,
    })
    // 只采用最后一次请求的结果，避免快速切换筛选时旧响应覆盖新结果
    if (seq !== listRequestSeq) return
    const data: any = res?.data
    const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
    studentList.value = Array.isArray(list) ? (list as any) : []
    totalCount.value = Number(Array.isArray(data) ? list.length : (data?.total ?? studentList.value.length))
  } catch (err: any) {
    if (seq !== listRequestSeq) return
    ElMessage.error(err.message || '获取学员列表失败')
    studentList.value = []
    totalCount.value = 0
  } finally {
    if (seq === listRequestSeq) loading.value = false
  }
}

// 在读课包剩余课时合计（与列表「余 X 课时」同一口径）
function remainingOf(row: any): number {
  return Number(row.totalRemainingLessons ?? row.coursePackages?.reduce((s: number, p: any) => s + (p.remainingLessons || 0), 0) ?? 0)
}

async function loadStats() {
  try {
    const res = await studentApi.getStudentStats({ campusId: selectedCampus.value })
    if (res?.data) campusStats.value = { ...campusStats.value, ...res.data }
  } catch (err) {
    console.warn('[allStudent] 学员统计加载失败', err)
  }
}

onMounted(() => {
  loadStudents()
  loadStats()
})

// 同一轮里多个条件一起变化 (如重置筛选、改条件同时回到第 1 页) 只发一次请求
let loadQueued = false
function queueLoad() {
  if (loadQueued) return
  loadQueued = true
  nextTick(() => {
    loadQueued = false
    loadStudents()
  })
}

// 筛选条件变化：回到第 1 页再查询
function reloadFromFirstPage() {
  currentPage.value = 1
  queueLoad()
}

watch([selectedCampus, selectedStatus, selectedWarningLevel, selectedGrade, dateRange], reloadFromFirstPage)
watch(selectedCampus, loadStats)
watch([currentPage, pageSize], queueLoad)

// 关键词输入 300ms 防抖；回车 / 点「查询」立即查询
let keywordTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, () => {
  clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    if (keyword.value.trim() !== appliedKeyword) reloadFromFirstPage()
  }, 300)
})
onBeforeUnmount(() => clearTimeout(keywordTimer))

watch(() => authStore.token, () => {
  loadStudents()
  loadStats()
})

// 切换校区时 MainLayout 会按校区重建整个页面并重新加载，不再在页面里重复监听校区

function handleSearch() {
  clearTimeout(keywordTimer)
  reloadFromFirstPage()
}

function handleReset() {
  keyword.value = ''
  selectedCampus.value = tenantStore.currentCampusId || 'all'
  selectedGrade.value = ''
  selectedStatus.value = 'all'
  selectedWarningLevel.value = 'all'
  dateRange.value = null
  // 回到第 1 页并重新查询由筛选条件的 watch 统一处理；条件本来就是默认值时手动刷新一次
  clearTimeout(keywordTimer)
  reloadFromFirstPage()
}

function handleSelectionChange(val: Student[]) {
  selectedRows.value = val
}

// 弹窗打开方法
function handleOpenDrawer(student: Student) {
  activeStudent.value = student
  drawerVisible.value = true
}

function handleEnroll(student?: Student) {
  activeRenewalDraft.value = null
  activeStudent.value = student || null
  enrollDialogVisible.value = true
}

async function handleQuickRenewal(student: Student) {
  try {
    const res = await studentApi.createRenewalOrderDraft(student.id)
    if (res && res.data) {
      activeRenewalDraft.value = res.data
      activeStudent.value = student
      enrollDialogVisible.value = true
      ElMessage.success(`已为学员 [${student.name}] 生成智能续费草案，原课包单价与优惠已锁定`)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '生成续费草案失败')
  }
}

function handleMovement(student: Student) {
  activeStudent.value = student
  movementDialogVisible.value = true
}

function handleAddStudent() {
  formStudent.value = null
  formDialogVisible.value = true
}

function handleEdit(student: Student) {
  formStudent.value = student
  formDialogVisible.value = true
}

async function handleCommand(cmd: string, row: Student) {
  if (cmd === 'wechat') {
    try {
      await ElMessageBox.confirm(`确认解除学员 [${row.name}] 的家长微信绑定？`, '解除微信绑定', {
        type: 'warning',
        confirmButtonText: '解除绑定',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
    try {
      await studentApi.updateStudent(row.id, { wechatOpenId: null })
      row.wechatBound = false
      ElMessage.success('已解除家长微信绑定')
    } catch (err: any) {
      ElMessage.error(err.message || '解除微信绑定失败')
    }
  } else if (cmd === 'delete') {
    ElMessageBox.confirm(`确认删除学员 [${row.name}] (${row.studentNo}) 的档案？删除后将彻底清理该学员及其关联的所有测试课包与订单！`, '警示', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    }).then(async () => {
      try {
        await studentApi.deleteStudent(row.id)
        ElMessage.success('学员档案已从数据库彻底删除！')
        await loadStudents()
      } catch (apiErr: any) {
        ElMessage.error(apiErr.message || '删除失败')
      }
    }).catch(() => {
      // 确认弹窗取消，无需操作
    })
  }
}

// 导出：选中的学员，或按当前筛选条件分批拉取全部学员
const EXPORT_PAGE_SIZE = 500
const exporting = ref(false)

const studentExportColumns: CsvColumn<Student>[] = [
  { title: '学号', value: (s) => s.studentNo },
  { title: '姓名', value: (s) => s.name },
  { title: '联系电话', value: (s) => s.phone },
  { title: '家长电话', value: (s) => s.parentPhone },
  { title: '归属校区', value: (s) => s.campusName },
  { title: '年级', value: (s) => s.grade },
  { title: '状态', value: (s) => getStudentStatusLabel(s) },
  { title: '剩余课时', value: (s) => remainingOf(s) },
  { title: '建档时间', value: (s) => (s.createdAt || '').slice(0, 10) },
]

function handleExportSelected() {
  if (selectedRows.value.length === 0) return
  downloadCsv(`学员档案-选中${selectedRows.value.length}人-${todayStamp()}`, studentExportColumns, selectedRows.value)
  ElMessage.success(`已导出 ${selectedRows.value.length} 名学员`)
}

async function handleExportFiltered() {
  if (exporting.value) return
  exporting.value = true
  const [createdFrom, createdTo] = dateRange.value && dateRange.value.length === 2 ? dateRange.value : [undefined, undefined]
  try {
    const all: Student[] = []
    for (let page = 1; ; page++) {
      const res = await studentApi.getStudents({
        page,
        pageSize: EXPORT_PAGE_SIZE,
        campusId: selectedCampus.value,
        keyword: keyword.value.trim() || undefined,
        status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
        warningLevel: selectedWarningLevel.value && selectedWarningLevel.value !== 'all' ? selectedWarningLevel.value : undefined,
        grade: selectedGrade.value || undefined,
        createdFrom,
        createdTo,
      })
      const data: any = res?.data
      const list: Student[] = Array.isArray(data) ? data : (data?.list || data?.items || [])
      all.push(...list)
      const total = Number(Array.isArray(data) ? list.length : (data?.total ?? all.length))
      if (list.length < EXPORT_PAGE_SIZE || all.length >= total) break
    }
    if (all.length === 0) {
      ElMessage.info('当前筛选条件下没有学员')
      return
    }
    downloadCsv(`学员档案-${todayStamp()}`, studentExportColumns, all)
    ElMessage.success(`已导出 ${all.length} 名学员`)
  } catch (err: any) {
    ElMessage.error(err.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

function refreshData(createdInfo?: any) {
  loadStats()
  if (createdInfo?.campusId && selectedCampus.value !== 'all' && selectedCampus.value !== createdInfo.campusId) {
    selectedCampus.value = 'all'
  }
  loadStudents()
}
</script>
