import { describe, expect, it } from 'vitest'
import { NAV_TRANSITION, rubberBand, sampleSpring, SPRINGS, stepSpring } from '@/views/teacher/utils/spring'

/** 三次贝塞尔缓动在进度 x 处的取值 */
function bezierAt(x1: number, y1: number, x2: number, y2: number, x: number) {
  const at = (a: number, b: number, t: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (at(x1, x2, mid) < x) lo = mid
    else hi = mid
  }
  return at(y1, y2, (lo + hi) / 2)
}

describe('老师端弹簧物理', () => {
  it('阻尼比为 1 时不越过终点 (导航推入不回弹)', () => {
    const { samples } = sampleSpring(SPRINGS.smooth)
    expect(Math.max(...samples)).toBeLessThanOrEqual(1.0005)
    expect(samples.at(-1)).toBe(1)
  })

  it('阻尼比小于 1 时会冲过终点再回来 (控件的轻微回弹)', () => {
    const { samples } = sampleSpring(SPRINGS.bouncy)
    expect(Math.max(...samples)).toBeGreaterThan(1.02)
  })

  it('response 越小越快停下', () => {
    const fast = sampleSpring({ response: 0.25, dampingFraction: 1 }).duration
    const slow = sampleSpring({ response: 0.6, dampingFraction: 1 }).duration
    expect(fast).toBeLessThan(slow)
    expect(slow).toBeLessThan(2000)
  })

  it('初速度会被延续：同一弹簧，甩出去的运动前段走得更远', () => {
    const still = sampleSpring(SPRINGS.smooth, 0).samples
    const flung = sampleSpring(SPRINGS.smooth, 6).samples
    expect(flung.at(3)!).toBeGreaterThan(still.at(3)!)
  })

  it('页面推入的贝塞尔曲线与「不回弹 + 初速度」的弹簧轨迹一致', () => {
    const [x1, y1, x2, y2] = NAV_TRANSITION.easing.match(/[\d.]+/g)!.map(Number)
    const { samples, duration } = sampleSpring(SPRINGS.smooth, 6)
    // 在肉眼可见的运动时长 (540ms) 内逐帧比较，误差不超过 2%
    const frames = Math.round(NAV_TRANSITION.duration / (1000 / 60))
    for (let i = 1; i < frames; i++) {
      const spring = samples.at(i)!
      expect(Math.abs(bezierAt(x1, y1, x2, y2, i / frames) - spring)).toBeLessThan(0.02)
    }
    expect(duration).toBeGreaterThan(NAV_TRANSITION.duration)
    // 一开始就动起来：前 10% 的时间至少走完 25% 的距离 (点按后立即响应，不会先停顿)
    expect(bezierAt(x1, y1, x2, y2, 0.1)).toBeGreaterThan(0.25)
  })

  it('单步积分朝目标移动', () => {
    const { position } = stepSpring(0, 0, 100, SPRINGS.snappy, 1 / 60)
    expect(position).toBeGreaterThan(0)
    expect(position).toBeLessThan(100)
  })

  it('橡皮筋：拖得越远阻力越大，且永远不超过整段尺寸', () => {
    const near = rubberBand(50, 800)
    const far = rubberBand(500, 800)
    expect(near).toBeLessThan(50)
    expect(far - near).toBeLessThan(450)
    expect(rubberBand(100000, 800)).toBeLessThan(800)
    expect(rubberBand(-50, 800)).toBe(-near)
  })
})
