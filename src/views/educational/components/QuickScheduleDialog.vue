<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑排课课次' : '快速新建排课'"
    width="620px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="95px" size="default">
      <!-- 班级选择 -->
      <el-form-item label="上课班级" prop="classId">
        <el-select
          v-model="form.classId"
          placeholder="请选择上课班级"
          class="w-full"
          filterable
          @change="handleClassChange"
        >
          <el-option
            v-for="cls in availableClasses"
            :key="cls.id"
            :label="`${cls.name} (${cls.courseName})`"
            :value="cls.id"
          >
            <div class="flex items-center justify-between">
              <span>{{ cls.name }}</span>
              <span class="text-xs text-st-muted">{{ cls.currentStudentCount }}/{{ cls.capacity }}人</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <div class="grid grid-cols-2 gap-3">
        <!-- 授课讲师 -->
        <el-form-item label="授课讲师" prop="teacherId">
          <el-select v-model="form.teacherId" placeholder="选择讲师" class="w-full" @change="triggerCollisionCheck">
            <el-option
              v-for="t in teachers"
              :key="t.id"
              :label="`${t.name} (${t.roleName || '讲师'})`"
              :value="t.id"
            />
          </el-select>
        </el-form-item>

        <!-- 所在教室 -->
        <el-form-item label="上课教室" prop="classroomId">
          <el-select v-model="form.classroomId" placeholder="选择教室" class="w-full" @change="triggerCollisionCheck">
            <el-option
              v-for="r in classrooms"
              :key="r.id"
              :label="`${r.name} (容纳${r.capacity}人)`"
              :value="r.id"
            />
          </el-select>
        </el-form-item>
      </div>

      <!-- 上课日期 -->
      <el-form-item label="上课日期" prop="date">
        <el-date-picker
          v-model="form.date"
          type="date"
          placeholder="选择排课日期"
          value-format="YYYY-MM-DD"
          class="!w-full"
          @change="triggerCollisionCheck"
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
            @change="triggerCollisionCheck"
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
            @change="triggerCollisionCheck"
          />
        </el-form-item>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- 课程类型 -->
        <el-form-item label="课次性质" prop="classType">
          <el-radio-group v-model="form.classType" size="small">
            <el-radio-button label="formal">正式课 [正]</el-radio-button>
            <el-radio-button label="make_up">补课班 [补]</el-radio-button>
            <el-radio-button label="trial">公开试听 [试]</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- 课次序号 -->
        <el-form-item label="课次讲数">
          <el-input-number v-model="form.lessonNumber" :min="1" :max="100" class="!w-full" />
        </el-form-item>
      </div>

      <el-form-item label="讲次主题">
        <el-input v-model="form.lessonTitle" placeholder="如：第18讲：克隆体的应用与雪花飘落" />
      </el-form-item>

      <!-- 实时 3D 冲突预警 Banner -->
      <div v-if="collisionResult && collisionResult.hasConflict" class="mb-3">
        <div class="bg-rose-50 border border-rose-300 rounded-lg p-3 text-xs text-rose-800 space-y-1 animate-pulse">
          <div class="font-bold flex items-center gap-1.5 text-rose-700 text-sm">
            <span>⚠️</span>
            <span>三维冲突检测告警 ({{ collisionResult.conflicts.length }}处时段碰撞)</span>
          </div>
          <div v-for="(c, idx) in collisionResult.conflicts" :key="idx" class="pl-5 text-xs text-rose-700 leading-relaxed">
            • <b>{{ getConflictTypeLabel(c.type) }}:</b> {{ c.reason }}
          </div>
          <div class="pt-1 text-[11px] text-rose-600 flex items-center justify-between">
            <span>建议更换上课时间、更换无冲突教室或指派空闲讲师。</span>
            <el-checkbox v-model="forceSchedule" size="small" class="!text-rose-700">
              <span class="text-xs font-semibold text-rose-700">强制排课 (标记为红色冲突)</span>
            </el-checkbox>
          </div>
        </div>
      </div>

      <div v-else-if="form.startTime && form.endTime && form.date && form.teacherId && form.classroomId" class="mb-3">
        <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-700 flex items-center gap-2">
          <span>✓</span>
          <span>三维排课防撞校验通过：讲师、教室与学员在当前时段均无冲突，符合 07:00-22:00 运营规则。</span>
        </div>
      </div>
    </el-form>

    <template #footer>
      <div class="flex items-center justify-end space-x-2">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '确认排课' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { educationalApi } from '@/api'
