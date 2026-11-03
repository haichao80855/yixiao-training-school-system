import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import * as path from 'path';
import { AppModule } from './app.module';
import { StorageEnginePort } from './modules/upload/domain/ports/storage-engine.port';
import { isSafeStorageKey } from './modules/upload/domain/media-key.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 允许跨域请求以供前端 Vue 3.5 访问
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 静态托管本地上传多媒体资产目录
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
  });

  // OSS 模式：本地磁盘未命中的 /uploads/<key> 302 跳转到 OSS 限时签名地址 (兼容管理端历史 URL 与迁移过渡期)
  if (process.env.STORAGE_ENGINE === 'oss') {
    const storage = app.get(StorageEnginePort);
    app.use('/uploads/', (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      let key: string;
      try {
        key = decodeURIComponent(req.path.replace(/^\/+/, ''));
      } catch {
        return next();
      }
      if (!isSafeStorageKey(key)) return next();
      res.redirect(302, storage.signedUrl(key, { expiresInSeconds: 600 }));
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 拓视未来教育「一校教培系统」NestJS 后端微服务已成功启动: http://localhost:${port}`);
  console.log(`📊 运行环境状态监控: http://localhost:${port}/api/stats/overview`);
  console.log(`📁 本地多媒体资产静态托管目录: ${uploadsDir} -> /uploads/`);
  console.log(`🗄️  媒体存储引擎: ${process.env.STORAGE_ENGINE || 'local'}\n`);
}
bootstrap();
