import { Body, Controller, Delete, Get, HttpCode, Ip, Param, Post, Put, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentParent, ParentRoute } from './parent-route.decorator';
import { ParentAuthService, ParentLoginInput } from './parent-auth.service';
import { ParentPortalService } from './parent-portal.service';
import { ParentPrincipal } from './parent.types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 家长端接口 /api/parent/*
 * 除登录外全部标记 @ParentRoute()：仅家长令牌可访问，且每个 :sid 都校验为本人子女。
 */
@Controller('api/parent')
export class ParentController {
  constructor(
    private readonly auth: ParentAuthService,
    private readonly portal: ParentPortalService,
  ) {}

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() body: ParentLoginInput, @Ip() ip: string) {
    return this.auth.login(body, ip || 'unknown');
  }

  @ParentRoute()
  @Post('auth/logout')
  @HttpCode(200)
  logout(@CurrentParent() parent: ParentPrincipal) {
    return this.auth.logout(parent);
  }

  @ParentRoute()
  @Get('me')
  me(@CurrentParent() parent: ParentPrincipal) {
    return this.portal.me(parent);
  }

  @ParentRoute()
  @Put('me/current-child')
  setCurrentChild(@CurrentParent() parent: ParentPrincipal, @Body('studentId') studentId: string) {
    return this.auth.setCurrentChild(parent, studentId);
  }

  @ParentRoute()
  @Get('sessions')
  sessions(@CurrentParent() parent: ParentPrincipal) {
    return this.auth.listSessions(parent);
  }

  @ParentRoute()
  @Delete('sessions/:id')
  revokeSession(@CurrentParent() parent: ParentPrincipal, @Param('id') id: string) {
    return this.auth.revokeSession(parent, id);
  }

  @ParentRoute()
  @Get('students/:sid/schedule')
  schedule(
    @CurrentParent() parent: ParentPrincipal,
    @Param('sid') sid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.portal.schedule(parent, sid, from, to);
  }

  @ParentRoute()
  @Get('students/:sid/courses')
  courses(@CurrentParent() parent: ParentPrincipal, @Param('sid') sid: string) {
    return this.portal.courses(parent, sid);
  }

  @ParentRoute()
  @Get('students/:sid/courses/:packageId/usage')
  courseUsage(
    @CurrentParent() parent: ParentPrincipal,
    @Param('sid') sid: string,
    @Param('packageId') packageId: string,
  ) {
    return this.portal.courseUsage(parent, sid, packageId);
  }

  @ParentRoute()
  @Get('students/:sid/evaluations')
  evaluations(
    @CurrentParent() parent: ParentPrincipal,
    @Param('sid') sid: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.portal.evaluationFeed(parent, sid, cursor, limit);
  }

  @ParentRoute()
  @Get('students/:sid/evaluations/:scheduleEventId')
  evaluationDetail(
    @CurrentParent() parent: ParentPrincipal,
    @Param('sid') sid: string,
    @Param('scheduleEventId') scheduleEventId: string,
  ) {
    return this.portal.evaluationDetail(parent, sid, scheduleEventId);
  }

  @ParentRoute()
  @Post('students/:sid/evaluations/:scheduleEventId/read')
  @HttpCode(200)
  markRead(
    @CurrentParent() parent: ParentPrincipal,
    @Param('sid') sid: string,
    @Param('scheduleEventId') scheduleEventId: string,
  ) {
    return this.portal.markRead(parent, sid, scheduleEventId);
  }

  @ParentRoute()
  @Get('students/:sid/album')
  album(
    @CurrentParent() parent: ParentPrincipal,
    @Param('sid') sid: string,
    @Query('cursor') cursor?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.portal.album(parent, sid, cursor, type, limit);
  }

  @ParentRoute()
  @Get('students/:sid/growth/summary')
  growthSummary(@CurrentParent() parent: ParentPrincipal, @Param('sid') sid: string) {
    return this.portal.growthSummary(parent, sid);
  }
}

/**
 * 教职工侧：在学员档案中让该家长手机号的全部家长端登录失效
 */
@Controller('api/students')
export class ParentAdminController {
  constructor(
    private readonly auth: ParentAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/parent-sessions/revoke')
  @RequirePermissions('student:edit')
  @HttpCode(200)
  async revokeParentSessions(@Param('id') studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { phone: true } });
    if (!student) return { revoked: 0 };
    return this.auth.revokeAllForPhone(student.phone);
  }
}
