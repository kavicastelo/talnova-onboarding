import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "../../../config/index.js";
import UploadRepository from "../repositories/upload.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";

export class UploadService {
  private s3Client: S3Client;

  constructor(private readonly repository: UploadRepository) {
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: storageConfig.endpoint,
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  private classifyFileType(mimeType: string): "video" | "image" | "audio" | "document" | "other" {
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    
    const docMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
    ];
    if (docMimes.includes(mimeType)) return "document";
    
    return "other";
  }

  async requestUploadUrl(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: {
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      visibility?: "public" | "private";
    }
  ) {
    if (data.fileSizeBytes > storageConfig.maxUploadSize) {
      throw new AppError(413, "FILE_TOO_LARGE", `File size exceeds the limit of ${storageConfig.maxUploadSize} bytes`);
    }

    const fileType = this.classifyFileType(data.mimeType);
    const extension = data.fileName.split(".").pop() || "";
    const uuid = new mongoose.Types.ObjectId().toString();
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // organizations/{organizationId}/uploads/{year}/{month}/{uuid}.{ext}
    const objectKey = `organizations/${orgId.toString()}/uploads/${year}/${month}/${uuid}.${extension}`;

    // Generate signed upload URL (valid for 1 hour)
    const command = new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: objectKey,
      ContentType: data.mimeType,
    });

    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    } catch (err: any) {
      throw new AppError(500, "INTERNAL_SERVER_ERROR", `Failed to generate R2 upload URL: ${err.message}`);
    }

    const publicUrl = data.visibility === "public"
      ? `${storageConfig.publicUrl}/${objectKey}`
      : undefined;

    // Create a pending upload document
    const uploadDoc = await this.repository.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      fileName: `${uuid}.${extension}`,
      originalFileName: data.fileName,
      extension,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      type: fileType,
      storage: {
        provider: "cloudflare-r2",
        bucket: storageConfig.bucket,
        objectKey,
        publicUrl,
      },
      ownership: {
        uploadedBy: new mongoose.Types.ObjectId(userId),
        uploadedAt: new Date(),
      },
      security: {
        visibility: data.visibility || "private",
        virusScanned: false,
        virusScanStatus: "pending",
      },
      lifecycle: {
        status: "active", // We activate immediately, but can verify via head-object in confirmation
      },
    });

    return {
      uploadUrl,
      objectKey,
      upload: uploadDoc,
    };
  }

  async confirmUpload(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ) {
    const upload = await this.repository.findByIdAndOrg(id, orgId);
    if (!upload) {
      throw new AppError(404, "NOT_FOUND", "Upload not found");
    }

    // Try checking R2 object existence (failsafe for mock environments)
    try {
      const command = new HeadObjectCommand({
        Bucket: upload.storage.bucket,
        Key: upload.storage.objectKey,
      });
      await this.s3Client.send(command);
    } catch (err) {
      // If mock endpoint is active, do not block confirmation but log warning
      if (storageConfig.endpoint.includes("mock")) {
        console.warn(`[UploadService] Mock endpoint active. Bypassing object check for key: ${upload.storage.objectKey}`);
      } else {
        throw new AppError(400, "BAD_REQUEST", "File upload has not been completed on storage provider yet.");
      }
    }

    // Mark status active/completed
    return this.repository.update(id, {
      "lifecycle.status": "active",
    } as any);
  }

  async getUpload(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const upload = await this.repository.findByIdAndOrg(id, orgId);
    if (!upload) {
      throw new AppError(404, "NOT_FOUND", "Upload not found");
    }
    return upload;
  }

  async listUploads(
    filter: {
      organizationId: string | mongoose.Types.ObjectId;
      type?: "video" | "image" | "audio" | "document" | "other";
      uploadedBy?: string;
    },
    pagination: { page: number; limit: number; sortBy?: string; sortOrder?: "asc" | "desc" }
  ) {
    return this.repository.find(filter, pagination);
  }

  async deleteUpload(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const upload = await this.getUpload(id, orgId);
    return this.repository.softDelete(upload._id);
  }
}

export default UploadService;
