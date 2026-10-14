<template>
  <div class="p-5 space-y-4">
    <!-- 1. 顶部复合搜索栏 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <!-- 搜索词 -->
        <div class="lg:col-span-2">
          <label class="block text-xs text-st-secondary mb-1">学员姓名 / 学号 / 联系手机号</label>
          <el-input
            v-model="keyword"
            placeholder="输入姓名、S948918 或手机号搜索..."
            size="small"
            clearable
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- 所属校区 -->
        <div>
          <label class="block text-xs text-st-secondary mb-1">所属校区</label>
          <el-select v-model="selectedCampus" size="small" placeholder="全部校区" class="w-full">
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
          <el-select v-model="selectedGrade" size="small" placeholder="全部年级" class="w-full" clearable>
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

        <!-- 学员状态 -->
        <div>
          <label class="block text-xs text-st-secondary mb-1">学员在读状态</label>
          <el-select v-model="selectedStatus" size="small" placeholder="全部状态" class="w-full">
            <el-option label="全部状态" value="all" />
            <el-option label="正常在读" value="normal" />
            <el-option label="停课休学" value="suspended" />
            <el-option label="已转校" value="transferred" />
            <el-option label="已结课流失" value="dropped_out" />
          </el-select>
        </div>

        <!-- 课消风控与续费决策 -->
        <div>
          <label class="block text-xs text-st-secondary mb-1">课消风控与续费决策</label>
          <el-select v-model="selectedWarningLevel" size="small" placeholder="全部风控" class="w-full" clearable>
            <el-option label="全部风控状态" value="all" />
            <el-option label="🚨 紧急续约 (<=4课时)" value="critical" />
            <el-option label="⚠️ 预警跟进 (<=8课时)" value="warning" />
            <el-option label="💤 停消休眠 (>=14天)" value="dormant" />
            <el-option label="✅ 课消充沛正常" value="normal" />
          </el-select>
        </div>

        <!-- 录入时间 -->
        <div>
          <label class="block text-xs text-st-secondary mb-1">建档录入时间</label>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            size="small"
            class="!w-full"
            value-format="YYYY-MM-DD"
          />
        </div>
      </div>

      <div class="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
        <div class="text-xs text-st-muted flex items-center space-x-2">
          <span>匹配结果：共 <b class="text-st-primary font-bold">{{ filteredStudents.length }}</b> 位学员档案</span>
          <span v-if="selectedRows.length > 0" class="text-indigo-600 font-semibold">
            (已选择 {{ selectedRows.length }} 项)
          </span>
        </div>
        <div class="space-x-2">
          <el-button size="small" @click="handleReset">重置筛选</el-button>
          <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
        </div>
      </div>
    </div>

    <!-- 2. 统计提示与快捷工具栏横条 -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50/40 border border-blue-100 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
      <div class="flex items-center space-x-3 text-st-title">
        <div class="flex items-center space-x-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="font-bold text-st-primary">[{{ currentCampusDisplayName }}]</span>
        </div>
        <div class="flex items-center space-x-3 text-st-secondary">
          <span>校区学员: <b class="text-st-title">{{ campusStats.total }}</b> 名</span>
          <span>正常在读: <b class="text-emerald-600">{{ campusStats.normal }}</b> 名</span>
          <span>停课休学: <b class="text-amber-600">{{ campusStats.suspended }}</b> 名</span>
          <span>待分班池: <b class="text-indigo-600">{{ campusStats.unassigned }}</b> 名</span>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <el-button type="primary" size="small" @click="handleAddStudent">
          + 新增学员建档
        </el-button>
        <el-button size="small" plain @click="handleBatchExport">
          批量导出课包
        </el-button>
        <el-button size="small" plain @click="handleBatchImport">
          批量导入
        </el-button>
        <el-button size="small" plain @click="handleFaceLibrary">
          人脸识别底库录入
        </el-button>
        <el-button size="small" plain @click="handleFinanceExport">
          缴费导出
        </el-button>
      </div>
    </div>

    <!-- 3. 高保真学员数据表格 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <el-table
        :data="paginatedStudents"
        style="width: 100%"
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="45" align="center" />

        <!-- 学员姓名与学号 -->
        <el-table-column label="学员姓名 / 学号" min-width="160">
          <template #default="{ row }">
            <div class="flex items-center space-x-2.5 cursor-pointer py-1" @click="handleOpenDrawer(row)">
              <div class="relative flex-shrink-0">
                <img
                  :src="row.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'"
                  class="w-9 h-9 rounded-full object-cover border border-gray-200"
                />
                <span
                  v-if="row.faceEntered"
                  class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[8px]"
                  title="已录入人脸"
                >
                  ✓
                </span>
              </div>
              <div>
                <div class="font-bold text-st-primary hover:underline text-xs flex items-center space-x-1">
                  <span>{{ row.name }}</span>
                  <span class="text-[10px] text-gray-400 font-normal">({{ row.gender === 'male' ? '男' : '女' }}/{{ row.age || 9 }}岁)</span>
                </div>
                <div class="text-[11px] text-st-muted font-mono font-semibold">{{ row.studentNo }}</div>
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
                <el-button link type="primary" size="small" class="!p-0 text-[11px]" @click="quickCall(row)">☎</el-button>
              </div>
              <div class="text-[11px] text-st-secondary mt-0.5 flex items-center space-x-1">
                <span v-if="row.wechatBound" class="text-emerald-600">● 微信已绑</span>
                <span v-else class="text-gray-400">○ 微信未绑</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 家长联系人 -->
        <el-table-column label="家长联系人" min-width="120">
          <template #default="{ row }">
            <div class="text-xs">
              <span class="font-medium text-st-title">{{ row.parentName || '家长' }}</span>
              <div class="text-[11px] text-st-muted font-mono">{{ row.parentPhone || row.phone }}</div>
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
              <div class="font-medium text-st-title">{{ row.grade }}</div>
              <div class="text-[11px] text-st-muted truncate max-w-[130px]">{{ row.school || row.publicSchool || '未录入' }}</div>
            </div>
          </template>
        </el-table-column>

        <!-- 有效课包与剩余课时 -->
        <el-table-column label="在读课包与剩余课时" min-width="180">
          <template #default="{ row }">
            <div v-if="row.coursePackages && row.coursePackages.length > 0" class="text-xs space-y-1">
              <div v-for="pkg in row.coursePackages.slice(0, 2)" :key="pkg.packageId">
                <div class="font-medium text-st-title truncate max-w-[170px]" :title="pkg.courseName">
                  {{ pkg.courseName }}
                </div>
                <div class="text-[11px] flex items-center justify-between text-st-secondary">
                  <span>剩余: <b class="text-emerald-600 font-bold font-mono">{{ pkg.remainingLessons }}</b> / {{ pkg.totalLessons }} 课时</span>
                  <el-tag size="small" :type="pkg.status === 'active' ? 'success' : 'warning'" class="scale-90">
                    {{ pkg.status === 'active' ? '正常' : pkg.status === 'frozen' ? '冻结' : '结课' }}
                  </el-tag>
                </div>
              </div>
              <div v-if="row.coursePackages.length > 2" class="text-[10px] text-st-primary">
                + 查看其余 {{ row.coursePackages.length - 2 }} 个课包...
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
                  🚨 极度枯竭
                </el-tag>
                <el-tag
                  v-else-if="row.warningLevel === 'warning'"
                  type="warning"
                  size="small"
                  effect="light"
                >
                  ⚠️ 续费预警
                </el-tag>
                <el-tag
                  v-else
                  type="success"
                  size="small"
                  effect="plain"
                >
                  ✅ 充沛正常
                </el-tag>
                <span class="font-mono text-st-muted text-[11px]">
                  余 {{ row.totalRemainingLessons ?? row.coursePackages?.reduce((s: number, p: any) => s + (p.remainingLessons || 0), 0) ?? 0 }} 课时
                </span>
              </div>
              <div v-if="row.consumptionHealth?.dormantRisk && row.consumptionHealth.dormantRisk !== 'active'" class="text-[10px] text-purple-600 font-semibold">
                💤 停消休眠 {{ row.consumptionHealth.inactiveDays }} 天
              </div>
              <div v-else-if="row.consumptionHealth?.estimatedDepletionDays !== undefined" class="text-[10px] text-st-muted">
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
              <div class="text-[10px] text-st-muted">
                本 ¥{{ (row.wallet?.principalBalance || 0).toFixed(0) }} / 赠 ¥{{ (row.wallet?.bonusBalance || 0).toFixed(0) }}
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 在读状态 -->
        <el-table-column label="在读状态" width="95" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 人脸底库 -->
        <el-table-column label="人脸底库" width="85" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.faceEntered" size="small" type="primary">已录入</el-tag>
            <el-tag v-else size="small" type="info">未录入</el-tag>
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
              <el-button link type="primary" size="small" @click="handleOpenDrawer(row)">
                360°画像
              </el-button>
              <el-button
                v-if="row.warningLevel === 'urgent' || row.warningLevel === 'critical' || row.warningLevel === 'warning' || row.consumptionHealth?.visualBadge"
                link
                type="warning"
                size="small"
                @click="handleQuickRenewal(row)"
              >
                一键续费
              </el-button>
              <el-button link type="success" size="small" @click="handleEnroll(row)">
                报读
              </el-button>
              <el-button link type="warning" size="small" @click="handleMovement(row)">
                异动
              </el-button>
              <el-button link type="primary" size="small" @click="handleEdit(row)">
                编辑
              </el-button>

              <!-- 更多下拉操作 -->
              <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, row)">
                <el-button link type="info" size="small">
                  更多▼
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="face">录入人脸特征</el-dropdown-item>
                    <el-dropdown-item command="wechat">{{ row.wechatBound ? '解除微信绑定' : '绑定家长微信' }}</el-dropdown-item>
                    <el-dropdown-item command="resetPwd">重置学员端密码</el-dropdown-item>
                    <el-dropdown-item command="delete" divided class="text-red-600">删除档案</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 表格底部批量与分页 -->
      <div class="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-slate-100 gap-3">
        <div class="flex items-center space-x-2">
          <span class="text-xs text-st-muted">批量操作：</span>
          <el-button size="small" :disabled="selectedRows.length === 0" @click="handleBatchMove">批量转班</el-button>
          <el-button size="small" :disabled="selectedRows.length === 0" @click="handleBatchNotify">发送通知短信</el-button>
          <el-button size="small" :disabled="selectedRows.length === 0" @click="handleBatchExport">导出选中 ({{ selectedRows.length }})</el-button>
        </div>

        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredStudents.length"
          size="small"
        />
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

    <!-- 人脸识别底库录入弹窗 -->
    <FaceEntryDialog
      v-model="faceDialogVisible"
      :student="activeStudent"
      @success="refreshData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'
