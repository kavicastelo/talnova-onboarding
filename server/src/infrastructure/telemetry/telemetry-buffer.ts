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
  method?: string;
  path?: string;
  p95: number;
  avgLatency?: number;
  count24h: number;
  errorRate?: number;
  status: "healthy" | "degraded" | "critical";
}

export interface ITelemetryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  pagination: ITelemetryPagination;
}

export interface IGetMetricsOptions {
  windowMs?: number;
  organizationId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | "healthy" | "degraded" | "critical";
  sortBy?: "count24h" | "p95" | "avgLatency" | "errorRate" | "route" | "status";
  sortOrder?: "asc" | "desc";
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
   * Compute dynamic latency percentiles, RPM throughput, and paginated endpoint health metrics.
   */
  public static getMetrics(
    windowMsOrOptions: number | IGetMetricsOptions = 60000,
    organizationId?: string,
    extraOptions?: Partial<IGetMetricsOptions>
  ): ITelemetryMetrics {
    let windowMs = 60000;
    let orgId = organizationId;
    let page = 1;
    let limit = 10;
    let search: string | undefined;
    let statusFilter: string | undefined;
    let sortBy: string = "count24h";
    let sortOrder: "asc" | "desc" = "desc";

    if (typeof windowMsOrOptions === "object" && windowMsOrOptions !== null) {
      windowMs = windowMsOrOptions.windowMs ?? 60000;
      orgId = windowMsOrOptions.organizationId;
      page = windowMsOrOptions.page ? Math.max(1, Number(windowMsOrOptions.page)) : 1;
      limit = windowMsOrOptions.limit ? Math.max(1, Math.min(100, Number(windowMsOrOptions.limit))) : 10;
      search = windowMsOrOptions.search?.trim();
      statusFilter = windowMsOrOptions.status;
      sortBy = windowMsOrOptions.sortBy || "count24h";
      sortOrder = windowMsOrOptions.sortOrder === "asc" ? "asc" : "desc";
    } else {
      windowMs = typeof windowMsOrOptions === "number" ? windowMsOrOptions : 60000;
      if (extraOptions) {
        page = extraOptions.page ? Math.max(1, Number(extraOptions.page)) : 1;
        limit = extraOptions.limit ? Math.max(1, Math.min(100, Number(extraOptions.limit))) : 10;
        search = extraOptions.search?.trim();
        statusFilter = extraOptions.status;
        sortBy = extraOptions.sortBy || "count24h";
        sortOrder = extraOptions.sortOrder === "asc" ? "asc" : "desc";
      }
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const windowStart = now - windowMs;

    const validEntries: ITelemetryEntry[] = [];
    let windowCount = 0;

    for (let i = 0; i < TelemetryBuffer.count; i++) {
      const item = TelemetryBuffer.buffer[i];
      if (!item) continue;

      if (orgId && orgId !== "all" && item.organizationId !== orgId) {
        continue;
      }

      if (item.timestamp >= oneDayAgo) {
        validEntries.push(item);
      }
      if (item.timestamp >= windowStart) {
        windowCount++;
      }
    }

    // Default nominal endpoints when buffer has no traffic yet
    const nominalEndpoints: IEndpointMetric[] = [
      { route: "GET /api/v1/super-admin/telemetry", method: "GET", path: "/api/v1/super-admin/telemetry", p95: 0, avgLatency: 0, count24h: 0, errorRate: 0, status: "healthy" },
      { route: "GET /api/v1/super-admin/search", method: "GET", path: "/api/v1/super-admin/search", p95: 0, avgLatency: 0, count24h: 0, errorRate: 0, status: "healthy" },
      { route: "GET /api/v1/super-admin/organizations", method: "GET", path: "/api/v1/super-admin/organizations", p95: 0, avgLatency: 0, count24h: 0, errorRate: 0, status: "healthy" },
      { route: "POST /api/v1/auth/login", method: "POST", path: "/api/v1/auth/login", p95: 0, avgLatency: 0, count24h: 0, errorRate: 0, status: "healthy" },
    ];

    if (validEntries.length === 0) {
      let filtered = nominalEndpoints;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter((e) => e.route.toLowerCase().includes(q));
      }
      if (statusFilter && statusFilter !== "all") {
        filtered = filtered.filter((e) => e.status === statusFilter);
      }
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const currentPage = Math.min(page, totalPages);
      const startIndex = (currentPage - 1) * limit;
      const endpoints = filtered.slice(startIndex, startIndex + limit);

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
        endpoints,
        pagination: {
          page: currentPage,
          limit,
          total,
          totalPages,
        },
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
      const epAvgLatency = stats.latencies.reduce((sum, lat) => sum + lat, 0) / epLen;

      let status: "healthy" | "degraded" | "critical" = "healthy";
      if (epP95 >= 500 || epErrRate >= 15) {
        status = "critical";
      } else if (epP95 >= 200 || epErrRate >= 5) {
        status = "degraded";
      }

      const [method, ...pathParts] = route.split(" ");
      const path = pathParts.join(" ");

      endpointMetrics.push({
        route,
        method: method || "GET",
        path: path || route,
        p95: Number(epP95.toFixed(1)),
        avgLatency: Number(epAvgLatency.toFixed(1)),
        count24h: stats.count,
        errorRate: Number(epErrRate.toFixed(1)),
        status,
      });
    }

    // Filter by search query
    let filteredEndpoints = endpointMetrics;
    if (search) {
      const q = search.toLowerCase();
      filteredEndpoints = filteredEndpoints.filter((e) => e.route.toLowerCase().includes(q));
    }

    // Filter by health status
    if (statusFilter && statusFilter !== "all") {
      filteredEndpoints = filteredEndpoints.filter((e) => e.status === statusFilter);
    }

    // Sorting
    filteredEndpoints.sort((a, b) => {
      let comp = 0;
      if (sortBy === "p95") {
        comp = a.p95 - b.p95;
      } else if (sortBy === "avgLatency") {
        comp = (a.avgLatency || 0) - (b.avgLatency || 0);
      } else if (sortBy === "errorRate") {
        comp = (a.errorRate || 0) - (b.errorRate || 0);
      } else if (sortBy === "route") {
        comp = a.route.localeCompare(b.route);
      } else if (sortBy === "status") {
        const priority: Record<string, number> = { critical: 3, degraded: 2, healthy: 1 };
        comp = (priority[a.status] || 0) - (priority[b.status] || 0);
      } else {
        comp = a.count24h - b.count24h;
      }
      return sortOrder === "asc" ? comp : -comp;
    });

    // Pagination
    const total = filteredEndpoints.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * limit;
    const paginatedEndpoints = filteredEndpoints.slice(startIndex, startIndex + limit);

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
      endpoints: paginatedEndpoints,
      pagination: {
        page: currentPage,
        limit,
        total,
        totalPages,
      },
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
