import mongoose from "mongoose";
import { User } from "../../auth/models/user.model.js";
import { EmployeeAssignment } from "../../assignments/models/assignment.model.js";
import { Organization } from "../../organizations/models/organization.model.js";
import { Journey } from "../../journeys/models/journey.model.js";
import ScheduledReport from "../models/scheduled-report.model.js";

export class AnalyticsService {
  async getSummary(orgId: string | mongoose.Types.ObjectId) {
    const objectIdOrgId = new mongoose.Types.ObjectId(orgId.toString());

    // 1. Average Completion Rate
    const avgCompletion = await EmployeeAssignment.aggregate([
      { $match: { organizationId: objectIdOrgId } },
      { $group: { _id: null, avgRate: { $avg: "$progress.completionPercentage" } } }
    ]);
    const avgCompletionRate = avgCompletion.length ? Math.round(avgCompletion[0].avgRate) : 0;

    // Calculate Completion Rate Delta (Current Month vs Previous Month)
    const startOfCurrentMonth = new Date();
    startOfCurrentMonth.setDate(1);
    startOfCurrentMonth.setHours(0, 0, 0, 0);

    const startOfPreviousMonth = new Date(startOfCurrentMonth);
    startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1);

    const currentMonthAvg = await EmployeeAssignment.aggregate([
      {
        $match: {
          organizationId: objectIdOrgId,
          updatedAt: { $gte: startOfCurrentMonth }
        }
      },
      { $group: { _id: null, avgRate: { $avg: "$progress.completionPercentage" } } }
    ]);

    const previousMonthAvg = await EmployeeAssignment.aggregate([
      {
        $match: {
          organizationId: objectIdOrgId,
          updatedAt: {
            $gte: startOfPreviousMonth,
            $lt: startOfCurrentMonth
          }
        }
      },
      { $group: { _id: null, avgRate: { $avg: "$progress.completionPercentage" } } }
    ]);

    const curAvg = currentMonthAvg.length ? currentMonthAvg[0].avgRate : 0;
    const prevAvg = previousMonthAvg.length ? previousMonthAvg[0].avgRate : 0;
    const diff = curAvg - prevAvg;
    const avgCompletionRateDelta = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;

    // 2. Active Learners
    const totalUsers = await User.countDocuments({ organizationId: objectIdOrgId, isDeleted: false });
    const activeLearners = await User.countDocuments({
      organizationId: objectIdOrgId,
      isDeleted: false,
      "employment.status": { $in: ["active", "onboarding"] }
    });
    const activeLearnersPercent = totalUsers > 0 ? `${Math.round((activeLearners / totalUsers) * 100)}%` : "100%";

    // 3. Learning Hours
    const timeSpent = await EmployeeAssignment.aggregate([
      { $match: { organizationId: objectIdOrgId } },
      { $group: { _id: null, totalSeconds: { $sum: "$progress.totalTimeSpentSeconds" } } }
    ]);
    const totalSeconds = timeSpent.length ? timeSpent[0].totalSeconds : 0;
    const learningHours = Math.round(totalSeconds / 3600) || 0;
    const avgHrsPerWeek = activeLearners > 0 ? (learningHours / activeLearners).toFixed(1) : "0.0";
    const learningHoursAverage = `${avgHrsPerWeek} hrs/learner`;

    // 4. Certificates Issued
    const certificatesIssued = await EmployeeAssignment.countDocuments({
      organizationId: objectIdOrgId,
      "certificate.issued": true
    });

    const certsCurrentMonth = await EmployeeAssignment.countDocuments({
      organizationId: objectIdOrgId,
      "certificate.issued": true,
      "certificate.issuedAt": { $gte: startOfCurrentMonth }
    });
    const certsPreviousMonth = await EmployeeAssignment.countDocuments({
      organizationId: objectIdOrgId,
      "certificate.issued": true,
      "certificate.issuedAt": {
        $gte: startOfPreviousMonth,
        $lt: startOfCurrentMonth
      }
    });
    let certificatesIssuedDelta = "+0%";
    if (certsPreviousMonth > 0) {
      const pct = ((certsCurrentMonth - certsPreviousMonth) / certsPreviousMonth) * 100;
      certificatesIssuedDelta = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    } else if (certsCurrentMonth > 0) {
      certificatesIssuedDelta = `+${certsCurrentMonth} new`;
    }

