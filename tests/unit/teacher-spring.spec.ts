import { describe, expect, it } from 'vitest'
import { rubberBand, sampleSpring, SPRINGS, springEasing, stepSpring } from '@/views/teacher/utils/spring'

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

  it('生成合法的 linear() 缓动，起点 0 终点 1', () => {
    const { easing, duration } = springEasing(SPRINGS.snappy)
    expect(easing.startsWith('linear(0, ')).toBe(true)
    expect(easing.endsWith(', 1)')).toBe(true)
    expect(duration).toBeGreaterThan(150)
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
