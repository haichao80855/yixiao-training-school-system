<template>
  <div class="p-5 space-y-4 bg-gray-50 min-h-screen">
    <!-- 顶部标题与指标概要 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-st-border flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-base font-bold text-st-title">实体班级与满班容量控制</h2>
          <el-tag size="small" type="primary">{{ currentCampus.name }}</el-tag>
        </div>
        <p class="text-xs text-st-muted mt-1">管理各校区实体班级开设、班容上限（满班阈值强阻断）、授课讲师与班主任绑定及周期性批量规律排课</p>
      </div>

      <div class="flex items-center space-x-2">
        <el-button @click="showClassroomManageModal = true">
          🏛️ 教室管理
        </el-button>
        <el-button
          type="success"
          plain
          :disabled="selectedRows.length === 0"
          @click="handleBatchScheduleSelected"
        >
          📅 批量排课 {{ selectedRows.length > 0 ? `(已选 ${selectedRows.length} 班)` : '' }}
        </el-button>
        <el-button type="primary" @click="handleCreateClass">
          + 新设教学班级
        </el-button>
      </div>
    </div>

    <!-- 4 大核心教务指标卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">校区班级总数</div>
          <div class="text-2xl font-bold text-st-title mt-1">{{ classStats.totalClasses }} <span class="text-xs font-normal text-st-muted">个</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-blue-50 text-st-primary flex items-center justify-center font-bold text-lg">
          🏫
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">在读学员总规模</div>
          <div class="text-2xl font-bold text-emerald-600 mt-1">{{ classStats.totalStudents }} <span class="text-xs font-normal text-st-muted">人</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
          👥
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">综合满班率</div>
          <div class="text-2xl font-bold text-indigo-600 mt-1">{{ classStats.avgFillRate }}%</div>
        </div>
        <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
          📈
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">秋季在招班级</div>
          <div class="text-2xl font-bold text-amber-600 mt-1">{{ classStats.recruitingClasses }} <span class="text-xs font-normal text-st-muted">个</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
          🎯
        </div>
      </div>
    </div>

    <!-- 搜索与筛选控制栏 -->
    <div class="bg-white rounded-lg p-4 shadow-sm border border-st-border flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <el-input
          v-model="searchQuery"
          placeholder="搜索班级名称 / 编号"
          clearable
          class="!w-64"
          @clear="loadData"
          @keyup.enter="loadData"
        >
          <template #prefix>🔍</template>
        </el-input>

        <el-select v-model="statusFilter" placeholder="班级状态" clearable class="!w-36" @change="loadData">
          <el-option label="全部状态" value="" />
          <el-option label="招生中" value="recruiting" />
          <el-option label="开班中" value="in_progress" />
          <el-option label="已结业" value="completed" />
        </el-select>

        <el-select
          v-model="teacherFilter"
          :placeholder="isDataScopeSelf ? `仅本人 (${currentTeacherName})` : '授课讲师'"
          :disabled="isDataScopeSelf"
          clearable
          class="!w-36"
          @change="loadData"
        >
          <el-option v-if="!isDataScopeSelf" label="全部讲师" value="" />
          <el-option v-for="t in teachers" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>

        <el-button type="primary" @click="loadData">筛选</el-button>
        <el-button @click="handleResetFilters">重置</el-button>
      </div>

      <div class="text-xs text-st-muted flex items-center gap-2">
        <el-tag
          size="small"
          :type="isDataScopeSelf ? 'warning' : 'primary'"
          effect="plain"
          class="font-medium font-mono"
        >
          {{ isDataScopeSelf ? '🔒 仅本人数据 (已锁定只看本人班级)' : (authStore.user?.dataScope === 'all' ? '🌐 全部校区数据透视' : '🏫 本校数据透视') }}
        </el-tag>
        <span v-if="selectedRows.length > 0" class="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          已勾选 {{ selectedRows.length }} 个教学班级
        </span>
        <span>共计 <b>{{ classList.length }}</b> 个教学班级</span>
      </div>
    </div>

    <!-- 班级列表高密度表格 -->
    <div class="bg-white rounded-lg shadow-sm border border-st-border overflow-hidden">
      <el-table
        :data="classList"
        stripe
        border
        size="default"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column prop="code" label="班级编号" width="130">
          <template #default="{ row }">
            <span class="font-mono text-xs text-st-secondary font-semibold">{{ row.code }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="班级名称" min-width="190">
          <template #default="{ row }">
            <div class="cursor-pointer hover:text-st-primary font-bold text-st-title" @click="handleViewDetail(row)">
              {{ row.name }}
            </div>
            <div class="text-[11px] text-st-muted mt-0.5">
              {{ row.scheduleDesc || '每周固定时段' }}
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="courseName" label="所属课程" min-width="170">
          <template #default="{ row }">
            <span class="text-xs text-st-regular">{{ row.courseName }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="teacherName" label="主讲老师" width="105">
          <template #default="{ row }">
            <span class="font-medium text-st-title">👨‍🏫 {{ row.teacherName }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="assistantName" label="班主任" width="100">
          <template #default="{ row }">
            <span class="text-xs text-st-muted">{{ row.assistantName || '张学管' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="classroomName" label="固定教室" width="130">
          <template #default="{ row }">
            <span class="text-xs text-st-secondary truncate">📍 {{ row.classroomName }}</span>
          </template>
        </el-table-column>

        <el-table-column label="开班周期" width="165">
          <template #default="{ row }">
            <span class="font-mono text-xs text-st-muted">{{ row.startDate }} ~ {{ row.endDate }}</span>
          </template>
        </el-table-column>

        <!-- 满班容量进度条与状态标签 -->
        <el-table-column label="在读 / 满班上限" width="160">
          <template #default="{ row }">
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="font-semibold">{{ row.currentStudentCount }} / {{ row.capacity }} 人</span>
                <span :class="row.currentStudentCount >= row.capacity ? 'text-st-danger font-bold' : 'text-st-success'">
                  {{ row.currentStudentCount >= row.capacity ? '已满班' : '可插班' }}
                </span>
              </div>
              <el-progress
                :percentage="Math.min(100, Math.round((row.currentStudentCount / row.capacity) * 100))"
                :status="row.currentStudentCount >= row.capacity ? 'exception' : 'success'"
                :stroke-width="5"
                :show-text="false"
              />
            </div>
          </template>
        </el-table-column>

        <el-table-column label="班级状态" width="105">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <div class="space-x-1">
              <el-button
                v-if="row.status === 'recruiting'"
                link
                type="success"
                size="small"
                @click="handleStartClass(row)"
              >
                开班
              </el-button>
              <el-button
                v-if="row.status === 'in_progress'"
                link
                type="warning"
                size="small"
                @click="handleOpenCompleteModal(row)"
              >
                结课
              </el-button>
              <el-button link type="primary" size="small" @click="handleViewDetail(row)">花名册</el-button>
              <el-button link type="primary" size="small" @click="handleBatchSchedule(row)">排课</el-button>
              <el-button link type="primary" size="small" @click="handleEditClass(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDeleteClass(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 弹窗体系 -->
    <ClassDetailDrawer
      ref="detailDrawerRef"
      @batch-schedule="handleBatchSchedule"
      @complete-class="handleOpenCompleteModal"
      @updated="loadData"
    />

    <BatchScheduleDialog
      ref="batchScheduleRef"
      :campus-id="tenantStore.currentCampusId"
      @success="loadData"
    />

    <ClassFormDialog
      ref="formDialogRef"
      :campus-id="tenantStore.currentCampusId"
      @success="handleClassSaveSuccess"
    />

    <!-- 结课结业与学员安置向导弹窗 -->
    <el-dialog
      v-model="completeModalVisible"
      :title="`班级正常结课与学员处置 - ${activeLifecycleClass?.name || ''}`"
      width="540px"
      class="rounded-xl"
    >
      <div v-loading="previewLoading" class="space-y-4">
        <el-alert
          v-if="lifecyclePreview"
          :title="lifecyclePreview.summary"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            <div class="mt-2 text-xs space-y-1 text-slate-600">
              <div>• 在读学员处置：<b>{{ lifecyclePreview.impact.affectedStudentCount }}</b> 人</div>
              <div>• 将自动撤回释放未来排课：<b>{{ lifecyclePreview.impact.cancelledScheduleCount }}</b> 节</div>
              <div>• 权威锁死保全历史消课考勤：<b>{{ lifecyclePreview.impact.auditedHistoricalAttendanceCount }}</b> 条</div>
            </div>
          </template>
        </el-alert>

        <el-form label-position="top">
          <el-form-item label="在读学员课包安置方案" required>
            <el-radio-group v-model="completeForm.dispositionMode" class="flex flex-col gap-2 !items-start">
              <el-radio label="fallback_unassigned">
                <span class="font-medium text-slate-800">全员回退待分班资产池</span>
                <span class="text-xs text-slate-500 block">保全学员剩余课时，解绑班级外键，学籍自愈为正常在读</span>
              </el-radio>
              <el-radio label="transfer_next_class">
                <span class="font-medium text-slate-800">整班批量升班晋级</span>
                <span class="text-xs text-slate-500 block">原子平移至同校区同课程的进阶后继班级（CAS 班容校验）</span>
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item
            v-if="completeForm.dispositionMode === 'transfer_next_class'"
            label="目标进阶班级"
            required
          >
            <el-select
              v-model="completeForm.targetClassId"
              placeholder="请选择目标班级"
              class="w-full"
              @change="refreshLifecyclePreview"
            >
              <el-option
                v-for="c in targetClassCandidates"
                :key="c.id"
                :label="`${c.name} (余量: ${c.capacity - c.currentStudentCount} 人)`"
                :value="c.id"
                :disabled="c.capacity - c.currentStudentCount < (activeLifecycleClass?.currentStudentCount || 0)"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="结课结业说明备注">
            <el-input
              v-model="completeForm.remark"
              type="textarea"
              :rows="2"
              placeholder="例如：秋季教学计划完成正常结课，学员表现优异"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="completeModalVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="submittingLifecycle"
          :disabled="lifecyclePreview && !lifecyclePreview.allowed"
          @click="handleSubmitCompleteClass"
        >
          确认安全结课
        </el-button>
      </template>
    </el-dialog>

    <!-- 教室管理对话框 -->
    <el-dialog
      v-model="showClassroomManageModal"
      :title="`校区物理教室管理 - ${currentCampus?.name || ''}`"
      width="680px"
      class="rounded-xl"
    >
      <div class="space-y-4">
        <!-- 快速新增教室表单 -->
        <div class="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-1">
            <el-input v-model="newRoomName" placeholder="教室名称（如：人工智能创客室）" size="small" class="!w-48" />
            <el-input-number v-model="newRoomCapacity" :min="1" :max="100" placeholder="容量" size="small" class="!w-24" />
            <el-select v-model="newRoomType" placeholder="类型" size="small" class="!w-32">
              <el-option label="创客实验室" value="maker" />
              <el-option label="编程机房" value="computer" />
              <el-option label="多媒体大班" value="regular" />
              <el-option label="VIP辅导室" value="vip" />
            </el-select>
          </div>
          <el-button type="primary" size="small" @click="handleAddNewRoom">
            + 立即建室
          </el-button>
        </div>

        <!-- 教室列表表格 -->
        <el-table :data="campusClassrooms" size="small" border stripe max-height="360px">
          <el-table-column prop="name" label="教室名称" min-width="140" />
          <el-table-column prop="code" label="教室编码" width="120" />
          <el-table-column prop="typeName" label="类型" width="130" />
          <el-table-column prop="capacity" label="容纳上限" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ row.capacity }}人</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80" align="center">
            <template #default>
              <span class="text-emerald-600 text-xs font-semibold">● 空闲可用</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button size="small" @click="showClassroomManageModal = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'
import { educationalApi } from '@/api'
import type { ClassItem, Classroom } from '@/types/educational'
import ClassDetailDrawer from './components/ClassDetailDrawer.vue'
import BatchScheduleDialog from './components/BatchScheduleDialog.vue'
import ClassFormDialog from './components/ClassFormDialog.vue'

const tenantStore = useTenantStore()
const authStore = useAuthStore()
const currentCampus = computed(() => tenantStore.currentCampus)
const isDataScopeSelf = computed(() => authStore.isDataScopeSelf || authStore.user?.dataScope === 'self')
const currentTeacherId = computed(() => authStore.user?.teacherId || authStore.user?.id || '')
const currentTeacherName = computed(() => authStore.user?.realName || authStore.user?.account || '')

// 教室管理状态
const showClassroomManageModal = ref(false)
const newRoomName = ref('')
const newRoomCapacity = ref(20)
const newRoomType = ref<'maker' | 'computer' | 'regular' | 'vip'>('computer')
const classroomsList = ref<Classroom[]>([])

async function loadClassrooms() {
  try {
    const res = await educationalApi.getClassrooms(tenantStore.currentCampusId)
    if (res && res.data) {
      classroomsList.value = Array.isArray(res.data) ? res.data : []
    }
  } catch (err: any) {
    ElMessage.error(err.message || '加载教室列表失败')
    classroomsList.value = []
  }
}

const campusClassrooms = computed(() => classroomsList.value)

async function handleAddNewRoom() {
  if (!newRoomName.value.trim()) {
    ElMessage.warning('请输入教室名称！')
    return
  }
  try {
    await educationalApi.createClassroom({
      name: newRoomName.value.trim(),
      capacity: newRoomCapacity.value,
      type: newRoomType.value,
      campusId: tenantStore.currentCampusId
    })
    newRoomName.value = ''
    ElMessage.success('教室创建成功并已录入校区资源库！')
    await loadClassrooms()
  } catch (err: any) {
    ElMessage.error(err.message || '创建教室失败')
  }
}

const searchQuery = ref('')
const statusFilter = ref('')
const teacherFilter = ref('')

const classList = ref<ClassItem[]>([])
const teachersList = ref<any[]>([])

async function loadTeachers() {
  try {
    const res = await educationalApi.getTeachers(tenantStore.currentCampusId)
    if (res && res.data) {
      teachersList.value = (Array.isArray(res.data) ? res.data : []).filter((t: any) => t.role === 'teacher')
    }
  } catch (err: any) {
    ElMessage.error(err.message || '加载讲师列表失败')
    teachersList.value = []
  }
}

const teachers = computed(() => teachersList.value)

// 统计指标
const classStats = computed(() => {
  const list = classList.value
  const totalClasses = list.length
  const totalStudents = list.reduce((sum, c) => sum + (c.currentStudentCount || 0), 0)
  const totalCap = list.reduce((sum, c) => sum + (c.capacity || 0), 0)
  const avgFillRate = totalCap > 0 ? Math.round((totalStudents / totalCap) * 100) : 0
  const recruitingClasses = list.filter(c => c.status === 'recruiting').length

  return {
    totalClasses,
    totalStudents,
    avgFillRate,
    recruitingClasses
  }
})

function getStatusTag(status: string) {
  switch (status) {
    case 'in_progress': return 'success'
    case 'recruiting': return 'warning'
    case 'completed': return 'info'
    case 'cancelled': return 'danger'
    case 'archived': return 'info'
    default: return 'primary'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'in_progress': return '开班中'
    case 'recruiting': return '招生中'
    case 'completed': return '已结课'
    case 'cancelled': return '已解散'
    case 'archived': return '已归档'
    default: return '未知'
  }
}

async function loadData() {
  const tId = isDataScopeSelf.value ? currentTeacherId.value : (teacherFilter.value || undefined)
  try {
    const res = await educationalApi.getClasses({
      campusId: tenantStore.currentCampusId,
      status: statusFilter.value || undefined,
      teacherId: tId
    })
    if (res && res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || [])
      if (Array.isArray(list)) {
        classList.value = list as any
        return
      }
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取班级列表失败')
  }

  classList.value = []
}

watch(() => [authStore.user, isDataScopeSelf.value], () => {
  if (isDataScopeSelf.value) {
    teacherFilter.value = currentTeacherId.value
  } else {
    teacherFilter.value = ''
  }
  loadData()
}, { immediate: true })

function handleResetFilters() {
  searchQuery.value = ''
  statusFilter.value = ''
  teacherFilter.value = isDataScopeSelf.value ? currentTeacherId.value : ''
  loadData()
}

function handleClassSaveSuccess() {
  searchQuery.value = ''
  statusFilter.value = ''
  teacherFilter.value = isDataScopeSelf.value ? currentTeacherId.value : ''
  loadData()
}

// 弹窗引用
const detailDrawerRef = ref<InstanceType<typeof ClassDetailDrawer>>()
const batchScheduleRef = ref<InstanceType<typeof BatchScheduleDialog>>()
const formDialogRef = ref<InstanceType<typeof ClassFormDialog>>()

const selectedRows = ref<ClassItem[]>([])

function handleSelectionChange(rows: ClassItem[]) {
  selectedRows.value = rows
}

function handleBatchScheduleSelected() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先在表格中勾选需要批量排课的班级！')
    return
  }
  batchScheduleRef.value?.open(selectedRows.value)
}

function handleViewDetail(cls: ClassItem) {
  detailDrawerRef.value?.open(cls)
}

function handleBatchSchedule(cls: ClassItem) {
  batchScheduleRef.value?.open(cls)
}

function handleCreateClass() {
  formDialogRef.value?.open()
}

function handleEditClass(cls: ClassItem) {
  formDialogRef.value?.open(cls)
}

// ----------------------------------------------------------------------------
// 班级全生命周期操作 (Class Lifecycle Operations)
// ----------------------------------------------------------------------------
const completeModalVisible = ref(false)
const activeLifecycleClass = ref<ClassItem | null>(null)
const previewLoading = ref(false)
const submittingLifecycle = ref(false)
const lifecyclePreview = ref<any>(null)
const completeForm = ref({
  dispositionMode: 'fallback_unassigned' as 'fallback_unassigned' | 'transfer_next_class',
  targetClassId: '',
  remark: '',
})

const targetClassCandidates = computed(() => {
  if (!activeLifecycleClass.value) return []
  return classList.value.filter(
    c => c.id !== activeLifecycleClass.value?.id &&
         c.status !== 'completed' &&
         c.status !== 'cancelled' &&
         c.courseId === activeLifecycleClass.value?.courseId
  )
})

// 1. 立即开班
async function handleStartClass(cls: ClassItem) {
  try {
    await ElMessageBox.confirm(
      `确定为班级「${cls.name}」正式开班吗？开班后在读学员学籍将推进为正式在读。`,
      '立即开班确认',
      { confirmButtonText: '立即开班', cancelButtonText: '取消', type: 'success' }
    )
    const res = await educationalApi.activateClass({ classId: cls.id })
    ElMessage.success(res.data?.message || '开班成功！')
    loadData()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '开班失败')
    }
  }
}

