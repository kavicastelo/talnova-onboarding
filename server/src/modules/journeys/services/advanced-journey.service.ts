import mongoose from "mongoose";
import Journey, { IJourney } from "../models/journey.model.js";
import EmployeeAssignment from "../../assignments/models/assignment.model.js";
import User from "../../auth/models/user.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";

const notificationService = new NotificationService(new NotificationRepository());

export class AdvancedJourneyService {
  /**
   * Check if employee fulfills prerequisite journeys (JRN-005)
   */
  async checkJourneyPrerequisites(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId
  ): Promise<{ locked: boolean; pendingPrerequisites: Array<{ _id: string; title: string }> }> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const journeyObjectId = new mongoose.Types.ObjectId(journeyId);

    const journey = await Journey.findOne({
      _id: journeyObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    }).populate("prerequisites", "title");

    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Journey not found");
    }

    if (!journey.prerequisites || journey.prerequisites.length === 0) {
      return { locked: false, pendingPrerequisites: [] };
    }

    const prereqIds = journey.prerequisites.map((p: any) => p._id);

    // Find completed assignments for user
    const completedAssignments = await EmployeeAssignment.find({
      organizationId: orgObjectId,
      employeeId: userObjectId,
      "journey.journeyId": { $in: prereqIds },
      status: "completed",
      isDeleted: { $ne: true },
    }).select("journey");

    const completedJourneySet = new Set(
      completedAssignments
        .map((a) => {
          const id = a.journey?.journeyId;
          return id ? id.toString() : null;
        })
        .filter((id): id is string => Boolean(id))
    );
    const pendingPrerequisites: Array<{ _id: string; title: string }> = [];

    for (const prereq of journey.prerequisites as any[]) {
      if (!completedJourneySet.has(prereq._id.toString())) {
        pendingPrerequisites.push({
          _id: prereq._id.toString(),
          title: prereq.title,
        });
      }
    }

    return {
      locked: pendingPrerequisites.length > 0,
      pendingPrerequisites,
    };
  }

  /**
   * Process Adaptive Branching Rules on Quiz Score (JRN-006)
   */
  async processAdaptiveBranching(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId,
    quizScore: number
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const journeyObjectId = new mongoose.Types.ObjectId(journeyId);

    const journey = await Journey.findOne({
      _id: journeyObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });

    if (!journey || !journey.conditionalBranches || journey.conditionalBranches.length === 0) {
      return null;
    }

    // Find matching branch rule
    const matchingRule = journey.conditionalBranches.find(
      (b) => quizScore >= b.minScore && quizScore <= b.maxScore && b.unlockJourneyId
    );

    if (!matchingRule || !matchingRule.unlockJourneyId) {
      return null;
    }

    // Auto-assign branch journey
    const unlockedJourney = await Journey.findOne({
      _id: matchingRule.unlockJourneyId,
      organizationId: orgObjectId,
      isDeleted: false,
    });

    if (unlockedJourney) {
      // Check existing assignment
      const existing = await EmployeeAssignment.findOne({
        organizationId: orgObjectId,
        employeeId: userObjectId,
        $or: [
          { journeyId: unlockedJourney._id },
          { "journey.journeyId": unlockedJourney._id },
        ],
        isDeleted: false,
      });

      if (!existing) {
        await EmployeeAssignment.create({
          organizationId: orgObjectId,
          employeeId: userObjectId,
          journeyId: unlockedJourney._id,
          journey: {
            journeyId: unlockedJourney._id,
            title: unlockedJourney.title,
            version: unlockedJourney.publishing?.version || 1,
          },
          assignedBy: journey.createdBy,
          assignment: {
            assignedAt: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            priority: "normal",
          },
          status: "assigned",
          progress: {
            totalModules: unlockedJourney.modules?.length || 0,
            completedModules: 0,
            totalLessons: 0,
            completedLessons: 0,
            completionPercentage: 0,
            totalTimeSpentSeconds: 0,
          },
        });

        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: userId,
          type: "journey_assigned",
          title: "Adaptive Learning Path Unlocked!",
          message: matchingRule.message || `Based on your quiz result (${quizScore}%), "${unlockedJourney.title}" has been added to your learning path.`,
          priority: "high",
        });
      }
    }

    return unlockedJourney;
  }

  /**
   * Deep Clone Journey (LMS-001)
   */
  async cloneJourney(
    orgId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const journeyObjectId = new mongoose.Types.ObjectId(journeyId);

    const sourceJourney = await Journey.findOne({
      _id: journeyObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    }).lean();

    if (!sourceJourney) {
      throw new AppError(404, "NOT_FOUND", "Source journey not found");
    }

    const newSlug = `${sourceJourney.slug}-copy-${Date.now()}`;
    const newTitle = `${sourceJourney.title} (Copy)`;

    // Remove _id from source object for clean Mongoose creation
    const { _id, createdAt, updatedAt, ...rest } = sourceJourney as any;

    const clonedJourney = await Journey.create({
      ...rest,
      organizationId: orgObjectId,
      title: newTitle,
      slug: newSlug,
      publishing: {
        status: "draft",
        version: 1,
      },
      analytics: {
        totalAssignments: 0,
        totalCompletions: 0,
        completionRate: 0,
        averageScore: 0,
        averageDurationMinutes: 0,
      },
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    return clonedJourney;
  }

  /**
   * Reorder Modules & Lessons (LMS-001)
   */
  async reorderCurriculum(
    orgId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId,
    moduleOrders: Array<{ moduleId: string; order: number; lessonOrders?: Array<{ lessonId: string; order: number }> }>
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const journeyObjectId = new mongoose.Types.ObjectId(journeyId);

    const journey = await Journey.findOne({
      _id: journeyObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });

    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Journey not found");
    }

    const orderMap = new Map(moduleOrders.map((m) => [m.moduleId, m]));

    journey.modules.forEach((mod) => {
      const match = orderMap.get(mod._id.toString());
      if (match) {
        mod.order = match.order;
        if (match.lessonOrders) {
          const lessonOrderMap = new Map(match.lessonOrders.map((l) => [l.lessonId, l.order]));
          mod.lessons.forEach((les) => {
            const lMatch = lessonOrderMap.get(les._id.toString());
            if (lMatch !== undefined) {
              les.order = lMatch;
            }
          });
          mod.lessons.sort((a, b) => a.order - b.order);
        }
      }
    });

    journey.modules.sort((a, b) => a.order - b.order);
    await journey.save();

    return journey;
  }

  /**
   * Dispatch Automated Learning Reminders (LMS-002)
   */
  async dispatchLearningReminders(orgId: string | mongoose.Types.ObjectId): Promise<number> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const now = new Date();

    const pendingAssignments = await EmployeeAssignment.find({
      organizationId: orgObjectId,
      status: { $in: ["assigned", "in_progress"] },
      "assignment.dueDate": { $exists: true },
      isDeleted: false,
    });

    let count = 0;
    for (const assignment of pendingAssignments) {
      if (!assignment.assignment?.dueDate) continue;
      const dueDate = new Date(assignment.assignment.dueDate);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

      // Remind if due in <= 3 days or overdue
      if (diffDays <= 3) {
        const journeyTitle = assignment.journey?.title || "Onboarding Journey";
        const message =
          diffDays < 0
            ? `Your learning assignment "${journeyTitle}" is overdue by ${Math.abs(diffDays)} day(s). Please complete your modules.`
            : `Reminder: Your learning assignment "${journeyTitle}" is due in ${diffDays} day(s).`;

        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: assignment.employeeId,
          type: "journey_assigned",
          title: "Learning Progress Reminder",
          message,
          priority: diffDays < 0 ? "high" : "medium",
        });
        count++;
      }
    }

    return count;
  }
}

export const advancedJourneyService = new AdvancedJourneyService();
export default advancedJourneyService;
