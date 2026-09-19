import FeatureFlag, { IFeatureFlag } from "../models/feature-flag.model.js";

interface CacheEntry {
  flag: IFeatureFlag | null;
  expiresAt: number;
}

export class FeatureFlagService {
  private static cache = new Map<string, CacheEntry>();
  private static CACHE_TTL_MS = 60 * 1000; // 60 seconds

  /**
   * Deterministic string hash function returning 0..99
   */
  private static hashToBucket(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Retrieve feature flag model from cache or MongoDB
   */
  static async getFlag(key: string): Promise<IFeatureFlag | null> {
    const normalizedKey = key.trim().toLowerCase();
    const now = Date.now();
    const cached = this.cache.get(normalizedKey);

    if (cached && cached.expiresAt > now) {
      return cached.flag;
    }

    try {
      const flag = await FeatureFlag.findOne({ key: normalizedKey, isDeleted: false });
      this.cache.set(normalizedKey, {
        flag,
        expiresAt: now + this.CACHE_TTL_MS,
      });
      return flag;
    } catch {
      // Safe fallback on database transient errors
      return cached?.flag || null;
    }
  }

  /**
   * Invalidate flag cache (all or specific key)
   */
  static invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key.trim().toLowerCase());
    } else {
      this.cache.clear();
    }
  }

  /**
   * Evaluate whether a feature flag is enabled for an organization and user role
   * Precedence: Exclusion (Deny) -> Target Whitelist (Allow) -> Global Kill Switch -> Audience Rules -> Rollout % -> Default
   */
  static async isEnabled(
    key: string,
    organizationId?: string,
    role?: string
  ): Promise<boolean> {
    const flag = await this.getFlag(key);
    if (!flag) {
      return false;
    }

    const orgStr = organizationId ? organizationId.toString() : null;

    // 1. Organization Exclusion (Strict Deny Precedence)
    if (orgStr && flag.excludedOrganizationIds && flag.excludedOrganizationIds.length > 0) {
      const isExcluded = flag.excludedOrganizationIds.some(
        (id: any) => (id._id || id).toString() === orgStr
      );
      if (isExcluded) {
        return false;
      }
    }

    // 2. Organization Whitelist Overrides (Selective Tenant Early Access)
    if (orgStr && flag.targetOrganizationIds && flag.targetOrganizationIds.length > 0) {
      const isTargeted = flag.targetOrganizationIds.some(
        (id: any) => (id._id || id).toString() === orgStr
      );
      if (isTargeted) {
        return true;
      }
    }

    // 3. Global Kill Switch
    if (!flag.isEnabled) {
      return false;
    }

    // 4. Target Audience Rules
    if (flag.targetAudience === "organizations") {
      // Since it was not in the whitelist above, access is not granted
      return false;
    }

    if (flag.targetAudience === "roles") {
      if (role && flag.targetRoles && flag.targetRoles.length > 0) {
        return flag.targetRoles.includes(role as any);
      }
      return false;
    }

    // 5. Progressive Rollout Percentage (0..100)
    const rollout = flag.rolloutPercentage ?? 100;
    if (rollout <= 0) {
      return false;
    }
    if (rollout >= 100) {
      return true;
    }

    // Deterministic hashing by tenant organization or role
    const bucketSeed = orgStr ? `${orgStr}:${flag.key}` : `${role || "anon"}:${flag.key}`;
    const bucket = this.hashToBucket(bucketSeed);
    return bucket < rollout;
  }

  /**
   * Resolve all platform feature flags for session bootstrapping
   */
  static async getAllResolvedFlags(
    organizationId?: string,
    role?: string
  ): Promise<Record<string, boolean>> {
    try {
      const flags = await FeatureFlag.find({ isDeleted: false });
      const resolved: Record<string, boolean> = {};

      for (const flag of flags) {
        resolved[flag.key] = await this.isEnabled(flag.key, organizationId, role);
      }

      return resolved;
    } catch {
      return {};
    }
  }
}

export default FeatureFlagService;
