<template>
  <el-dialog
    v-model="visible"
    title="班级批量循环排课向导"
    width="640px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div class="space-y-4">
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
        <div class="font-bold flex items-center gap-1 text-blue-900">
          <span>📅</span>
          <span>按周期自动规律排课 (例如：每周六 14:00-16:00 连续排 16 次)</span>
        </div>
        <p class="text-blue-700">系统将自动跳过节假日（或按固定周步长推进），并实时调用三维冲突检测引擎探测潜在师生与教室冲突。</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="95px" size="default">
        <!-- 目标班级 -->
        <el-form-item label="排课班级">
          <div v-if="classList.length <= 1">
            <div class="font-bold text-st-title text-sm">{{ currentClass?.name }}</div>
            <div class="text-xs text-st-muted mt-0.5">{{ currentClass?.courseName }} | 归属: {{ currentClass?.campusName || '拓视未来-原阳校区' }} | 已排进度: {{ currentClass?.completedLessons || 0 }}/{{ currentClass?.totalLessons || 48 }}讲</div>
          </div>
          <div v-else class="space-y-1.5 w-full">
            <el-select v-model="selectedClassId" class="w-full" @change="handleSwitchClass">
              <el-option
                v-for="c in classList"
                :key="c.id"
                :label="`${c.name} [${c.teacherName}] (${c.campusName || '校区'})`"
                :value="c.id"
              />
            </el-select>
            <div class="flex items-center justify-between text-xs text-st-muted">
              <span>当前配置: {{ currentClass?.name }}</span>
              <el-checkbox v-model="applyToAllSelected">
                <span class="text-xs font-semibold text-st-primary">同时为已勾选的全部 {{ classList.length }} 个班级批量排课</span>
              </el-checkbox>
            </div>
          </div>
        </el-form-item>

        <!-- 首节日期 -->
        <el-form-item label="起始上课日" prop="startDate">
          <el-date-picker
            v-model="form.startDate"
            type="date"
            placeholder="选择首节课上课日期"
            value-format="YYYY-MM-DD"
            class="!w-full"
            @change="triggerPreview"
          />
        </el-form-item>

        <!-- 上课时段 -->
        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="开始时间" prop="startTime">
            <el-time-select
              v-model="form.startTime"
              start="07:00"
              step="00:15"
              end="21:45"
              placeholder="开始时间"
              class="w-full"
              @change="triggerPreview"
            />
          </el-form-item>
          <el-form-item label="结束时间" prop="endTime">
            <el-time-select
              v-model="form.endTime"
              start="07:15"
              step="00:15"
              end="22:00"
              placeholder="结束时间"
              class="w-full"
              @change="triggerPreview"
            />
          </el-form-item>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <!-- 授课讲师 -->
          <el-form-item label="授课老师" prop="teacherId">
            <el-select v-model="form.teacherId" placeholder="选择讲师" class="w-full" @change="triggerPreview">
              <el-option
                v-for="t in teachers"
                :key="t.id"
                :label="t.name"
                :value="t.id"
              />
            </el-select>
          </el-form-item>

          <!-- 上课教室 -->
          <el-form-item label="上课教室" prop="classroomId">
            <el-select v-model="form.classroomId" placeholder="选择教室" class="w-full" @change="triggerPreview">
              <el-option
                v-for="r in classrooms"
                :key="r.id"
                :label="`${r.name} (${r.capacity}人)`"
                :value="r.id"
              />
            </el-select>
          </el-form-item>
        </div>

        <!-- 循环次数 -->
        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="排课课次数" prop="repeatCount">
            <el-input-number v-model="form.repeatCount" :min="1" :max="48" class="!w-full" @change="triggerPreview" />
          </el-form-item>
          <el-form-item label="冲突处理">
            <el-checkbox v-model="form.forceIfConflict">
              <span class="text-xs">遇冲突仍生成日程 (红标待调解)</span>
            </el-checkbox>
          </el-form-item>
        </div>

        <!-- 预览结果摘要 -->
        <div v-if="previewSummary" class="border rounded-lg p-3 bg-gray-50 text-xs space-y-1.5">
          <div class="font-bold text-st-title flex justify-between">
            <span>预演排课结果 ({{ previewData?.totalPlannedSlots || form.repeatCount }} 讲)</span>
            <span :class="previewSummary.conflictCount > 0 ? 'text-st-danger font-bold' : 'text-st-success'">
              {{ previewSummary.conflictCount > 0 ? `检测到 ${previewSummary.conflictCount} 处时段冲突` : '无时段冲突 ✓' }}
            </span>
          </div>
          <div class="text-st-muted text-[11px]">
            排课跨度：{{ previewSummary.start }} 至 {{ previewSummary.end }}，每周循环一次。
          </div>
          <div v-if="previewData?.collisions?.length" class="max-h-24 overflow-y-auto space-y-1 pt-1 border-t border-gray-200">
            <div v-for="(c, idx) in previewData.collisions.slice(0, 5)" :key="idx" class="text-[11px] text-rose-600">
              ⚠️ [{{ c.date }}] {{ c.message }}
            </div>
            <div v-if="previewData.collisions.length > 5" class="text-[10px] text-stone-400">
              ...以及另外 {{ previewData.collisions.length - 5 }} 处冲突
            </div>
          </div>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ applyToAllSelected && classList.length > 1 ? `为全部 ${classList.length} 个班级执行批量排课` : '执行批量排课' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { educationalApi } from '@/api'
