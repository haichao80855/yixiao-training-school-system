<template>
  <el-dialog
    v-model="visible"
    title="考勤课消明细与冲正审计"
    :width="DIALOG_SIZE.lg"
    destroy-on-close
  >
    <div v-if="record" class="space-y-4">
      <!-- 状态与概要 -->
      <div
        :class="[
          'p-4 rounded-lg border space-y-2',
          record.isReversed ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'
        ]"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded font-mono font-bold bg-st-primary text-white">
                {{ record.id }}
              </span>
              <h3 class="text-base font-bold text-st-title">{{ record.className }}</h3>
            </div>
            <p class="text-xs text-st-secondary mt-1">讲次：{{ record.lessonTitle || `第${record.lessonNumber}讲` }}</p>
          </div>
          <el-tag :type="record.isReversed ? 'info' : 'success'" size="default">
            {{ record.isReversed ? '已反结课 (课时已冲正退还)' : '已结课 (课时已扣减)' }}
          </el-tag>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/10 text-xs">
          <div><span class="text-st-muted">上课时间：</span><span class="font-mono text-st-title">{{ record.date }} {{ record.startTime }}</span></div>
          <div><span class="text-st-muted">授课讲师：</span><span class="font-bold text-st-title inline-flex items-center gap-1"><User class="w-3.5 h-3.5 text-st-primary" />{{ record.teacherName }}</span></div>
          <div><span class="text-st-muted">应到/实到：</span><span class="font-medium text-st-title">{{ record.totalStudents }} / {{ record.presentCount + record.lateCount }} 人</span></div>
          <div><span class="text-st-muted">消课课时：</span><span class="font-bold text-emerald-700">{{ record.deductedLessonsTotal }} 课时</span></div>
        </div>

        <!-- 反结课冲正警示条 -->
        <div v-if="record.isReversed" class="mt-2 bg-white/90 p-2.5 rounded border border-amber-300 text-xs text-amber-900 space-y-1">
          <div class="font-bold flex items-center gap-1 text-amber-800">
            <Undo2 class="w-4 h-4 text-amber-700" />
            <span>反结课冲正记录 (红字冲正完成)</span>
          </div>
          <div class="text-[11px] text-amber-800 space-y-0.5">
            <div>冲正时间：<span class="font-mono">{{ record.reversedAt }}</span> | 操作人：{{ record.reversedBy || '教务主管' }}</div>
            <div>冲正事由：{{ record.reversalReason || '家长客诉申请退回已扣减课时' }}</div>
          </div>
        </div>
      </div>

      <!-- 学员考勤打卡明细 -->
      <div class="space-y-2">
        <h4 class="text-xs font-bold text-st-title flex items-center justify-between">
          <span class="inline-flex items-center gap-1.5"><Users class="w-4 h-4 text-st-primary" />本次点名明细列表</span>
          <span class="text-st-muted text-[11px]">共 {{ record.studentAttendances?.length || 0 }} 名学员</span>
        </h4>

        <el-table :data="record.studentAttendances" size="small" border stripe max-height="300px">
          <el-table-column prop="studentName" label="学员姓名" width="110">
            <template #default="{ row }">
              <span class="font-bold text-st-title">{{ row.studentName }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="studentNo" label="学号" width="100" />
          <el-table-column label="出勤状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTag(row.status)" size="small">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="消课扣减" width="90">
            <template #default="{ row }">
              <span class="font-semibold text-emerald-700">{{ row.deductionLessons }} 课时</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="课堂表现 / 备注" min-width="140" />
        </el-table>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <el-button @click="visible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { User, Users, Undo2 } from 'lucide-vue-next'
import { DIALOG_SIZE } from '@/constants/ui'
import type { AttendanceRecord } from '@/types/educational'

const visible = ref(false)
const record = ref<AttendanceRecord | null>(null)

function getStatusTag(status: string) {
  switch (status) {
    case 'present': return 'success'
    case 'leave': return 'warning'
    case 'absent': return 'danger'
    case 'late': return 'primary'
    default: return 'info'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'present': return '到课'
    case 'leave': return '请假'
    case 'absent': return '旷课'
    case 'late': return '迟到'
    default: return status
  }
}

function open(r: AttendanceRecord) {
  record.value = r
  visible.value = true
}

defineExpose({ open })
</script>
