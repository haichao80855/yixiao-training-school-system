import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_ANY_KEY,
} from '../../../common/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
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

    // 2. 读取路由或控制器声明的权限码要求
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 未标记权限要求的接口默认放行（受 JwtAuthGuard 基础登录保护）
    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!anyPermissions || anyPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未经身份鉴权的未受信任请求');
    }

    // 3. 超级管理员与全权限通配放行 (* / admin:all)
    const isSuperAdmin =
      user.roles?.some(
        (r: any) =>
          r.code === 'super_admin' ||
          r.code === 'admin' ||
          r.id === 'r1',
      ) ||
      user.permissions?.includes('*') ||
      user.permissions?.includes('admin:all');

    if (isSuperAdmin) {
      return true;
    }

    const userPermissions: string[] = user.permissions || [];

    // 4.1 任一权限匹配 (OR 关系)
    if (anyPermissions && anyPermissions.length > 0) {
      const hasAny = anyPermissions.some((perm) => userPermissions.includes(perm));
      if (!hasAny) {
        throw new ForbiddenException(
          `操作权限受限：缺少 [${anyPermissions.join(', ')}] 功能权限`,
        );
      }
    }

    // 4.2 全量权限精确比对 (AND 关系)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const missingPermissions = requiredPermissions.filter(
        (perm) => !userPermissions.includes(perm),
      );

      if (missingPermissions.length > 0) {
        throw new ForbiddenException(
          `操作权限受限：缺少 [${missingPermissions.join(', ')}] 功能权限`,
        );
      }
    }

    return true;
  }
}
