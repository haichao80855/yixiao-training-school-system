<template>
  <el-drawer
    v-model="visible"
    title="班级综合档案全景详情"
    size="680px"
    destroy-on-close
  >
    <div v-if="classItem" class="space-y-4">
      <!-- 班级核心卡片 -->
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded font-mono font-bold bg-st-primary text-white">
                {{ classItem.code }}
              </span>
              <h3 class="text-base font-bold text-st-title">{{ classItem.name }}</h3>
            </div>
            <p class="text-xs text-st-secondary mt-1">所属课程：{{ classItem.courseName }}</p>
          </div>
          <el-tag :type="getStatusTag(classItem.status)" size="default">
            {{ getStatusLabel(classItem.status) }}
          </el-tag>
        </div>

        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-blue-200 text-xs">
          <div><span class="text-st-muted">主讲讲师：</span><span class="font-bold text-st-title">{{ classItem.teacherName }}</span></div>
          <div><span class="text-st-muted">班主任：</span><span class="font-medium text-st-title">{{ classItem.assistantName || '张学管' }}</span></div>
          <div><span class="text-st-muted">固定教室：</span><span class="font-medium text-st-title">{{ classItem.classroomName }}</span></div>
          <div><span class="text-st-muted">开班周期：</span><span class="font-mono text-st-title">{{ classItem.startDate }} ~ {{ classItem.endDate }}</span></div>
          <div><span class="text-st-muted">固定规律：</span><span class="font-medium text-st-title">{{ classItem.scheduleDesc || '每周六 09:00-10:30' }}</span></div>
          <div><span class="text-st-muted">课次进度：</span><span class="font-bold text-st-primary">{{ classItem.completedLessons || 0 }} / {{ classItem.totalLessons || 48 }} 讲</span></div>
        </div>

        <!-- 满班率进度条 -->
        <div class="pt-2">
          <div class="flex justify-between text-xs mb-1">
            <span>满班容量进度：<b>{{ classItem.currentStudentCount }} / {{ classItem.capacity }} 人</b></span>
            <span :class="classItem.currentStudentCount >= classItem.capacity ? 'text-st-danger font-bold' : 'text-st-success'">
              {{ classItem.currentStudentCount >= classItem.capacity ? '已满班 (禁止插班)' : `可插班 (剩余${classItem.capacity - classItem.currentStudentCount}名额)` }}
            </span>
          </div>
          <el-progress
            :percentage="Math.min(100, Math.round((classItem.currentStudentCount / classItem.capacity) * 100))"
            :status="classItem.currentStudentCount >= classItem.capacity ? 'exception' : 'success'"
            :stroke-width="7"
          />
        </div>
      </div>

      <!-- Tab 切换 (学员花名册 / 排课课表 / 考勤汇总) -->
      <el-tabs v-model="activeTab" class="w-full">
        <!-- 1. 在读学员花名册 -->
        <el-tab-pane label="在读学员花名册" name="students">
          <div class="space-y-3">
            <!-- 班级消课健康指数横条 (权威SSOT) -->
            <div v-if="rosterHealth" class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center space-x-2">
                <span class="text-st-muted">班级综合消课健康指数：</span>
                <span
                  class="font-extrabold text-sm font-mono"
                  :class="rosterHealth.classHealthIndex >= 80 ? 'text-emerald-600' : rosterHealth.classHealthIndex >= 60 ? 'text-amber-500' : 'text-rose-600'"
                >
                  {{ rosterHealth.classHealthIndex }} 分
                </span>
                <el-tag
                  size="small"
                  :type="rosterHealth.classHealthIndex >= 80 ? 'success' : rosterHealth.classHealthIndex >= 60 ? 'warning' : 'danger'"
                >
                  {{ rosterHealth.classHealthIndex >= 80 ? '消课充沛' : rosterHealth.classHealthIndex >= 60 ? '需跟进续约' : '大面积枯竭' }}
                </el-tag>
              </div>

              <div class="flex items-center space-x-3 text-[11px]">
                <span v-if="rosterHealth.statistics.criticalCount > 0" class="text-rose-600 font-bold flex items-center gap-1">
                  <AlertCircle class="w-3.5 h-3.5 inline-block shrink-0" />
                  极度枯竭: {{ rosterHealth.statistics.criticalCount }}人
                </span>
                <span v-if="rosterHealth.statistics.warningCount > 0" class="text-amber-600 font-bold flex items-center gap-1">
                  <AlertTriangle class="w-3.5 h-3.5 inline-block shrink-0" />
                  预警跟进: {{ rosterHealth.statistics.warningCount }}人
                </span>
                <span v-if="rosterHealth.statistics.dormantCount > 0" class="text-purple-600 font-bold flex items-center gap-1">
                  <Moon class="w-3.5 h-3.5 inline-block shrink-0" />
                  停消休眠: {{ rosterHealth.statistics.dormantCount }}人
                </span>
                <span class="text-slate-500">
                  正常在读: {{ rosterHealth.statistics.normalCount }}人
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs text-st-muted">
              <span>在读学员共 <b>{{ effectiveStudentList.length }}</b> 人</span>
              <span class="text-[11px] text-st-secondary">统一风控三色徽标驱动，智能识别停消休眠与续费窗口</span>
            </div>

            <el-table :data="effectiveStudentList" size="small" border stripe max-height="360px">
              <el-table-column prop="name" label="学员姓名" width="110">
                <template #default="{ row }">
                  <span class="font-bold text-st-title">{{ row.name }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="studentNo" label="学号" width="100" />
              <el-table-column prop="phone" label="联系电话" min-width="120" />
              <el-table-column label="消课风控与剩余" width="150">
                <template #default="{ row }">
                  <div class="space-y-0.5">
                    <div class="flex items-center space-x-1">
                      <el-tag
                        v-if="row.visualBadge"
                        :type="row.visualBadge.type"
                        size="small"
                        effect="light"
                      >
                        {{ row.visualBadge.text }}
                      </el-tag>
                      <span v-else class="font-bold font-mono text-emerald-600">
                        {{ row.remainingLessons }} 课时
                      </span>
                    </div>
                    <div v-if="row.isDormant" class="text-[10px] text-purple-600 font-semibold flex items-center gap-0.5">
                      <Moon class="w-3 h-3 inline-block shrink-0" />
                      停消 {{ row.inactiveDays }} 天
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="累计消课" width="90">
                <template #default="{ row }">
                  <span>{{ row.consumedLessons }} 讲</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="160" align="center" fixed="right">
                <template #default="{ row }">
                  <div class="flex items-center justify-center space-x-1">
                    <el-button
                      v-if="row.canQuickRenew !== false"
                      link
                      type="warning"
                      size="small"
                      @click="handleRenewStudent(row)"
                    >
                      一键续费
                    </el-button>
                    <el-popconfirm
                      title="确定将该学员移出当前班级并退回待分班池吗？"
                      confirm-button-text="移出"
                      cancel-button-text="取消"
                      confirm-button-type="danger"
                      @confirm="handleRemoveStudent(row)"
                    >
                      <template #reference>
                        <el-button link type="danger" size="small">移出班级</el-button>
                      </template>
                    </el-popconfirm>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- 2. 本班排课课次日历 -->
        <el-tab-pane label="本班排课日历" name="schedules">
          <div class="space-y-3">
            <div class="flex items-center justify-between text-xs">
              <span class="text-st-muted">已生成排课课次：<b>{{ classSchedules.length }}</b> 次</span>
              <el-button type="primary" size="small" @click="handleOpenBatchSchedule">
                + 为本班批量排课
              </el-button>
            </div>

            <el-table :data="classSchedules" size="small" border stripe max-height="360px">
              <el-table-column prop="date" label="上课日期" width="110" />
              <el-table-column label="时段" width="120">
                <template #default="{ row }">
                  <span class="font-mono">{{ row.startTime }}-{{ row.endTime }}</span>
                </template>
              </el-table-column>
              <el-table-column label="讲次主题" min-width="160">
                <template #default="{ row }">
                  <span class="truncate">{{ row.lessonTitle || (row.lessonNumber ? `第${row.lessonNumber}讲` : '—') }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="classroomName" label="教室" width="110" />
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag v-if="row.hasConflict" type="danger" size="small">冲突</el-tag>
                  <el-tag v-else-if="row.status === 'completed'" type="success" size="small">已上</el-tag>
                  <el-tag v-else type="primary" size="small">待上</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- 3. 历史考勤消课汇总结算 -->
        <el-tab-pane label="考勤课消明细" name="attendances">
          <div class="space-y-3">
            <div class="flex items-center justify-between text-xs text-st-muted">
              <span>共 <b>{{ classAttendances.length }}</b> 次上课考勤记录</span>
              <span>累计消课：<b>{{ totalDeductedLessons }}</b> 课时</span>
            </div>

            <el-table :data="classAttendances" size="small" border stripe max-height="360px">
              <el-table-column prop="date" label="考勤日期" width="110" />
              <el-table-column prop="lessonTitle" label="课次/讲题" min-width="160" />
              <el-table-column prop="teacherName" label="授课老师" width="90" />
              <el-table-column label="出勤情况" width="140">
                <template #default="{ row }">
                  <span class="text-xs">
                    出勤: <b class="text-emerald-600">{{ row.presentCount }}</b> /
                    请假: <b class="text-amber-600">{{ row.leaveCount }}</b>
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.isReversed" type="info" size="small">已反结课</el-tag>
                  <el-tag v-else type="success" size="small">已结算 ({{ row.deductedLessonsTotal }}课时)</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <template #footer>
      <div class="flex items-center justify-between border-t pt-3">
        <div class="space-x-2">
          <el-button type="primary" plain size="small" @click="handleOpenBatchSchedule">
            批量排课
          </el-button>
          <el-button
            v-if="classItem?.status === 'recruiting'"
            type="success"
            size="small"
            @click="handleActivateClass"
          >
            <template #icon><Rocket class="w-3.5 h-3.5" /></template>
            正式开班
          </el-button>
          <el-button
            v-if="classItem?.status === 'in_progress'"
            type="warning"
            size="small"
            @click="handleCompleteClass"
          >
            <template #icon><GraduationCap class="w-3.5 h-3.5" /></template>
            正常结课
          </el-button>
          <el-button
            v-if="classItem?.status !== 'completed' && classItem?.status !== 'cancelled'"
            type="danger"
            plain
            size="small"
            @click="handleCancelClass"
          >
            <template #icon><AlertTriangle class="w-3.5 h-3.5" /></template>
            异常解散
          </el-button>
        </div>
        <el-button @click="visible = false">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AlertCircle, AlertTriangle, Moon, Rocket, GraduationCap } from 'lucide-vue-next'
import { educationalApi } from '@/api'
import type { ClassItem, ScheduleEvent, AttendanceRecord } from '@/types/educational'
import type { ClassRosterHealthReport } from '@/types/student'

const visible = ref(false)
const activeTab = ref('students')
const classItem = ref<ClassItem | null>(null)
const rosterHealth = ref<ClassRosterHealthReport | null>(null)
const classSchedulesList = ref<ScheduleEvent[]>([])
const classAttendancesList = ref<AttendanceRecord[]>([])

const emit = defineEmits<{
  (e: 'batchSchedule', cls: ClassItem): void
  (e: 'updated'): void
  (e: 'renewStudent', row: any): void
  (e: 'completeClass', cls: ClassItem): void
}>()

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
    case 'in_progress': return '开班授课中'
    case 'recruiting': return '秋季招生中'
    case 'completed': return '已顺利结业'
    case 'cancelled': return '已撤销解散'
    case 'archived': return '已归档'
    default: return '未知'
  }
}

