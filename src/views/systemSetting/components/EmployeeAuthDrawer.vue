<template>
  <el-drawer
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="员工角色与数据权限配置"
    size="420px"
  >
    <div v-if="localUser" class="space-y-4 text-xs">
      <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div class="font-bold text-st-title text-sm">{{ localUser.name }}</div>
        <div class="text-st-muted mt-1 font-mono text-xs">
          账号：{{ localUser.account }} | 手机：{{ localUser.phone }}
        </div>
        <div class="text-st-secondary mt-1">
          归属：{{ localUser.campusName }} · {{ localUser.departmentName }} · {{ localUser.postName }}
        </div>
      </div>

      <div>
        <label class="block font-medium text-st-title mb-2">手机号码 (可用于登录)</label>
        <el-input v-model="localUser.phone" placeholder="11位手机号码" maxlength="20" />
      </div>

      <div>
        <label class="block font-medium text-st-title mb-2">绑定系统角色组</label>
        <el-select
          v-model="localUser.roleId"
          class="w-full"
          :disabled="roles.length === 0"
          @change="onRoleChange"
        >
          <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          <!-- 拿不到角色列表时，仍显示角色名称而不是内部 ID -->
          <el-option
            v-if="roles.length === 0"
            :label="localUser.roleName"
            :value="localUser.roleId"
          />
        </el-select>
        <p v-if="roles.length === 0" class="text-xs text-st-muted mt-1">
          当前账号无法查看角色列表，不能更换角色，其他配置可正常保存
        </p>
      </div>

      <div>
        <label class="block font-medium text-st-title mb-2">数据透视隔离范围 (Data Scope)</label>
        <div class="space-y-2">
          <div
            v-for="scope in dataScopeOptions"
            :key="scope.value"
            @click="localUser.dataScope = scope.value"
            :class="[
              'p-2.5 rounded border cursor-pointer transition flex items-start space-x-2.5',
              localUser.dataScope === scope.value
                ? 'border-st-primary bg-blue-50/50 text-st-primary'
                : 'border-slate-200 hover:bg-slate-50 text-st-title'
            ]"
          >
            <el-radio :value="scope.value" :model-value="localUser.dataScope" class="!mr-0 mt-0.5" />
            <div>
              <div class="font-bold text-xs">{{ scope.label }}</div>
              <div class="text-xs text-st-muted mt-0.5">{{ scope.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-4 border-t border-slate-100 flex justify-end space-x-2">
        <el-button @click="$emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { SystemUser, RoleItem, DataScope } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  user: SystemUser | null
  roles: RoleItem[]
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'save', payload: { userId: string; roleId: string; campusId: string; dataScope: DataScope; phone?: string }): void
}>()

const localUser = ref<SystemUser | null>(null)

watch(
  () => props.user,
  (val) => {
    if (val) {
      localUser.value = { ...val }
    } else {
      localUser.value = null
    }
  },
  { immediate: true }
)

const dataScopeOptions: { value: DataScope; label: string; desc: string }[] = [
  { value: 'all', label: '全部校区数据 (all)', desc: '穿透全集团所有校区数据，集团管理层专属' },
  { value: 'campus', label: '仅本校区数据 (campus)', desc: '仅透视所属实体校区内全部业务数据，分校校长专属' },
  { value: 'department', label: '仅本部门数据 (department)', desc: '限制在所属业务部门与教研组范围内，主管级专属' },
  { value: 'self', label: '仅本人数据 (self)', desc: '严格隔离仅可查阅自己名下的学员与考勤排课，专职教师专属' }
]

function onRoleChange(rId: string) {
  if (!localUser.value) return
  const role = props.roles.find(r => r.id === rId)
  if (role) {
    localUser.value.roleName = role.name
    localUser.value.dataScope = role.dataScope
  }
}

function handleSave() {
  if (!localUser.value) return
  const phone = (localUser.value.phone || '').trim()
  // 只提交改动过的号码，历史不规范号码不阻塞角色与数据范围的保存
  const phoneChanged = phone !== (props.user?.phone || '').trim()
  if (phoneChanged && !/^1\d{10}$/.test(phone)) {
    ElMessage.warning('手机号码格式不正确，请填写 11 位手机号码')
    return
  }
  emit('save', {
    userId: localUser.value.id,
    roleId: localUser.value.roleId,
    campusId: localUser.value.campusId,
    dataScope: localUser.value.dataScope,
    ...(phoneChanged ? { phone } : {}),
  })
}
</script>
