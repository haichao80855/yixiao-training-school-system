/**
 * 接口数据转换 (src/api/normalizers)：后端返回的数据进页面之前都经过这里。
 * 重点：数值字段一律转成数字 (不能出现 NaN 或把 "1200.50" 当字符串拼接)、嵌套和扁平两种返回格式都认、
 * 退费金额为负、日期去掉时间部分。
 *
 * 用 it.fails 标出的是「已知缺陷」：这些用例写的是正确行为，目前代码还做不到，所以预期失败。
 * 修好缺陷后它们会变成通过，Vitest 会报错提醒你把 .fails 去掉。
 */
import { describe, expect, it } from 'vitest'
import { normalizeApproval, normalizeLedgerRecord, normalizeOrder } from '@/api/normalizers/financial'
import { normalizeCoursePackage, normalizeStudent, normalizeWalletLedger } from '@/api/normalizers/student'
import { normalizeCollisionResult, normalizeRollCallStudent, normalizeSchedule } from '@/api/normalizers/educational'

describe('订单 normalizeOrder', () => {
  it('金额字段转成数字 (后端 Decimal 可能以字符串返回)', () => {
    const o = normalizeOrder({ id: 'o1', status: 'paid', originalPrice: '3000', discountAmount: '200.5', receivableAmount: '2799.50', actualAmount: '2799.5' })
    expect(o.originalPrice).toBe(3000)
    expect(o.discountAmount).toBe(200.5)
    expect(o.receivableAmount).toBe(2799.5)
    expect(o.actualAmount).toBe(2799.5)
  })

  it('应收金额缺失时用实收金额，都缺失为 0', () => {
    expect(normalizeOrder({ id: 'o', status: 'paid', actualAmount: 800 }).receivableAmount).toBe(800)
    expect(normalizeOrder({ id: 'o', status: 'paid' }).receivableAmount).toBe(0)
  })

  it('嵌套关联优先于扁平字段 (student.name / course.name / owner.realName)', () => {
    const o = normalizeOrder({
      id: 'o', status: 'paid', studentName: '旧名', student: { id: 's1', name: '张小凡', studentNo: 'S948918', phone: '138' },
      course: { id: 'c1', name: 'Scratch' }, owner: { realName: '王顾问' }, creator: { realName: '李学管' },
    })
    expect(o).toMatchObject({ studentId: 's1', studentName: '张小凡', studentNo: 'S948918', courseId: 'c1', courseName: 'Scratch', performanceOwner: '王顾问', creator: '李学管', submitter: '李学管' })
  })

  it('下单、支付时间只保留日期', () => {
    const o = normalizeOrder({ id: 'o', status: 'paid', createdAt: '2026-10-08T03:12:00.000Z', payTime: '2026-10-09T08:00:00.000Z' })
    expect(o.signupTime).toBe('2026-10-08')
    expect(o.payTime).toBe('2026-10-09')
  })

  it('isLocked 为布尔值', () => {
    expect(normalizeOrder({ id: 'o', status: 'paid', isLocked: 1 }).isLocked).toBe(true)
    expect(normalizeOrder({ id: 'o', status: 'paid' }).isLocked).toBe(false)
  })

  it.fails('已知缺陷：缺少订单状态时不应默认显示为「已支付」', () => {
    expect(normalizeOrder({ id: 'o' }).status).not.toBe('paid')
  })
})

describe('收费流水 normalizeLedgerRecord', () => {
  it('退费订单金额为负数 (即使后端给的是正数)', () => {
    expect(normalizeLedgerRecord({ orderNo: 'R1', orderType: 'refund', actualAmount: 300 }).amount).toBe(-300)
    expect(normalizeLedgerRecord({ orderNo: 'R2', orderType: 'refund', actualAmount: -300 }).amount).toBe(-300)
    expect(normalizeLedgerRecord({ orderNo: 'R1', orderType: 'refund', actualAmount: 300 }).type).toBe('退费冲减')
  })

  it('收费类型、支付方式、核销状态显示中文', () => {
    const r = normalizeLedgerRecord({ orderNo: 'ORD-20261008-001', orderType: 'quarterly', actualAmount: '1200', paymentMethod: 'alipay', status: 'paid' })
    expect(r).toMatchObject({ amount: 1200, type: '季度学费', method: '支付宝生活号', status: '已核销', transNo: 'TX20261008001' })
    expect(normalizeLedgerRecord({ orderNo: 'x', paymentMethod: 'bank_transfer', status: 'void' })).toMatchObject({ method: '招商银行对公', status: '已作废', type: '常规学费' })
  })

  it('时间优先取支付时间，格式为 yyyy-mm-dd hh:mm:ss', () => {
    expect(normalizeLedgerRecord({ orderNo: 'x', payTime: '2026-10-09T08:30:15.000Z', createdAt: '2026-10-01T00:00:00Z' }).date).toBe('2026-10-09 08:30:15')
  })
})

