<template>
  <div v-if="loading && !hasData" role="status">
    <span class="sr-only">加载中…</span>
    <span v-if="skeleton === 'hero'" class="tp-skeleton tp-skeleton--hero" aria-hidden="true" />
    <div v-else class="tp-list" aria-hidden="true">
      <div v-for="i in rows" :key="i" class="tp-row">
        <span class="tp-row__body">
          <span class="tp-skeleton tp-skeleton--line tp-skeleton--short" />
          <span class="tp-skeleton tp-skeleton--line tp-skeleton--mid" />
        </span>
      </div>
    </div>
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
      <span class="tp-grow">刷新失败，当前可能不是最新数据</span>
      <strong>重试</strong>
    </button>
    <div v-if="isEmpty" class="tp-state">
      <span class="tp-state__icon"><Inbox aria-hidden="true" /></span>
      <p class="tp-state__title">{{ emptyText }}</p>
      <p v-if="emptyHint">{{ emptyHint }}</p>
    </div>
    <slot v-else />
  </template>
</template>

<script setup lang="ts">
import { CircleAlert, Inbox } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    loading?: boolean
    error?: string
    hasData?: boolean
    isEmpty?: boolean
    emptyText?: string
    /** 说明之后这里会出现什么，或者接下来可以做什么 */
    emptyHint?: string
    skeleton?: 'list' | 'hero'
    rows?: number
  }>(),
  { emptyText: '暂无数据', skeleton: 'list', rows: 3 },
)

defineEmits<{ retry: [] }>()
</script>
