import type {
  PaymentMethod,
  EnrollmentCourseItem,
  EnrollmentGoodsItem,
  EnrollmentClassAssignment,
  FinancialSummary,
  EnrollmentValidationReport,
  EnrollmentReceipt,
  EnrollmentIntentPayload,
  EnrollmentDraftSession,
  StartSessionOptions,
} from './types';
import type { EnrollmentFulfillmentPort } from './ports';
import { HttpEnrollmentAdapter } from './adapters/http-enrollment.adapter';
import { FakeEnrollmentAdapter } from './adapters/fake-enrollment.adapter';

export class DefaultEnrollmentDraftSession implements EnrollmentDraftSession {
  student: any = null;
  private readonly courses: Map<string, EnrollmentCourseItem> = new Map();
  private readonly goods: Map<string, EnrollmentGoodsItem> = new Map();
  paymentMethod: PaymentMethod = 'wechat';
  channel?: string;
  isSubmitting = false;

  private readonly port: EnrollmentFulfillmentPort;
  private readonly options: StartSessionOptions;

  constructor(
    student: any,
    options: StartSessionOptions = {},
    port?: EnrollmentFulfillmentPort
  ) {
    this.student = student;
    this.options = options;
    this.channel = options.channel;
    this.port = port || options.port || new HttpEnrollmentAdapter();
    if (options.defaultPaymentMethod) {
      this.setPaymentMethod(options.defaultPaymentMethod);
    }
  }

  setChannel(channel?: string): void {
    this.channel = channel;
  }

  get selectedCourses(): EnrollmentCourseItem[] {
    return Array.from(this.courses.values());
  }

  get selectedGoods(): EnrollmentGoodsItem[] {
    return Array.from(this.goods.values());
  }

  get selectedClasses(): EnrollmentClassAssignment[] {
    const classes: EnrollmentClassAssignment[] = [];
    for (const c of this.courses.values()) {
      if (c.assignedClass) {
        classes.push(c.assignedClass);
      }
    }
    return classes;
  }

  get totalItemsCount(): number {
    return this.courses.size + this.goods.size + this.selectedClasses.length;
  }

  get financialSummary(): FinancialSummary {
    // 采用整数分运算杜绝 JavaScript 浮点数漂移 (e.g. 0.1 + 0.2 = 0.30000000000000004) 并防御 NaN 与负数价格注入
    let coursesCents = 0;
    for (const c of this.courses.values()) {
      const price = Math.max(0, Number.isFinite(Number(c.totalPrice)) ? Number(c.totalPrice) : 0);
      coursesCents += Math.round(price * 100);
    }

    let goodsCents = 0;
    for (const g of this.goods.values()) {
      const price = Math.max(0, Number.isFinite(Number(g.price)) ? Number(g.price) : 0);
      const rawQty = Number(g.quantity);
      const qty = Math.max(1, Math.floor(Number.isFinite(rawQty) ? rawQty : 1));
      goodsCents += Math.round(price * qty * 100);
    }

    const totalCents = coursesCents + goodsCents;
    const coursesSubtotal = Math.round(coursesCents) / 100;
    const goodsSubtotal = Math.round(goodsCents) / 100;
    const totalAmount = Math.round(totalCents) / 100;

    const rawWallet =
      this.student?.walletBalance ??
      this.student?.wallet?.principalBalance ??
      this.student?.wallet?.balance ??
      0;
    const parsedWallet = Number(rawWallet);
    const walletBalance = Math.max(0, Math.round((Number.isFinite(parsedWallet) ? parsedWallet : 0) * 100) / 100);
    const walletCents = Math.round(walletBalance * 100);

    const deficitCents = Math.max(0, totalCents - walletCents);
    const deficit = Math.round(deficitCents) / 100;
    const canCoverByWallet = deficitCents === 0;

    return {
      coursesSubtotal,
      goodsSubtotal,
      totalAmount,
      walletBalance,
      canCoverByWallet,
      deficit,
    };
  }

