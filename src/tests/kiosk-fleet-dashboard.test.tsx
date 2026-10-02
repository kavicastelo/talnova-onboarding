import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FleetDashboardTab } from '../features/kiosk/components/fleet/FleetDashboardTab';
import {
  DeviceDetailDrawer,
  normalizeBatteryPercent,
  isLowBattery,
  formatBytes
} from '../features/kiosk/components/fleet/DeviceDetailDrawer';
import { KioskDevice } from '../types/kiosk/device.types';
import { KioskJourney } from '../types/kiosk/journey.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

describe('K-DEV-006: Fleet Management Dashboard & Telemetry Drawer Suite', () => {
  const mockJourneys: KioskJourney[] = [
    {
      _id: 'jrn-1',
      organizationId: 'org-1',
      title: 'Warehouse Safety Inspection',
      description: 'Standard OSHA warehouse safety check',
      steps: [],
      publishing: { status: 'published', version: 1 },
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    } as any,
    {
      _id: 'jrn-2',
      organizationId: 'org-1',
      title: 'Hazmat Handling Protocol',
      description: 'Dangerous materials safety procedure',
      steps: [],
      publishing: { status: 'published', version: 2 },
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    } as any
  ];

  const mockDevices: KioskDevice[] = [
    {
      _id: 'dev-1',
      organizationId: 'org-1',
      deviceId: 'HW-GUID-NORTH-GATE-01',
      hardwareGuid: 'HW-GUID-NORTH-GATE-01',
      name: 'North Gate Kiosk',
      location: 'Plant A - Gate 1',
      deviceType: 'wall_mount',
      status: 'online',
      currentContentVersion: 1,
      lastSeen: new Date(),
      pairedAt: new Date('2026-09-01'),
      telemetry: {
        batteryLevel: 0.85,
        isCharging: true,
        storageUsedBytes: 2147483648, // 2 GB
        storageFreeBytes: 8589934592, // 8 GB
        storageTotalBytes: 10737418240, // 10 GB
        networkLatencyMs: 22,
        screenResolution: '1920x1080',
        orientation: 'landscape-primary',
        appVersion: '1.2.0'
      },
      assignments: [
        {
          _id: 'asgn-1',
          journeyId: 'jrn-1',
          priority: 1,
          isMandatory: true
        }
      ]
    } as any,
    {
      _id: 'dev-2',
      organizationId: 'org-1',
      deviceId: 'HW-GUID-DOCK-B-02',
      hardwareGuid: 'HW-GUID-DOCK-B-02',
      name: 'Loading Dock B Tablet',
      location: 'Plant B - Dock 2',
      deviceType: 'countertop_tablet',
      status: 'online',
      currentContentVersion: 1,
      lastSeen: new Date(),
      pairedAt: new Date('2026-09-10'),
      telemetry: {
        batteryLevel: 0.14, // 14% -> Low battery (< 20%)
        isCharging: false,
        storageUsedBytes: 5368709120,
        storageFreeBytes: 1073741824,
        storageTotalBytes: 6442450944,
        networkLatencyMs: 45,
        screenResolution: '1200x1920',
        orientation: 'portrait',
        appVersion: '1.2.0'
      },
      assignments: [
        {
          _id: 'asgn-2',
          journeyId: 'jrn-2',
          priority: 1,
          isMandatory: false
        }
      ]
    } as any,
    {
      _id: 'dev-3',
      organizationId: 'org-1',
      deviceId: 'HW-GUID-SOUTH-MAINT-03',
      hardwareGuid: 'HW-GUID-SOUTH-MAINT-03',
      name: 'South Facility Terminal',
      location: 'Plant A - South Facility',
      deviceType: 'floor_standing',
      status: 'maintenance',
      currentContentVersion: 1,
      lastSeen: new Date(),
      telemetry: {
        batteryLevel: 0.95,
        isCharging: false,
        networkLatencyMs: 18
      }
    } as any,
    {
      _id: 'dev-4',
      organizationId: 'org-1',
      deviceId: 'HW-GUID-WEST-OFFLINE-04',
      hardwareGuid: 'HW-GUID-WEST-OFFLINE-04',
      name: 'West Warehouse Stand',
      location: 'Plant C - West Wing',
      deviceType: 'desktop_terminal',
      status: 'offline',
      currentContentVersion: 1,
      lastSeen: new Date(Date.now() - 3600000),
      telemetry: {}
    } as any
  ];

  describe('1. Summary Metric Badges (Requirement 1)', () => {
    it('renders all summary status cards with correct counts', () => {
      const html = renderToString(
        <FleetDashboardTab
          devices={mockDevices}
          journeys={mockJourneys}
          onRefreshFleet={vi.fn()}
          onPairTerminal={vi.fn()}
          onToggleMaintenance={vi.fn()}
          onDispatchCommand={vi.fn()}
          onRevokeDevice={vi.fn()}
          onManageAssignments={vi.fn()}
        />
      );

      // Verify Summary cards presence
      expect(html).toContain('data-testid="fleet-summary-cards"');
      expect(html).toContain('data-testid="metric-total-fleet"');
      expect(html).toContain('data-testid="metric-online"');
      expect(html).toContain('data-testid="metric-offline"');
      expect(html).toContain('data-testid="metric-maintenance"');
      expect(html).toContain('data-testid="metric-low-battery"');

      // Verify calculated counts: Total = 4, Online = 2, Offline = 1, Maintenance = 1, Low Battery = 1
      expect(html).toMatch(/data-testid="total-fleet-count"[^>]*>\s*4\s*</);
      expect(html).toMatch(/data-testid="online-count"[^>]*>\s*2\s*</);
      expect(html).toMatch(/data-testid="offline-count"[^>]*>\s*1\s*</);
      expect(html).toMatch(/data-testid="maintenance-count"[^>]*>\s*1\s*</);
      expect(html).toMatch(/data-testid="low-battery-count"[^>]*>\s*1\s*</);
    });
  });

  describe('2. Visual Battery Indicator & Low-Battery Alert (Requirement 3 & Acceptance Criteria)', () => {
    it('renders a prominent warning badge when device battery is below 20%', () => {
      const html = renderToString(
        <FleetDashboardTab
          devices={mockDevices}
          journeys={mockJourneys}
          onRefreshFleet={vi.fn()}
          onPairTerminal={vi.fn()}
          onToggleMaintenance={vi.fn()}
          onDispatchCommand={vi.fn()}
          onRevokeDevice={vi.fn()}
          onManageAssignments={vi.fn()}
        />
      );

      // Low battery warning badge must be rendered for dev-2 (14%)
      expect(html).toContain('data-testid="low-battery-badge"');
      expect(html).toMatch(/Low Battery \((&lt;|<)20%\)/);

      // Device 2 row renders battery percentage 14%
      expect(html).toContain('14%');
      // Device 1 row renders battery percentage 85%
      expect(html).toContain('85%');
    });

    it('correctly normalizes decimal battery levels (0.14 -> 14%) and integer percentages (14 -> 14%)', () => {
      expect(normalizeBatteryPercent(0.14)).toBe(14);
      expect(normalizeBatteryPercent(14)).toBe(14);
      expect(normalizeBatteryPercent(0.85)).toBe(85);
      expect(normalizeBatteryPercent(85)).toBe(85);
      expect(normalizeBatteryPercent(undefined)).toBeNull();

      expect(isLowBattery(0.14)).toBe(true);
      expect(isLowBattery(14)).toBe(true);
      expect(isLowBattery(0.20)).toBe(false);
      expect(isLowBattery(85)).toBe(false);
    });
  });

  describe('3. Fleet Action Buttons & Toolbar Controls (Requirement 2 & 4)', () => {
    it('renders quick search input and filter dropdowns', () => {
      const html = renderToString(
        <FleetDashboardTab
          devices={mockDevices}
          journeys={mockJourneys}
          onRefreshFleet={vi.fn()}
          onPairTerminal={vi.fn()}
          onToggleMaintenance={vi.fn()}
          onDispatchCommand={vi.fn()}
          onRevokeDevice={vi.fn()}
          onManageAssignments={vi.fn()}
        />
      );

      // Search input
      expect(html).toContain('data-testid="fleet-search-input"');
      expect(html).toContain('Search by device name, GUID, or location...');

      // Filter controls
      expect(html).toContain('data-testid="status-filter-select"');
      expect(html).toContain('data-testid="site-filter-select"');
      expect(html).toContain('data-testid="device-type-filter-select"');

      // Action buttons: Pair Terminal & Refresh Fleet
      expect(html).toContain('data-testid="pair-terminal-btn"');
      expect(html).toContain('Pair Terminal');
      expect(html).toContain('data-testid="refresh-fleet-btn"');
      expect(html).toContain('Refresh Fleet');
    });

    it('renders row-level action buttons for maintenance, inspect, and revoke', () => {
      const html = renderToString(
        <FleetDashboardTab
          devices={mockDevices}
          journeys={mockJourneys}
          onRefreshFleet={vi.fn()}
          onPairTerminal={vi.fn()}
          onToggleMaintenance={vi.fn()}
          onDispatchCommand={vi.fn()}
          onRevokeDevice={vi.fn()}
          onManageAssignments={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="inspect-device-dev-1"');
      expect(html).toContain('data-testid="toggle-maintenance-dev-1"');
      expect(html).toContain('data-testid="revoke-device-dev-1"');
    });
  });

  describe('4. DeviceDetailDrawer Diagnostic Deep-Inspection (Acceptance Criteria)', () => {
    it('renders hardware GUID, real-time telemetry, and assigned journeys in detail drawer', () => {
      const targetDevice = mockDevices[0]; // North Gate Kiosk

      const html = renderToString(
        <DeviceDetailDrawer
          device={targetDevice}
          isOpen={true}
          onClose={vi.fn()}
          journeys={mockJourneys}
          onToggleMaintenance={vi.fn()}
          onDispatchCommand={vi.fn()}
          onRevokeDevice={vi.fn()}
          onManageAssignments={vi.fn()}
        />
      );

      // Verify drawer container
      expect(html).toContain('data-testid="device-detail-drawer"');
      expect(html).toContain('data-testid="drawer-device-name"');
      expect(html).toContain('North Gate Kiosk');

      // Verify Hardware GUID display
      expect(html).toContain('data-testid="drawer-hardware-guid"');
      expect(html).toContain('HW-GUID-NORTH-GATE-01');
      expect(html).toContain('data-testid="copy-guid-btn"');

      // Verify Telemetry metrics
      expect(html).toContain('data-testid="drawer-telemetry-section"');
      expect(html).toContain('data-testid="telemetry-battery-card"');
      expect(html).toContain('data-testid="battery-percentage"');
      expect(html).toContain('85%');
      expect(html).toContain('Charging'); // isCharging: true

      expect(html).toContain('data-testid="telemetry-latency-card"');
      expect(html).toContain('data-testid="latency-value"');
      expect(html).toContain('22 ms');
      expect(html).toContain('Optimal'); // < 50ms

      expect(html).toContain('data-testid="telemetry-storage-card"');
      expect(html).toContain('data-testid="storage-value"');
      expect(html).toContain('8.0 GB Free');

      expect(html).toContain('data-testid="telemetry-screen-card"');
      expect(html).toContain('data-testid="screen-resolution"');
      expect(html).toContain('1920x1080');

      // Verify Assigned Journeys section
      expect(html).toContain('data-testid="drawer-assignments-section"');
      expect(html).toContain('Warehouse Safety Inspection');
      expect(html).toContain('Mandatory');
      expect(html).toMatch(/Priority Order:\s*(<!-- -->)?\s*1/);

      // Verify drawer action buttons
      expect(html).toContain('data-testid="drawer-toggle-maintenance-btn"');
      expect(html).toContain('data-testid="drawer-sync-cache-btn"');
      expect(html).toContain('data-testid="drawer-restart-app-btn"');
      expect(html).toContain('data-testid="drawer-revoke-device-btn"');
    });

    it('renders low battery critical warning badge in drawer when battery < 20%', () => {
      const lowBatDevice = mockDevices[1]; // Loading Dock B Tablet (14%)

      const html = renderToString(
        <DeviceDetailDrawer
          device={lowBatDevice}
          isOpen={true}
          onClose={vi.fn()}
          journeys={mockJourneys}
        />
      );

      expect(html).toContain('data-testid="low-battery-badge"');
      expect(html).toContain('14%');
      expect(html).toContain('Critical: Connect terminal to AC power');
    });

    it('does not render drawer content when isOpen is false', () => {
      const html = renderToString(
        <DeviceDetailDrawer
          device={mockDevices[0]}
          isOpen={false}
          onClose={vi.fn()}
        />
      );

      expect(html).toBe('');
    });
  });

  describe('5. Byte Formatting Utility', () => {
    it('correctly formats byte sizes into human-readable strings', () => {
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(2048)).toBe('2.0 KB');
      expect(formatBytes(5242880)).toBe('5.0 MB');
      expect(formatBytes(10737418240)).toBe('10.0 GB');
      expect(formatBytes(undefined)).toBe('N/A');
    });
  });
});
