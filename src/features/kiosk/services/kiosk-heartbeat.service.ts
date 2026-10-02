/**
 * Talnova Kiosk Shell - Heartbeat Telemetry & Command Protocol (K-DEV-005)
 *
 * Implements client-side telemetry heartbeat reporting (battery, latency, storage, screen)
 * with dynamic interval tuning (60s ± 5s jitter) and remote administrative command execution.
 */

import { apiClient } from '../../../api/client';
import { kioskService } from './kiosk.service';
import { kioskCommandExecutorService } from './kiosk-command-executor.service';
import { KioskTelemetry, PendingCommand } from '../../../types/kiosk/device.types';

export interface HeartbeatOptions {
  intervalMs?: number;
  jitterMs?: number;
  appVersion?: string;
  getContentVersion?: () => number;
}

export interface ExecutedCommandLog {
  command: PendingCommand;
  executedAt: Date;
  success: boolean;
  error?: string;
}

export interface HeartbeatStatus {
  isRunning: boolean;
  lastHeartbeatAt?: Date;
  nextHeartbeatAt?: Date;
  lastLatencyMs?: number;
  lastTelemetry?: KioskTelemetry;
  isInMaintenance: boolean;
}

export type CommandHandler = (payload?: any, command?: PendingCommand) => Promise<void> | void;
export type HeartbeatListener = (result: {
  success: boolean;
  serverTime: number;
  commands: PendingCommand[];
  telemetry: KioskTelemetry;
}) => void;

