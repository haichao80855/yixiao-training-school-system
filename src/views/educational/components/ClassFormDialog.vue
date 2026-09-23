<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑班级档案' : '新设教学班级'"
    width="640px"
    destroy-on-close
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="95px" size="default">
      <div class="grid grid-cols-2 gap-3">
        <el-form-item label="班级名称" prop="name">
          <el-input v-model="form.name" placeholder="如：Scratch创意周末班 (周六 09:00)" />
        </el-form-item>
        <el-form-item label="班级编号" prop="code">
          <el-input v-model="form.code" placeholder="如：CLS-HQ-SC-01" />
        </el-form-item>
      </div>

      <!-- 所属课程 -->
      <el-form-item label="关联课程" prop="courseId">
        <el-select v-model="form.courseId" placeholder="选择所属课程" class="w-full" @change="handleCourseChange">
          <el-option
            v-for="c in courses"
            :key="c.id"
            :label="`${c.name} (¥${c.pricePerLesson}/课时)`"
            :value="c.id"
          />
        </el-select>
      </el-form-item>

      <div class="grid grid-cols-2 gap-3">
        <!-- 主讲讲师（来自系统设置-组织架构与机构的少儿编程专职主讲教师） -->
        <el-form-item label="主讲老师" prop="teacherId">
          <el-select v-model="form.teacherId" placeholder="选择主讲老师" class="w-full" popper-class="class-form-teacher-popper">
            <el-option
              v-for="t in teachers"
              :key="t.id"
              :label="`${t.name} (${t.roleName})`"
              :value="t.id"
            />
          </el-select>
        </el-form-item>

        <!-- 班主任/助教 -->
        <el-form-item label="班主任/助教">
          <el-select v-model="form.assistantId" placeholder="选择班主任" class="w-full">
            <el-option
              v-for="a in advisors"
              :key="a.id"
              :label="`${a.name} (${a.roleName})`"
              :value="a.id"
            />
          </el-select>
        </el-form-item>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- 所在教室与快捷新增入口 -->
        <el-form-item label="固定教室" prop="classroomId">
          <div class="flex items-center space-x-1.5 w-full">
            <el-select v-model="form.classroomId" placeholder="选择教室" class="flex-1" @change="handleClassroomChange">
              <el-option
                v-for="r in classrooms"
                :key="r.id"
                :label="`${r.name} (上限${r.capacity}人)`"
                :value="r.id"
              />
            </el-select>
            <el-button type="primary" link size="small" class="!px-1 shrink-0 text-xs font-semibold" @click="openAddClassroomModal">
              + 新增教室
            </el-button>
          </div>
        </el-form-item>

        <!-- 满班容量 -->
        <el-form-item label="满班容量" prop="capacity">
          <el-input-number v-model="form.capacity" :min="1" :max="50" class="!w-full" />
        </el-form-item>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- 开班周期 -->
        <el-form-item label="开班日期" prop="startDate">
          <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="开班日期" class="!w-full" />
        </el-form-item>
        <el-form-item label="结课日期" prop="endDate">
          <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="预计结课" class="!w-full" />
        </el-form-item>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- 规律描述 -->
        <el-form-item label="上课规律">
          <el-input v-model="form.scheduleDesc" placeholder="如：每周六 09:00-10:30" />
        </el-form-item>

        <!-- 班级状态 -->
        <el-form-item label="班级状态" prop="status">
          <el-select v-model="form.status" class="w-full">
            <el-option label="招生中" value="recruiting" />
            <el-option label="开班授课中" value="in_progress" />
            <el-option label="已结业" value="completed" />
          </el-select>
        </el-form-item>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- 总课次数 -->
        <el-form-item label="总课次数">
          <el-input-number v-model="form.totalLessons" :min="1" :max="120" class="!w-full" />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存更改' : '确认创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 快捷新增教室轻量弹窗 -->
  <el-dialog
    v-model="showAddClassroomModal"
    title="快速新建教学教室"
    width="440px"
    append-to-body
    class="rounded-xl"
  >
    <el-form ref="classroomFormRef" :model="classroomForm" label-width="85px" size="small" class="pt-2">
      <el-form-item label="教室名称" required>
        <el-input v-model="classroomForm.name" placeholder="例如：创新AI机房9号 / 创客实训室3" />
      </el-form-item>
      <el-form-item label="容纳人数" required>
        <el-input-number v-model="classroomForm.capacity" :min="1" :max="100" class="!w-full" />
      </el-form-item>
      <el-form-item label="教室类型" required>
        <el-select v-model="classroomForm.type" class="w-full">
          <el-option label="乐博创客实验室" value="maker" />
          <el-option label="信息学编程机房" value="computer" />
          <el-option label="多媒体大班教室" value="regular" />
          <el-option label="VIP名师辅导室" value="vip" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="flex justify-end space-x-2">
        <el-button size="small" @click="showAddClassroomModal = false">取消</el-button>
        <el-button type="primary" size="small" @click="handleCreateClassroom">确认创建并选用</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getTeachers, getClassrooms, addClass, updateClass, addClassroom, restoreClassroomsFromStorage, restoreClassesFromStorage } from '@/mocks/educational'
