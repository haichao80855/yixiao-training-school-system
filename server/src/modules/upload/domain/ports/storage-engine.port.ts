import { Injectable } from '@nestjs/common';

export interface SignedUrlOptions {
  /** 有效期 (秒)，默认 3600 */
  expiresInSeconds?: number;
  /** thumb = 列表缩略图；original = 原图/原视频 */
  variant?: 'original' | 'thumb';
}

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
  abstract write(relativePath: string, buffer: Buffer, baseUrl?: string): Promise<StoragePersistResult>;

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
   * 解析相对路径的对外访问 URL (支持传入外部 baseUrl 规范化为绝对路径)
   */
  abstract resolveUrl(relativePath: string, baseUrl?: string): string;

  /**
   * 生成限时访问链接 (家长端等对外场景只允许使用该方法输出媒体地址)
   * 本地磁盘：/api/media/<key>?exp=&sig= (HMAC 签名)；OSS：预签名 URL + 图片处理参数
   */
  abstract signedUrl(key: string, options?: SignedUrlOptions): string;
}

