import { Injectable } from '@nestjs/common';

export interface StoragePersistResult {
  relativePath: string;
  url: string;
  absolutePath?: string;
  sizeBytes: number;
}

/**
 * 存储引擎端口 (StorageEnginePort)
 * 遵循 DEEPENING.md Ports & Adapters 架构规范
 * 分离存储介质策略与业务协调器
 */
@Injectable()
export abstract class StorageEnginePort {
  /**
   * 将二进制数据持久化到指定相对路径
   * @param relativePath 相对存储根路径，如 photos/campus-bj-hq/sch-123/20261014/abc.jpg
   * @param buffer 文件二进制 Buffer
   */
  abstract write(relativePath: string, buffer: Buffer): Promise<StoragePersistResult>;

  /**
   * 检查相对路径文件是否存在
   */
  abstract exists(relativePath: string): Promise<boolean>;

  /**
   * 删除指定相对路径文件
   */
  abstract delete(relativePath: string): Promise<boolean>;

  /**
   * 批量删除指定相对前缀或文件列表
   */
  abstract deleteByPrefix(prefix: string): Promise<number>;

  /**
   * 解析相对路径的对外访问 URL
   */
  abstract resolveUrl(relativePath: string): string;
}
