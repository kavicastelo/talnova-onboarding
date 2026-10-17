/**
 * Headless Browser & Automated Bot Detection
 * Protects the Talnova Demo environment against automated scrapers, headless crawlers (Puppeteer, Playwright, Selenium),
 * and competitor exfiltration scripts.
 */

export interface BotDetectionResult {
  isBot: boolean;
  reason?: string;
  signals: string[];
}

/**
 * Inspects browser environment globals, navigator properties, and automation signatures.
 */
export function detectBot(
  customWindow?: any,
  customNavigator?: any
): BotDetectionResult {
  const win = customWindow || (typeof window !== 'undefined' ? window : undefined);
  const nav = customNavigator || (typeof navigator !== 'undefined' ? navigator : undefined);

  if (!win || !nav) {
    return { isBot: false, signals: [] };
  }

  const signals: string[] = [];

  // 1. Explicit WebDriver flag (standard in Puppeteer, Playwright, Selenium)
  if (nav.webdriver === true) {
    signals.push('navigator.webdriver is true');
  }

  // 2. Known automation runner globals
  if (win.callPhantom || win._phantom) {
    signals.push('PhantomJS environment detected (callPhantom/_phantom)');
  }
  if (win.__nightmare) {
    signals.push('Nightmare.js environment detected (__nightmare)');
  }
  if (
    win.domAutomation ||
    win.domAutomationController ||
    (typeof document !== 'undefined' &&
      ((document as any).__selenium_unwrapped ||
        (document as any).__webdriver_evaluate ||
        (document as any).$cdc_asdjflasutopfhvcZLmcfl_))
  ) {
    signals.push('Selenium or ChromeDriver automation markers detected');
  }
  if (win.Cypress) {
    signals.push('Cypress automation runner detected');
  }

  // 3. User-Agent headless signatures
  const ua = nav.userAgent || '';
  if (/HeadlessChrome|Puppeteer|Playwright|PhantomJS/i.test(ua)) {
    signals.push(`Automated user-agent signature detected: ${ua}`);
  }

  // 4. Missing browser languages
  if (Array.isArray(nav.languages) && nav.languages.length === 0) {
    signals.push('navigator.languages array is empty');
  }

  // 5. Inconsistent platform vs User-Agent spoofing
  const platform = nav.platform || '';
  if (
    (platform.includes('Linux') && !/Android|Linux/i.test(ua) && /Win|Mac/i.test(ua)) ||
    (platform.includes('Win') && /Macintosh/i.test(ua)) ||
    (platform.includes('Mac') && /Windows NT/i.test(ua))
  ) {
    signals.push(`Platform mismatch: platform '${platform}' contradicts userAgent '${ua}'`);
  }

  const isBot = signals.length > 0;
  return {
    isBot,
    reason: isBot ? signals[0] : undefined,
    signals,
  };
}

/**
 * Enforces bot defense on demo initialization.
 * If a bot or headless runner is detected, it terminates the demo session,
 * wipes storage credentials, and redirects or renders access-denied lockdown.
 */
export function enforceBotDefense(
  customWindow?: any,
  customNavigator?: any
): boolean {
  const win = customWindow || (typeof window !== 'undefined' ? window : undefined);
  const result = detectBot(customWindow, customNavigator);

  if (result.isBot) {
    // 1. Wipe local demo credentials
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('demo_access_token');
        localStorage.removeItem('demo_active_user');
        localStorage.removeItem('demo_persona');
        localStorage.removeItem('demo_tenant_id');
      } catch {
        // Ignore storage errors in restrictive environments
      }
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {
        // Ignore
      }
    }

    // 2. Redirect or lock screen
    if (win && win.location) {
      const currentPath = win.location.pathname || '';
      if (!currentPath.includes('access-denied') && !currentPath.includes('403')) {
        const targetUrl = currentPath.startsWith('/demo')
          ? '/demo/access-denied?reason=bot_detected'
          : '/403?reason=bot_detected';

        try {
          win.location.replace(targetUrl);
        } catch {
          win.location.href = targetUrl;
        }
      }
    }

    return true; // Bot blocked
  }

  return false; // Clean interactive user
}
