<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="重置员工密码"
    :width="DIALOG_SIZE.sm"
    destroy-on-close
  >
    <div class="text-xs space-y-3 pt-2">
      <div class="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900 leading-relaxed">
        正在为员工 <span class="font-bold text-st-primary">{{ user?.name }}</span> (账号：<span class="font-mono font-medium">{{ user?.account }}</span>) 设置新的登录密码。重置后旧密码立即失效。
      </div>

      <div>
        <label class="block font-medium text-st-title mb-1">
          <span class="text-rose-500 mr-0.5">*</span>新登录密码
        </label>
        <el-input
          v-model="password"
          type="password"
          show-password
          placeholder="请输入重置后的新密码"
          size="small"
        />
      </div>

      <div>
        <label class="block font-medium text-st-title mb-1">
          <span class="text-rose-500 mr-0.5">*</span>确认新密码
        </label>
        <el-input
          v-model="confirmPassword"
          type="password"
          show-password
          placeholder="请再次输入新密码"
          size="small"
        />
      </div>

      <div class="flex items-center justify-between text-[11px] text-st-muted pt-1">
        <span>建议密码长度为 6 位以上</span>
        <el-button link type="primary" size="small" @click="fillDefaultPassword">
          快捷填入默认密码 (123456)
        </el-button>
      </div>
    </div>
    <template #footer>
      <el-button size="small" @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" size="small" :loading="loading" @click="handleSubmit">确认重置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DIALOG_SIZE } from '@/constants/ui'
import type { SystemUser } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  user: SystemUser | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'submit', password: string): void
}>()

const password = ref('')
const confirmPassword = ref('')

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      password.value = ''
      confirmPassword.value = ''
    }
  }
)

function fillDefaultPassword() {
  password.value = '123456'
  confirmPassword.value = '123456'
}

function handleSubmit() {
  const p = password.value.trim()
  const cp = confirmPassword.value.trim()
  if (!p) {
    ElMessage.warning('请输入重置后的新密码')
    return
  }
  if (p.length < 6) {
    ElMessage.warning('密码长度不能少于 6 位')
    return
  }
  if (p !== cp) {
    ElMessage.warning('两次输入的密码不一致，请核对')
    return
  }
  emit('submit', p)
}
</script>
