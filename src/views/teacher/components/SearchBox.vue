<template>
  <form class="tp-search" role="search" @submit.prevent="submit">
    <Search />
    <input
      ref="inputEl"
      :value="modelValue"
      class="tp-input"
      type="search"
      enterkeyhint="search"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :placeholder="placeholder"
      :aria-label="placeholder"
      @input="onInput"
    />
    <button v-if="modelValue" type="button" class="tp-search-clear" aria-label="清空搜索" @click="clear">
      <CircleX class="w-[18px] h-[18px]" />
    </button>
  </form>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { CircleX, Search } from 'lucide-vue-next'

defineProps<{ modelValue: string; placeholder: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; search: [] }>()

const inputEl = ref<HTMLInputElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => emit('search'), 300)
}

/** 点键盘上的「搜索」后收起键盘，让出结果区域 */
function submit() {
  if (timer) clearTimeout(timer)
  inputEl.value?.blur()
  emit('search')
}

function clear() {
  if (timer) clearTimeout(timer)
  emit('update:modelValue', '')
  emit('search')
  inputEl.value?.focus()
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>
