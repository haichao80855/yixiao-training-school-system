import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { EducationalService } from './educational.service';
import { BatchSchedulingCoordinator } from './domain/batch-scheduling.coordinator';
import { ClassRosterCoordinator } from './domain/class-roster.coordinator';
import { LearningGrowthProjector } from './domain/learning-growth.projector';
import { LessonRenewalCoordinator } from '../student/domain/lesson-renewal.coordinator';
import { ClassLifecycleCoordinator } from './domain/class-lifecycle.coordinator';
import { LessonEvaluationCoordinator } from './domain/lesson-evaluation.coordinator';
import { CommitEvaluationCommand } from './domain/lesson-evaluation.types';
import { LessonFulfillmentCoordinator } from './domain/lesson-fulfillment.coordinator';
import { FulfillLessonCommand, ReverseFulfillmentCommand } from './domain/lesson-fulfillment.types';
import { CreateClassroomDto, UpdateClassroomDto } from './dto/classroom.dto';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateScheduleDto, CheckCollisionDto } from './dto/schedule.dto';
import { BatchScheduleIntentDto } from './dto/batch-schedule.dto';
import { RollCallDto } from './dto/attendance.dto';
import {
  AssignStudentsDto,
  RemoveStudentDto,
  UnassignedRosterQueryDto,
} from './dto/class-roster.dto';
import { CurrentCampus } from '../../common/decorators/current-campus.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('api/educational')
export class EducationalController {
  constructor(
    private readonly educationalService: EducationalService,
    private readonly batchSchedulingCoordinator: BatchSchedulingCoordinator,
    private readonly rosterCoordinator: ClassRosterCoordinator,
    private readonly growthProjector: LearningGrowthProjector,
    private readonly renewalCoordinator: LessonRenewalCoordinator,
    private readonly lifecycleCoordinator: ClassLifecycleCoordinator,
    private readonly evaluationCoordinator: LessonEvaluationCoordinator,
    private readonly fulfillmentCoordinator: LessonFulfillmentCoordinator,
  ) {}

  // ----------------------------------------------------------------
  // 0. 授课教师/讲师列表（教务业务专用端点，无需人事系统最高权限）
  // ----------------------------------------------------------------

  @Get('teachers')
  async getTeachers(
    @CampusScope() scope: CampusScopeResult,
    @Query('campusId') campusId?: string,
  ) {
    const targetCampusId = campusId && campusId !== 'all' ? campusId : scope?.targetCampusId;
    return this.educationalService.getTeachers(targetCampusId);
  }

  // ----------------------------------------------------------------
  // 1. 教室管理
  // ----------------------------------------------------------------

  @Get('classrooms')
  @RequirePermissions('educational:classManagement')
  async getClassrooms(@CampusScope() scope: CampusScopeResult) {
    return this.educationalService.getClassrooms(scope.targetCampusId);
  }

  @Post('classrooms')
  @RequirePermissions('educational:class:add')
  async createClassroom(
    @Body() dto: CreateClassroomDto,
    @CampusScope() scope: CampusScopeResult,
  ) {
    if (!dto.campusId && scope.targetCampusId) {
      dto.campusId = scope.targetCampusId;
    }
    return this.educationalService.createClassroom(dto);
  }

  @Put('classrooms/:id')
  @RequirePermissions('educational:class:edit')
  async updateClassroom(
    @Param('id') id: string,
    @Body() dto: UpdateClassroomDto,
  ) {
    return this.educationalService.updateClassroom(id, dto);
  }

  @Delete('classrooms/:id')
  @RequirePermissions('educational:class:edit')
  async deleteClassroom(@Param('id') id: string) {
    return this.educationalService.deleteClassroom(id);
  }

  // ----------------------------------------------------------------
  // 2. 班级管理
  // ----------------------------------------------------------------

