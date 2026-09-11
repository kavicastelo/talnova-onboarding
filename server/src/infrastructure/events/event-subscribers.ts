import eventBus from "./event-bus.js";
import NotificationService from "../../modules/notifications/services/notification.service.js";
import NotificationRepository from "../../modules/notifications/repositories/notification.repository.js";
import workflowEngine from "../../modules/workflows/services/workflow.engine.js";
import smartAssignmentService from "../../modules/journeys/services/smart-assignment.service.js";
import documentService from "../../modules/documents/services/document.service.js";
import milestoneService from "../../modules/milestones/services/milestone.service.js";
import buddyService from "../../modules/buddy/services/buddy.service.js";
import calendarService from "../../modules/calendar/services/calendar.service.js";
import { GamificationService } from "../../modules/gamification/services/gamification.service.js";

const notificationService = new NotificationService(new NotificationRepository());
const gamificationService = new GamificationService();

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
    
    // Award milestone gamification points for journey graduation
    if (event.organizationId && event.actorId) {
      try {
        await gamificationService.awardPoints(
          event.organizationId,
          event.actorId,
          "journey_completed",
          100,
          `Graduated onboarding journey: "${journeyTitle || "Onboarding Journey"}"`,
          `journey_${journeyId || assignmentId || event.entityId}`
        );
      } catch (gErr) {
        console.warn("[EventSubscribers] Could not award gamification points for JOURNEY_COMPLETED:", gErr);
      }
    }

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
    const recipientId = assignedToUserId || event.actorId;

    // Award gamification points for completed task
    if (event.organizationId && recipientId) {
      try {
        await gamificationService.awardPoints(
          event.organizationId,
          recipientId,
          "task_completed",
          25,
          `Completed onboarding task: "${title || "Operational Task"}"`,
          `task_${taskId || event.entityId}`
        );
      } catch (err) {
        console.warn("[EventSubscribers] Could not award gamification points for TASK_COMPLETED:", err);
      }
    }

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

  // Listener for DOCUMENT_SIGNED event
  eventBus.subscribe("DOCUMENT_SIGNED", async (event) => {
    const { templateTitle, assignmentId, employeeId } = event.payload || {};
    const recipientId = employeeId || event.actorId;

    if (event.organizationId && recipientId) {
      try {
        await gamificationService.awardPoints(
          event.organizationId,
          recipientId,
          "document_signed",
          50,
          `Completed and signed compliance document: "${templateTitle || "Document"}"`,
          `doc_${assignmentId || event.entityId}`
        );
      } catch (err) {
        console.warn("[EventSubscribers] Could not award gamification points for DOCUMENT_SIGNED:", err);
      }
    }
  });

  // Listener for MILESTONE_COMPLETED event
  eventBus.subscribe("MILESTONE_COMPLETED", async (event) => {
    const { milestoneTitle, milestoneId, employeeId, targetDay } = event.payload || {};
    const recipientId = employeeId || event.actorId;

    if (event.organizationId && recipientId) {
      try {
        await gamificationService.awardPoints(
          event.organizationId,
          recipientId,
          "milestone_completed",
          50,
          `Achieved milestone: "${milestoneTitle || `Day ${targetDay || 30} Milestone`}"`,
          `milestone_${milestoneId || event.entityId}`
        );
      } catch (err) {
        console.warn("[EventSubscribers] Could not award gamification points for MILESTONE_COMPLETED:", err);
      }
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

  // Workflow Engine & Smart Auto-Enrollment Listener for USER_CREATED event
  const handleUserCreated = async (event: any) => {
    if (event.actorId) {
      await workflowEngine.processEvent(
        event.organizationId,
        "user_created",
        event.actorId,
        event.payload
      );
      await smartAssignmentService.autoEnrollNewHire(
        event.organizationId,
        event.actorId
      );
      await documentService.autoAssignDocumentsToNewHire(
        event.organizationId,
        event.actorId
      );
      await milestoneService.autoAssignMilestonesToNewHire(
        event.organizationId,
        event.actorId
      );
      await buddyService.autoAssignBuddyToNewHire(
        event.organizationId,
        event.actorId
      );
      await calendarService.autoScheduleOnboardingMeetings(
        event.organizationId,
        event.actorId
      );
    }
  };

  eventBus.subscribe("USER_CREATED", handleUserCreated);
  eventBus.subscribe("ON_USER_CREATED" as any, handleUserCreated);

  // Workflow Engine Listener for JOURNEY_COMPLETED event
  eventBus.subscribe("JOURNEY_COMPLETED", async (event) => {
    if (event.actorId) {
      await workflowEngine.processEvent(
        event.organizationId,
        "journey_completed",
        event.actorId,
        event.payload
      );
    }
  });

  // Workflow Engine Listener for TASK_COMPLETED event
  eventBus.subscribe("TASK_COMPLETED", async (event) => {
    if (event.actorId) {
      await workflowEngine.processEvent(
        event.organizationId,
        "task_completed",
        event.actorId,
        event.payload
      );
    }
  });

  console.log("[EventSubscribers] Registered platform event listeners.");
}

export default registerEventSubscribers;