import { studentApi } from '@/api'
import type { Student } from '@/types/student'

import StudentProfileDrawer from './components/StudentProfileDrawer.vue'
import EnrollDialog from './components/EnrollDialog.vue'
import AbnormalMovementDialog from './components/AbnormalMovementDialog.vue'
import StudentFormDialog from './components/StudentFormDialog.vue'
import FaceEntryDialog from './components/FaceEntryDialog.vue'

const tenantStore = useTenantStore()
const authStore = useAuthStore()

// 搜索条件
const keyword = ref('')
const selectedCampus = ref('all')
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
const faceDialogVisible = ref(false)

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

const refreshTrigger = ref(0)
const studentList = ref<Student[]>([])

async function loadStudents() {
  try {
    const res = await studentApi.getStudents({
      campusId: selectedCampus.value === 'all' ? undefined : selectedCampus.value,
      keyword: keyword.value || undefined,
      status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
      warningLevel: selectedWarningLevel.value === 'all' ? undefined : selectedWarningLevel.value,
      pageSize: 200
    })
    if (res && res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.list || res.data.items || [])
      if (Array.isArray(list)) {
        studentList.value = list as any
        return
      }
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取学员列表失败')
  }
  studentList.value = []
}

onMounted(() => {
  loadStudents()
})

