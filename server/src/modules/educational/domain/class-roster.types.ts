import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 操作人审计上下文
 */
export interface OperatorContext {
  operatorId?: string;
  operatorName?: string;
  campusId?: string;
}

// ----------------------------------------------------------------------------
// 1. 批量入班 (assignStudents)
// ----------------------------------------------------------------------------

export interface AssignStudentsCommand {
  /** 目标实体班级 ID */
  classId: string;
  /** 待分配入班的学员 ID 列表 (支持单人或批量) */
  studentIds: string[];
  /** 可选：显式指定关联的待分班课包 ID 列表 (省略时自动智能嗅探匹配课程的 active 课包) */
  packageIds?: string[];
  /** 可选：只读仿真预检模式 (默认 false, 为 true 时不落盘) */
  dryRun?: boolean;
  /** 操作人审计上下文 */
  operator?: OperatorContext;
}

export interface StudentAssignItemResult {
  studentId: string;
  studentName: string;
  studentNo: string;
  packageId: string;
  previousClassId: string | null;
  status: 'assigned' | 'transferred' | 'idempotent_noop';
}

export interface AssignStudentsResult {
  success: boolean;
  classId: string;
  className: string;
  assignedCount: number;
  currentStudentCount: number;
  capacity: number;
  remainingCapacity: number;
  isFull: boolean;
  dryRun: boolean;
  students: StudentAssignItemResult[];
  message: string;
}

// ----------------------------------------------------------------------------
// 2. 合规移出班级 (removeStudent)
// ----------------------------------------------------------------------------

export interface RemoveStudentCommand {
  /** 当前班级 ID */
  classId: string;
  /** 移出学员 ID */
  studentId: string;
  /** 移出原因 (如：家长协商退班重排、上课时间冲突、申请调班过渡) */
  reason?: string;
  /** 操作人审计上下文 */
  operator?: OperatorContext;
}

export interface RemoveStudentResult {
  success: boolean;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  packageId: string;
  unassignedLessons: number;
  newClassStudentCount: number;
  studentStatus: 'normal' | 'in_class';
  fallbackToUnassignedPool: true;
  message: string;
}

// ----------------------------------------------------------------------------
// 3. 待分班名册查询 (getUnassignedRoster)
// ----------------------------------------------------------------------------

export interface UnassignedRosterQuery {
  campusId?: string;
  courseId?: string;
  keyword?: string;
  preferredTime?: string;
  page?: number;
  pageSize?: number;
}

export interface UnassignedStudentItemView {
  id: string;               // 虚拟行 ID: unas-${studentId}-${packageId}
  studentId: string;
  name: string;
  studentNo: string;
  avatar: string;
  gender: string;
  phone: string;
  campusId: string;
  campusName: string;
  courseId: string;
  courseName: string;
  packageId: string;
  unassignedLessons: number;
  preferredTime: string;
  signupDate: string;
  waitDays: number;
  counselor: string;
  assessmentScore: number;
  assessmentSummary: string;
}

export interface UnassignedRosterResult {
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalStudents: number;          // 待分班学员总数
    totalUnassignedLessons: number; // 待分配总课时数
    monthlyNewCount: number;        // 本月签约待入班新生数
    avgWaitDays: number;            // 平均入班响应时长 (天)
  };
  list: UnassignedStudentItemView[];
}

// ----------------------------------------------------------------------------
// 4. 班级花名册概览 (getClassRoster)
// ----------------------------------------------------------------------------

export interface ClassRosterStudentView {
  studentId: string;
  packageId: string;
  name: string;
  studentNo: string;
  phone: string;
  avatar: string;
  remainingLessons: number;
  consumedLessons: number;
  bonusLessons: number;
  isLessonDeficit: boolean;       // 课时告警 (<= 3 课时)
  joinDate: string;               // 入班时间
  status: string;                 // normal | suspended | in_class
}

export interface ClassRosterResult {
  classId: string;
  className: string;
  classCode: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  classroomName: string;
  capacity: number;
  currentStudentCount: number;
  occupancyRate: number;          // 满班率 (0~100)
  isFull: boolean;                // 是否已满班
  availableCapacity: number;      // 剩余可插班名额
  students: ClassRosterStudentView[];
}

// ----------------------------------------------------------------------------
// 5. 领域特定异常体系
// ----------------------------------------------------------------------------

export class ClassCapacityExceededException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'ClassCapacityExceeded',
        message,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DuplicateEnrollmentException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'DuplicateEnrollment',
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PackageNotEligibleException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'PackageNotEligible',
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class StudentStatusBlockedException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'StudentStatusBlocked',
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
