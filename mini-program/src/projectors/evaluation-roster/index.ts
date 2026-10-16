import { DefaultEvaluationRosterProjector } from './projector';
import { HttpRosterQueryAdapter } from './adapters/http-roster-query.adapter';
import { UniStorageRosterCacheAdapter, MemoryRosterCacheAdapter } from './adapters/storage-roster-cache.adapter';
import type { EvaluationRosterProjector } from './types';
import type { RosterQueryPort, RosterCachePort } from './ports';

export * from './types';
export * from './ports';
export * from './adapters/http-roster-query.adapter';
export * from './adapters/storage-roster-cache.adapter';
export * from './projector';

export function createEvaluationRosterProjector(options?: {
  queryPort?: RosterQueryPort;
  cachePort?: RosterCachePort;
  concurrency?: number;
  cacheTtlMs?: number;
}): EvaluationRosterProjector {
  const queryPort = options?.queryPort || new HttpRosterQueryAdapter();
  const cachePort = options?.cachePort || new UniStorageRosterCacheAdapter();
  return new DefaultEvaluationRosterProjector({
    queryPort,
    cachePort,
    concurrency: options?.concurrency,
    cacheTtlMs: options?.cacheTtlMs,
  });
}

export const evaluationRosterProjector: EvaluationRosterProjector = createEvaluationRosterProjector();

// 挂载至单例属性，防御打包器在无直接静态页面引用时的树摇清理
(evaluationRosterProjector as any).createProjector = createEvaluationRosterProjector;
(evaluationRosterProjector as any).createEvaluationRosterProjector = createEvaluationRosterProjector;
(evaluationRosterProjector as any).DefaultProjectorClass = DefaultEvaluationRosterProjector;
(evaluationRosterProjector as any).HttpRosterQueryAdapter = HttpRosterQueryAdapter;
(evaluationRosterProjector as any).UniStorageRosterCacheAdapter = UniStorageRosterCacheAdapter;
(evaluationRosterProjector as any).MemoryRosterCacheAdapter = MemoryRosterCacheAdapter;
