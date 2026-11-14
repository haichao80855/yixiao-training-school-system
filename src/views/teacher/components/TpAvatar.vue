<template>
  <span class="tp-avatar" :class="[`tp-avatar--tone-${tone}`, { 'tp-avatar--lg': size === 'lg' }]" aria-hidden="true">{{ text }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { avatarText, avatarTone } from '../utils/avatar'

const props = defineProps<{
  name: string | null | undefined
  /** 决定颜色：传学员 / 老师 ID，同一个人在各页面颜色一致 */
  seed?: string | null
  size?: 'md' | 'lg'
}>()

const text = computed(() => avatarText(props.name))
const tone = computed(() => avatarTone(props.seed || props.name))
</script>
