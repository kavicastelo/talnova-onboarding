export interface ISystemLogItem {
  id: string;
  timestamp: number;
  level: "info" | "warning" | "high" | "critical";
  severity: "info" | "warning" | "high" | "critical";
  source: string; // "server" | "database" | "worker" | "auth" | "storage" | "ai"
  eventType: string; // e.g. "SERVER_BOOT", "DB_CONNECTED", "HTTP_500_ERROR", "STORAGE_QUOTA_EXCEEDED"
  message: string;
  description: string;
  action: string;
  organizationId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export class SystemLogBuffer {
  public static readonly CAPACITY = 1000;
  private static buffer: (ISystemLogItem | null)[] = new Array(SystemLogBuffer.CAPACITY).fill(null);
  private static head = 0;
  private static count = 0;

  /**
   * Record a runtime system log entry into the circular ring buffer.
   */
  public static record(entry: {
    level?: "info" | "warning" | "high" | "critical";
    source?: string;
    eventType: string;
    action?: string;
    message?: string;
    description?: string;
    organizationId?: string;
    metadata?: Record<string, any>;
  }): void {
    const now = Date.now();
    const level = entry.level || "info";
    const msg = entry.description || entry.message || `System event ${entry.eventType}`;

    const item: ISystemLogItem = {
      id: `sys-${now}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      level,
      severity: level,
      source: entry.source || "server",
      eventType: entry.eventType || "SYSTEM_EVENT",
      action: entry.action || (entry.eventType ? entry.eventType.toLowerCase() : "log"),
      message: msg,
      description: msg,
      organizationId: entry.organizationId,
      metadata: entry.metadata,
      createdAt: new Date(now).toISOString(),
    };

    SystemLogBuffer.buffer[SystemLogBuffer.head] = item;
    SystemLogBuffer.head = (SystemLogBuffer.head + 1) % SystemLogBuffer.CAPACITY;

    if (SystemLogBuffer.count < SystemLogBuffer.CAPACITY) {
      SystemLogBuffer.count++;
    }
  }

  /**
   * Retrieve recent system log records with optional filtering.
   */
  public static getLogs(
    filterOrLimit?: number | {
      organizationId?: string;
      severity?: string;
      source?: string;
      limit?: number;
    },
    maybeFilter?: {
      organizationId?: string;
      severity?: string;
      source?: string;
    }
  ): ISystemLogItem[] {
    let limit = 50;
    let organizationId: string | undefined;
    let severity: string | undefined;
    let source: string | undefined;

    if (typeof filterOrLimit === "number") {
      limit = filterOrLimit;
      organizationId = maybeFilter?.organizationId;
      severity = maybeFilter?.severity;
      source = maybeFilter?.source;
    } else if (filterOrLimit && typeof filterOrLimit === "object") {
      limit = filterOrLimit.limit || 50;
      organizationId = filterOrLimit.organizationId;
      severity = filterOrLimit.severity;
      source = filterOrLimit.source;
    }

    limit = Math.min(100, Math.max(1, limit));
    const results: ISystemLogItem[] = [];

    // Traverse from newest to oldest
    for (let i = 0; i < SystemLogBuffer.count; i++) {
      const idx = (SystemLogBuffer.head - 1 - i + SystemLogBuffer.CAPACITY) % SystemLogBuffer.CAPACITY;
      const item = SystemLogBuffer.buffer[idx];
      if (!item) continue;

      if (organizationId && organizationId !== "all" && item.organizationId !== organizationId) {
        continue;
      }
      if (severity && severity !== "all" && item.severity !== severity) {
        continue;
      }
      if (source && source !== "all" && item.source !== source) {
        continue;
      }

      results.push(item);
      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Clear the ring buffer (useful in test teardown).
   */
  public static clear(): void {
    SystemLogBuffer.buffer = new Array(SystemLogBuffer.CAPACITY).fill(null);
    SystemLogBuffer.head = 0;
    SystemLogBuffer.count = 0;
  }

  public static getCount(): number {
    return SystemLogBuffer.count;
  }
}

export default SystemLogBuffer;
