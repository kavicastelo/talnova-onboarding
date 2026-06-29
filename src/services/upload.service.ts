import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface PresignedUploadResponse {
  uploadUrl: string;
  objectKey: string;
  upload: {
    _id: string;
    organizationId: string;
    fileName: string;
    originalFileName: string;
    extension: string;
    mimeType: string;
    fileSizeBytes: number;
    type: string;
    storage: {
      provider: string;
      bucket: string;
      objectKey: string;
      publicUrl?: string;
    };
  };
}

export const uploadService = {
  /**
   * Request a presigned URL for direct file upload to storage
   */
  getPresignedUrl: async (
    fileName: string,
    fileSizeBytes: number,
    mimeType: string,
    visibility: 'public' | 'private' = 'private'
  ): Promise<PresignedUploadResponse> => {
    const response = await apiClient.post<ApiResponse<PresignedUploadResponse>>('/uploads/presigned', {
      fileName,
      fileSizeBytes,
      mimeType,
      visibility,
    });
    return response.data.data;
  },

  /**
   * Upload file directly to Cloudflare R2 / S3 using presigned PUT URL,
   * then notify backend that upload is complete.
   */
  uploadFile: async (
    file: File,
    visibility: 'public' | 'private' = 'private',
    onProgress?: (progressPercent: number) => void
  ): Promise<PresignedUploadResponse['upload']> => {
    // 1. Get the signed URL
    const presignedInfo = await uploadService.getPresignedUrl(
      file.name,
      file.size,
      file.type || 'application/octet-stream',
      visibility
    );

    // 2. Put file to presigned URL
    // S3 PUT requests with signed URL will fail if Auth Bearer header is included,
    // so we use XMLHttpRequest without standard headers.
    const xhr = new XMLHttpRequest();
    await new Promise<void>((resolve, reject) => {
      xhr.open('PUT', presignedInfo.uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Failed to upload file to storage: ${xhr.statusText} (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload.'));
      xhr.send(file);
    });

    // 3. Confirm upload with backend
    const confirmRes = await apiClient.post<ApiResponse<any>>('/uploads/complete', {
      uploadId: presignedInfo.upload._id,
    });

    return confirmRes.data.data;
  },
};

export default uploadService;
