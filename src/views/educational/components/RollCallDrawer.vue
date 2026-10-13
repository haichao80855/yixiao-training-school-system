<template>
  <el-drawer
    v-model="visible"
    title="授课工作台 — 上课点名与下课课消结算"
    size="680px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div v-if="event" class="space-y-4">
      <!-- 课次概要横幅 -->
      <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4 space-y-2">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded font-bold bg-emerald-600 text-white">
                {{ event.lessonNumber ? `第${event.lessonNumber}讲` : '课次点名' }}
              </span>
              <h3 class="text-base font-bold text-st-title">{{ event.className }}</h3>
            </div>
            <p class="text-xs text-st-secondary mt-1">课程：{{ event.courseName }}</p>
          </div>
          <el-tag type="warning" size="small">待点名结算</el-tag>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200 text-xs">
          <div><span class="text-st-muted">上课日期：</span><span class="font-mono text-st-title">{{ event.date }}</span></div>
          <div><span class="text-st-muted">上课时段：</span><span class="font-mono text-st-title">{{ event.startTime }} - {{ event.endTime }}</span></div>
          <div><span class="text-st-muted">授课讲师：</span><span class="font-bold text-st-title">👨‍🏫 {{ event.teacherName }}</span></div>
          <div><span class="text-st-muted">上课教室：</span><span class="font-medium text-st-title">📍 {{ event.classroomName }}</span></div>
        </div>
      </div>

      <!-- 点名控制条与一键全勤 -->
      <div class="flex items-center justify-between bg-white p-3 rounded-lg border border-st-border text-xs">
        <div class="flex items-center space-x-3">
          <span class="font-bold text-st-title">应到学员：{{ studentRows.length }} 人</span>
          <span class="text-emerald-600 font-semibold">到课: {{ countStatus('present') }}</span>
          <span class="text-amber-600">请假: {{ countStatus('leave') }}</span>
          <span class="text-rose-600">旷课: {{ countStatus('absent') }}</span>
          <span class="text-blue-600">迟到: {{ countStatus('late') }}</span>
        </div>

        <el-button type="success" size="small" plain @click="handleAllPresent">
          ⚡ 一键全勤
        </el-button>
      </div>

      <!-- 学员花名册点名列表 -->
      <div class="space-y-2">
        <el-table :data="studentRows" size="small" border stripe max-height="420px">
          <el-table-column prop="studentName" label="学员姓名" width="105">
            <template #default="{ row }">
              <span class="font-bold text-st-title">{{ row.studentName }}</span>
              <div class="text-[10px] text-st-muted font-mono">{{ row.studentNo }}</div>
            </template>
          </el-table-column>

          <el-table-column label="课包余量" width="85">
            <template #default="{ row }">
              <span :class="row.remainingLessons <= 3 ? 'text-st-danger font-bold' : 'text-st-success'">
                {{ row.remainingLessons }} 课时
              </span>
            </template>
          </el-table-column>

          <el-table-column label="出勤考勤状态" width="220">
            <template #default="{ row }">
              <el-radio-group v-model="row.status" size="small" @change="() => handleStatusChange(row)">
                <el-radio-button label="present">到课</el-radio-button>
                <el-radio-button label="leave">请假</el-radio-button>
                <el-radio-button label="absent">旷课</el-radio-button>
                <el-radio-button label="late">迟到</el-radio-button>
              </el-radio-group>
            </template>
          </el-table-column>

          <el-table-column label="扣课时" width="80">
            <template #default="{ row }">
              <el-input-number
                v-model="row.deductionLessons"
                :min="0"
                :max="5"
                size="small"
                controls-position="right"
                class="!w-16"
              />
            </template>
          </el-table-column>

          <el-table-column label="随堂表现评语/备注" min-width="130">
            <template #default="{ row }">
              <el-input v-model="row.remark" placeholder="填写评语或请假事由" size="small" />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 课消预警核算 -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs flex items-center justify-between">
        <div class="text-st-secondary">
          本次结算将真实扣减学员课包总计：<b class="text-emerald-700 text-sm">{{ totalDeductLessons }}</b> 课时。
        </div>
        <div class="text-[11px] text-st-muted">
          结算后系统将自动生成考勤记录并支持后续反结课冲正
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-2 border-t pt-3">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitRollCall">
          确认下课并结算消课
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { educationalApi } from '@/api'
import type { ScheduleEvent, StudentAttendanceItem, AttendanceStatus } from '@/types/educational'

const visible = ref(false)
const submitting = ref(false)
const event = ref<ScheduleEvent | null>(null)

interface StudentRow extends StudentAttendanceItem {
  remainingLessons: number
}

const studentRows = ref<StudentRow[]>([])

const emit = defineEmits<{
  (e: 'success'): void
}>()

function countStatus(status: AttendanceStatus) {
  return studentRows.value.filter(s => s.status === status).length
}

const totalDeductLessons = computed(() => {
  return studentRows.value.reduce((sum, r) => sum + (r.deductionLessons || 0), 0)
})

function handleStatusChange(row: StudentRow) {
  if (row.status === 'present' || row.status === 'late') {
    row.deductionLessons = 1
  } else {
    row.deductionLessons = 0
  }
}

function handleAllPresent() {
  studentRows.value.forEach(row => {
    row.status = 'present'
    row.deductionLessons = 1
  })
  ElMessage.success('已全部设置为“到课”出勤！')
}

async function open(evt: ScheduleEvent) {
  event.value = evt
  visible.value = true

  // 从真实后端接口拉取该课次绑定的学员名单与课包
  try {
    const res = await educationalApi.getRollCallStudents(evt.id)
    if (res && res.data && Array.isArray(res.data)) {
      studentRows.value = res.data
      return
    }
  } catch (err: any) {
    ElMessage.error(err.message || '拉取排课学员列表失败')
  }

  studentRows.value = []
}

async function handleSubmitRollCall() {
  if (!event.value) return
  if (studentRows.value.length === 0) {
    ElMessage.warning('当前班级暂无可考勤学员')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定对班级 [${event.value.className}] 执行下课结算吗？系统将正式扣减 ${totalDeductLessons.value} 课时并入账。`,
      '下课消课确认',
      {
        confirmButtonText: '确认消课',
        cancelButtonText: '检查调整',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  submitting.value = true
  try {
    const res = await educationalApi.rollCall({
      scheduleId: event.value.id,
      attendances: studentRows.value.map(r => ({
        studentId: r.studentId,
        status: r.status,
        deductLessons: r.deductionLessons,
        comment: r.remark
      }))
    })

    if (res && res.success !== false) {
      ElMessage.success(res.message || '随堂点名消课结算成功并已真实落库！')
      visible.value = false
      emit('success')
    } else {
      ElMessage.error(res?.message || '点名消课失败')
    }
  } catch (apiErr: any) {
    ElMessage.error(apiErr.message || '随堂点名消课执行失败，已拦截')
  } finally {
    submitting.value = false
  }
}

defineExpose({ open })
</script>
