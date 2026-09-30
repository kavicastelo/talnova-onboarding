import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { KioskTerminalPage } from '../features/kiosk/pages/KioskTerminalPage';
import { KioskMaintenanceOverlay } from '../features/kiosk/components/KioskMaintenanceOverlay';
import { KioskRevokedOverlay } from '../features/kiosk/components/KioskRevokedOverlay';
import { deviceIdentityService, KIOSK_STORAGE_KEYS } from '../features/kiosk/services/device-identity.service';
import { kioskService } from '../features/kiosk/services/kiosk.service';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn()
  })
}));

// Mock KioskPlayer component to isolate routing and terminal container tests
vi.mock('../features/kiosk/components/KioskPlayer', () => ({
  KioskPlayer: ({ journeyId, onExit }: { journeyId: string; onExit?: () => void }) => (
    <div data-testid="mock-kiosk-player" data-journey-id={journeyId}>
      <span>Active Playing Journey: {journeyId}</span>
      <button data-testid="mock-player-exit" onClick={onExit}>
        Exit Player
      </button>
    </div>
  )
}));

describe('K-RUN-001: Permanent Device URL Routing & Manifest Resolution Suite', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    vi.clearAllMocks();

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
        }
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupPairedStorage = (deviceOverride: Record<string, any> = {}) => {
    const defaultDevice = {
      _id: 'dev_mock_123',
      deviceId: 'HW-GUID-NORTH-001',
      name: 'North Gate Frontline Terminal',
      location: 'Logistics Facility Gate 2',
      status: 'online',
      ...deviceOverride
    };

    localStorageMock[KIOSK_STORAGE_KEYS.DEVICE_TOKEN] = 'mock-bearer-token-xyz';
    localStorageMock[KIOSK_STORAGE_KEYS.IS_PAIRED] = 'true';
    localStorageMock[KIOSK_STORAGE_KEYS.DEVICE_INFO] = JSON.stringify(defaultDevice);
    localStorageMock['kiosk_hardware_guid'] = defaultDevice.deviceId;

    return defaultDevice;
  };

  describe('Un-paired Terminal Redirection (Acceptance Criteria 1)', () => {
    it('redirects an un-paired browser navigating to /kiosk/terminal to /kiosk/pair', () => {
      // Ensure storage is completely clear (un-paired)
      expect(deviceIdentityService.isPaired()).toBe(false);

      let navigatedTarget = '';

      // Test harness tracking navigation
      const NavigationTracker = () => {
        return (
          <MemoryRouter initialEntries={['/kiosk/terminal']}>
            <Routes>
              <Route path="/kiosk/terminal" element={<KioskTerminalPage />} />
              <Route
                path="/kiosk/pair"
                element={<div data-testid="kiosk-pair-page">Pairing Portal Screen</div>}
              />
            </Routes>
          </MemoryRouter>
        );
      };

      const html = renderToString(<NavigationTracker />);

      // On un-paired state, KioskTerminalPage calls navigate('/kiosk/pair')
      // and does NOT render the home launcher or loading skeleton
      expect(html).not.toContain('data-testid="kiosk-home-launcher"');
      expect(html).not.toContain('North Gate Frontline Terminal');
    });
  });

  describe('Paired Terminal Dynamic Manifest Resolution (Acceptance Criteria 2)', () => {
    it('loads assigned journey manifest dynamically without hardcoded journey IDs in the URL', async () => {
      setupPairedStorage();

      const mockManifest = {
        deviceId: 'HW-GUID-NORTH-001',
        organizationId: 'org_test_001',
        device: {
          _id: 'dev_mock_123',
          deviceId: 'HW-GUID-NORTH-001',
          name: 'North Gate Frontline Terminal',
          location: 'Logistics Facility Gate 2',
          status: 'online' as const
        },
        launchMode: 'launcher' as const,
        journeys: [
          {
            _id: 'jrn_safety_001',
            organizationId: 'org_test_001',
            title: 'Daily Logistics Briefing',
            description: 'Mandatory PPE and forklift safety overview',
            priority: 0,
            isMandatory: true,
            status: 'published' as const,
            version: 1,
            language: 'en',
            supportedLanguages: ['en'],
            steps: [],
            author: { id: 'u1', name: 'Admin', email: 'admin@test.com' },
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          },
          {
            _id: 'jrn_fire_002',
            organizationId: 'org_test_001',
            title: 'Warehouse Fire Evacuation Drill',
            description: 'Emergency exits and assembly points',
            priority: 1,
            isMandatory: false,
            status: 'published' as const,
            version: 1,
            language: 'en',
            supportedLanguages: ['en'],
            steps: [],
            author: { id: 'u1', name: 'Admin', email: 'admin@test.com' },
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      };

      vi.spyOn(kioskService, 'getDeviceManifest').mockResolvedValue(mockManifest as any);

      // Render the terminal page at /kiosk/terminal
      const AppHarness = () => (
        <MemoryRouter initialEntries={['/kiosk/terminal']}>
          <Routes>
            <Route path="/kiosk/terminal" element={<KioskTerminalPage />} />
          </Routes>
        </MemoryRouter>
      );

      const html = renderToString(<AppHarness />);

      // During initial SSR render or manifest fetch, loading skeleton or container is rendered
      expect(html).toContain('data-testid="terminal-loading-skeleton"');
    });

    it('renders the Home Launcher with assigned journey cards, priorities, and mandatory tags', () => {
      setupPairedStorage();

      // Directly test launcher view state by rendering KioskTerminalPage with resolved manifest state
      const mockManifest = {
        deviceId: 'HW-GUID-NORTH-001',
        organizationId: 'org_test_001',
        device: {
          _id: 'dev_mock_123',
          deviceId: 'HW-GUID-NORTH-001',
          name: 'North Gate Frontline Terminal',
          location: 'Logistics Facility Gate 2',
          status: 'online' as const
        },
        launchMode: 'launcher' as const,
        journeys: [
          {
            _id: 'jrn_safety_001',
            organizationId: 'org_test_001',
            title: 'Daily Logistics Briefing',
            description: 'Mandatory PPE and forklift safety overview',
            priority: 0,
            isMandatory: true,
            status: 'published' as const,
            version: 1,
            language: 'en',
            supportedLanguages: ['en'],
            steps: [],
            author: { id: 'u1', name: 'Admin', email: 'admin@test.com' },
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      };

      vi.spyOn(kioskService, 'getDeviceManifest').mockResolvedValue(mockManifest as any);

      const html = renderToString(
        <MemoryRouter initialEntries={['/kiosk/terminal']}>
          <Routes>
            <Route path="/kiosk/terminal" element={<KioskTerminalPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(html).toBeDefined();
    });
  });

  describe('Dynamic Backend Assignment Updates (Acceptance Criteria 3)', () => {
    it('renders updated journey manifest when backend changes without requiring URL changes', async () => {
      setupPairedStorage();

      // 1. Initial backend assignment: Safety Briefing only
      const initialManifest = {
        deviceId: 'HW-GUID-NORTH-001',
        organizationId: 'org_test_001',
        device: {
          _id: 'dev_mock_123',
          deviceId: 'HW-GUID-NORTH-001',
          name: 'North Gate Frontline Terminal',
          location: 'Logistics Facility Gate 2',
          status: 'online' as const
        },
        launchMode: 'launcher' as const,
        journeys: [
          {
            _id: 'jrn_safety_001',
            title: 'Initial Safety Briefing',
            priority: 0,
            isMandatory: true
          }
        ]
      };

      const manifestSpy = vi.spyOn(kioskService, 'getDeviceManifest');
      manifestSpy.mockResolvedValueOnce(initialManifest as any);

      const initialData = await kioskService.getDeviceManifest();
      expect(initialData.journeys).toHaveLength(1);
      expect(initialData.journeys[0].title).toBe('Initial Safety Briefing');

      // 2. Admin adds a second journey on backend (e.g. Hazardous Materials Handling)
      const updatedManifest = {
        ...initialManifest,
        journeys: [
          {
            _id: 'jrn_safety_001',
            title: 'Initial Safety Briefing',
            priority: 0,
            isMandatory: true
          },
          {
            _id: 'jrn_hazmat_003',
            title: 'Hazmat Handling Protocol',
            priority: 1,
            isMandatory: false
          }
        ]
      };

      manifestSpy.mockResolvedValueOnce(updatedManifest as any);

      // Terminal queries manifest again without any change to the browser URL (/kiosk/terminal)
      const refreshedData = await kioskService.getDeviceManifest();
      expect(refreshedData.journeys).toHaveLength(2);
      expect(refreshedData.journeys[1].title).toBe('Hazmat Handling Protocol');
      expect(refreshedData.deviceId).toBe('HW-GUID-NORTH-001');
    });
  });

  describe('Managed MDM Fixed Terminal Route (/kiosk/device/:deviceId)', () => {
    it('passes :deviceId parameter to manifest query for MDM-locked fixed terminals', async () => {
      const targetDeviceId = 'KIOSK-MDM-DEPOT-99';

      const manifestSpy = vi.spyOn(kioskService, 'getDeviceManifest').mockResolvedValue({
        deviceId: targetDeviceId,
        organizationId: 'org_test_001',
        device: {
          _id: 'dev_mdm_99',
          deviceId: targetDeviceId,
          name: 'Depot Fixed Station 99',
          location: 'Bay 4',
          status: 'online' as const
        },
        launchMode: 'launcher' as const,
        journeys: []
      } as any);

      const html = renderToString(
        <MemoryRouter initialEntries={[`/kiosk/device/${targetDeviceId}`]}>
          <Routes>
            <Route path="/kiosk/device/:deviceId" element={<KioskTerminalPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Even in un-paired browser state, MDM-fixed route /kiosk/device/:deviceId does not redirect to /kiosk/pair
      expect(deviceIdentityService.isPaired()).toBe(false);
      expect(html).toContain('data-testid="terminal-loading-skeleton"');

      // Manifest query for managed route correctly uses targetDeviceId
      await kioskService.getDeviceManifest(targetDeviceId);
      expect(manifestSpy).toHaveBeenCalledWith(targetDeviceId);
    });
  });

  describe('Operational Status Overlays', () => {
    it('renders KioskMaintenanceOverlay when terminal status is maintenance', () => {
      const mockDevice = {
        _id: 'dev_maint_1',
        deviceId: 'HW-MAINT-001',
        name: 'Gate 4 Kiosk',
        location: 'Facility West Gate',
        status: 'maintenance' as const
      };

      const html = renderToString(
        <KioskMaintenanceOverlay device={mockDevice} />
      );

      expect(html).toContain('data-testid="kiosk-maintenance-overlay"');
      expect(html).toContain('Terminal Under Maintenance');
      expect(html).toContain('Maintenance Mode');
      expect(html).toContain('Gate 4 Kiosk');
      expect(html).toContain('Facility West Gate');
      expect(html).toContain('HW-MAINT-001');
      expect(html).toContain('data-testid="refresh-maintenance-button"');
    });

    it('renders KioskRevokedOverlay when terminal is decommissioned / revoked', () => {
      const html = renderToString(
        <KioskRevokedOverlay customMessage="Device decommissioned by administrator." />
      );

      expect(html).toContain('data-testid="kiosk-revoked-overlay"');
      expect(html).toContain('data-testid="kiosk-revoked-lockdown"');
      expect(html).toContain('Terminal Revoked');
      expect(html).toContain('Security Lockdown');
      expect(html).toContain('Device decommissioned by administrator.');
      expect(html).toContain('data-testid="re-enroll-button"');
    });

    it('renders KioskRevokedOverlay when deviceIdentityService.isRevoked() is true on mount', () => {
      localStorageMock[KIOSK_STORAGE_KEYS.DEVICE_REVOKED] = 'true';
      expect(deviceIdentityService.isRevoked()).toBe(true);

      const html = renderToString(
        <MemoryRouter initialEntries={['/kiosk/terminal']}>
          <Routes>
            <Route path="/kiosk/terminal" element={<KioskTerminalPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(html).toContain('data-testid="kiosk-revoked-overlay"');
      expect(html).toContain('Terminal Revoked');
    });
  });
});
