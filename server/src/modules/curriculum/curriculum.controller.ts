import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { CurriculumService } from './curriculum.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  UpdateCourseStatusDto,
  AuthorizeCampusesDto,
  CreateCourseUnitDto,
} from './dto/course.dto';
import { CurrentCampus } from '../../common/decorators/current-campus.decorator';

@Controller('api/curriculum')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @Get('courses')
  async getCourses(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('subject') subject?: string,
    @Query('grade') grade?: string,
    @Query('attribute') attribute?: string,
    @Query('status') status?: string,
    @Query('campusId') campusId?: string,
    @CurrentCampus() headerCampusId?: string,
  ) {
    return this.curriculumService.getCourses({
      page,
      pageSize,
      keyword,
      subject,
      grade,
      attribute,
      status,
      campusId: campusId || headerCampusId,
    });
  }

  @Get('courses/:id')
  async getCourseById(@Param('id') id: string) {
    return this.curriculumService.getCourseById(id);
  }

  @Post('courses')
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.curriculumService.createCourse(dto);
  }

  @Put('courses/:id')
  async updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.curriculumService.updateCourse(id, dto);
  }

  @Patch('courses/:id/status')
  async updateCourseStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCourseStatusDto,
  ) {
    return this.curriculumService.updateCourseStatus(id, dto);
  }

  @Post('courses/:id/campus-auth')
  async authorizeCampuses(
    @Param('id') id: string,
    @Body() dto: AuthorizeCampusesDto,
  ) {
    return this.curriculumService.authorizeCampuses(id, dto);
  }

  @Get('courses/:id/units')
  async getCourseUnits(@Param('id') courseId: string) {
    return this.curriculumService.getCourseUnits(courseId);
  }

  @Post('courses/:id/units')
  async createUnit(
    @Param('id') courseId: string,
    @Body() dto: CreateCourseUnitDto,
  ) {
    return this.curriculumService.createUnit(courseId, dto);
  }

  @Delete('units/:unitId')
  async deleteUnit(@Param('unitId') unitId: string) {
    return this.curriculumService.deleteUnit(unitId);
  }

  @Delete('lessons/:lessonId')
  async deleteLesson(@Param('lessonId') lessonId: string) {
    return this.curriculumService.deleteLesson(lessonId);
  }
}
