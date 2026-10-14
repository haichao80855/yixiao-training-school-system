/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」行级数据隔离策略模块 (DataScopeModule)
 * 全局中枢模块，注册策略引擎与全局上下文拦截器
 * ==============================================================================
 */

import { Module, Global } from '@nestjs/common';
import { DataScopePolicyEngine } from './domain/data-scope-policy.engine';
import { ScopeContextInterceptor } from './adapters/scope-context.interceptor';

@Global()
@Module({
  providers: [
    DataScopePolicyEngine,
    ScopeContextInterceptor,
  ],
  exports: [
    DataScopePolicyEngine,
    ScopeContextInterceptor,
  ],
})
export class DataScopeModule {}
