import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

export const DATA_SCOPE_KEY = 'data_scope_required';
export type SupportedDataScope = 'all' | 'campus' | 'department' | 'self';

/**
 * 声明路由或控制器所需的数据透视范围
 * 示例: @RequireDataScope('all') // 需要全集团透视权限
 */
export const RequireDataScope = (scope: SupportedDataScope) =>
  SetMetadata(DATA_SCOPE_KEY, scope);

@Injectable()
export class DataScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. 公开接口自动放行
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredScope = this.reflector.getAllAndOverride<SupportedDataScope>(
      DATA_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 未标记数据范围限制的接口放行
    if (!requiredScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Fail-Closed 防御：若标记了数据权限但无合法用户凭据，坚决阻断
    if (!user) {
      throw new ForbiddenException('未经身份鉴权的数据透视请求');
    }

    // 2. 超级管理员 / 全校区权限全局放行
    const isSuperAdmin =
      user.dataScope === 'all' ||
      user.roles?.some(
        (r: any) =>
          r.code === 'super_admin' ||
          r.code === 'admin' ||
          r.id === 'r1' ||
          r.dataScope === 'all',
      ) ||
      user.permissions?.includes('*') ||
      user.permissions?.includes('admin:all');

    if (isSuperAdmin) {
      return true;
    }

    // 3. 跨校区数据篡改拦截
    const requestedCampusId =
      request.params?.campusId ||
      request.query?.campusId ||
      request.body?.campusId ||
      request.headers['x-campus-id'];

    if (
      requestedCampusId &&
      requestedCampusId !== user.campusId &&
      requestedCampusId !== 'all'
    ) {
      throw new ForbiddenException(
        `数据权限受限：您属于校区 [${user.campusName || user.campusId}]，无权访问或操作目标校区 [${requestedCampusId}] 的业务数据`,
      );
    }

    // 4. 数据范围层级比较 (all: 1 < campus: 2 < department: 3 < self: 4)
    const scopePriority: Record<SupportedDataScope, number> = {
      all: 1,
      campus: 2,
      department: 3,
      self: 4,
    };

    const userScopeLevel = scopePriority[user.dataScope as SupportedDataScope] || 4;
    const requiredScopeLevel = scopePriority[requiredScope] || 1;

    if (userScopeLevel > requiredScopeLevel) {
      const scopeLabels: Record<SupportedDataScope, string> = {
        all: '集团全校区',
        campus: '本校区',
        department: '本部门',
        self: '仅本人',
      };
      throw new ForbiddenException(
        `数据透视权限不足：该操作需要 [${scopeLabels[requiredScope] || requiredScope}] 数据范围，当前账号仅为 [${scopeLabels[user.dataScope as SupportedDataScope] || user.dataScope}]`,
      );
    }

    return true;
  }
}
