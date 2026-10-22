/** 家长 JWT 载荷 (typ 区分家长与教职工令牌) */
export interface ParentJwtPayload {
  typ: 'parent';
  sub: string; // ParentAccount.id
  sid: string; // ParentSession.id
  ver: number; // ParentAccount.tokenVersion
}

/** 经 JwtStrategy 校验后挂载到 request.user 的家长身份 */
export interface ParentPrincipal {
  principal: 'parent';
  parentAccountId: string;
  sessionId: string;
  phone: string;
  roles: [];
  permissions: [];
}

export type ChildAccess = 'full' | 'read_only';

export interface ChildRef {
  studentId: string;
  name: string;
  campusId: string;
  campusName: string;
  status: string;
  access: ChildAccess;
  /** 只读访问截止时间 (仅已离校学员) */
  readOnlyUntil: string | null;
}

/** 已离校学员保留家长只读访问的天数 (约 3 个月) */
export const FORMER_STUDENT_ACCESS_DAYS = 90;
export const LEFT_STATUSES = ['transferred', 'dropped_out'];
