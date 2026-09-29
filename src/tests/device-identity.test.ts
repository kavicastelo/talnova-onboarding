import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DeviceIdentityService,
  KIOSK_STORAGE_KEYS
} from '../features/kiosk/services/device-identity.service';
import { KioskDevice } from '../types/kiosk/device.types';

describe('K-DEV-001: DeviceIdentityService & Hardware GUID Identity Suite', () => {
  let localStorageMock: Record<string, string>;
  let mockIdbStore: Map<string, any>;
  let service: DeviceIdentityService;

  const createMockIdb = () => {
    mockIdbStore = new Map<string, any>();
    return {
      open: () => {
        const req: any = {
          result: {
            objectStoreNames: { contains: () => true },
            createObjectStore: () => {},
            transaction: () => ({
              objectStore: () => ({
                get: (key: string) => {
                  const getReq: any = { result: mockIdbStore.get(key) };
                  setTimeout(() => getReq.onsuccess && getReq.onsuccess({ target: getReq }), 0);
                  return getReq;
                },
                put: (item: any) => {
                  mockIdbStore.set(item.key, item);
                  const putReq: any = { result: item.key };
                  setTimeout(() => putReq.onsuccess && putReq.onsuccess({ target: putReq }), 0);
                  return putReq;
                },
                delete: (key: string) => {
                  mockIdbStore.delete(key);
                  const delReq: any = { result: undefined };
                  setTimeout(() => delReq.onsuccess && delReq.onsuccess({ target: delReq }), 0);
                  return delReq;
                }
              })
            })
          }
        };
        setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
        return req;
      }
    };
  };

  beforeEach(() => {
    localStorageMock = {};
    service = new DeviceIdentityService();

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
        }
      },
      writable: true,
      configurable: true
    });

    // Mock indexedDB
    const idbMock = createMockIdb();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: idbMock,
      writable: true,
      configurable: true
    });

    (globalThis as any).window = globalThis;

    // Clean up window MDM globals
    delete (globalThis as any).__TALNOVA_MDM_CONFIG__;
    delete (globalThis as any).TALNOVA_KIOSK_CONFIG;
    if ((globalThis as any).window) {
      delete (globalThis as any).window.__TALNOVA_MDM_CONFIG__;
      delete (globalThis as any).window.TALNOVA_KIOSK_CONFIG;
    }

    vi.restoreAllMocks();
  });

  describe('First Boot & Hardware GUID Generation', () => {
    it('generates and persists a valid RFC 4122 UUIDv4 on first boot', async () => {
      const mockUuid = 'e8b0cf22-9011-4f18-b2a1-fa36c2cf5298';
      const randomUuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUuid as any);

      const guid = await service.getOrCreateHardwareGuid();

      expect(randomUuidSpy).toHaveBeenCalled();
      expect(guid).toBe(mockUuid);

      // Verify persistence to localStorage
      expect(localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID]).toBe(mockUuid);
      expect(localStorageMock[KIOSK_STORAGE_KEYS.LEGACY_DEVICE_ID]).toBe(mockUuid);

      // Verify sync retrieval matches
      expect(service.getHardwareGuidSync()).toBe(mockUuid);
    });

    it('generates an RFC 4122 v4 compliant format when using native crypto.randomUUID', async () => {
      // Allow native or standard UUIDv4 generator
      const guid = await service.getOrCreateHardwareGuid();
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidv4Regex.test(guid)).toBe(true);
    });
  });

  describe('Reboot & Persistence Invariance', () => {
    it('returns the exact same hardware GUID across subsequent reboots without regenerating', async () => {
      const initialUuid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(initialUuid as any);

      const firstBootGuid = await service.getOrCreateHardwareGuid();
      expect(firstBootGuid).toBe(initialUuid);

      // Simulate a terminal reboot with fresh service instance but persisted localStorage
      const rebootService = new DeviceIdentityService();
      const randomUuidSpy = vi.spyOn(crypto, 'randomUUID');
      randomUuidSpy.mockClear();

      const rebootGuid = await rebootService.getOrCreateHardwareGuid();

      expect(rebootGuid).toBe(initialUuid);
      expect(randomUuidSpy).not.toHaveBeenCalled();
    });
  });

  describe('MDM Configuration Priority (ADR-003)', () => {
    it('prioritizes window.__TALNOVA_MDM_CONFIG__.hardwareGuid over local storage', async () => {
      const mdmGuid = '00000000-0000-4000-8000-000000000001';
      localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID] = 'existing-local-guid-1234-4567';

      window.__TALNOVA_MDM_CONFIG__ = {
        hardwareGuid: mdmGuid,
        siteId: 'site-factory-1',
      };

      const guid = await service.getOrCreateHardwareGuid();

      expect(guid).toBe(mdmGuid);
      expect(service.isMdmProvisioned()).toBe(true);
      expect(localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID]).toBe(mdmGuid);
    });

    it('adopts window.TALNOVA_KIOSK_CONFIG.hardwareGuid if __TALNOVA_MDM_CONFIG__ is absent', async () => {
      const kioskConfigGuid = '11111111-1111-4111-8111-111111111111';
      window.TALNOVA_KIOSK_CONFIG = {
        hardwareGuid: kioskConfigGuid,
      };

      const guid = await service.getOrCreateHardwareGuid();
      expect(guid).toBe(kioskConfigGuid);
      expect(service.isMdmProvisioned()).toBe(true);
    });
  });

  describe('IndexedDB Resilient Recovery', () => {
    it('recovers hardware GUID from IndexedDB when localStorage has been cleared or evicted', async () => {
      const idbPersistedGuid = '44444444-4444-4444-8444-444444444444';
      mockIdbStore.set('hardware_guid', {
        key: 'hardware_guid',
        value: idbPersistedGuid,
        updatedAt: Date.now()
      });

      // Local storage is completely empty (simulating browser storage cache wipe)
      expect(localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID]).toBeUndefined();

      const restoredGuid = await service.getOrCreateHardwareGuid();

      expect(restoredGuid).toBe(idbPersistedGuid);
      // Confirms restored back to localStorage for synchronous lookups
      expect(localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID]).toBe(idbPersistedGuid);
    });
  });

  describe('Device Credentials & Decommissioning Lifecycle', () => {
    const mockDevice: KioskDevice = {
      _id: 'dev_123',
      organizationId: 'org_abc',
      deviceId: 'e8b0cf22-9011-4f18-b2a1-fa36c2cf5298',
      hardwareGuid: 'e8b0cf22-9011-4f18-b2a1-fa36c2cf5298',
      name: 'Plant Entrance Terminal 1',
      location: 'Gate 4 North',
      status: 'online',
      paired: true,
      lastSeen: new Date().toISOString(),
      currentContentVersion: 1,
      telemetry: {
        batteryLevel: 0.95,
        isCharging: true
      }
    };

    it('sets and retrieves device credentials, status, and pairing state', () => {
      expect(service.isPaired()).toBe(false);
      expect(service.getDeviceToken()).toBeNull();

      service.setDeviceCredentials(mockDevice, 'bearer-device-token-xyz');

      expect(service.isPaired()).toBe(true);
      expect(service.getDeviceToken()).toBe('bearer-device-token-xyz');
      expect(service.getDeviceStatus()).toBe('online');
      expect(service.getStoredDevice()?.name).toBe('Plant Entrance Terminal 1');
      expect(localStorageMock[KIOSK_STORAGE_KEYS.DEVICE_NAME]).toBe('Plant Entrance Terminal 1');
      expect(localStorageMock[KIOSK_STORAGE_KEYS.DEVICE_LOCATION]).toBe('Gate 4 North');
    });

    it('clears credentials upon decommissioning while strictly preserving the hardware GUID', async () => {
      const fixedGuid = 'e8b0cf22-9011-4f18-b2a1-fa36c2cf5298';
      localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID] = fixedGuid;

      service.setDeviceCredentials(mockDevice, 'bearer-device-token-xyz');
      expect(service.isPaired()).toBe(true);

      // Decommission / unpair device
      service.clearDeviceCredentials();

      expect(service.isPaired()).toBe(false);
      expect(service.getDeviceToken()).toBeNull();
      expect(service.getStoredDevice()).toBeNull();

      // Hardware GUID MUST remain intact (ADR-003: hardware anchor is permanent)
      expect(localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID]).toBe(fixedGuid);
      expect(await service.getOrCreateHardwareGuid()).toBe(fixedGuid);
    });

    it('gracefully handles malformed JSON in stored device metadata', () => {
      localStorageMock[KIOSK_STORAGE_KEYS.DEVICE_INFO] = '{ corrupted json';
      expect(service.getStoredDevice()).toBeNull();
      expect(service.getDeviceStatus()).toBeNull();
    });
  });

  describe('Ad-hoc Legacy ID Deprecation & Migration (ADR-003)', () => {
    it('rejects legacy non-standard random IDs and generates a compliant UUIDv4', async () => {
      // Old implementation used: 'kiosk-' + Math.random().toString(36)...
      localStorageMock[KIOSK_STORAGE_KEYS.LEGACY_DEVICE_ID] = 'kiosk-9f3b2a-1727650000000';

      const guid = await service.getOrCreateHardwareGuid();

      // Ensure the ad-hoc random string was discarded
      expect(guid).not.toBe('kiosk-9f3b2a-1727650000000');
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidv4Regex.test(guid)).toBe(true);
      expect(localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID]).toBe(guid);
    });

    it('adopts legacy device ID if it is already a compliant UUIDv4', async () => {
      const validLegacyUuid = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
      localStorageMock[KIOSK_STORAGE_KEYS.LEGACY_DEVICE_ID] = validLegacyUuid;

      const guid = await service.getOrCreateHardwareGuid();

      expect(guid).toBe(validLegacyUuid);
      expect(localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID]).toBe(validLegacyUuid);
    });
  });

  describe('Resilience When Storage APIs Fail', () => {
    it('functions when IndexedDB is unavailable or throws errors', async () => {
      // Simulate environment where indexedDB is completely null
      Object.defineProperty(globalThis, 'indexedDB', {
        value: null,
        writable: true,
        configurable: true
      });

      const guid = await service.getOrCreateHardwareGuid();
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidv4Regex.test(guid)).toBe(true);
      expect(localStorageMock[KIOSK_STORAGE_KEYS.HARDWARE_GUID]).toBe(guid);
    });
  });

  describe('Token Expiration & Automatic Rotation (K-DEV-003)', () => {
    function createMockJwt(expUnixSeconds: number): string {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({
        deviceId: 'hw-guid-001',
        organizationId: 'org-001',
        role: 'kiosk_device',
        exp: expUnixSeconds,
        iat: Math.floor(Date.now() / 1000)
      })).toString('base64');
      return `${header}.${payload}.mock-sig`;
    }

    it('calculates token days remaining accurately', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const token30Days = createMockJwt(nowSeconds + 30 * 24 * 3600);
      const token5Days = createMockJwt(nowSeconds + 5 * 24 * 3600);

      const days30 = service.getTokenDaysRemaining(token30Days);
      const days5 = service.getTokenDaysRemaining(token5Days);

      expect(days30).toBeCloseTo(30, 0);
      expect(days5).toBeCloseTo(5, 0);
      expect(service.getTokenDaysRemaining('invalid-token')).toBeNull();
      expect(service.getTokenDaysRemaining(null)).toBeNull();
    });

    it('does not refresh token when remaining lifetime is greater than 14 days', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const healthyToken = createMockJwt(nowSeconds + 60 * 24 * 3600);
      localStorageMock[KIOSK_STORAGE_KEYS.DEVICE_TOKEN] = healthyToken;

      const refreshSpy = vi.spyOn(service, 'refreshDeviceToken');
      const token = await service.checkAndRefreshToken();

      expect(token).toBe(healthyToken);
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('transparently refreshes device token when expiring within 14 days (<14 days)', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiringToken = createMockJwt(nowSeconds + 7 * 24 * 3600); // 7 days remaining
      const freshRotatedToken = createMockJwt(nowSeconds + 90 * 24 * 3600);

      localStorageMock[KIOSK_STORAGE_KEYS.DEVICE_TOKEN] = expiringToken;

      // Mock refreshDeviceToken
      vi.spyOn(service, 'refreshDeviceToken').mockResolvedValue(freshRotatedToken);

      const resolvedToken = await service.checkAndRefreshToken();

      expect(resolvedToken).toBe(freshRotatedToken);
      expect(service.refreshDeviceToken).toHaveBeenCalled();
    });
  });
});
