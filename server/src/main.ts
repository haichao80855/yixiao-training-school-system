import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 允许跨域请求以供前端 Vue 3.5 访问
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 盛通教育「一校教培系统」NestJS 后端微服务已成功启动: http://localhost:${port}`);
  console.log(`📊 运行环境状态监控: http://localhost:${port}/api/stats/overview\n`);
}
bootstrap();
