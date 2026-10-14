import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';

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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 拓视未来教育「一校教培系统」NestJS 后端微服务已成功启动: http://localhost:${port}`);
  console.log(`📊 运行环境状态监控: http://localhost:${port}/api/stats/overview`);
  console.log(`📁 本地多媒体资产静态托管目录: ${uploadsDir} -> /uploads/\n`);
}
bootstrap();
