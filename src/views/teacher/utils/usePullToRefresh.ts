import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

const TRIGGER_DISTANCE = 56;
const MAX_DISTANCE = 80;
const RESISTANCE = 0.5;
const MIN_SPIN_MS = 400;

/** 滚动容器设了 overscroll-contain，浏览器自带的下拉刷新不生效，这里自己实现 */
export function usePullToRefresh(scroller: Ref<HTMLElement | null>, getRefresh: () => (() => unknown) | null) {
  const distance = ref(0);
  const refreshing = ref(false);
  let startY: number | null = null;
  let startX = 0;

  function onTouchStart(event: TouchEvent) {
    const target = event.target as HTMLElement;
    const blocked = target.closest('input, textarea, select, video, .el-image');
    startY =
      !refreshing.value && !blocked && getRefresh() && scroller.value?.scrollTop === 0 && event.touches.length === 1
        ? event.touches[0].clientY
        : null;
    startX = event.touches[0]?.clientX ?? 0;
  }

  function onTouchMove(event: TouchEvent) {
    if (startY === null) return;
    const dy = event.touches[0].clientY - startY;
    const dx = Math.abs(event.touches[0].clientX - startX);
    // 上滑或横滑交还给页面 (如课表左右滑动翻周)
    if (dy <= 0 || (distance.value === 0 && dx > dy)) {
      startY = null;
      distance.value = 0;
      return;
    }
    if (event.cancelable) event.preventDefault();
    distance.value = Math.min(dy * RESISTANCE, MAX_DISTANCE);
  }

  async function onTouchEnd() {
    if (startY === null) return;
    startY = null;
    const refresh = getRefresh();
    if (distance.value < TRIGGER_DISTANCE || !refresh) {
      distance.value = 0;
      return;
    }
    refreshing.value = true;
    distance.value = TRIGGER_DISTANCE;
    const started = Date.now();
    try {
      await refresh();
    } finally {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_SPIN_MS - (Date.now() - started))));
      refreshing.value = false;
      distance.value = 0;
    }
  }

  onMounted(() => {
    const el = scroller.value;
    if (!el) return;
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    // 需要 preventDefault 阻止回弹，不能是 passive
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
  });

  onBeforeUnmount(() => {
    const el = scroller.value;
    if (!el) return;
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', onTouchEnd);
  });

  return { distance, refreshing, triggerDistance: TRIGGER_DISTANCE };
}
