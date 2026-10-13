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

@Controller('api/students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
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
  async getStudentById(@Param('id') id: string) {
    return this.studentService.getStudentById(id);
  }

  @Put(':id')
  async updateStudent(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentService.updateStudent(id, dto);
  }

  @Get(':id/profile')
  async getStudentProfile(@Param('id') id: string) {
    return this.studentService.getStudentProfile(id);
  }

  @Post('enroll')
  async enrollStudent(
    @Body() dto: EnrollStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.studentService.enrollStudent(dto, user);
  }

  @Post(':id/wallet/recharge')
  async rechargeWallet(
    @Param('id') studentId: string,
    @Body() dto: RechargeWalletDto,
    @CurrentUser() user: any,
  ) {
    return this.studentService.rechargeWallet(studentId, dto, user);
  }

  @Post(':id/wallet/withdraw')
  async withdrawWallet(
    @Param('id') studentId: string,
    @Body() dto: WithdrawWalletDto,
    @CurrentUser() user: any,
  ) {
    return this.studentService.withdrawWallet(studentId, dto, user);
  }

  @Post([':id/movement', ':id/movements'])
  async executeMovement(
    @Param('id') studentId: string,
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: any,
  ) {
    return this.studentService.executeMovement(studentId, dto, user);
  }

  @Delete(':id')
  async deleteStudent(@Param('id') id: string) {
    return this.studentService.deleteStudent(id);
  }
}
