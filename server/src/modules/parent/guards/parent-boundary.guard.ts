import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { IS_PARENT_ROUTE_KEY } from '../parent-route.decorator';

/**
 * 家长 / 教职工令牌边界守卫 (全局，默认拒绝)
 *  - 家长令牌：只允许访问 @ParentRoute() 接口。漏加权限注解的教职工接口也不会对家长开放。
 *  - 教职工令牌：不允许访问 @ParentRoute() 接口。
 */
@Injectable()
export class ParentBoundaryGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const isParentRoute = this.reflector.getAllAndOverride<boolean>(IS_PARENT_ROUTE_KEY, targets) === true;
    const user = context.switchToHttp().getRequest().user;
    const isParent = user?.principal === 'parent';

    if (isParent && !isParentRoute) {
      throw new ForbiddenException('家长账号无权访问该接口');
    }
    if (isParentRoute && !isParent) {
      throw new ForbiddenException('该接口仅限家长账号访问');
    }
    return true;
  }
}
