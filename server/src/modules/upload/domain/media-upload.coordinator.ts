import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { StorageEnginePort } from './ports/storage-engine.port';

export interface UploadClassroomPhotosCommand {
  files: Express.Multer.File[];
  campusId: string;
  scheduleEventId?: string;
  baseUrl?: string;
}

export interface PhotoItemDto {
  /** 与存储介质无关的 key (推荐持久化该字段) */
  key: string;
  originalUrl: string;
  thumbnailUrl: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
}

export interface ClassroomPhotoBatchResult {
  successCount: number;
  failureCount: number;
  persistedUrls: string[];
  items: PhotoItemDto[];
  errors: Array<{ filename: string; reason: string }>;
}

export interface DetectedFormat {
  ext: string;
  mime: string;
}

export interface UploadClassroomVideoCommand {
  file: Express.Multer.File;
  campusId: string;
  scheduleEventId?: string;
  baseUrl?: string;
}


export interface VideoUploadResult {
  /** 与存储介质无关的 key (推荐持久化该字段) */
  videoKey: string;
  videoUrl: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB 硬上限
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB 硬上限

/**
 * 教学媒体上传与现场照片流转协调器 (MediaUploadCoordinator)
 * 遵循 codebase-design 高内聚深模块设计原则
 * 封装二进制魔数真实类型嗅探、SHA-256去重秒传、课次归档自愈路径与批处理容错流水线
 */
@Injectable()
export class MediaUploadCoordinator {
  constructor(private readonly storageEngine: StorageEnginePort) {}

  /**
   * 批处理上传随堂现场照片 (1~9 张)
   * 采用 Promise.allSettled 容错流水线，单张损坏或超标不阻断整批正常上传
   */
  async uploadClassroomPhotos(command: UploadClassroomPhotosCommand): Promise<ClassroomPhotoBatchResult> {
    const { files, campusId, scheduleEventId, baseUrl } = command;

    if (!files || files.length === 0) {
      throw new BadRequestException('请至少选择一张随堂照片上传');
    }

    if (files.length > 9) {
      throw new BadRequestException('单次批量上传随堂照片最多允许 9 张');
    }

    const cleanCampusId = campusId && campusId.trim() ? campusId.trim() : 'campus-bj-hq';
    const cleanScheduleId = scheduleEventId && scheduleEventId.trim() ? scheduleEventId.trim() : 'common';
    const dateStr = this.formatDate(new Date());

    const results = await Promise.allSettled(
      files.map(async (file) => this.processSinglePhoto(file, cleanCampusId, cleanScheduleId, dateStr, baseUrl))
    );

    const items: PhotoItemDto[] = [];
    const errors: Array<{ filename: string; reason: string }> = [];

    results.forEach((res, idx) => {
      const originalName = files[idx]?.originalname || `photo_${idx + 1}`;
      if (res.status === 'fulfilled') {
        items.push(res.value);
      } else {
        errors.push({
          filename: originalName,
          reason: res.reason?.message || '文件校验或持久化异常',
        });
      }
    });

    const persistedUrls = items.map((i) => i.originalUrl);

    return {
      successCount: items.length,
      failureCount: errors.length,
      persistedUrls,
      items,
      errors,
    };
  }

  /**
   * 单张照片深度安全处理与内容寻址持久化
   */
  private async processSinglePhoto(
    file: Express.Multer.File,
    campusId: string,
    scheduleEventId: string,
    dateStr: string,
    baseUrl?: string
  ): Promise<PhotoItemDto> {
    const filename = file.originalname || 'photo.jpg';

    // 1. 体积门禁校验 (<=10MB)
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(`文件 [${filename}] 内容为空`);
    }

    if (file.buffer.length > MAX_PHOTO_BYTES) {
      const sizeMb = (file.buffer.length / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(`文件 [${filename}] 体积为 ${sizeMb}MB，超出系统 10MB 上限`);
    }

    // 2. 二进制魔数真实嗅探（彻底阻断脚本伪装攻击）
    const detected = this.sniffImageFormat(file.buffer);
    if (!detected) {
      throw new BadRequestException(`文件 [${filename}] 格式非法，仅支持真实 JPG、PNG、WEBP 或 GIF 图像`);
    }

    // 3. 计算 SHA-256 内容寻址不可变指纹
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const safeBaseName = `${hash.substring(0, 20)}.${detected.ext}`;

    // 4. 课次自愈目录归集规范
    const relativePath = `photos/${campusId}/${scheduleEventId}/${dateStr}/${safeBaseName}`;

    // 5. 秒传去重判断：若同校区同课次已存在该指纹图片，直接复用返回
    const exists = await this.storageEngine.exists(relativePath);
    let resolvedUrl: string;

    if (exists) {
      resolvedUrl = this.storageEngine.resolveUrl(relativePath, baseUrl);
    } else {
      const persistRes = await this.storageEngine.write(relativePath, file.buffer, baseUrl);
      resolvedUrl = persistRes.url;
    }

    // 6. 300x300 九宫格方形缩略图解析
    const thumbnailUrl = this.buildThumbnailUrl(resolvedUrl);

    return {
      key: relativePath,
      originalUrl: resolvedUrl,
      thumbnailUrl,
      filename,
      sizeBytes: file.buffer.length,
      mimeType: detected.mime,
      sha256: hash,
    };
  }


