import type { Directive } from 'vue';

/**
 * 分段控件的滑块：选中项变化时，底下的白色滑块从旧位置平滑滑到新位置 (iOS 分段控件的手感)。
 *
 * 用法：<div v-tp-segment class="tp-segment">…<button class="tp-segment-item is-active">…</div>
 * 指令只写三个 CSS 变量 (--seg-x / --seg-w / --seg-bg)，滑块本身由 teacher.css 的 ::before 画出。
 * 选中项可以用 --thumb-bg 指定滑块颜色 (点名里的迟到 / 请假 / 缺勤)。
 */

interface SegmentState {
  mutation: MutationObserver;
  resize: ResizeObserver | null;
  frame: number;
}

const states = new WeakMap<HTMLElement, SegmentState>();

function measure(el: HTMLElement) {
  const active = el.querySelector<HTMLElement>(':scope > .is-active');
  if (!active || active.offsetWidth === 0) {
    el.dataset.thumb = active ? 'on' : 'none';
    return;
  }
  el.style.setProperty('--seg-x', `${active.offsetLeft}px`);
  el.style.setProperty('--seg-w', `${active.offsetWidth}px`);
  const bg = getComputedStyle(active).getPropertyValue('--thumb-bg').trim();
  el.style.setProperty('--seg-bg', bg || 'var(--tp-surface)');
  el.dataset.thumb = 'on';
  // 第一次定位不做动画，否则页面打开时滑块会从最左边滑过来
  if (!el.dataset.thumbReady) {
    requestAnimationFrame(() => {
      el.dataset.thumbReady = '1';
    });
  }
}

export const vTpSegment: Directive<HTMLElement> = {
  mounted(el) {
    const state: SegmentState = {
      mutation: new MutationObserver(() => measure(el)),
      resize: typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure(el)),
      frame: 0,
    };
    // 选中项的 class 变化 (切换)、子项增减 (计数变化) 都要重新定位
    state.mutation.observe(el, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
    // 宽度变化 (旋转屏幕、字体加载完成、缓存页面重新显示) 也要重新定位
    state.resize?.observe(el);
    states.set(el, state);
    state.frame = requestAnimationFrame(() => measure(el));
  },
  unmounted(el) {
    const state = states.get(el);
    if (!state) return;
    state.mutation.disconnect();
    state.resize?.disconnect();
    cancelAnimationFrame(state.frame);
    states.delete(el);
  },
};
