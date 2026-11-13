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
    await this.enableSqliteWal();
  }

  /**
   * SQLite 改用 WAL 日志模式 (流畅度改进第 2 期)：写事务提交时不再阻塞所有读请求，
   * 老师结课和后台浏览同时进行时不容易排队或报 "database is locked"。
   * journal_mode=WAL 会写进数据库文件，之后一直生效；SQLITE_WAL=off 可以关掉。
   * 备份用 SQLite 备份 API (deploy/backup)，WAL 模式下也是完整的。
   */
  private async enableSqliteWal() {
    const url = process.env.DATABASE_URL || '';
    if (!url.startsWith('file:') || process.env.SQLITE_WAL === 'off') return;
    try {
      const rows = await this.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode = WAL;');
      const mode = rows?.[0]?.journal_mode;
      if (mode && mode.toLowerCase() !== 'wal') console.warn(`[prisma] SQLite 日志模式仍为 ${mode}，未能切换到 WAL`);
    } catch (err) {
      console.warn(`[prisma] 切换 SQLite WAL 模式失败：${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
