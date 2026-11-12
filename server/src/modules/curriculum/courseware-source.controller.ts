import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CoursewareSourceService } from './courseware-source.service';
import { ResolveCoursewareDto, UpdateCoursewareSourceModeDto } from './dto/courseware-source.dto';

/**
 * 课件来源：平时用盛通 / 百家云原链接，原平台不可用时改用自有 OSS 备份。
 * resolve 只要求登录 (与平台课程库页面一致)；查看状态与切换需要系统设置权限。
 */
@Controller('api/curriculum/courseware')
export class CoursewareSourceController {
  constructor(private readonly source: CoursewareSourceService) {}

  @Post('resolve')
  @HttpCode(200)
  resolve(@Body() dto: ResolveCoursewareDto) {
    return this.source.resolve(dto);
  }

  @Get('source')
  @RequirePermissions('system:view')
  status() {
    return this.source.status();
  }

  @Put('source')
  @RequirePermissions('system:company:edit')
  async setMode(@Body() dto: UpdateCoursewareSourceModeDto, @CurrentUser() user?: { id?: string }) {
    await this.source.setMode(dto.mode, user?.id);
    return this.source.status();
  }

  @Post('source/probe')
  @HttpCode(200)
  @RequirePermissions('system:company:edit')
  async probe() {
    await this.source.probeNow();
    return this.source.status();
  }
}
