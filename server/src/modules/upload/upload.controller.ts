import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
  Headers,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MediaUploadCoordinator } from './domain/media-upload.coordinator';

/**
 * 统一多媒体上传控制器 (UploadController)
 * 提供随堂实况照片批量上传端点 POST /api/upload/photos
 */
@Controller('api/upload')
export class UploadController {
  constructor(private readonly coordinator: MediaUploadCoordinator) {}

  @Post('photos')
  @UseInterceptors(
    FilesInterceptor('files', 9, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 9,
      },
    })
  )
  async uploadClassroomPhotos(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
    @CurrentUser() user: any,
    @Body('scheduleEventId') scheduleEventId?: string,
    @Body('campusId') bodyCampusId?: string,
    @Headers('x-campus-id') headerCampusId?: string
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少选择一张随堂照片上传');
    }

    const campusId = this.resolveCampusId(user, bodyCampusId, headerCampusId);
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3001';
    const baseUrl = `${protocol}://${host}`;

    const result = await this.coordinator.uploadClassroomPhotos({
      files,
      campusId,
      scheduleEventId,
      baseUrl,
    });

    return result;
  }

  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    })
  )
  async uploadClassroomVideo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @CurrentUser() user: any,
    @Body('scheduleEventId') scheduleEventId?: string,
    @Body('campusId') bodyCampusId?: string,
    @Headers('x-campus-id') headerCampusId?: string
  ) {
    if (!file) {
      throw new BadRequestException('请选择课堂视频文件上传');
    }

    const campusId = this.resolveCampusId(user, bodyCampusId, headerCampusId);
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3001';
    const baseUrl = `${protocol}://${host}`;

    const result = await this.coordinator.uploadClassroomVideo({
      file,
      campusId,
      scheduleEventId,
      baseUrl,
    });

    return result;
  }

  /**
   * 上传归属校区以登录凭据为准：仅全集团数据权限的账号可指定其他校区
   */
  private resolveCampusId(user: any, bodyCampusId?: string, headerCampusId?: string): string {
    const requested = bodyCampusId || headerCampusId;
    const canAccessAll =
      user?.dataScope === 'all' ||
      user?.permissions?.includes('*') ||
      user?.permissions?.includes('admin:all');
    if (requested && requested !== 'all' && canAccessAll) return requested;
    if (!user?.campusId) {
      throw new ForbiddenException('当前账号未归属校区，无法上传媒体');
    }
    return user.campusId;
  }
}
