import { FastifyInstance } from "fastify";
import { performance } from "perf_hooks";

export interface SyntheticProbeOptions {
  /**
   * Base URL of the target API server (e.g. "http://127.0.0.1:3000").
   * Defaults to process.env.API_URL or "http://127.0.0.1:3000".
   */
  baseUrl?: string;

  /**
   * Optional in-memory Fastify instance for programmatic or test execution via app.inject().
   */
  app?: FastifyInstance;

  /**
   * Maximum acceptable total latency SLA in milliseconds (default: 1000ms).
   */
  maxLatencyMs?: number;

  /**
   * Synthetic terminal device identifier (default: "SYNTHETIC-PROBE-TERMINAL").
   */
  deviceId?: string;

  /**
   * Target organization ID for multi-tenant targeting.
   */
  organizationId?: string;

  /**
   * Enable verbose console output.
   */
  verbose?: boolean;

  /**
   * Custom logger callback.
   */
  logger?: (msg: string) => void;
}

export interface ProbeStepResult {
  status: "pass" | "fail";
  latencyMs: number;
  details?: string;
  error?: string;
}

export interface SyntheticProbeResult {
  success: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  totalLatencyMs: number;
  maxLatencyMs: number;
  steps: {
    ping: ProbeStepResult;
    auth: ProbeStepResult & { deviceId?: string; organizationId?: string };
    manifest: ProbeStepResult & { journeyCount?: number; launchMode?: string };
    asset: ProbeStepResult & { assetUrl?: string; contentType?: string };
  };
  subsystems?: Record<string, { status: string; latencyMs: number; details?: string }>;
  timestamp: string;
  error?: string;
}

interface ProbeHttpClient {
  get(url: string, headers?: Record<string, string>): Promise<{ status: number; data: any; headers: Record<string, any> }>;
  post(url: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; data: any; headers: Record<string, any> }>;
}

