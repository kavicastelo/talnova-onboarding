export interface ITelemetryEntry {
  timestamp: number;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  organizationId?: string;
}

export interface IEndpointMetric {
  route: string;
  p95: number;
  count24h: number;
  status: "healthy" | "degraded" | "critical";
}

export interface ITelemetryMetrics {
  latency: {
    p50: number;
    p95: number;
    p99: number;
    unit: string;
  };
  throughput: {
    rpm: number;
    successRate: number;
    errorRate: number;
  };
  endpoints: IEndpointMetric[];
}

export class TelemetryBuffer {
  public static readonly CAPACITY = 5000;
  private static buffer: (ITelemetryEntry | null)[] = new Array(TelemetryBuffer.CAPACITY).fill(null);
  private static head = 0;
  private static count = 0;

  /**
   * Record an HTTP request duration into the circular ring buffer.
   */
  public static record(entry: ITelemetryEntry): void {
    if (!entry || typeof entry.durationMs !== "number" || isNaN(entry.durationMs)) {
      return;
    }

    // Sanitize route path
    const rawRoute = entry.route || "/";
    const cleanRoute = rawRoute.split("?")[0].replace(/\/+$/, "") || "/";

    // Ignore internal static polling / favicon pings
    if (cleanRoute === "/favicon.ico" || cleanRoute.startsWith("/assets/")) {
      return;
    }

    const sanitizedEntry: ITelemetryEntry = {
      timestamp: entry.timestamp || Date.now(),
      method: (entry.method || "GET").toUpperCase(),
      route: cleanRoute,
      statusCode: entry.statusCode || 200,
      durationMs: Math.max(0, Number(entry.durationMs.toFixed(2))),
      organizationId: entry.organizationId,
    };

    TelemetryBuffer.buffer[TelemetryBuffer.head] = sanitizedEntry;
    TelemetryBuffer.head = (TelemetryBuffer.head + 1) % TelemetryBuffer.CAPACITY;

    if (TelemetryBuffer.count < TelemetryBuffer.CAPACITY) {
      TelemetryBuffer.count++;
    }
  }

  /**
   * Compute dynamic latency percentiles, RPM throughput, and endpoint health metrics.
   */
  public static getMetrics(windowMs = 60000): ITelemetryMetrics {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const windowStart = now - windowMs;

    const validEntries: ITelemetryEntry[] = [];
    let windowCount = 0;

    for (let i = 0; i < TelemetryBuffer.count; i++) {
      const item = TelemetryBuffer.buffer[i];
      if (!item) continue;

      if (item.timestamp >= oneDayAgo) {
        validEntries.push(item);
      }
      if (item.timestamp >= windowStart) {
        windowCount++;
      }
    }

    // Default response when buffer is empty
    if (validEntries.length === 0) {
      return {
        latency: {
          p50: 0,
          p95: 0,
          p99: 0,
          unit: "ms",
        },
        throughput: {
          rpm: 0,
          successRate: 100,
          errorRate: 0,
        },
        endpoints: [
          { route: "GET /api/v1/super-admin/telemetry", p95: 0, count24h: 0, status: "healthy" },
          { route: "GET /api/v1/super-admin/search", p95: 0, count24h: 0, status: "healthy" },
          { route: "GET /api/v1/super-admin/organizations", p95: 0, count24h: 0, status: "healthy" },
          { route: "POST /api/v1/auth/login", p95: 0, count24h: 0, status: "healthy" },
        ],
      };
    }

    // 1. Latency Percentiles (Ascending Sort)
    const latencies = validEntries.map((e) => e.durationMs).sort((a, b) => a - b);
    const n = latencies.length;

    const p50 = latencies[Math.min(n - 1, Math.floor(n * 0.50))];
    const p95 = latencies[Math.min(n - 1, Math.floor(n * 0.95))];
    const p99 = latencies[Math.min(n - 1, Math.floor(n * 0.99))];

    // 2. Throughput & Error Rates
    const successCount = validEntries.filter((e) => e.statusCode < 400).length;
    const errorCount = n - successCount;
    const successRate = Number(((successCount / n) * 100).toFixed(2));
    const errorRate = Number(((errorCount / n) * 100).toFixed(2));

    // 3. Per-Route Aggregations
    const routeMap = new Map<string, { latencies: number[]; errors: number; count: number }>();

    for (const entry of validEntries) {
      const routeKey = `${entry.method} ${entry.route}`;
      let group = routeMap.get(routeKey);
      if (!group) {
        group = { latencies: [], errors: 0, count: 0 };
        routeMap.set(routeKey, group);
      }
      group.count++;
      group.latencies.push(entry.durationMs);
      if (entry.statusCode >= 400) {
        group.errors++;
      }
    }

    const endpointMetrics: IEndpointMetric[] = [];

    for (const [route, stats] of routeMap.entries()) {
      stats.latencies.sort((a, b) => a - b);
      const epLen = stats.latencies.length;
      const epP95 = stats.latencies[Math.min(epLen - 1, Math.floor(epLen * 0.95))];
      const epErrRate = (stats.errors / stats.count) * 100;

      let status: "healthy" | "degraded" | "critical" = "healthy";
      if (epP95 >= 500 || epErrRate >= 15) {
        status = "critical";
      } else if (epP95 >= 200 || epErrRate >= 5) {
        status = "degraded";
      }

      endpointMetrics.push({
        route,
        p95: Number(epP95.toFixed(1)),
        count24h: stats.count,
        status,
      });
    }

    // Sort endpoints by call volume descending, top 10
    endpointMetrics.sort((a, b) => b.count24h - a.count24h);
    const topEndpoints = endpointMetrics.slice(0, 10);

    return {
      latency: {
        p50: Number(p50.toFixed(1)),
        p95: Number(p95.toFixed(1)),
        p99: Number(p99.toFixed(1)),
        unit: "ms",
      },
      throughput: {
        rpm: windowCount,
        successRate,
        errorRate,
      },
      endpoints: topEndpoints,
    };
  }

  /**
   * Reset ring buffer for test isolation.
   */
  public static clear(): void {
    TelemetryBuffer.buffer = new Array(TelemetryBuffer.CAPACITY).fill(null);
    TelemetryBuffer.head = 0;
    TelemetryBuffer.count = 0;
  }

  /**
   * Returns current count of entries stored.
   */
  public static getCount(): number {
    return TelemetryBuffer.count;
  }
}

export default TelemetryBuffer;
