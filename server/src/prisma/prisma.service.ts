import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { DataScopePolicyEngine } from '../modules/data-scope/domain/data-scope-policy.engine';
import { createDataScopePrismaMiddleware } from '../modules/data-scope/adapters/prisma-scope.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() private readonly dataScopeEngine?: DataScopePolicyEngine) {
    super({ log: [{ emit: 'event', level: 'query' }] });
    // 慢查询日志 (流畅度改进第 0 期)：单条 SQL 超过 SLOW_QUERY_MS (默认 100ms) 打 warn
    const slowQueryMs = Number(process.env.SLOW_QUERY_MS ?? 100);
    if (Number.isFinite(slowQueryMs) && slowQueryMs > 0) {
      (this as unknown as PrismaClient<Prisma.PrismaClientOptions, 'query'>).$on('query', (event: Prisma.QueryEvent) => {
        if (event.duration >= slowQueryMs) {
          console.warn(`[slow-query] ${event.duration}ms ${event.query.slice(0, 300)}`);
        }
      });
    }
    if (this.dataScopeEngine) {
      this.$use(createDataScopePrismaMiddleware(this.dataScopeEngine, () => this));
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