function createHttpClient(options: SyntheticProbeOptions): ProbeHttpClient {
  if (options.app) {
    const fastifyApp = options.app;
    return {
      get: async (url: string, headers: Record<string, string> = {}) => {
        const res = await fastifyApp.inject({
          method: "GET",
          url,
          headers
        });
        let data: any;
        try {
          data = JSON.parse(res.body);
        } catch {
          data = res.body;
        }
        return {
          status: res.statusCode,
          data,
          headers: res.headers as Record<string, any>
        };
      },
      post: async (url: string, body?: any, headers: Record<string, string> = {}) => {
        const res = await fastifyApp.inject({
          method: "POST",
          url,
          headers: {
            "content-type": "application/json",
            ...headers
          },
          payload: body
        });
        let data: any;
        try {
          data = JSON.parse(res.body);
        } catch {
          data = res.body;
        }
        return {
          status: res.statusCode,
          data,
          headers: res.headers as Record<string, any>
        };
      }
    };
  }

  const baseUrl = options.baseUrl || process.env.API_URL || "http://127.0.0.1:3000";

  return {
    get: async (url: string, headers: Record<string, string> = {}) => {
      const fullUrl = `${baseUrl.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
      const res = await fetch(fullUrl, {
        method: "GET",
        headers
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return {
        status: res.status,
        data,
        headers: Object.fromEntries(res.headers.entries())
      };
    },
    post: async (url: string, body?: any, headers: Record<string, string> = {}) => {
      const fullUrl = `${baseUrl.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
      const res = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return {
        status: res.status,
        data,
        headers: Object.fromEntries(res.headers.entries())
      };
    }
  };
}

/**
 * Execute the 5-step synthetic health probe:
 * 1. Ping API health & measure subsystem latencies (DB, storage, auth).
 * 2. Authenticate as a synthetic test terminal.
 * 3. Fetch assigned manifest.
 * 4. Fetch a sample step asset.
 * 5. Validate total latency < 1000ms SLA.
 */
export async function runSyntheticProbe(options: SyntheticProbeOptions = {}): Promise<SyntheticProbeResult> {
  const maxLatencyMs = options.maxLatencyMs ?? 1000;
  const deviceId = options.deviceId || "SYNTHETIC-PROBE-TERMINAL";
  const log = options.logger || (options.verbose ? console.log : () => {});

  const client = createHttpClient(options);
  const overallStart = performance.now();

  log(`[PROBE] Initiating synthetic probe for terminal: ${deviceId}...`);

  // Default step results
  let pingStep: ProbeStepResult = { status: "fail", latencyMs: 0 };
  let authStep: ProbeStepResult & { deviceId?: string; organizationId?: string } = { status: "fail", latencyMs: 0, deviceId };
  let manifestStep: ProbeStepResult & { journeyCount?: number; launchMode?: string } = { status: "fail", latencyMs: 0 };
  let assetStep: ProbeStepResult & { assetUrl?: string; contentType?: string } = { status: "fail", latencyMs: 0 };
  let subsystems: Record<string, { status: string; latencyMs: number; details?: string }> | undefined;

  let deviceToken = "";
  let organizationId = options.organizationId || "";
  let sampleAssetUrl = "/api/v1/kiosk/health/synthetic/sample-asset";

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Ping API health
    // -------------------------------------------------------------------------
    const t0 = performance.now();
    const pingRes = await client.get("/api/v1/kiosk/health/synthetic");
    const pingLatency = Math.round((performance.now() - t0) * 100) / 100;

    if (pingRes.status !== 200) {
      pingStep = {
        status: "fail",
        latencyMs: pingLatency,
        error: `HTTP ${pingRes.status}: ${JSON.stringify(pingRes.data)}`
      };
      throw new Error(`Step 1 (Ping API health) failed with HTTP ${pingRes.status}`);
    }

    subsystems = pingRes.data?.subsystems;
    pingStep = {
      status: "pass",
      latencyMs: pingLatency,
      details: `Health check responded with status: ${pingRes.data?.status || "healthy"}`
    };
    log(`  ✓ Step 1: Ping API health OK (${pingLatency}ms)`);

    // -------------------------------------------------------------------------
    // STEP 2: Authenticate as a synthetic test terminal
    // -------------------------------------------------------------------------
    const t1 = performance.now();
    const authRes = await client.post("/api/v1/kiosk/health/synthetic/auth", {
      deviceId,
      organizationId: organizationId || undefined
    });
    const authLatency = Math.round((performance.now() - t1) * 100) / 100;

    if (authRes.status !== 200 || !authRes.data?.token) {
      authStep = {
        status: "fail",
        latencyMs: authLatency,
        deviceId,
        error: `HTTP ${authRes.status}: ${JSON.stringify(authRes.data)}`
      };
      throw new Error(`Step 2 (Authenticate terminal) failed with HTTP ${authRes.status}`);
    }

    deviceToken = authRes.data.token;
    organizationId = authRes.data.organizationId || organizationId;
    authStep = {
      status: "pass",
      latencyMs: authLatency,
      deviceId,
      organizationId,
      details: "Synthetic terminal JWT issued and tokenRef registered"
    };
    log(`  ✓ Step 2: Authenticate synthetic terminal OK (${authLatency}ms)`);

    // -------------------------------------------------------------------------
    // STEP 3: Fetch assigned manifest
    // -------------------------------------------------------------------------
    const t2 = performance.now();
    const manifestRes = await client.get("/api/v1/kiosk/devices/manifest", {
      authorization: `Bearer ${deviceToken}`
    });
    const manifestLatency = Math.round((performance.now() - t2) * 100) / 100;

    if (manifestRes.status !== 200 || !manifestRes.data?.data) {
      manifestStep = {
        status: "fail",
        latencyMs: manifestLatency,
        error: `HTTP ${manifestRes.status}: ${JSON.stringify(manifestRes.data)}`
      };
      throw new Error(`Step 3 (Fetch manifest) failed with HTTP ${manifestRes.status}`);
    }

    const manifestData = manifestRes.data.data;
    const journeys = manifestData.journeys || [];
    manifestStep = {
      status: "pass",
      latencyMs: manifestLatency,
      journeyCount: journeys.length,
      launchMode: manifestData.launchMode || "autoplay",
      details: `Retrieved manifest with ${journeys.length} assigned journeys`
    };
    log(`  ✓ Step 3: Fetch assigned manifest OK (${manifestLatency}ms, ${journeys.length} journeys)`);

    // -------------------------------------------------------------------------
    // STEP 4: Fetch a sample step asset
    // -------------------------------------------------------------------------
    const t3 = performance.now();

    // Check if manifest specifies a step asset
    if (journeys.length > 0 && journeys[0].steps?.length > 0) {
      const firstStep = journeys[0].steps[0];
      const assetBlock = firstStep.blocks?.find((b: any) => b.assetId);
      if (assetBlock?.assetId) {
        sampleAssetUrl = `/api/v1/kiosk/uploads/${assetBlock.assetId}`;
      }
    }

    const assetRes = await client.get(sampleAssetUrl, {
      authorization: `Bearer ${deviceToken}`
    });
    const assetLatency = Math.round((performance.now() - t3) * 100) / 100;

    if (assetRes.status !== 200 && assetRes.status !== 302) {
      assetStep = {
        status: "fail",
        latencyMs: assetLatency,
        assetUrl: sampleAssetUrl,
        error: `HTTP ${assetRes.status}: ${JSON.stringify(assetRes.data)}`
      };
      throw new Error(`Step 4 (Fetch sample step asset) failed with HTTP ${assetRes.status}`);
    }

    const contentType = assetRes.headers["content-type"] || "image/svg+xml";
    assetStep = {
      status: "pass",
      latencyMs: assetLatency,
      assetUrl: sampleAssetUrl,
      contentType,
      details: `Successfully fetched asset via ${sampleAssetUrl} (HTTP ${assetRes.status})`
    };
    log(`  ✓ Step 4: Fetch sample step asset OK (${assetLatency}ms)`);

    // -------------------------------------------------------------------------
    // STEP 5: Validate total latency < 1000ms SLA
    // -------------------------------------------------------------------------
    const totalLatencyMs = Math.round((performance.now() - overallStart) * 100) / 100;
    const isWithinSla = totalLatencyMs < maxLatencyMs;

    log(`  ✓ Step 5: Validate total latency: ${totalLatencyMs}ms < ${maxLatencyMs}ms (${isWithinSla ? "PASS" : "FAIL"})`);

    const resultStatus: "healthy" | "degraded" = isWithinSla ? "healthy" : "degraded";

    return {
      success: isWithinSla,
      status: resultStatus,
      totalLatencyMs,
      maxLatencyMs,
      steps: {
        ping: pingStep,
        auth: authStep,
        manifest: manifestStep,
        asset: assetStep
      },
      subsystems,
      timestamp: new Date().toISOString(),
      ...(isWithinSla
        ? {}
        : {
            error: `Synthetic probe latency (${totalLatencyMs}ms) breached SLA limit (${maxLatencyMs}ms)`
          })
    };
  } catch (err: any) {
    const totalLatencyMs = Math.round((performance.now() - overallStart) * 100) / 100;
    log(`  ✗ Synthetic probe failed: ${err.message}`);

    return {
      success: false,
      status: "unhealthy",
      totalLatencyMs,
      maxLatencyMs,
      steps: {
        ping: pingStep,
        auth: authStep,
        manifest: manifestStep,
        asset: assetStep
      },
      subsystems,
      timestamp: new Date().toISOString(),
      error: err.message || "Synthetic probe execution encountered an unhandled exception"
    };
  }
}