export class KioskHeartbeatService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private intervalMs = 60000;
  private jitterMs = 5000;
  private appVersion = '1.0.0';
  private getContentVersionFn: () => number = () => 0;

  private lastHeartbeatAt?: Date;
  private nextHeartbeatAt?: Date;
  private lastLatencyMs?: number;
  private lastTelemetry?: KioskTelemetry;
  private inMaintenance = false;

  private commandHandlers = new Map<string, CommandHandler>();
  private executedCommandHistory: ExecutedCommandLog[] = [];
  private listeners: HeartbeatListener[] = [];

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Registers default handlers for known remote kiosk commands.
   */
  private registerDefaultHandlers(): void {
    // RELOAD_MANIFEST handler
    this.registerCommandHandler('RELOAD_MANIFEST', async (payload) => {
      try {
        const manifest = await kioskService.getDeviceManifest();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('kiosk:manifest-reload', {
              detail: { manifest, payload }
            })
          );
        }
      } catch (err) {
        console.error('[KioskHeartbeat] Error reloading manifest:', err);
      }
    });

    // ENTER_MAINTENANCE handler
    this.registerCommandHandler('ENTER_MAINTENANCE', (payload) => {
      this.inMaintenance = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kiosk:enter-maintenance', {
            detail: { payload, enteredAt: new Date() }
          })
        );
      }
    });

    // EXIT_MAINTENANCE handler
    this.registerCommandHandler('EXIT_MAINTENANCE', (payload) => {
      this.inMaintenance = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kiosk:exit-maintenance', {
            detail: { payload, exitedAt: new Date() }
          })
        );
      }
    });

    // CLEAR_CACHE / CLEAR_STORAGE handler
    this.registerCommandHandler('CLEAR_CACHE', async (payload) => {
      try {
        if (typeof window !== 'undefined' && 'caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('kiosk:cache-cleared', { detail: { payload } })
          );
        }
      } catch (err) {
        console.error('[KioskHeartbeat] Error clearing cache:', err);
      }
    });

    this.registerCommandHandler('CLEAR_STORAGE', async (payload) => {
      await this.executeCommand({ id: 'alias', type: 'CLEAR_CACHE', payload, createdAt: new Date() });
    });

    // RESTART_APP handler
    this.registerCommandHandler('RESTART_APP', () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kiosk:restart-app'));
        if (window.location && typeof window.location.reload === 'function') {
          window.location.reload();
        }
      }
    });
  }

  /**
   * Starts the automated heartbeat loop.
   */
  public start(options?: HeartbeatOptions): void {
    if (this.running) {
      return;
    }

    if (options?.intervalMs !== undefined) this.intervalMs = options.intervalMs;
    if (options?.jitterMs !== undefined) this.jitterMs = options.jitterMs;
    if (options?.appVersion !== undefined) this.appVersion = options.appVersion;
    if (options?.getContentVersion !== undefined) this.getContentVersionFn = options.getContentVersion;

    this.running = true;

    // Fire initial heartbeat immediately
    void this.sendHeartbeat();
    this.scheduleNextHeartbeat();
  }

  /**
   * Stops the automated heartbeat loop.
   */
  public stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.nextHeartbeatAt = undefined;
  }

  /**
   * Schedules next heartbeat execution with dynamic interval + jitter.
   */
  private scheduleNextHeartbeat(): void {
    if (!this.running) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Dynamic Interval Tuning: 60s ± 5s jitter (window 55,000ms - 65,000ms)
    const jitterRange = this.jitterMs * 2;
    const randomJitter = Math.random() * jitterRange - this.jitterMs;
    const nextInterval = Math.max(5000, Math.round(this.intervalMs + randomJitter));

    this.nextHeartbeatAt = new Date(Date.now() + nextInterval);

    this.timer = setTimeout(() => {
      if (!this.running) return;
      void this.sendHeartbeat().finally(() => {
        if (this.running) {
          this.scheduleNextHeartbeat();
        }
      });
    }, nextInterval);
  }

  /**
   * Inspects client hardware metrics: battery, storage, latency, screen resolution, orientation.
   */
  public async collectTelemetry(): Promise<KioskTelemetry> {
    const telemetry: any = {
      appVersion: this.appVersion
    };

    // 1. Battery Health Metric via Web Battery API
    try {
      if (typeof navigator !== 'undefined' && typeof (navigator as any).getBattery === 'function') {
        const battery = await (navigator as any).getBattery();
        if (battery) {
          telemetry.batteryLevel = typeof battery.level === 'number' ? Math.round(battery.level * 100) / 100 : undefined;
          telemetry.isCharging = typeof battery.charging === 'boolean' ? battery.charging : undefined;
        }
      }
    } catch {
      // Non-critical diagnostic metric failure
    }

    // 2. Storage Consumption Metric via Storage API
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
        const estimate = await navigator.storage.estimate();
        if (estimate) {
          telemetry.storageUsedBytes = typeof estimate.usage === 'number' ? estimate.usage : undefined;
          telemetry.storageTotalBytes = typeof estimate.quota === 'number' ? estimate.quota : undefined;
          if (telemetry.storageTotalBytes !== undefined && telemetry.storageUsedBytes !== undefined) {
            telemetry.storageFreeBytes = Math.max(0, telemetry.storageTotalBytes - telemetry.storageUsedBytes);
          }
        }
      }
    } catch {
      // Storage estimation failure fallback
    }

    // 3. Screen Resolution & Orientation Metrics
    try {
      const scr = typeof window !== 'undefined' && window.screen ? window.screen : (typeof screen !== 'undefined' ? screen : null);
      if (scr && typeof scr.width === 'number' && typeof scr.height === 'number') {
        telemetry.screenResolution = `${scr.width}x${scr.height}`;
        const screenOrientation = scr.orientation?.type;
        if (screenOrientation) {
          telemetry.orientation = screenOrientation;
        } else if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
          telemetry.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        } else {
          telemetry.orientation = scr.width > scr.height ? 'landscape' : 'portrait';
        }
      }
    } catch {
      // Screen diagnostic failure fallback
    }

    // 4. Latency metric
    if (this.lastLatencyMs !== undefined) {
      telemetry.networkLatencyMs = this.lastLatencyMs;
    }

    return telemetry as KioskTelemetry;
  }

  /**
   * Measures network ping latency against the API server.
   */
  public async measurePingLatency(): Promise<number> {
    const startTime = performance.now();
    try {
      await apiClient.get('/health', { timeout: 10000 });
      const duration = Math.round(performance.now() - startTime);
      this.lastLatencyMs = duration;
      return duration;
    } catch {
      const duration = Math.round(performance.now() - startTime);
      this.lastLatencyMs = duration;
      return duration;
    }
  }

  /**
   * Executes a single heartbeat transmission, updates metrics, and dispatches returned commands.
   */
  public async sendHeartbeat(): Promise<{
    success: boolean;
    serverTime: number;
    commands: PendingCommand[];
    telemetry: KioskTelemetry;
  }> {
    // 1. Measure ping latency
    const pingLatency = await this.measurePingLatency();

    // 2. Collect hardware health telemetry
    const baseTelemetry = await this.collectTelemetry();
    const telemetry: KioskTelemetry = {
      ...baseTelemetry,
      networkLatencyMs: pingLatency
    };
    this.lastTelemetry = telemetry;

    const contentVersion = this.getContentVersionFn();

    // 3. Transmit telemetry heartbeat
    let serverTime = Date.now();
    let commands: PendingCommand[] = [];

    try {
      const response = await kioskService.heartbeat({
        currentContentVersion: contentVersion,
        telemetry,
        batteryLevel: telemetry.batteryLevel,
        isCharging: telemetry.isCharging,
        storageUsedBytes: telemetry.storageUsedBytes,
        storageFreeBytes: telemetry.storageFreeBytes,
        storageTotalBytes: telemetry.storageTotalBytes,
        networkLatencyMs: telemetry.networkLatencyMs,
        screenResolution: telemetry.screenResolution,
        orientation: telemetry.orientation,
        appVersion: telemetry.appVersion
      });

      this.lastHeartbeatAt = new Date();
      serverTime = response.serverTime || Date.now();
      commands = response.commands || [];

      // 4. Dispatch and execute returned remote commands
      if (commands.length > 0) {
        for (const cmd of commands) {
          await this.executeCommand(cmd);
        }
      }

      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener({ success: true, serverTime, commands, telemetry });
        } catch (err) {
          console.error('[KioskHeartbeat] Error in listener callback:', err);
        }
      }

      return {
        success: true,
        serverTime,
        commands,
        telemetry
      };
    } catch (error) {
      console.warn('[KioskHeartbeat] Failed to transmit telemetry heartbeat:', error);
      return {
        success: false,
        serverTime,
        commands: [],
        telemetry
      };
    }
  }

  /**
   * Executes a command returned from the heartbeat.
   */
  public async executeCommand(command: PendingCommand): Promise<void> {
    const rawType = command.type || command.command || '';
    const normalizedType = rawType.toUpperCase();

    const handler =
      this.commandHandlers.get(normalizedType) ||
      this.commandHandlers.get(rawType) ||
      this.commandHandlers.get(rawType.toLowerCase());

    const logEntry: ExecutedCommandLog = {
      command,
      executedAt: new Date(),
      success: true
    };

    try {
      if (handler) {
        await handler(command.payload, command);
      }

      // Delegate to centralized command executor
      await kioskCommandExecutorService.executeCommand(command);
      this.inMaintenance = kioskCommandExecutorService.isInMaintenance();

      // Dispatch global window event for the command
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kiosk:command', {
            detail: { command, handled: !!handler }
          })
        );
      }
    } catch (err: any) {
      logEntry.success = false;
      logEntry.error = err?.message || String(err);
      console.error(`[KioskHeartbeat] Failed executing command ${command.id} (${rawType}):`, err);
    } finally {
      this.executedCommandHistory.push(logEntry);
      if (this.executedCommandHistory.length > 50) {
        this.executedCommandHistory.shift();
      }
    }
  }

  /**
   * Registers a custom handler for remote administrative commands.
   */
  public registerCommandHandler(commandType: string, handler: CommandHandler): void {
    this.commandHandlers.set(commandType.toUpperCase(), handler);
  }

  /**
   * Unregisters a command handler.
   */
  public unregisterCommandHandler(commandType: string): void {
    this.commandHandlers.delete(commandType.toUpperCase());
    this.commandHandlers.delete(commandType);
  }

  /**
   * Subscribes to heartbeat completion events.
   */
  public addHeartbeatListener(listener: HeartbeatListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Returns current heartbeat service status and telemetry.
   */
  public getStatus(): HeartbeatStatus {
    return {
      isRunning: this.running,
      lastHeartbeatAt: this.lastHeartbeatAt,
      nextHeartbeatAt: this.nextHeartbeatAt,
      lastLatencyMs: this.lastLatencyMs,
      lastTelemetry: this.lastTelemetry,
      isInMaintenance: this.inMaintenance
    };
  }

  /**
   * Returns history of executed administrative commands.
   */
  public getCommandHistory(): readonly ExecutedCommandLog[] {
    return this.executedCommandHistory;
  }
}

export const kioskHeartbeatService = new KioskHeartbeatService();
export default kioskHeartbeatService;