  @Get('classes')
  @RequirePermissions('educational:classManagement')
  async getClasses(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('courseId') courseId?: string,
    @Query('teacherId') teacherId?: string,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.educationalService.getClasses({
      page,
      pageSize,
      keyword,
      courseId,
      teacherId: teacherId || scope?.teacherId,
      campusId: scope?.targetCampusId,
    });
  }

  @Get('classes/:id')
  @RequirePermissions('educational:classManagement')
  async getClassById(@Param('id') id: string) {
    return this.educationalService.getClassById(id);
  }

  @Post('classes')
  @RequirePermissions('educational:class:add')
  async createClass(
    @Body() dto: CreateClassDto,
    @CampusScope() scope: CampusScopeResult,
  ) {
    if (!dto.campusId && scope.targetCampusId) {
      dto.campusId = scope.targetCampusId;
    }
    return this.educationalService.createClass(dto);
  }

  @Put('classes/:id')
  @RequirePermissions('educational:class:edit')
  async updateClass(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.educationalService.updateClass(id, dto);
  }

  @Delete('classes/:id')
  @RequirePermissions('educational:class:edit')
  async deleteClass(@Param('id') id: string) {
    return this.educationalService.deleteClass(id);
  }

  @Post('classes/:id/students')
  @RequirePermissions('educational:class:assign')
  async assignStudentToClass(
    @Param('id') classId: string,
    @Body() body: any,
  ) {
    const studentId = body?.studentId || (Array.isArray(body?.studentIds) ? body.studentIds[0] : undefined);
    if (!studentId) {
      throw new BadRequestException('请提供待绑定的学员 ID (studentId 或 studentIds)');
    }
    return this.educationalService.bindStudentToClass(classId, studentId);
  }

  @Get('classes/:id/roster-health')
  @RequirePermissions('educational:classManagement')
  async getClassRosterHealth(@Param('id') classId: string) {
    return this.renewalCoordinator.getClassRosterHealth(classId);
  }

  // ----------------------------------------------------------------
  // 2.2 教学班级全生命周期协调调度 (Class Lifecycle Coordinator 接缝)
  // ----------------------------------------------------------------

  @Post('classes/:id/activate')
  @RequirePermissions('educational:class:edit')
  async activateClass(
    @Param('id') classId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.lifecycleCoordinator.activateClass({
      classId,
      actualStartDate: body?.actualStartDate,
      minStudentCount: body?.minStudentCount,
      operator: {
        operatorId: user?.id,
        operatorName: user?.realName || user?.account,
        campusId: user?.campusId,
      },
    });
  }

  @Post('classes/:id/complete')
  @RequirePermissions('educational:class:edit')
  async completeClass(
    @Param('id') classId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.lifecycleCoordinator.completeClass({
      classId,
      disposition: body?.disposition || { mode: 'fallback_unassigned' },
      cancelFutureSchedules: body?.cancelFutureSchedules !== false,
      remark: body?.remark,
      operator: {
        operatorId: user?.id,
        operatorName: user?.realName || user?.account,
        campusId: user?.campusId,
      },
    });
  }

