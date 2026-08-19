import Assignment from "../../modules/assignments/models/assignment.model.js";
import User from "../../modules/auth/models/user.model.js";
import Journey from "../../modules/journeys/models/journey.model.js";
import Task from "../../modules/tasks/models/task.model.js";
import eventBus from "../events/event-bus.js";
import queueService from "../queue/queue.service.js";

export class SchedulerService {
  private static instance: SchedulerService;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  public start(intervalMs = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Register queue workers for scheduled jobs
    queueService.registerWorker("scan_overdue_assignments", async () => {
      await this.scanOverdueAssignments();
    });

    queueService.registerWorker("scan_compliance_due_alerts", async () => {
      await this.scanComplianceAlerts();
    });

    queueService.registerWorker("scan_overdue_tasks", async () => {
      await this.scanOverdueTasks();
    });

    this.timer = setInterval(async () => {
      try {
        await this.triggerScan();
      } catch (err) {
        console.error("[SchedulerService] Error in scheduled run:", err);
      }
    }, intervalMs);

    console.log(`[SchedulerService] Scheduler started with ${intervalMs}ms interval.`);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[SchedulerService] Scheduler stopped.");
  }

  public async triggerScan(): Promise<void> {
    // Queue background jobs for active orgs
    const activeUsers = await User.find({ "employment.status": { $ne: "inactive" }, isDeleted: false })
      .select("organizationId")
      .distinct("organizationId");

    for (const orgId of activeUsers) {
      await queueService.enqueue(
        "scan_overdue_assignments",
        { organizationId: orgId.toString() },
        {
          organizationId: orgId.toString(),
          idempotencyKey: `scan_overdue_${new Date().toISOString().substring(0, 13)}`, // Once per hour per org
        }
      );

      await queueService.enqueue(
        "scan_compliance_due_alerts",
        { organizationId: orgId.toString() },
        {
          organizationId: orgId.toString(),
          idempotencyKey: `scan_compliance_${new Date().toISOString().substring(0, 13)}`,
        }
      );

      await queueService.enqueue(
        "scan_overdue_tasks",
        { organizationId: orgId.toString() },
        {
          organizationId: orgId.toString(),
          idempotencyKey: `scan_overdue_tasks_${new Date().toISOString().substring(0, 13)}`,
        }
      );
    }
  }

  public async scanOverdueTasks(): Promise<number> {
    const now = new Date();

    const overdueTasks = await Task.find({
      status: { $in: ["pending", "in_progress"] },
      dueDate: { $lt: now },
      isDeleted: false,
    });

    let count = 0;
    for (const task of overdueTasks) {
      task.status = "overdue";
      task.statusHistory.push({
        status: "overdue",
        changedBy: task.assignedToUserId,
        changedAt: now,
        note: "Automatically marked overdue by Scheduler",
      });
      await task.save();
      count++;

      await eventBus.publish({
        eventName: "TASK_OVERDUE",
        organizationId: task.organizationId,
        actorId: task.assignedToUserId,
        entityId: task._id,
        payload: {
          taskId: task._id.toString(),
          title: task.title,
          assignedToUserId: task.assignedToUserId.toString(),
          employeeId: task.employeeId?.toString(),
          dueDate: task.dueDate,
        },
      });
    }

    if (count > 0) {
      console.log(`[SchedulerService] Updated ${count} standalone tasks to OVERDUE.`);
    }
    return count;
  }

  public async scanOverdueAssignments(): Promise<number> {
    const now = new Date();

    // Find assigned/in_progress assignments whose dueDate has passed
    const overdueAssignments = await Assignment.find({
      status: { $in: ["assigned", "in_progress"] },
      "assignment.dueDate": { $lt: now },
      isDeleted: false,
    });

    let count = 0;
    for (const assignment of overdueAssignments) {
      assignment.status = "overdue";
      await assignment.save();
      count++;

      const journey = await Journey.findById(assignment.journey?.journeyId).select("title");
      const journeyTitle = journey ? journey.title : assignment.journey?.title || "Onboarding Journey";

      await eventBus.publish({
        eventName: "JOURNEY_OVERDUE",
        organizationId: assignment.organizationId,
        actorId: assignment.employeeId,
        entityId: assignment._id,
        payload: {
          assignmentId: assignment._id.toString(),
          journeyId: assignment.journey?.journeyId?.toString(),
          employeeId: assignment.employeeId.toString(),
          journeyTitle,
          dueDate: assignment.assignment?.dueDate,
        },
      });
    }

    if (count > 0) {
      console.log(`[SchedulerService] Updated ${count} assignments to OVERDUE.`);
    }
    return count;
  }

  public async scanComplianceAlerts(): Promise<number> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Find assignments due in the next 3 days that are not completed
    const dueSoonAssignments = await Assignment.find({
      status: { $in: ["assigned", "in_progress"] },
      "assignment.dueDate": { $gte: now, $lte: threeDaysFromNow },
      isDeleted: false,
    });

    let count = 0;
    for (const assignment of dueSoonAssignments) {
      count++;
      const journey = await Journey.findById(assignment.journey?.journeyId).select("title");
      const journeyTitle = journey ? journey.title : assignment.journey?.title || "Onboarding Journey";

      await eventBus.publish({
        eventName: "CHECKIN_DUE",
        organizationId: assignment.organizationId,
        actorId: assignment.employeeId,
        entityId: assignment._id,
        payload: {
          assignmentId: assignment._id.toString(),
          journeyId: assignment.journey?.journeyId?.toString(),
          employeeId: assignment.employeeId.toString(),
          journeyTitle,
          dueDate: assignment.assignment?.dueDate,
        },
      });
    }

    return count;
  }
}

export const schedulerService = SchedulerService.getInstance();
export default schedulerService;
