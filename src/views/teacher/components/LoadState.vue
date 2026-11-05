<template>
  <div v-if="loading && !hasData" class="py-12 flex flex-col items-center gap-2 text-st-muted text-[13px]">
    <Loader2 class="w-5 h-5 animate-spin" />
    <span>加载中…</span>
  </div>
  <div v-else-if="error && !hasData" class="py-12 px-6 flex flex-col items-center gap-3 text-center">
    <CircleAlert class="w-7 h-7 text-st-danger" />
    <p class="text-[14px] text-st-secondary m-0">{{ error }}</p>
    <button type="button" class="tp-btn tp-btn-secondary" @click="$emit('retry')">重新加载</button>
  </div>
  <template v-else>
    <!-- 后台刷新失败 (弱网很常见) 时保留已有内容，只提示数据可能不是最新 -->
    <button v-if="error" type="button" class="tp-stale-notice" @click="$emit('retry')">
      <CircleAlert class="w-4 h-4 shrink-0" />
      <span class="flex-1 text-left">刷新失败，当前可能不是最新数据</span>
      <span class="font-medium">重试</span>
    </button>
    <div v-if="isEmpty" class="py-12 px-6 flex flex-col items-center gap-2 text-center text-st-muted">
      <Inbox class="w-8 h-8 text-st-placeholder" />
      <p class="text-[14px] m-0">{{ emptyText }}</p>
    </div>
    <slot v-else />
  </template>
</template>

<script setup lang="ts">
import { CircleAlert, Inbox, Loader2 } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    loading?: boolean
    error?: string
    hasData?: boolean
    isEmpty?: boolean
    emptyText?: string
  }>(),
  { emptyText: '暂无数据' },
)

defineEmits<{ retry: [] }>()
</script>
