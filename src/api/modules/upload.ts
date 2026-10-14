import { request } from '@/utils/request';

export interface PhotoItemDto {
  originalUrl: string;
  thumbnailUrl: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
}

export interface ClassroomPhotoBatchResult {
  successCount: number;
  failureCount: number;
  persistedUrls: string[];
  items: PhotoItemDto[];
  errors: Array<{ filename: string; reason: string }>;
}

export interface VideoUploadResult {
  videoUrl: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
}

export const uploadApi = {
  /**
   * 批量上传随堂现场实况照片 (1~9 张)
   */
  uploadClassroomPhotos: async (params: {
    files: File[];
    campusId?: string;
    scheduleEventId?: string;
  }) => {
    const formData = new FormData();
    params.files.forEach((file) => {
      formData.append('files', file);
    });
    if (params.campusId) {
      formData.append('campusId', params.campusId);
    }
    if (params.scheduleEventId) {
      formData.append('scheduleEventId', params.scheduleEventId);
    }

    return request<ClassroomPhotoBatchResult>('/api/upload/photos', {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * 上传随堂课堂实操录像视频 (<= 100MB)
   */
  uploadClassroomVideo: async (params: {
    file: File;
    campusId?: string;
    scheduleEventId?: string;
  }) => {
    const formData = new FormData();
    formData.append('file', params.file);
    if (params.campusId) {
      formData.append('campusId', params.campusId);
    }
    if (params.scheduleEventId) {
      formData.append('scheduleEventId', params.scheduleEventId);
    }

    return request<VideoUploadResult>('/api/upload/video', {
      method: 'POST',
      body: formData,
    });
  },
};