  /**
   * 级联反结课冲正：注销该课次下的随堂照片资产
   */
  async purgeSchedulePhotos(scheduleEventId: string, campusId: string): Promise<{ deletedCount: number }> {
    const cleanCampusId = campusId && campusId.trim() ? campusId.trim() : 'campus-bj-hq';
    const cleanScheduleId = scheduleEventId && scheduleEventId.trim() ? scheduleEventId.trim() : 'common';
    const prefix = `photos/${cleanCampusId}/${cleanScheduleId}`;
    const deletedCount = await this.storageEngine.deleteByPrefix(prefix);
    return { deletedCount };
  }

  /**
   * 基于二进制 Header 嗅探真实图像格式 (Magic Number)
   */
  sniffImageFormat(buffer: Buffer): DetectedFormat | null {
    if (!buffer || buffer.length < 8) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { ext: 'png', mime: 'image/png' };
    }

    // GIF: 47 49 46 38 ('GIF8')
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return { ext: 'gif', mime: 'image/gif' };
    }

    // WEBP: 52 49 46 46 (RIFF) .... 57 45 42 50 (WEBP)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { ext: 'webp', mime: 'image/webp' };
    }

    return null;
  }

  /**
   * 上传随堂课堂实操视频 (至多 100MB)
   * 采用二进制 Magic Number 格式真伪嗅探、100MB 上限安全门禁与 SHA-256 秒传去重
   */
  async uploadClassroomVideo(command: UploadClassroomVideoCommand): Promise<VideoUploadResult> {
    const { file, campusId, scheduleEventId, baseUrl } = command;

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('请选择有效的视频文件上传');
    }

    const filename = file.originalname || 'classroom_video.mp4';

    // 1. 100MB 门禁校验
    if (file.buffer.length > MAX_VIDEO_BYTES) {
      const sizeMb = (file.buffer.length / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(`您上传的视频文件大小为 ${sizeMb}MB，超出系统 100MB 上限`);
    }

    // 2. 二进制魔数真实格式嗅探 (深度兼容 iPhone MOV, 微信视频与各主流编码)
    const detected = this.sniffVideoFormat(file.buffer, file);
    if (!detected) {
      throw new BadRequestException(`文件 [${filename}] 格式非法，仅支持真实 MP4、WebM、MOV 或主流常用视频`);
    }

    // 3. 计算 SHA-256 不可变指纹
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const safeBaseName = `${hash.substring(0, 20)}.${detected.ext}`;

    const cleanCampusId = campusId && campusId.trim() ? campusId.trim() : 'campus-bj-hq';
    const cleanScheduleId = scheduleEventId && scheduleEventId.trim() ? scheduleEventId.trim() : 'common';
    const dateStr = this.formatDate(new Date());

    // 4. 课次自愈目录归集规范
    const relativePath = `videos/${cleanCampusId}/${cleanScheduleId}/${dateStr}/${safeBaseName}`;

    // 5. 秒传去重判断
    const exists = await this.storageEngine.exists(relativePath);
    let resolvedUrl: string;

    if (exists) {
      resolvedUrl = this.storageEngine.resolveUrl(relativePath, baseUrl);
    } else {
      const persistRes = await this.storageEngine.write(relativePath, file.buffer, baseUrl);
      resolvedUrl = persistRes.url;
    }

    return {
      videoKey: relativePath,
      videoUrl: resolvedUrl,
      filename,
      sizeBytes: file.buffer.length,
      mimeType: detected.mime,
      sha256: hash,
    };
  }


  /**
   * 基于二进制 Header 嗅探真实视频格式 (Magic Number)
   * 支持前 256 字节广域扫描、苹果 QuickTime wide atom 容错与 MimeType/扩展名深度兜底
   */
  sniffVideoFormat(buffer: Buffer, file?: Express.Multer.File): DetectedFormat | null {
    if (!buffer || buffer.length < 8) return null;

    // 1. WebM / Matroska: 1A 45 DF A3
    if (buffer.length >= 12 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return { ext: 'webm', mime: 'video/webm' };
    }

    // 2. AVI: RIFF....AVI 
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'AVI ') {
      return { ext: 'avi', mime: 'video/x-msvideo' };
    }

    // 3. MP4 / MOV 广域扫描：在前 256 字节内扫描标准 ISO Box 标识 (ftyp, moov, mdat, wide)
    const scanLimit = Math.min(buffer.length, 256);
    const headerStr = buffer.subarray(0, scanLimit).toString('binary');
    if (headerStr.includes('ftyp') || headerStr.includes('moov') || headerStr.includes('mdat') || headerStr.includes('wide')) {
      if (headerStr.includes('qt  ')) {
        return { ext: 'mov', mime: 'video/quicktime' };
      }
      return { ext: 'mp4', mime: 'video/mp4' };
    }

    // 4. MimeType 或 文件扩展名智能兜底 (容错微信小程序临时录制容器)
    if (file) {
      const mime = (file.mimetype || '').toLowerCase();
      if (mime.includes('mp4') || mime.includes('quicktime') || mime.includes('webm') || mime.includes('video')) {
        return { ext: mime.includes('quicktime') ? 'mov' : 'mp4', mime: mime || 'video/mp4' };
      }
      const filename = (file.originalname || '').toLowerCase();
      if (/\.(mp4|mov|webm|3gp|m4v|avi)$/i.test(filename)) {
        const ext = filename.split('.').pop() || 'mp4';
        return { ext, mime: ext === 'mov' ? 'video/quicktime' : 'video/mp4' };
      }
    }

    return null;
  }


  /**
   * 格式化 300x300 九宫格预览 URL
   */
  private buildThumbnailUrl(originalUrl: string): string {
    if (!originalUrl) return '';
    // 若原图支持参数化裁剪或 CDN 缩放
    const sep = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${sep}w=300&h=300&fit=crop`;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
}
