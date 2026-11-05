import { Controller, Get, Param, Query } from '@nestjs/common';
import { CampusScope, type CampusScopeResult } from '../../common/campus-scope.policy';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TeacherPortalService, type TeacherActor } from './teacher-portal.service';

/**
 * 网页教师端只读接口：数据范围固定为登录教师本人，不接受 teacherId 参数。
 */
@Controller('api/teacher-portal')
@RequirePermissions('educational:workbench')
export class TeacherPortalController {
  constructor(private readonly service: TeacherPortalService) {}

  private actor(user: { id: string }, scope: CampusScopeResult): TeacherActor {
    return { id: user.id, campusId: scope.targetCampusId };
  }

  @Get('overview')
  getOverview(@CurrentUser() user: { id: string }, @CampusScope() scope: CampusScopeResult) {
    return this.service.getOverview(this.actor(user, scope));
  }

  @Get('evaluations')
  getEvaluations(
    @CurrentUser() user: { id: string },
    @CampusScope() scope: CampusScopeResult,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.getEvaluations(this.actor(user, scope), { startDate, endDate, status, keyword });
  }

  @Get('classes')
  getClasses(
    @CurrentUser() user: { id: string },
    @CampusScope() scope: CampusScopeResult,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.getClasses(this.actor(user, scope), { keyword });
  }

  @Get('classes/:id')
  getClassDetail(
    @CurrentUser() user: { id: string },
    @CampusScope() scope: CampusScopeResult,
    @Param('id') id: string,
  ) {
    return this.service.getClassDetail(this.actor(user, scope), id);
  }

  @Get('students')
  getStudents(
    @CurrentUser() user: { id: string },
    @CampusScope() scope: CampusScopeResult,
    @Query('keyword') keyword?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.service.getStudents(this.actor(user, scope), { keyword, page, pageSize });
  }

  @Get('students/:id')
  getStudentDetail(
    @CurrentUser() user: { id: string },
    @CampusScope() scope: CampusScopeResult,
    @Param('id') id: string,
  ) {
    return this.service.getStudentDetail(this.actor(user, scope), id);
  }

  @Get('warnings')
  getWarnings(@CurrentUser() user: { id: string }, @CampusScope() scope: CampusScopeResult) {
    return this.service.getWarnings(this.actor(user, scope));
  }
}
