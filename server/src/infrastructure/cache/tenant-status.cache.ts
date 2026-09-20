import Organization from "../../modules/organizations/models/organization.model.js";

/**
 * TenantStatusCache
 * Singleton in-memory cache of suspended tenant organization IDs.
 * Provides < 5ms validation during Fastify request authentication
 * to prevent unauthorized JWT token access for quarantined or suspended tenants.
 */
export class TenantStatusCache {
  private static suspendedOrgIds: Set<string> = new Set<string>();
  private static initialized: boolean = false;

  /**
   * Hydrates the cache with all currently suspended organizations.
   * Can be called during server boot or database connection initialization.
   */
  public static async init(): Promise<void> {
    try {
      const suspendedOrgs = await Organization.find(
        { status: "Suspended", isDeleted: false },
        { _id: 1 }
      ).lean();

      this.suspendedOrgIds.clear();
      for (const org of suspendedOrgs) {
        this.suspendedOrgIds.add(org._id.toString());
      }
      this.initialized = true;
    } catch (err: any) {
      console.warn("⚠️ TenantStatusCache.init warning:", err?.message || err);
    }
  }

  /**
   * Checks whether an organization is currently suspended.
   * O(1) in-memory lookup.
   */
  public static isSuspended(orgId: string): boolean {
    if (!orgId) return false;
    return this.suspendedOrgIds.has(orgId.toString());
  }

  /**
   * Adds an organization ID to the suspended cache.
   */
  public static addSuspended(orgId: string): void {
    if (orgId) {
      this.suspendedOrgIds.add(orgId.toString());
    }
  }

  /**
   * Removes an organization ID from the suspended cache upon activation.
   */
  public static removeSuspended(orgId: string): void {
    if (orgId) {
      this.suspendedOrgIds.delete(orgId.toString());
    }
  }

  /**
   * Clears the entire cache (primarily for tests or resets).
   */
  public static clear(): void {
    this.suspendedOrgIds.clear();
    this.initialized = false;
  }

  /**
   * Returns count of currently cached suspended organizations.
   */
  public static getSuspendedCount(): number {
    return this.suspendedOrgIds.size;
  }

  /**
   * Returns whether cache has been initialized from database.
   */
  public static isInitialized(): boolean {
    return this.initialized;
  }
}

export default TenantStatusCache;