import type { ClassItem, Teacher, Classroom } from '@/types/educational'

const props = defineProps<{
  campusId: string
}>()

const emit = defineEmits<{
  (e: 'success'): void
}>()

const visible = ref(false)
const submitting = ref(false)
const classList = ref<ClassItem[]>([])
const selectedClassId = ref('')
const applyToAllSelected = ref(false)
const currentClass = ref<ClassItem | null>(null)
const formRef = ref<FormInstance>()

const effectiveCampusId = computed(() => currentClass.value?.campusId || props.campusId)
const teacherList = ref<Teacher[]>([])
const classroomList = ref<Classroom[]>([])

async function reloadOptions() {
  try {
    const [teaRes, roomRes] = await Promise.all([
      educationalApi.getTeachers(effectiveCampusId.value),
      educationalApi.getClassrooms(effectiveCampusId.value)
    ])
    teacherList.value = Array.isArray(teaRes?.data) ? teaRes.data : (teaRes?.data?.list || [])
    classroomList.value = Array.isArray(roomRes?.data) ? roomRes.data : (roomRes?.data?.list || [])
  } catch (err: any) {
    ElMessage.error(err.message || '加载批量排课选项失败')
  }
}

const teachers = computed(() => teacherList.value.filter(t => t.role === 'teacher'))
const classrooms = computed(() => classroomList.value)

const form = reactive({
  startDate: '2026-09-26',
  startTime: '14:00',
  endTime: '16:00',
  repeatCount: 16,
  teacherId: '',
  classroomId: '',
  forceIfConflict: true
})

