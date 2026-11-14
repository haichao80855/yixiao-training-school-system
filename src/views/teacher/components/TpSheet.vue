<template>
  <!-- 挂到布局里的 #tp-overlays：在滚动区和下拉刷新的位移之外，fixed 定位不会被带偏 -->
  <Teleport to="#tp-overlays" :disabled="!hasOverlayRoot">
    <!-- 背景与面板分开运动，时长由这里给出：进入按弹簧停下的时间，离开为短时长 -->
    <Transition name="tp-sheet" :duration="{ enter: 600, leave: 260 }">
      <div v-if="open" class="tp-sheet" :class="{ 'is-dragged': dismissedByDrag }">
        <div ref="backdrop" class="tp-sheet__backdrop" @click="close" @touchmove.prevent />
        <section
          ref="panel"
          class="tp-sheet__panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <!-- 拖拽区：抓手和标题栏。手指拖住面板下拉即可关闭，和 iOS 的底部面板一样 -->
          <div
            class="tp-sheet__grab"
            @pointerdown="onDragStart"
            @pointermove="onDragMove"
            @pointerup="onDragEnd"
            @pointercancel="onDragEnd"
          >
          <span class="tp-sheet__grabber" aria-hidden="true" />
          <header class="tp-sheet__head">
            <h2 :id="titleId" class="tp-sheet__title">{{ title }}</h2>
            <slot name="meta" />
            <button v-if="closable" type="button" class="tp-icon-btn tp-sheet__close" aria-label="关闭" @click="close">
              <X aria-hidden="true" />
            </button>
          </header>
          </div>
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
import { animateSpring, rubberBand, SPRINGS } from '../utils/spring'

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

// ---------- 拖拽关闭 ----------
// 面板跟着手指走；往上拖有橡皮筋阻力；松手时按距离和速度决定关闭还是弹回，手指的速度延续到弹簧里
const backdrop = ref<HTMLElement | null>(null)
const dismissedByDrag = ref(false)
let dragStartY = 0
let dragOffset = 0
let dragging = false
let samples: Array<{ y: number; t: number }> = []
let stopSpring: (() => void) | null = null

function setOffset(offset: number) {
  dragOffset = offset
  const el = panel.value
  if (!el) return
  el.style.transform = offset === 0 ? '' : `translateY(${offset}px)`
  const height = el.offsetHeight || 1
  if (backdrop.value) backdrop.value.style.opacity = offset > 0 ? String(Math.max(0, 1 - offset / height)) : ''
}

function onDragStart(event: PointerEvent) {
  // 关闭按钮等控件照常点击，不当作拖拽
  if ((event.target as HTMLElement).closest('button, a, input, select')) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  // 弹簧还在运动时再次按住：停在当前位置，从这里接着拖 (动画可打断)
  stopSpring?.()
  stopSpring = null
  dragging = true
  dragStartY = event.clientY - dragOffset
  samples = [{ y: event.clientY, t: event.timeStamp }]
  // 手指移出拖拽区也继续跟随；个别浏览器不支持时退化为只在拖拽区内跟随
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    /* 忽略 */
  }
}

function onDragMove(event: PointerEvent) {
  if (!dragging || !panel.value) return
  const raw = event.clientY - dragStartY
  setOffset(raw >= 0 ? raw : rubberBand(raw, panel.value.offsetHeight))
  samples.push({ y: event.clientY, t: event.timeStamp })
  // 只用最近 100ms 的轨迹算松手速度
  while (samples.length > 2 && event.timeStamp - samples[0].t > 100) samples.shift()
}

function onDragEnd(event: PointerEvent) {
  if (!dragging || !panel.value) return
  dragging = false
  const first = samples[0]
  const elapsed = (event.timeStamp - first.t) / 1000
  const velocity = elapsed > 0 ? (event.clientY - first.y) / elapsed : 0
  const height = panel.value.offsetHeight
  const shouldClose = dragOffset > 0 && (dragOffset > height * 0.35 || velocity > 800)
  if (shouldClose) {
    stopSpring = animateSpring({
      from: dragOffset,
      to: height,
      velocity: Math.max(velocity, 0),
      params: SPRINGS.smooth,
      onUpdate: setOffset,
      onComplete: () => {
        stopSpring = null
        dismissedByDrag.value = true
        close()
      },
    })
  } else {
    stopSpring = animateSpring({
      from: dragOffset,
      to: 0,
      velocity,
      params: SPRINGS.snappy,
      onUpdate: setOffset,
      onComplete: () => (stopSpring = null),
    })
  }
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
      stopSpring?.()
      stopSpring = null
      dragOffset = 0
      dismissedByDrag.value = false
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
  stopSpring?.()
  if (returnFocus?.isConnected) returnFocus.focus()
})
</script>