const studentList = computed(() => {
  if (!classItem.value) return []
  return (classItem.value as any).students || []
})

const effectiveStudentList = computed(() => {
  if (rosterHealth.value && rosterHealth.value.roster && rosterHealth.value.roster.length > 0) {
    return rosterHealth.value.roster
  }
  return studentList.value
})

const classSchedules = computed<ScheduleEvent[]>(() => {
  return classSchedulesList.value
})

const classAttendances = computed<AttendanceRecord[]>(() => {
  return classAttendancesList.value
})

const totalDeductedLessons = computed(() => {
  return classAttendances.value
    .filter(r => !r.isReversed)
    .reduce((sum, r) => sum + (r.deductedLessonsTotal || 0), 0)
})

async function handleRemoveStudent(row: any) {
  if (!classItem.value) return
  const studentId = row.studentId || row.id
  try {
    const res = await educationalApi.removeStudent({
      classId: classItem.value.id,
      studentId,
    })
    ElMessage.success(res?.data?.message || `学员 [${row.name}] 已成功移出班级并退回待分班资产池`)
    emit('updated')

    // 重新拉取班级档案详情与健康度，实时同步满班率与健康指标
    const [detailRes, healthRes] = await Promise.all([
      educationalApi.getClassById(classItem.value.id),
      educationalApi.getClassRosterHealth(classItem.value.id).catch(() => null),
    ])
    if (detailRes?.data) {
      classItem.value = detailRes.data
    }
    if (healthRes?.data) {
      rosterHealth.value = healthRes.data
    }
  } catch (err: any) {
    ElMessage.error(err.message || '移出学员失败')
  }
}

