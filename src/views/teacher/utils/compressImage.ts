const MAX_EDGE = 1920;
const COMPRESS_ABOVE_BYTES = 2 * 1024 * 1024;

/** 手机原图动辄十几 MB (服务端单张上限 10MB)：大图先缩放再上传；浏览器解码失败时原样返回，交给服务端判断 */
export async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_ABOVE_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
