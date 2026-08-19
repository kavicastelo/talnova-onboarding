import eventBus from "./event-bus.js";
import NotificationService from "../../modules/notifications/services/notification.service.js";
import NotificationRepository from "../../modules/notifications/repositories/notification.repository.js";

const notificationService = new NotificationService(new NotificationRepository());

export function registerEventSubscribers(): void {
  // Listener for JOURNEY_ASSIGNED event
  eventBus.subscribe("JOURNEY_ASSIGNED", async (event) => {
    const { journeyTitle, assignmentId, journeyId } = event.payload || {};
    if (event.actorId) {
      await notificationService.notifyJourneyAssignment(
        event.organizationId,
        event.actorId,
        journeyTitle || "Onboarding Journey",
        assignmentId || event.entityId,
        journeyId
      );
    }
  });

  // Listener for JOURNEY_COMPLETED event
  eventBus.subscribe("JOURNEY_COMPLETED", async (event) => {
    const { employeeName, journeyTitle, assignmentId, journeyId, managerUserId } = event.payload || {};
    if (event.actorId) {
      await notificationService.notifyJourneyCompletion(
        event.organizationId,
        event.actorId,
        employeeName || "Employee",
        journeyTitle || "Onboarding Journey",
        assignmentId || event.entityId,
        journeyId,
        managerUserId
      );
    }
  });

  // Listener for JOURNEY_OVERDUE event
  eventBus.subscribe("JOURNEY_OVERDUE", async (event) => {
    const { journeyTitle, assignmentId, journeyId } = event.payload || {};
    if (event.actorId) {
      await notificationService.createNotification({
        organizationId: event.organizationId,
        recipientUserId: event.actorId,
        type: "journey_overdue",
        channel: "in_app",
        title: "Journey Overdue Alert",
        message: `Your assigned journey "${journeyTitle || "Onboarding Journey"}" is overdue. Please complete it as soon as possible.`,
        priority: "critical",
        data: {
          journeyId,
          assignmentId: assignmentId || event.entityId,
          deepLink: `/employee/journeys/${assignmentId || event.entityId}`,
        },
      });
    }
  });

  // Listener for CHECKIN_DUE compliance event
  eventBus.subscribe("CHECKIN_DUE", async (event) => {
    const { journeyTitle, assignmentId, journeyId } = event.payload || {};
    if (event.actorId) {
      await notificationService.createNotification({
        organizationId: event.organizationId,
        recipientUserId: event.actorId,
        type: "journey_due_soon",
        channel: "in_app",
        title: "Compliance Due Soon Alert",
        message: `Reminder: "${journeyTitle || "Onboarding Journey"}" is due in the next 3 days.`,
        priority: "high",
        data: {
          journeyId,
          assignmentId: assignmentId || event.entityId,
          deepLink: `/employee/journeys/${assignmentId || event.entityId}`,
        },
      });
    }
  });

  console.log("[EventSubscribers] Registered platform event listeners.");
}

export default registerEventSubscribers;
