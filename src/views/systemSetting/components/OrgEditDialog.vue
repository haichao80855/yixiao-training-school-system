<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="编辑机构工商与授权信息"
    width="500px"
    destroy-on-close
  >
    <el-form :model="form" label-width="95px" size="small" class="pt-2">
      <el-form-item label="机构全称" required>
        <el-input v-model="form.name" placeholder="请输入机构工商登记全称" />
      </el-form-item>
      <el-form-item label="上市代码">
        <el-input v-model="form.stockCode" placeholder="A股证券代码" />
      </el-form-item>
      <el-form-item label="机构编码">
        <el-input :value="form.code" disabled />
      </el-form-item>
      <el-form-item label="法人代表">
        <el-input v-model="form.legalPerson" placeholder="工商登记法定代表人" />
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="form.phone" placeholder="总部办公电话" />
      </el-form-item>
      <el-form-item label="授权有效期">
        <el-input v-model="form.validUntil" placeholder="格式如：2028-12-31" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button size="small" @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" size="small" :loading="saving" @click="handleSave">保存修改</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CompanyInfo } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  orgMeta: CompanyInfo
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'save', payload: Partial<CompanyInfo>): void
}>()

const form = reactive({
  name: '',
  stockCode: '',
  code: '',
  legalPerson: '',
  phone: '',
  validUntil: '',
})

watch(
  () => props.modelValue,
  (val) => {
    if (val && props.orgMeta) {
      form.name = props.orgMeta.name || ''
      form.stockCode = props.orgMeta.stockCode || ''
      form.code = props.orgMeta.code || ''
      form.legalPerson = props.orgMeta.legalPerson || ''
      form.phone = props.orgMeta.phone || ''
      form.validUntil = props.orgMeta.validUntil || ''
    }
  },
  { immediate: true }
)

function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入机构全称')
    return
  }
  emit('save', {
    name: form.name,
    stockCode: form.stockCode,
    legalPerson: form.legalPerson,
    phone: form.phone,
    validUntil: form.validUntil,
  })
}
</script>
