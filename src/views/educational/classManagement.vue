<template>
  <div class="p-5 space-y-4 bg-st-header min-h-screen">
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
          <template #icon><Building2 class="w-4 h-4" /></template>
          教室管理
        </el-button>
        <el-button
          type="success"
          plain
          :disabled="selectedRows.length === 0"
          @click="handleBatchScheduleSelected"
        >
          <template #icon><Calendar class="w-4 h-4" /></template>
          批量排课 {{ selectedRows.length > 0 ? `(已选 ${selectedRows.length} 班)` : '' }}
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
        <div class="w-10 h-10 rounded-full bg-st-primary-light text-st-primary flex items-center justify-center font-bold">
          <Building2 class="w-5 h-5 text-st-primary" />
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">在读学员总规模</div>
          <div class="text-2xl font-bold text-st-success mt-1">{{ classStats.totalStudents }} <span class="text-xs font-normal text-st-muted">人</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-st-success-light text-st-success flex items-center justify-center font-bold">
          <Users class="w-5 h-5 text-st-success" />
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">综合满班率</div>
          <div class="text-2xl font-bold text-st-primary mt-1">{{ classStats.avgFillRate }}%</div>
        </div>
        <div class="w-10 h-10 rounded-full bg-st-primary-light text-st-primary flex items-center justify-center font-bold">
          <TrendingUp class="w-5 h-5 text-st-primary" />
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">秋季在招班级</div>
          <div class="text-2xl font-bold text-st-warning mt-1">{{ classStats.recruitingClasses }} <span class="text-xs font-normal text-st-muted">个</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-st-warning-light text-st-warning flex items-center justify-center font-bold">
          <Target class="w-5 h-5 text-st-warning" />
        </div>
      </div>
    </div>

    <!-- 搜索与筛选控制栏 (HighDensityGrid 集成) -->
    <HighDensityGrid :cols="8">
      <div class="sm:col-span-3">
        <label class="block text-xs text-st-secondary mb-1">班级名称 / 编号</label>
        <el-input
          v-model="searchQuery"
          placeholder="搜索班级名称 / 编号"
          clearable
          @clear="reloadFromFirstPage"
          @keyup.enter="reloadFromFirstPage"
        >
          <template #prefix><Search class="w-4 h-4 text-st-secondary" /></template>
        </el-input>
      </div>

      <div class="sm:col-span-2">
        <label class="block text-xs text-st-secondary mb-1">班级状态</label>
        <el-select v-model="statusFilter" placeholder="班级状态" clearable class="w-full" @change="reloadFromFirstPage">
          <el-option label="全部状态" value="" />
          <el-option label="招生中" value="recruiting" />
          <el-option label="开班中" value="in_progress" />
          <el-option label="已结业" value="completed" />
        </el-select>
      </div>

      <div class="sm:col-span-3">
        <label class="block text-xs text-st-secondary mb-1">授课讲师</label>
        <el-select
          v-model="teacherFilter"
          :placeholder="isDataScopeSelf ? `仅本人 (${currentTeacherName})` : '授课讲师'"
          :disabled="isDataScopeSelf"
          clearable
          class="w-full"
          @change="reloadFromFirstPage"
        >
          <el-option v-if="!isDataScopeSelf" label="全部讲师" value="" />
          <el-option v-for="t in teachers" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </div>

      <template #footer>
        <div class="text-xs text-st-muted flex items-center gap-2">
          <el-tag
            size="small"
            :type="isDataScopeSelf ? 'warning' : 'primary'"
            effect="plain"
            class="font-medium font-mono"
          >
            {{ isDataScopeSelf ? '仅本人数据 (已锁定只看本人班级)' : (authStore.user?.dataScope === 'all' ? '全部校区数据透视' : '本校数据透视') }}
          </el-tag>
          <span v-if="selectedRows.length > 0" class="text-st-success font-semibold bg-st-success-light px-2 py-0.5 rounded border border-st-success-border">
            已勾选 {{ selectedRows.length }} 个教学班级
          </span>
          <span>匹配结果：共 <b>{{ classTotal }}</b> 个教学班级</span>
        </div>
        <div class="space-x-2">
          <el-button @click="handleResetFilters">重置</el-button>
          <el-button type="primary" @click="reloadFromFirstPage">查询</el-button>
        </div>
      </template>
    </HighDensityGrid>

    <!-- 班级摘要小计栏 (SummaryStrip 集成) -->
    <SummaryStrip
      :total-count="classTotal"
      unit="个班级"
      :summary-text="`当前校区班级：共计 ${classStats.totalClasses} 个班级，在读学员 ${classStats.totalStudents} 人，综合满班率 ${classStats.avgFillRate}%，秋季在招 ${classStats.recruitingClasses} 个`"
    >
      <template #right>
        <el-button @click="showClassroomManageModal = true">
          <template #icon><Building2 class="w-4 h-4" /></template>
          教室管理
        </el-button>
        <el-button
          type="success"
          plain
          :disabled="selectedRows.length === 0"
          @click="handleBatchScheduleSelected"
        >
          <template #icon><Calendar class="w-4 h-4" /></template>
          批量排课 {{ selectedRows.length > 0 ? `(已选 ${selectedRows.length} 班)` : '' }}
        </el-button>
        <el-button type="primary" @click="handleCreateClass">
          + 新设教学班级
        </el-button>
      </template>
    </SummaryStrip>

    <!-- 班级列表高密度表格 -->
    <div class="bg-white rounded-lg shadow-sm border border-st-border overflow-hidden">
      <div class="overflow-x-auto w-full min-w-0">
        <el-table
          :data="classList" v-loading="listLoading"
          stripe
          border
          size="default"
          style="width: 100%"
          @selection-change="handleSelectionChange"
        >
          <template #empty>
            <AppEmpty
              :type="listError ? 'error' : (searchQuery || statusFilter || teacherFilter ? 'search' : 'data')"
              :description="listError || undefined"
              @retry="loadData"
              :action-text="listError ? undefined : '重置筛选'"
              @action="handleResetFilters"
            />
          </template>

          <el-table-column type="selection" width="45" align="center" />
        <el-table-column prop="code" label="班级编号" width="130">
          <template #default="{ row }">
            <span class="font-mono text-xs text-st-secondary font-semibold">{{ row.code }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="班级名称" min-width="190">
          <template #default="{ row }">
            <div class="cursor-pointer hover:text-st-primary font-bold text-st-title" @click="handleViewDetail(row as any)">
              {{ row.name }}
            </div>
            <div class="text-xs text-st-muted mt-0.5">
              {{ row.scheduleDesc || '未排课' }}
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="courseName" label="所属课程" min-width="170">
          <template #default="{ row }">
            <span class="text-xs text-st-regular">{{ row.courseName }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="teacherName" label="主讲老师" width="115">
          <template #default="{ row }">
            <span class="font-medium text-st-title flex items-center gap-1"><User class="w-4 h-4 text-st-primary" /> {{ row.teacherName }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="assistantName" label="班主任" width="100">
          <template #default="{ row }">
            <span class="text-xs text-st-muted">{{ row.assistantName || '张学管' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="classroomName" label="固定教室" width="130">
          <template #default="{ row }">
            <span class="text-xs text-st-secondary truncate flex items-center gap-1"><MapPin class="w-4 h-4 text-st-secondary" /> {{ row.classroomName }}</span>
          </template>
        </el-table-column>

        <el-table-column label="开班周期" width="165">
          <template #default="{ row }">
            <span class="font-mono text-xs text-st-muted">{{ row.startDate }} ~ {{ row.periodEnd }}</span>
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
                @click="handleStartClass(row as any)"
              >
                开班
              </el-button>
              <el-button
                v-if="row.status === 'in_progress'"
                link
                type="warning"
                size="small"
                @click="handleOpenCompleteModal(row as any)"
              >
                结课
              </el-button>
              <el-button link type="primary" size="small" @click="handleViewDetail(row as any)">花名册</el-button>
              <el-button link type="primary" size="small" @click="handleBatchSchedule(row as any)">排课</el-button>
              <el-button link type="primary" size="small" @click="handleEditClass(row as any)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDeleteClass(row as any)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </div>
      <div v-if="classTotal > 0" class="border-t border-st-divider px-3">
        <AppPagination
          v-model:current-page="classPage"
          v-model:page-size="classPageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="classTotal"
          :summary-text="`共 ${classTotal} 个班级`"
          @change="() => loadData()"
        />
      </div>
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
            <div class="mt-2 text-xs space-y-1 text-st-secondary">
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
                <span class="font-medium text-st-title">全员回退待分班资产池</span>
                <span class="text-xs text-st-muted block">保全学员剩余课时，解绑班级外键，学籍自愈为正常在读</span>
              </el-radio>
              <el-radio label="transfer_next_class">
                <span class="font-medium text-st-title">整班批量升班晋级</span>
                <span class="text-xs text-st-muted block">原子平移至同校区同课程的进阶后继班级（CAS 班容校验）</span>
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
        <div class="p-3 bg-st-primary-light/70 border border-st-primary-border rounded-lg flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-1">
            <el-input v-model="newRoomName" placeholder="教室名称（如：人工智能创客室）" class="!w-48" />
            <el-input-number v-model="newRoomCapacity" :min="1" :max="100" placeholder="容量" class="!w-24" />
            <el-select v-model="newRoomType" placeholder="类型" class="!w-32">
              <el-option label="创客实验室" value="maker" />
              <el-option label="编程机房" value="computer" />
              <el-option label="多媒体大班" value="regular" />
              <el-option label="VIP辅导室" value="vip" />
            </el-select>
          </div>
          <el-button type="primary" @click="handleAddNewRoom">
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
              <span class="text-st-success text-xs font-semibold">● 空闲可用</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="showClassroomManageModal = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useLoadState } from '@/composables/useLoadState'
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Building2, Calendar, Search, Users, TrendingUp, Target, User, MapPin } from 'lucide-vue-next'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'
import { educationalApi } from '@/api'
import type { ClassItem, Classroom } from '@/types/educational'
import SummaryStrip from '@/components/SummaryStrip.vue'
import HighDensityGrid from '@/components/HighDensityGrid.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import AppPagination from '@/components/AppPagination.vue'
import ClassDetailDrawer from './components/ClassDetailDrawer.vue'
import BatchScheduleDialog from './components/BatchScheduleDialog.vue'
import ClassFormDialog from './components/ClassFormDialog.vue'

// 列表加载状态：加载中显示遮罩，加载失败时空状态区显示原因和“重新加载”
const { loading: listLoading, loadError: listError, track: trackList, fail: failList } = useLoadState()

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
const classTotal = ref(0)
const classPage = ref(1)
const classPageSize = ref(20)
const classSummary = ref<{ totalClasses: number; totalStudents: number; avgFillRate: number; recruitingClasses: number } | null>(null)
let classListSeq = 0

// 改筛选条件时回到第 1 页
function reloadFromFirstPage() {
  classPage.value = 1
  return loadData()
}
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
  if (classSummary.value) return classSummary.value
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

function loadData() {
  return trackList(loadDataTask)
}

async function loadDataTask() {
  const seq = ++classListSeq
  const tId = isDataScopeSelf.value ? currentTeacherId.value : (teacherFilter.value || undefined)
  try {
    // 筛选、搜索、分页都交给后端：以前不传分页参数，后端默认只回 20 个班，超过 20 个的班级在页面上看不到
    const res = await educationalApi.getClasses({
      campusId: tenantStore.currentCampusId,
      status: statusFilter.value || undefined,
      keyword: searchQuery.value.trim() || undefined,
      teacherId: tId,
      page: classPage.value,
      pageSize: classPageSize.value
    })
    if (seq !== classListSeq) return
    if (res && res.success && res.data) {
      const data: any = res.data
      const list = Array.isArray(data) ? data : (data.items || data.list || [])
      if (Array.isArray(list)) {
        classList.value = list as any
        classTotal.value = Array.isArray(data) ? list.length : Number(data.total ?? list.length)
        classSummary.value = Array.isArray(data) ? null : (data.summary || null)
        return
      }
    }
  } catch (err: any) {
    if (seq !== classListSeq) return
    failList(err, '获取班级列表失败')
  }

  classList.value = []
  classTotal.value = 0
  classSummary.value = null
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
  reloadFromFirstPage()
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

// 结业转班的目标班级：列表分页后当前页不一定有，打开弹窗时单独按课程查一次
const targetClassPool = ref<ClassItem[]>([])
async function loadTargetClassPool(cls: ClassItem) {
  targetClassPool.value = []
  try {
    const res = await educationalApi.getClasses({ campusId: tenantStore.currentCampusId, courseId: cls.courseId, pageSize: 200 })
    const data: any = res?.data
    const list = Array.isArray(data) ? data : (data?.list || [])
    if (activeLifecycleClass.value?.id === cls.id) targetClassPool.value = list
  } catch {
    targetClassPool.value = []
  }
}

const targetClassCandidates = computed(() => {
  if (!activeLifecycleClass.value) return []
  return targetClassPool.value.filter(
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
  void loadTargetClassPool(cls)
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
