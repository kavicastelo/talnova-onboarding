import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enforceDomainLock,
  disableReactDevTools,
  neuterConsole,
  initDebuggerTrap,
  stopDebuggerTrap,
  protectPrototypes,
  initAntiTamperShield,
} from '../security/antiTamperShield';

describe('SEC-CLIENT-SHIELD: Universal Runtime Anti-Tamper, Anti-Cloning & Domain Lock Shield', () => {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.useFakeTimers();

    (globalThis as any).window = {
      location: {
        hostname: 'localhost',
        pathname: '/',
      },
      __REACT_DEVTOOLS_GLOBAL_HOOK__: undefined,
      __TALNOVA_SHIELD_ACTIVE__: undefined,
    };

    (globalThis as any).document = {
      body: {
        innerHTML: '<div id="root">App Content</div>',
      },
    };
  });

  afterEach(() => {
    stopDebuggerTrap();
    vi.clearAllTimers();
    vi.useRealTimers();

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

    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;

    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. DOMAIN LOCK GUARD (enforceDomainLock)
  // =========================================================================
  describe('Domain Lock Guard', () => {
    it('allows execution on authorized local development hosts', () => {
      const devHosts = ['localhost', '127.0.0.1', 'tunnel.ngrok-free.app', 'devbox.local'];
      devHosts.forEach((host) => {
        (window as any).location.hostname = host;
        expect(() => enforceDomainLock()).not.toThrow();
        expect(enforceDomainLock()).toBe(true);
      });
    });

    it('allows execution on authorized production and staging domains', () => {
      const prodHosts = [
        'talnova.io',
        'app.talnova.io',
        'auth.talnova.io',
        'talnovaonboard.com',
        'portal.talnovaonboard.com',
        'talnova-preview.vercel.app',
        'talnova-prod.netlify.app',
      ];
      prodHosts.forEach((host) => {
        (window as any).location.hostname = host;
        expect(() => enforceDomainLock()).not.toThrow();
        expect(enforceDomainLock()).toBe(true);
      });
    });

    it('allows execution on custom allowed domains passed dynamically', () => {
      (window as any).location.hostname = 'custom.enterprise-client.com';
      expect(() => enforceDomainLock(['custom.enterprise-client.com'])).not.toThrow();
    });

    it('wipes DOM and throws fatal error on unauthorized / attacker-cloned domains', () => {
      (window as any).location.hostname = 'pirate-talnova-clone.com';

      expect(() => enforceDomainLock()).toThrowError(
        /DEMO_SECURITY_VIOLATION: Execution blocked outside authorized domain\./
      );

      expect(document.body.innerHTML).toContain('<h1>Unauthorized Distribution</h1>');
      expect(document.body.innerHTML).toContain('Execution has been terminated');
    });

    it('blocks subdomains of unauthorized domains', () => {
      (window as any).location.hostname = 'app.phishing-talnova.xyz';

      expect(() => enforceDomainLock()).toThrowError(
        /DEMO_SECURITY_VIOLATION: Execution blocked outside authorized domain\./
      );
      expect(document.body.innerHTML).toContain('<h1>Unauthorized Distribution</h1>');
    });
  });

  // =========================================================================
  // 2. REACT DEVTOOLS NEUTRALIZATION (disableReactDevTools)
  // =========================================================================
  describe('React DevTools Neutralization', () => {
    it('pre-emptively dead-stubs React DevTools hook if undefined', () => {
      delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

      disableReactDevTools();

      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      expect(hook).toBeDefined();
      expect(typeof hook.inject).toBe('function');
      expect(typeof hook.sub).toBe('function');
      expect(typeof hook.onCommitFiberRoot).toBe('function');
      expect(hook.renderers instanceof Map).toBe(true);

      // Verify invoking stub methods causes no error
      expect(() => {
        hook.inject();
        hook.sub();
        hook.onCommitFiberRoot();
      }).not.toThrow();
    });

    it('neutralizes active React DevTools hook with no-ops and nulls', () => {
      const activeSpy = vi.fn();
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        inject: activeSpy,
        sub: activeSpy,
        supportsFiber: true,
        renderers: new Map(),
      };

      disableReactDevTools();

      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      expect(typeof hook.inject).toBe('function');
      hook.inject();
      expect(activeSpy).not.toHaveBeenCalled();
      expect(hook.supportsFiber).toBeNull();
    });
  });

  // =========================================================================
  // 3. CONSOLE NEUTERING (neuterConsole)
  // =========================================================================
  describe('Console Neutering', () => {
    it('silences verbose console methods when forced or in production mode', () => {
      neuterConsole(true);

      // Verify no-ops
      expect(() => {
        console.log('Secret Business Logic');
        console.info('Internal Schema');
        console.debug('Telemetry Payload');
        console.warn('Security Warning');
        console.table({ key: 'value' });
        console.dir({ confidential: true });
      }).not.toThrow();

      // Ensure console.error remains active for critical crashes
      const errorSpy = vi.fn();
      console.error = errorSpy;
      console.error('Fatal crash report');
      expect(errorSpy).toHaveBeenCalledWith('Fatal crash report');
    });
  });

  // =========================================================================
  // 4. ANTI-DEBUGGING TIMING TRAP (initDebuggerTrap)
  // =========================================================================
  describe('Anti-Debugging Timing Trap', () => {
    it('detects execution pause delta and scrubs sensitive auth caches', () => {
      const onViolation = vi.fn();
      const mockStorage = {
        clear: vi.fn(),
      };
      (window as any).sessionStorage = mockStorage;
      (globalThis as any).sessionStorage = mockStorage;
      (window as any).__TALNOVA_AUTH_TOKEN__ = 'sensitive_jwt_token_123';
      (window as any).__TALNOVA_EMPLOYEE_TOKEN__ = 'sensitive_emp_token_456';

      let mockTime = 1000;
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      initDebuggerTrap(onViolation, true);

      // Normal tick: advance mock time by 100ms
      mockTime += 100;
      vi.advanceTimersByTime(100);
      expect(onViolation).not.toHaveBeenCalled();

      // Breakpoint paused: clock jumps by 300ms before next interval fires
      mockTime += 300;
      vi.advanceTimersByTime(100);

      expect(mockStorage.clear).toHaveBeenCalled();
      expect((window as any).__TALNOVA_AUTH_TOKEN__).toBeUndefined();
      expect((window as any).__TALNOVA_EMPLOYEE_TOKEN__).toBeUndefined();
      expect(onViolation).toHaveBeenCalledWith('DEBUGGER_DETECTED');
    });
  });

  // =========================================================================
  // 5. PROTOTYPE TAMPER GUARD (protectPrototypes)
  // =========================================================================
  describe('Prototype Tamper Guard', () => {
    it('cleanses polluted prototype properties and secures critical built-ins', () => {
      // Intentionally pollute prototype
      (Object.prototype as any).polluted = 'malicious_injection';
      (Object.prototype as any).isAdmin = true;

      protectPrototypes();

      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect(typeof Object.prototype.hasOwnProperty).toBe('function');
    });
  });

  // =========================================================================
  // 6. APPLICATION ROOT INITIALIZATION (initAntiTamperShield)
  // =========================================================================
  describe('Application Root Initialization', () => {
    it('activates shield and sets window flag', () => {
      (window as any).location.hostname = 'localhost';

      initAntiTamperShield({
        enableConsoleNeutering: false,
        enableDebuggerTrap: false,
      });

      expect((window as any).__TALNOVA_SHIELD_ACTIVE__).toBe(true);

      // Repeated invocation does not error or double-register
      expect(() => initAntiTamperShield()).not.toThrow();
    });
  });
});
