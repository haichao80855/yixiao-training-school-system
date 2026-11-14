/**
 * 弹簧物理：教师端所有动效的唯一来源。
 *
 * 参数与 SwiftUI 的 spring(response:dampingFraction:) 一致：
 * - response：弹簧走完一个周期的时间 (秒)，越小越快。
 * - dampingFraction：阻尼比。1 = 不回弹 (iOS 导航推入)，< 1 带一点回弹，越小弹得越多。
 *
 * 模型：质量 1 的阻尼弹簧，x'' = -k (x - 目标) - c x'。
 * 用途有两种：
 * 1. CSS / Web Animations 的缓动：把弹簧轨迹拟合成三次贝塞尔 (见 NAV_TRANSITION 与 teacher.css 的 --tp-spring-*)，
 *    贝塞尔动画能交给系统合成器在独立线程运行，主线程忙的时候也不掉帧。
 * 2. 手势结束后的动画：从手指松开的位置和速度出发逐帧积分，速度会被延续，动画也随时可以被下一次触摸打断。
 */

export interface SpringParams {
  response: number;
  dampingFraction: number;
}

/** 预设：导航推入 (不回弹)、控件 (轻微回弹)、强调 (明显回弹) */
export const SPRINGS = {
  smooth: { response: 0.45, dampingFraction: 1 },
  snappy: { response: 0.32, dampingFraction: 0.82 },
  bouncy: { response: 0.42, dampingFraction: 0.62 },
} satisfies Record<string, SpringParams>;

export function springCoefficients({ response, dampingFraction }: SpringParams) {
  const stiffness = (2 * Math.PI / response) ** 2;
  const damping = (4 * Math.PI * dampingFraction) / response;
  return { stiffness, damping };
}

const STEP = 1 / 240;
const REST = 0.0005;

/** 单步积分 (半隐式欧拉，稳定)：返回新的位置和速度 */
export function stepSpring(position: number, velocity: number, target: number, params: SpringParams, dt: number) {
  const { stiffness, damping } = springCoefficients(params);
  let x = position;
  let v = velocity;
  let remaining = dt;
  while (remaining > 1e-9) {
    const h = Math.min(STEP, remaining);
    const accel = -stiffness * (x - target) - damping * v;
    v += accel * h;
    x += v * h;
    remaining -= h;
  }
  return { position: x, velocity: v };
}

/**
 * 从 0 运动到 1 的完整轨迹，按时间均匀采样。
 * initialVelocity 以「每秒走过的全程比例」计 (例如手指甩动速度 / 剩余距离)。
 */
export function sampleSpring(params: SpringParams, initialVelocity = 0, maxSeconds = 2) {
  const samples: number[] = [0];
  let x = 0;
  let v = initialVelocity;
  let t = 0;
  const frame = 1 / 60;
  while (t < maxSeconds) {
    ({ position: x, velocity: v } = stepSpring(x, v, 1, params, frame));
    t += frame;
    samples.push(x);
    if (Math.abs(1 - x) < REST && Math.abs(v) < REST * 10) break;
  }
  samples[samples.length - 1] = 1;
  return { samples, duration: Math.round(t * 1000) };
}

/**
 * 页面推入 / 退出用的缓动。
 * 由 SPRINGS.smooth (阻尼比 1、不回弹) 加上初速度 6 (手指点按后立即开始运动) 的轨迹拟合成三次贝塞尔：
 * 前 10% 的时间走完 32% 的距离，540ms 时离终点不到 0.3%，与弹簧的均方根误差 0.003。
 *
 * 用贝塞尔而不是 linear() 弹簧曲线：iOS 的 WebKit 只能把贝塞尔曲线的 transform 动画交给系统合成器
 * (Core Animation) 在独立线程运行；多点 linear() 可能退回到主线程逐帧计算，页面渲染、数据回来时就会掉帧。
 */
export const NAV_TRANSITION = { easing: 'cubic-bezier(0.23, 0.77, 0.29, 1)', duration: 540 } as const;

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 手势结束后的弹簧动画：从当前位置和速度出发，逐帧积分到目标。
 * 返回取消函数：下一次触摸开始时调用，动画立即停在当前位置 (可打断)。
 */
export function animateSpring(options: {
  from: number;
  to: number;
  velocity?: number;
  params?: SpringParams;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}): () => void {
  const params = options.params ?? SPRINGS.snappy;
  if (prefersReducedMotion()) {
    options.onUpdate(options.to);
    options.onComplete?.();
    return () => {};
  }
  let x = options.from;
  let v = options.velocity ?? 0;
  let last = performance.now();
  let frame = 0;
  let stopped = false;
  const distance = Math.max(1, Math.abs(options.to - options.from));
  const tick = (now: number) => {
    if (stopped) return;
    // 切到后台再回来时 dt 可能很大，限制单帧步长，避免跳过整段运动
    const dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    ({ position: x, velocity: v } = stepSpring(x, v, options.to, params, dt));
    if (Math.abs(options.to - x) < distance * REST && Math.abs(v) < 1) {
      options.onUpdate(options.to);
      options.onComplete?.();
      return;
    }
    options.onUpdate(x);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
  };
}

/** iOS 的橡皮筋阻力：拖得越远越难拖 (超出边界时的位移) */
export function rubberBand(offset: number, dimension: number, constant = 0.55) {
  const sign = Math.sign(offset);
  const abs = Math.abs(offset);
  return sign * (1 - 1 / ((abs * constant) / dimension + 1)) * dimension;
}
