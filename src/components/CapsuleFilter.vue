<template>
  <div class="capsule-filter-row flex items-center text-xs">
    <span v-if="label" class="capsule-label w-20 text-[#8C8C8C] font-medium shrink-0">
      {{ label }}
    </span>
    <div class="flex flex-wrap items-center gap-1.5 flex-1">
      <button
        v-for="item in normalizedOptions"
        :key="String(item.value)"
        type="button"
        :disabled="item.disabled"
        @click="handleClick(item.value)"
        :class="[
          'px-3 py-1 rounded-full transition-all duration-150 text-xs inline-flex items-center space-x-1 select-none focus:outline-none',
          isSelected(item.value)
            ? 'bg-[#1890FF] text-white font-medium shadow-sm shadow-blue-200'
            : 'text-[#595959] hover:text-[#1890FF] hover:bg-[#F5F5F5] active:bg-[#E6F7FF]'
        ]"
      >
        <span>{{ item.label }}</span>
        <span
          v-if="item.count !== undefined"
          :class="[
            'text-[10px] px-1 py-0.2 rounded-full ml-0.5',
            isSelected(item.value) ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
          ]"
        >
          {{ item.count }}
        </span>
      </button>
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
