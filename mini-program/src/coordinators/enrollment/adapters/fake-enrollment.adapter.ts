import type { EnrollmentFulfillmentPort } from '../ports';
import type {
  EnrollmentIntentPayload,
  EnrollmentReceipt,
  EnrollmentReceiptItem,
} from '../types';

export class FakeEnrollmentAdapter implements EnrollmentFulfillmentPort {
  readonly submittedPayloads: EnrollmentIntentPayload[] = [];
  readonly receipts: EnrollmentReceipt[] = [];
  shouldFail: Error | null = null;
  failOnCourseIndex?: number;
  lastDispatchMode?: 'DIRECT_SINGLE_COURSE' | 'MULTI_CATEGORY_BUNDLE';

  async fulfill(payload: EnrollmentIntentPayload): Promise<EnrollmentReceipt> {
    if (this.shouldFail) {
      throw this.shouldFail;
    }
    if (!payload.courses || payload.courses.length === 0) {
      throw new Error('开单意图必须包含至少一门报读课程');
    }
    if (this.failOnCourseIndex !== undefined && this.failOnCourseIndex < payload.courses.length) {
      const completedIds = payload.courses.slice(0, this.failOnCourseIndex).map((c) => c.id);
      const failedCourse = payload.courses[this.failOnCourseIndex];
      const err: any = new Error(
        `课程「${failedCourse.name}」开单失败 (模拟超时)，前序已成功 ${completedIds.length} 门课程已入账。请重试未完成课程。`
      );
      err.partialCompletedCourseIds = completedIds;
      throw err;
    }

    this.submittedPayloads.push(JSON.parse(JSON.stringify(payload)));

    const isSingleCourse = payload.courses.length === 1 && payload.goods.length === 0;
    const dispatchMode = isSingleCourse ? 'DIRECT_SINGLE_COURSE' : 'MULTI_CATEGORY_BUNDLE';
    this.lastDispatchMode = dispatchMode;

    const items: EnrollmentReceiptItem[] = [];

    for (const c of payload.courses) {
      items.push({
        type: 'course',
        id: c.id,
        name: c.name,
        quantity: 1,
        unitPrice: c.totalPrice,
        subtotal: c.totalPrice,
        classId: c.classId,
        className: c.className,
      });
    }

    for (const g of payload.goods) {
      const subtotal = Math.round(g.price * g.quantity * 100) / 100;
      items.push({
        type: 'goods',
        id: g.id,
        name: g.name,
        quantity: g.quantity,
        unitPrice: g.price,
        subtotal,
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = `${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    const orderNo = `ORD-${dateStr}-${randomSuffix}`;

    const receipt: EnrollmentReceipt = {
      receiptId: orderNo,
      orderNo,
      studentId: payload.studentId,
      studentName: payload.studentName,
      campusId: payload.campusId,
      campusName: payload.campusName,
      paymentMethod: payload.paymentMethod,
      totalAmount: payload.totalAmount,
      coursesSubtotal: payload.coursesSubtotal,
      goodsSubtotal: payload.goodsSubtotal,
      totalItems: items.length,
      items,
      completedAt: new Date().toISOString(),
      success: true,
      dispatchMode,
    };

    this.receipts.push(receipt);
    return receipt;
  }
}
