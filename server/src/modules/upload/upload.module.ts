import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MediaUploadCoordinator } from './domain/media-upload.coordinator';
import { StorageEnginePort } from './domain/ports/storage-engine.port';
import { LocalStorageEngineAdapter } from './domain/adapters/local-storage-engine.adapter';
import { MemoryMockStorageAdapter } from './domain/adapters/memory-mock-storage.adapter';

@Module({
  controllers: [UploadController],
  providers: [
    LocalStorageEngineAdapter,
    MemoryMockStorageAdapter,
    {
      provide: StorageEnginePort,
      useClass:
        process.env.STORAGE_ENGINE === 'memory'
          ? MemoryMockStorageAdapter
          : LocalStorageEngineAdapter,
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
