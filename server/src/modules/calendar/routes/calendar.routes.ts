import { FastifyInstance } from "fastify";
import { CalendarController } from "../controllers/calendar.controller.js";
import { CalendarService } from "../services/calendar.service.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import {
  connectCalendarSchema,
  createMeetingEventSchema,
  updateMeetingEventSchema,
} from "../schemas/calendar.schema.js";

export async function calendarRoutes(app: FastifyInstance) {
  const service = new CalendarService();
  const controller = new CalendarController(service);

  // Unauthenticated Public iCal (.ics) Feed Route (Token protected)
  app.get("/feed/:token", controller.getICalFeed as any);

  // Authenticated Routes
  app.register(async (authApp) => {
    authApp.addHook("preHandler", authenticate);

    authApp.post("/connection", { schema: { body: connectCalendarSchema } }, controller.connectProvider as any);
    authApp.get("/connection", controller.getConnection as any);

    authApp.post("/events", { schema: { body: createMeetingEventSchema } }, controller.createMeetingEvent as any);
    authApp.get("/events", controller.listMeetingEvents as any);
    authApp.put("/events/:id", { schema: { body: updateMeetingEventSchema } }, controller.updateMeetingEvent as any);
    authApp.delete("/events/:id", controller.cancelMeetingEvent as any);
  });
}

export default calendarRoutes;
