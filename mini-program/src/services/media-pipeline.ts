import { eduApi, BASE_URL } from '../api/edu';

export interface CapturePhotosOptions {
  maxCount: number;
  scheduleId?: string;
  sourceType?: ('album' | 'camera')[];
}

export interface CaptureVideoOptions {
  scheduleId?: string;
  maxDuration?: number;
}

export interface ClientMediaPipeline {
  /**
   * 现场照片批量采集、压制与并行上传流水线
   * 采用客户端压缩 (5MB -> 300KB) + Promise.all 并发池
   * @throws 当且仅当关键网络异常且所有图片均失败时提示并抛出
   */
  captureAndUploadPhotos(options: CapturePhotosOptions): Promise<string[]>;

  /**
   * 课堂短视频选取与上传流水线
   */
  captureAndUploadVideo(options: CaptureVideoOptions): Promise<string>;

  /**
   * 绝对 URL 规范化器（消除相对路径 /uploads 导致的小程序加载错误）
   */
  canonicalizeUrl(url?: string): string;

  /**
   * 本地智能尺寸重采样与画质压缩 (提升 10~20 倍上传效率)
   */
  compressPhoto(tempPath: string): Promise<string>;
}

export class DefaultClientMediaPipeline implements ClientMediaPipeline {
  constructor(private readonly apiBaseUrl: string = BASE_URL) {}

  canonicalizeUrl(url?: string): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    // 已经是绝对网络地址
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // 相对路径补齐绝对域名
    if (trimmed.startsWith('/')) {
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      return `${base}${trimmed}`;
    }

    // 本地沙箱临时路径（防御性保留，但打出安全提示）
    if (/^(wxfile|http:\/\/tmp)/i.test(trimmed)) {
      console.warn('[MediaPipeline] 检测到未持久化的临时沙箱路径:', trimmed);
      return trimmed;
    }

    const base = this.apiBaseUrl.replace(/\/+$/, '');
    return `${base}/${trimmed}`;
  }

  async compressPhoto(tempPath: string): Promise<string> {
    return new Promise((resolve) => {
      try {
        if (typeof uni !== 'undefined' && typeof uni.compressImage === 'function') {
          uni.compressImage({
            src: tempPath,
            quality: 75,
            compressedWidth: 1280,
            success: (res) => {
              resolve(res.tempFilePath || tempPath);
            },
            fail: () => {
              // 模拟器或特殊格式压制降级容错
              resolve(tempPath);
            },
          });
          return;
        }
      } catch {
        // 环境不支持时降级
      }
      resolve(tempPath);
    });
  }

  async captureAndUploadPhotos(options: CapturePhotosOptions): Promise<string[]> {
    const { maxCount, scheduleId, sourceType = ['album', 'camera'] } = options;
    if (maxCount <= 0) return [];

    return new Promise((resolve, reject) => {
      uni.chooseImage({
        count: maxCount,
        sizeType: ['compressed'],
        sourceType,
        success: async (res) => {
          if (!res.tempFilePaths || res.tempFilePaths.length === 0) {
            resolve([]);
            return;
          }

          uni.showLoading({ title: '正在压缩与上传照片...' });
          try {
            // 步骤 1: 客户端本地并发压缩（降低 90% 体积）
            const rawPaths: string[] = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : [res.tempFilePaths];
            const compressedPaths = await Promise.all(
              rawPaths.map((p: string) => this.compressPhoto(p))
            );

            // 步骤 2: 并发并行上传池
            const uploadSettled = await Promise.allSettled(
              compressedPaths.map((path: string) => eduApi.uploadPhoto(path, scheduleId))
            );

            uni.hideLoading();

            const succeededUrls: string[] = [];
            let failureCount = 0;

            for (const r of uploadSettled) {
              if (r.status === 'fulfilled' && r.value) {
                succeededUrls.push(this.canonicalizeUrl(r.value));
              } else {
                failureCount++;
              }
            }

            if (failureCount > 0 && succeededUrls.length === 0) {
              uni.showToast({ title: '照片上传失败，请检查网络后重试', icon: 'none' });
              reject(new Error('所有照片上传失败'));
              return;
            }

            if (failureCount > 0) {
              uni.showToast({
                title: `成功 ${succeededUrls.length} 张，失败 ${failureCount} 张`,
                icon: 'none',
              });
            } else {
              uni.showToast({ title: '照片已上传', icon: 'success' });
            }

            resolve(succeededUrls);
          } catch (err: any) {
            uni.hideLoading();
            uni.showToast({ title: err?.message || '上传处理异常', icon: 'none' });
            reject(err);
          }
        },
        fail: (err) => {
          // 用户取消选择不报错
          if (err?.errMsg && err.errMsg.includes('cancel')) {
            resolve([]);
          } else {
            resolve([]);
          }
        },
      });
    });
  }

  async captureAndUploadVideo(options: CaptureVideoOptions): Promise<string> {
    const { scheduleId, maxDuration = 60 } = options;

    return new Promise((resolve, reject) => {
      uni.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration,
        camera: 'back',
        success: async (res) => {
          if (!res.tempFilePath) {
            resolve('');
            return;
          }

          // 体积预检（100MB 门禁）
          if (res.size && res.size > 100 * 1024 * 1024) {
            uni.showToast({ title: '视频体积超出 100MB 上限', icon: 'none' });
            reject(new Error('视频体积超出上限'));
            return;
          }

          uni.showLoading({ title: '正在上传视频...' });
          try {
            const rawUrl = await eduApi.uploadVideo(res.tempFilePath, scheduleId);
            uni.hideLoading();
            const canonicalUrl = this.canonicalizeUrl(rawUrl);
            uni.showToast({ title: '课堂视频已就绪', icon: 'success' });
            resolve(canonicalUrl);
          } catch (err: any) {
            uni.hideLoading();
            console.warn('[MediaPipeline] 视频上传失败:', err);
            // 不再把本地临时路径 (wxfile://) 冒充为已上传视频：该路径仅本机可见，
            // 一旦随课评提交，家长端与 Web 端都无法播放。上传失败就明确告知老师重试。
            uni.showToast({
              title: err?.message ? `视频上传失败：${err.message}` : '视频上传失败，请检查网络后重试',
              icon: 'none',
              duration: 2500,
            });
            reject(err instanceof Error ? err : new Error('视频上传失败'));
          }
        },
        fail: (err) => {
          if (err?.errMsg && err.errMsg.includes('cancel')) {
            resolve('');
          } else {
            uni.showToast({ title: '未能选取视频', icon: 'none' });
            resolve('');
          }
        },
      });
    });
  }

}

export const mediaPipeline: ClientMediaPipeline = new DefaultClientMediaPipeline();