import { getCoursesByCampus } from '@/mocks'
import type { ClassItem, ClassStatus, Classroom, Teacher } from '@/types/educational'

const props = defineProps<{
  campusId: string
}>()

const emit = defineEmits<{
  (e: 'success'): void
}>()

const visible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const currentId = ref<string | null>(null)
const formRef = ref<FormInstance>()

// 快捷新增教室弹窗状态
const showAddClassroomModal = ref(false)
const classroomForm = reactive({
  name: '',
  capacity: 20,
  type: 'computer' as const
})

function openAddClassroomModal() {
  classroomForm.name = ''
  classroomForm.capacity = 20
  classroomForm.type = 'computer'
  showAddClassroomModal.value = true
}

function handleCreateClassroom() {
  if (!classroomForm.name.trim()) {
    ElMessage.warning('请输入教室名称！')
    return
  }
  const created = addClassroom({
    name: classroomForm.name.trim(),
    capacity: classroomForm.capacity,
    type: classroomForm.type,
    campusId: props.campusId
  })
  reloadClassrooms()
  form.classroomId = created.id
  form.classroomName = created.name
  form.capacity = created.capacity
  showAddClassroomModal.value = false
  ElMessage.success(`教室「${created.name}」已创建并自动选用！`)
}

function handleClassroomChange(roomId: string) {
  const r = classrooms.value.find(item => item.id === roomId)
  if (r) {
    form.classroomName = r.name
    form.capacity = r.capacity || 16
  }
}

const classroomList = ref<Classroom[]>([])
function reloadClassrooms() {
  restoreClassroomsFromStorage()
  classroomList.value = getClassrooms(props.campusId)
}
const classrooms = computed(() => classroomList.value)

const teacherList = ref<Teacher[]>([])
function reloadTeachers() {
  teacherList.value = getTeachers(props.campusId)
}
const teachers = computed(() => teacherList.value.filter(t => t.role === 'teacher'))
const advisors = computed(() => teacherList.value.filter(t => t.role === 'advisor'))
const courses = computed(() => getCoursesByCampus(props.campusId))

