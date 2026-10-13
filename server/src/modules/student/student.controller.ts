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
import { RechargeWalletDto, WithdrawWalletDto } from './dto/wallet.dto';
import { CurrentCampus } from '../../common/decorators/current-campus.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('api/students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

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

  @Post([':id/movement', ':id/movements'])
  @RequirePermissions('student:movement')
  async executeMovement(
    @Param('id') studentId: string,
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: any,
  ) {
    return this.studentService.executeMovement(studentId, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('student:edit')
  async deleteStudent(@Param('id') id: string) {
    return this.studentService.deleteStudent(id);
  }
}
