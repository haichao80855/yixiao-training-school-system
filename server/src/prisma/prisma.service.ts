import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DataScopePolicyEngine } from '../modules/data-scope/domain/data-scope-policy.engine';
import { createDataScopePrismaMiddleware } from '../modules/data-scope/adapters/prisma-scope.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() private readonly dataScopeEngine?: DataScopePolicyEngine) {
    super();
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
