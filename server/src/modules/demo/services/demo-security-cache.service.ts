/**
 * Demo In-Memory Security & Blacklist Cache
 * Tracks blacklisted IPs, suspicious bots, and honeypot triggers.
 */

export interface BlacklistEntry {
  ip: string;
  reason: string;
  blacklistedAt: Date;
  expiresAt: Date;
}

class DemoSecurityCacheService {
  private blacklist: Map<string, BlacklistEntry> = new Map();
  private readonly defaultTtlMs = 60 * 60 * 1000; // 1 hour blacklist

  public blacklistIp(ip: string, reason: string, ttlMs: number = this.defaultTtlMs): void {
    if (!ip) return;
    const now = new Date();
    this.blacklist.set(ip, {
      ip,
      reason,
      blacklistedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
    });
  }

  public isIpBlacklisted(ip: string): boolean {
    if (!ip) return false;
    const entry = this.blacklist.get(ip);
    if (!entry) return false;

    if (entry.expiresAt.getTime() < Date.now()) {
      this.blacklist.delete(ip);
      return false;
    }

    return true;
  }

  public getBlacklistEntry(ip: string): BlacklistEntry | undefined {
    if (!ip) return undefined;
    if (this.isIpBlacklisted(ip)) {
      return this.blacklist.get(ip);
    }
    return undefined;
  }

  public clear(): void {
    this.blacklist.clear();
  }
}

export const demoSecurityCache = new DemoSecurityCacheService();
export default demoSecurityCache;
