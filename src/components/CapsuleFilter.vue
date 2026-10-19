<template>
  <div class="capsule-filter-row flex items-center text-xs">
    <span v-if="label" class="capsule-label w-20 text-st-muted font-medium shrink-0">
      {{ label }}
    </span>
    <div class="flex flex-wrap items-center gap-1.5 flex-1">
      <el-button
        v-for="item in normalizedOptions"
        :key="String(item.value)"
        size="small"
        round
        :disabled="item.disabled"
        :type="isSelected(item.value) ? 'primary' : 'default'"
        class="!m-0 !px-3 text-xs"
        @click="handleClick(item.value)"
      >
        <span>{{ item.label }}</span>
        <span
          v-if="item.count !== undefined"
          :class="[
            'text-[10px] px-1 py-0.2 rounded-full ml-1',
            isSelected(item.value) ? 'bg-white/25 text-white' : 'bg-gray-100 text-st-muted'
          ]"
        >
          {{ item.count }}
        </span>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface FilterOption {
  label: string
  value: string | number
  count?: number
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | (string | number)[]
    options?: (FilterOption | string)[]
    label?: string
    multiple?: boolean
    allValue?: string | number
  }>(),
  {
    modelValue: 'all',
    options: () => [],
    label: '',
    multiple: false,
    allValue: 'all'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
  (e: 'change', value: any): void
}>()

const normalizedOptions = computed<FilterOption[]>(() => {
  return props.options.map(opt => {
    if (typeof opt === 'string') {
      return {
        label: opt,
        value: opt === '全部' ? props.allValue : opt
      }
    }
    return opt
  })
})

function isSelected(val: string | number): boolean {
  if (props.multiple && Array.isArray(props.modelValue)) {
    return props.modelValue.includes(val)
  }
  return props.modelValue === val
}

function handleClick(val: string | number) {
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    if (val === props.allValue) {
      const next = [props.allValue]
      emit('update:modelValue', next)
      emit('change', next)
      return
    }
    const filtered = current.filter(v => v !== props.allValue)
    const index = filtered.indexOf(val)
    if (index > -1) {
      filtered.splice(index, 1)
    } else {
      filtered.push(val)
    }
    const next = filtered.length === 0 ? [props.allValue] : filtered
    emit('update:modelValue', next)
    emit('change', next)
  } else {
    emit('update:modelValue', val)
    emit('change', val)
  }
}
</script>

<style scoped>
.capsule-filter-row {
  line-height: 1.5;
}
</style>
