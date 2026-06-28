import { FastifyReply, FastifyRequest } from "fastify";
import { UploadService } from "../services/upload.service.js";

export class UploadController {
  constructor(private readonly service: UploadService) {}

  requestUploadUrl = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const result = await this.service.requestUploadUrl(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "Presigned upload URL generated successfully",
      data: result,
    });
  };

  confirmUpload = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const upload = await this.service.confirmUpload(body.uploadId, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "File upload confirmed successfully",
      data: upload,
    });
  };

  getUpload = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const upload = await this.service.getUpload(params.id, user.organizationId);

    // Security check: employees can only retrieve metadata for files they uploaded themselves
    if (user.role === "employee" && upload.ownership.uploadedBy.toString() !== user.userId) {
      return reply.status(403).send({
        success: false,
        message: "Forbidden: You do not have permission to access this upload.",
      });
    }

    return reply.status(200).send({
      success: true,
      message: "Upload metadata retrieved successfully",
      data: upload,
    });
  };

  listUploads = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    let targetUploadedBy = query.uploadedBy;
    if (user.role === "employee") {
      targetUploadedBy = user.userId;
    }

    const filter = {
      organizationId: user.organizationId,
      type: query.type,
      uploadedBy: targetUploadedBy,
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const result = await this.service.listUploads(filter, pagination);

    return reply.status(200).send({
      success: true,
      message: "Uploads list retrieved successfully",
      data: result.uploads,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  deleteUpload = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    // First fetch to check ownership
    const upload = await this.service.getUpload(params.id, user.organizationId);
    
    // Security check: employees can only delete their own files
    if (user.role === "employee" && upload.ownership.uploadedBy.toString() !== user.userId) {
      return reply.status(403).send({
        success: false,
        message: "Forbidden: You do not have permission to delete this upload.",
      });
    }

    await this.service.deleteUpload(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Upload deleted successfully",
      data: null,
    });
  };
}

export default UploadController;
