/** 家长端视觉辅助：孩子头像配色、入场错峰、数字滚动、环形进度 */
import { ref, watch, type Ref } from 'vue';

// 孩子头像：浅色底 + 深色字，按序号区分多个孩子 (同一套冷色系，克制不跳色)
const CHILD_TONES: Array<{ bg: string; fg: string }> = [
  { bg: '#E0E7FF', fg: '#1D39C4' },
  { bg: '#E0F2FE', fg: '#0369A1' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#EDE9FE', fg: '#5B21B6' },
  { bg: '#E2E8F0', fg: '#334155' },
];

export function childPalette(index: number) {
  const tone = CHILD_TONES[((index % CHILD_TONES.length) + CHILD_TONES.length) % CHILD_TONES.length];
  return { background: tone.bg, color: tone.fg, ring: tone.bg };
}

/** 列表入场错峰：前 8 项依次延迟 40ms，之后同时出现 */
export function enterDelay(index: number): string {
  return `animation-delay: ${Math.min(index, 8) * 40}ms;`;
}

/** 系统设置了「减少动态效果」(H5 浏览器)：关掉数字滚动、入场动画等 */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const nextFrame = (cb: () => void): unknown =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(cb, 16);
const cancelFrame = (id: unknown) => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id as number);
  else clearTimeout(id as ReturnType<typeof setTimeout>);
};

/**
 * 数字从 0 滚动到目标值 (约 600ms，ease-out)。
 * 用 requestAnimationFrame 跟屏幕刷新同步 (以前是 16ms 定时器，后台标签页也在跑)；减少动态效果时直接显示结果。
 */
export function useCountUp(source: () => number | null | undefined, duration = 600): Ref<number> {
  const display = ref(0);
  let frame: unknown = null;
  watch(
    source,
    (target) => {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      const end = Number(target) || 0;
      const start = display.value;
      if (start === end) return;
      if (prefersReducedMotion()) {
        display.value = end;
        return;
      }
      const begin = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - begin) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        display.value = Math.round(start + (end - start) * eased);
        frame = t < 1 ? nextFrame(step) : null;
      };
      frame = nextFrame(step);
    },
    { immediate: true },
  );
  return display;
}

/** 环形进度 SVG (data URI，供 <image> 使用；进入时描边动画) */
export function ringSvg(percent: number, color: string, track = '#E8ECF2'): string {
  const r = 36;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, percent));
  const offset = c * (1 - p);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" viewBox="0 0 84 84">` +
    (prefersReducedMotion() ? '' : `<style>@keyframes d{from{stroke-dashoffset:${c.toFixed(1)}}}.p{animation:d .9s cubic-bezier(.2,.8,.2,1) both}</style>`) +
    `<circle cx="42" cy="42" r="${r}" fill="none" stroke="${track}" stroke-width="8"/>` +
    (p > 0
      ? `<circle class="p" cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" ` +
        `stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 42 42)"/>`
      : '') +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
