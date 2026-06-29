import mongoose from "mongoose";
import { User } from "../../auth/models/user.model.js";
import { EmployeeAssignment } from "../../assignments/models/assignment.model.js";
import { Organization } from "../../organizations/models/organization.model.js";

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
      departmentCompletions
    };
  }
}
