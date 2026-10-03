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
import { CurrentCampus } from '../../common/decorators/current-campus.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  async getStudents(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('campusId') campusId?: string,
    @Query('warningLevel') warningLevel?: string,
    @CurrentCampus() headerCampusId?: string,
    @CurrentUser() user?: any,
  ) {
    const isSuperAdmin =
      user?.dataScope === 'all' ||
      user?.roles?.some(
        (r: any) =>
          r.code === 'super_admin' ||
          r.code === 'admin' ||
          r.dataScope === 'all' ||
          r === 'super_admin',
      ) ||
      user?.permissions?.includes('*') ||
      user?.permissions?.includes('admin:all');

    let targetCampusId: string | undefined = undefined;
    if (campusId && campusId !== 'all') {
      targetCampusId = campusId;
    } else if (!isSuperAdmin) {
      targetCampusId = headerCampusId || user?.campusId;
    }

    return this.studentService.getStudents({
      page,
      pageSize,
      keyword,
      status,
      campusId: targetCampusId,
      warningLevel,
    });
  }

  @Post()
  async createStudent(
    @Body() dto: CreateStudentDto,
    @CurrentCampus() headerCampusId?: string,
  ) {
    if (!dto.campusId && headerCampusId) {
      dto.campusId = headerCampusId;
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

  @Post(':id/movement')
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
