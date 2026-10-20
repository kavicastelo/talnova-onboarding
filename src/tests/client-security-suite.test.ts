import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enforceDomainLock,
  disableReactDevTools,
  initDebuggerTrap
} from '../security/antiTamperShield';
import {
  stripControlCharacters,
  stripBidiOverrides,
  normalizeUnicode,
  clampLength,
  sanitizeInput,
  sanitizeTextarea
} from '../utils/inputSanitizer';
import { isSafeUrl, sanitizeHref, isExternalUrl } from '../utils/urlSanitizer';
import { secureStorage } from '../utils/secureStorage';
import { hasPermission, canPerformRoleSwitch } from '../utils/rbac';

describe('SEC-PROBE-001: Unified Client Security Suite & Penetration Probes', () => {
  let originalWindow: any;
  let originalDocument: any;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};

    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;

    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = String(val);
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      key: vi.fn((i: number) => Object.keys(mockStorage)[i] || null),
      get length() {
        return Object.keys(mockStorage).length;
      },
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    // Standardize window & DOM mocks for test runner
    const win = {
      location: {
        origin: 'https://talnova.io',
        host: 'talnova.io',
        hostname: 'talnova.io',
        href: 'https://talnova.io/dashboard'
      },
      top: null as any,
      self: null as any,
      localStorage: localStorageMock,
      sessionStorage: {
        clear: vi.fn(() => {
          Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
        })
      }
    };
    win.top = win;
    win.self = win;

    const doc = {
      body: {
        innerHTML: '<div>App Content</div>'
      }
    };

    (globalThis as any).window = win;
    (globalThis as any).document = doc;
    (globalThis as any).sessionStorage = win.sessionStorage;
  });

  afterEach(() => {
    mockStorage = {};
    if (originalWindow) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }

    if (originalDocument) {
      (globalThis as any).document = originalDocument;
    } else {
      delete (globalThis as any).document;
    }

    vi.useRealTimers();
  });

  // =========================================================================
  // 1. PENETRATION PROBE: Domain Lock & Anti-Cloning Shield
  // =========================================================================
  describe('Probe 1: Domain Lock & Off-Site Anti-Cloning', () => {
    it('blocks execution and purges DOM on unauthorized cloned domains', () => {
      const unauthorizedHostnames = [
        'attacker-evil-clone.com',
        'talnova.fake-phishing.net',
        'talnovaio.com',
        '198.51.100.42',
        'unauthorized-mirror.io'
      ];

      for (const hostname of unauthorizedHostnames) {
        window.location.hostname = hostname;
        document.body.innerHTML = '<div id="proprietary-dashboard">Secret IP</div>';

        expect(() => enforceDomainLock()).toThrowError(/DEMO_SECURITY_VIOLATION/);
        expect(document.body.innerHTML).toContain('Unauthorized Distribution');
        expect(document.body.innerHTML).not.toContain('proprietary-dashboard');
      }
    });

    it('permits authorized production and deployment domains', () => {
      const authorizedHostnames = [
        'talnova.io',
        'app.talnova.io',
        'kiosk.talnova.io',
        'talnovaonboard.com',
        'enterprise.talnovaonboard.com',
        'talnova-preview.vercel.app',
        'talnova-staging.netlify.app'
      ];

      for (const hostname of authorizedHostnames) {
        window.location.hostname = hostname;
        expect(enforceDomainLock()).toBe(true);
      }
    });

    it('permits development loopback hosts and local networks', () => {
      const devHostnames = [
        'localhost',
        '127.0.0.1',
        'development.local',
        'sub.test.local',
        'terminal-a.ngrok-free.app'
      ];

      for (const hostname of devHostnames) {
        window.location.hostname = hostname;
        expect(enforceDomainLock()).toBe(true);
      }
    });

    it('respects runtime custom allowed domains configuration', () => {
      window.location.hostname = 'custom-enterprise.partner-portal.com';

      // Blocked without custom config
      expect(() => enforceDomainLock()).toThrowError(/DEMO_SECURITY_VIOLATION/);

      // Permitted when explicitly whitelisted
      expect(enforceDomainLock(['partner-portal.com'])).toBe(true);
    });
  });

  // =========================================================================
  // 2. PENETRATION PROBE: React DevTools Hook Dead-Stubbing
  // =========================================================================
  describe('Probe 2: DevTools Hook Dead-Stubbing', () => {
    it('pre-emptively registers dead hook to prevent React DevTools attachment', () => {
      delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

      disableReactDevTools();

      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      expect(hook).toBeDefined();
      expect(typeof hook.inject).toBe('function');
      expect(typeof hook.onCommitFiberRoot).toBe('function');

      // Verify dead hook functions are safe no-ops
      expect(() => hook.inject()).not.toThrow();
      expect(() => hook.onCommitFiberRoot()).not.toThrow();
      expect(hook.renderers.size).toBe(0);
    });

    it('neutralizes active React DevTools hook functions into dead no-ops', () => {
      const spyInject = vi.fn();
      const spyCommit = vi.fn();

      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        inject: spyInject,
        onCommitFiberRoot: spyCommit,
        version: '4.28.0'
      };

      disableReactDevTools();

      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      hook.inject();
      hook.onCommitFiberRoot();

      expect(spyInject).not.toHaveBeenCalled();
      expect(spyCommit).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. PENETRATION PROBE: Debugger Timing Traps & Memory Scrubbing
  // =========================================================================
  describe('Probe 3: Debugger Timing Detection & Session Evacuation', () => {
    it('evacuates memory and sessionStorage when execution pause is detected', () => {
      vi.useFakeTimers();

      const onViolationSpy = vi.fn();
      (window as any).__TALNOVA_AUTH_TOKEN__ = 'secret-in-memory-token';
      (window as any).__TALNOVA_EMPLOYEE_TOKEN__ = 'employee-token';

      // Start trap
      initDebuggerTrap(onViolationSpy, true);

      // Simulate normal fast clock tick (<200ms)
      vi.advanceTimersByTime(50);
      expect((window as any).__TALNOVA_AUTH_TOKEN__).toBe('secret-in-memory-token');

      // Simulate breakpoint pause (>200ms delta between ticks)
      const originalDateNow = Date.now;
      let mockTime = originalDateNow();
      vi.spyOn(Date, 'now').mockImplementation(() => {
        mockTime += 1000; // 1000ms freeze/breakpoint
        return mockTime;
      });

      vi.advanceTimersByTime(100);

      // Verify sensitive tokens and session were scrubbed
      expect((window as any).__TALNOVA_AUTH_TOKEN__).toBeUndefined();
      expect((window as any).__TALNOVA_EMPLOYEE_TOKEN__).toBeUndefined();
      expect(window.sessionStorage.clear).toHaveBeenCalled();
      expect(onViolationSpy).toHaveBeenCalledWith('DEBUGGER_DETECTED');
    });
  });

  // =========================================================================
  // 4. PENETRATION PROBE: Input Sanitization & Trojan Source Unicode Defense
  // =========================================================================
  describe('Probe 4: Input Sanitizer & Trojan Source Bidi Defense', () => {
    it('neutralizes CVE-2021-42574 Trojan Source Bidi overrides in single and multi-line text', () => {
      // Malicious Trojan Source attack disguising dangerous code
      const attackPayload = 'const accessLevel = "user\u202E \u2066// Check admin\u2069 \u2066";';
      const sanitized = stripBidiOverrides(attackPayload);

      expect(sanitized).not.toContain('\u202E');
      expect(sanitized).not.toContain('\u2066');
      expect(sanitized).not.toContain('\u2069');
      expect(sanitized).toBe('const accessLevel = "user // Check admin ";');
    });

    it('strips non-printable ASCII and control characters except formatting breaks', () => {
      const contaminated = '\x00\x01\x02Hello\x07\x08 \x0B\x0CWorld\x1F\x7F\nNext\r\n\tTab';
      const clean = stripControlCharacters(contaminated);

      expect(clean).toBe('Hello World\nNext\r\n\tTab');
      expect(clean).not.toContain('\x00');
      expect(clean).not.toContain('\x7F');
    });

    it('normalizes compatibility homoglyphs via NFKC', () => {
      // Fullwidth Latin characters 'Ａｄｍｉｎ' (U+FF21 U+FF44 U+FF4D U+FF49 U+FF4E)
      const homoglyph = 'Ａｄｍｉｎ';
      expect(normalizeUnicode(homoglyph)).toBe('Admin');
    });

    it('clamps input strings exceeding length boundary to prevent memory exhaustion', () => {
      const hugeInput = 'A'.repeat(5000);
      expect(clampLength(hugeInput, 255).length).toBe(255);
      expect(sanitizeInput(hugeInput, 100).length).toBe(100);
    });

    it('pipeline sanitizes textarea inputs while preserving line-break structure', () => {
      const textareaPayload = 'First Line\r\n\x00Second\u202E Line\nThird Line';
      const result = sanitizeTextarea(textareaPayload, 1000);

      expect(result).toBe('First Line\r\nSecond Line\nThird Line');
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\u202E');
    });
  });

  // =========================================================================
  // 5. PENETRATION PROBE: URL Protocol & Safe Link Injection Defense
  // =========================================================================
  describe('Probe 5: Dangerous URL Protocols & Safe Link Injection Defense', () => {
    it('identifies and blocks executable pseudo-protocols and script injection', () => {
      const xssVectors = [
        'javascript:alert(document.cookie)',
        'javascript:void(0)',
        'JAVASCRIPT:/*--></title></style></textarea></script><svg/onload=alert(1)>',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'data:image/svg+xml,<svg onload=alert(1)>',
        'vbscript:msgbox("pwnd")',
        'blob:https://evil.com/payload',
        'file:///etc/passwd',
        'file:///C:/Windows/win.ini',
        '//malicious-phishing-origin.com/login'
      ];

      for (const vector of xssVectors) {
        expect(isSafeUrl(vector)).toBe(false);
        expect(sanitizeHref(vector)).toBe('#');
      }
    });

    it('safely validates authorized protocols and internal application links', () => {
      const legitimateUrls = [
        'https://talnova.io/journeys',
        'https://sub.domain.com/path?query=val&flag=1#hash',
        'http://localhost:8080/api/health',
        'mailto:support@talnova.io?subject=Help',
        'tel:+15550199',
        '/tasks/onboarding',
        '#step-overview'
      ];

      for (const url of legitimateUrls) {
        expect(isSafeUrl(url)).toBe(true);
        expect(sanitizeHref(url)).toBe(url);
      }
    });

    it('correctly classifies external links requiring noopener/noreferrer protections', () => {
      expect(isExternalUrl('https://partner.com')).toBe(true);
      expect(isExternalUrl('https://evil.org/phish')).toBe(true);
      expect(isExternalUrl('/employee/profile')).toBe(false);
      expect(isExternalUrl('#notes')).toBe(false);
    });
  });

  // =========================================================================
  // 6. PENETRATION PROBE: Client Role Integrity & Anti-Tamper Storage
  // =========================================================================
  describe('Probe 6: Client Role Integrity & Privilege Escalation Defense', () => {
    it('rejects tampered plain localStorage role injection', () => {
      // Simulate attacker manually setting plain user_role in browser localStorage
      localStorage.setItem('user_role', 'super_admin');

      // Secure storage should not recognize plain unsealed roles
      const roleFromSecure = secureStorage.getRoleCache();
      expect(roleFromSecure).toBeNull();
      // Plaintext injection attempt is scrubbed
      expect(localStorage.getItem('user_role')).toBeNull();
    });

    it('detects and discards cryptographically tampered role cache entries', () => {
      // Legitimate role seal
      secureStorage.setRoleCache('employee', ['employee']);
      const initialCache = secureStorage.getRoleCache();
      expect(initialCache).not.toBeNull();
      expect(initialCache?.role).toBe('employee');

      // Tamper with underlying stored raw payload
      const rawStored = localStorage.getItem('__tn_sec_roles__') || '';
      expect(rawStored).toBeTruthy();

      // Corrupt the internal encrypted ciphertext payload
      const corrupted = rawStored.slice(0, 15) + 'XYZ9' + rawStored.slice(19);
      localStorage.setItem('__tn_sec_roles__', corrupted);

      // Retrieval must fail integrity verification and purge tampered cache
      expect(secureStorage.getRoleCache()).toBeNull();
      expect(localStorage.getItem('__tn_sec_roles__')).toBeNull();
    });

    it('enforces RBAC permissions strictly based on validated roles', () => {
      // Guest permissions
      expect(hasPermission(null, 'view_super_admin')).toBe(false);
      expect(hasPermission('employee', 'manage_organization')).toBe(false);

      // Super Admin permissions
      expect(hasPermission('super_admin', 'view_super_admin')).toBe(true);
      expect(hasPermission('super_admin', 'manage_organization')).toBe(true);

      // Role switching validation: prohibits switching to super_admin unless user possesses it
      expect(canPerformRoleSwitch('super_admin', ['employee'])).toBe(false);
      expect(canPerformRoleSwitch('super_admin', ['admin', 'manager'])).toBe(false);
      expect(canPerformRoleSwitch('super_admin', ['super_admin'])).toBe(true);
    });
  });

  // =========================================================================
  // 7. PENETRATION PROBE: Prototype Pollution & Defense-in-Depth
  // =========================================================================
  describe('Probe 7: Prototype Pollution Resistance', () => {
    it('prevents prototype pollution attacks across input and URL sanitizers', () => {
      const maliciousPayloads = [
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"polluted": "yes"}}}',
        '__proto__.polluted=true'
      ];

      for (const payload of maliciousPayloads) {
        sanitizeInput(payload);
        sanitizeHref(payload);
      }

      // Verify Object prototype was not contaminated
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
  });
});
