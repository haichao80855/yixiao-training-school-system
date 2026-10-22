import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ParentPrincipal } from './parent.types';

export const IS_PARENT_ROUTE_KEY = 'isParentRoute';

/**
 * 标记家长端接口。家长令牌只能访问带此标记的接口，教职工令牌不能访问带此标记的接口。
 */
export const ParentRoute = () => SetMetadata(IS_PARENT_ROUTE_KEY, true);

export const CurrentParent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ParentPrincipal => ctx.switchToHttp().getRequest().user,
);