  @Post('classes/:id/cancel')
  @RequirePermissions('educational:class:edit')
  async cancelClass(
    @Param('id') classId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!body?.reason) {
      throw new BadRequestException('必须填写解散班级的原因说明');
    }
    return this.lifecycleCoordinator.cancelClass({
      classId,
      reason: body.reason,
      operator: {
        operatorId: user?.id,
        operatorName: user?.realName || user?.account,
        campusId: user?.campusId,
      },
    });
  }

  @Post('classes/merge')
  @RequirePermissions('educational:class:edit')
  async mergeClasses(
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.lifecycleCoordinator.mergeClasses({
      sourceClassIds: body?.sourceClassIds || [],
      targetClassId: body?.targetClassId,
      sourceDisposition: body?.sourceDisposition,
      reason: body?.reason,
      operator: {
        operatorId: user?.id,
        operatorName: user?.realName || user?.account,
        campusId: user?.campusId,
      },
    });
  }

  @Post('classes/:id/preview-lifecycle')
  @RequirePermissions('educational:classManagement')
  async previewClassLifecycle(
    @Param('id') classId: string,
    @Body() body: any,
  ) {
    return this.lifecycleCoordinator.previewOperation({
      classId,
      action: body?.action || 'complete',
      disposition: body?.disposition,
      targetClassId: body?.targetClassId,
      minStudentCount: body?.minStudentCount,
      cancelFutureSchedules: body?.cancelFutureSchedules,
      reason: body?.reason,
    });
  }

  // ----------------------------------------------------------------
  // 2.1 班级花名册与分班履约调度 (Class Roster Coordinator 接缝)
  // ----------------------------------------------------------------

  @Post('roster/assign')
  @RequirePermissions('educational:class:assign')
  async assignStudents(
    @Body() dto: AssignStudentsDto,
    @CurrentUser() user: any,
  ) {
    return this.rosterCoordinator.assignStudents({
      classId: dto.classId,
      studentIds: dto.studentIds,
      packageIds: dto.packageIds,
      dryRun: dto.dryRun,
      operator: {
        operatorId: user?.id,
        operatorName: user?.realName || user?.account,
      },
    });
  }

  @Post('roster/preview')
  @RequirePermissions('educational:class:assign')
  async previewAssign(
    @Body() dto: AssignStudentsDto,
    @CurrentUser() user: any,
  ) {
    return this.rosterCoordinator.assignStudents({
      classId: dto.classId,
      studentIds: dto.studentIds,
      packageIds: dto.packageIds,
      dryRun: true,
      operator: {
        operatorId: user?.id,
        operatorName: user?.realName || user?.account,
      },
    });
  }

  @Post('roster/remove')
  @RequirePermissions('educational:class:assign')
  async removeStudent(
    @Body() dto: RemoveStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.rosterCoordinator.removeStudent({
      classId: dto.classId,
      studentId: dto.studentId,
      reason: dto.reason,
      operator: {
        operatorId: user?.id,
        operatorName: user?.realName || user?.account,
      },
    });
  }

  @Get('roster/unassigned')
  @RequirePermissions('educational:classManagement')
  async getUnassignedRoster(
    @Query() query: UnassignedRosterQueryDto,
    @CampusScope() scope: CampusScopeResult,
  ) {
    const campusId = query.campusId && query.campusId !== 'all' ? query.campusId : scope?.targetCampusId;
    return this.rosterCoordinator.getUnassignedRoster({
      ...query,
      campusId,
    });
  }

  @Get('roster/class/:classId')
  @RequirePermissions('educational:classManagement')
  async getClassRoster(@Param('classId') classId: string) {
    return this.rosterCoordinator.getClassRoster(classId);
  }

  // ----------------------------------------------------------------
  // 3. 排课与日程管理
  // ----------------------------------------------------------------

  @Post('schedules/check-collision')
  @RequirePermissions('educational:schedule:collision')
  async checkCollision(@Body() dto: CheckCollisionDto) {
    return this.educationalService.checkCollision(dto);
  }

  @Post('schedules/preview')
  @RequirePermissions('educational:timeSchedule')
  async previewSchedule(
    @Body() dto: BatchScheduleIntentDto,
    @CampusScope() scope: CampusScopeResult,
  ) {
    if (!dto.campusId && scope?.targetCampusId) {
      dto.campusId = scope.targetCampusId;
    }
    return this.batchSchedulingCoordinator.preview(dto as any);
  }

  @Post('schedules/batch')
  @RequirePermissions('educational:schedule:add')
  async commitBatchSchedule(
    @Body() dto: BatchScheduleIntentDto,
    @CampusScope() scope: CampusScopeResult,
    @CurrentUser() user: any,
  ) {
    if (!dto.campusId && scope?.targetCampusId) {
      dto.campusId = scope.targetCampusId;
    }
    if (!dto.operatorName && user) {
      dto.operatorName = user.realName || user.account;
    }
    return this.batchSchedulingCoordinator.commit(dto as any);
  }

  @Get('schedules')
  @RequirePermissions('educational:timeSchedule')
  async getSchedules(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('date') date?: string,
    @Query('teacherId') teacherId?: string,
    @Query('classroomId') classroomId?: string,
    @Query('classId') classId?: string,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.educationalService.getSchedules({
      startDate,
      endDate,
      date,
      teacherId: teacherId || scope?.teacherId,
      classroomId,
      classId,
      campusId: scope?.targetCampusId,
    });
  }

  @Post('schedules')
  @RequirePermissions('educational:schedule:add')
  async createSchedule(
    @Body() dto: CreateScheduleDto,
    @CampusScope() scope: CampusScopeResult,
  ) {
    if (!dto.campusId && scope.targetCampusId) {
      dto.campusId = scope.targetCampusId;
    }
    return this.educationalService.createSchedule(dto);
  }

  @Put('schedules/:id')
  @RequirePermissions('educational:schedule:add')
  async updateSchedule(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.educationalService.updateSchedule(id, body);
  }

  @Delete('schedules/:id')
  @RequirePermissions('educational:schedule:delete')
  async deleteSchedule(@Param('id') id: string) {
    return this.educationalService.deleteSchedule(id);
  }

  // ----------------------------------------------------------------
  // 4. 点名消课与反结课冲正
  // ----------------------------------------------------------------

  @Get('schedules/:id/roll-call-students')
  @RequirePermissions('educational:workbench')
  async getRollCallStudents(@Param('id') scheduleId: string) {
    return this.educationalService.getRollCallStudents(scheduleId);
  }

  @Post('attendances/roll-call')
  @RequirePermissions('educational:workbench:attend')
  async rollCall(
    @Body() dto: RollCallDto,
    @CurrentUser() user: any,
  ) {
    const operator = user?.realName || '系统考勤员';
    return this.educationalService.rollCall(dto, operator);
  }

  @Post('schedules/:id/reverse')
  @RequirePermissions('educational:attendance:reverse')
  async reverseScheduleAttendance(
    @Param('id') scheduleId: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    const operator = user?.realName || '教务主管';
    return this.educationalService.reverseScheduleAttendance(scheduleId, operator, reason);
  }

  @Get('settlement/workbench')
  @RequirePermissions('educational:workbench')
  async getWorkbenchSnapshot(
    @Query('date') date?: string,
    @Query('classId') classId?: string,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CampusScope() scope?: CampusScopeResult,
    @CurrentUser() user?: any,
  ) {
    const isSelf = user?.dataScope === 'self';
    const teacherId = isSelf ? (user?.teacherId || user?.id) : undefined;
    return this.educationalService.getWorkbenchSnapshot({
      campusId: scope?.targetCampusId,
      date,
      teacherId,
      classId,
      period,
      startDate,
      endDate,
    });
  }

  @Get('attendances')
  @RequirePermissions('educational:attendance')
  async getAttendanceRecords(
    @Query('classId') classId?: string,
    @Query('scheduleEventId') scheduleEventId?: string,
    @Query('studentId') studentId?: string,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.educationalService.getAttendanceRecords({
      classId,
      scheduleEventId,
      studentId,
      campusId: scope?.targetCampusId,
    });
  }

  // ----------------------------------------------------------------
  // 5. 学员 360° 学情成长档案画像投影
  // ----------------------------------------------------------------

  @Get('students/:id/learning-portfolio')
  @RequirePermissions('student:allStudent')
  async getStudentLearningPortfolio(
    @Param('id') studentId: string,
    @Query('subject') subject?: string,
  ) {
    return this.growthProjector.projectLearningPortfolio(studentId, { subject });
  }

  // ----------------------------------------------------------------
  // 6. 随堂课评闭环与家长通知流水线 (LessonEvaluationCoordinator)
  // ----------------------------------------------------------------

  @Get('lesson-evaluations/workbench/:scheduleEventId')
  @RequirePermissions('educational:workbench')
  async getEvaluationWorkbench(
    @Param('scheduleEventId') scheduleEventId: string,
    @CampusScope() scope: CampusScopeResult,
    @CurrentUser() user: any,
  ) {
    return this.evaluationCoordinator.hydrateEvaluation(
      {
        scheduleEventId,
        teacherId: user?.teacherId || user?.id,
        campusId: scope?.targetCampusId,
      },
      {
        targetCampusId: scope?.targetCampusId,
        operatorId: user?.id || 'sys_user',
        operatorName: user?.realName || user?.account || '任课教师',
        isSuperAdmin: scope?.canAccessAll,
      },
    );
  }

  @Post('lesson-evaluations/commit')
  @RequirePermissions('educational:workbench:attend')
  async commitEvaluation(
    @Body() command: CommitEvaluationCommand,
    @CampusScope() scope: CampusScopeResult,
    @CurrentUser() user: any,
  ) {
    return this.evaluationCoordinator.commitEvaluation(
      {
        ...command,
        campusId: command.campusId || scope?.targetCampusId,
        operatorId: user?.id || command.operatorId || 'sys_user',
        operatorName: user?.realName || user?.account || command.operatorName || '任课教师',
      },
      {
        targetCampusId: scope?.targetCampusId,
        operatorId: user?.id || 'sys_user',
        operatorName: user?.realName || user?.account || '任课教师',
        isSuperAdmin: scope?.canAccessAll,
      },
    );
  }

  @Get('lesson-evaluations/:scheduleEventId')
  @RequirePermissions('educational:workbench')
  async getEvaluationDetail(
    @Param('scheduleEventId') scheduleEventId: string,
    @CampusScope() scope: CampusScopeResult,
    @CurrentUser() user: any,
  ) {
    return this.evaluationCoordinator.hydrateEvaluation(
      {
        scheduleEventId,
        teacherId: user?.teacherId || user?.id,
        campusId: scope?.targetCampusId,
      },
      {
        targetCampusId: scope?.targetCampusId,
        operatorId: user?.id || 'sys_user',
        operatorName: user?.realName || user?.account || '任课教师',
        isSuperAdmin: scope?.canAccessAll,
      },
    );
  }

  // ----------------------------------------------------------------
  // 7. 统一结课履约与级联反结课冲正 (LessonFulfillmentCoordinator)
  // ----------------------------------------------------------------

  @Get('fulfillment/workbench/:scheduleEventId')
  @RequirePermissions('educational:workbench')
  async getFulfillmentWorkbench(
    @Param('scheduleEventId') scheduleEventId: string,
    @CampusScope() scope: CampusScopeResult,
    @CurrentUser() user: any,
  ) {
    return this.fulfillmentCoordinator.prepareFulfillmentWorkbench(
      {
        scheduleEventId,
        teacherId: user?.teacherId || user?.id,
        campusId: scope?.targetCampusId,
      },
      {
        targetCampusId: scope?.targetCampusId,
        operatorId: user?.id || 'sys_user',
        operatorName: user?.realName || user?.account || '任课教师',
        isSuperAdmin: scope?.canAccessAll,
      },
    );
  }

  @Post('fulfillment/fulfill')
  @RequirePermissions('educational:workbench:attend')
  async fulfillLesson(
    @Body() command: FulfillLessonCommand,
    @CampusScope() scope: CampusScopeResult,
    @CurrentUser() user: any,
  ) {
    return this.fulfillmentCoordinator.fulfillLesson(
      {
        ...command,
        campusId: command.campusId || scope?.targetCampusId,
        operatorId: user?.id || command.operatorId || 'sys_user',
        operatorName: user?.realName || user?.account || command.operatorName || '任课教师',
      },
      {
        targetCampusId: scope?.targetCampusId,
        operatorId: user?.id || 'sys_user',
        operatorName: user?.realName || user?.account || '任课教师',
        isSuperAdmin: scope?.canAccessAll,
      },
    );
  }

  @Post('fulfillment/reverse')
  @RequirePermissions('educational:attendance:reverse')
  async reverseFulfillment(
    @Body() command: ReverseFulfillmentCommand,
    @CampusScope() scope: CampusScopeResult,
    @CurrentUser() user: any,
  ) {
    return this.fulfillmentCoordinator.reverseFulfillment(
      {
        ...command,
        campusId: command.campusId || scope?.targetCampusId,
        operatorId: user?.id || command.operatorId || 'sys_user',
        operatorName: user?.realName || user?.account || command.operatorName || '教务主管',
      },
      {
        targetCampusId: scope?.targetCampusId,
        operatorId: user?.id || 'sys_user',
        operatorName: user?.realName || user?.account || '教务主管',
        isSuperAdmin: scope?.canAccessAll,
      },
    );
  }

  // ----------------------------------------------------------------
  // 12. 学情成长投影深模块双重视角端点 (Learning Growth Projector)
  // ----------------------------------------------------------------

  /**
   * 视角 A：校区管理后台 360° 学员全景成长档案抽屉
   */
  @Get('students/:id/admin-dossier')
  @RequirePermissions('student:allStudent')
  async getAdminDossier(
    @Param('id') studentId: string,
    @CampusScope() scope: CampusScopeResult,
    @Query('courseId') courseId?: string,
    @Query('includeReversed') includeReversed?: string,
    @Query('limit') limit?: string,
  ) {
    return this.growthProjector.projectAdminDossier(
      {
        studentId,
        courseId,
        includeReversed: includeReversed === 'true',
        limit: limit ? Number(limit) : 50,
      },
      {
        targetCampusId: scope?.targetCampusId,
        isSuperAdmin: scope?.canAccessAll,
      },
    );
  }

  /**
   * 视角 B1：微信公众号家长端移动 H5 全景成长脚印瀑布流 (免密，签名令牌鉴权)
   */
  @Public()
  @Get('public/growth/feed')
  async getParentGrowthFeed(
    @Query('token') token: string,
    @Query('limit') limit?: string,
  ) {
    if (!token) {
      throw new BadRequestException('缺失安全访问凭证 token');
    }
    return this.growthProjector.projectParentFeed(
      { limit: limit ? Number(limit) : 20 },
      token,
    );
  }

  /**
   * 视角 B2：微信公众号模板消息直达单课课评报告落地页 (免密，签名令牌鉴权)
   */
  @Public()
  @Get('public/growth/lesson')
  async getParentSingleLessonReport(
    @Query('token') token: string,
    @Query('scheduleEventId') scheduleEventId: string,
  ) {
    if (!token) {
      throw new BadRequestException('缺失安全访问凭证 token');
    }
    if (!scheduleEventId) {
      throw new BadRequestException('缺失排课日程 ID (scheduleEventId)');
    }
    return this.growthProjector.projectParentSingleLesson(
      { scheduleEventId },
      token,
    );
  }

  /**
   * 签发免密安全访问令牌 (供后台教务一键复制分享链接或模板消息注入)
   */
  @Post('students/:id/growth-token')
  @RequirePermissions('student:allStudent')
  async issueGrowthToken(
    @Param('id') studentId: string,
    @Body() body: { scheduleEventId?: string; ttlSeconds?: number },
    @CampusScope() scope: CampusScopeResult,
  ) {
    return this.growthProjector.issueParentAccessToken(
      {
        studentId,
        scheduleEventId: body?.scheduleEventId,
        ttlSeconds: body?.ttlSeconds,
      },
      {
        targetCampusId: scope?.targetCampusId,
        isSuperAdmin: scope?.canAccessAll,
      },
    );
  }
}


