import { FastifyReply, FastifyRequest } from "fastify";
import { CalendarService } from "../services/calendar.service.js";
import { AppError } from "../../../common/errors/app-error.js";

export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  connectProvider = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    const connection = await this.calendarService.connectProvider(
      user.organizationId,
      user.userId,
      body.provider,
      body.timezone
    );

    return reply.status(200).send({
      success: true,
      message: "Calendar connection updated successfully",
      data: connection,
    });
  };

  getConnection = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const connection = await this.calendarService.getConnection(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Calendar connection status retrieved successfully",
      data: connection,
    });
  };

  getICalFeed = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const token = params.token ? params.token.replace(".ics", "") : "";

    const icsContent = await this.calendarService.generateICalFeed(token);

    return reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="onboarding-events.ics"')
      .send(icsContent);
  };

  exportEventICal = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const eventId = params.id ? params.id.replace(".ics", "") : "";

    const icsContent = await this.calendarService.generateSingleEventICal(eventId);

    return reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="event-${eventId}.ics"`)
      .send(icsContent);
  };

  createMeetingEvent = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

    if (user.role === "employee" && body.organizerUserId && body.organizerUserId !== user.userId) {
      throw new AppError(403, "FORBIDDEN", "Employees cannot schedule meetings on behalf of other managers");
    }

    const event = await this.calendarService.createMeetingEvent(user.organizationId, user.userId, body);

    return reply.status(201).send({
      success: true,
      message: "Meeting event scheduled successfully",
      data: event,
    });
  };

  listMeetingEvents = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const events = await this.calendarService.listMeetingEvents(user.organizationId, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Meeting events retrieved successfully",
      data: events,
    });
  };

  updateMeetingEvent = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;
    const body = request.body as any;

    const event = await this.calendarService.updateMeetingEvent(user.organizationId, params.id, body);

    return reply.status(200).send({
      success: true,
      message: "Meeting event updated successfully",
      data: event,
    });
  };

  cancelMeetingEvent = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const event = await this.calendarService.cancelMeetingEvent(user.organizationId, params.id);

    return reply.status(200).send({
      success: true,
      message: "Meeting event cancelled successfully",
      data: event,
    });
  };
}