    // 5. Completion Trend (Last 6 Months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const trendData = await EmployeeAssignment.aggregate([
      {
        $match: {
          organizationId: objectIdOrgId,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          avgRate: { $avg: "$progress.completionPercentage" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const completionTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const name = monthNames[d.getMonth()];

      const match = trendData.find((t) => t._id.year === year && t._id.month === month);
      completionTrend.push({
        name,
        rate: match ? Math.round(match.avgRate) : 0
      });
    }

    // 6. Department Completions
    const deptCompletions = await EmployeeAssignment.aggregate([
      {
        $match: {
          organizationId: objectIdOrgId,
          status: "completed"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee"
        }
      },
      { $unwind: "$employee" },
      {
        $group: {
          _id: "$employee.employment.departmentId",
          completionsCount: { $sum: 1 }
        }
      }
    ]);

    const org = await Organization.findById(objectIdOrgId);
    const departments = org?.departments || [];

    const departmentCompletions = departments.map((d) => {
      const match = deptCompletions.find((dc) => dc._id && dc._id.toString() === d._id.toString());
      return {
        name: d.name,
        completions: match ? match.completionsCount : 0
      };
    });

    // 7. Journey-wise Completion Rates
    const journeys = await Journey.find({ organizationId: objectIdOrgId, isDeleted: false });
    const journeyCompletionRates = [];

    for (const journey of journeys) {
      const assignments = await EmployeeAssignment.find({
        organizationId: objectIdOrgId,
        "journey.journeyId": journey._id
      });

      const totalAssignments = assignments.length;
      const totalCompletions = assignments.filter((a) => a.status === "completed").length;
      const completionRate = totalAssignments > 0 ? Math.round((totalCompletions / totalAssignments) * 100) : 0;

      // Calculate average quiz score across all quiz attempts in these assignments
      let totalScoresSum = 0;
      let quizAttemptsCount = 0;

      for (const assignment of assignments) {
        if (assignment.modules) {
          for (const m of assignment.modules) {
            if (m.lessons) {
              for (const l of m.lessons) {
                if (l.quizAttempt && typeof l.quizAttempt.score === 'number') {
                  totalScoresSum += l.quizAttempt.score;
                  quizAttemptsCount++;
                }
              }
            }
          }
        }
      }

      const averageScore = quizAttemptsCount > 0 ? Math.round(totalScoresSum / quizAttemptsCount) : 0;

      journeyCompletionRates.push({
        id: journey._id.toString(),
        title: journey.title,
        category: journey.category || "General",
        totalAssignments,
        totalCompletions,
        completionRate,
        averageScore
      });
    }

    return {
      avgCompletionRate,
      avgCompletionRateDelta,
      activeLearners,
      activeLearnersPercent,
      learningHours,
      learningHoursAverage,
      certificatesIssued,
      certificatesIssuedDelta,
      completionTrend,
      departmentCompletions,
      journeyCompletionRates
    };
  }

  /**
   * Time-to-Completion & Cohort Velocity Analytics (ANA-001)
   */
  async getTimeToCompletionMetrics(orgId: string | mongoose.Types.ObjectId) {
    const objectIdOrgId = new mongoose.Types.ObjectId(orgId.toString());

    const completedAssignments = await EmployeeAssignment.find({
      organizationId: objectIdOrgId,
      status: "completed",
      completedAt: { $exists: true },
      isDeleted: { $ne: true },
    });

    if (completedAssignments.length === 0) {
      return {
        averageCompletionDays: 0,
        fastestCompletionDays: 0,
        slowestCompletionDays: 0,
        totalCompletedAssignments: 0,
      };
    }

    let totalMs = 0;
    let minMs = Infinity;
    let maxMs = 0;

    for (const a of completedAssignments) {
      const assignedAt = a.assignment?.assignedAt ? new Date(a.assignment.assignedAt).getTime() : new Date(a.createdAt).getTime();
      const completedAt = new Date(a.completedAt!).getTime();
      const durationMs = Math.max(0, completedAt - assignedAt);

      totalMs += durationMs;
      if (durationMs < minMs) minMs = durationMs;
      if (durationMs > maxMs) maxMs = durationMs;
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const averageCompletionDays = Math.round((totalMs / completedAssignments.length / msPerDay) * 10) / 10;
    const fastestCompletionDays = Math.round((minMs / msPerDay) * 10) / 10;
    const slowestCompletionDays = Math.round((maxMs / msPerDay) * 10) / 10;

    return {
      averageCompletionDays,
      fastestCompletionDays,
      slowestCompletionDays: slowestCompletionDays === Infinity ? 0 : slowestCompletionDays,
      totalCompletedAssignments: completedAssignments.length,
    };
  }

  /**
   * Module & Quiz Bottleneck Analytics + Difficult Question Analysis (ANA-002, ANA-003)
   */
  async getQuizAndModuleBottlenecks(orgId: string | mongoose.Types.ObjectId) {
    const objectIdOrgId = new mongoose.Types.ObjectId(orgId.toString());

    const assignments = await EmployeeAssignment.find({
      organizationId: objectIdOrgId,
      isDeleted: { $ne: true },
    });

    const moduleStatsMap = new Map<string, { title: string; attempts: number; passes: number; totalScore: number }>();
    const questionStatsMap = new Map<string, { questionText: string; attempts: number; incorrect: number }>();

    for (const a of assignments) {
      if (a.modules) {
        for (const m of a.modules) {
          const modKey = m.moduleId.toString();
          if (!moduleStatsMap.has(modKey)) {
            moduleStatsMap.set(modKey, { title: m.title, attempts: 0, passes: 0, totalScore: 0 });
          }

          const mStats = moduleStatsMap.get(modKey)!;

          if (m.lessons) {
            for (const l of m.lessons) {
              if (l.quizAttempt) {
                mStats.attempts++;
                mStats.totalScore += l.quizAttempt.score || 0;
                if (l.quizAttempt.passed) mStats.passes++;

                if (l.quizAttempt.answers) {
                  for (const ans of l.quizAttempt.answers) {
                    const qKey = ans.questionId.toString();
                    if (!questionStatsMap.has(qKey)) {
                      questionStatsMap.set(qKey, { questionText: `Question ${qKey.slice(-6)}`, attempts: 0, incorrect: 0 });
                    }
                    const qStats = questionStatsMap.get(qKey)!;
                    qStats.attempts++;
                    if (!ans.correct) qStats.incorrect++;
                  }
                }
              }
            }
          }
        }
      }
    }

    const moduleBottlenecks = Array.from(moduleStatsMap.entries())
      .map(([id, stats]) => ({
        moduleId: id,
        title: stats.title,
        attempts: stats.attempts,
        passRate: stats.attempts > 0 ? Math.round((stats.passes / stats.attempts) * 100) : 100,
        averageScore: stats.attempts > 0 ? Math.round(stats.totalScore / stats.attempts) : 0,
      }))
      .sort((a, b) => a.passRate - b.passRate);

    const difficultQuestions = Array.from(questionStatsMap.entries())
      .map(([id, stats]) => ({
        questionId: id,
        questionText: stats.questionText,
        attempts: stats.attempts,
        incorrectRate: stats.attempts > 0 ? Math.round((stats.incorrect / stats.attempts) * 100) : 0,
      }))
      .sort((a, b) => b.incorrectRate - a.incorrectRate)
      .slice(0, 10);

    return {
      moduleBottlenecks,
      difficultQuestions,
    };
  }

  /**
   * Export CSV Raw Compliance Data (ANA-006)
   */
  async exportAnalyticsCSV(orgId: string | mongoose.Types.ObjectId): Promise<string> {
    const objectIdOrgId = new mongoose.Types.ObjectId(orgId.toString());

    const assignments = await EmployeeAssignment.find({
      organizationId: objectIdOrgId,
      isDeleted: { $ne: true },
    }).populate("employeeId", "profile auth employment");

    const lines = ["Employee Name,Email,Department,Journey Title,Status,Completion %,Assigned Date,Completed Date"];

    for (const a of assignments) {
      const emp = a.employeeId as any;
      const empName = emp?.profile ? `${emp.profile.firstName} ${emp.profile.lastName}` : "Unknown";
      const email = emp?.auth?.email || "";
      const dept = emp?.employment?.department || "Unassigned";
      const title = a.journey?.title || "Journey";
      const status = a.status;
      const progress = a.progress?.completionPercentage || 0;
      const assignedDate = a.assignment?.assignedAt ? new Date(a.assignment.assignedAt).toISOString().split("T")[0] : "";
      const completedDate = a.completedAt ? new Date(a.completedAt).toISOString().split("T")[0] : "";

      lines.push(`"${empName}","${email}","${dept}","${title}",${status},${progress}%,${assignedDate},${completedDate}`);
    }

    return lines.join("\n");
  }

  /**
   * Scheduled Reports Management (ANA-006)
   */
  async createScheduledReport(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: {
      title: string;
      frequency: "daily" | "weekly" | "monthly";
      recipients: string[];
      format: "csv" | "json";
    }
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    return ScheduledReport.create({
      organizationId: orgObjectId,
      title: data.title,
      frequency: data.frequency || "weekly",
      recipients: data.recipients,
      format: data.format || "csv",
      status: "active",
      createdBy: userObjectId,
    });
  }

  async listScheduledReports(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    return ScheduledReport.find({ organizationId: orgObjectId }).sort({ createdAt: -1 });
  }

  async deleteScheduledReport(orgId: string | mongoose.Types.ObjectId, reportId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const reportObjectId = new mongoose.Types.ObjectId(reportId.toString());

    return ScheduledReport.deleteOne({ _id: reportObjectId, organizationId: orgObjectId });
  }
}
