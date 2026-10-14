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
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('api/curriculum')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @Get('courses')
  @RequirePermissions('curriculum:courseManage')
  async getCourses(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('subject') subject?: string,
    @Query('grade') grade?: string,
    @Query('attribute') attribute?: string,
    @Query('status') status?: string,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.curriculumService.getCourses({
      page,
      pageSize,
      keyword,
      subject,
      grade,
      attribute,
      status,
      campusId: scope?.targetCampusId,
    });
  }

  @Get('courses/:id')
  @RequirePermissions('curriculum:courseManage')
  async getCourseById(@Param('id') id: string) {
    return this.curriculumService.getCourseById(id);
  }

  @Post('courses')
  @RequirePermissions('curriculum:course:add')
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.curriculumService.createCourse(dto);
  }

  @Put('courses/:id')
  @RequirePermissions('curriculum:course:edit')
  async updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.curriculumService.updateCourse(id, dto);
  }

  @Patch('courses/:id/status')
  @RequirePermissions('curriculum:course:status')
  async updateCourseStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCourseStatusDto,
  ) {
    return this.curriculumService.updateCourseStatus(id, dto);
  }

  @Post('courses/:id/campus-auth')
  @RequirePermissions('curriculum:course:auth')
  async authorizeCampuses(
    @Param('id') id: string,
    @Body() dto: AuthorizeCampusesDto,
  ) {
    return this.curriculumService.authorizeCampuses(id, dto);
  }

  @Get('courses/:id/units')
  @RequirePermissions('curriculum:lessonPlan')
  async getCourseUnits(@Param('id') courseId: string) {
    return this.curriculumService.getCourseUnits(courseId);
  }

  @Post('courses/:id/units')
  @RequirePermissions('curriculum:lessonPlan:add')
  async createUnit(
    @Param('id') courseId: string,
    @Body() dto: CreateCourseUnitDto,
  ) {
    return this.curriculumService.createUnit(courseId, dto);
  }

  @Delete('units/:unitId')
  @RequirePermissions('curriculum:lessonPlan:add')
  async deleteUnit(@Param('unitId') unitId: string) {
    return this.curriculumService.deleteUnit(unitId);
  }

  @Delete('lessons/:lessonId')
  @RequirePermissions('curriculum:lessonPlan:add')
  async deleteLesson(@Param('lessonId') lessonId: string) {
    return this.curriculumService.deleteLesson(lessonId);
  }

  @Get('delivery-catalog/:campusId')
  @RequirePermissions('curriculum:courseManage')
  async getDeliverableCatalog(@Param('campusId') campusId: string) {
    return this.curriculumService.getDeliverableCatalog(campusId);
  }
}
