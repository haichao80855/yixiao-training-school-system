import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { EnrollStudentDto } from './dto/enroll.dto';
import { CreateMovementDto } from './dto/movement.dto';
import { StudentMovementIntentDto } from './dto/student-movement.dto';
import { StudentMovementCoordinator } from './domain/student-movement.coordinator';
import { LessonRenewalCoordinator } from './domain/lesson-renewal.coordinator';
import { RechargeWalletDto, WithdrawWalletDto } from './dto/wallet.dto';
import {
  CreateServiceFeeDto,
  VerifyServiceFeeDto,
  BatchVerifyServiceFeeDto,
  ServiceFeeFilterDto,
} from './dto/service-fee.dto';
import { CurrentCampus } from '../../common/decorators/current-campus.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller(['api/students', 'api/student'])
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly movementCoordinator: StudentMovementCoordinator,
    private readonly renewalCoordinator: LessonRenewalCoordinator,
  ) {}

  @Get()
  @RequirePermissions('student:allStudent')
  async getStudents(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('warningLevel') warningLevel?: string,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.studentService.getStudents({
      page,
      pageSize,
      keyword,
      status,
      campusId: scope?.targetCampusId,
      warningLevel,
    });
  }

  @Post()
  @RequirePermissions('student:add')
  async createStudent(
    @Body() dto: CreateStudentDto,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    if (!dto.campusId && scope?.targetCampusId) {
      dto.campusId = scope.targetCampusId;
    }
    return this.studentService.createStudent(dto);
  }

  // ----------------------------------------------------------------
  // 课消风控与续费决策 (Lesson Renewal Coordinator 接缝)
  // ----------------------------------------------------------------

  @Get('renewal/roster')
  @RequirePermissions('student:allStudent')
  async getCampusRenewalRoster(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('classId') classId?: string,
    @Query('warningLevel') warningLevel?: any,
    @Query('riskLevel') riskLevel?: any,
    @Query('dormantOnly') dormantOnly?: string | boolean,
    @Query('renewalWindowOnly') renewalWindowOnly?: string | boolean,
    @Query('sortBy') sortBy?: any,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.renewalCoordinator.getCampusRenewalRoster(scope?.targetCampusId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      classId,
      warningLevel,
      riskLevel,
      dormantOnly: dormantOnly === 'true' || dormantOnly === true,
      renewalWindowOnly: renewalWindowOnly === 'true' || renewalWindowOnly === true,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id/renewal-risk')
  @RequirePermissions('student:allStudent')
  async getStudentRenewalRisk(@Param('id') id: string) {
    return this.renewalCoordinator.diagnoseStudentRisk(id);
  }

  @Post(':id/renewal-draft')
  @RequirePermissions('student:enroll')
  async createRenewalOrderDraft(
    @Param('id') id: string,
    @Body() body: any = {},
    @CurrentUser() user?: any,
  ) {
    return this.renewalCoordinator.createRenewalOrderDraft(id, {
      ...body,
      packageId: body.packageId,
      customLessons: body.customLessons !== undefined && body.customLessons !== null ? Number(body.customLessons) : undefined,
      recommendedLessons: body.recommendedLessons !== undefined && body.recommendedLessons !== null ? Number(body.recommendedLessons) : undefined,
      operator: {
        operatorId: user?.id || body.operatorId || body.operator?.operatorId,
        operatorName: user?.realName || user?.account || body.operatorName || body.operator?.operatorName || '教务顾问',
      },
    });
  }

  @Get(':id')
  @RequirePermissions('student:allStudent')
  async getStudentById(@Param('id') id: string) {
    return this.studentService.getStudentById(id);
  }

  @Put(':id')
  @RequirePermissions('student:edit')
  async updateStudent(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentService.updateStudent(id, dto);
  }

  @Get(':id/profile')
  @RequirePermissions('student:profile')
  async getStudentProfile(@Param('id') id: string) {
    return this.studentService.getStudentProfile(id);
  }

  @Post('enroll')
  @RequirePermissions('student:enroll')
  async enrollStudent(
    @Body() dto: EnrollStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.studentService.enrollStudent(dto, user);
  }

  @Post(':id/wallet/recharge')
  @RequirePermissions('student:wallet:recharge')
  async rechargeWallet(
    @Param('id') studentId: string,
    @Body() dto: RechargeWalletDto,
    @CurrentUser() user: any,
  ) {
    return this.studentService.rechargeWallet(studentId, dto, user);
  }

  @Post(':id/wallet/withdraw')
  @RequirePermissions('student:wallet:withdraw')
  async withdrawWallet(
    @Param('id') studentId: string,
    @Body() dto: WithdrawWalletDto,
    @CurrentUser() user: any,
  ) {
    return this.studentService.withdrawWallet(studentId, dto, user);
  }

  @Post([':id/movement/preview', ':id/movements/preview'])
  @RequirePermissions('student:movement')
  async previewMovement(
    @Param('id') studentId: string,
    @Body() dto: StudentMovementIntentDto,
  ) {
    const intent = dto instanceof StudentMovementIntentDto && dto.toIntent
      ? dto.toIntent()
      : new StudentMovementIntentDto().toIntent.call(Object.assign(new StudentMovementIntentDto(), dto));
    return this.movementCoordinator.preview(studentId, intent);
  }

  @Post([':id/movement', ':id/movements'])
  @RequirePermissions('student:movement')
  async executeMovement(
    @Param('id') studentId: string,
    @Body() dto: StudentMovementIntentDto,
    @CurrentUser() user: any,
  ) {
    const intent = dto instanceof StudentMovementIntentDto && dto.toIntent
      ? dto.toIntent()
      : new StudentMovementIntentDto().toIntent.call(Object.assign(new StudentMovementIntentDto(), dto));
    const operator = {
      operatorId: user?.id,
      operatorName: user?.realName || user?.account || '教务主管',
    };
    return this.movementCoordinator.execute(studentId, intent, operator);
  }

  @Delete(':id')
  @RequirePermissions('student:edit')
  async deleteStudent(@Param('id') id: string) {
    return this.studentService.deleteStudent(id);
  }

  // ----------------------------------------------------------------
  // 考务代报名与服务费账本
  // ----------------------------------------------------------------

  @Get('service-fees')
  @RequirePermissions('student:serviceFee')
  async getServiceFees(
    @Query() query: ServiceFeeFilterDto,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.studentService.getServiceFees(scope?.targetCampusId, query);
  }

  @Post('service-fees')
  @RequirePermissions('student:serviceFee')
  async createServiceFee(
    @Body() dto: CreateServiceFeeDto,
    @CurrentUser() user?: { realName?: string; account?: string },
  ) {
    return this.studentService.createServiceFee(dto, user);
  }

  @Post('service-fees/verify')
  @RequirePermissions('student:serviceFee')
  async verifyServiceFee(
    @Body() dto: VerifyServiceFeeDto,
    @CurrentUser() user?: { realName?: string; account?: string },
  ) {
    return this.studentService.verifyServiceFee(
      dto.id,
      dto.yikuaibaoVoucherNo,
      dto.operator || user?.realName || user?.account,
    );
  }

  @Post('service-fees/batch-verify')
  @RequirePermissions('student:serviceFee')
  async batchVerifyServiceFees(
    @Body() dto: BatchVerifyServiceFeeDto,
    @CurrentUser() user?: { realName?: string; account?: string },
  ) {
    return this.studentService.batchVerifyServiceFees(dto, user);
  }

  @Delete('service-fees/:id')
  @RequirePermissions('student:serviceFee')
  async deleteServiceFee(@Param('id') id: string) {
    return this.studentService.deleteServiceFee(id);
  }
}
