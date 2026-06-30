import EmployeeAssignmentRepository, { AssignmentFilter, PaginationOptions } from "../repositories/assignment.repository.js";
import { IQuizAttempt } from "../models/assignment.model.js";
import { Journey } from "../../journeys/models/journey.model.js";
import { NotificationService } from "../../notifications/services/notification.service.js";
import { NotificationRepository } from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";

export class EmployeeAssignmentService {
  constructor(private readonly repository: EmployeeAssignmentRepository) {}

  async assignJourney(
    orgId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId,
    assignedBy: string | mongoose.Types.ObjectId,
    assignmentData: { dueDate?: Date; priority?: "low" | "normal" | "high" | "critical" },
    enforcePublicCheck = false
  ) {
    const journey = await Journey.findOne({ _id: journeyId, organizationId: orgId, isDeleted: false });
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Journey not found");
    }
    if (journey.publishing.status !== "published") {
      throw new AppError(400, "BAD_REQUEST", "Cannot assign a journey that is not published.");
    }

    if (enforcePublicCheck && (!journey.audience || !journey.audience.isPublic)) {
      throw new AppError(403, "FORBIDDEN", "Cannot self-assign a private journey.");
    }

    // Check if already assigned and not completed
    const existing = await this.repository.find(
      {
        organizationId: orgId,
        employeeId,
        journeyId,
        status: { $in: ["assigned", "in_progress", "overdue"] } as any,
      },
      { page: 1, limit: 1 }
    );
    if (existing.total > 0) {
      throw new AppError(409, "CONFLICT", "This journey is already assigned to this employee.");
    }

    // Initialize progress trees
    let totalLessons = 0;
    const modulesProgress = journey.modules.map((m) => {
      const lessonsProgress = m.lessons.map((l) => {
        totalLessons++;
        const contentBlocksProgress = l.contentBlocks.map((cb) => ({
          blockId: cb._id,
          type: cb.type,
          viewed: false,
          viewedPercentage: 0,
        }));

        return {
          lessonId: l._id,
          title: l.title,
          status: "not_started" as const,
          timeSpentSeconds: 0,
          contentBlocks: contentBlocksProgress,
        };
      });

      return {
        moduleId: m._id,
        title: m.title,
        completed: false,
        lessons: lessonsProgress,
      };
    });

