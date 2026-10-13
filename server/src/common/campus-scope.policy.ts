import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * 校区上下文与数据权限解析结果
 */
export interface CampusScopeResult {
  /** 有效过滤校区 ID；若为 undefined 则表示全集团跨校区透视 */
  targetCampusId?: string;
  /** 若数据权限为仅本部门 (department)，则绑定所属组织架构部门节点 ID */
  departmentId?: string;
  /** 若数据权限为仅本人 (self)，则绑定教师/员工本人 ID */
  teacherId?: string;
  /** 是否拥有全集团透视权限 */
  canAccessAll: boolean;
  /** 是否为仅本人 (self) 数据权限 */
  isSelfScope: boolean;
  /** 是否为仅本部门 (department) 数据权限 */
  isDepartmentScope: boolean;
}

/**
 * 判定用户是否具备全集团超级管理员数据权限
 */
export function isSuperAdminUser(user?: any): boolean {
  if (!user) return false;
  return (
    user.dataScope === 'all' ||
    user.roles?.some(
      (r: any) =>
        r.code === 'super_admin' ||
        r.code === 'admin' ||
        r.id === 'r1' ||
        r.dataScope === 'all' ||
        r === 'super_admin',
    ) ||
    user.permissions?.includes('*') ||
    user.permissions?.includes('admin:all')
  );
}

/**
 * 统一解析校区作用域与数据权限边界 (4 级 RBAC 数据范围)
 */
export function resolveCampusScope(
  user: any,
  queryCampusId?: string,
  headerCampusId?: string,
): CampusScopeResult {
  const isSuper = isSuperAdminUser(user);
  const isSelf = user?.dataScope === 'self';
  const isDepartment = user?.dataScope === 'department';

  // 1. 超管 / 全校区数据权限
  if (isSuper) {
    const targetCampusId =
      queryCampusId && queryCampusId !== 'all' ? queryCampusId : undefined;
    return {
      targetCampusId,
      canAccessAll: true,
      isSelfScope: false,
      isDepartmentScope: false,
    };
  }

  // 2. 普通分校角色：以 Token 绑定的 user.campusId 为准，安全回退到 header
  const userCampusId = user?.campusId || headerCampusId || 'campus-bj-hq';

  // 防越权：如果前端请求试图访问非本人所属校区（且非 'all'），直接拦截
  if (queryCampusId && queryCampusId !== 'all' && queryCampusId !== userCampusId) {
    throw new ForbiddenException(
      `数据权限越权：您所属校区为 [${user?.campusName || userCampusId}]，无权访问校区 [${queryCampusId}] 的数据`,
    );
  }

  return {
    targetCampusId: userCampusId,
    departmentId: isDepartment ? (user?.departmentId || user?.orgNodeId) : undefined,
    teacherId: isSelf ? (user?.id || user?.teacherId) : undefined,
    canAccessAll: false,
    isSelfScope: isSelf,
    isDepartmentScope: isDepartment,
  };
}

/**
 * 参数装饰器：统一提取并解析当前请求的校区作用域与数据权限
 */
export const CampusScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CampusScopeResult => {
    const req = ctx.switchToHttp().getRequest();
    const queryCampusId = (req.query?.campusId as string) || (req.body?.campusId as string);
    const headerCampusId = req.headers['x-campus-id'] as string;
    return resolveCampusScope(req.user, queryCampusId, headerCampusId);
  },
);
