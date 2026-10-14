import { Injectable } from '@nestjs/common';

export interface MediaCropSpec {
  width: number;
  height: number;
  format?: 'webp' | 'jpg' | 'png';
  quality?: number;
}

/**
 * 多媒体对象存储与 CDN 适配端口 (MediaStoragePort)
 * 遵循 DEEPENING.md Ports & Adapters 规范
 */
export abstract class MediaStoragePort {
  abstract buildThumbnailUrl(originalUrl: string, spec?: MediaCropSpec): string;
  abstract buildVideoPosterUrl(videoUrl: string): string;
}

/**
 * 生产适配器：对接阿里云 OSS / CDN 边缘媒体处理流水线
 * 算力全部下沉到 CDN 边缘，服务端 Node 进程 0 算力开销
 */
@Injectable()
export class AliyunOssMediaAdapter implements MediaStoragePort {
  buildThumbnailUrl(originalUrl: string, spec: MediaCropSpec = { width: 300, height: 300 }): string {
    if (!originalUrl || typeof originalUrl !== 'string' || !originalUrl.startsWith('http')) {
      return originalUrl || '';
    }
    const format = spec.format || 'webp';
    const quality = spec.quality || 85;
    // 若已有处理参数则不再重复拼接
    if (originalUrl.includes('x-oss-process=')) {
      return originalUrl;
    }
    const separator = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${separator}x-oss-process=image/resize,m_fill,w_${spec.width},h_${spec.height}/format,${format}/quality,q_${quality}`;
  }

  buildVideoPosterUrl(videoUrl: string): string {
    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) {
      return '';
    }
    if (videoUrl.includes('x-oss-process=')) {
      return videoUrl;
    }
    const separator = videoUrl.includes('?') ? '&' : '?';
    return `${videoUrl}${separator}x-oss-process=video/snapshot,t_1000,f_jpg,w_800,m_fast`;
  }
}

/**
 * 测试/离线适配器：脱机直通原 URL
 * 保证单元测试 0 外部网络 I/O，毫秒级运行
 */
export class PassthroughMediaAdapter implements MediaStoragePort {
  buildThumbnailUrl(originalUrl: string): string {
    return originalUrl || '';
  }

  buildVideoPosterUrl(videoUrl: string): string {
    return videoUrl ? `${videoUrl}#poster` : 'https://assets.yixiao.com/mock-video-poster.jpg';
  }
}
