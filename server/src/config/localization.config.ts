/**
 * Centralized localization configuration.
 *
 * This is the single source of truth for all locale metadata on the BACKEND.
 * The frontend mirrors this structure in src/i18n/localization.config.ts.
 *
 * Adding a new language requires:
 *   1. Add entry to SUPPORTED_LOCALES
 *   2. Add display name to LOCALE_DISPLAY_NAMES
 *   3. Add region variants to LOCALE_REGIONS (if applicable)
 *   4. Add RTL flag if the script is right-to-left
 *   5. Create /public/locales/{code}/ resource files (frontend)
 *   6. No code changes anywhere else.
 */

export const SUPPORTED_LOCALES = ["en", "si", "ta", "fi"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const FALLBACK_LOCALE: SupportedLocale = "en";

/** Locales whose scripts are written right-to-left */
export const RTL_LOCALES: ReadonlySet<string> = new Set<string>([]);

/** Human-readable display names for the language switcher */
export const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  si: "සිංහල",
  ta: "தமிழ்",
  fi: "Suomi",
};

/**
 * Region variants accepted in Accept-Language headers.
 * Maps region tag → base supported locale.
 * Extend when adding locales that have common regional variants.
 */
export const LOCALE_REGIONS: Record<string, SupportedLocale> = {
  "en-us": "en",
  "en-gb": "en",
  "en-au": "en",
  "en-ca": "en",
  "fi-fi": "fi",
  "ta-lk": "ta",
  "ta-in": "ta",
  "si-lk": "si",
};

/** localStorage key shared between frontend and backend docs */
export const LANG_STORAGE_KEY = "talnova_lang";

/** Fields that are translatable on each entity type (documentation / admin tooling) */
export const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  journey: ["title", "description"],
  article: ["title", "summary", "body"],
  lesson: ["title", "description"],
  notification: ["title", "body"],
  email_template: ["subject", "body"],
  certificate_template: ["title", "body"],
};
