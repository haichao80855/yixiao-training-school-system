import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';
import { isCampusLeader } from '../../common/campus-leader.policy';
import { TeacherPayCoordinator } from './domain/teacher-pay.coordinator';

/**
 * 老师课酬：只有校区负责人 (执行校长) 及以上能用，任课老师、财务、教务都不能访问。
 * 课酬按校区计算，集团管理员需要先在顶部切换到具体校区。
 */
@Controller('api/financial/teacher-pay')
export class TeacherPayController {
  constructor(private readonly teacherPay: TeacherPayCoordinator) {}

  private guard(user: any, scope?: CampusScopeResult): string {
    if (!isCampusLeader(user)) {
      throw new ForbiddenException('只有校区负责人及以上可以查看老师课酬');
    }
    const campusId = scope?.targetCampusId;
    if (!campusId || campusId === 'all') {
      throw new BadRequestException('老师课酬按校区计算，请先在顶部切换到具体校区');
    }
    return campusId;
  }

  private operatorName(user: any): string {
    return user?.realName || user?.account || '未知';
  }

  @Get()
  async getMonth(
    @Query('month') month: string,
    @CurrentUser() user: any,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    const campusId = this.guard(user, scope);
    return this.teacherPay.getMonth(campusId, month);
  }

  @Post('confirm')
  async confirm(
    @Body('month') month: string,
    @CurrentUser() user: any,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    const campusId = this.guard(user, scope);
    return this.teacherPay.confirm(campusId, month, this.operatorName(user));
  }

  @Post('reopen')
  async reopen(
    @Body('month') month: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    const campusId = this.guard(user, scope);
    return this.teacherPay.reopen(campusId, month, reason, this.operatorName(user));
  }

  @Get('rules')
  async getRules(@CurrentUser() user: any, @CampusScope() scope?: CampusScopeResult) {
    const campusId = this.guard(user, scope);
    return this.teacherPay.getRules(campusId);
  }

  @Put('rules')
  async saveRules(@Body() body: any, @CurrentUser() user: any, @CampusScope() scope?: CampusScopeResult) {
    const campusId = this.guard(user, scope);
    return this.teacherPay.saveRules(campusId, body, user?.id);
  }
}
