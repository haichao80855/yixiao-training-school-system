import { studentApi } from '../../../api/student';
import { studentProjector } from '../../../projectors/student';
import type { EnrollmentFulfillmentPort } from '../ports';
import type {
  EnrollmentIntentPayload,
  EnrollmentReceipt,
  EnrollmentReceiptItem,
} from '../types';

export class HttpEnrollmentAdapter implements EnrollmentFulfillmentPort {
  async fulfill(payload: EnrollmentIntentPayload): Promise<EnrollmentReceipt> {
    if (!payload.courses || payload.courses.length === 0) {
      throw new Error('开单意图必须包含至少一门报读课程');
    }

    const rawResults: any[] = [];
    const isSingleCourse = payload.courses.length === 1 && payload.goods.length === 0;
    const dispatchMode = isSingleCourse ? 'DIRECT_SINGLE_COURSE' : 'MULTI_CATEGORY_BUNDLE';

    const items: EnrollmentReceiptItem[] = [];

    // 1. 单课程直通模式
    if (isSingleCourse) {
      const singleCourse = payload.courses[0];
      const res = await studentApi.enrollStudent({
        studentId: payload.studentId,
        campusId: payload.campusId,
        courseId: singleCourse.id,
        courseName: singleCourse.name,
        classId: singleCourse.classId,
        className: singleCourse.className,
        totalLessons: singleCourse.totalLessons,
        lessons: singleCourse.totalLessons,
        bonusLessons: singleCourse.bonusLessons,
        discountAmount: singleCourse.discountAmount,
        pricePerLesson: singleCourse.pricePerLesson,
        amount: payload.totalAmount,
        paymentMethod: payload.paymentMethod,
        payMethod: payload.paymentMethod,
        channel: payload.channel,
      });
      rawResults.push(res);

      items.push({
        type: 'course',
        id: singleCourse.id,
        name: singleCourse.name,
        quantity: 1,
        unitPrice: singleCourse.totalPrice,
        subtotal: singleCourse.totalPrice,
        classId: singleCourse.classId,
        className: singleCourse.className,
      });
    } else {
      const completedCourseIds: string[] = [];
      for (let i = 0; i < payload.courses.length; i++) {
        const c = payload.courses[i];
        try {
          const res = await studentApi.enrollStudent({
            studentId: payload.studentId,
            campusId: payload.campusId,
            courseId: c.id,
            courseName: c.name,
            classId: c.classId,
            className: c.className,
            totalLessons: c.totalLessons,
            lessons: c.totalLessons,
            bonusLessons: c.bonusLessons,
            discountAmount: c.discountAmount,
            pricePerLesson: c.pricePerLesson,
            amount: c.totalPrice,
            paymentMethod: payload.paymentMethod,
            payMethod: payload.paymentMethod,
            channel: payload.channel,
            // 仅在首门课程关联全单配套物品，避免多课程重复挂载
            goods: i === 0 ? payload.goods : undefined,
          });
          rawResults.push(res);
          completedCourseIds.push(c.id);

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
        } catch (err: any) {
          if (completedCourseIds.length > 0) {
            try {
              studentProjector.invalidateDossier(payload.studentId);
            } catch (e) {
              console.warn('[HttpEnrollmentAdapter] invalidateDossier on partial failure warning:', e);
            }
            const partialErr: any = new Error(
              `课程「${c.name}」开单失败 (${err?.message || '网络异常'})，前序已成功 ${completedCourseIds.length} 门课程已入账。请重试未完成课程。`
            );
            partialErr.partialCompletedCourseIds = completedCourseIds;
            partialErr.originalError = err;
            throw partialErr;
          }
          throw err;
        }
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
    }

    // 学员投影缓存失效自愈
    try {
      studentProjector.invalidateDossier(payload.studentId);
    } catch (e) {
      console.warn('[HttpEnrollmentAdapter] invalidateDossier warning:', e);
    }

    const firstResult = rawResults[0] || {};
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = `${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    const generatedOrderNo = `ORD-${dateStr}-${randomSuffix}`;
    const receiptId = firstResult.orderNo || firstResult.receiptId || firstResult.id || generatedOrderNo;

    return {
      receiptId,
      orderNo: receiptId,
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
      rawResults,
    };
  }
}