import type { ScheduleEvent, CollisionResult, LessonClassType, ClassItem, Teacher, Classroom } from '@/types/educational'

const props = defineProps<{
  campusId: string
}>()

const emit = defineEmits<{
  (e: 'success'): void
}>()

const visible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const forceSchedule = ref(false)
const collisionResult = ref<CollisionResult | null>(null)
const formRef = ref<FormInstance>()
const currentEventId = ref<string | null>(null)

const availableClassesList = ref<ClassItem[]>([])
const teacherList = ref<Teacher[]>([])
const classroomList = ref<Classroom[]>([])

async function reloadOptions() {
  try {
    const [clsRes, teaRes, roomRes] = await Promise.all([
      educationalApi.getClasses({ campusId: props.campusId }),
      educationalApi.getTeachers(props.campusId),
      educationalApi.getClassrooms(props.campusId)
    ])
    availableClassesList.value = Array.isArray(clsRes?.data) ? clsRes.data : (clsRes?.data?.list || [])
    teacherList.value = Array.isArray(teaRes?.data) ? teaRes.data : (teaRes?.data?.list || [])
    classroomList.value = Array.isArray(roomRes?.data) ? roomRes.data : (roomRes?.data?.list || [])
  } catch (err: any) {
    ElMessage.error(err.message || '加载排课选项数据失败')
  }
}

const availableClasses = computed(() => availableClassesList.value)
const teachers = computed(() => teacherList.value.filter(t => t.role === 'teacher'))
const classrooms = computed(() => classroomList.value)

const form = reactive({
  classId: '',
  className: '',
  courseId: '',
  courseName: '',
  teacherId: '',
  teacherName: '',
  classroomId: '',
  classroomName: '',
  date: '',
  startTime: '09:00',
  endTime: '10:30',
  classType: 'formal' as LessonClassType,
  lessonNumber: 1,
  lessonTitle: '',
  studentIds: [] as string[]
})

