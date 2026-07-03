import {
  SUPPORTED_LOCALES,
  LOCALE_REGIONS,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "../../config/localization.config.js";

/**
 * LocaleNegotiator
 *
 * RFC 5646 (language tags) + RFC 2616 §14.4 (Accept-Language header) compliant
 * locale resolution.
 *
 * Negotiation order:
 *   1. Parse all lang;q= pairs from Accept-Language header
 *   2. Sort by q-value descending (default q=1.0 when omitted)
 *   3. For each candidate:
 *      a. Exact match against SUPPORTED_LOCALES (e.g. "fi" → "fi")
 *      b. Region variant lookup (e.g. "en-GB" → "en")
 *      c. Language-only strip (e.g. "ta-LK" → "ta")
 *   4. First match wins
 *   5. Final fallback: DEFAULT_LOCALE
 *
 * Never throws. Returns a SupportedLocale.
 */
export class LocaleNegotiator {
  /**
   * Resolve the best matching locale from an Accept-Language header value.
   *
   * @example
   *   negotiate("en-GB;q=0.9, fi;q=0.8, ta-LK;q=0.7") → "en"
   *   negotiate("zh-CN")                                 → "en" (fallback)
   *   negotiate("")                                      → "en"
   *   negotiate(undefined)                               → "en"
   */
  negotiate(acceptLanguage: string | undefined): SupportedLocale {
    if (!acceptLanguage) return DEFAULT_LOCALE;

    const candidates = this.parse(acceptLanguage);

    for (const candidate of candidates) {
      const resolved = this.resolveCandidate(candidate);
      if (resolved) return resolved;
    }

    return DEFAULT_LOCALE;
  }

  /**
   * Validate a single locale string.
   * Returns the normalized SupportedLocale or null if unsupported.
   * Does NOT throw — callers decide error behaviour.
   */
  resolve(lang: string | undefined): SupportedLocale | null {
    if (!lang) return null;
    return this.resolveCandidate(lang.trim()) ?? null;
  }

  /**
   * Validate and return a SupportedLocale.
   * Returns DEFAULT_LOCALE for unsupported values (silent fallback for middleware).
   */
  normalize(lang: string | undefined): SupportedLocale {
    return this.resolve(lang) ?? DEFAULT_LOCALE;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Parse an Accept-Language header into a sorted list of language tags.
   * Sorting is stable: equal q-values preserve declaration order.
   *
   * "en-GB;q=0.9, fi, ta-LK;q=0.7" → ["fi", "en-GB", "ta-LK"]
   */
  private parse(header: string): string[] {
    return header
      .split(",")
      .map((part) => {
        const [lang, q] = part.trim().split(";");
        const qValue = q ? parseFloat(q.replace(/^q=/i, "")) : 1.0;
        return { lang: lang.trim(), q: isNaN(qValue) ? 1.0 : qValue };
      })
      .filter(({ lang, q }) => lang.length > 0 && q > 0)
      .sort((a, b) => b.q - a.q)
      .map(({ lang }) => lang);
  }

  /**
   * Try to match a single language tag against supported locales.
   * Attempt order: exact → region map → language strip
   */
  private resolveCandidate(lang: string): SupportedLocale | undefined {
    const lower = lang.toLowerCase();

    // 1. Exact match (e.g. "en", "fi", "ta", "si")
    if (SUPPORTED_LOCALES.includes(lower as SupportedLocale)) {
      return lower as SupportedLocale;
    }

    // 2. Region variant lookup (e.g. "en-gb" → "en")
    if (LOCALE_REGIONS[lower]) {
      return LOCALE_REGIONS[lower];
    }

    // 3. Strip region and try base language (e.g. "ta-LK" → "ta")
    const base = lower.split("-")[0];
    if (SUPPORTED_LOCALES.includes(base as SupportedLocale)) {
      return base as SupportedLocale;
    }

    return undefined;
  }
}

export const localeNegotiator = new LocaleNegotiator();
export default LocaleNegotiator;
