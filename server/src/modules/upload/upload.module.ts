import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MediaController } from './media.controller';
import { MediaUploadCoordinator } from './domain/media-upload.coordinator';
import { StorageEnginePort } from './domain/ports/storage-engine.port';
import { LocalStorageEngineAdapter } from './domain/adapters/local-storage-engine.adapter';
import { MemoryMockStorageAdapter } from './domain/adapters/memory-mock-storage.adapter';
import { AliyunOssStorageAdapter } from './domain/adapters/aliyun-oss-storage.adapter';

function createStorageEngine(local: LocalStorageEngineAdapter, memory: MemoryMockStorageAdapter): StorageEnginePort {
  switch (process.env.STORAGE_ENGINE) {
    case 'memory':
      return memory;
    case 'oss':
      return new AliyunOssStorageAdapter();
    default:
      return local;
  }
}

@Module({
  controllers: [UploadController, MediaController],
  providers: [
    LocalStorageEngineAdapter,
    MemoryMockStorageAdapter,
    {
      provide: StorageEnginePort,
      useFactory: createStorageEngine,
      inject: [LocalStorageEngineAdapter, MemoryMockStorageAdapter],
    },
    MediaUploadCoordinator,
  ],
  exports: [
    MediaUploadCoordinator,
    StorageEnginePort,
    LocalStorageEngineAdapter,
    MemoryMockStorageAdapter,
  ],
})
export class UploadModule {}
