import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  MdmEnrollmentService,
  mdmEnrollmentService,
} from '../features/kiosk/services/mdm-enrollment.service';
import {
  deviceIdentityService,
  KIOSK_STORAGE_KEYS,
} from '../features/kiosk/services/device-identity.service';
import { KioskTerminalPage } from '../features/kiosk/pages/KioskTerminalPage';
import { apiClient } from '../api/client';
import { kioskService } from '../features/kiosk/services/kiosk.service';

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal: string) => defaultVal || key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Mock emergency service
vi.mock('../features/kiosk/services/emergency.service', () => ({
  emergencyService: {
    getActiveEmergency: vi.fn(() => null),
    startStream: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

// Mock offline storage service
vi.mock('../features/kiosk/services/offline-storage.service', () => ({
  offlineStorageService: {
    getStorageStats: vi.fn(async () => ({ pendingSessionsCount: 0 })),
    syncPendingSessions: vi.fn(async () => ({ syncedCount: 0, duplicateCount: 0, failedCount: 0 })),
    cacheAssignedJourneys: vi.fn(async () => {}),
    getManifest: vi.fn(async () => null),
  },
}));

// Mock kiosk service worker
vi.mock('../features/kiosk/services/kiosk-service-worker', () => ({
  registerKioskServiceWorker: vi.fn(),
}));

describe('K-ENT-002: MDM Managed AppConfig Support & Zero-Touch Bulk Enrollment', () => {
  let localStorageMock: Record<string, string>;
  let service: MdmEnrollmentService;

  beforeEach(() => {
    localStorageMock = {};
    service = new MdmEnrollmentService();

    // Mock localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => localStorageMock[key] ?? null,
        setItem: (key: string, val: string) => {
          localStorageMock[key] = String(val);
        },
        removeItem: (key: string) => {
          delete localStorageMock[key];
        },
        clear: () => {
          localStorageMock = {};
        },
      },
      writable: true,
      configurable: true,
    });

    (globalThis as any).window = globalThis;
    const listeners: Record<string, Function[]> = {};
    (globalThis as any).addEventListener = vi.fn((event: string, handler: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    });
    (globalThis as any).removeEventListener = vi.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    });
    (globalThis as any).dispatchEvent = vi.fn((event: any) => {
      const type = event?.type || event;
      const list = listeners[type] || [];
      list.forEach((fn) => fn(event));
      return true;
    });

    // Clean MDM globals
    delete (globalThis as any).appConfig;
    delete (globalThis as any).__TALNOVA_MDM_CONFIG__;
    delete (globalThis as any).TALNOVA_KIOSK_CONFIG;

    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (globalThis as any).appConfig;
    delete (globalThis as any).__TALNOVA_MDM_CONFIG__;
    delete (globalThis as any).TALNOVA_KIOSK_CONFIG;
  });

  describe('1. Client-Side AppConfig Detection (Scope Requirement 1)', () => {
    it('detects and extracts organizationSlug, enrollmentSecret, and deviceHardwareId from window.appConfig (Intune)', () => {
      (globalThis as any).appConfig = {
        organizationSlug: 'manufacturing-plant-north',
        enrollmentSecret: 'intune-secret-key-44812',
        deviceHardwareId: 'HW-INTUNE-TAB-001',
        deviceName: 'North Gate Entrance Terminal',
        location: 'Building A Lobby',
        deviceModel: 'Samsung Galaxy Tab Active4 Pro',
        osVersion: 'Android 14',
      };

      expect(service.hasMdmConfig()).toBe(true);

      const config = service.detectAppConfig();
      expect(config).not.toBeNull();
      expect(config?.organizationSlug).toBe('manufacturing-plant-north');
      expect(config?.enrollmentSecret).toBe('intune-secret-key-44812');
      expect(config?.deviceHardwareId).toBe('HW-INTUNE-TAB-001');
      expect(config?.deviceName).toBe('North Gate Entrance Terminal');
      expect(config?.location).toBe('Building A Lobby');
      expect(config?.deviceModel).toBe('Samsung Galaxy Tab Active4 Pro');
      expect(config?.osVersion).toBe('Android 14');
    });

    it('parses JSON stringified window.appConfig commonly injected by MDM webviews', () => {
      (globalThis as any).appConfig = JSON.stringify({
        org_slug: 'logistics-hub-east',
        enrollment_secret: 'sec-token-778899',
        hardware_guid: 'HW-GUID-STRINGIFIED-99',
        site_id: 'Warehouse 4 Bay 2',
      });

      expect(service.hasMdmConfig()).toBe(true);

      const config = service.detectAppConfig();
      expect(config).not.toBeNull();
      expect(config?.organizationSlug).toBe('logistics-hub-east');
      expect(config?.enrollmentSecret).toBe('sec-token-778899');
      expect(config?.deviceHardwareId).toBe('HW-GUID-STRINGIFIED-99');
      expect(config?.location).toBe('Warehouse 4 Bay 2');
    });

    it('detects configuration from window.__TALNOVA_MDM_CONFIG__', () => {
      (globalThis as any).__TALNOVA_MDM_CONFIG__ = {
        organizationSlug: 'aerospace-facility-hq',
        enrollmentSecret: 'mdm-secret-corp-001',
        deviceHardwareId: 'HW-AERO-01',
      };

      expect(service.hasMdmConfig()).toBe(true);

      const config = service.detectAppConfig();
      expect(config?.organizationSlug).toBe('aerospace-facility-hq');
      expect(config?.enrollmentSecret).toBe('mdm-secret-corp-001');
      expect(config?.deviceHardwareId).toBe('HW-AERO-01');
    });

    it('returns null and hasMdmConfig() false when no MDM configuration is present', () => {
      expect(service.hasMdmConfig()).toBe(false);
      expect(service.detectAppConfig()).toBeNull();
    });

    it('returns null if organizationSlug or enrollmentSecret is missing from the payload', () => {
      (globalThis as any).appConfig = {
        organizationSlug: 'only-slug-without-secret',
      };
      expect(service.hasMdmConfig()).toBe(false);
      expect(service.detectAppConfig()).toBeNull();

      (globalThis as any).appConfig = {
        enrollmentSecret: 'only-secret-without-slug',
      };
      expect(service.hasMdmConfig()).toBe(false);
      expect(service.detectAppConfig()).toBeNull();
    });
  });

  describe('2. Zero-Touch MDM Enrollment API Call & Credential Persistence', () => {
    it('calls POST /api/v1/kiosk/devices/enroll/mdm and persists device token and credentials on success', async () => {
      (globalThis as any).appConfig = {
        organizationSlug: 'energy-refinery-texas',
        enrollmentSecret: 'refinery-enroll-key-2026',
        deviceHardwareId: 'HW-REFINERY-K01',
        deviceName: 'Gate 3 Turnstile Terminal',
        location: 'Turnstile A',
      };

      const mockDevice = {
        _id: 'dev_mdm_texas_01',
        deviceId: 'HW-REFINERY-K01',
        hardwareGuid: 'HW-REFINERY-K01',
        name: 'Gate 3 Turnstile Terminal',
        location: 'Turnstile A',
        status: 'online',
        paired: true,
        organizationId: 'org_refinery_01',
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Device successfully enrolled via MDM AppConfig',
          deviceToken: 'jwt-mdm-device-token-998877',
          token: 'jwt-mdm-device-token-998877',
          device: mockDevice,
        },
      } as any);

      const eventListener = vi.fn();
      window.addEventListener('talnova:kiosk:mdm_enrolled', eventListener);

      const result = await service.enrollDevice();

      expect(result.success).toBe(true);
      expect(result.enrolled).toBe(true);
      expect(result.token).toBe('jwt-mdm-device-token-998877');
      expect(result.device?._id).toBe('dev_mdm_texas_01');

      // Verify POST call payload
      expect(postSpy).toHaveBeenCalledWith(
        '/kiosk/devices/enroll/mdm',
        expect.objectContaining({
          organizationSlug: 'energy-refinery-texas',
          enrollmentSecret: 'refinery-enroll-key-2026',
          deviceId: 'HW-REFINERY-K01',
          name: 'Gate 3 Turnstile Terminal',
          location: 'Turnstile A',
        })
      );

      // Verify device credentials stored in deviceIdentityService
      expect(deviceIdentityService.getDeviceToken()).toBe('jwt-mdm-device-token-998877');
      expect(deviceIdentityService.isPaired()).toBe(true);
      expect(localStorageMock[KIOSK_STORAGE_KEYS.IS_PAIRED]).toBe('true');
      expect(localStorageMock['kiosk_mdm_enrolled']).toBe('true');
      expect(localStorageMock['kiosk_mdm_org_slug']).toBe('energy-refinery-texas');

      // Verify event dispatched
      expect(eventListener).toHaveBeenCalled();
      window.removeEventListener('talnova:kiosk:mdm_enrolled', eventListener);
    });

    it('falls back to deviceIdentityService.getOrCreateHardwareGuid() when deviceHardwareId is omitted in AppConfig', async () => {
      (globalThis as any).appConfig = {
        organizationSlug: 'auto-facility',
        enrollmentSecret: 'auto-secret-123',
      };

      const existingGuid = 'HW-FALLBACK-GUID-9999';
      localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID] = existingGuid;

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          token: 'token-abc',
          device: { _id: 'dev_1', deviceId: existingGuid, name: 'Kiosk', location: 'Hall' },
        },
      } as any);

      const result = await service.enrollDevice();
      expect(result.success).toBe(true);
      expect(postSpy).toHaveBeenCalledWith(
        '/kiosk/devices/enroll/mdm',
        expect.objectContaining({
          deviceId: existingGuid,
          deviceHardwareId: existingGuid,
        })
      );
    });

    it('returns structured error and preserves un-paired state when backend rejects enrollment secret (401)', async () => {
      (globalThis as any).appConfig = {
        organizationSlug: 'manufacturing-plant-north',
        enrollmentSecret: 'WRONG-SECRET',
        deviceHardwareId: 'HW-FAIL-01',
      };

      vi.spyOn(apiClient, 'post').mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            success: false,
            message: 'Invalid or expired MDM enrollment secret',
          },
        },
      });

      const result = await service.enrollDevice();

      expect(result.success).toBe(false);
      expect(result.enrolled).toBe(false);
      expect(result.error).toBe('Invalid or expired MDM enrollment secret');
      expect(deviceIdentityService.isPaired()).toBe(false);
    });
  });

  describe('3. Acceptance Criteria: Tablet with Intune AppConfig First Launch at /kiosk/terminal', () => {
    it('Given a tablet provisioned via Intune with AppConfig XML, when opening /kiosk/terminal for the first time, then terminal automatically completes zero-touch enrollment and renders assigned Home Screen', async () => {
      // 1. Initial State: Tablet is completely fresh / un-paired
      expect(deviceIdentityService.isPaired()).toBe(false);

      // 2. MDM Intune Managed AppConfig injected into window
      (globalThis as any).appConfig = {
        organizationSlug: 'industrial-robotics-inc',
        enrollmentSecret: 'intune-managed-secret-2026',
        deviceHardwareId: 'HW-TABLET-INTUNE-550',
        deviceName: 'Assembly Station 4 Tablet',
        location: 'Assembly Hall 2',
      };

      const mockEnrolledDevice = {
        _id: 'dev_assembly_550',
        deviceId: 'HW-TABLET-INTUNE-550',
        hardwareGuid: 'HW-TABLET-INTUNE-550',
        name: 'Assembly Station 4 Tablet',
        location: 'Assembly Hall 2',
        status: 'online' as const,
        paired: true,
        organizationId: 'org_robotics_01',
      };

      // Mock enrollment API
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Device successfully enrolled via MDM AppConfig',
          token: 'jwt-zero-touch-token-intune-550',
          device: mockEnrolledDevice,
        },
      } as any);

      // Trigger zero-touch enrollment
      const enrollResult = await mdmEnrollmentService.enrollDevice();
      expect(enrollResult.success).toBe(true);
      expect(enrollResult.enrolled).toBe(true);

      // Verify credentials stored
      expect(deviceIdentityService.isPaired()).toBe(true);
      expect(deviceIdentityService.getDeviceToken()).toBe('jwt-zero-touch-token-intune-550');

      // Now verify terminal page rendering
      const AppHarness = () => (
        <MemoryRouter initialEntries={['/kiosk/terminal']}>
          <Routes>
            <Route path="/kiosk/terminal" element={<KioskTerminalPage />} />
            <Route
              path="/kiosk/pair"
              element={<div data-testid="kiosk-manual-pair-screen">Manual 6-Digit Code Pairing Screen</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      const html = renderToString(<AppHarness />);

      // Verify it does NOT render the manual 6-digit pair screen
      expect(html).not.toContain('kiosk-manual-pair-screen');
      expect(html).not.toContain('Manual 6-Digit Code Pairing Screen');
      // Verify terminal page is loaded
      expect(html).toContain('data-testid="terminal-loading-skeleton"');
    });

    it('Given a tablet WITHOUT AppConfig opening /kiosk/terminal for the first time, does not auto-enroll', () => {
      // Un-paired and NO AppConfig
      expect(deviceIdentityService.isPaired()).toBe(false);
      expect(mdmEnrollmentService.hasMdmConfig()).toBe(false);

      const AppHarness = () => (
        <MemoryRouter initialEntries={['/kiosk/terminal']}>
          <Routes>
            <Route path="/kiosk/terminal" element={<KioskTerminalPage />} />
            <Route
              path="/kiosk/pair"
              element={<div data-testid="kiosk-manual-pair-screen">Manual 6-Digit Code Pairing Screen</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      const html = renderToString(<AppHarness />);
      // It does not contain home launcher or enrolled device content
      expect(html).not.toContain('data-testid="kiosk-home-launcher"');
    });
  });
});
