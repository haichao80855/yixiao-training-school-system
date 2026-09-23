<template>
  <div class="p-5 space-y-4 bg-gray-50 min-h-screen">
    <!-- 顶部工作台标题与操作条 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-st-border flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-base font-bold text-st-title">授课讲台与考勤消课 (工作台)</h2>
          <el-tag size="small" type="primary">{{ currentCampus.name }}</el-tag>
        </div>
        <p class="text-xs text-st-muted mt-1">
          讲师上课点名（出勤/请假/旷课）、人脸抓拍考勤核验、自动扣减学员课包学时与反结课红字冲正机制
        </p>
      </div>

      <div class="flex items-center space-x-2">
        <el-button size="default" @click="handleFaceSync">
          📷 刷脸考勤同步
        </el-button>
        <el-button type="primary" size="default" @click="handleBatchRollCall">
          批量确认消课
        </el-button>
      </div>
    </div>

    <!-- 5 大授课工作台看板指标 -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border">
        <div class="text-xs text-st-muted">今日待上课次</div>
        <div class="text-2xl font-bold text-blue-600 mt-1">
          {{ workbenchStats.scheduledCount }} <span class="text-xs font-normal text-st-muted">节</span>
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border">
        <div class="text-xs text-st-muted">已结课次</div>
        <div class="text-2xl font-bold text-emerald-600 mt-1">
          {{ workbenchStats.completedCount }} <span class="text-xs font-normal text-st-muted">节</span>
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border">
        <div class="text-xs text-st-muted">应到学员总数</div>
        <div class="text-2xl font-bold text-st-title mt-1">
          {{ workbenchStats.totalStudents }} <span class="text-xs font-normal text-st-muted">人</span>
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border">
        <div class="text-xs text-st-muted">实到学员总数</div>
        <div class="text-2xl font-bold text-teal-600 mt-1">
          {{ workbenchStats.presentStudents }} <span class="text-xs font-normal text-st-muted">人</span>
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg shadow-sm border border-st-border">
        <div class="text-xs text-st-muted">累计课消总课时</div>
        <div class="text-2xl font-bold text-indigo-600 mt-1">
          {{ workbenchStats.totalDeductedLessons }} <span class="text-xs font-normal text-st-muted">课时</span>
        </div>
      </div>
    </div>

    <!-- 主体 Tabs (待上点名工作台 / 历史课消流水与反结课冲正) -->
    <div class="bg-white rounded-lg shadow-sm border border-st-border p-5 space-y-4">
      <el-tabs v-model="activeTab" class="w-full">
        <!-- Tab 1: 待上课次点名工作台 -->
        <el-tab-pane label="待上课次与点名消课" name="workbench">
          <div class="space-y-4">
            <!-- 筛选条 -->
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center space-x-3">
                <el-select v-model="filterTeacher" placeholder="全部讲师" clearable class="!w-36">
                  <el-option v-for="t in teachers" :key="t.id" :label="t.name" :value="t.id" />
                </el-select>
                <el-date-picker
                  v-model="filterDate"
                  type="date"
                  placeholder="上课日期"
                  value-format="YYYY-MM-DD"
                  class="!w-40"
                />
              </div>

              <span class="text-xs text-st-muted">
                当前待上课次共 <b>{{ filteredSchedules.length }}</b> 节
              </span>
            </div>

            <!-- 待上课次表格 -->
            <el-table :data="filteredSchedules" stripe border size="default" style="width: 100%">
              <el-table-column prop="date" label="上课日期" width="115" />
              <el-table-column label="上课时段" width="130">
                <template #default="{ row }">
                  <span class="font-mono text-xs">{{ row.startTime }} - {{ row.endTime }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="className" label="班级名称" min-width="190">
                <template #default="{ row }">
                  <span class="font-bold text-st-title">{{ row.className }}</span>
                  <div class="text-[11px] text-st-muted mt-0.5">{{ row.courseName }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="teacherName" label="授课老师" width="110">
                <template #default="{ row }">
                  <span class="font-medium text-st-title">👨‍🏫 {{ row.teacherName }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="classroomName" label="所在教室" width="130">
                <template #default="{ row }">
                  <span class="text-xs text-st-secondary">📍 {{ row.classroomName }}</span>
                </template>
              </el-table-column>
              <el-table-column label="应到人数" width="100">
                <template #default="{ row }">
                  <span>{{ row.studentIds?.length || 0 }} 人</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="105">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'completed' ? 'success' : 'warning'" size="small">
                    {{ row.status === 'completed' ? '已消课' : '待点名' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="140" fixed="right">
                <template #default="{ row }">
                  <el-button
                    type="primary"
                    size="small"
                    :disabled="row.status === 'completed'"
                    @click="handleOpenRollCall(row)"
                  >
                    {{ row.status === 'completed' ? '已结课' : '进入点名' }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- Tab 2: 历史课消记录与反结课冲正专区 -->
        <el-tab-pane label="历史课消记录与反结课冲正" name="records">
          <div class="space-y-4">
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-base">↩️</span>
                <span>
                  <b>反结课机制 (Revert Lesson)：</b>对于因停电、暴雨或客诉争议误扣的课时，执行“反结课”将自动将已扣减的课时退还充正回学员课包账户，彻底闭环。
                </span>
              </div>
              <el-tag type="warning" size="small">{{ attendanceRecords.length }} 条记录</el-tag>
            </div>

            <!-- 历史记录列表 -->
            <el-table :data="attendanceRecords" stripe border size="default" style="width: 100%">
              <el-table-column prop="id" label="考勤记录编号" width="165">
                <template #default="{ row }">
                  <span class="font-mono text-xs text-st-secondary font-semibold">{{ row.id }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="date" label="考勤日期" width="115" />
              <el-table-column label="时段" width="130">
                <template #default="{ row }">
                  <span class="font-mono text-xs">{{ row.startTime || '09:00' }} - {{ row.endTime || '10:30' }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="className" label="班级 / 课次讲题" min-width="190">
                <template #default="{ row }">
                  <div class="font-bold text-st-title">{{ row.className }}</div>
                  <div class="text-[11px] text-st-muted mt-0.5">{{ row.lessonTitle || `第${row.lessonNumber}讲` }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="teacherName" label="授课老师" width="105">
                <template #default="{ row }">
                  <span>👨‍🏫 {{ row.teacherName }}</span>
                </template>
              </el-table-column>
              <el-table-column label="出勤情况" width="160">
                <template #default="{ row }">
                  <div class="text-xs space-x-2">
                    <span class="text-emerald-600 font-semibold">到课: {{ row.presentCount }}</span>
                    <span class="text-amber-600">请假: {{ row.leaveCount }}</span>
                    <span class="text-rose-600">缺勤: {{ row.absentCount }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="消课课时" width="95">
                <template #default="{ row }">
                  <span class="font-bold text-emerald-700">{{ row.deductedLessonsTotal }} 课时</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <el-tag :type="row.isReversed ? 'info' : 'success'" size="small">
                    {{ row.isReversed ? '已反结课' : '已结课' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="170" fixed="right">
                <template #default="{ row }">
                  <div class="space-x-1">
                    <el-button link type="primary" size="small" @click="handleViewRecord(row)">
                      明细
                    </el-button>
                    <el-button
                      v-if="!row.isReversed"
                      link
                      type="danger"
                      size="small"
                      @click="handleRevertAttendance(row)"
                    >
                      反结课冲正
                    </el-button>
                    <span v-else class="text-[11px] text-st-muted px-1.5 py-0.5 bg-gray-100 rounded">
                      已冲正
                    </span>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 点名抽屉 -->
    <RollCallDrawer
      ref="rollCallRef"
      @success="handleReloadAll"
    />

    <!-- 考勤明细弹窗 -->
    <AttendanceDetailDialog
      ref="detailDialogRef"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTenantStore } from '@/stores/tenantStore'
import {
  getScheduleEvents,
  getAttendanceRecords,
  getTeachers,
  revertAttendance
} from '@/mocks/educational'
import type { ScheduleEvent, AttendanceRecord } from '@/types/educational'
import RollCallDrawer from './components/RollCallDrawer.vue'
import AttendanceDetailDialog from './components/AttendanceDetailDialog.vue'

const route = useRoute()
const tenantStore = useTenantStore()
const currentCampus = computed(() => tenantStore.currentCampus)

const activeTab = ref('workbench')
const filterTeacher = ref('')
const filterDate = ref('')

const schedules = ref<ScheduleEvent[]>([])
const attendanceRecords = ref<AttendanceRecord[]>([])

const teachers = computed(() => getTeachers(tenantStore.currentCampusId).filter(t => t.role === 'teacher'))

function loadData() {
  schedules.value = getScheduleEvents({
    campusId: tenantStore.currentCampusId
  })
  attendanceRecords.value = getAttendanceRecords(tenantStore.currentCampusId)
}

const filteredSchedules = computed(() => {
  let list = schedules.value
  if (filterTeacher.value) {
    list = list.filter(s => s.teacherId === filterTeacher.value)
  }
  if (filterDate.value) {
    list = list.filter(s => s.date === filterDate.value)
  }
  return list
})

// 看板统计数据
const workbenchStats = computed(() => {
  const all = schedules.value
  const scheduledCount = all.filter(s => s.status === 'scheduled').length
  const completedCount = all.filter(s => s.status === 'completed').length
  const totalStudents = all.reduce((sum, s) => sum + (s.studentIds?.length || 0), 0)
  const presentStudents = all.reduce((sum, s) => sum + (s.attendanceCount || 0), 0)

  const totalDeductedLessons = attendanceRecords.value
    .filter(r => !r.isReversed)
    .reduce((sum, r) => sum + (r.deductedLessonsTotal || 0), 0)

  return {
    scheduledCount,
    completedCount,
    totalStudents,
    presentStudents,
    totalDeductedLessons
  }
})

// 弹窗引用
const rollCallRef = ref<InstanceType<typeof RollCallDrawer>>()
const detailDialogRef = ref<InstanceType<typeof AttendanceDetailDialog>>()

function handleOpenRollCall(event: ScheduleEvent) {
  rollCallRef.value?.open(event)
}

function handleViewRecord(record: AttendanceRecord) {
  detailDialogRef.value?.open(record)
}

async function handleRevertAttendance(record: AttendanceRecord) {
  try {
    const { value: reason } = await ElMessageBox.prompt(
      `确定对班级 [${record.className}]（${record.date} 课次）发起反结课冲正吗？已扣减的 ${record.deductedLessonsTotal} 课时将原路退还学员课包。`,
      '反结课冲正确认',
      {
        confirmButtonText: '确定冲正退回课时',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入冲正理由（如：突发恶劣天气调课/客诉误结课）',
        inputValue: '家长因故申请调课，经核实后教务反结课冲正退还课时',
        type: 'warning'
      }
    )

    const res = revertAttendance(record.id, reason, '教务主管')
    if (res.success) {
      ElMessage.success(res.message)
      handleReloadAll()
    } else {
      ElMessage.error(res.message)
    }
  } catch {
    // cancelled
  }
}

function handleFaceSync() {
  ElMessage.success('已连接校区闸机人脸抓拍设备：成功同步 12 条学员入校打卡日志！')
}

function handleBatchRollCall() {
  const pending = schedules.value.filter(s => s.status === 'scheduled')
  if (pending.length === 0) {
    ElMessage.info('暂无可批量点名的待上课次')
    return
  }
  handleOpenRollCall(pending[0])
}

function handleReloadAll() {
  loadData()
}

onMounted(() => {
  loadData()

  // 如果路由传参进入特定课次点名
  if (route.query.eventId) {
    const target = schedules.value.find(s => s.id === route.query.eventId)
    if (target) {
      handleOpenRollCall(target)
    }
  }
})
</script>
