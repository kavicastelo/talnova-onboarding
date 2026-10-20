import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  apiClient,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  setWorkerTokenProvider,
  getWorkerToken,
  normalizeError
} from '../api/client';
import { deviceIdentityService } from '../features/kiosk/services/device-identity.service';
import { secureStorage } from '../utils/secureStorage';

describe('SEC-PHASE-4: Client Token Storage Evacuation & Removal of Window Globals', () => {
  let storageMap: Record<string, string>;

  beforeEach(() => {
    storageMap = {};

    const mockStorage = {
      getItem: (key: string) => storageMap[key] ?? null,
      setItem: (key: string, val: string) => { storageMap[key] = String(val); },
      removeItem: (key: string) => { delete storageMap[key]; },
      clear: () => { storageMap = {}; },
      key: (i: number) => Object.keys(storageMap)[i] || null,
      get length() { return Object.keys(storageMap).length; },
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = globalThis;
    }

    clearAccessToken();
    setWorkerTokenProvider(null);
    delete (window as any).__TALNOVA_EMPLOYEE_TOKEN__;
    delete (window as any).__TALNOVA_AUTH_TOKEN__;
  });

  afterEach(() => {
    clearAccessToken();
    setWorkerTokenProvider(null);
    storageMap = {};
    delete (window as any).__TALNOVA_EMPLOYEE_TOKEN__;
    delete (window as any).__TALNOVA_AUTH_TOKEN__;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ELIMINATION OF SENSITIVE TOKENS FROM WINDOW OBJECT
  // =========================================================================
  describe('1. Elimination of Sensitive Tokens from window Global', () => {
    it('does NOT bind worker tokens to window.__TALNOVA_EMPLOYEE_TOKEN__', () => {
      const mockWorkerToken = 'worker-session-jwt-sample-999';
      const mockWorkerUser = { id: 'worker-1', name: 'John Worker' };

      // Set worker session in deviceIdentityService
      deviceIdentityService.setEmployeeSession(mockWorkerToken, mockWorkerUser);

      // Verify window object is clean
      expect((window as any).__TALNOVA_EMPLOYEE_TOKEN__).toBeUndefined();

      // Verify token is retrievable strictly through internal memory accessor
      expect(deviceIdentityService.getEmployeeToken()).toBe(mockWorkerToken);
      expect(deviceIdentityService.getEmployeeUser()).toEqual(mockWorkerUser);

      // Clear worker session
      deviceIdentityService.clearEmployeeSession();
      expect(deviceIdentityService.getEmployeeToken()).toBeNull();
      expect((window as any).__TALNOVA_EMPLOYEE_TOKEN__).toBeUndefined();
    });

    it('passes worker tokens strictly through localized provider closure to apiClient', () => {
      const mockWorkerToken = 'worker-closure-token-abc';
      setWorkerTokenProvider(() => mockWorkerToken);

      expect((window as any).__TALNOVA_EMPLOYEE_TOKEN__).toBeUndefined();
      expect(getWorkerToken()).toBe(mockWorkerToken);
    });
  });

  // =========================================================================
  // 2. IN-MEMORY TOKEN MANAGEMENT & NO RAW JWT IN LOCALSTORAGE
  // =========================================================================
  describe('2. In-Memory Token Management & Non-Plaintext Persistence', () => {
    it('maintains active access token in memory', () => {
      const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sample';
      setAccessToken(mockJwt);

      expect(getAccessToken()).toBe(mockJwt);

      clearAccessToken();
      expect(getAccessToken()).toBeNull();
    });

    it('guarantees raw JWT tokens are NEVER written in plaintext to localStorage.auth_token', () => {
      const rawJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitivePayload.signature';
      setAccessToken(rawJwt);

      // Raw plaintext key must NOT exist in localStorage
      expect(localStorage.getItem('auth_token')).toBeNull();

      // Inspect all localStorage keys: none should contain raw JWT string
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) || '';
          expect(val.includes(rawJwt)).toBe(false);
          expect(val.startsWith('eyJ')).toBe(false);
        }
      }
    });

    it('secureStorage wraps fallback tokens in an encrypted/obfuscated envelope with TTL', () => {
      const rawToken = 'sample-jwt-bearer-token-secret';
      const shortTtlMs = 50; // 50 milliseconds

      secureStorage.setToken(rawToken, shortTtlMs);

      // Verify stored value is an obfuscated envelope
      const stored = localStorage.getItem('__tn_sec_session__');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.v).toBe(1);
      expect(parsed._e).toBeDefined();
      expect(parsed._e.startsWith('__SEC_v1:')).toBe(true);
      expect(parsed.exp).toBeGreaterThan(Date.now());

      // Immediate read must successfully decrypt the token
      expect(secureStorage.getToken()).toBe(rawToken);

      // Verify expiration eviction: advance time past TTL
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 100);

      expect(secureStorage.getToken()).toBeNull();
      expect(localStorage.getItem('__tn_sec_session__')).toBeNull();

      vi.useRealTimers();
    });

    it('migrates and purges legacy plaintext auth_token when encountered', () => {
      const legacyRaw = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacyRawToken.sig';
      storageMap['auth_token'] = legacyRaw;

      // Reading through secureStorage should migrate it
      const recovered = secureStorage.getToken();
      expect(recovered).toBe(legacyRaw);

      // Legacy plaintext key must now be wiped from localStorage
      expect(storageMap['auth_token']).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. CONSOLE LOGGING CLEANSING IN CLIENT
  // =========================================================================
  describe('3. Cleanse Console Logging in API Client', () => {
    it('normalizeError does not dump sensitive API response payloads to console.error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockAxiosError: any = {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid credentials provided',
              sensitiveInternalDetails: 'db_connection_string_or_password_dump',
            },
          },
        },
      };

      const normalized = normalizeError(mockAxiosError);

      expect(normalized.message).toBe('Invalid credentials provided');
      expect(normalized.status).toBe(400);

      // Must NOT invoke console.error with raw response object
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