    const newAssignment = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      assignedBy: new mongoose.Types.ObjectId(assignedBy),
      journey: {
        journeyId: journey._id,
        title: journey.title,
        version: journey.publishing.version,
      },
      assignment: {
        assignedAt: new Date(),
        dueDate: assignmentData.dueDate ? new Date(assignmentData.dueDate) : undefined,
        priority: assignmentData.priority || "normal",
      },
      status: "assigned" as const,
      progress: {
        totalModules: journey.modules.length,
        completedModules: 0,
        totalLessons,
        completedLessons: 0,
        completionPercentage: 0,
        totalTimeSpentSeconds: 0,
      },
      modules: modulesProgress,
    };

    // Increment journey analytics assignments
    await Journey.updateOne({ _id: journeyId }, { $inc: { "analytics.totalAssignments": 1 } });

    const doc = await this.repository.create(newAssignment as any);
    await this.updateUserStatistics(employeeId);

    // Create Audit Log for assignment
    try {
      const AuditLog = mongoose.model("AuditLog");
      const employee = await mongoose.model("User").findById(employeeId);
      const actorName = employee ? `${employee.profile.firstName} ${employee.profile.lastName}` : "Employee";
      await AuditLog.create({
        organizationId: orgId,
        actorUserId: employeeId,
        actorType: "user",
        eventCategory: "assignment",
        eventType: "journey.assigned",
        resourceType: "journey",
        resourceId: journeyId,
        action: "assign",
        description: "was assigned journey",
        metadata: {
          journeyTitle: journey.title,
          targetEmployeeName: actorName
        },
        severity: "info"
      });
    } catch (err) {
      console.error("Failed to log journey assignment audit log:", err);
    }

    // Send assignment notification
    try {
      const notificationService = new NotificationService(new NotificationRepository());
      await notificationService.notifyJourneyAssignment(orgId, employeeId, journey.title, doc._id as any, journeyId);
    } catch (e) {
      console.error("Failed to dispatch assignment notification:", e);
    }

    return doc;
  }

  async getAssignment(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const assignment = await this.repository.findByIdAndOrg(id, orgId);
    if (!assignment) {
      throw new AppError(404, "NOT_FOUND", "Assignment not found");
    }
    return assignment;
  }

  async startAssignment(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const assignment = await this.getAssignment(id, orgId);
    if (assignment.status === "assigned") {
      assignment.status = "in_progress";
      assignment.progress.lastActivityAt = new Date();
      await assignment.save();
      await this.updateUserStatistics(assignment.employeeId);

      // Create Audit Log for starting assignment
      try {
        const AuditLog = mongoose.model("AuditLog");
        const employee = await mongoose.model("User").findById(assignment.employeeId);
        const employeeName = employee ? `${employee.profile.firstName} ${employee.profile.lastName}` : "Employee";
        await AuditLog.create({
          organizationId: orgId,
          actorUserId: assignment.employeeId,
          actorType: "user",
          eventCategory: "assignment",
          eventType: "journey.started",
          resourceType: "journey",
          resourceId: assignment.journey.journeyId,
          action: "update",
          description: `started journey "${assignment.journey.title}"`,
          metadata: {
            journeyTitle: assignment.journey.title
          },
          severity: "info"
        });
      } catch (err) {
        console.error("Failed to log start assignment audit log:", err);
      }
    }
    return assignment;
  }

  async completeLesson(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    moduleId: string,
    lessonId: string,
    timeSpentSeconds: number,
    completedBlockIds: string[]
  ) {
    const assignment = await this.getAssignment(id, orgId);
    if (assignment.status === "assigned") {
      assignment.status = "in_progress";
    }

    const modProg = assignment.modules.find((m) => m.moduleId.toString() === moduleId);
    if (!modProg) throw new AppError(404, "NOT_FOUND", "Module not found in assignment");

    const lesProg = modProg.lessons.find((l) => l.lessonId.toString() === lessonId);
    if (!lesProg) throw new AppError(404, "NOT_FOUND", "Lesson not found in module");

    // Update time spent
    lesProg.timeSpentSeconds += timeSpentSeconds;
    assignment.progress.totalTimeSpentSeconds += timeSpentSeconds;

    // Fetch original journey for rules
    const journey = await Journey.findOne({ _id: assignment.journey.journeyId, isDeleted: false });
    if (!journey) throw new AppError(404, "NOT_FOUND", "Original journey not found");

    const origMod = journey.modules.find((m) => m._id.toString() === moduleId);
    const origLes = origMod?.lessons.find((l) => l._id.toString() === lessonId);
    if (!origLes) throw new AppError(404, "NOT_FOUND", "Original lesson definition not found");

    // Update content blocks progress
    for (const block of lesProg.contentBlocks) {
      if (completedBlockIds.includes(block.blockId.toString())) {
        block.viewed = true;
        block.viewedPercentage = 100;
        if (!block.completedAt) {
          block.completedAt = new Date();
        }
      }
    }

    // Evaluate lesson completion
    let contentCompleted = true;
    if (origLes.completionRules.requireContentCompletion) {
      contentCompleted = lesProg.contentBlocks.every((b) => b.viewed);
    }

    let quizCompleted = true;
    if (origLes.completionRules.requireQuizCompletion) {
      quizCompleted = !!lesProg.quizAttempt?.passed;
    }

    if (contentCompleted && quizCompleted) {
      if (lesProg.status !== "completed") {
        lesProg.status = "completed";
        lesProg.completedAt = new Date();
        assignment.progress.completedLessons++;
      }
    } else {
      lesProg.status = "in_progress";
    }

    // Evaluate module completion
    const allLessonsCompleted = modProg.lessons.every((l) => l.status === "completed");
    if (allLessonsCompleted && !modProg.completed) {
      modProg.completed = true;
      modProg.completedAt = new Date();
      assignment.progress.completedModules++;
    }

    // Calculate progression percentage
    const totalLessons = assignment.progress.totalLessons || 1;
    assignment.progress.completionPercentage = Math.round(
      (assignment.progress.completedLessons / totalLessons) * 100
    );
    assignment.progress.lastActivityAt = new Date();

    // Check overall completion
    await this.checkOverallCompletion(assignment, journey);

    await assignment.save();
    await this.updateUserStatistics(assignment.employeeId);

    // Create Audit Log for lesson completion
    try {
      const AuditLog = mongoose.model("AuditLog");
      const employee = await mongoose.model("User").findById(assignment.employeeId);
      const employeeName = employee ? `${employee.profile.firstName} ${employee.profile.lastName}` : "Employee";
      
      const mod = assignment.modules.find((m: any) => m._id.toString() === moduleId.toString());
      const les = mod?.lessons.find((l: any) => l._id.toString() === lessonId.toString());
      const lessonTitle = les?.title || "Lesson";

      await AuditLog.create({
        organizationId: orgId,
        actorUserId: assignment.employeeId,
        actorType: "user",
        eventCategory: "content",
        eventType: "lesson.completed",
        resourceType: "lesson",
        resourceId: lessonId,
        action: "complete",
        description: `completed lesson "${lessonTitle}"`,
        metadata: {
          journeyTitle: assignment.journey.title
        },
        severity: "info"
      });
    } catch (err) {
      console.error("Failed to log complete lesson audit log:", err);
    }

    return assignment;
  }

  async submitQuiz(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    moduleId: string,
    lessonId: string,
    submittedAnswers: Array<{ questionId: string; selectedOptions: string[] }>
  ) {
    const assignment = await this.getAssignment(id, orgId);
    if (assignment.status === "assigned") {
      assignment.status = "in_progress";
    }

    const modProg = assignment.modules.find((m) => m.moduleId.toString() === moduleId);
    if (!modProg) throw new AppError(404, "NOT_FOUND", "Module not found in assignment");

    const lesProg = modProg.lessons.find((l) => l.lessonId.toString() === lessonId);
    if (!lesProg) throw new AppError(404, "NOT_FOUND", "Lesson not found in module");

    // Fetch original quiz definition
    const journey = await Journey.findOne({ _id: assignment.journey.journeyId, isDeleted: false });
    if (!journey) throw new AppError(404, "NOT_FOUND", "Original journey not found");

    const origMod = journey.modules.find((m) => m._id.toString() === moduleId);
    const origLes = origMod?.lessons.find((l) => l._id.toString() === lessonId);
    if (!origLes || !origLes.quiz) throw new AppError(404, "NOT_FOUND", "Quiz definition not found for this lesson");

    const quiz = origLes.quiz;
    let totalPoints = 0;
    let pointsEarned = 0;

    const answersDetail = quiz.questions.map((question) => {
      totalPoints += question.points;
      const submitted = submittedAnswers.find((sa) => sa.questionId === question._id.toString());
      const selectedOpts = submitted ? submitted.selectedOptions : [];

      const correctOptIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o._id.toString());

      // Validate correctness: all correct options selected, and no incorrect options selected
      const isCorrect =
        correctOptIds.length === selectedOpts.length &&
        correctOptIds.every((id) => selectedOpts.includes(id));

      const questionPointsEarned = isCorrect ? question.points : 0;
      pointsEarned += questionPointsEarned;

      return {
        questionId: question._id,
        selectedOptions: selectedOpts.map((o) => new mongoose.Types.ObjectId(o)),
        correct: isCorrect,
        pointsEarned: questionPointsEarned,
      };
    });

    const score = totalPoints > 0 ? Math.round((pointsEarned / totalPoints) * 100) : 100;
    const passed = score >= quiz.passingScore;

    // Track attempt number
    const currentAttemptNum = (lesProg.quizAttempt?.attemptNumber || 0) + 1;

    const attempt: IQuizAttempt = {
      attemptNumber: currentAttemptNum,
      startedAt: lesProg.quizAttempt?.startedAt || new Date(),
      submittedAt: new Date(),
      score,
      passed,
      answers: answersDetail,
    };

    lesProg.quizAttempt = attempt;

    // Re-evaluate lesson completion with quiz rules
    let contentCompleted = true;
    if (origLes.completionRules.requireContentCompletion) {
      contentCompleted = lesProg.contentBlocks.every((b) => b.viewed);
    }

    if (contentCompleted && passed) {
      if (lesProg.status !== "completed") {
        lesProg.status = "completed";
        lesProg.completedAt = new Date();
        assignment.progress.completedLessons++;
      }
    }

    // Evaluate module completion
    const allLessonsCompleted = modProg.lessons.every((l) => l.status === "completed");
    if (allLessonsCompleted && !modProg.completed) {
      modProg.completed = true;
      modProg.completedAt = new Date();
      assignment.progress.completedModules++;
    }

    // Recalculate percentage
    const totalLessons = assignment.progress.totalLessons || 1;
    assignment.progress.completionPercentage = Math.round(
      (assignment.progress.completedLessons / totalLessons) * 100
    );
    assignment.progress.lastActivityAt = new Date();

    // Check overall completion
    await this.checkOverallCompletion(assignment, journey);

    await assignment.save();
    await this.updateUserStatistics(assignment.employeeId);

    // Create Audit Log for quiz submission
    try {
      const AuditLog = mongoose.model("AuditLog");
      const employee = await mongoose.model("User").findById(assignment.employeeId);
      const employeeName = employee ? `${employee.profile.firstName} ${employee.profile.lastName}` : "Employee";
      
      const mod = assignment.modules.find((m: any) => m._id.toString() === moduleId.toString());
      const les = mod?.lessons.find((l: any) => l._id.toString() === lessonId.toString());
      const quizTitle = les?.title || "Quiz";

      await AuditLog.create({
        organizationId: orgId,
        actorUserId: assignment.employeeId,
        actorType: "user",
        eventCategory: "content",
        eventType: "quiz.submitted",
        resourceType: "lesson",
        resourceId: lessonId,
        action: "complete",
        description: `${passed ? "passed" : "failed"} the quiz "${quizTitle}"`,
        metadata: {
          journeyTitle: assignment.journey.title,
          score,
          passed
        },
        severity: passed ? "info" : "warning"
      });
    } catch (err) {
      console.error("Failed to log submit quiz audit log:", err);
    }

    return { passed, score, attempt };
  }

  private async checkOverallCompletion(assignment: any, journey: any) {
    const allModulesCompleted = assignment.modules.every((m: any) => m.completed);
    if (allModulesCompleted && assignment.status !== "completed") {
      assignment.status = "completed";
      assignment.completedAt = new Date();

      if (journey.certificate?.enabled) {
        assignment.certificate = {
          issued: true,
          issuedAt: new Date(),
          certificateId: new mongoose.Types.ObjectId(), // Generate certificate ID reference
        };
      }

      // Update journey completions analytics
      await Journey.updateOne(
        { _id: journey._id },
        {
          $inc: { "analytics.totalCompletions": 1 },
        }
      );

      // Send completion notification
      try {
        const notificationService = new NotificationService(new NotificationRepository());
        
        // Fetch employee details to get their full name and manager
        const employee = await mongoose.model("User").findById(assignment.employeeId);
        const employeeName = employee ? `${employee.profile.firstName} ${employee.profile.lastName}` : "Employee";
        
        await notificationService.notifyJourneyCompletion(
          assignment.organizationId,
          assignment.employeeId,
          employeeName,
          journey.title,
          assignment._id as any,
          journey._id,
          employee?.employment?.managerId
        );
      } catch (e) {
        console.error("Failed to dispatch completion notification:", e);
      }
    }
  }

  async listAssignments(filter: AssignmentFilter, pagination: PaginationOptions) {
    return this.repository.find(filter, pagination);
  }

  private async updateUserStatistics(employeeId: mongoose.Types.ObjectId | string) {
    const userId = new mongoose.Types.ObjectId(employeeId.toString());
    const EmployeeAssignment = mongoose.model("EmployeeAssignment");
    const assignments = await EmployeeAssignment.find({ employeeId: userId });
    
    const assignedJourneys = assignments.length;
    const completedJourneys = assignments.filter((a: any) => a.status === "completed").length;
    const certificates = assignments.filter((a: any) => a.certificate?.issued).length;
    const completionRate = assignedJourneys > 0
      ? Math.round(assignments.reduce((sum: number, a: any) => sum + (a.progress?.completionPercentage || 0), 0) / assignedJourneys)
      : 0;

    await mongoose.model("User").updateOne(
      { _id: userId },
      {
        $set: {
          "statistics.assignedJourneys": assignedJourneys,
          "statistics.completedJourneys": completedJourneys,
          "statistics.certificates": certificates,
          "statistics.completionRate": completionRate,
        }
      }
    );
  }
}

export default EmployeeAssignmentService;
