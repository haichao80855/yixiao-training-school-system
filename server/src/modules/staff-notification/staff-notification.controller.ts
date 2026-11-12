import { Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffNotificationService, canReceiveStaffNotifications } from './domain/staff-notification.service';

/** 后台顶部铃铛里的站内通知，只有校区负责人及以上能看 */
@Controller('api/notifications')
export class StaffNotificationController {
  constructor(
    private readonly notifications: StaffNotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    if (!canReceiveStaffNotifications(user)) {
      return { enabled: false, items: [], unreadCount: 0 };
    }
    const result = await this.notifications.list(user.id, scope?.targetCampusId, Number(limit) || 20);
    return { enabled: true, ...result };
  }

  @Post('read-all')
  async readAll(@CurrentUser() user: any, @CampusScope() scope?: CampusScopeResult) {
    if (!canReceiveStaffNotifications(user)) throw new ForbiddenException('没有查看通知的权限');
    const count = await this.notifications.markAllRead(user.id, scope?.targetCampusId);
    return { count };
  }

  @Post(':id/read')
  async read(@Param('id') id: string, @CurrentUser() user: any, @CampusScope() scope?: CampusScopeResult) {
    if (!canReceiveStaffNotifications(user)) throw new ForbiddenException('没有查看通知的权限');
    const notification = await this.prisma.staffNotification.findUnique({ where: { id }, select: { campusId: true } });
    if (!notification || (scope?.targetCampusId && notification.campusId !== scope.targetCampusId)) {
      throw new NotFoundException('通知不存在');
    }
    await this.notifications.markRead(user.id, id);
    return { id };
  }
}
