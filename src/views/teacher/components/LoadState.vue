<template>
  <div v-if="loading && !hasData" class="tp-state" role="status">
    <Loader2 class="tp-spin" aria-hidden="true" />
    <p>加载中…</p>
  </div>
  <div v-else-if="error && !hasData" class="tp-state tp-state--error">
    <CircleAlert aria-hidden="true" />
    <p>{{ error }}</p>
    <button type="button" class="tp-btn tp-btn-secondary tp-btn-sm" @click="$emit('retry')">重新加载</button>
  </div>
  <template v-else>
    <!-- 后台刷新失败 (弱网很常见) 时保留已有内容，只提示数据可能不是最新 -->
    <button v-if="error" type="button" class="tp-stale-notice" @click="$emit('retry')">
      <CircleAlert aria-hidden="true" />
      <span style="flex: 1">刷新失败，当前可能不是最新数据</span>
      <strong>重试</strong>
    </button>
    <div v-if="isEmpty" class="tp-state">
      <Inbox aria-hidden="true" />
      <p>{{ emptyText }}</p>
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
