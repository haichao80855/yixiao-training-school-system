<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="新增系统在职员工"
    :width="DIALOG_SIZE.md"
    destroy-on-close
  >
    <el-form :model="form" :label-width="FORM_LABEL_WIDTH.md" size="small" class="pt-2">
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
        <el-form-item label="归属部门/岗位" required>
          <el-select v-model="form.departmentId" class="w-full" placeholder="请选择">
            <el-option v-for="o in orgOptions" :key="o.id" :label="o.label" :value="o.id" />
          </el-select>
        </el-form-item>
      </div>
      <div class="-mt-2 mb-2 text-xs text-gray-400">
        如需细分部门或岗位，请先在左侧组织架构中新增，再回来选择
      </div>
      <div class="grid grid-cols-2 gap-x-3">
        <el-form-item label="分配角色" required>
          <el-select v-model="form.roleId" class="w-full" placeholder="请选择角色" @change="onRoleChange">
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
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DIALOG_SIZE, FORM_LABEL_WIDTH } from '@/constants/ui'
import type { RoleItem, DataScope, OrgNode } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  campuses: any[]
  roles: RoleItem[]
  orgTree: OrgNode[]
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
  departmentId: '',
  roleId: '',
  roleName: '',
  dataScope: 'self' as DataScope
})

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      form.name = ''
      form.account = `user_${Math.floor(Math.random() * 9000 + 1000)}`
      // 手机号是登录凭据，不能预填：随机号码格式合法，未改动就会绑定到陌生号码上
      form.phone = ''
      form.email = ''
      const initialCampus = props.campuses.find(c => c.id === props.defaultCampusId || c.code === props.defaultCampusId) || props.campuses[0]
      form.campusId = initialCampus ? (initialCampus.id || initialCampus.code) : ''
      form.campusName = initialCampus ? initialCampus.name : ''
      form.departmentId = orgOptions.value[0]?.id || ''
      // 角色必须手动选择，避免默认选中列表第一个 (超级管理员) 而误建高权限账号
      form.roleId = ''
      form.roleName = ''
      form.dataScope = 'self'
    }
  }
)

function onCampusChange(cId: string) {
  const c = props.campuses.find(item => (item.id === cId || item.code === cId))
  if (c) {
    form.campusName = c.name
  }
  form.departmentId = orgOptions.value[0]?.id || ''
}

/** 当前校区组织子树：校区节点本身 (校区直属) + 其下部门与岗位，均为真实存在的组织节点 */
const orgOptions = computed(() => {
  const options: { id: string; label: string }[] = []
  const findCampusNode = (nodes: OrgNode[]): OrgNode | undefined => {
    for (const n of nodes) {
      if (n.type === 'campus' && n.campusId === form.campusId) return n
      const hit = n.children ? findCampusNode(n.children) : undefined
      if (hit) return hit
    }
    return undefined
  }
  const campusNode = findCampusNode(props.orgTree || [])
  if (!campusNode) return options
  options.push({ id: campusNode.id, label: `${campusNode.name}（校区直属）` })
  const walk = (nodes: OrgNode[] | undefined, prefix: string) => {
    for (const n of nodes || []) {
      const label = prefix ? `${prefix} / ${n.name}` : n.name
      options.push({ id: n.id, label })
      walk(n.children, label)
    }
  }
  walk(campusNode.children, '')
  return options
})

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
  if (!/^1\d{10}$/.test(form.phone.trim())) {
    ElMessage.warning('手机号码格式不正确，请填写 11 位手机号码')
    return
  }
  if (!form.campusId || !form.departmentId || !form.roleId) {
    ElMessage.warning('请选择管辖校区、归属部门/岗位和角色')
    return
  }
  emit('submit', { ...form })
}
</script>
