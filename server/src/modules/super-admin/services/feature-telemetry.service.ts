import mongoose from "mongoose";
import { FeatureUsageRecord, IFeatureUsageRecord } from "../models/feature-usage-record.model.js";
import Organization from "../../organizations/models/organization.model.js";

export interface RecordUsageParams {
  featureKey: string;
  organizationId: string | mongoose.Types.ObjectId;
  userId?: string | mongoose.Types.ObjectId;
  userRole?: string;
  actionName: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface FeatureAdoptionMetrics {
  featureKey: string;
  activeTenants: number;
  activeTenantsCount: number;
  totalEligibleTenants: number;
  totalTenants: number;
  adoptionPct: number;
  orgAdoptionPct: number;
  uniqueUsers: number;
  uniqueUsersCount: number;
  totalUsageEvents: number;
  totalEvents: number;
}

export interface FeatureAdoptionSummaryResult {
  totalEligibleTenants: number;
  totalTenants: number;
  activeTenants: number;
  activeTenantsCount: number;
  adoptionPct: number;
  orgAdoptionPct: number;
  uniqueUsers: number;
  uniqueUsersCount: number;
  totalUsageEvents: number;
  totalEvents: number;
  features: FeatureAdoptionMetrics[];
  byFeature: Record<string, FeatureAdoptionMetrics>;
  [key: string]: any;
}

const PII_DISALLOWED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "refreshtoken",
  "accesstoken",
  "secret",
  "ssn",
  "socialsecuritynumber",
  "creditcard",
  "cardnumber",
  "cvv",
  "email",
  "authorization",
  "cookie",
]);

function sanitizeTelemetryMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata || typeof metadata !== "object") return {};
  const clean: Record<string, any> = {};

  for (const [key, val] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (PII_DISALLOWED_KEYS.has(lowerKey)) {
      continue;
    }
    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof mongoose.Types.ObjectId)) {
      clean[key] = sanitizeTelemetryMetadata(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export class FeatureTelemetryService {
  /**
   * Non-blocking, fire-and-forget feature usage record writer.
   * Never throws or interrupts primary domain user transactions.
   */
  static async recordUsage(params: RecordUsageParams): Promise<void> {
    try {
      if (!params || !params.featureKey || !params.organizationId) {
        return;
      }

      const orgId = typeof params.organizationId === "string"
        ? new mongoose.Types.ObjectId(params.organizationId)
        : params.organizationId;

      let userId: mongoose.Types.ObjectId | undefined;
      if (params.userId) {
        try {
          userId = typeof params.userId === "string"
            ? new mongoose.Types.ObjectId(params.userId)
            : params.userId;
        } catch {
          userId = undefined;
        }
      }

      const sanitizedMeta = sanitizeTelemetryMetadata(params.metadata);

      await FeatureUsageRecord.create({
        featureKey: params.featureKey.trim().toLowerCase(),
        organizationId: orgId,
        userId,
        userRole: params.userRole || "employee",
        actionName: params.actionName,
        metadata: sanitizedMeta,
        timestamp: params.timestamp || new Date(),
      });
    } catch (err: any) {
      // Critical security/resilience requirement: never let telemetry failure fail business logic
      console.error("[FeatureTelemetryService.recordUsage] Telemetry write failed:", err?.message || err);
    }
  }

  /**
   * Instance alias for recordUsage
   */
  async recordUsage(params: RecordUsageParams): Promise<void> {
    return FeatureTelemetryService.recordUsage(params);
  }

  /**
   * Computes empirical feature adoption rollups over a given time window (default: 30 days).
   * Calculates:
   *   activeTenantsCount
   *   totalEligibleTenants
   *   orgAdoptionPct = (activeTenantsCount / totalEligibleTenants) * 100
   *   uniqueUsersCount
   *   totalUsageEvents
   */
  async getAdoptionSummary(
    timeWindowDays: number = 30,
    filterFeatureKey?: string
  ): Promise<FeatureAdoptionSummaryResult> {
    const days = Math.max(1, timeWindowDays || 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Total eligible active tenants in the platform
    const totalEligibleTenants = await Organization.countDocuments({ isDeleted: false });

    // 2. Aggregation pipeline
    const matchStage: any = {
      timestamp: { $gte: since },
    };

    if (filterFeatureKey) {
      matchStage.featureKey = filterFeatureKey.trim().toLowerCase();
    }

    const aggResults = await FeatureUsageRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$featureKey",
          activeTenantsSet: { $addToSet: "$organizationId" },
          uniqueUsersSet: {
            $addToSet: {
              $cond: [{ $ifNull: ["$userId", false] }, "$userId", "$$REMOVE"],
            },
          },
          totalEvents: { $sum: 1 },
        },
      },
      {
        $project: {
          featureKey: "$_id",
          activeTenants: { $size: "$activeTenantsSet" },
          activeTenantsCount: { $size: "$activeTenantsSet" },
          uniqueUsers: { $size: "$uniqueUsersSet" },
          uniqueUsersCount: { $size: "$uniqueUsersSet" },
          totalEvents: "$totalEvents",
          totalUsageEvents: "$totalEvents",
        },
      },
      { $sort: { totalEvents: -1 } },
    ]);

    const features: FeatureAdoptionMetrics[] = [];
    const byFeature: Record<string, FeatureAdoptionMetrics> = {};
    const resultObj: Record<string, any> = {};

    let cumulativeActiveOrgsSet = new Set<string>();
    let cumulativeUsersSet = new Set<string>();
    let totalAllEvents = 0;

    for (const item of aggResults) {
      const activeTenants = item.activeTenants || 0;
      const adoptionPct = totalEligibleTenants > 0
        ? Math.round((activeTenants / totalEligibleTenants) * 10000) / 100
        : 0;

      const metric: FeatureAdoptionMetrics = {
        featureKey: item.featureKey,
        activeTenants,
        activeTenantsCount: activeTenants,
        totalEligibleTenants,
        totalTenants: totalEligibleTenants,
        adoptionPct,
        orgAdoptionPct: adoptionPct,
        uniqueUsers: item.uniqueUsers || 0,
        uniqueUsersCount: item.uniqueUsers || 0,
        totalEvents: item.totalEvents || 0,
        totalUsageEvents: item.totalEvents || 0,
      };

      features.push(metric);
      byFeature[metric.featureKey] = metric;
      resultObj[metric.featureKey] = metric;
    }

    // If specific feature requested but has 0 events recorded
    if (filterFeatureKey && !byFeature[filterFeatureKey.toLowerCase()]) {
      const zeroMetric: FeatureAdoptionMetrics = {
        featureKey: filterFeatureKey.toLowerCase(),
        activeTenants: 0,
        activeTenantsCount: 0,
        totalEligibleTenants,
        totalTenants: totalEligibleTenants,
        adoptionPct: 0,
        orgAdoptionPct: 0,
        uniqueUsers: 0,
        uniqueUsersCount: 0,
        totalEvents: 0,
        totalUsageEvents: 0,
      };
      features.push(zeroMetric);
      byFeature[filterFeatureKey.toLowerCase()] = zeroMetric;
      resultObj[filterFeatureKey.toLowerCase()] = zeroMetric;
    }

    // Top-level summary computation
    const primaryFeature = features.length === 1 ? features[0] : null;
    const activeTenants = primaryFeature
      ? primaryFeature.activeTenants
      : (features.length > 0 ? Math.max(...features.map((f) => f.activeTenants)) : 0);

    const adoptionPct = totalEligibleTenants > 0
      ? Math.round((activeTenants / totalEligibleTenants) * 10000) / 100
      : 0;

    const uniqueUsers = primaryFeature
      ? primaryFeature.uniqueUsers
      : features.reduce((sum, f) => sum + f.uniqueUsers, 0);

    const totalEvents = primaryFeature
      ? primaryFeature.totalEvents
      : features.reduce((sum, f) => sum + f.totalEvents, 0);

    return {
      totalEligibleTenants,
      totalTenants: totalEligibleTenants,
      activeTenants,
      activeTenantsCount: activeTenants,
      adoptionPct,
      orgAdoptionPct: adoptionPct,
      uniqueUsers,
      uniqueUsersCount: uniqueUsers,
      totalUsageEvents: totalEvents,
      totalEvents,
      features,
      byFeature,
      ...resultObj,
    };
  }
}

export const featureTelemetryService = new FeatureTelemetryService();
export default featureTelemetryService;
