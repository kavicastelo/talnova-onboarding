/**
 * Talnova Demo Anti-Tamper & Security Shield
 * Prevents DevTools inspection, console metadata leakage, and React DevTools reflection.
 */

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, any>;
  }
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
          win.__REACT_DEVTOOLS_GLOBAL_HOOK__[key] = typeof value === 'function' ? () => { } : null;
        }
      } else {
        // Pre-emptively register dead hook to prevent React DevTools from attaching later
        win.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          inject: () => { },
          sub: () => { },
          supportsFiber: true,
          renderers: new Map(),
          onCommitFiberRoot: () => { },
          onCommitFiberUnmount: () => { },
        };
      }
    }
  } catch {
    // Fail silently in restricted sandbox contexts
  }
}

/**
 * Neutering console methods in demo build to prevent proprietary schema,
 * token, and metadata leakage via browser console.
 */
export function neuterConsole(force = false): void {
  const isDemoBuild =
    typeof process !== 'undefined' &&
    (process.env?.VITE_IS_DEMO_BUILD === 'true' || process.env?.NODE_ENV === 'production');
  const isViteProd =
    typeof import.meta !== 'undefined' &&
    ((import.meta as any).env?.PROD || (import.meta as any).env?.VITE_IS_DEMO_BUILD === 'true');

  if (force || isDemoBuild || isViteProd) {
    const noop = () => { };
    // Suppress verbose metadata loggers
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
    console.table = noop;
    console.dir = noop;
  }
}

/**
 * Enforces domain locking to prevent offline execution or hosting on unauthorized domains.
 */
export function enforceDomainLock(customAllowedDomains?: string[]): boolean {
  if (typeof window === 'undefined') return true;

  // Support environment variable configuration (e.g. VITE_DEMO_ALLOWED_DOMAINS=my-site.com,client-demo.org)
  const envDomainsStr =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as any).env?.VITE_DEMO_ALLOWED_DOMAINS ||
        (import.meta as any).env?.VITE_ALLOWED_DOMAINS)) ||
    '';
  const envDomains = envDomainsStr
    ? envDomainsStr
      .split(',')
      .map((d: string) => d.trim().toLowerCase())
      .filter(Boolean)
    : [];

  const defaultAllowedDomains = [
    'localhost',
    '127.0.0.1',
    'talnova.io',
    'demo.talnova.io',
    'talnovaonboard.com',
    'demo.talnovaonboard.com',
    'vercel.app',
    'netlify.app',
  ];

  const allowedDomains = customAllowedDomains || [
    ...defaultAllowedDomains,
    ...envDomains,
  ];

  const hostname = window.location.hostname.toLowerCase();
  const isAllowed = allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith('.' + domain)
  );

  if (!isAllowed) {
    if (typeof document !== 'undefined' && document.body) {
      document.body.innerHTML =
        '<div style="display:flex;height:100vh;align-items:center;justify-content:center;background:#090d16;color:#f87171;font-family:sans-serif;text-align:center;padding:24px;"><div><h1 style="font-size:24px;font-weight:bold;margin-bottom:8px;">Unauthorized Distribution</h1><p style="font-size:14px;color:#94a3b8;max-width:440px;">This interactive demonstration is cryptographically bound to authorized Talnova domains. Execution has been terminated.</p></div></div>';
    }
    throw new Error('DEMO_SECURITY_VIOLATION: Execution blocked outside authorized domain.');
  }

  return true;
}
