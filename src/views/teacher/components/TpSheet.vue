<template>
  <!-- 挂到布局里的 #tp-overlays：在滚动区和下拉刷新的位移之外，fixed 定位不会被带偏 -->
  <Teleport to="#tp-overlays" :disabled="!hasOverlayRoot">
    <Transition name="tp-sheet">
      <div v-if="open" class="tp-sheet" @click.self="close" @touchmove.self.prevent>
        <section
          ref="panel"
          class="tp-sheet__panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <header class="tp-sheet__head">
            <h2 :id="titleId" class="tp-sheet__title">{{ title }}</h2>
            <slot name="meta" />
            <button v-if="closable" type="button" class="tp-icon-btn tp-sheet__close" aria-label="关闭" @click="close">
              <X aria-hidden="true" />
            </button>
          </header>
          <div class="tp-sheet__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="tp-sheet__footer">
            <slot name="footer" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** 确认框不提供右上角关闭：只能选两个按钮之一 */
    closable?: boolean
  }>(),
  { closable: true },
)
const emit = defineEmits<{ (e: 'close'): void }>()

let seq = 0
const titleId = `tp-sheet-title-${Date.now().toString(36)}-${++seq}`
const hasOverlayRoot = typeof document !== 'undefined' && !!document.getElementById('tp-overlays')
const panel = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null

function close() {
  emit('close')
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Esc 关闭；Tab 只在弹层内循环，焦点不会跑到被遮住的页面上 */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closable) {
    event.stopPropagation()
    close()
    return
  }
  if (event.key !== 'Tab' || !panel.value) return
  const items = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (items.length === 0) return
  const first = items.at(0)!
  const last = items.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      returnFocus = document.activeElement as HTMLElement | null
      await nextTick()
      panel.value?.focus()
    } else if (returnFocus?.isConnected) {
      returnFocus.focus()
      returnFocus = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (returnFocus?.isConnected) returnFocus.focus()
})
</script>
