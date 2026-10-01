/**
 * Talnova Kiosk Shell - Device Identity Service (ADR-003, K-DEV-001)
 *
 * Implements client-side cryptographic hardware identity generation and persistence
 * in the kiosk terminal shell, replacing non-standard random IDs and deprecating MAC address assumptions.
 */

import { KioskDevice } from '../../../types/kiosk/device.types';
import { KioskDeviceStatus } from '../../../types/kiosk/common.types';
import { apiClient } from '../../../api/client';

declare global {
  interface Window {
    __TALNOVA_MDM_CONFIG__?: {
      hardwareGuid?: string;
      siteId?: string;
      deviceGroupId?: string;
      serverUrl?: string;
      [key: string]: unknown;
    };
    TALNOVA_KIOSK_CONFIG?: {
      hardwareGuid?: string;
      siteId?: string;
      deviceGroupId?: string;
      [key: string]: unknown;
    };
  }
}

export const KIOSK_STORAGE_KEYS = {
  HARDWARE_GUID: 'kiosk_hardware_guid',
  LEGACY_DEVICE_ID: 'kiosk_device_id',
  DEVICE_TOKEN: 'kiosk_device_token',
  DEVICE_INFO: 'kiosk_device_info',
  IS_PAIRED: 'kiosk_is_paired',
  DEVICE_NAME: 'kiosk_device_name',
  DEVICE_LOCATION: 'kiosk_device_location',
  DEVICE_REVOKED: 'kiosk_device_revoked',
} as const;

const IDB_CONFIG = {
  DB_NAME: 'talnova_kiosk_db',
  DB_VERSION: 1,
  STORE_NAME: 'device_identity',
} as const;

// RFC 4122 UUIDv4 verification regex
const UUIDV4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUIDv4(id: string): boolean {
  return UUIDV4_REGEX.test(id);
}

/**
 * Decodes base64url-encoded JWT payload without third-party dependencies.
 */
export function parseJwtPayload(token: string): { exp?: number; iat?: number; [key: string]: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Set RFC 4122 version 4 and variant bits
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  // Math.random RFC 4122 fallback if crypto is unavailable in environment
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB;
  }
  return null;
}

