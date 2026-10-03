import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const DATA_SCOPE_KEY = 'data_scope_required';
export const RequireDataScope = (scope: 'all' | 'campus' | 'self') =>
  SetMetadata(DATA_SCOPE_KEY, scope);

@Injectable()
export class DataScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<'all' | 'campus' | 'self'>(
      DATA_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 无特定限制或未鉴权请求跳过
    if (!requiredScope || !user) {
      return true;
    }

    const isSuperAdmin =
      user.dataScope === 'all' ||
      user.roles?.some(
        (r: any) =>
          r.code === 'super_admin' ||
          r.code === 'admin' ||
          r.dataScope === 'all',
      ) ||
      user.permissions?.includes('*') ||
      user.permissions?.includes('admin:all');

    if (isSuperAdmin) {
      return true;
    }

    // 检查校区匹配
    const requestedCampusId =
      request.params?.campusId ||
      request.query?.campusId ||
      request.body?.campusId ||
      request.headers['x-campus-id'];

    if (requestedCampusId && requestedCampusId !== user.campusId) {
      throw new ForbiddenException(
        `数据权限受限：您属于校区 [${user.campusName || user.campusId}]，无权访问或操作目标校区 [${requestedCampusId}] 的业务数据`,
      );
    }

    if (requiredScope === 'all' && user.dataScope !== 'all') {
      throw new ForbiddenException('该操作需要集团全校区管理权限');
    }

    return true;
  }
}
