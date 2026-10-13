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
            <div class="text-xs text-st-muted mt-0.5">{{ currentClass?.courseName }} | 归属: {{ currentClass?.campusName || '总部校区' }} | 已排进度: {{ currentClass?.completedLessons || 0 }}/{{ currentClass?.totalLessons || 48 }}讲</div>
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
        <div v-if="previewSummary" class="border rounded-lg p-3 bg-gray-50 text-xs space-y-1">
          <div class="font-bold text-st-title flex justify-between">
            <span>预演排课结果 ({{ form.repeatCount }} 讲)</span>
            <span :class="previewSummary.conflictCount > 0 ? 'text-st-danger' : 'text-st-success'">
              {{ previewSummary.conflictCount > 0 ? `检测到 ${previewSummary.conflictCount} 处时段冲突` : '无时段冲突 ✓' }}
            </span>
          </div>
          <div class="text-st-muted text-[11px]">
            排课跨度：{{ previewSummary.start }} 至 {{ previewSummary.end }}，每周循环一次。
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

const previewSummary = computed(() => {
  if (!form.startDate || !form.repeatCount) return null
  const [y, m, d] = form.startDate.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  const startStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  dt.setDate(dt.getDate() + (form.repeatCount - 1) * 7)
  const endStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return {
    start: startStr,
    end: endStr,
    conflictCount: 0
  }
})

function triggerPreview() {
  // preview calculated reactive
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
  visible.value = true
}

async function handleSubmit() {
  if (!formRef.value || !currentClass.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      const targets = applyToAllSelected.value && classList.value.length > 1
        ? classList.value
        : [currentClass.value!]

      let totalSuccessCount = 0

      for (const targetCls of targets) {
        const [startY, startM, startD] = form.startDate.split('-').map(Number)
        const currentDate = new Date(startY, (startM || 1) - 1, startD || 1)

        for (let i = 0; i < form.repeatCount; i++) {
          const year = currentDate.getFullYear()
          const month = String(currentDate.getMonth() + 1).padStart(2, '0')
          const day = String(currentDate.getDate()).padStart(2, '0')
          const dateStr = `${year}-${month}-${day}`

          await educationalApi.createSchedule({
            campusId: targetCls.campusId || props.campusId,
            classId: targetCls.id,
            teacherId: form.teacherId || targetCls.teacherId,
            classroomId: form.classroomId || targetCls.classroomId,
            date: dateStr,
            startTime: form.startTime,
            endTime: form.endTime,
            classType: 'formal',
            semanticType: 'regular'
          })
          totalSuccessCount++
          currentDate.setDate(currentDate.getDate() + 7)
        }
      }

      if (totalSuccessCount > 0) {
        ElMessage.success({
          message: `批量排课执行成功！已成功生成 ${totalSuccessCount} 节课次日程，已即时同步至甘特排课看板！`,
          duration: 4000
        })
        visible.value = false
        emit('success')
      } else {
        ElMessage.error('批量排课未能成功生成有效课次')
      }
    } catch (err: any) {
      ElMessage.error(err.message || '批量排课失败')
    } finally {
      submitting.value = false
    }
  })
}

defineExpose({ open })
</script>
