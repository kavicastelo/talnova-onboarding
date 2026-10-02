import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  KioskHeartbeatService
} from '../features/kiosk/services/kiosk-heartbeat.service';
import { kioskService } from '../features/kiosk/services/kiosk.service';
import { apiClient } from '../api/client';

describe('K-DEV-005: Client-side KioskHeartbeatService Suite', () => {
  let service: KioskHeartbeatService;
  let eventListeners: Record<string, Function[]>;
  let mockWindow: any;

  beforeEach(() => {
    vi.useFakeTimers();

    eventListeners = {};

    if (typeof (globalThis as any).CustomEvent === 'undefined') {
      (globalThis as any).CustomEvent = class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, params: any = {}) {
          this.type = type;
          this.detail = params.detail;
        }
      };
    }

    mockWindow = {
      screen: {
        width: 1920,
        height: 1080,
        orientation: { type: 'landscape-primary' }
      },
      innerWidth: 1920,
      innerHeight: 1080,
      location: { reload: vi.fn() },
      addEventListener: vi.fn((evt: string, fn: Function) => {
        eventListeners[evt] = eventListeners[evt] || [];
        eventListeners[evt].push(fn);
      }),
      removeEventListener: vi.fn((evt: string, fn: Function) => {
        if (eventListeners[evt]) {
          eventListeners[evt] = eventListeners[evt].filter((f) => f !== fn);
        }
      }),
      dispatchEvent: vi.fn((evt: any) => {
        const fns = eventListeners[evt.type] || [];
        fns.forEach((fn) => fn(evt));
        return true;
      })
    };

    (globalThis as any).window = mockWindow;
    (globalThis as any).caches = {
      keys: vi.fn().mockResolvedValue(['cache-v1', 'cache-v2']),
      delete: vi.fn().mockResolvedValue(true)
    };

    service = new KioskHeartbeatService();

    // Mock API client
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { status: 'healthy' } } as any);

    // Mock kioskService.heartbeat
    vi.spyOn(kioskService, 'heartbeat').mockResolvedValue({
      success: true,
      serverTime: Date.now(),
      commands: [],
      data: {}
    });
  });

  afterEach(() => {
    service.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('1. Hardware Health Telemetry Collection', () => {
    it('should collect battery metrics when navigator.getBattery is available', async () => {
      // Mock navigator.getBattery
      Object.defineProperty(globalThis.navigator, 'getBattery', {
        value: vi.fn().mockResolvedValue({
          level: 0.85,
          charging: true
        }),
        configurable: true
      });

      const telemetry = await service.collectTelemetry();
      expect(telemetry.batteryLevel).toBe(0.85);
      expect(telemetry.isCharging).toBe(true);
    });

    it('should collect storage metrics when navigator.storage.estimate is available', async () => {
      Object.defineProperty(globalThis.navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 500000000,
            quota: 2000000000
          })
        },
        configurable: true
      });

      const telemetry = await service.collectTelemetry();
      expect(telemetry.storageUsedBytes).toBe(500000000);
      expect(telemetry.storageTotalBytes).toBe(2000000000);
      expect(telemetry.storageFreeBytes).toBe(1500000000);
    });

    it('should collect screen resolution and orientation', async () => {
      const telemetry = await service.collectTelemetry();
      expect(telemetry.screenResolution).toBe('1920x1080');
      expect(telemetry.orientation).toBe('landscape-primary');
    });

    it('should measure network ping latency against the API server', async () => {
      const duration = await service.measurePingLatency();
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(service.getStatus().lastLatencyMs).toBeDefined();
    });
  });

  describe('2. Automated Heartbeat Loop & Jitter Interval Tuning', () => {
    it('should schedule next heartbeat with 60s ± 5s jitter window', () => {
      service.start({ intervalMs: 60000, jitterMs: 5000 });
      expect(service.getStatus().isRunning).toBe(true);

      const nextAt = service.getStatus().nextHeartbeatAt;
      expect(nextAt).toBeDefined();

      const diff = nextAt!.getTime() - Date.now();
      expect(diff).toBeGreaterThanOrEqual(55000);
      expect(diff).toBeLessThanOrEqual(65000);

      service.stop();
      expect(service.getStatus().isRunning).toBe(false);
    });

    it('should invoke sendHeartbeat periodically according to timer', async () => {
      const sendSpy = vi.spyOn(service, 'sendHeartbeat');

      service.start({ intervalMs: 10000, jitterMs: 1000 });
      expect(sendSpy).toHaveBeenCalledTimes(1); // Initial heartbeat

      // Advance timers by 12 seconds
      await vi.advanceTimersByTimeAsync(12000);
      expect(sendSpy).toHaveBeenCalledTimes(2);

      service.stop();
    });
  });

  describe('3. Remote Administrative Command Dispatch', () => {
    it('should execute RELOAD_MANIFEST command and dispatch custom event', async () => {
      const manifestMock = { deviceId: 'test-dev', launchMode: 'launcher', journeys: [] };
      vi.spyOn(kioskService, 'getDeviceManifest').mockResolvedValue(manifestMock as any);

      let eventReceived: any = null;
      const listener = (e: any) => {
        eventReceived = e.detail;
      };
      mockWindow.addEventListener('kiosk:manifest-reload', listener);

      await service.executeCommand({
        id: 'cmd-1',
        type: 'RELOAD_MANIFEST',
        payload: { targetVersion: 3 },
        createdAt: new Date()
      });

      expect(kioskService.getDeviceManifest).toHaveBeenCalled();
      expect(eventReceived).not.toBeNull();
      expect(eventReceived.payload.targetVersion).toBe(3);

      mockWindow.removeEventListener('kiosk:manifest-reload', listener);
    });

    it('should execute ENTER_MAINTENANCE and EXIT_MAINTENANCE commands', async () => {
      await service.executeCommand({
        id: 'cmd-m1',
        type: 'ENTER_MAINTENANCE',
        payload: { reason: 'Screen repair' },
        createdAt: new Date()
      });

      expect(service.getStatus().isInMaintenance).toBe(true);

      await service.executeCommand({
        id: 'cmd-m2',
        type: 'EXIT_MAINTENANCE',
        payload: { reason: 'Screen repaired' },
        createdAt: new Date()
      });

      expect(service.getStatus().isInMaintenance).toBe(false);
    });

    it('should execute CLEAR_CACHE command', async () => {
      let cacheClearedEvent = false;
      const listener = () => {
        cacheClearedEvent = true;
      };
      mockWindow.addEventListener('kiosk:cache-cleared', listener);

      await service.executeCommand({
        id: 'cmd-c1',
        type: 'CLEAR_CACHE',
        payload: {},
        createdAt: new Date()
      });

      expect(cacheClearedEvent).toBe(true);
      mockWindow.removeEventListener('kiosk:cache-cleared', listener);
    });

    it('should execute custom registered command handlers', async () => {
      const customHandler = vi.fn();
      service.registerCommandHandler('CUSTOM_DIAGNOSTIC', customHandler);

      await service.executeCommand({
        id: 'cmd-cust-1',
        type: 'CUSTOM_DIAGNOSTIC',
        payload: { runDeepScan: true },
        createdAt: new Date()
      });

      expect(customHandler).toHaveBeenCalledWith({ runDeepScan: true }, expect.anything());

      const history = service.getCommandHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].success).toBe(true);
    });

    it('should process commands returned in heartbeat response', async () => {
      vi.spyOn(kioskService, 'heartbeat').mockResolvedValue({
        success: true,
        serverTime: Date.now(),
        commands: [
          {
            id: 'cmd-ret-1',
            type: 'ENTER_MAINTENANCE',
            payload: {},
            createdAt: new Date()
          }
        ],
        data: {}
      });

      await service.sendHeartbeat();
      expect(service.getStatus().isInMaintenance).toBe(true);
    });
  });
});
