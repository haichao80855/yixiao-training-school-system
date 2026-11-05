<template>
  <header class="tp-page-title">
    <div class="tp-page-title__text">
      <!-- 没有内容时也占位，切换标签时标题不跳动 -->
      <p class="tp-page-title__overline tp-num">{{ overline }}</p>
      <h1 class="tp-page-title__title">{{ title }}</h1>
    </div>
    <slot />
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; overline?: string }>()
</script>
