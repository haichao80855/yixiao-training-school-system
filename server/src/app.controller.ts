import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      system: '拓视未来教育「一校教培系统」NestJS 后端微服务中台',
      version: '1.0.0',
      stockCode: '002599',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 匿名存活探针 (部署冒烟、容器 healthcheck)：只确认进程与数据库可用，不返回任何业务数据。
   * 数据库异常时返回固定文案，避免全局异常过滤器把原始错误信息透出到公网。
   */
  @Public()
  @Get('api/health')
  async getLiveness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('service unavailable');
    }
    return { status: 'ok' };
  }

  /** 经营数据统计：需要登录，不再匿名开放。 */
  @Get('api/stats/overview')
  async getStats() {
    const campusCount = await this.prisma.campus.count();
    const studentCount = await this.prisma.student.count();
    const courseCount = await this.prisma.course.count();
    const classCount = await this.prisma.class.count();
    const scheduleCount = await this.prisma.scheduleEvent.count();
    const orderCount = await this.prisma.order.count();

    return {
      code: 200,
      message: 'success',
      data: {
        campusCount,
        studentCount,
        courseCount,
        classCount,
        scheduleCount,
        orderCount,
      },
    };
  }
}
