import { Controller, Get, Query, Req, Res, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from '../../common/decorators/public.decorator';
import { LocalStorageEngineAdapter } from './domain/adapters/local-storage-engine.adapter';
import { verifyMediaSignature } from './domain/media-signer';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

/**
 * 本地磁盘签名媒体路由：GET /api/media/<key>?exp=&sig=
 * 鉴权依据为 URL 签名 (img / video 标签无法携带 Authorization 头)。
 * 迁移 OSS 后家长端拿到的是 OSS 预签名地址，本路由仅服务本地开发与过渡期。
 */
@Controller('api/media')
export class MediaController {
  constructor(private readonly localStorage: LocalStorageEngineAdapter) {}

  @Public()
  @Get('*')
  async serve(
    @Req() req: Request,
    @Res() res: Response,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
  ) {
    const key = decodeURIComponent((req.params as any)[0] || '');
    if (!verifyMediaSignature(key, exp, sig)) {
      throw new ForbiddenException('媒体链接已过期或签名无效');
    }
    const fullPath = this.localStorage.absolutePathFor(key);
    if (!fullPath) throw new NotFoundException('媒体文件不存在');

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(fullPath);
    } catch {
      throw new NotFoundException('媒体文件不存在');
    }
    if (!stat.isFile()) throw new NotFoundException('媒体文件不存在');

    const contentType = CONTENT_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream';
    const expiresIn = Math.max(0, Number(exp) - Math.floor(Date.now() / 1000));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', `private, max-age=${expiresIn}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 视频拖动播放需要 Range 支持
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        return;
      }
      const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        return;
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      fs.createReadStream(fullPath, { start, end }).pipe(res);
      return;
    }

    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(fullPath).pipe(res);
  }
}
