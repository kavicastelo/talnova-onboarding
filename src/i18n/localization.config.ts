/**
 * Centralized localization configuration — FRONTEND mirror.
 *
 * Must stay structurally identical to server/src/config/localization.config.ts.
 * Kept as a separate file because frontend and backend are separate TypeScript
 * compilation units. Update both files together when adding a new language.
 *
 * Adding a new language requires:
 *   1. Add entry to SUPPORTED_LOCALES (here AND in backend config)
 *   2. Add display name to LOCALE_DISPLAY_NAMES
 *   3. Add region variants to LOCALE_REGIONS
 *   4. Add RTL flag if needed
 *   5. Create /public/locales/{code}/ JSON resource files
 *   6. No other code changes.
 */

export const SUPPORTED_LOCALES = ['en', 'si', 'ta', 'fi'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const FALLBACK_LOCALE: SupportedLocale = 'en';

/** Locales whose scripts are written right-to-left */
export const RTL_LOCALES: ReadonlySet<string> = new Set<string>([]);

/** Human-readable display names for the language switcher */
export const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  si: 'සිංහල',
  ta: 'தமிழ்',
  fi: 'Suomi',
};

/**
 * Region variants accepted in Accept-Language headers.
 * Maps region tag → base supported locale.
 */
export const LOCALE_REGIONS: Record<string, SupportedLocale> = {
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  'en-ca': 'en',
  'fi-fi': 'fi',
  'ta-lk': 'ta',
  'ta-in': 'ta',
  'si-lk': 'si',
};

/** localStorage key for language persistence */
export const LANG_STORAGE_KEY = 'talnova_lang';

/** i18next namespaces */
export const I18N_NAMESPACES = [
  'common', 'auth', 'nav', 'dashboard', 'journeys', 'kb', 'settings', 'validation',
] as const;
export type I18nNamespace = (typeof I18N_NAMESPACES)[number];
