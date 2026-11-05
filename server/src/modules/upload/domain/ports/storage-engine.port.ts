import { Injectable } from '@nestjs/common';

export interface SignedUrlOptions {
  /** 有效期 (秒)，默认 3600 */
  expiresInSeconds?: number;
  /** thumb = 列表缩略图；preview = 大图预览 (限制尺寸，省流量)；original = 原图/原视频 */
  variant?: 'original' | 'thumb' | 'preview';
  /**
   * 让链接在该时长内保持不变，手机才能命中缓存、不重复下载。
   * 实际有效期为 expiresInSeconds 到 expiresInSeconds + stableForSeconds 之间。
   */
  stableForSeconds?: number;
}

/** 链接到期时间 (秒级时间戳)：指定 stableForSeconds 时对齐到时间窗口边界，同一窗口内结果相同 */
export function signedUrlExpiry(options: SignedUrlOptions = {}, nowSeconds = Math.floor(Date.now() / 1000)): number {
  const earliest = nowSeconds + (options.expiresInSeconds ?? 3600);
  const window = options.stableForSeconds;
  return window ? Math.ceil(earliest / window) * window : earliest;
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

  /**
   * 识别本引擎签发的限时链接并还原为存储 key (管理端回传签名链接保存时使用)；非本引擎链接返回 null
   */
  abstract keyFromSignedUrl(url: string): string | null;
}