const rules: FormRules = {
  startDate: [{ required: true, message: '请选择起始日期', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  teacherId: [{ required: true, message: '请选择授课老师', trigger: 'change' }],
  classroomId: [{ required: true, message: '请选择上课教室', trigger: 'change' }]
}

function computeSmartStartDate(cls?: ClassItem | null): string {
  if (cls?.startDate && cls.startDate >= '2026-09-22') {
    return cls.startDate
  }
  // 班级含有周日关键词时选 2026-09-27，其余默认选本周六 2026-09-26
  if (cls?.name?.includes('周日') || cls?.scheduleDesc?.includes('周日')) {
    return '2026-09-27'
  }
  return '2026-09-26'
}

function syncFormFromClass(cls: ClassItem) {
  form.teacherId = cls.teacherId || teachers.value[0]?.id || ''
  form.classroomId = cls.classroomId || classrooms.value[0]?.id || ''
  form.startDate = computeSmartStartDate(cls)
  form.repeatCount = Math.max(1, (cls.totalLessons || 48) - (cls.completedLessons || 0))

  // 尝试智能解析班级规律时间
  if (cls.scheduleDesc) {
    const timeMatch = cls.scheduleDesc.match(/(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})/)
    if (timeMatch) {
      form.startTime = timeMatch[1].padStart(5, '0')
      form.endTime = timeMatch[2].padStart(5, '0')
    }
  }
}

function handleSwitchClass(classId: string) {
  const target = classList.value.find(c => c.id === classId)
  if (target) {
    currentClass.value = target
    syncFormFromClass(target)
  }
}

const previewData = ref<any>(null)
const conflictCount = computed(() => previewData.value?.conflictSlotsCount ?? 0)

const previewSummary = computed(() => {
  if (!previewData.value?.dateRange) return null
  return {
    start: previewData.value.dateRange.startDate,
    end: previewData.value.dateRange.endDate,
    conflictCount: conflictCount.value
  }
})

let previewTimer: any = null
function triggerPreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    if (!form.startDate || !form.startTime || !form.endTime || !form.teacherId || !form.classroomId) {
      previewData.value = null
      return
    }
    const targets = applyToAllSelected.value && classList.value.length > 1
      ? classList.value
      : (currentClass.value ? [currentClass.value] : [])

    if (targets.length === 0) return

    try {
      const res = await educationalApi.previewSchedules({
        campusId: effectiveCampusId.value,
        classIds: targets.map(c => c.id),
        startDate: form.startDate,
        startTime: form.startTime,
        endTime: form.endTime,
        teacherId: form.teacherId,
        classroomId: form.classroomId,
        recurrence: {
          frequency: 'weekly',
          repeatCount: form.repeatCount
        }
      })
      previewData.value = res?.data || res
    } catch {
      previewData.value = null
    }
  }, 200)
}

async function open(clsOrList: ClassItem | ClassItem[]) {
  if (Array.isArray(clsOrList)) {
    classList.value = clsOrList
    currentClass.value = clsOrList[0] || null
    selectedClassId.value = clsOrList[0]?.id || ''
    applyToAllSelected.value = clsOrList.length > 1
  } else {
    classList.value = [clsOrList]
    currentClass.value = clsOrList
    selectedClassId.value = clsOrList.id
    applyToAllSelected.value = false
  }

  await reloadOptions()

  if (currentClass.value) {
    syncFormFromClass(currentClass.value)
  }
  triggerPreview()
  visible.value = true
}

async function handleSubmit() {
  if (!formRef.value || !currentClass.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (conflictCount.value > 0 && !form.forceIfConflict) {
      ElMessage.warning(`检测到 ${conflictCount.value} 处排课冲突，请调整时段/教室或勾选“遇冲突仍生成日程”`)
      return
    }

    submitting.value = true
    try {
      const targets = applyToAllSelected.value && classList.value.length > 1
        ? classList.value
        : [currentClass.value!]

      const res = await educationalApi.commitBatchSchedules({
        campusId: effectiveCampusId.value,
        classIds: targets.map(c => c.id),
        startDate: form.startDate,
        startTime: form.startTime,
        endTime: form.endTime,
        teacherId: form.teacherId,
        classroomId: form.classroomId,
        recurrence: {
          frequency: 'weekly',
          repeatCount: form.repeatCount
        },
        conflictPolicy: form.forceIfConflict ? 'ALLOW_AND_FLAG' : 'STRICT_ABORT'
      })

      const message = res?.data?.message || res?.message || '批量排课执行成功！已即时同步至甘特排课看板！'
      ElMessage.success({
        message,
        duration: 4000
      })
      visible.value = false
      emit('success')
    } catch (err: any) {
      ElMessage.error(err.message || '批量排课失败')
    } finally {
      submitting.value = false
    }
  })
}

defineExpose({ open })
</script>
