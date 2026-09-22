import { FastifyInstance } from "fastify";
import { CalendarController } from "../controllers/calendar.controller.js";
import { CalendarService } from "../services/calendar.service.js";
import { authenticate, requireFeatureFlag } from "../../../middleware/auth.middleware.js";
import {
  connectCalendarSchema,
  createMeetingEventSchema,
  updateMeetingEventSchema,
  availabilityQuerySchema,
} from "../schemas/calendar.schema.js";

export async function calendarRoutes(app: FastifyInstance) {
  const service = new CalendarService();
  const controller = new CalendarController(service);

  // Unauthenticated Public iCal (.ics) Feed Route (Token protected)
  app.get("/feed/:token", controller.getICalFeed as any);
  app.get("/feed/:token.ics", controller.getICalFeed as any);
  app.get("/events/:id/export.ics", controller.exportEventICal as any);

  // Authenticated Routes
  app.register(async (authApp) => {
    authApp.addHook("preHandler", authenticate);
    authApp.addHook("preHandler", requireFeatureFlag("calendar_integration"));

    authApp.post("/connection", { schema: { body: connectCalendarSchema } }, controller.connectProvider as any);
    authApp.get("/connection", controller.getConnection as any);

    authApp.get("/availability", { schema: { querystring: availabilityQuerySchema } }, controller.getAvailability as any);
    authApp.post("/events", { schema: { body: createMeetingEventSchema } }, controller.createMeetingEvent as any);
    authApp.get("/events", controller.listMeetingEvents as any);
    authApp.get("/events/:id/export", controller.exportEventICal as any);
    authApp.put("/events/:id", { schema: { body: updateMeetingEventSchema } }, controller.updateMeetingEvent as any);
    authApp.patch("/events/:id", { schema: { body: updateMeetingEventSchema } }, controller.updateMeetingEvent as any);
    authApp.delete("/events/:id", controller.cancelMeetingEvent as any);
    authApp.post("/events/:id/cancel", controller.cancelMeetingEvent as any);

    // Onboarding Pack (.ics) & Milestone Review Linking (Phase 3)
    authApp.get("/pack/export", controller.exportOnboardingPack as any);
    authApp.get("/pack/export.ics", controller.exportOnboardingPack as any);
    authApp.post("/milestones/:milestoneId/schedule-review", controller.scheduleMilestoneReview as any);
  });
}

export default calendarRoutes;