describe('审批 normalizeApproval', () => {
  it('审批节点按 action 推出状态：approve → 通过，reject → 驳回，其他 → 待审', () => {
    const a = normalizeApproval({
      id: 'f1', status: 'pending', currentStep: '2', totalSteps: '3', order: { orderNo: 'ORD-1', actualAmount: '2799.5', student: { name: '张小凡' } },
      nodes: [{ stepName: '校长审批', action: 'approve' }, { stepName: '财务审批', action: 'reject' }, { stepName: '总部', action: undefined }],
    })
    expect(a.timeline.map((n: any) => n.status)).toEqual(['passed', 'rejected', 'pending'])
    expect(a).toMatchObject({ orderNo: 'ORD-1', amount: 2799.5, currentStep: 2, totalSteps: 3, studentName: '张小凡' })
  })

  it('节点自带状态时以节点状态为准', () => {
    const a = normalizeApproval({ id: 'f', nodes: [{ stepName: '校长', status: 'passed', action: 'reject' }] })
    expect(a.timeline[0].status).toBe('passed')
  })
})

describe('学员 normalizeStudent / 课包 normalizeCoursePackage', () => {
  it('课包课时字段缺失或为 null 时为 0，不出现 NaN', () => {
    const p = normalizeCoursePackage({ id: 'p1', totalLessons: null, remainingLessons: undefined, consumedLessons: '6', pricePerLesson: '150' })
    expect(p).toMatchObject({ totalLessons: 0, remainingLessons: 0, consumedLessons: 6, pricePerLesson: 150 })
  })

  it('剩余、已消、总课时由课包汇总；后端给了汇总值时以后端为准', () => {
    const s = normalizeStudent({ id: 's', packages: [{ id: 'a', remainingLessons: 3, consumedLessons: 7 }, { id: 'b', remainingLessons: 10, consumedLessons: 0 }] })
    expect(s).toMatchObject({ totalRemainingLessons: 13, totalConsumedLessons: 7, totalLessons: 20 })
    expect(normalizeStudent({ id: 's', totalRemainingLessons: '5', packages: [{ id: 'a', remainingLessons: 3 }] }).totalRemainingLessons).toBe(5)
  })

  it('课时预警：剩余 ≤ 4 紧急，≤ 8 提醒，没有课包不预警 (与后端「课时不足」通知的门槛 4 一致)', () => {
    const level = (n: number) => normalizeStudent({ id: 's', packages: [{ id: 'a', remainingLessons: n }] }).warningLevel
    expect(level(4)).toBe('urgent')
    expect(level(5)).toBe('warning')
    expect(level(8)).toBe('warning')
    expect(level(9)).toBe('none')
    expect(normalizeStudent({ id: 's', packages: [] }).warningLevel).toBe('none')
  })

  it('钱包余额扁平、嵌套两种格式都认，转成数字', () => {
    expect(normalizeStudent({ id: 's', principalBalance: '100.5', bonusBalance: 20 }).wallet).toMatchObject({ principalBalance: 100.5, bonusBalance: 20 })
    expect(normalizeStudent({ id: 's', wallet: { principalBalance: 300, bonusBalance: '0', ledger: [{ id: 'l', amount: '50', createdAt: '2026-10-01T09:00:00Z' }] } }).wallet).toMatchObject({
      principalBalance: 300, bonusBalance: 0, ledger: [{ amount: 50, time: '2026-10-01 09:00:00' }],
    })
  })

  it('预计耗尽天数：null 表示无法预估 (不能变成 0 天)，0 是有效值', () => {
    const days = (v: unknown) => normalizeStudent({ id: 's', consumptionHealth: { estimatedDepletionDays: v } }).consumptionHealth?.estimatedDepletionDays
    expect(days(null)).toBeNull()
    expect(days(undefined)).toBeNull()
    expect(days(0)).toBe(0)
    expect(days('12')).toBe(12)
  })

  it('钱包流水金额转数字，时间格式化', () => {
    expect(normalizeWalletLedger({ id: 'l', amount: '-80', principalChange: '-80', createdAt: '2026-10-02T10:20:30.000Z' })).toMatchObject({ amount: -80, principalChange: -80, bonusChange: 0, time: '2026-10-02 10:20:30' })
  })
})

