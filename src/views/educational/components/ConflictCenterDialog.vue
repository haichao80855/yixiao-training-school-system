<template>
  <el-dialog
    v-model="visible"
    title="三维排课冲突检测中心"
    width="740px"
    destroy-on-close
  >
    <div class="space-y-4">
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base">⚡</span>
          <span>
            当前校区检测到 <b>{{ conflictList.length }}</b> 处日程重叠资源争抢。教务排课冲突将导致师资撞期或教室超员，请及时调配。
          </span>
        </div>
        <el-tag type="danger" size="small">{{ conflictList.length }} 处碰撞</el-tag>
      </div>

      <div v-if="conflictList.length === 0" class="py-12 text-center text-st-muted text-xs">
        <p class="text-3xl mb-2">🎉</p>
        <p>当前校区所有排课均无资源冲突，排课系统运行良好！</p>
      </div>

      <div v-else class="space-y-3 max-h-[460px] overflow-y-auto pr-1">
        <div
          v-for="item in conflictList"
          :key="item.id"
          class="border border-rose-200 bg-rose-50/50 rounded-lg p-3.5 space-y-2.5 transition-all hover:shadow-sm"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span class="font-bold text-st-title text-sm">{{ item.className }}</span>
              <el-tag type="danger" size="small">{{ getConflictLabel(item.conflictType) }}</el-tag>
            </div>
            <span class="text-xs text-st-muted">{{ item.date }} {{ item.startTime }}-{{ item.endTime }}</span>
          </div>

          <div class="text-xs text-rose-800 bg-white/80 p-2.5 rounded border border-rose-200 space-y-1">
            <div class="font-semibold text-rose-700">冲突详情说明：</div>
            <p>{{ item.conflictReason || '讲师或教室资源在此时段与其他课程重叠冲突' }}</p>
          </div>

          <div class="flex items-center justify-between text-xs text-st-secondary pt-1">
            <div class="space-x-3">
              <span>👨‍🏫 讲师：{{ item.teacherName }}</span>
              <span>📍 教室：{{ item.classroomName }}</span>
              <span>👥 学员数：{{ item.studentIds?.length || 0 }}人</span>
            </div>
            <el-button type="danger" size="small" @click="handleResolve(item)">
              调整课次解决冲突
            </el-button>
          </div>
        </div>
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
import type { ScheduleEvent } from '@/types/educational'

const visible = ref(false)
const conflictList = ref<ScheduleEvent[]>([])

const emit = defineEmits<{
  (e: 'resolve', evt: ScheduleEvent): void
}>()

function getConflictLabel(type?: string) {
  switch (type) {
    case 'TEACHER_CONFLICT': return '讲师重叠冲突'
    case 'CLASSROOM_CONFLICT': return '教室占用冲突'
    case 'STUDENT_CONFLICT': return '学员并发冲突'
    case 'CLASSROOM_CAPACITY_EXCEEDED': return '教室容量超限'
    case 'TIME_WINDOW_VIOLATION': return '时间窗口越界'
    default: return '时段冲突'
  }
}

function open(conflicts: ScheduleEvent[]) {
  conflictList.value = conflicts
  visible.value = true
}

function handleResolve(evt: ScheduleEvent) {
  visible.value = false
  emit('resolve', evt)
}

defineExpose({ open })
</script>
