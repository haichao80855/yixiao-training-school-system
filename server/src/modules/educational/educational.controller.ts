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
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';

@Controller('api/educational')
export class EducationalController {
  constructor(private readonly educationalService: EducationalService) {}

  // ----------------------------------------------------------------
  // 1. 教室管理
  // ----------------------------------------------------------------

  @Get('classrooms')
  async getClassrooms(@CampusScope() scope: CampusScopeResult) {
    return this.educationalService.getClassrooms(scope.targetCampusId);
  }

  @Post('classrooms')
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
  async getClassById(@Param('id') id: string) {
    return this.educationalService.getClassById(id);
  }

  @Post('classes')
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
  async updateClass(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.educationalService.updateClass(id, dto);
  }

  @Delete('classes/:id')
  async deleteClass(@Param('id') id: string) {
    return this.educationalService.deleteClass(id);
  }

  @Post('classes/:id/students')
  async assignStudentToClass(
    @Param('id') classId: string,
    @Body('studentId') studentId: string,
  ) {
    return this.educationalService.bindStudentToClass(classId, studentId);
  }

  // ----------------------------------------------------------------
  // 3. 排课与日程管理
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
  async updateSchedule(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.educationalService.updateSchedule(id, body);
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

  @Get('attendances')
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
}
