/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」行级数据隔离策略引擎 (DataScopePolicyEngine)
 * 纯领域类型定义与异常规范 (Domain Types & Contract Specifications)
 * ==============================================================================
 */

export type SupportedDataScope = 'all' | 'campus' | 'department' | 'self';

/**
 * 操作者安全上下文 (Actor Security Context)
 */
export interface ActorContext {
  readonly userId: string;
  readonly campusId: string;
  readonly campusName?: string;
  readonly dataScope: SupportedDataScope;
  readonly departmentId?: string;
  readonly teacherId?: string;
  readonly roles?: string[];
  readonly permissions?: string[];
  readonly isSuperAdmin?: boolean;
  readonly isBypassed?: boolean;
}

/**
 * 行级数据过滤计算结果谓词
 */
export interface ScopeFilterPredicate {
  readonly isUnrestricted: boolean;
  readonly campusId?: string;
  readonly departmentId?: string;
  readonly teacherId?: string;
  readonly customWhere?: Record<string, any>;
}

/**
 * 受控业务模型拓扑元数据定义
 */
export interface ScopedModelRule {
  readonly resource: string;
  /** 直属校区字段名，默认为 'campusId' */
  readonly campusField?: string;
  /** 仅本人数据范围关联字段名，如 'teacherId' 或 'creatorId' */
  readonly selfField?: string;
  /** 部门关联字段名，如 'departmentId' */
  readonly departmentField?: string;
  /** 自定义谓词编译器（针对复杂多校区穿透与双向可见业务） */
  readonly customFilterBuilder?: (
    actor: ActorContext,
    baseWhere?: Record<string, any>,
  ) => Record<string, any> | null;
}

/**
 * 领域异常基类
 */
export abstract class DataScopeViolationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DataScopeViolationError';
  }
}

/**
 * 未建立作用域上下文异常 (Fail-Closed 闭门保障)
 */
export class MissingScopeContextError extends DataScopeViolationError {
  constructor() {
    super(
      '系统在未建立合法租户上下文的情况下发起了受控数据访问 (Fail-Closed 拦截)',
      'MISSING_SCOPE_CONTEXT',
    );
  }
}

/**
 * 跨校区数据越权篡改与访问异常
 */
export class CrossCampusTamperError extends DataScopeViolationError {
  constructor(userCampus: string, targetCampus: string) {
    super(
      `数据权限越权：您所属校区为 [${userCampus}]，无权访问或操作目标校区 [${targetCampus}] 的业务数据`,
      'CROSS_CAMPUS_TAMPER',
    );
  }
}

/**
 * 权限等级不足异常
 */
export class ScopePrivilegeInsufficientError extends DataScopeViolationError {
  constructor(required: SupportedDataScope, actual: SupportedDataScope) {
    super(
      `数据透视权限不足：该操作需要 [${required}] 数据范围，当前账号仅具备 [${actual}]`,
      'PRIVILEGE_INSUFFICIENT',
    );
  }
}
