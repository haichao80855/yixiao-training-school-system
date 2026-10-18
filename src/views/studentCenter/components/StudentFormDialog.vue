<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑学员档案' : '新增建档学员'"
    :width="DIALOG_SIZE.md"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="small">
      <div class="grid grid-cols-3 gap-3">
        <el-form-item label="学员姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="学员学号" prop="studentNo">
          <el-input v-model="form.studentNo" placeholder="系统自动生成 (如 S948918)" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-select v-model="form.gender" class="w-full">
            <el-option label="男" value="male" />
            <el-option label="女" value="female" />
          </el-select>
        </el-form-item>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <el-form-item label="学员年龄" prop="age">
          <el-input-number v-model="form.age" :min="3" :max="18" class="w-full" />
        </el-form-item>
        <el-form-item label="联系手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="11位手机号" />
        </el-form-item>
        <el-form-item label="归属校区" prop="campusId">
          <el-select v-model="form.campusId" class="w-full">
            <el-option
              v-for="c in tenantStore.campuses"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <el-form-item label="公立学校" prop="school">
          <el-input v-model="form.school" placeholder="如：中关村第一小学" />
        </el-form-item>
        <el-form-item label="在读年级" prop="grade">
          <el-select v-model="form.grade" class="w-full">
            <el-option label="幼儿园小班" value="幼儿园小班" />
            <el-option label="幼儿园中班" value="幼儿园中班" />
            <el-option label="幼儿园大班" value="幼儿园大班" />
            <el-option label="小学一年级" value="小学一年级" />
            <el-option label="小学二年级" value="小学二年级" />
            <el-option label="小学三年级" value="小学三年级" />
            <el-option label="小学四年级" value="小学四年级" />
            <el-option label="小学五年级" value="小学五年级" />
            <el-option label="小学六年级" value="小学六年级" />
            <el-option label="初中一年级" value="初中一年级" />
            <el-option label="初中二年级" value="初中二年级" />
            <el-option label="初中三年级" value="初中三年级" />
          </el-select>
        </el-form-item>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <el-form-item label="家长联系人姓名" prop="parentName">
          <el-input v-model="form.parentName" placeholder="如：张建国" />
        </el-form-item>
        <el-form-item label="家长手机号" prop="parentPhone">
          <el-input v-model="form.parentPhone" placeholder="家长手机号" />
        </el-form-item>
        <el-form-item label="家长微信号" prop="parentWechat">
          <el-input v-model="form.parentWechat" placeholder="微信号" />
        </el-form-item>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <el-form-item label="在读状态" prop="status">
          <el-select v-model="form.status" class="w-full">
            <el-option label="正常在读" value="normal" />
            <el-option label="停课休学" value="suspended" />
            <el-option label="已转校" value="transferred" />
            <el-option label="已退学流失" value="dropped_out" />
          </el-select>
        </el-form-item>
        <el-form-item label="家校微信绑定">
          <el-switch v-model="form.wechatBound" active-text="已绑定" inactive-text="未绑定" />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存更新' : '立即建档' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { Student, StudentStatus } from '@/types/student'
import { studentApi } from '@/api'
import { useTenantStore } from '@/stores/tenantStore'
import { DIALOG_SIZE } from '@/constants/ui'

const props = defineProps<{
  modelValue: boolean
  student?: Student | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'success', data?: any): void
}>()

const tenantStore = useTenantStore()
const formRef = ref<FormInstance>()
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const isEdit = computed(() => !!props.student)
const submitting = ref(false)

const form = reactive({
  name: '',
  studentNo: '',
  gender: 'male' as 'male' | 'female',
  age: 9,
  phone: '',
  campusId: tenantStore.currentCampusId,
  school: '',
  grade: '小学三年级',
  parentName: '',
  parentPhone: '',
  parentWechat: '',
  status: 'normal' as StudentStatus,
  wechatBound: true
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入学员姓名', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  campusId: [{ required: true, message: '请选择校区', trigger: 'change' }]
}

function initStudentForm() {
  const st = props.student
  if (st) {
    form.name = st.name
    form.studentNo = st.studentNo
    form.gender = st.gender
    form.age = st.age || 9
    form.phone = st.phone
    form.campusId = st.campusId
    form.school = st.school || st.publicSchool || ''
    form.grade = st.grade
    form.parentName = st.parentName || ''
    form.parentPhone = st.parentPhone || ''
    form.parentWechat = st.parentWechat || st.boundWechat || ''
    form.status = st.status
    form.wechatBound = st.wechatBound ?? false
  } else {
    form.name = ''
    form.studentNo = `S${Math.floor(100000 + Math.random() * 900000)}`
    form.gender = 'male'
    form.age = 9
    form.phone = ''
    form.campusId = tenantStore.currentCampusId
    form.school = ''
    form.grade = '小学三年级'
    form.parentName = ''
    form.parentPhone = ''
    form.parentWechat = ''
    form.status = 'normal'
    form.wechatBound = false
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      initStudentForm()
    }
  },
  { immediate: true }
)

watch(
  () => props.student,
  () => {
    if (props.modelValue) {
      initStudentForm()
    }
  }
)

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      if (isEdit.value && props.student) {
        await studentApi.updateStudent(props.student.id, {
          name: form.name,
          gender: form.gender,
          phone: form.phone,
          campusId: form.campusId,
          parentName: form.parentName,
          school: form.school,
          status: form.status,
        })

        ElMessage.success('学员档案更新成功并同步入库！')
        emit('success', { campusId: form.campusId })
      } else {
        // 向真实后端发送持久化请求
        const apiRes = await studentApi.createStudent({
          name: form.name,
          gender: form.gender,
          phone: form.phone,
          campusId: form.campusId,
          parentName: form.parentName,
          school: form.school,
          birthday: form.age ? `${2026 - form.age}-06-01` : undefined,
        })

        const createdStudentNo = apiRes.data?.studentNo || form.studentNo

        ElMessage.success(`新增学员建档成功！学号已同步入库：${createdStudentNo}`)
        emit('success', { campusId: form.campusId, studentNo: createdStudentNo })
      }
      visible.value = false
    } catch (err: any) {
      ElMessage.error(err.message || '学员录入失败')
    } finally {
      submitting.value = false
    }
  })
}
</script>
