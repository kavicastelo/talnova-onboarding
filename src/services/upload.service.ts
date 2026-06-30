import { apiClient } from '../api/client';
import axios from 'axios';

export const uploadService = {
  uploadFile: async (
    file: File,
    visibility: 'public' | 'private' = 'public',
    onProgress?: (percent: number) => void
  ): Promise<{ uploadId: string; url: string }> => {
    // 1. Request presigned URL
    const response = await apiClient.post<{ success: boolean; data: any }>('/uploads/request-url', {
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      visibility,
    });

    const { uploadUrl, upload } = response.data.data;
    const uploadId = upload._id || upload.id;

    // 2. Upload file directly to S3/R2 presigned URL
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });

    // 3. Confirm completion
    await apiClient.post('/uploads/complete', { uploadId });

    // Fallback URL if public URL is missing
    const url = upload.storage?.publicUrl || `${apiClient.defaults.baseURL}/uploads/${uploadId}`;

    return {
      uploadId,
      url,
    };
  },
};
