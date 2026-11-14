/**
 * 页面转场进行中的「闸门」。
 *
 * 推入动画约 0.5 秒，期间新页面的数据往往正好回来：骨架屏换成真实内容会让正在滑动的整页重新排版、重新绘制，
 * 手机上表现为滑到一半卡一下、抖一下。iOS 的做法是先把页面推进来，再填充内容。
 * 这里同样处理：转场进行中拿到的数据，等转场结束再提交给页面 (最多等 MAX_WAIT，防止意外卡住)。
 */

const MAX_WAIT = 700;

let active = false;
let waiters: Array<() => void> = [];

export function setTransitionActive(value: boolean) {
  active = value;
  if (!value) {
    const pending = waiters;
    waiters = [];
    pending.forEach((resolve) => resolve());
  }
}

export function isTransitionActive() {
  return active;
}

/** 转场空闲时立即返回；否则等到转场结束 (或超时) */
export function whenTransitionIdle(): Promise<void> {
  if (!active) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, MAX_WAIT);
    function done() {
      clearTimeout(timer);
      waiters = waiters.filter((w) => w !== done);
      resolve();
    }
    waiters.push(done);
  });
}
