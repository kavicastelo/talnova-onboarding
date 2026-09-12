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
import onboardingCaseService from "../../modules/onboarding/services/onboarding-case.service.js";
import OnboardingCase from "../../modules/onboarding/models/onboarding-case.model.js";
import queueService from "../queue/queue.service.js";
import EmployeeAssignment from "../../modules/assignments/models/assignment.model.js";
import Journey from "../../modules/journeys/models/journey.model.js";
import User from "../../modules/auth/models/user.model.js";
import Task from "../../modules/tasks/models/task.model.js";
import TaskService from "../../modules/tasks/services/task.service.js";
import TaskRepository from "../../modules/tasks/repositories/task.repository.js";
import itHardwareService from "../../modules/tasks/services/it-hardware.service.js";
import mongoose from "mongoose";

const notificationService = new NotificationService(new NotificationRepository());
const gamificationService = new GamificationService();
const taskService = new TaskService(new TaskRepository());

let subscribersRegistered = false;

export function registerEventSubscribers(): void {
  if (subscribersRegistered) return;
  subscribersRegistered = true;
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

  // Register worker for persistent delayed workflow execution
  queueService.registerWorker("resume_delayed_workflow", async (job: any) => {
    const { executionId } = job.data || {};
    if (executionId) {
      await workflowEngine.resumeDelayedExecution(executionId);
    }
  });

  // Workflow Engine Listener for USER_CREATED event (Unified Orchestration)
  const handleUserCreated = async (event: any) => {
    if (event.actorId) {
      await workflowEngine.processEvent(
        event.organizationId,
        "user_created",
        event.actorId,
        event.payload
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

  // Reactive State Machine: ONBOARDING_CASE_CREATED transitions case from created -> resolving -> provisioning -> ready -> active
  eventBus.subscribe("ONBOARDING_CASE_CREATED", async (event: any) => {
    const employeeId = event.payload?.employeeId || event.actorId;
    const organizationId = event.organizationId;
    if (!employeeId || !organizationId) return;

    try {
      const caseRecord = await OnboardingCase.findOne({
        organizationId,
        employeeId,
        isDeleted: false,
      });

      if (caseRecord && caseRecord.state === "created") {
        await onboardingCaseService.transition(
          caseRecord._id.toString(),
          organizationId.toString(),
          "resolving",
          event.actorId?.toString(),
          "Resolving onboarding journey and operational rules"
        );

        await onboardingCaseService.transition(
          caseRecord._id.toString(),
          organizationId.toString(),
          "provisioning",
          event.actorId?.toString(),
          "Provisioning checklist tasks, compliance documents, and milestones"
        );

        await onboardingCaseService.transition(
          caseRecord._id.toString(),
          organizationId.toString(),
          "ready",
          event.actorId?.toString(),
          "Initial provisioning complete"
        );

        await onboardingCaseService.transition(
          caseRecord._id.toString(),
          organizationId.toString(),
          "active",
          event.actorId?.toString(),
          "Employee onboarding active"
        );
      }
    } catch (err: any) {
      console.warn("[EventSubscribers] OnboardingCase state machine transition error:", err.message);
    }
  });

  // Pre-Boarding IT Hardware Provisioning Trigger (Prompt 08 Step 2.1)
  const handlePreboardingHardwareTrigger = async (event: any) => {
    const employeeId = event.payload?.employeeId || event.actorId || event.entityId;
    const organizationId = event.organizationId;
    if (!employeeId || !organizationId) return;

    try {
      const user = await User.findOne({
        _id: employeeId,
        organizationId,
        isDeleted: false,
      });

      if (user && user.employment?.hireDate) {
        await itHardwareService.triggerPreboardingItSetup(
          organizationId,
          user._id,
          user.employment.hireDate
        );
      }
    } catch (err: any) {
      console.warn("[EventSubscribers] Preboarding IT hardware trigger error:", err.message);
    }
  };

  eventBus.subscribe("USER_CREATED", handlePreboardingHardwareTrigger);
  eventBus.subscribe("ONBOARDING_CASE_CREATED", handlePreboardingHardwareTrigger);

  // Dynamic profile re-evaluation on department or role mutation
  const handleProfileReEvaluation = async (event: any) => {
    const employeeId = event.actorId || event.entityId || event.payload?._id;
    const organizationId = event.organizationId;
    if (!employeeId || !organizationId) return;

    try {
      const user = await User.findOne({
        _id: employeeId,
        organizationId,
        isDeleted: false,
      });
      if (!user) return;

      const activeAssignments = await EmployeeAssignment.find({
        organizationId,
        employeeId,
        status: { $in: ["assigned", "in_progress"] },
      });

      for (const assignment of activeAssignments) {
        // Guardrail: Never override or delete manually assigned journeys
        if (assignment.source === "manual") {
          continue;
        }

        const journey = await Journey.findById(assignment.journey?.journeyId);
        if (!journey) continue;

        const targetDept = user.employment?.department;
        const audienceDepts = journey.audience?.departmentNames || [];
        const matchesCurrentDept =
          audienceDepts.length === 0 ||
          (targetDept && audienceDepts.some((d) => d.toLowerCase() === targetDept.toLowerCase()));

        if (!matchesCurrentDept) {
          const completion = assignment.progress?.completionPercentage || 0;
          if (completion < 20) {
            // Safely archive / expire legacy assignment
            assignment.status = "expired";
            await assignment.save();

            // Re-evaluate departmental rules via Workflow Engine
            await workflowEngine.processEvent(
              organizationId,
              "user_created",
              employeeId,
              event.payload || {}
            );

            await notificationService.createNotification({
              organizationId,
              recipientUserId: employeeId,
              type: "announcement",
              channel: "in_app",
              title: "Onboarding Roadmap Updated",
              message: `Your onboarding journey has been re-routed to match your new department (${targetDept || "General"}).`,
              priority: "high",
            });
          } else {
            await notificationService.createNotification({
              organizationId,
              recipientUserId: employeeId,
              type: "announcement",
              channel: "in_app",
              title: "Department Updated",
              message: `Department changed to ${targetDept || "General"}. Your active onboarding journey was retained (${completion}% complete).`,
              priority: "medium",
            });
          }
        }
      }
    } catch (err: any) {
      console.warn("[EventSubscribers] Dynamic re-evaluation failed:", err.message);
    }
  };

  eventBus.subscribe("USER_DEPARTMENT_CHANGED", handleProfileReEvaluation);
  eventBus.subscribe("USER_ROLE_CHANGED", handleProfileReEvaluation);
  eventBus.subscribe("employee.profile_updated" as any, handleProfileReEvaluation);

  // =========================================================================
  // AUTONOMOUS COMPLIANCE & CRYPTOGRAPHIC TASK VERIFICATION SENTINEL
  // =========================================================================

  // Listener for DOCUMENT_SIGNED cryptographic compliance verification
  eventBus.subscribe("DOCUMENT_SIGNED", async (event) => {
    try {
      const organizationId = event.organizationId;
      const { templateId, employeeId, recipientUserId, signatureHash, templateTitle } = event.payload || {};
      const targetEmpId = employeeId || recipientUserId || event.actorId;

      if (!organizationId || !targetEmpId || !templateId) {
        return;
      }

      // Find correlating tasks where autoVerification is enabled for document_signed matching templateId
      const matchingTasks = await Task.find({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        $or: [
          { employeeId: new mongoose.Types.ObjectId(targetEmpId) },
          { assignedToUserId: new mongoose.Types.ObjectId(targetEmpId) },
        ],
        "autoVerification.enabled": true,
        "autoVerification.ruleType": "document_signed",
        "autoVerification.linkedEntityId": new mongoose.Types.ObjectId(templateId),
        status: { $in: ["pending", "in_progress", "completed", "needs_review"] },
        isDeleted: false,
      });

      if (!matchingTasks || matchingTasks.length === 0) {
        return;
      }

      // Cryptographic SHA-256 verification (strictly 64 hex characters)
      const isValidSha256 =
        typeof signatureHash === "string" &&
        signatureHash.trim().length === 64 &&
        /^[a-fA-F0-9]{64}$/.test(signatureHash.trim());

      for (const task of matchingTasks) {
        if (!isValidSha256) {
          // Anomaly Quarantine: Suppress auto-verification, flag task with needs_review and alert manager
          const diagnosticReason = `Cryptographic signature anomaly: Invalid or missing SHA-256 digest ("${signatureHash || "empty"}") for template "${templateTitle || templateId}".`;

          await taskService.flagTaskForReview(task._id, organizationId, diagnosticReason);

          const employee = await User.findById(targetEmpId);
          const managerId = employee?.employment?.managerId || (employee?.employment as any)?.managerUserId;

          if (managerId) {
            await notificationService.createNotification({
              organizationId,
              recipientUserId: managerId,
              type: "journey_overdue",
              channel: "in_app",
              title: "Task Verification Anomaly Alert",
              message: `Task "${task.title}" for ${employee?.profile?.firstName || "Employee"} was quarantined: ${diagnosticReason}`,
              priority: "critical",
              data: {
                taskId: task._id.toString(),
                employeeId: targetEmpId.toString(),
                quarantineReason: diagnosticReason,
              },
            });
          }
        } else {
          // Autonomous Verification: Confirmed cryptographic evidence
          const auditNote = `Autonomous Verification: Cryptographically confirmed via SHA-256 signature hash (${signatureHash})`;

          await taskService.autoVerifyTask(task._id, organizationId, {
            note: auditNote,
            signatureHash,
          });

          await notificationService.createNotification({
            organizationId,
            recipientUserId: targetEmpId,
            type: "announcement",
            channel: "in_app",
            title: "Compliance Task Verified",
            message: `Task "${task.title}" has been autonomously verified via cryptographic signature checksum.`,
            priority: "medium",
            data: {
              taskId: task._id.toString(),
              signatureHash,
            },
          });
        }
      }
    } catch (err: any) {
      console.warn("[EventSubscribers] Autonomous document verification failed:", err.message);
    }
  });

  // Listener for QUIZ_COMPLETED and LMS_PROGRESS_UPDATED assessment verification
  const handleQuizOrLmsCompletion = async (event: any) => {
    try {
      const organizationId = event.organizationId;
      const { employeeId, userId, quizId, courseId, score, scorePercent, scorePercentage, passingScore } =
        event.payload || {};
      const targetEmpId = employeeId || userId || event.actorId;
      const targetEntityId = quizId || courseId || event.entityId;
      const finalScore = Number(scorePercent ?? scorePercentage ?? score ?? 0);

      if (!organizationId || !targetEmpId || !targetEntityId) {
        return;
      }

      // Find correlating tasks with quiz_passed or course_completed
      const matchingTasks = await Task.find({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        $or: [
          { employeeId: new mongoose.Types.ObjectId(targetEmpId) },
          { assignedToUserId: new mongoose.Types.ObjectId(targetEmpId) },
        ],
        "autoVerification.enabled": true,
        "autoVerification.ruleType": { $in: ["quiz_passed", "course_completed"] },
        "autoVerification.linkedEntityId": new mongoose.Types.ObjectId(targetEntityId),
        status: { $in: ["pending", "in_progress", "completed"] },
        isDeleted: false,
      });

      for (const task of matchingTasks) {
        const minPassingScore = task.autoVerification?.minScorePercent ?? Number(passingScore ?? 80);

        if (finalScore >= minPassingScore) {
          const auditNote = `Autonomous Verification: Confirmed passing score ${finalScore}% >= ${minPassingScore}%`;

          await taskService.autoVerifyTask(task._id, organizationId, {
            note: auditNote,
            score: finalScore,
          });

          await notificationService.createNotification({
            organizationId,
            recipientUserId: targetEmpId,
            type: "announcement",
            channel: "in_app",
            title: "Assessment Task Verified",
            message: `Task "${task.title}" verified automatically with score ${finalScore}%.`,
            priority: "medium",
            data: {
              taskId: task._id.toString(),
              score: finalScore,
            },
          });
        }
      }
    } catch (err: any) {
      console.warn("[EventSubscribers] Autonomous assessment verification failed:", err.message);
    }
  };

  eventBus.subscribe("QUIZ_COMPLETED", handleQuizOrLmsCompletion);
  eventBus.subscribe("LMS_PROGRESS_UPDATED", handleQuizOrLmsCompletion);

  console.log("[EventSubscribers] Registered platform event listeners.");
}

export default registerEventSubscribers;