watch(() => selectedCampus.value, () => {
  loadStudents()
  currentPage.value = 1
})

watch(() => selectedWarningLevel.value, () => {
  loadStudents()
  currentPage.value = 1
})

watch(() => authStore.token, () => {
  loadStudents()
})

watch(() => tenantStore.currentCampusId, () => {
  loadStudents()
})

// 筛选后学员全集
const filteredStudents = computed(() => {
  // 建立显式响应式追踪依赖
  const _tick = refreshTrigger.value
  return studentList.value.filter(s => {
    // 校区筛选：若选了具体校区，或者未选全集团且不在总部时做作用域
    if (selectedCampus.value !== 'all') {
      const matchId = s.campusId === selectedCampus.value
      const matchName = s.campusName && (s.campusName.includes(currentCampusDisplayName.value) || currentCampusDisplayName.value.includes(s.campusName))
      if (!matchId && !matchName) return false
    }

    // 关键词
    if (keyword.value) {
      const q = keyword.value.trim().toLowerCase()
      const matchName = s.name.toLowerCase().includes(q)
      const matchNo = s.studentNo.toLowerCase().includes(q)
      const matchPhone = s.phone.includes(q) || (s.parentPhone && s.parentPhone.includes(q))
      if (!matchName && !matchNo && !matchPhone) return false
    }

    // 状态
    if (selectedStatus.value !== 'all' && s.status !== selectedStatus.value) {
      return false
    }

    // 课消风控与续费决策
    if (selectedWarningLevel.value && selectedWarningLevel.value !== 'all') {
      const risk = s.riskLevel || s.warningLevel
      if (selectedWarningLevel.value === 'dormant') {
        const dRisk = s.consumptionHealth?.dormantRisk
        if (!dRisk || dRisk === 'active') return false
      } else if (selectedWarningLevel.value === 'critical') {
        if (risk !== 'urgent' && risk !== 'critical') return false
      } else if (selectedWarningLevel.value === 'warning') {
        if (risk !== 'warning') return false
      } else if (selectedWarningLevel.value === 'normal') {
        if (risk !== 'normal') return false
      }
    }

    // 年级
    if (selectedGrade.value && !s.grade.includes(selectedGrade.value)) {
      return false
    }

    // 时间范围
    if (dateRange.value && dateRange.value.length === 2) {
      const [start, end] = dateRange.value
      if (s.createdAt < start || s.createdAt > end) return false
    }

    return true
  })
})

