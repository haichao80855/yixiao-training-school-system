import { ref } from 'vue';
import { onPageScroll, onUnload, onHide } from '@dcloudio/uni-app';

/**
 * 标签页快照 (家长端 UI 改进第 3 期)：切走再切回来时，先用上次的数据和滚动位置把页面摆回原样，
 * 不再整页显示骨架屏、重播入场动画；超过 1 分钟再在后台静默刷新。
 * 只存在内存里 (刷新浏览器就没了)，按孩子区分，5 分钟后过期。
 */
interface Snapshot<T> {
  sid: string;
  data: T;
  scrollTop: number;
  at: number;
}

const store = new Map<string, Snapshot<unknown>>();
const MAX_AGE = 5 * 60 * 1000;
export const SNAPSHOT_FRESH_MS = 60 * 1000;

export function usePageSnapshot<T>(key: string) {
  /** 本次进入页面是否用快照恢复的 (用来跳过骨架屏和入场动画) */
  const restored = ref(false);
  let scrollTop = 0;
  let current: { sid: string; data: T } | null = null;

  onPageScroll((e) => {
    scrollTop = e.scrollTop;
  });
  const persist = () => {
    if (current) store.set(key, { ...current, scrollTop, at: Date.now() });
  };
  onHide(persist);
  onUnload(persist);

  return {
    restored,
    /** 加载成功后记下数据 */
    save(sid: string, data: T) {
      current = { sid, data };
      store.set(key, { sid, data, scrollTop, at: Date.now() });
    },
    /** 有同一个孩子 5 分钟内的快照就返回 (并把页面滚回原位置) */
    restore(sid: string): (Snapshot<T> & { fresh: boolean }) | null {
      const snap = store.get(key) as Snapshot<T> | undefined;
      if (!snap || snap.sid !== sid || Date.now() - snap.at > MAX_AGE) return null;
      restored.value = true;
      current = { sid: snap.sid, data: snap.data };
      scrollTop = snap.scrollTop;
      setTimeout(() => uni.pageScrollTo({ scrollTop: snap.scrollTop, duration: 0 }), 0);
      return { ...snap, fresh: Date.now() - snap.at < SNAPSHOT_FRESH_MS };
    },
  };
}