const form = reactive({
  name: '',
  code: '',
  courseId: '',
  courseName: '',
  teacherId: '',
  teacherName: '',
  assistantId: '',
  assistantName: '',
  classroomId: '',
  classroomName: '',
  capacity: 16,
  startDate: '2026-09-01',
  endDate: '2027-01-31',
  scheduleDesc: '每周六 09:00-10:30',
  status: 'recruiting' as ClassStatus,
  totalLessons: 48
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入班级名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入班级编号', trigger: 'blur' }],
  courseId: [{ required: true, message: '请选择关联课程', trigger: 'change' }],
  teacherId: [{ required: true, message: '请选择主讲老师', trigger: 'change' }],
  classroomId: [{ required: true, message: '请选择固定教室', trigger: 'change' }],
  capacity: [{ required: true, message: '请设置满班容量', trigger: 'blur' }]
}

function handleCourseChange(courseId: string) {
  const c = courses.value.find(item => item.id === courseId)
  if (c) {
    form.courseName = c.name
    form.totalLessons = c.totalLessons || 48
  }
}

function open(cls?: ClassItem) {
  reloadClassrooms()
  reloadTeachers()
  restoreClassesFromStorage()
  visible.value = true
  if (cls) {
    isEdit.value = true
    currentId.value = cls.id
    form.name = cls.name
    form.code = cls.code
    form.courseId = cls.courseId
    form.courseName = cls.courseName
    form.teacherId = cls.teacherId
    form.teacherName = cls.teacherName
    form.assistantId = cls.assistantId || ''
    form.assistantName = cls.assistantName || ''
    form.classroomId = cls.classroomId
    form.classroomName = cls.classroomName
    form.capacity = cls.capacity
    form.startDate = cls.startDate
    form.endDate = cls.endDate
    form.scheduleDesc = cls.scheduleDesc || ''
    form.status = cls.status
    form.totalLessons = cls.totalLessons || 48
  } else {
    isEdit.value = false
    currentId.value = null
    form.name = ''
    form.code = `CLS-${Date.now().toString().slice(-6)}`
    form.courseId = courses.value[0]?.id || ''
    form.courseName = courses.value[0]?.name || ''
    form.teacherId = teachers.value[0]?.id || ''
    form.teacherName = teachers.value[0]?.name || ''
    form.assistantId = advisors.value[0]?.id || ''
    form.assistantName = advisors.value[0]?.name || ''
    form.classroomId = classrooms.value[0]?.id || ''
    form.classroomName = classrooms.value[0]?.name || ''
    form.capacity = 16
    form.startDate = '2026-09-01'
    form.endDate = '2027-01-31'
    form.scheduleDesc = '每周六 09:00-10:30'
    form.status = 'recruiting'
    form.totalLessons = 48
  }
}

async function handleSubmit() {
  console.log('[ClassForm] handleSubmit invoked! name=', form.name, 'courseId=', form.courseId, 'teacherId=', form.teacherId, 'classroomId=', form.classroomId)
  if (!formRef.value) {
    console.warn('[ClassForm] formRef is null')
    return
  }
  await formRef.value.validate(async (valid, fields) => {
    console.log('[ClassForm] validate result:', valid, fields)
    if (!valid) {
      console.warn('[ClassForm] validation failed:', fields)
      ElMessage.warning('请检查表单必填项！')
      return
    }
    submitting.value = true
    try {
      const t = teachers.value.find(x => x.id === form.teacherId)
      if (t) form.teacherName = t.name
      const a = advisors.value.find(x => x.id === form.assistantId)
      if (a) form.assistantName = a.name
      const r = classrooms.value.find(x => x.id === form.classroomId)
      if (r) form.classroomName = r.name

      console.log('[ClassForm] ready to add/update class. isEdit=', isEdit.value)
      if (isEdit.value && currentId.value) {
        updateClass(currentId.value, {
          ...form,
          campusId: props.campusId
        })
        ElMessage.success('班级信息已更新！')
      } else {
        const added = addClass({
          ...form,
          campusId: props.campusId
        })
        console.log('[ClassForm] addClass succeeded:', added.id, added.name)
        ElMessage.success('新建班级成功！')
      }
      visible.value = false
      console.log('[ClassForm] emit success!')
      emit('success')
    } catch (err) {
      console.error('[ClassForm] handleSubmit error:', err)
    } finally {
      submitting.value = false
    }
  })
}

defineExpose({ open })
</script>
