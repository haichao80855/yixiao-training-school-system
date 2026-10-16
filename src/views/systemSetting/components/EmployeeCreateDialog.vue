<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="新增系统在职员工"
    width="540px"
    destroy-on-close
  >
    <el-form :model="form" label-width="95px" size="small" class="pt-2">
      <div class="grid grid-cols-2 gap-x-3">
        <el-form-item label="员工姓名" required>
          <el-input v-model="form.name" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="登录账号" required>
          <el-input v-model="form.account" placeholder="英文字符登录账号" />
        </el-form-item>
      </div>
      <div class="grid grid-cols-2 gap-x-3">
        <el-form-item label="手机号码" required>
          <el-input v-model="form.phone" placeholder="11位手机号码" />
        </el-form-item>
        <el-form-item label="电子邮箱">
          <el-input v-model="form.email" placeholder="工作邮箱" />
        </el-form-item>
      </div>
      <div class="grid grid-cols-2 gap-x-3">
        <el-form-item label="管辖校区" required>
          <el-select v-model="form.campusId" class="w-full" @change="onCampusChange">
            <el-option
              v-for="c in campuses"
              :key="c.id || c.code"
              :label="c.name"
              :value="c.id || c.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="归属部门" required>
          <el-input v-model="form.departmentName" placeholder="如：教务教学部" />
        </el-form-item>
      </div>
      <div class="grid grid-cols-2 gap-x-3">
        <el-form-item label="岗位职务" required>
          <el-input v-model="form.postName" placeholder="如：少儿编程讲师" />
        </el-form-item>
        <el-form-item label="分配角色" required>
          <el-select v-model="form.roleId" class="w-full" @change="onRoleChange">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="数据透视范围" required>
        <el-radio-group v-model="form.dataScope">
          <el-radio value="all">全校区 (all)</el-radio>
          <el-radio value="campus">本校区 (campus)</el-radio>
          <el-radio value="department">本部门 (dept)</el-radio>
          <el-radio value="self">仅本人 (self)</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button size="small" @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" size="small" :loading="loading" @click="handleSubmit">确认录入</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { RoleItem, DataScope } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  campuses: any[]
  roles: RoleItem[]
  defaultCampusId?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'submit', form: any): void
}>()

const form = reactive({
  name: '',
  account: '',
  phone: '',
  email: '',
  campusId: '',
  campusName: '',
  departmentId: 'dept-hq-edu',
  departmentName: '教务教学部',
  postId: 'post-hq-teacher',
  postName: '少儿编程金牌讲师',
  roleId: 'r4',
  roleName: '少儿编程专职主讲教师',
  dataScope: 'self' as DataScope
})

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      form.name = ''
      form.account = `user_${Math.floor(Math.random() * 9000 + 1000)}`
      form.phone = '138' + Math.floor(Math.random() * 90000000 + 10000000)
      form.email = ''
      const initialCampus = props.campuses.find(c => c.id === props.defaultCampusId || c.code === props.defaultCampusId) || props.campuses[0]
      form.campusId = initialCampus ? (initialCampus.id || initialCampus.code) : 'campus-bj-hq'
      form.campusName = initialCampus ? initialCampus.name : '拓视未来-原阳校区'
      form.roleId = props.roles[0]?.id || 'r4'
      onRoleChange(form.roleId)
      form.dataScope = 'self'
    }
  }
)

function onCampusChange(cId: string) {
  const c = props.campuses.find(item => (item.id === cId || item.code === cId))
  if (c) {
    form.campusName = c.name
  }
}

function onRoleChange(rId: string) {
  const role = props.roles.find(r => r.id === rId)
  if (role) {
    form.roleName = role.name
    form.dataScope = role.dataScope
  }
}

function handleSubmit() {
  if (!form.name.trim() || !form.account.trim() || !form.phone.trim()) {
    ElMessage.warning('请补全员工姓名、账号和手机号')
    return
  }
  emit('submit', { ...form })
}
</script>
