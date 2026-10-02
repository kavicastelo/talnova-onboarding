import { FastifyInstance } from "fastify";
import { KioskService } from "../modules/kiosk/services/kiosk.service.js";
import { KioskJourneyRepository } from "../modules/kiosk/repositories/kiosk-journey.repository.js";
import { KioskDeviceRepository } from "../modules/kiosk/repositories/kiosk-device.repository.js";
import { KioskAnalyticsRepository } from "../modules/kiosk/repositories/kiosk-analytics.repository.js";
import { KioskSecurityService } from "../modules/kiosk/services/kiosk-security.service.js";

export interface KioskSentinelPluginOptions {
  intervalMs?: number; // default: 5 * 60 * 1000 (5 minutes)
  autoStart?: boolean;
}

export interface KioskSentinelController {
  kioskService: KioskService;
  runSentinel: (orgId?: string) => Promise<any>;
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  getIntervalMs: () => number;
}

declare module "fastify" {
  interface FastifyInstance {
    kioskSentinel?: KioskSentinelController;
  }
}

export async function registerKioskSentinel(
  app: FastifyInstance,
  options: KioskSentinelPluginOptions = {}
) {
  const kioskService = new KioskService(
    new KioskJourneyRepository(),
    new KioskDeviceRepository(),
    new KioskAnalyticsRepository(),
    new KioskSecurityService()
  );

  const intervalMs = options.intervalMs ?? 5 * 60 * 1000; // 5 minutes
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const runSentinel = async (orgId?: string) => {
    if (running) return;
    running = true;
    try {
      app.log.info("[KioskSentinel] Running scheduled Kiosk Fleet Health scan...");
      const result = await kioskService.scanKioskFleetHealth(orgId);
      app.log.info(
        `[KioskSentinel] Scan finished: ${result.offlineCount} offline, ${result.lowBatteryCount} low battery, ${result.latencySpikeCount} latency spikes.`
      );
      return result;
    } catch (err) {
      app.log.error(err, "[KioskSentinel] Scheduled scan error");
      throw err;
    } finally {
      running = false;
    }
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(() => {
      runSentinel().catch((err) => {
        app.log.error(err, "[KioskSentinel] Interval run error");
      });
    }, intervalMs);
    if (timer.unref) {
      timer.unref();
    }
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const shouldAutoStart = options.autoStart ?? (process.env.NODE_ENV !== "test");
  if (shouldAutoStart) {
    start();
  }

  app.addHook("onClose", async () => {
    stop();
  });

  const sentinelController: KioskSentinelController = {
    kioskService,
    runSentinel,
    start,
    stop,
    isRunning: () => running,
    getIntervalMs: () => intervalMs,
  };

  if (!app.hasDecorator("kioskSentinel")) {
    app.decorate("kioskSentinel", sentinelController);
  }
}

export default registerKioskSentinel;
