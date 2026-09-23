import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentCampus = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // 优先从 Header 中提取前端切换的当前校区 ID (x-campus-id)
    const headerCampusId = request.headers['x-campus-id'] as string;
    if (headerCampusId) {
      return headerCampusId;
    }
    // 否则兜底使用当前用户默认所属校区
    return request.user?.campusId || 'campus-bj-hq';
  },
);
