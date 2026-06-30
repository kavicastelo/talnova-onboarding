import { FastifyReply, FastifyRequest } from "fastify";
import { QuickLinkService } from "../services/quick-link.service.js";
import mongoose from "mongoose";

export class QuickLinkController {
  constructor(private readonly service: QuickLinkService) {}

  getQuickLinks = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    let orgId = user?.organizationId;
    if (!orgId) {
      const org = await mongoose.model("Organization").findOne({ isDeleted: false });
      orgId = org?._id;
    }

    const links = await this.service.getQuickLinks(orgId);

    return reply.status(200).send({
      success: true,
      message: "Quick links retrieved successfully",
      data: links,
    });
  };

  createQuickLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const link = await this.service.createQuickLink(user.organizationId, body);

    return reply.status(201).send({
      success: true,
      message: "Quick link created successfully",
      data: link,
    });
  };

  updateQuickLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const link = await this.service.updateQuickLink(params.id, user.organizationId, body);

    return reply.status(200).send({
      success: true,
      message: "Quick link updated successfully",
      data: link,
    });
  };

  deleteQuickLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.service.deleteQuickLink(params.id, user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Quick link deleted successfully",
      data: null,
    });
  };
}

export default QuickLinkController;
