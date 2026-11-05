import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 跨域白名单：生产环境前端经 Nginx 同源代理 /api，小程序不受 CORS 约束，默认关闭跨域；
  // 需要额外放行的域名通过 CORS_ORIGINS (逗号分隔) 配置。开发环境保持放开以便 Vite 直连。
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : isProduction ? false : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // /uploads/ 不再对外提供访问：媒体一律经 MediaLinkInterceptor 签发的限时链接读取
  // (本地磁盘 /api/media/<key>?exp=&sig=，OSS 预签名地址)

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 拓视未来教育「一校教培系统」NestJS 后端微服务已成功启动: http://localhost:${port}`);
  console.log(`📊 运行环境存活探针: http://localhost:${port}/api/health`);
  console.log(`🗄️  媒体存储引擎: ${process.env.STORAGE_ENGINE || 'local'}\n`);
}
bootstrap();
