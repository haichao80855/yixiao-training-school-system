export type PaymentMethod = 'wechat' | 'alipay' | 'pos' | 'bank_transfer' | 'wallet';

export interface EnrollmentClassAssignment {
  id: string;
  name: string;
  courseId?: string;
  courseName?: string;
  teacherName?: string;
  capacity?: number;
  currentStudentCount?: number;
  startDateText?: string;
  schedulePatternText?: string;
}

export interface EnrollmentCourseItem {
  id: string;
  name: string;
  totalPrice: number;
  totalLessons?: number;
  bonusLessons?: number;
  discountAmount?: number;
  pricePerLesson?: number;
  subjectName?: string;
  gradeName?: string;
  coverUrl?: string;
  assignedClass?: EnrollmentClassAssignment | null;
}

export interface EnrollmentGoodsItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  category?: string;
  coverUrl?: string;
}

export interface FinancialSummary {
  coursesSubtotal: number;
  goodsSubtotal: number;
  totalAmount: number;
  walletBalance: number;
  canCoverByWallet: boolean;
  deficit: number;
}

export interface EnrollmentValidationReport {
  isValid: boolean;
  errors: string[];
  canEnroll: boolean;
  riskReason?: string;
  deficit?: number;
}

export interface EnrollmentReceiptItem {
  type: 'course' | 'goods';
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  classId?: string;
  className?: string;
}

export interface EnrollmentReceipt {
  receiptId: string;
  orderNo: string;
  studentId: string;
  studentName: string;
  campusId: string;
  campusName?: string;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  coursesSubtotal: number;
  goodsSubtotal: number;
  totalItems: number;
  items: EnrollmentReceiptItem[];
  completedAt: string;
  success: boolean;
  dispatchMode?: 'DIRECT_SINGLE_COURSE' | 'MULTI_CATEGORY_BUNDLE';
  rawResults?: any[];
}

export interface EnrollmentIntentPayload {
  studentId: string;
  studentName: string;
  campusId: string;
  campusName?: string;
  paymentMethod: PaymentMethod;
  channel?: string;
  totalAmount: number;
  coursesSubtotal: number;
  goodsSubtotal: number;
  courses: Array<{
    id: string;
    name: string;
    totalPrice: number;
    totalLessons: number;
    bonusLessons?: number;
    discountAmount?: number;
    pricePerLesson: number;
    classId?: string;
    className?: string;
  }>;
  goods: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export interface EnrollmentDraftSession {
  readonly student: any;
  readonly selectedCourses: EnrollmentCourseItem[];
  readonly selectedGoods: EnrollmentGoodsItem[];
  readonly selectedClasses: EnrollmentClassAssignment[];
  readonly paymentMethod: PaymentMethod;
  readonly channel?: string;
  readonly financialSummary: FinancialSummary;
  readonly validationReport: EnrollmentValidationReport;
  readonly totalItemsCount: number;
  readonly isSubmitting: boolean;

  setStudent(student: any): void;
  setChannel(channel?: string): void;
  toggleCourse(course: any, targetClass?: any): void;
  toggleGoods(goods: any, quantity?: number): void;
  assignClass(courseId: string, targetClass: any | null): void;
  removeClass(courseId?: string, classId?: string): void;
  setPaymentMethod(method: string): void;
  setCourses(courses: any[]): void;
  setGoods(goods: any[]): void;
  setClasses(classes: any[]): void;
  clear(): void;
  submit(): Promise<EnrollmentReceipt>;
}

export interface StartSessionOptions {
  port?: any;
  defaultPaymentMethod?: PaymentMethod | string;
  campusId?: string;
  campusName?: string;
  channel?: string;
}
