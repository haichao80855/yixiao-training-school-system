<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="parent ? `在 [${parent.name}] 下新建下级节点` : '新建组织架构节点'"
    :width="DIALOG_SIZE.sm"
    destroy-on-close
  >
    <el-form :model="form" label-width="95px" size="small" class="pt-2">
      <el-form-item label="上级节点">
        <el-input :value="parent ? parent.name : '集团总部 (顶级)'" disabled />
      </el-form-item>
      <el-form-item label="节点层级">
        <el-tag size="small" :class="getLevelTagClass(computedLevel)">
          第 {{ computedLevel }} 级 - {{ getLevelName(computedLevel) }}
        </el-tag>
      </el-form-item>
      <el-form-item label="节点名称" required>
        <el-input v-model="form.name" placeholder="如：少儿编程创新教研室" />
      </el-form-item>
      <el-form-item label="组织编码" required>
        <el-input v-model="form.code" placeholder="如：HQ-EDU-DEV01" />
      </el-form-item>
      <el-form-item label="负责人">
        <el-input v-model="form.leader" placeholder="填写节点负责人姓名" />
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="form.phone" placeholder="负责人工作电话" />
      </el-form-item>
      <el-form-item v-if="computedLevel === 3 || form.type === 'campus'" label="校区物理地址">
        <el-input v-model="form.address" placeholder="如：北京市海淀区中关村南大街1号" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button size="small" @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" size="small" :loading="loading" @click="handleSubmit">确定新建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DIALOG_SIZE } from '@/constants/ui'
import type { OrgNode, OrgNodeType } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  parent: OrgNode | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'submit', form: any): void
}>()

const form = reactive({
  name: '',
  code: '',
  leader: '',
  phone: '',
  address: '',
  type: 'department' as OrgNodeType,
})

const computedLevel = computed(() => {
  return props.parent ? props.parent.level + 1 : 2
})

function getLevelName(level: number): string {
  switch (level) {
    case 1: return '集团'
    case 2: return '大区'
    case 3: return '校区'
    case 4: return '部门'
    case 5: return '岗位'
    default: return '单元'
  }
}

function getLevelTagClass(level: number): string {
  switch (level) {
    case 1: return 'bg-purple-100 text-purple-700'
    case 2: return 'bg-blue-100 text-blue-700'
    case 3: return 'bg-emerald-100 text-emerald-700'
    case 4: return 'bg-amber-100 text-amber-700'
    case 5: return 'bg-slate-100 text-slate-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      form.name = ''
      form.code = `NODE-${Math.floor(Math.random() * 9000 + 1000)}`
      form.leader = ''
      form.phone = ''
      form.address = ''
      const lvl = computedLevel.value
      if (lvl === 2) form.type = 'region'
      else if (lvl === 3) form.type = 'campus'
      else if (lvl === 4) form.type = 'department'
      else if (lvl === 5) form.type = 'post'
      else form.type = 'department'
    }
  }
)

function handleSubmit() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入组织节点名称')
    return
  }
  emit('submit', {
    ...form,
    level: computedLevel.value,
    parentId: props.parent ? props.parent.id : null,
  })
}
</script>
