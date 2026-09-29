import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KioskRevokedScreen } from '../features/kiosk/components/KioskRevokedScreen';
import { deviceIdentityService, KIOSK_STORAGE_KEYS } from '../features/kiosk/services/device-identity.service';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue || _key,
  }),
}));

describe('K-DEV-004: Frontend Terminal Revocation & Lockdown Screen Suite', () => {
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

  describe('KioskRevokedScreen Component', () => {
    it('renders the mandatory revocation message according to specification', () => {
      const html = renderToString(<KioskRevokedScreen />);

      expect(html).toContain('data-testid="revocation-message"');
      expect(html).toContain(
        'Device enrollment revoked. Please contact your system administrator.'
      );
      expect(html).toContain('data-testid="kiosk-revoked-lockdown"');
      expect(html).toContain('Terminal Revoked');
      expect(html).toContain('Security Lockdown');
      expect(html).toContain('data-testid="re-enroll-button"');
    });

    it('renders custom revocation message when supplied via props', () => {
      const html = renderToString(
        <KioskRevokedScreen customMessage="Terminal decommissioned by building security." />
      );

      expect(html).toContain('data-testid="revocation-message"');
      expect(html).toContain('Terminal decommissioned by building security.');
    });

    it('clears revocation status when clearRevocationStatus is called', () => {
      // Simulate revoked state in localStorage
      localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_REVOKED, 'true');
      expect(deviceIdentityService.isRevoked()).toBe(true);

      deviceIdentityService.clearRevocationStatus();
      expect(deviceIdentityService.isRevoked()).toBe(false);
      expect(localStorage.getItem(KIOSK_STORAGE_KEYS.DEVICE_REVOKED)).toBeNull();
    });
  });

  describe('Device Identity Revocation State Transitions', () => {
    it('purges device tokens and sets revocation flag on clearDeviceCredentials', () => {
      // Seed paired credentials
      localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_TOKEN, 'test-bearer-token');
      localStorage.setItem(KIOSK_STORAGE_KEYS.IS_PAIRED, 'true');
      localStorage.setItem(KIOSK_STORAGE_KEYS.HARDWARE_GUID, 'guid-12345-abcde');

      // Clear upon revocation
      deviceIdentityService.clearDeviceCredentials();

      expect(localStorage.getItem(KIOSK_STORAGE_KEYS.DEVICE_TOKEN)).toBeNull();
      expect(localStorage.getItem(KIOSK_STORAGE_KEYS.IS_PAIRED)).toBeNull();
      expect(deviceIdentityService.isRevoked()).toBe(true);
      // Ensure hardware GUID is strictly preserved
      expect(localStorage.getItem(KIOSK_STORAGE_KEYS.HARDWARE_GUID)).toBe('guid-12345-abcde');
    });

    it('resets revocation status when new device credentials are saved upon re-pairing', () => {
      // Mark as revoked
      localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_REVOKED, 'true');
      expect(deviceIdentityService.isRevoked()).toBe(true);

      // Re-pair with new token
      deviceIdentityService.setDeviceCredentials(
        {
          _id: 'dev-1',
          organizationId: 'org-1',
          deviceId: 'guid-12345-abcde',
          hardwareGuid: 'guid-12345-abcde',
          name: 'Factory Gate Terminal',
          location: 'Building A',
          status: 'online',
          currentContentVersion: 1,
          telemetry: {}
        } as any,
        'new-fresh-token'
      );

      expect(deviceIdentityService.isRevoked()).toBe(false);
      expect(deviceIdentityService.isPaired()).toBe(true);
      expect(localStorage.getItem(KIOSK_STORAGE_KEYS.DEVICE_TOKEN)).toBe('new-fresh-token');
    });
  });
});
