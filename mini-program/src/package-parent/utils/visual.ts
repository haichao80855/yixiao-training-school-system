/** 家长端视觉辅助：孩子头像配色、入场错峰、数字滚动、环形进度 */
import { ref, watch, type Ref } from 'vue';

const CHILD_GRADIENTS: Array<[string, string, string]> = [
  ['#FF9A62', '#F0643A', '#FFD3BA'],
  ['#7CC6FF', '#4C7BF0', '#CFE0FF'],
  ['#7FD8A6', '#2E9E6A', '#CDEFD9'],
  ['#C6A2FF', '#7457E0', '#E3D6FF'],
  ['#FFD36E', '#E89B1C', '#FFE9B8'],
];

export function childPalette(index: number) {
  const [from, to, ring] = CHILD_GRADIENTS[((index % CHILD_GRADIENTS.length) + CHILD_GRADIENTS.length) % CHILD_GRADIENTS.length];
  return { background: `linear-gradient(135deg, ${from}, ${to})`, ring };
}

/** 列表入场错峰：前 8 项依次延迟 40ms，之后同时出现 */
export function enterDelay(index: number): string {
  return `animation-delay: ${Math.min(index, 8) * 40}ms;`;
}

/** 数字从 0 滚动到目标值 (约 600ms，ease-out) */
export function useCountUp(source: () => number | null | undefined, duration = 600): Ref<number> {
  const display = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;
  watch(
    source,
    (target) => {
      if (timer) clearInterval(timer);
      const end = Number(target) || 0;
      const start = display.value;
      if (start === end) return;
      const begin = Date.now();
      timer = setInterval(() => {
        const t = Math.min(1, (Date.now() - begin) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        display.value = Math.round(start + (end - start) * eased);
        if (t >= 1 && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, 16);
    },
    { immediate: true },
  );
  return display;
}

/** 环形进度 SVG (data URI，供 <image> 使用；进入时描边动画) */
export function ringSvg(percent: number, color: string, track = '#EFEBE5'): string {
  const r = 36;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, percent));
  const offset = c * (1 - p);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" viewBox="0 0 84 84">` +
    `<style>@keyframes d{from{stroke-dashoffset:${c.toFixed(1)}}}.p{animation:d .9s cubic-bezier(.2,.8,.2,1) both}</style>` +
    `<circle cx="42" cy="42" r="${r}" fill="none" stroke="${track}" stroke-width="8"/>` +
    (p > 0
      ? `<circle class="p" cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" ` +
        `stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 42 42)"/>`
      : '') +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