  get validationReport(): EnrollmentValidationReport {
    const errors: string[] = [];
    let canEnroll = true;
    let riskReason: string | undefined = undefined;

    // 1. 学籍前置准入核验 (SSOT Pre-Validation)
    if (!this.student || !this.student.id) {
      canEnroll = false;
      riskReason = '未选择学员或学员档案无效';
      errors.push('未选择学员或学员档案无效，无法办理报名');
    } else {
      if (this.student.permissions && this.student.permissions.canEnroll === false) {
        canEnroll = false;
        riskReason = `学员「${this.student.name || '学员'}」当前处于【${this.student.statusText || this.student.status}】状态，暂不支持继续办理报名。`;
        errors.push(riskReason);
      }

      const normStatus = this.student.normalizedStatus || this.student.status;
      if (
        normStatus === 'suspended' ||
        this.student.statusText === '停课' ||
        this.student.status === '停课'
      ) {
        canEnroll = false;
        riskReason = `学员「${this.student.name || '学员'}」当前处于停课保护状态，请先在教务端恢复在读状态后再办理报名。`;
        errors.push(riskReason);
      } else if (
        normStatus === 'lost' ||
        normStatus === 'transferred' ||
        normStatus === 'dropped_out' ||
        this.student.statusText === '已流失' ||
        this.student.statusText === '已转校' ||
        this.student.status === '已流失' ||
        this.student.status === '已转校'
      ) {
        canEnroll = false;
        riskReason = `学员「${this.student.name || '学员'}」已流失注销或转出，需重新建档或办理复学。`;
        errors.push(riskReason);
      }
    }

    // 2. 选择条目非空校验（报名开单必须选择至少一门报读课程）
    if (this.courses.size === 0) {
      errors.push('请至少选择一门报读课程');
    }

    // 3. 支付通道合法性校验
    const validPaymentMethods: PaymentMethod[] = ['wechat', 'alipay', 'pos', 'bank_transfer', 'wallet'];
    if (!validPaymentMethods.includes(this.paymentMethod)) {
      errors.push(`支付通道「${this.paymentMethod}」非法或不受支持`);
    }

    // 4. 财务资产异常与电子钱包支付防透支检查
    const summary = this.financialSummary;
    if (summary.totalAmount < 0 || !Number.isFinite(summary.totalAmount)) {
      errors.push('开单总金额异常，严禁提交');
    }

    if (this.paymentMethod === 'wallet' && !summary.canCoverByWallet) {
      errors.push(
        `学员电子钱包本金余额不足 (当前: ¥${summary.walletBalance}, 需支付: ¥${summary.totalAmount}, 差额: ¥${summary.deficit})`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      canEnroll,
      riskReason,
      deficit: summary.deficit,
    };
  }

  setStudent(student: any): void {
    this.student = student;
  }

  toggleCourse(course: any, targetClass?: any): void {
    if (!course || !course.id) return;
    const courseId = String(course.id).trim();
    if (!courseId) return;

    if (this.courses.has(courseId)) {
      // 移除课程：挂载在该课程下的班级选择被物理出清（级联自愈保护）
      this.courses.delete(courseId);
    } else {
      const rawTotalLessons = Number(course.totalLessons || course.lessons || 48);
      const totalLessons = Math.max(1, Math.floor(Number.isFinite(rawTotalLessons) ? rawTotalLessons : 48));

      const rawTotalPrice = Number(
        course.totalPrice ?? (course.pricePerLesson ? course.pricePerLesson * totalLessons : 0)
      );
      const totalPrice = Math.max(0, Number.isFinite(rawTotalPrice) ? rawTotalPrice : 0);

      const rawPricePerLesson = Number(
        course.pricePerLesson || (totalLessons > 0 ? Math.round((totalPrice / totalLessons) * 100) / 100 : 64)
      );
      const pricePerLesson = Math.max(0, Number.isFinite(rawPricePerLesson) ? rawPricePerLesson : 0);

      const rawBonus = Number(course.bonusLessons || 0);
      const bonusLessons = Math.max(0, Number.isFinite(rawBonus) ? rawBonus : 0);
      const rawDiscount = Number(course.discountAmount || 0);
      const discountAmount = Math.max(0, Number.isFinite(rawDiscount) ? rawDiscount : 0);

      const courseItem: EnrollmentCourseItem = {
        id: courseId,
        name: course.name || '未命名课程',
        totalPrice,
        totalLessons,
        bonusLessons,
        discountAmount,
        pricePerLesson,
        subjectName: course.subjectName,
        gradeName: course.gradeName,
        coverUrl: course.coverUrl,
        assignedClass: null,
      };

      if (targetClass && targetClass.id) {
        const targetClassCourseId = targetClass.courseId ? String(targetClass.courseId).trim() : '';
        if (targetClassCourseId && targetClassCourseId !== courseId) {
          throw new Error(
            `班级「${targetClass.name}」属于课程「${targetClass.courseName || targetClass.courseId}」，与当前课程「${course.name}」不匹配`
          );
        }
        courseItem.assignedClass = {
          id: String(targetClass.id).trim(),
          name: targetClass.name,
          courseId,
          courseName: course.name,
          teacherName: targetClass.teacherName,
          capacity: targetClass.capacity,
          currentStudentCount: targetClass.currentStudentCount,
          startDateText: targetClass.startDateText,
          schedulePatternText: targetClass.schedulePatternText,
        };
      }

      this.courses.set(courseId, courseItem);
    }
  }

  toggleGoods(goods: any, quantity?: number): void {
    if (!goods || !goods.id) return;
    const goodsId = String(goods.id).trim();
    if (!goodsId) return;

    const parsedQty = quantity !== undefined ? Math.floor(Number(quantity)) : undefined;
    const isValidQty = parsedQty !== undefined && Number.isFinite(parsedQty) && parsedQty > 0;

    if (this.goods.has(goodsId)) {
      if (quantity === undefined || !isValidQty || parsedQty <= 0) {
        this.goods.delete(goodsId);
      } else {
        const item = this.goods.get(goodsId)!;
        item.quantity = parsedQty;
      }
    } else {
      // 仅当传入合法的正整数数量或未传数量时添加（未传默认 1 件；传 <= 0 或 NaN 则不添加）
      if (quantity !== undefined && (!isValidQty || parsedQty <= 0)) {
        return;
      }
      const qty = isValidQty ? parsedQty : 1;
      const rawPrice = Number(goods.price) || 0;
      const price = Math.max(0, Number.isFinite(rawPrice) ? rawPrice : 0);

      this.goods.set(goodsId, {
        id: goodsId,
        name: goods.name || '物品',
        price,
        quantity: qty,
        unit: goods.unit || '件',
        category: goods.category,
        coverUrl: goods.coverUrl,
      });
    }
  }

  assignClass(courseId: string, targetClass: any | null): void {
    const cid = String(courseId || '').trim();
    const course = this.courses.get(cid);
    if (!course) {
      throw new Error(`未找到已选课程 (ID: ${courseId})，无法为其分配班级`);
    }

    if (!targetClass || !targetClass.id) {
      course.assignedClass = null;
      return;
    }

    const targetClassCourseId = targetClass.courseId ? String(targetClass.courseId).trim() : '';
    if (targetClassCourseId && targetClassCourseId !== cid) {
      throw new Error(
        `班级「${targetClass.name}」属于课程「${targetClass.courseName || targetClass.courseId}」，与当前课程「${course.name}」不匹配`
      );
    }

    const targetClassId = String(targetClass.id).trim();

    // 保证单班级不被重复排入多个不同课程的不变式保护
    for (const otherCourse of this.courses.values()) {
      if (otherCourse.id !== cid && otherCourse.assignedClass && String(otherCourse.assignedClass.id).trim() === targetClassId) {
        otherCourse.assignedClass = null;
      }
    }

    course.assignedClass = {
      id: targetClassId,
      name: targetClass.name,
      courseId: cid,
      courseName: course.name,
      teacherName: targetClass.teacherName,
      capacity: targetClass.capacity,
      currentStudentCount: targetClass.currentStudentCount,
      startDateText: targetClass.startDateText,
      schedulePatternText: targetClass.schedulePatternText,
    };
  }

  removeClass(courseId?: string, classId?: string): void {
    const cid = courseId ? String(courseId).trim() : '';
    const targetClassId = classId ? String(classId).trim() : '';

    if (cid && this.courses.has(cid)) {
      const course = this.courses.get(cid)!;
      if (!targetClassId || (course.assignedClass && String(course.assignedClass.id).trim() === targetClassId)) {
        course.assignedClass = null;
        return;
      }
    }
    if (targetClassId) {
      for (const c of this.courses.values()) {
        if (c.assignedClass && String(c.assignedClass.id).trim() === targetClassId) {
          c.assignedClass = null;
          break;
        }
      }
    }
  }

  setPaymentMethod(method: string): void {
    if (!method || typeof method !== 'string' || !method.trim()) {
      throw new Error('支付方式不能为空');
    }
    let m = method.toLowerCase().trim();
    if (m === 'wx' || m === 'weixin') m = 'wechat';
    if (m === 'ali') m = 'alipay';
    if (m === 'cash') m = 'pos';
    if (m === 'bank') m = 'bank_transfer';
    if (m === 'balance' || m === 'yue') m = 'wallet';

    const validMethods: PaymentMethod[] = ['wechat', 'alipay', 'pos', 'bank_transfer', 'wallet'];
    if (validMethods.includes(m as PaymentMethod)) {
      this.paymentMethod = m as PaymentMethod;
    } else {
      throw new Error(`不支持或非法的支付通道: 「${method}」`);
    }
  }

  setCourses(newCourses: any[]): void {
    const newMap = new Map<string, EnrollmentCourseItem>();
    for (const c of newCourses) {
      if (!c || !c.id) continue;
      const cid = String(c.id).trim();
      if (!cid) continue;

      const existing = this.courses.get(cid);
      const rawTotalLessons = Number(c.totalLessons || c.lessons || 48);
      const totalLessons = Math.max(1, Math.floor(Number.isFinite(rawTotalLessons) ? rawTotalLessons : 48));

      const rawTotalPrice = Number(
        c.totalPrice ?? (c.pricePerLesson ? c.pricePerLesson * totalLessons : 0)
      );
      const totalPrice = Math.max(0, Number.isFinite(rawTotalPrice) ? rawTotalPrice : 0);

      const rawPricePerLesson = Number(
        c.pricePerLesson || (totalLessons > 0 ? Math.round((totalPrice / totalLessons) * 100) / 100 : 64)
      );
      const pricePerLesson = Math.max(0, Number.isFinite(rawPricePerLesson) ? rawPricePerLesson : 0);

      const rawBonus = Number(c.bonusLessons || (existing ? (existing as any).bonusLessons : 0));
      const bonusLessons = Math.max(0, Number.isFinite(rawBonus) ? rawBonus : 0);
      const rawDiscount = Number(c.discountAmount || (existing ? (existing as any).discountAmount : 0));
      const discountAmount = Math.max(0, Number.isFinite(rawDiscount) ? rawDiscount : 0);

      newMap.set(cid, {
        id: cid,
        name: c.name || '未命名课程',
        totalPrice,
        totalLessons,
        bonusLessons,
        discountAmount,
        pricePerLesson,
        subjectName: c.subjectName,
        gradeName: c.gradeName,
        coverUrl: c.coverUrl,
        assignedClass: c.assignedClass !== undefined ? c.assignedClass : (existing ? existing.assignedClass : null),
      });
    }

    this.courses.clear();
    for (const [k, v] of newMap.entries()) {
      this.courses.set(k, v);
    }
  }

  setGoods(newGoods: any[]): void {
    const newMap = new Map<string, EnrollmentGoodsItem>();
    for (const g of newGoods) {
      if (!g || !g.id) continue;
      const gid = String(g.id).trim();
      if (!gid) continue;

      const existing = this.goods.get(gid);
      const rawPrice = Number(g.price) || 0;
      const price = Math.max(0, Number.isFinite(rawPrice) ? rawPrice : 0);

      const rawQty = g.quantity !== undefined
        ? g.quantity
        : (existing ? existing.quantity : 1);
      const parsedQty = Math.floor(Number(rawQty));
      const quantity = Math.max(1, Number.isFinite(parsedQty) ? parsedQty : 1);

      newMap.set(gid, {
        id: gid,
        name: g.name || '物品',
        price,
        quantity,
        unit: g.unit || '件',
        category: g.category,
        coverUrl: g.coverUrl,
      });
    }

    this.goods.clear();
    for (const [k, v] of newMap.entries()) {
      this.goods.set(k, v);
    }
  }

  setClasses(newClasses: any[]): void {
    // 1. 先清空所有已选课程的已分配班级
    for (const course of this.courses.values()) {
      course.assignedClass = null;
    }
    if (!Array.isArray(newClasses) || newClasses.length === 0) {
      return;
    }

    // 2. 优先为明确指定 courseId 的班级完成精准分配
    const unassignedClasses: any[] = [];
    for (const cls of newClasses) {
      if (!cls || !cls.id) continue;
      const clsCourseId = cls.courseId ? String(cls.courseId).trim() : '';
      if (clsCourseId) {
        if (this.courses.has(clsCourseId)) {
          this.assignClass(clsCourseId, cls);
        }
        // 若 cls.courseId 属于未选课程，属于跨课无关班级，安全忽略，严禁强行分配至其他无关课程
      } else {
        // 未指定 courseId 的通用班级，放入待自动分配队列
        unassignedClasses.push(cls);
      }
    }

    // 3. 对未指定所属课程或无归属的班级，按顺序分配给尚未排班的课程
    for (const cls of unassignedClasses) {
      const targetCourse = Array.from(this.courses.values()).find((c) => !c.assignedClass);
      if (targetCourse) {
        this.assignClass(targetCourse.id, cls);
      }
    }
  }

  clear(): void {
    this.courses.clear();
    this.goods.clear();
  }

  async submit(): Promise<EnrollmentReceipt> {
    if (this.isSubmitting) {
      throw new Error('开单请求正在处理中，请勿重复提交');
    }

    const report = this.validationReport;
    if (!report.isValid || !report.canEnroll) {
      throw new Error(report.riskReason || report.errors[0] || '报名校验未通过，无法提交');
    }

    const coursesPayload = this.selectedCourses.map((c) => ({
      id: c.id,
      name: c.name,
      totalPrice: c.totalPrice,
      totalLessons: c.totalLessons || 48,
      bonusLessons: c.bonusLessons || 0,
      discountAmount: c.discountAmount || 0,
      pricePerLesson: c.pricePerLesson || 64,
      classId: c.assignedClass?.id,
      className: c.assignedClass?.name,
    }));

    const goodsPayload = this.selectedGoods.map((g) => ({
      id: g.id,
      name: g.name,
      price: g.price,
      quantity: g.quantity,
    }));

    const summary = this.financialSummary;

    const payload: EnrollmentIntentPayload = {
      studentId: String(this.student.id),
      studentName: this.student.name || '学员',
      campusId: this.student.campusId || this.options.campusId || 'campus-bj-hq',
      campusName: this.student.campusName || this.options.campusName || '拓视未来-原阳校区',
      paymentMethod: this.paymentMethod,
      channel: this.channel || this.options.channel,
      totalAmount: summary.totalAmount,
      coursesSubtotal: summary.coursesSubtotal,
      goodsSubtotal: summary.goodsSubtotal,
      courses: coursesPayload,
      goods: goodsPayload,
    };

    this.isSubmitting = true;
    try {
      const receipt = await this.port.fulfill(payload);
      return receipt;
    } catch (err: any) {
      // 部分课程履约成功时，将已完成课程自愈出清，彻底杜绝重试时重复建单扣款
      if (err && Array.isArray(err.partialCompletedCourseIds) && err.partialCompletedCourseIds.length > 0) {
        for (const doneId of err.partialCompletedCourseIds) {
          this.courses.delete(doneId);
        }
        // 若首门课程已完成，全单配套物品已挂载落盘，同步出清物品
        if (err.partialCompletedCourseIds.includes(payload.courses[0]?.id)) {
          this.goods.clear();
        }
      }
      throw err;
    } finally {
      this.isSubmitting = false;
    }
  }
}

export function startSession(
  student: any,
  options?: StartSessionOptions
): EnrollmentDraftSession {
  return new DefaultEnrollmentDraftSession(student, options);
}

export class EnrollmentCoordinator {
  startSession(student: any, options?: StartSessionOptions): EnrollmentDraftSession {
    return startSession(student, options);
  }

  createSession(student: any, options?: StartSessionOptions): EnrollmentDraftSession {
    return startSession(student, options);
  }

  createCoordinator(options?: StartSessionOptions) {
    return {
      startSession: (student: any) => startSession(student, options),
    };
  }
}

export const enrollmentCoordinator = new EnrollmentCoordinator();
(enrollmentCoordinator as any).startSession = startSession;
(enrollmentCoordinator as any).createSession = startSession;
(enrollmentCoordinator as any).DefaultSessionClass = DefaultEnrollmentDraftSession;
(enrollmentCoordinator as any).CoordinatorClass = EnrollmentCoordinator;

