<template>
  <div v-show="visible" class="route-progress" :style="{ transform: `scaleX(${progress})`, opacity: done ? 0 : 1 }" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * 页面切换顶部进度条：点菜单后如果 120ms 内新页面还没出来 (要下载页面代码)，顶部出现一条细进度条，
 * 让用户知道已经在加载，而不是以为没点上。切换很快时不出现，避免闪一下。
 */
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const visible = ref(false)
const done = ref(false)
const progress = ref(0)
let showTimer: ReturnType<typeof setTimeout> | null = null
let creepTimer: ReturnType<typeof setInterval> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (showTimer) clearTimeout(showTimer)
  if (creepTimer) clearInterval(creepTimer)
  if (hideTimer) clearTimeout(hideTimer)
  showTimer = creepTimer = hideTimer = null
}

function start() {
  clearTimers()
  done.value = false
  showTimer = setTimeout(() => {
    progress.value = 0.15
    visible.value = true
    // 慢慢逼近 90%，等页面真正出来再走满
    creepTimer = setInterval(() => {
      progress.value = Math.min(0.9, progress.value + (0.9 - progress.value) * 0.15)
    }, 120)
  }, 120)
}

function finish() {
  const wasVisible = visible.value
  clearTimers()
  if (!wasVisible) return
  progress.value = 1
  done.value = true
  hideTimer = setTimeout(() => {
    visible.value = false
    progress.value = 0
  }, 250)
}

const removeBefore = router.beforeEach((to, from) => {
  if (to.path !== from.path) start()
})
const removeAfter = router.afterEach(() => finish())
const removeError = router.onError(() => finish())

onBeforeUnmount(() => {
  clearTimers()
  removeBefore()
  removeAfter()
  removeError()
})
</script>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 3000;
  background: var(--st-primary, #2563eb);
  transform-origin: left center;
  transition: transform 0.2s ease, opacity 0.25s ease;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .route-progress {
    transition: none;
  }
}
</style>