function handleRenewStudent(row: any) {
  emit('renewStudent', row)
}

async function open(item: ClassItem) {
  classItem.value = item
  activeTab.value = 'students'
  visible.value = true

  try {
    const [detailRes, schedRes, attRes, healthRes] = await Promise.all([
      educationalApi.getClassById(item.id),
      educationalApi.getSchedules({ classId: item.id }),
      educationalApi.getAttendanceRecords({ classId: item.id }),
      educationalApi.getClassRosterHealth(item.id).catch(() => null),
    ])
    if (detailRes?.data) {
      classItem.value = detailRes.data
    }
    if (healthRes?.data) {
      rosterHealth.value = healthRes.data
    } else {
      rosterHealth.value = null
    }
    classSchedulesList.value = Array.isArray(schedRes?.data) ? schedRes.data : (schedRes?.data?.list || [])
    classAttendancesList.value = Array.isArray(attRes?.data) ? attRes.data : (attRes?.data?.list || [])
  } catch (err: any) {
    ElMessage.error(err.message || '加载班级详情失败')
  }
}

function handleOpenBatchSchedule() {
  if (!classItem.value) return
  visible.value = false
  emit('batchSchedule', classItem.value)
}

async function handleActivateClass() {
  if (!classItem.value) return
  try {
    await ElMessageBox.confirm(
      `确定为班级「${classItem.value.name}」正式开班吗？`,
      '立即开班',
      { confirmButtonText: '确定开班', cancelButtonText: '取消', type: 'success' }
    )
    const res = await educationalApi.activateClass({ classId: classItem.value.id })
    ElMessage.success(res.data?.message || '开班成功！')
    emit('updated')
    open(classItem.value)
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '开班失败')
    }
  }
}

function handleCompleteClass() {
  if (!classItem.value) return
  visible.value = false
  emit('completeClass', classItem.value)
}

async function handleCancelClass() {
  if (!classItem.value) return
  try {
    const { value: reason } = await ElMessageBox.prompt(
      '请输入解散原因（在读学员课包将安全回退待分班池）：',
      '异常解散班级',
      {
        confirmButtonText: '提交解散',
        cancelButtonText: '取消',
        inputPattern: /^.{2,}$/,
        inputErrorMessage: '原因至少填写2个字',
        confirmButtonClass: 'el-button--danger',
      }
    )
    if (reason) {
      const res = await educationalApi.cancelClass({ classId: classItem.value.id, reason })
      ElMessage.warning(res.data?.message || '班级已成功解散')
      visible.value = false
      emit('updated')
    }
  } catch {
    // 取消
  }
}

defineExpose({ open })
</script>
