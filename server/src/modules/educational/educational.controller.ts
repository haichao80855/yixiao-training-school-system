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
import { EducationalService } from './educational.service';
import { CreateClassroomDto, UpdateClassroomDto } from './dto/classroom.dto';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateScheduleDto, CheckCollisionDto } from './dto/schedule.dto';
import { RollCallDto } from './dto/attendance.dto';
import { CurrentCampus } from '../../common/decorators/current-campus.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/educational')
export class EducationalController {
  constructor(private readonly educationalService: EducationalService) {}

  // ----------------------------------------------------------------
  // 1. 教室管理
  // ----------------------------------------------------------------

  @Get('classrooms')
  async getClassrooms(
    @Query('campusId') campusId?: string,
    @CurrentCampus() headerCampusId?: string,
    @CurrentUser() user?: any,
  ) {
    const isSuperAdmin =
      user?.dataScope === 'all' ||
      user?.roles?.some((r: any) => r.code === 'super_admin' || r.code === 'admin' || r.dataScope === 'all' || r === 'super_admin') ||
      user?.permissions?.includes('*') ||
      user?.permissions?.includes('admin:all');

    const targetCampusId = campusId && campusId !== 'all' ? campusId : (isSuperAdmin ? undefined : headerCampusId);
    return this.educationalService.getClassrooms(targetCampusId);
  }

  @Post('classrooms')
  async createClassroom(
    @Body() dto: CreateClassroomDto,
    @CurrentCampus() headerCampusId?: string,
  ) {
    if (!dto.campusId && headerCampusId) {
      dto.campusId = headerCampusId;
    }
    return this.educationalService.createClassroom(dto);
  }

  @Put('classrooms/:id')
  async updateClassroom(
    @Param('id') id: string,
    @Body() dto: UpdateClassroomDto,
  ) {
    return this.educationalService.updateClassroom(id, dto);
  }

  @Delete('classrooms/:id')
  async deleteClassroom(@Param('id') id: string) {
    return this.educationalService.deleteClassroom(id);
  }

  // ----------------------------------------------------------------
  // 2. 班级管理
  // ----------------------------------------------------------------

  @Get('classes')
  async getClasses(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('courseId') courseId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('campusId') campusId?: string,
    @CurrentCampus() headerCampusId?: string,
    @CurrentUser() user?: any,
  ) {
    const isSuperAdmin =
      user?.dataScope === 'all' ||
      user?.roles?.some((r: any) => r.code === 'super_admin' || r.code === 'admin' || r.dataScope === 'all' || r === 'super_admin') ||
      user?.permissions?.includes('*') ||
      user?.permissions?.includes('admin:all');

    const targetCampusId = campusId && campusId !== 'all' ? campusId : (isSuperAdmin ? undefined : headerCampusId);

    return this.educationalService.getClasses({
      page,
      pageSize,
      keyword,
      courseId,
      teacherId,
      campusId: targetCampusId,
    });
  }

  @Get('classes/:id')
  async getClassById(@Param('id') id: string) {
    return this.educationalService.getClassById(id);
  }

  @Post('classes')
  async createClass(
    @Body() dto: CreateClassDto,
    @CurrentCampus() headerCampusId?: string,
  ) {
    if (!dto.campusId && headerCampusId) {
      dto.campusId = headerCampusId;
    }
    return this.educationalService.createClass(dto);
  }

  @Put('classes/:id')
  async updateClass(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.educationalService.updateClass(id, dto);
  }

  @Post('classes/:id/students')
  async bindStudentToClass(
    @Param('id') classId: string,
    @Body('studentId') studentId: string,
  ) {
    return this.educationalService.bindStudentToClass(classId, studentId);
  }

  // ----------------------------------------------------------------
  // 3. 排课矩阵与碰撞检测
  // ----------------------------------------------------------------

  @Post('schedules/check-collision')
  async checkCollision(@Body() dto: CheckCollisionDto) {
    return this.educationalService.checkCollision(dto);
  }

  @Get('schedules')
  async getSchedules(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('date') date?: string,
    @Query('teacherId') teacherId?: string,
    @Query('classroomId') classroomId?: string,
    @Query('classId') classId?: string,
    @Query('campusId') campusId?: string,
    @CurrentCampus() headerCampusId?: string,
    @CurrentUser() user?: any,
  ) {
    const isSuperAdmin =
      user?.dataScope === 'all' ||
      user?.roles?.some((r: any) => r.code === 'super_admin' || r.code === 'admin' || r.dataScope === 'all' || r === 'super_admin') ||
      user?.permissions?.includes('*') ||
      user?.permissions?.includes('admin:all');

    const targetCampusId = campusId && campusId !== 'all' ? campusId : (isSuperAdmin ? undefined : headerCampusId);

    return this.educationalService.getSchedules({
      startDate,
      endDate,
      date,
      teacherId,
      classroomId,
      classId,
      campusId: targetCampusId,
    });
  }

  @Post('schedules')
  async createSchedule(
    @Body() dto: CreateScheduleDto,
    @CurrentCampus() headerCampusId?: string,
  ) {
    if (!dto.campusId && headerCampusId) {
      dto.campusId = headerCampusId;
    }
    return this.educationalService.createSchedule(dto);
  }

  @Delete('schedules/:id')
  async deleteSchedule(@Param('id') id: string) {
    return this.educationalService.deleteSchedule(id);
  }

  // ----------------------------------------------------------------
  // 4. 点名消课与反结课冲正
  // ----------------------------------------------------------------

  @Get('schedules/:id/roll-call-students')
  async getRollCallStudents(@Param('id') scheduleId: string) {
    return this.educationalService.getRollCallStudents(scheduleId);
  }

  @Post('attendances/roll-call')
  async rollCall(
    @Body() dto: RollCallDto,
    @CurrentUser() user: any,
  ) {
    const operator = user?.realName || '系统考勤员';
    return this.educationalService.rollCall(dto, operator);
  }

  @Post('schedules/:id/reverse')
  async reverseScheduleAttendance(
    @Param('id') scheduleId: string,
    @CurrentUser() user: any,
  ) {
    const operator = user?.realName || '教务主管';
    return this.educationalService.reverseScheduleAttendance(scheduleId, operator);
  }
}
