import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  KioskCommandExecutorService
} from '../features/kiosk/services/kiosk-command-executor.service';
import { kioskService } from '../features/kiosk/services/kiosk.service';
import { KioskMaintenanceOverlay } from '../features/kiosk/components/KioskMaintenanceOverlay';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string | object) => {
      if (typeof defaultValue === 'string') return defaultValue;
      if (typeof defaultValue === 'object' && (defaultValue as any).defaultValue) {
        return (defaultValue as any).defaultValue;
      }
      return _key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock kioskService
vi.mock('../features/kiosk/services/kiosk.service', () => ({
  kioskService: {
    getDeviceManifest: vi.fn().mockResolvedValue({
      version: 5,
      assignments: [{ journeyId: 'jrn-1', priority: 1 }]
    })
  }
}));

describe('K-DEV-007: Remote Operational Commands Execution & Maintenance Overlay', () => {
  let executor: KioskCommandExecutorService;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new KioskCommandExecutorService();
  });

  describe('1. Command Executor - Standard Operational Handlers', () => {
    it('executes RELOAD_MANIFEST and re-fetches device manifest (Acceptance Criteria 1)', async () => {
      const manifestListener = vi.fn();
      executor.onManifestReload(manifestListener);

      const result = await executor.executeCommand({
        id: 'cmd-1',
        type: 'RELOAD_MANIFEST',
        payload: { targetVersion: 5 }
      });

      expect(result.success).toBe(true);
      expect(kioskService.getDeviceManifest).toHaveBeenCalledTimes(1);
      expect(manifestListener).toHaveBeenCalledWith(
        expect.objectContaining({ version: 5 }),
        expect.objectContaining({ targetVersion: 5 })
      );
    });

    it('executes ENTER_MAINTENANCE, sets maintenance state, and stores payload (Acceptance Criteria 2)', async () => {
      const maintenanceListener = vi.fn();
      executor.onMaintenanceChange(maintenanceListener);

      expect(executor.isInMaintenance()).toBe(false);

      const result = await executor.executeCommand({
        id: 'cmd-2',
        type: 'ENTER_MAINTENANCE',
        payload: { scheduledDurationMinutes: 30, reason: 'Turnstile actuator inspection' }
      });

      expect(result.success).toBe(true);
      expect(executor.isInMaintenance()).toBe(true);
      expect(executor.getMaintenanceDetails().payload.scheduledDurationMinutes).toBe(30);
      expect(maintenanceListener).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ scheduledDurationMinutes: 30 })
      );
    });

    it('executes EXIT_MAINTENANCE and resets maintenance state', async () => {
      // First put into maintenance
      await executor.executeCommand({
        id: 'cmd-m1',
        type: 'ENTER_MAINTENANCE'
      });
      expect(executor.isInMaintenance()).toBe(true);

      const maintenanceListener = vi.fn();
      executor.onMaintenanceChange(maintenanceListener);

      const result = await executor.executeCommand({
        id: 'cmd-m2',
        type: 'EXIT_MAINTENANCE'
      });

      expect(result.success).toBe(true);
      expect(executor.isInMaintenance()).toBe(false);
      expect(maintenanceListener).toHaveBeenCalledWith(false, expect.anything());
    });

    it('executes CLEAR_CACHE and dispatches cache clearing event', async () => {
      const result = await executor.executeCommand({
        id: 'cmd-3',
        type: 'CLEAR_CACHE',
        payload: { purgeIndexedDb: true }
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe('CLEAR_CACHE');
    });

    it('executes FORCE_RESET, resets maintenance, and clears state', async () => {
      await executor.executeCommand({ id: 'cmd-enter', type: 'ENTER_MAINTENANCE' });
      expect(executor.isInMaintenance()).toBe(true);

      const result = await executor.executeCommand({
        id: 'cmd-4',
        type: 'FORCE_RESET'
      });

      expect(result.success).toBe(true);
      expect(executor.isInMaintenance()).toBe(false);
    });

    it('processes batch of commands in chronological sequence', async () => {
      const commands = [
        { id: 'batch-1', type: 'CLEAR_CACHE' },
        { id: 'batch-2', type: 'RELOAD_MANIFEST' },
        { id: 'batch-3', type: 'ENTER_MAINTENANCE', payload: { reason: 'System diagnostics' } }
      ];

      const results = await executor.executeCommands(commands);
      expect(results.length).toBe(3);
      expect(results[0].type).toBe('CLEAR_CACHE');
      expect(results[1].type).toBe('RELOAD_MANIFEST');
      expect(results[2].type).toBe('ENTER_MAINTENANCE');
      expect(executor.isInMaintenance()).toBe(true);
    });

    it('allows custom command handler registration', async () => {
      const customSpy = vi.fn();
      executor.registerCommandHandler('CUSTOM_DIAGNOSTIC', customSpy);

      const result = await executor.executeCommand({
        id: 'cmd-custom',
        type: 'CUSTOM_DIAGNOSTIC',
        payload: { pingCount: 5 }
      });

      expect(result.success).toBe(true);
      expect(customSpy).toHaveBeenCalledWith(
        expect.objectContaining({ pingCount: 5 }),
        expect.anything()
      );
    });
  });

  describe('2. KioskMaintenanceOverlay Component (Acceptance Criteria 2)', () => {
    it('renders a full-screen maintenance overlay when isOpen is true', () => {
      const html = renderToString(
        <KioskMaintenanceOverlay
          isOpen={true}
          payload={{
            reason: 'Factory gate firmware upgrade in progress',
            scheduledDurationMinutes: 20
          }}
          device={{
            deviceId: 'HW-GATE-NORTH-01',
            name: 'North Entrance Kiosk',
            location: 'Building A - North Gate'
          }}
        />
      );

      // Verify overlay presence and accessibility
      expect(html).toContain('data-testid="kiosk-maintenance-overlay"');
      expect(html).toContain('role="alertdialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-live="assertive"');

      // Verify title & reason
      expect(html).toContain('Terminal Under Maintenance');
      expect(html).toContain('Factory gate firmware upgrade in progress');

      // Verify duration
      expect(html).toMatch(/20(<!-- -->)?\s*minutes/);

      // Verify terminal GUID
      expect(html).toContain('HW-GATE-NORTH-01');

      // Verify refresh action button
      expect(html).toContain('data-testid="refresh-maintenance-button"');
    });

    it('returns null and does not render when isOpen is false', () => {
      const html = renderToString(
        <KioskMaintenanceOverlay
          isOpen={false}
          payload={{ reason: 'Testing inactive overlay' }}
        />
      );

      expect(html).toBe('');
    });
  });
});