function openKioskDatabase(): Promise<IDBDatabase | null> {
  const idb = getIndexedDB();
  if (!idb) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = idb.open(IDB_CONFIG.DB_NAME, IDB_CONFIG.DB_VERSION);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_NAME)) {
          db.createObjectStore(IDB_CONFIG.STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getIdbItem(key: string): Promise<string | null> {
  try {
    const db = await openKioskDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          resolve(req.result ? req.result.value : null);
        };
        req.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function setIdbItem(key: string, value: string): Promise<void> {
  try {
    const db = await openKioskDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
        const req = store.put({ key, value, updatedAt: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.oncomplete = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore storage errors gracefully
  }
}

async function removeIdbItem(key: string): Promise<void> {
  try {
    const db = await openKioskDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.oncomplete = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore storage errors gracefully
  }
}

export class DeviceIdentityService {
  private cachedHardwareGuid: string | null = null;

  /**
   * Retrieves or generates a resilient cryptographic hardware GUID.
   * Priority order:
   * 1. Authoritative MDM Configuration (window.__TALNOVA_MDM_CONFIG__ or window.TALNOVA_KIOSK_CONFIG)
   * 2. In-memory cache
   * 3. LocalStorage persistence (kiosk_hardware_guid)
   * 4. IndexedDB persistence (resilient recovery against local storage evictions)
   * 5. Cryptographic UUIDv4 generation via crypto.randomUUID()
   */
  async getOrCreateHardwareGuid(): Promise<string> {
    // 1. MDM-provisioned hardware identifier (Authoritative override)
    const mdmGuid = this.getMdmHardwareGuid();
    if (mdmGuid) {
      this.cachedHardwareGuid = mdmGuid;
      this.persistToLocalStorage(mdmGuid);
      await setIdbItem('hardware_guid', mdmGuid).catch(() => {});
      return mdmGuid;
    }

    // 2. In-memory cache
    if (this.cachedHardwareGuid) {
      return this.cachedHardwareGuid;
    }

    // 3. LocalStorage synchronous check
    const localGuid = this.getFromLocalStorage();
    if (localGuid) {
      this.cachedHardwareGuid = localGuid;
      // Mirror to IndexedDB for recovery resilience
      await setIdbItem('hardware_guid', localGuid).catch(() => {});
      return localGuid;
    }

    // 4. IndexedDB resilient check
    try {
      const idbGuid = await getIdbItem('hardware_guid');
      if (idbGuid && idbGuid.trim()) {
        const trimmed = idbGuid.trim();
        this.cachedHardwareGuid = trimmed;
        this.persistToLocalStorage(trimmed);
        return trimmed;
      }
    } catch {
      // Continue to generation
    }

    // 5. Generate new UUIDv4
    const newGuid = generateUUIDv4();
    this.cachedHardwareGuid = newGuid;
    this.persistToLocalStorage(newGuid);
    await setIdbItem('hardware_guid', newGuid).catch(() => {});

    // On terminal startup / initialization, transparently check if token needs rotation (K-DEV-003)
    this.checkAndRefreshToken().catch(() => {});

    return newGuid;
  }

  /**
   * Synchronous helper to retrieve cached or locally stored hardware GUID.
   */
  getHardwareGuidSync(): string | null {
    const mdm = this.getMdmHardwareGuid();
    if (mdm) return mdm;
    if (this.cachedHardwareGuid) return this.cachedHardwareGuid;
    return this.getFromLocalStorage();
  }

  /**
   * Checks whether the current device identity is derived from an MDM configuration.
   */
  isMdmProvisioned(): boolean {
    return Boolean(this.getMdmHardwareGuid());
  }

  /**
   * Retrieves the active device bearer token for API authorization.
   */
  getDeviceToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(KIOSK_STORAGE_KEYS.DEVICE_TOKEN);
  }

  /**
   * Calculates the number of days remaining until device bearer token expires.
   * Returns null if token is missing or has no exp claim.
   */
  getTokenDaysRemaining(token?: string | null): number | null {
    const targetToken = token !== undefined ? token : this.getDeviceToken();
    if (!targetToken) return null;

    const payload = parseJwtPayload(targetToken);
    if (!payload || typeof payload.exp !== 'number') return null;

    const expMs = payload.exp * 1000;
    const now = Date.now();
    return (expMs - now) / (1000 * 60 * 60 * 24);
  }

  /**
   * Transparently calls POST /kiosk/devices/refresh-token to rotate device credentials
   * and updates local/IndexedDB storage.
   */
  async refreshDeviceToken(): Promise<string | null> {
    const currentToken = this.getDeviceToken();
    if (!currentToken) return null;

    try {
      const res = await apiClient.post<{
        success: boolean;
        deviceToken?: string;
        token?: string;
        device?: KioskDevice;
      }>('/kiosk/devices/refresh-token');

      const newToken =
        res.data?.deviceToken ||
        res.data?.token ||
        (res.data as any)?.data?.deviceToken ||
        (res.data as any)?.data?.token;

      if (newToken) {
        const storedDevice = this.getStoredDevice() || res.data?.device;
        if (storedDevice) {
          this.setDeviceCredentials(storedDevice, newToken);
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_TOKEN, newToken);
          setIdbItem('device_token', newToken).catch(() => {});
        }
        return newToken;
      }
    } catch (err) {
      console.warn('[DeviceIdentityService] Failed to refresh device token:', err);
      throw err;
    }

    return null;
  }

  /**
   * Automatically inspects token expiration on terminal startup or heartbeat;
   * if expiring within 14 days, invokes refresh endpoint transparently.
   */
  async checkAndRefreshToken(): Promise<string | null> {
    const token = this.getDeviceToken();
    if (!token) return null;

    const daysRemaining = this.getTokenDaysRemaining(token);
    // If token expires within 14 days, rotate immediately
    if (daysRemaining !== null && daysRemaining < 14) {
      try {
        const newToken = await this.refreshDeviceToken();
        if (newToken) return newToken;
      } catch (err) {
        console.warn(
          '[DeviceIdentityService] Transparent token refresh failed; retaining current token',
          err
        );
      }
    }

    return token;
  }

  /**
   * Persists paired device credentials, including auth token and device metadata.
   */
  setDeviceCredentials(device: KioskDevice, token: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_TOKEN, token);
      localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_INFO, JSON.stringify(device));
      localStorage.setItem(KIOSK_STORAGE_KEYS.IS_PAIRED, 'true');
      localStorage.removeItem(KIOSK_STORAGE_KEYS.DEVICE_REVOKED);
      if (device.name) {
        localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_NAME, device.name);
      }
      if (device.location) {
        localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_LOCATION, device.location);
      }
    }

    // Mirror to IndexedDB
    setIdbItem('device_token', token).catch(() => {});
    setIdbItem('device_info', JSON.stringify(device)).catch(() => {});
  }

  /**
   * Clears device pairing credentials upon decommissioning or unpairing.
   * NOTE: Preserves the hardware GUID to maintain physical terminal identity (ADR-003).
   */
  clearDeviceCredentials(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KIOSK_STORAGE_KEYS.DEVICE_TOKEN);
      localStorage.removeItem(KIOSK_STORAGE_KEYS.DEVICE_INFO);
      localStorage.removeItem(KIOSK_STORAGE_KEYS.IS_PAIRED);
      localStorage.setItem(KIOSK_STORAGE_KEYS.DEVICE_REVOKED, 'true');
    }
    removeIdbItem('device_token').catch(() => {});
    removeIdbItem('device_info').catch(() => {});
  }

  /**
   * Checks if the device has been explicitly revoked or decommissioned.
   */
  isRevoked(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(KIOSK_STORAGE_KEYS.DEVICE_REVOKED) === 'true';
  }

  /**
   * Clears the revoked lockdown flag (e.g. when initiating re-enrollment).
   */
  clearRevocationStatus(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KIOSK_STORAGE_KEYS.DEVICE_REVOKED);
    }
  }

  /**
   * Checks if the kiosk has valid pairing credentials.
   */
  isPaired(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const token = localStorage.getItem(KIOSK_STORAGE_KEYS.DEVICE_TOKEN);
    const pairedFlag = localStorage.getItem(KIOSK_STORAGE_KEYS.IS_PAIRED);
    return Boolean(token && (pairedFlag === 'true' || !pairedFlag));
  }

  /**
   * Retrieves cached device metadata from storage.
   */
  getStoredDevice(): KioskDevice | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KIOSK_STORAGE_KEYS.DEVICE_INFO);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as KioskDevice;
    } catch {
      return null;
    }
  }

  /**
   * Inspects current stored device status.
   */
  getDeviceStatus(): KioskDeviceStatus | null {
    const device = this.getStoredDevice();
    return device?.status || null;
  }

  /**
   * Internal helper to read MDM hardware identifier from global window objects.
   */
  private getMdmHardwareGuid(): string | null {
    const win: any = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (!win) return null;

    const mdm = win.__TALNOVA_MDM_CONFIG__;
    if (mdm?.hardwareGuid && typeof mdm.hardwareGuid === 'string' && mdm.hardwareGuid.trim()) {
      return mdm.hardwareGuid.trim();
    }

    const kioskConfig = win.TALNOVA_KIOSK_CONFIG;
    if (kioskConfig?.hardwareGuid && typeof kioskConfig.hardwareGuid === 'string' && kioskConfig.hardwareGuid.trim()) {
      return kioskConfig.hardwareGuid.trim();
    }

    return null;
  }

  private persistToLocalStorage(guid: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KIOSK_STORAGE_KEYS.HARDWARE_GUID, guid);
    localStorage.setItem(KIOSK_STORAGE_KEYS.LEGACY_DEVICE_ID, guid);
  }

  private getFromLocalStorage(): string | null {
    if (typeof localStorage === 'undefined') return null;
    const primary = localStorage.getItem(KIOSK_STORAGE_KEYS.HARDWARE_GUID);
    if (primary && primary.trim()) {
      return primary.trim();
    }

    const legacy = localStorage.getItem(KIOSK_STORAGE_KEYS.LEGACY_DEVICE_ID);
    if (legacy && legacy.trim() && isValidUUIDv4(legacy.trim())) {
      localStorage.setItem(KIOSK_STORAGE_KEYS.HARDWARE_GUID, legacy.trim());
      return legacy.trim();
    }

    return null;
  }

  /**
   * =========================================================================
   * K-EMP-001 / K-EMP-002: Ephemeral Frontline Employee Session Management
   * Stored strictly in React/memory singleton to preserve worker privacy.
   * =========================================================================
   */
  private ephemeralEmployeeToken: string | null = null;
  private ephemeralEmployeeUser: any = null;

  setEmployeeSession(token: string | null, user?: any): void {
    this.ephemeralEmployeeToken = token;
    this.ephemeralEmployeeUser = user || null;
  }

  getEmployeeToken(): string | null {
    return this.ephemeralEmployeeToken;
  }

  getEmployeeUser(): any {
    return this.ephemeralEmployeeUser;
  }

  clearEmployeeSession(): void {
    this.ephemeralEmployeeToken = null;
    this.ephemeralEmployeeUser = null;
  }
}

export const deviceIdentityService = new DeviceIdentityService();
