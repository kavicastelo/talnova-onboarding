import { FastifyReply, FastifyRequest } from "fastify";
import { OfficeLocationService } from "../services/office-location.service.js";

export class OfficeLocationController {
  constructor(private readonly service: OfficeLocationService) {}

  getLocations = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const locations = await this.service.getLocations(user.organizationId);

    return reply.status(200).send({
      success: true,
      message: "Office locations retrieved successfully",
      data: locations,
    });
  };

  getLocationById = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const location = await this.service.getLocationById(user.organizationId, params.id);
    if (!location) {
      return reply.status(404).send({
        success: false,
        message: "Office location not found",
      });
    }

    return reply.status(200).send({
      success: true,
      message: "Office location retrieved successfully",
      data: location,
    });
  };

  createLocation = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const location = await this.service.createLocation(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "Office location facility created successfully",
      data: location,
    });
  };

  updateLocation = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const location = await this.service.updateLocation(user.organizationId, params.id, body);

    return reply.status(200).send({
      success: true,
      message: "Office location facility updated successfully",
      data: location,
    });
  };

  deleteLocation = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.service.deleteLocation(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "Office location facility deleted successfully",
    });
  };

  assignDesk = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    if (!body.deskNumber || !body.targetUserId) {
      return reply.status(400).send({
        success: false,
        message: "Desk number and target user ID are required for desk assignment",
      });
    }

    const result = await this.service.assignEmployeeDesk(
      user.organizationId,
      params.id,
      body.floorNumber || 1,
      body.deskNumber,
      body.targetUserId
    );

    return reply.status(200).send({
      success: true,
      message: "Employee desk assigned successfully",
      data: result,
    });
  };

  getEmployeeGuidance = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const guidance = await this.service.getEmployeeLocationGuidance(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Employee office location guidance retrieved successfully",
      data: guidance,
    });
  };
}