describe('排课 normalizeSchedule', () => {
  it('到课人数只数出勤和迟到；后端给了签到数时以后端为准', () => {
    const s = normalizeSchedule({ id: 'e', date: '2026-10-18T00:00:00.000Z', attendances: [{ status: 'present' }, { status: 'late' }, { status: 'leave' }, { status: 'absent' }] })
    expect(s.attendanceCount).toBe(2)
    expect(s.date).toBe('2026-10-18')
    expect(normalizeSchedule({ id: 'e', signedCount: '5', attendances: [] }).attendanceCount).toBe(5)
  })

  it('已结课的课次语义为 completed；冲突标记优先用后端字段', () => {
    expect(normalizeSchedule({ id: 'e', status: 'completed' }).semanticType).toBe('completed')
    expect(normalizeSchedule({ id: 'e', semanticType: 'conflict' }).hasConflict).toBe(true)
    expect(normalizeSchedule({ id: 'e', semanticType: 'conflict', hasConflict: false }).hasConflict).toBe(false)
  })

  it('课次序号转数字，没有时保持未定义 (课次名退回班级名)', () => {
    expect(normalizeSchedule({ id: 'e', lessonNumber: '3' }).lessonNumber).toBe(3)
    expect(normalizeSchedule({ id: 'e' }).lessonNumber).toBeUndefined()
  })
})

describe('点名学员 normalizeRollCallStudent', () => {
  it('按本节课的课程匹配课包，取它的剩余课时和课包 ID', () => {
    const r = normalizeRollCallStudent(
      { id: 's1', name: '张小凡', coursePackages: [{ id: 'p-py', courseId: 'c-py', remainingLessons: 9 }, { id: 'p-scratch', courseId: 'c-scratch', remainingLessons: 2 }] },
      { courseId: 'c-scratch' },
    )
    expect(r).toMatchObject({ studentId: 's1', remainingLessons: 2, packageId: 'p-scratch', deductionLessons: 1, status: 'present' })
  })

  it('后端给的到课状态、扣课数、低余额标记原样使用', () => {
    const r = normalizeRollCallStudent({ studentId: 's1', status: 'leave', deductLessons: 0, isLowBalance: false, remainingLessons: 1 })
    expect(r).toMatchObject({ status: 'leave', deductionLessons: 0, isLowBalance: false })
  })

  it.fails('已知缺陷：后端没给评语时不应自动填一条「随堂实操任务完成良好」(授课点名消课页会把它当作学员评语提交入库)', () => {
    expect(normalizeRollCallStudent({ studentId: 's1', name: '张小凡' }).remark).toBe('')
  })

  it.fails('已知缺陷：低余额默认门槛是 3，与后端「课时不足」通知和学员预警的门槛 4 不一致', () => {
    expect(normalizeRollCallStudent({ studentId: 's1', remainingLessons: 4 }).isLowBalance).toBe(true)
  })
})

describe('排课冲突 normalizeCollisionResult', () => {
  it('有冲突明细时判定为冲突，reason / message 互相补齐', () => {
    const r = normalizeCollisionResult({ conflicts: [{ type: 'classroom', message: '教室 A101 已被占用' }] })
    expect(r.hasConflict).toBe(true)
    expect(r.conflicts[0]).toMatchObject({ type: 'classroom', reason: '教室 A101 已被占用', message: '教室 A101 已被占用' })
  })

  it('空结果为不冲突', () => {
    expect(normalizeCollisionResult(null)).toEqual({ hasConflict: false, conflicts: [] })
    expect(normalizeCollisionResult({ conflicts: [] }).hasConflict).toBe(false)
  })
})
