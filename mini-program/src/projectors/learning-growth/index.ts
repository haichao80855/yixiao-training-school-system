import { DefaultLearningGrowthProjector } from './projector';
import { HttpGrowthQueryAdapter } from './adapters/http-growth.adapter';
import { UniStorageGrowthCacheAdapter, MemoryGrowthCacheAdapter, MemoryGrowthQueryAdapter } from './adapters/memory-growth.adapter';
import type { LearningGrowthProjector } from './types';
import type { GrowthQueryPort, GrowthCachePort } from './ports';

export * from './types';
export * from './ports';
export * from './adapters/http-growth.adapter';
export * from './adapters/memory-growth.adapter';
export * from './projector';

export function createLearningGrowthProjector(options?: {
  queryPort?: GrowthQueryPort;
  cachePort?: GrowthCachePort;
  cacheTtlMs?: number;
}): LearningGrowthProjector {
  const queryPort = options?.queryPort || new HttpGrowthQueryAdapter();
  const cachePort = options?.cachePort || new UniStorageGrowthCacheAdapter();
  return new DefaultLearningGrowthProjector({
    queryPort,
    cachePort,
    cacheTtlMs: options?.cacheTtlMs,
  });
}

export const learningGrowthProjector: LearningGrowthProjector = createLearningGrowthProjector();

// 挂载静态属性，防范打包工具在非静态直接引用场景下的树摇清理
(learningGrowthProjector as any).createProjector = createLearningGrowthProjector;
(learningGrowthProjector as any).createLearningGrowthProjector = createLearningGrowthProjector;
(learningGrowthProjector as any).DefaultProjectorClass = DefaultLearningGrowthProjector;
(learningGrowthProjector as any).HttpGrowthQueryAdapter = HttpGrowthQueryAdapter;
(learningGrowthProjector as any).MemoryGrowthQueryAdapter = MemoryGrowthQueryAdapter;
(learningGrowthProjector as any).MemoryGrowthCacheAdapter = MemoryGrowthCacheAdapter;
(learningGrowthProjector as any).UniStorageGrowthCacheAdapter = UniStorageGrowthCacheAdapter;
