import { FastifyReply, FastifyRequest } from "fastify";
import { CalendarService } from "../services/calendar.service.js";

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

  createMeetingEvent = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const body = request.body as any;

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
