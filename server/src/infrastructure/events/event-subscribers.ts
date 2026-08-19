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

  // Listener for TASK_CREATED event
  eventBus.subscribe("TASK_CREATED", async (event) => {
    const { title, assignedToUserId, taskId } = event.payload || {};
    if (assignedToUserId) {
      await notificationService.createNotification({
        organizationId: event.organizationId,
        recipientUserId: assignedToUserId,
        type: "journey_due_soon",
        channel: "in_app",
        title: "New Task Assigned",
        message: `You have been assigned a new task: "${title || "Operational Task"}".`,
        priority: "medium",
        data: {
          taskId: taskId || event.entityId,
          deepLink: `/tasks`,
        },
      });
    }
  });

  // Listener for TASK_COMPLETED event
  eventBus.subscribe("TASK_COMPLETED", async (event) => {
    const { title, taskId, assignedToUserId } = event.payload || {};
    if (event.actorId) {
      await notificationService.createNotification({
        organizationId: event.organizationId,
        recipientUserId: event.actorId,
        type: "announcement",
        channel: "in_app",
        title: "Task Completed",
        message: `Task "${title || "Operational Task"}" has been completed successfully.`,
        priority: "low",
        data: {
          taskId: taskId || event.entityId,
          deepLink: `/tasks`,
        },
      });
    }
  });

  // Listener for TASK_OVERDUE event
  eventBus.subscribe("TASK_OVERDUE", async (event) => {
    const { title, taskId, assignedToUserId } = event.payload || {};
    const recipient = assignedToUserId || event.actorId;
    if (recipient) {
      await notificationService.createNotification({
        organizationId: event.organizationId,
        recipientUserId: recipient,
        type: "journey_overdue",
        channel: "in_app",
        title: "Task Overdue Alert",
        message: `Task "${title || "Operational Task"}" is overdue. Please execute it immediately.`,
        priority: "high",
        data: {
          taskId: taskId || event.entityId,
          deepLink: `/tasks`,
        },
      });
    }
  });

  console.log("[EventSubscribers] Registered platform event listeners.");
}

export default registerEventSubscribers;
