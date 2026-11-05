/** 输出长边上限：720p 在手机和电脑上看课堂内容都清楚，体积比 1080p 小得多 */
const MAX_LONG_EDGE = 1280;
const MAX_SHORT_EDGE = 720;
const TARGET_BITRATE = 2_000_000;
const MAX_FRAME_RATE = 30;
/** 原视频码率已经低于这个值且不超过 720p 时，转码省不了多少，反而损失画质，直接上传原文件 */
const SKIP_BITRATE = 2_800_000;
/** 压缩后至少要小 10% 才采用，否则保留原文件 */
const MIN_SAVING_RATIO = 0.9;
/** 页面在前台时进度停滞超过这个时间视为卡死，放弃转码改传原文件 */
const STALL_TIMEOUT_MS = 30_000;

export interface VideoCompressResult {
  file: File;
  compressed: boolean;
}

export interface VideoCompressHandle {
  promise: Promise<VideoCompressResult>;
  cancel: () => void;
}

/** 按比例缩到 720p 以内。H.264 要求宽高为偶数 */
function targetSize(width: number, height: number) {
  const landscape = width >= height;
  const longEdge = landscape ? width : height;
  const shortEdge = landscape ? height : width;
  const scale = Math.min(1, MAX_LONG_EDGE / longEdge, MAX_SHORT_EDGE / shortEdge);
  const toEven = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
  return { width: toEven(width), height: toEven(height), scale };
}

/**
 * 在手机上把视频转成 720p H.264 再上传：同时省上传时间、OSS 存储和家长播放流量。
 * 不支持 WebCodecs、转不了或转完没变小时都返回原文件，保证老师始终能继续上传；只有老师主动取消才会 reject。
 */
export function compressVideo(file: File, onProgress: (percent: number) => void): VideoCompressHandle {
  let canceled = false;
  let cancelConversion: (() => Promise<void>) | null = null;

  async function run(): Promise<VideoCompressResult> {
    const original: VideoCompressResult = { file, compressed: false };
    if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return original;

    let wakeLock: { release: () => Promise<void> } | null = null;
    let stallTimer: ReturnType<typeof setInterval> | null = null;
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, canEncodeVideo } =
        await import('mediabunny');
      if (canceled) throw new DOMException('已取消', 'AbortError');

      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      if (!track) return original;

      const duration = await input.computeDuration();
      const { width, height, scale } = targetSize(track.displayWidth, track.displayHeight);
      const sourceBitrate = duration > 0 ? (file.size * 8) / duration : Infinity;
      if (scale === 1 && sourceBitrate <= SKIP_BITRATE) return original;

      if (!(await canEncodeVideo('avc', { width, height, bitrate: TARGET_BITRATE }))) return original;

      const target = new BufferTarget();
      const conversion = await Conversion.init({
        input,
        // moov 放在文件头：播放时不必先下载整个文件，边下边播也更省流量
        output: new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target }),
        video: { width, codec: 'avc', bitrate: TARGET_BITRATE, frameRate: MAX_FRAME_RATE, forceTranscode: true },
        // 手机视频的音轨通常已是 AAC，不重新编码，直接复制，音质无损
        showWarnings: false,
      });

      // 任何一条音视频轨道转不了都放弃：不能让老师上传后才发现视频没声音
      if (!conversion.isValid || conversion.discardedTracks.length > 0) return original;

      cancelConversion = () => conversion.cancel();
      let lastProgressAt = Date.now();
      let stalled = false;
      conversion.onProgress = (progress) => {
        lastProgressAt = Date.now();
        onProgress(Math.min(99, Math.round(progress * 100)));
      };
      stallTimer = setInterval(() => {
        // 切到后台时系统可能暂停编码，不算卡死
        if (document.hidden) {
          lastProgressAt = Date.now();
        } else if (Date.now() - lastProgressAt > STALL_TIMEOUT_MS) {
          stalled = true;
          conversion.cancel();
        }
      }, 5000);

      // 转码时间较长，尽量不让屏幕熄灭打断 (仅 HTTPS 下可用，失败不影响转码)
      wakeLock = (await (navigator as any).wakeLock?.request('screen').catch(() => null)) ?? null;

      try {
        await conversion.execute();
      } catch (err) {
        if (canceled) throw new DOMException('已取消', 'AbortError');
        if (stalled) return original;
        throw err;
      }
      if (canceled) throw new DOMException('已取消', 'AbortError');

      const buffer = target.buffer;
      if (!buffer || buffer.byteLength >= file.size * MIN_SAVING_RATIO) return original;
      const name = file.name.replace(/\.[^.]+$/, '') + '.mp4';
      return { file: new File([buffer], name, { type: 'video/mp4' }), compressed: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[teacher] 视频压缩失败，改传原文件', err);
      return original;
    } finally {
      if (stallTimer) clearInterval(stallTimer);
      wakeLock?.release().catch(() => undefined);
    }
  }

  return {
    promise: run(),
    cancel: () => {
      canceled = true;
      cancelConversion?.();
    },
  };
}
