const TOKEN_KEY = 'yixiao_auth_token';
const CAMPUS_KEY = 'yixiao_current_campus_id';

export interface UploadedVideo {
  videoUrl: string;
  posterUrl: string;
}

export interface VideoUploadHandle {
  promise: Promise<UploadedVideo>;
  abort: () => void;
}

/** fetch 拿不到上传进度。手机网络传大视频要几分钟，必须让老师看到进度并能取消，所以这里用 XHR */
export function uploadVideoWithProgress(
  file: File,
  scheduleEventId: string,
  onProgress: (percent: number) => void,
): VideoUploadHandle {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<UploadedVideo>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('scheduleEventId', scheduleEventId);

    xhr.open('POST', '/api/upload/video');
    xhr.responseType = 'json';
    const token = localStorage.getItem(TOKEN_KEY);
    const campusId = localStorage.getItem(CAMPUS_KEY);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (campusId) xhr.setRequestHeader('X-Campus-Id', campusId);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = body?.data ?? body;
        if (data?.videoUrl) resolve({ videoUrl: data.videoUrl, posterUrl: data.posterUrl || '' });
        else reject(new Error('视频上传失败，请重试'));
      } else if (xhr.status === 401) {
        reject(new Error('登录已失效，请重新登录后再上传'));
      } else {
        const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
        reject(new Error(message || '视频上传失败，请重试'));
      }
    };
    xhr.onerror = () => reject(new Error('网络中断，视频上传失败，请重试'));
    xhr.onabort = () => reject(new DOMException('已取消', 'AbortError'));
    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}
