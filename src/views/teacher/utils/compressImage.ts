/** 长边 1600、质量 0.8：手机和电脑上看都清晰，也放得大 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;
/** 小于这个体积的照片压缩空间不大，保留原样 */
const COMPRESS_ABOVE_BYTES = 500 * 1024;
const SERVER_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * 手机原图动辄几 MB 到十几 MB：上传前先缩放，省上传时间和 OSS 流量。
 * GIF 不处理，画到画布上会丢失动画。
 * 服务端不接受的格式 (如 iPhone 的 HEIC) 无论大小都转成 JPEG。
 * 浏览器解码失败时原样返回，由服务端给出明确拒绝。
 */
export async function compressImage(file: File): Promise<File> {
  const mustConvert = !SERVER_FORMATS.includes(file.type);
  if (file.type === 'image/gif') return file;
  if (!mustConvert && file.size <= COMPRESS_ABOVE_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // JPEG 没有透明通道，透明 PNG 不铺底会变成黑底
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 默认的 low 大幅缩小时细节发糊 (文字、作品最明显)
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    // iOS 对画布总内存有限制，用完立刻释放
    canvas.width = 0;
    canvas.height = 0;
    if (!blob || (!mustConvert && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
