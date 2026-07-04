import mongoose from "mongoose";
import { KioskAnalyticsModel, IKioskAnalytics } from "../models/kiosk-analytics.model.js";

export class KioskAnalyticsRepository {
  async saveSession(sessionData: Partial<IKioskAnalytics>): Promise<IKioskAnalytics> {
    const session = new KioskAnalyticsModel(sessionData);
    return session.save();
  }

  async bulkSync(sessions: Array<Partial<IKioskAnalytics>>): Promise<IKioskAnalytics[]> {
    return KioskAnalyticsModel.insertMany(sessions) as unknown as IKioskAnalytics[];
  }

  /**
   * Retrieves summary analytics for a journey including completion rate and language splits.
   */
  async getSummary(
    orgId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    const matchQuery: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      journeyId: new mongoose.Types.ObjectId(journeyId)
    };

    if (startDate || endDate) {
      matchQuery.dateKey = {};
      if (startDate) matchQuery.dateKey.$gte = startDate;
      if (endDate) matchQuery.dateKey.$lte = endDate;
    }

    const result = await KioskAnalyticsModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalLaunches: { $sum: "$metrics.launchesCount" },
          totalCompletions: { $sum: "$metrics.completedCount" },
          totalDurationSeconds: { $sum: "$metrics.durationSeconds" },
          languagesUsed: { $addToSet: "$languageUsed" },
          sessionsCount: { $sum: 1 }
        }
      }
    ]);

    const languageBreakdown = await KioskAnalyticsModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$languageUsed",
          count: { $sum: 1 }
        }
      }
    ]);

    if (result.length === 0) {
      return {
        totalLaunches: 0,
        totalCompletions: 0,
        averageDurationSeconds: 0,
        completionRate: 0,
        languagesUsed: [],
        sessionsCount: 0,
        languageBreakdown: []
      };
    }

    const summary = result[0];
    const completionRate = summary.totalLaunches > 0 ? (summary.totalCompletions / summary.totalLaunches) * 100 : 0;

    return {
      totalLaunches: summary.totalLaunches,
      totalCompletions: summary.totalCompletions,
      averageDurationSeconds: summary.sessionsCount > 0 ? summary.totalDurationSeconds / summary.sessionsCount : 0,
      completionRate,
      languagesUsed: summary.languagesUsed,
      sessionsCount: summary.sessionsCount,
      languageBreakdown: languageBreakdown.map((lb) => ({
        language: lb._id,
        count: lb.count
      }))
    };
  }
}

export default KioskAnalyticsRepository;
