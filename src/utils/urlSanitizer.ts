/**
 * Safe Link & Dangerous Protocol Sanitizer
 * Defends against javascript:, vbscript:, data:, blob:, and file: URI injection,
 * reverse tab-nabbing, and dangerous protocol bypasses.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Validates whether a given URL is safe for browser navigation and anchor hrefs.
 * Accepts internal relative paths (/...), hash fragments (#...), and safe protocols (http, https, mailto, tel).
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Reject protocol-relative URLs (//attacker.com)
  if (trimmed.startsWith('//')) {
    return false;
  }

  // Allow internal relative URLs (/dashboard, /journeys)
  if (trimmed.startsWith('/')) {
    return true;
  }

  // Allow in-page anchor fragments (#top, #section)
  if (trimmed.startsWith('#')) {
    return true;
  }

  try {
    const origin = (typeof window !== 'undefined' && window.location?.origin) || 'https://localhost';
    const parsed = new URL(trimmed, origin);
    return SAFE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitizes an href string, falling back to a safe anchor ('#') if malicious or invalid.
 */
export function sanitizeHref(url: string | null | undefined, fallback = '#'): string {
  return isSafeUrl(url) && url ? url.trim() : fallback;
}

/**
 * Determines whether a URL points to an external origin compared to the current application origin.
 */
export function isExternalUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('#')) {
    return false;
  }

  try {
    const currentOrigin = (typeof window !== 'undefined' && window.location?.origin) || 'https://localhost';
    const currentHost = (typeof window !== 'undefined' && window.location?.host) || 'localhost';
    const parsed = new URL(trimmed, currentOrigin);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    return parsed.host !== currentHost;
  } catch {
    return false;
  }
}
