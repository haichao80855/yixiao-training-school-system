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
          <div><span class="text-st-muted">主讲讲师：</span><span class="font-bold text-st-title">👨‍🏫 {{ classItem.teacherName }}</span></div>
          <div><span class="text-st-muted">班主任：</span><span class="font-medium text-st-title">📋 {{ classItem.assistantName || '张学管' }}</span></div>
          <div><span class="text-st-muted">固定教室：</span><span class="font-medium text-st-title">📍 {{ classItem.classroomName }}</span></div>
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
            <div class="flex items-center justify-between text-xs text-st-muted">
              <span>在读学员共 <b>{{ studentList.length }}</b> 人</span>
              <span class="text-[11px] text-st-secondary">绿色课时正常，红色提示剩余课时不足 3 课时</span>
            </div>

            <el-table :data="studentList" size="small" border stripe max-height="360px">
              <el-table-column prop="name" label="学员姓名" width="110">
                <template #default="{ row }">
                  <span class="font-bold text-st-title">{{ row.name }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="studentNo" label="学号" width="100" />
              <el-table-column prop="phone" label="联系电话" min-width="120" />
              <el-table-column label="课包剩余" width="100">
                <template #default="{ row }">
                  <span :class="row.remainingLessons <= 3 ? 'text-st-danger font-bold' : 'text-st-success'">
                    {{ row.remainingLessons }} 课时
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="累计消课" width="90">
                <template #default="{ row }">
                  <span>{{ row.consumedLessons }} 讲</span>
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
                  <span class="truncate">{{ row.lessonTitle || `第${row.lessonNumber || 1}讲` }}</span>
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
      <div class="flex justify-between border-t pt-3">
        <el-button type="primary" plain size="small" @click="handleOpenBatchSchedule">
          批量自动排课
        </el-button>
        <el-button @click="visible = false">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { educationalApi } from '@/api'
import type { ClassItem, ScheduleEvent, AttendanceRecord } from '@/types/educational'

const visible = ref(false)
const activeTab = ref('students')
const classItem = ref<ClassItem | null>(null)
const classSchedulesList = ref<ScheduleEvent[]>([])
const classAttendancesList = ref<AttendanceRecord[]>([])

const emit = defineEmits<{
  (e: 'batchSchedule', cls: ClassItem): void
}>()

function getStatusTag(status: string) {
  switch (status) {
    case 'in_progress': return 'success'
    case 'recruiting': return 'warning'
    case 'completed': return 'info'
    default: return 'primary'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'in_progress': return '开班授课中'
    case 'recruiting': return '秋季招生中'
    case 'completed': return '已顺利结业'
    default: return '未知'
  }
}

const studentList = computed(() => {
  if (!classItem.value) return []
  return (classItem.value as any).students || []
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

async function open(item: ClassItem) {
  classItem.value = item
  activeTab.value = 'students'
  visible.value = true

  try {
    const [detailRes, schedRes, attRes] = await Promise.all([
      educationalApi.getClassById(item.id),
      educationalApi.getSchedules({ classId: item.id }),
      educationalApi.getAttendanceRecords({ classId: item.id })
    ])
    if (detailRes?.data) {
      classItem.value = detailRes.data
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

defineExpose({ open })
</script>