// 2. 打开结课结业弹窗
async function handleOpenCompleteModal(cls: ClassItem) {
  activeLifecycleClass.value = cls
  completeForm.value = {
    dispositionMode: 'fallback_unassigned',
    targetClassId: '',
    remark: '',
  }
  completeModalVisible.value = true
  await refreshLifecyclePreview()
}

async function refreshLifecyclePreview() {
  if (!activeLifecycleClass.value) return
  previewLoading.value = true
  try {
    const res = await educationalApi.previewClassLifecycle(activeLifecycleClass.value.id, {
      action: 'complete',
      disposition: {
        mode: completeForm.value.dispositionMode,
        targetClassId: completeForm.value.targetClassId,
      },
    })
    lifecyclePreview.value = res.data
  } catch (err: any) {
    lifecyclePreview.value = null
  } finally {
    previewLoading.value = false
  }
}

// 3. 提交结课处置
async function handleSubmitCompleteClass() {
  if (!activeLifecycleClass.value) return
  if (completeForm.value.dispositionMode === 'transfer_next_class' && !completeForm.value.targetClassId) {
    ElMessage.warning('请选择升班目标班级！')
    return
  }

  submittingLifecycle.value = true
  try {
    const res = await educationalApi.completeClass({
      classId: activeLifecycleClass.value.id,
      disposition: completeForm.value.dispositionMode === 'transfer_next_class'
        ? { mode: 'transfer_next_class', targetClassId: completeForm.value.targetClassId }
        : { mode: 'fallback_unassigned' },
      remark: completeForm.value.remark,
      cancelFutureSchedules: true,
    })
    ElMessage.success(res.data?.message || '班级结课成功！')
    completeModalVisible.value = false
    loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '结课失败')
  } finally {
    submittingLifecycle.value = false
  }
}

