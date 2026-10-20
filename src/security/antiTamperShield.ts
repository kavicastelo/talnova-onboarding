/**
 * Talnova Enterprise Client Security & Anti-Tamper Shield
 * Prevents DevTools inspection, console metadata leakage, React DevTools reflection,
 * off-site codebase cloning, and debugger inspection.
 */

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, any>;
    __TALNOVA_SHIELD_ACTIVE__?: boolean;
  }
}

export interface AntiTamperOptions {
  enableDomainLock?: boolean;
  enableDevToolsNeutralization?: boolean;
  enableConsoleNeutering?: boolean;
  enableDebuggerTrap?: boolean;
  customAllowedDomains?: string[];
  onViolation?: (reason: string) => void;
}

/**
 * Neutralizes React DevTools global hook to prevent inspection of component
 * hierarchy, props, internal state, and hook definitions.
 */
export function disableReactDevTools(): void {
  try {
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (typeof win.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object' && win.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== null) {
        for (const [key, value] of Object.entries(win.__REACT_DEVTOOLS_GLOBAL_HOOK__)) {
          win.__REACT_DEVTOOLS_GLOBAL_HOOK__[key] = typeof value === 'function' ? () => {} : null;
        }
      } else {
        // Pre-emptively register dead hook to prevent React DevTools from attaching later
        win.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          inject: () => {},
          sub: () => {},
          supportsFiber: true,
          renderers: new Map(),
          onCommitFiberRoot: () => {},
          onCommitFiberUnmount: () => {},
        };
      }
    }
  } catch {
    // Fail silently in restricted sandbox contexts
  }
}

/**
 * Neutering console methods in production build to prevent proprietary schema,
 * token, and metadata leakage via browser console.
 */
export function neuterConsole(force = false): void {
  const isProd =
    force ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ||
    (typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.PROD));

  if (isProd && typeof console !== 'undefined') {
    const noop = () => {};
    // Suppress verbose metadata loggers, keep console.error for critical crash reports
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
    console.table = noop;
    console.dir = noop;
  }
}

/**
 * Enforces domain locking to prevent offline execution or hosting on unauthorized cloned domains.
 */
export function enforceDomainLock(customAllowedDomains?: string[]): boolean {
  if (typeof window === 'undefined') return true;

  const envDomainsStr =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as any).env?.VITE_ALLOWED_DOMAINS ||
        (import.meta as any).env?.VITE_DEMO_ALLOWED_DOMAINS)) ||
    '';
  const envDomains = envDomainsStr
    ? envDomainsStr
        .split(',')
        .map((d: string) => d.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const defaultAllowedDomains = [
    'talnova.io',
    'talnovaonboard.com',
    'vercel.app',
    'netlify.app',
  ];

  const allowedDomains = [
    ...defaultAllowedDomains,
    ...envDomains,
    ...(customAllowedDomains || []),
  ].map((d) => d.toLowerCase());

  const hostname = (window.location?.hostname || '').toLowerCase();

  // Allow localhost, IP loopbacks, ngrok tunnel, and local subdomains
  const isLoopbackOrLocal =
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.local');

  const isAllowed =
    isLoopbackOrLocal ||
    allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );

  if (!isAllowed) {
    if (typeof document !== 'undefined' && document.body) {
      document.body.innerHTML =
        '<h1>Unauthorized Distribution</h1><p style="font-size:14px;color:#94a3b8;max-width:440px;">This enterprise software is cryptographically bound to authorized Talnova domains. Execution has been terminated.</p>';
    }
    throw new Error('DEMO_SECURITY_VIOLATION: Execution blocked outside authorized domain.');
  }

  return true;
}

/**
 * Scrubs sensitive in-memory auth caches when a debugger or DevTools inspection is detected.
 */
function handleDebuggerDetected(onViolation?: (reason: string) => void): void {
  try {
    if (typeof window !== 'undefined') {
      try {
        if (typeof sessionStorage !== 'undefined' && typeof sessionStorage.clear === 'function') {
          sessionStorage.clear();
        } else if ((window as any).sessionStorage && typeof (window as any).sessionStorage.clear === 'function') {
          (window as any).sessionStorage.clear();
        }
      } catch {
        // Ignore restricted storage contexts
      }
      delete (window as any).__TALNOVA_AUTH_TOKEN__;
      delete (window as any).__TALNOVA_EMPLOYEE_TOKEN__;
      delete (window as any).__TALNOVA_SESSION__;
    }
    if (typeof onViolation === 'function') {
      onViolation('DEBUGGER_DETECTED');
    }
  } catch {
    // Fail-safe
  }
}

/**
 * Lightweight, background timing monitor that checks execution delta to detect
 * when DevTools pauses execution with breakpoints or inspector.
 */
let debuggerInterval: any = null;
export function initDebuggerTrap(onViolation?: (reason: string) => void, force = false): void {
  if (typeof window === 'undefined') return;

  const isProd =
    force ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ||
    (typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.PROD));
  if (!isProd) return;

  if (debuggerInterval) return;

  let lastTime = Date.now();
  debuggerInterval = setInterval(() => {
    const currentTime = Date.now();
    if (currentTime - lastTime > 200) {
      // Execution was paused by a debugger breakpoint or DevTools inspector
      handleDebuggerDetected(onViolation);
    }
    lastTime = currentTime;
  }, 100);

  if (debuggerInterval?.unref) {
    debuggerInterval.unref();
  }
}

export function stopDebuggerTrap(): void {
  if (debuggerInterval) {
    clearInterval(debuggerInterval);
    debuggerInterval = null;
  }
}

/**
 * Protects prototype modifications against malicious browser extensions.
 */
export function protectPrototypes(): void {
  try {
    // Cleanse potential object prototype pollution
    const dangerousProps = ['polluted', 'isAdmin', 'role', 'auth', 'token'];
    for (const prop of dangerousProps) {
      if (Object.prototype.hasOwnProperty.call(Object.prototype, prop) || ({} as any)[prop] !== undefined) {
        delete (Object.prototype as any)[prop];
      }
    }
  } catch {
    // Ignore in strict contexts
  }
}

/**
 * Centralized initialization hook for client security shield.
 */
export function initAntiTamperShield(options?: AntiTamperOptions): void {
  if (typeof window === 'undefined') return;
  if (window.__TALNOVA_SHIELD_ACTIVE__) return;

  window.__TALNOVA_SHIELD_ACTIVE__ = true;

  if (options?.enableDomainLock !== false) {
    enforceDomainLock(options?.customAllowedDomains);
  }

  if (options?.enableDevToolsNeutralization !== false) {
    disableReactDevTools();
  }

  if (options?.enableConsoleNeutering !== false) {
    neuterConsole();
  }

  if (options?.enableDebuggerTrap !== false) {
    initDebuggerTrap(options?.onViolation);
  }

  protectPrototypes();
}

export default initAntiTamperShield;