// ---------------------------------------------------------------------------
// Standalone CLI runner (e.g. npx tsx server/src/scripts/kiosk-synthetic-probe.ts)
// ---------------------------------------------------------------------------
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("kiosk-synthetic-probe.ts") ||
    process.argv[1].endsWith("kiosk-synthetic-probe.js"));

if (isMainModule) {
  console.log("=================================================================");
  console.log(" Talnova Kiosk Synthetic Fleet Health Probe (K-REL-003)");
  console.log(` Target: ${process.env.API_URL || "http://127.0.0.1:3000"}`);
  console.log(` Timestamp: ${new Date().toISOString()}`);
  console.log("=================================================================");

  runSyntheticProbe({ verbose: true })
    .then((result) => {
      console.log("\n------------------------- Probe Summary -------------------------");
      console.log(`Overall Status:   ${result.status.toUpperCase()}`);
      console.log(`Success:          ${result.success ? "YES (SLA MET)" : "NO (BREACHED/FAILED)"}`);
      console.log(`Total Latency:    ${result.totalLatencyMs}ms (Threshold: < ${result.maxLatencyMs}ms)`);
      console.log(`API Ping Latency: ${result.steps.ping.latencyMs}ms`);
      console.log(`Auth Latency:     ${result.steps.auth.latencyMs}ms`);
      console.log(`Manifest Latency: ${result.steps.manifest.latencyMs}ms`);
      console.log(`Asset Latency:    ${result.steps.asset.latencyMs}ms`);

      if (result.subsystems) {
        console.log("\nSubsystem Metrics:");
        console.log(`  Database:  ${result.subsystems.database?.status} (${result.subsystems.database?.latencyMs}ms)`);
        console.log(`  Storage:   ${result.subsystems.storage?.status} (${result.subsystems.storage?.latencyMs}ms)`);
        console.log(`  Auth:      ${result.subsystems.auth?.status} (${result.subsystems.auth?.latencyMs}ms)`);
        console.log(`  Manifest:  ${result.subsystems.manifest?.status} (${result.subsystems.manifest?.latencyMs}ms)`);
      }
      console.log("=================================================================\n");

      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[CRITICAL] Unhandled synthetic probe exception:", err);
      process.exit(1);
    });
}

export default runSyntheticProbe;
