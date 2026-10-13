import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SystemModule } from './modules/system/system.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { StudentModule } from './modules/student/student.module';
import { EducationalModule } from './modules/educational/educational.module';
import { FinancialModule } from './modules/financial/financial.module';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import { DataScopeGuard } from './modules/auth/guards/data-scope.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SystemModule,
    CurriculumModule,
    StudentModule,
    EducationalModule,
    FinancialModule,
  ],
  controllers: [AppController],
  providers: [
    // 1. 全局自动启用 JWT 登录守卫 (带有 @Public() 的接口自动放行)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 2. 全局启用 RBAC 操作权限码守卫 (带有 @RequirePermissions() 的接口自动按码核验)
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    // 3. 全局启用数据范围透视守卫 (带有 @RequireDataScope() 的接口自动按层级核验)
    {
      provide: APP_GUARD,
      useClass: DataScopeGuard,
    },
    // 全局统一统一响应格式包装拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // 全局统一 HTTP 异常过滤器
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