// 4. 安全删除/解散处理
async function handleDeleteClass(cls: ClassItem) {
  try {
    if (cls.currentStudentCount > 0) {
      const confirmAction = await ElMessageBox.confirm(
        `班级【${cls.name}】当前仍有 ${cls.currentStudentCount} 名在读学员，无法直接物理删除！\n\n是否执行【异常解散】，将学员课包安全回退至待分班池并释放未上排课？`,
        '在读学员安全处置提示',
        {
          confirmButtonText: '确认解散班级',
          cancelButtonText: '取消',
          type: 'warning',
          distinguishCancelAndClose: true,
        }
      )
      if (confirmAction === 'confirm') {
        const { value: reason } = await ElMessageBox.prompt(
          '请输入解散原因：',
          '异常解散班级',
          {
            confirmButtonText: '提交解散',
            cancelButtonText: '取消',
            inputPattern: /^.{2,}$/,
            inputErrorMessage: '原因至少填写2个字',
          }
        )
        if (reason) {
          const cancelRes = await educationalApi.cancelClass({ classId: cls.id, reason })
          ElMessage.success(cancelRes.data?.message || '班级解散成功！')
          loadData()
        }
      }
      return
    }

    await ElMessageBox.confirm('确定要删除该班级吗？删除后该班级将从当前校区移除。', '删除确认', {
      type: 'warning',
    })
    await educationalApi.deleteClass(cls.id)
    ElMessage.success('班级删除成功！')
    loadData()
  } catch (err: any) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err.message || '删除班级失败')
    }
  }
}

onMounted(() => {
  loadData()
  loadClassrooms()
  loadTeachers()
})
</script>
