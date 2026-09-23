import { Controller, Get } from '@nestjs/common';
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
      system: '盛通教育「一校教培系统」NestJS 后端微服务中台',
      version: '1.0.0',
      stockCode: '002599',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
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
