import { KioskService } from "./kiosk.service.js";
import { KioskJourneyRepository } from "../repositories/kiosk-journey.repository.js";
import { KioskDeviceRepository } from "../repositories/kiosk-device.repository.js";
import { KioskAnalyticsRepository } from "../repositories/kiosk-analytics.repository.js";
import { KioskSecurityService } from "./kiosk-security.service.js";

/**
 * Background scheduler service that periodically evaluates:
 * 1. Scheduled journey publication dates (publishAt <= now) -> activates status to 'published'.
 * 2. Automatic journey expiration dates (expiresAt <= now) -> sets status to 'archived'.
 */
export class KioskPublishingScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private kioskService: KioskService;

  constructor(kioskService?: KioskService) {
    this.kioskService =
      kioskService ||
      new KioskService(
        new KioskJourneyRepository(),
        new KioskDeviceRepository(),
        new KioskAnalyticsRepository(),
        new KioskSecurityService()
      );
  }

  /**
   * Starts the background scheduler loop.
   * Default interval: 60,000ms (1 minute).
   */
  public start(intervalMs = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      try {
        await this.process();
      } catch (err) {
        console.error("[KioskPublishingScheduler] Error during scheduled check:", err);
      }
    }, intervalMs);

    console.log(`[KioskPublishingScheduler] Started with ${intervalMs}ms interval.`);
  }

  /**
   * Stops the background scheduler loop.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[KioskPublishingScheduler] Stopped.");
  }

  /**
   * Executes a single evaluation cycle against current time (or an injected reference time).
   */
  public async process(now = new Date()): Promise<{
    activated: string[];
    expired: string[];
  }> {
    return this.kioskService.processScheduledPublishing(now);
  }

  public getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}

export default KioskPublishingScheduler;