const rules: FormRules = {
  classId: [{ required: true, message: '请选择上课班级', trigger: 'change' }],
  teacherId: [{ required: true, message: '请选择授课讲师', trigger: 'change' }],
  classroomId: [{ required: true, message: '请选择上课教室', trigger: 'change' }],
  date: [{ required: true, message: '请选择上课日期', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

function getConflictTypeLabel(type: string) {
  switch (type) {
    case 'TEACHER_CONFLICT': return '讲师时间冲突'
    case 'CLASSROOM_CONFLICT': return '教室占用冲突'
    case 'STUDENT_CONFLICT': return '学员重叠冲突'
    case 'CLASSROOM_CAPACITY_EXCEEDED': return '教室容量超限'
    case 'TIME_WINDOW_VIOLATION': return '排课时间超限'
    default: return '排课冲突'
  }
}

function handleClassChange(classId: string) {
  const cls = availableClasses.value.find(c => c.id === classId)
  if (cls) {
    form.className = cls.name
    form.courseId = cls.courseId
    form.courseName = cls.courseName
    form.teacherId = cls.teacherId
    form.teacherName = cls.teacherName
    form.classroomId = cls.classroomId
    form.classroomName = cls.classroomName
    form.studentIds = [...cls.studentIds]
    form.lessonNumber = (cls.completedLessons || 0) + 1
    form.lessonTitle = `第${form.lessonNumber}讲：${cls.courseName}`
  }
  triggerCollisionCheck()
}

async function triggerCollisionCheck() {
  if (!form.date || !form.startTime || !form.endTime) {
    collisionResult.value = null
    return
  }

  // 补齐教师/教室名称
  const t = teachers.value.find(x => x.id === form.teacherId)
  if (t) form.teacherName = t.name
  const r = classrooms.value.find(x => x.id === form.classroomId)
  if (r) form.classroomName = r.name

  try {
    const res = await educationalApi.checkCollision({
      campusId: props.campusId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      teacherId: form.teacherId,
      classroomId: form.classroomId,
      classId: form.classId,
      excludeEventId: currentEventId.value || undefined
    })
    const data = res?.data || res
    collisionResult.value = (data && data.hasConflict) ? data : null
  } catch (err: any) {
    collisionResult.value = null
    ElMessage.error(err.message || '时段冲突检测失败')
  }
}

async function open(payload?: { date?: string; startTime?: string; endTime?: string; event?: ScheduleEvent }) {
  await reloadOptions()
  visible.value = true
  forceSchedule.value = false
  collisionResult.value = null

  if (payload?.event) {
    isEdit.value = true
    currentEventId.value = payload.event.id
    form.classId = payload.event.classId || ''
    form.className = payload.event.className
    form.courseId = payload.event.courseId
    form.courseName = payload.event.courseName
    form.teacherId = payload.event.teacherId
    form.teacherName = payload.event.teacherName
    form.classroomId = payload.event.classroomId
    form.classroomName = payload.event.classroomName
    form.date = payload.event.date
    form.startTime = payload.event.startTime
    form.endTime = payload.event.endTime
    form.classType = payload.event.classType || 'formal'
    form.lessonNumber = payload.event.lessonNumber || 1
    form.lessonTitle = payload.event.lessonTitle || ''
    form.studentIds = [...payload.event.studentIds]
  } else {
    isEdit.value = false
    currentEventId.value = null
    const defaultClass = availableClasses.value[0]
    form.classId = defaultClass ? defaultClass.id : ''
    form.className = defaultClass ? defaultClass.name : ''
    form.courseId = defaultClass ? defaultClass.courseId : ''
    form.courseName = defaultClass ? defaultClass.courseName : ''
    form.teacherId = defaultClass ? defaultClass.teacherId : ''
    form.teacherName = defaultClass ? defaultClass.teacherName : ''
    form.classroomId = defaultClass ? defaultClass.classroomId : ''
    form.classroomName = defaultClass ? defaultClass.classroomName : ''
    form.date = payload?.date || new Date().toISOString().substring(0, 10)
    form.startTime = payload?.startTime || '09:00'
    form.endTime = payload?.endTime || '10:30'
    form.classType = 'formal'
    form.lessonNumber = defaultClass ? (defaultClass.completedLessons || 0) + 1 : 1
    form.lessonTitle = defaultClass ? `第${form.lessonNumber}讲：${defaultClass.courseName}` : ''
    form.studentIds = defaultClass ? [...defaultClass.studentIds] : []
  }

  triggerCollisionCheck()
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (collisionResult.value?.hasConflict && !forceSchedule.value) {
      ElMessage.warning('检测到时段冲突！请调整讲师/教室或勾选“强制排课”')
      return
    }

    submitting.value = true
    try {
      if (isEdit.value && currentEventId.value) {
        await educationalApi.updateSchedule(currentEventId.value, {
          campusId: props.campusId,
          classId: form.classId,
          teacherId: form.teacherId,
          classroomId: form.classroomId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          classType: form.classType || 'formal',
          semanticType: collisionResult.value?.hasConflict ? 'conflict' : 'regular'
        })
        ElMessage.success('修改排课成功并同步落库！')
      } else {
        await educationalApi.createSchedule({
          campusId: props.campusId,
          classId: form.classId,
          teacherId: form.teacherId,
          classroomId: form.classroomId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          classType: form.classType || 'formal',
          semanticType: collisionResult.value?.hasConflict ? 'conflict' : 'regular'
        })
        ElMessage.success('新建排课成功并同步落库！')
      }
      visible.value = false
      emit('success')
    } catch (err: any) {
      ElMessage.error(err.message || '排课失败')
    } finally {
      submitting.value = false
    }
  })
}

defineExpose({ open })
</script>