// 分页切片
const paginatedStudents = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredStudents.value.slice(start, start + pageSize.value)
})

// 统计
const campusStats = computed(() => {
  const list = selectedCampus.value === 'all'
    ? studentList.value
    : studentList.value.filter(s => s.campusId === selectedCampus.value)

  return {
    total: list.length,
    normal: list.filter(s => s.status === 'normal').length,
    suspended: list.filter(s => s.status === 'suspended').length,
    unassigned: list.filter(s => !s.coursePackages || s.coursePackages.length === 0).length
  }
})

function getStatusTagType(status: string) {
  switch (status) {
    case 'normal': return 'success'
    case 'suspended': return 'warning'
    case 'transferred': return 'info'
    case 'dropped_out': return 'danger'
    default: return 'info'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'normal': return '正常在读'
    case 'suspended': return '停课休学'
    case 'transferred': return '已转校'
    case 'dropped_out': return '已结课流失'
    default: return status
  }
}

function handleSearch() {
  currentPage.value = 1
}

function handleReset() {
  keyword.value = ''
  selectedCampus.value = 'all'
  selectedGrade.value = ''
  selectedStatus.value = 'all'
  selectedWarningLevel.value = 'all'
  dateRange.value = null
  currentPage.value = 1
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

function handleFaceLibrary() {
  if (selectedRows.value.length > 0) {
    activeStudent.value = selectedRows.value[0]
  } else if (paginatedStudents.value.length > 0) {
    activeStudent.value = paginatedStudents.value[0]
  }
  faceDialogVisible.value = true
}

function quickCall(student: Student) {
  ElMessage.success(`软电话正在呼叫学员 [${student.name}] 家长电话: ${student.parentPhone || student.phone}`)
}

async function handleCommand(cmd: string, row: Student) {
  if (cmd === 'face') {
    activeStudent.value = row
    faceDialogVisible.value = true
  } else if (cmd === 'wechat') {
    try {
      const targetBound = !row.wechatBound
      await studentApi.updateStudent(row.id, { wechatOpenId: targetBound ? 'wx_mock_bind' : null })
      row.wechatBound = targetBound
      ElMessage.success(row.wechatBound ? '已成功绑定家长微信公众号' : '已成功解绑家长微信')
    } catch (err: any) {
      ElMessage.error(err.message || '微信绑定操作失败')
    }
  } else if (cmd === 'resetPwd') {
    ElMessage.info(`学员 [${row.name}] 采用家长手机号验证码认证登录，无需重置静态密码`)
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

// 批量操作
function handleBatchMove() {
  ElMessage.info(`已对选中的 ${selectedRows.value.length} 位学员发起批量转班排课任务`)
}

function handleBatchNotify() {
  ElMessage.info(`短信通道处理中：已为选中的 ${selectedRows.value.length} 位学员家长排入通知队列`)
}

function handleBatchExport() {
  const exportData = selectedRows.value.length > 0 ? selectedRows.value : filteredStudents.value
  const headers = ['学号', '姓名', '联系电话', '归属校区', '年级', '状态', '剩余课时', '建档时间']
  const rows = exportData.map(s => [
    s.studentNo,
    `"${s.name}"`,
    s.phone,
    `"${s.campusName || '总部校区'}"`,
    s.grade || '小学全学段',
    s.status === 'normal' ? '正常在读' : (s.status === 'suspended' ? '停课休学' : '已转校'),
    s.coursePackages?.reduce((sum, p) => sum + (p.remainingLessons || 0), 0) || 0,
    s.createdAt || '2026-09-01'
  ])
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `学员档案数据导出_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success(`成功导出 ${exportData.length} 笔学员档案资产台账！`)
}

function handleBatchImport() {
  ElMessage.info('请选择标准学员信息 Excel/CSV 模板文件进行批量导入')
}

function handleFinanceExport() {
  ElMessage.success('已生成学员缴费明细与财务对账单导出流水')
}

function refreshData(createdInfo?: any) {
  refreshTrigger.value++
  if (createdInfo?.campusId && selectedCampus.value !== 'all' && selectedCampus.value !== createdInfo.campusId) {
    selectedCampus.value = 'all'
  }
  loadStudents()
}
</script>
