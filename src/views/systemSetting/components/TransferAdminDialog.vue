<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="转让超级管理员最高权限"
    :width="DIALOG_SIZE.sm"
    destroy-on-close
  >
    <div class="text-xs space-y-3 pt-2">
      <div class="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 flex items-start space-x-2">
        <el-icon class="text-base text-amber-600 shrink-0 mt-0.5"><WarningFilled /></el-icon>
        <div class="text-[11px] leading-relaxed">
          <strong>风险警告：</strong>转让超级管理员后，您的账号将自动降级为执行校长角色，接收方员工将获得集团全量业务审批与组织根节点控制权！此操作将立即写入数据库生效。
        </div>
      </div>
      <div>
        <label class="block font-medium text-st-title mb-1">选择接收转让的在职员工</label>
        <el-select v-model="targetUserId" placeholder="请选择员工" class="w-full" size="small">
          <el-option
            v-for="u in eligibleUsers"
            :key="u.id"
            :label="`${u.name} (${u.account} - ${u.campusName})`"
            :value="u.id"
          />
        </el-select>
      </div>
      <div>
        <label class="block font-medium text-st-title mb-1">请输入当前超管密码确认</label>
        <el-input
          v-model="confirmPassword"
          type="password"
          show-password
          placeholder="验证当前登录管理员密码"
          size="small"
        />
      </div>
    </div>
    <template #footer>
      <el-button size="small" @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="danger" size="small" :loading="submitting" @click="handleSubmit">确认转让</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { DIALOG_SIZE } from '@/constants/ui'
import type { SystemUser } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  users: SystemUser[]
  currentAdminUserId?: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'submit', payload: { targetUserId: string; password: string }): void
}>()

const targetUserId = ref('')
const confirmPassword = ref('')

const eligibleUsers = computed(() => {
  return props.users.filter(u => u.id !== props.currentAdminUserId && u.account !== 'donghaichao')
})

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      targetUserId.value = ''
      confirmPassword.value = ''
    }
  }
)

function handleSubmit() {
  if (!targetUserId.value) {
    ElMessage.warning('请选择接收转让的在职员工')
    return
  }
  if (!confirmPassword.value) {
    ElMessage.warning('请输入密码进行安全校验')
    return
  }
  emit('submit', {
    targetUserId: targetUserId.value,
    password: confirmPassword.value,
  })
}
</script>
