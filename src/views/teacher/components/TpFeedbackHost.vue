<template>
  <TpSheet :open="!!request" :title="request?.title || ''" :closable="false" @close="settleConfirm(false)">
    <p class="tp-confirm__message">{{ request?.message }}</p>
    <template #footer>
      <button v-if="!request?.alert" type="button" class="tp-btn tp-btn-secondary tp-grow" @click="settleConfirm(false)">
        {{ request?.cancelText || '取消' }}
      </button>
      <button
        type="button"
        class="tp-btn tp-grow"
        :class="request?.danger ? 'tp-btn-danger-solid' : 'tp-btn-primary'"
        @click="settleConfirm(true)"
      >
        {{ request?.confirmText || (request?.alert ? '知道了' : '确定') }}
      </button>
    </template>
  </TpSheet>

  <!-- 读屏软件会读出提示内容；提示不抢焦点 -->
  <div class="tp-toast-region" role="status" aria-live="polite">
    <Transition name="tp-toast">
      <p v-if="toast" :key="toast.id" class="tp-toast" :class="`tp-toast--${toast.type}`">
        <CircleCheck v-if="toast.type === 'success'" aria-hidden="true" />
        <CircleAlert v-else aria-hidden="true" />
        <span>{{ toast.message }}</span>
      </p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { CircleAlert, CircleCheck } from 'lucide-vue-next'
import TpSheet from './TpSheet.vue'
import { feedbackState, settleConfirm } from '../utils/feedback'

const request = computed(() => feedbackState.confirm)
const toast = computed(() => feedbackState.toast)

onMounted(() => {
  feedbackState.hostMounted = true
})
onBeforeUnmount(() => {
  feedbackState.hostMounted = false
  settleConfirm(false)
})
</script>
