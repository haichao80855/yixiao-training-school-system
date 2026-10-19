<template>
  <el-drawer
    v-model="visible"
    title="排课课次详情"
    size="520px"
    destroy-on-close
  >
    <div v-if="event" class="space-y-4">
      <!-- 顶部卡片概要 -->
      <div class="p-4 rounded-lg border" :style="{ backgroundColor: chipStyle.background, borderColor: chipStyle.borderColor }">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded font-bold" :style="{ backgroundColor: chipStyle.borderColor, color: '#fff' }">
                {{ chipStyle.badge }}
              </span>
              <h3 class="text-base font-bold text-st-title">{{ event.className }}</h3>
            </div>
            <p class="text-xs text-st-secondary mt-1">课程：{{ event.courseName }}</p>
          </div>
          <el-tag :type="event.status === 'completed' ? 'success' : event.hasConflict ? 'danger' : 'primary'" size="small">
            {{ event.status === 'completed' ? '已结课' : event.hasConflict ? '存在冲突' : '待上课' }}
          </el-tag>
        </div>

        <!-- 冲突告警条目 -->
        <div v-if="event.hasConflict" class="mt-3 bg-white/80 p-2.5 rounded border border-rose-300 text-xs text-rose-700 space-y-1">
          <div class="font-bold flex items-center gap-1.5">
            <AlertTriangle class="w-3.5 h-3.5 text-rose-600" />
            <span>冲突原因排查 ({{ event.conflictType || '时段重叠' }})</span>
          </div>
          <p class="leading-relaxed">{{ event.conflictReason || '与同校区其他课次存在时间、教师或教室资源争抢冲突' }}</p>
          <div class="pt-1 flex items-center justify-end">
            <el-button size="small" type="danger" plain @click="handleResolveConflict">
              立即调课消冲突
            </el-button>
          </div>
        </div>
      </div>

      <!-- 基本信息网格 -->
      <div class="bg-gray-50 p-3.5 rounded-lg border border-st-border text-xs space-y-2">
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-st-muted">上课日期：</span><span class="font-medium text-st-title">{{ event.date }}</span></div>
          <div><span class="text-st-muted">上课时段：</span><span class="font-medium text-st-title">{{ event.startTime }} - {{ event.endTime }} ({{ event.durationMinutes }}分钟)</span></div>
          <div><span class="text-st-muted">授课讲师：</span><span class="font-medium text-st-title inline-flex items-center gap-1"><User class="w-3.5 h-3.5 text-st-primary" />{{ event.teacherName }}</span></div>
          <div><span class="text-st-muted">上课教室：</span><span class="font-medium text-st-title inline-flex items-center gap-1"><MapPin class="w-3.5 h-3.5 text-amber-500" />{{ event.classroomName }}</span></div>
          <div><span class="text-st-muted">课次讲数：</span><span class="font-medium text-st-title">第 {{ event.lessonNumber || 1 }} 讲</span></div>
          <div><span class="text-st-muted">课次类型：</span><span class="font-medium text-st-title">{{ event.classType === 'formal' ? '正式课' : event.classType === 'make_up' ? '补课' : '公开试听' }}</span></div>
        </div>
        <div v-if="event.lessonTitle" class="pt-1 border-t border-gray-200">
          <span class="text-st-muted">讲次主题：</span><span class="font-medium text-st-title">{{ event.lessonTitle }}</span>
        </div>
      </div>

      <!-- 上课学员花名册 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-st-title flex items-center gap-1.5">
            <Users class="w-4 h-4 text-st-primary" />
            <span>本班应到学员</span>
            <span class="text-st-muted font-normal">({{ studentList.length }} 人)</span>
          </h4>
          <span class="text-[11px] text-st-muted">实到已出勤: {{ event.attendanceCount || 0 }} 人</span>
        </div>

        <el-table :data="studentList" size="small" border stripe max-height="260px">
          <el-table-column prop="name" label="学员姓名" width="100">
            <template #default="{ row }">
              <span class="font-semibold text-st-title">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="studentNo" label="学号" width="90" />
          <el-table-column prop="phone" label="联系电话" min-width="110" />
          <el-table-column label="课包剩余" width="90">
            <template #default="{ row }">
              <span :class="row.remainingLessons <= 3 ? 'text-st-danger font-bold' : 'text-st-success'">
                {{ row.remainingLessons }} 课时
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between border-t pt-3">
        <el-button type="danger" plain size="small" @click="handleDelete">
          取消/删除排课
        </el-button>
        <div class="space-x-2">
          <el-button size="small" @click="handleEdit">编辑排课</el-button>
          <el-button type="primary" size="small" @click="handleGoAttendance">
            进入点名工作台
          </el-button>
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { User, MapPin, Users, AlertTriangle } from 'lucide-vue-next'
import { educationalApi } from '@/api'
import { EducationalCollisionEngine } from '@/utils/collisionEngine'
import type { ScheduleEvent } from '@/types/educational'

const router = useRouter()
const visible = ref(false)
const event = ref<ScheduleEvent | null>(null)

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'edit', evt: ScheduleEvent): void
}>()

const chipStyle = computed(() => {
  if (!event.value) return { background: '#fff', borderColor: '#ccc', badge: '正' }
  return EducationalCollisionEngine.getSemanticChipStyle(event.value)
})

const studentList = ref<Array<{ id?: string; name?: string; studentNo?: string; phone?: string; remainingLessons: number }>>([])

async function open(evt: ScheduleEvent) {
  event.value = evt
  visible.value = true
  try {
    const res = await educationalApi.getRollCallStudents(evt.id)
    if (res && res.data && Array.isArray(res.data)) {
      studentList.value = res.data
      return
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取排课学员名单失败')
  }
  studentList.value = []
}

function handleEdit() {
  if (!event.value) return
  visible.value = false
  emit('edit', event.value)
}

function handleResolveConflict() {
  handleEdit()
}

function handleGoAttendance() {
  if (!event.value) return
  visible.value = false
  router.push({
    path: '/educational/attendance',
    query: { eventId: event.value.id }
  })
}

async function handleDelete() {
  if (!event.value) return
  try {
    await ElMessageBox.confirm(
      `确定要取消或删除班级 [${event.value.className}] 在 ${event.value.date} ${event.value.startTime} 的这节排课吗？`,
      '删除排课确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    try {
      await educationalApi.deleteSchedule(event.value.id)
      ElMessage.success('排课已成功删除！')
      visible.value = false
      emit('refresh')
    } catch (err: any) {
      ElMessage.error(err.message || '删除排课失败')
    }
  } catch {
    // cancelled
  }
}

defineExpose({ open })
</script>
