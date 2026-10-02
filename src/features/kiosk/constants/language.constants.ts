export interface WorkforceLanguage {
  readonly code: string;
  readonly englishName: string;
  readonly autonym: string;
  readonly direction: 'ltr' | 'rtl';
  readonly flagEmoji?: string;
  readonly regionalInfo?: string;
}

/**
 * Standard industrial and agricultural workforce language catalog.
 * Supports primary languages with English and native autonyms.
 */
export const WORKFORCE_LANGUAGES: readonly WorkforceLanguage[] = [
  { code: 'en', englishName: 'English', autonym: 'English', direction: 'ltr', flagEmoji: '🇬🇧' },
  { code: 'es', englishName: 'Spanish', autonym: 'Español', direction: 'ltr', flagEmoji: '🇪🇸' },
  { code: 'fr', englishName: 'French', autonym: 'Français', direction: 'ltr', flagEmoji: '🇫🇷' },
  { code: 'de', englishName: 'German', autonym: 'Deutsch', direction: 'ltr', flagEmoji: '🇩🇪' },
  { code: 'ar', englishName: 'Arabic', autonym: 'العربية', direction: 'rtl', flagEmoji: '🇸🇦' },
  { code: 'he', englishName: 'Hebrew', autonym: 'עברית', direction: 'rtl', flagEmoji: '🇮🇱' },
  { code: 'ur', englishName: 'Urdu', autonym: 'اردو', direction: 'rtl', flagEmoji: '🇵🇰' },
  { code: 'vi', englishName: 'Vietnamese', autonym: 'Tiếng Việt', direction: 'ltr', flagEmoji: '🇻🇳' },
  { code: 'hi', englishName: 'Hindi', autonym: 'हिन्दी', direction: 'ltr', flagEmoji: '🇮🇳' },
  { code: 'si', englishName: 'Sinhala', autonym: 'සිංහල', direction: 'ltr', flagEmoji: '🇱🇰' },
  { code: 'ta', englishName: 'Tamil', autonym: 'தமிழ்', direction: 'ltr', flagEmoji: '🇮🇳' },
  { code: 'fi', englishName: 'Finnish', autonym: 'Suomi', direction: 'ltr', flagEmoji: '🇫🇮' },
  { code: 'pt', englishName: 'Portuguese', autonym: 'Português', direction: 'ltr', flagEmoji: '🇧🇷' },
  { code: 'zh', englishName: 'Chinese', autonym: '中文', direction: 'ltr', flagEmoji: '🇨🇳' },
  { code: 'tl', englishName: 'Tagalog', autonym: 'Tagalog', direction: 'ltr', flagEmoji: '🇵🇭' },
  { code: 'pl', englishName: 'Polish', autonym: 'Polski', direction: 'ltr', flagEmoji: '🇵🇱' },
  { code: 'uk', englishName: 'Ukrainian', autonym: 'Українська', direction: 'ltr', flagEmoji: '🇺🇦' },
] as const;

/** List of recognized Right-To-Left (RTL) language codes */
export const RTL_LANGUAGES = ['ar', 'he', 'ur'] as const;
export type RtlLanguageCode = (typeof RTL_LANGUAGES)[number];

export const RTL_LANGUAGE_SET: ReadonlySet<string> = new Set<string>(RTL_LANGUAGES);

/**
 * Returns true if the language code represents a Right-to-Left (RTL) language.
 */
export function isRtlLanguage(code?: string): boolean {
  if (!code) return false;
  const normalized = code.toLowerCase().split('-')[0];
  return RTL_LANGUAGE_SET.has(normalized);
}

/** Quick lookup dictionary by language code */
export const WORKFORCE_LANGUAGE_MAP: Record<string, WorkforceLanguage> = WORKFORCE_LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.code] = lang;
    return acc;
  },
  {} as Record<string, WorkforceLanguage>
);

/**
 * Returns formatted "English / Autonym" display label for a language code.
 * Example: getLanguageDisplayName('es') -> "Spanish / Español"
 */
export function getLanguageDisplayName(code: string): string {
  const lang = WORKFORCE_LANGUAGE_MAP[code];
  if (!lang) return code.toUpperCase();
  if (lang.englishName.toLowerCase() === lang.autonym.toLowerCase()) {
    return lang.englishName;
  }
  return `${lang.englishName} / ${lang.autonym}`;
}

/**
 * Returns native autonym for a language code.
 * Example: getLanguageAutonym('ar') -> "العربية"
 */
export function getLanguageAutonym(code: string): string {
  return WORKFORCE_LANGUAGE_MAP[code]?.autonym || code.toUpperCase();
}

/**
 * Returns script direction for a language code ('ltr' | 'rtl').
 */
export function getLanguageDirection(code?: string): 'ltr' | 'rtl' {
  if (!code) return 'ltr';
  return isRtlLanguage(code) ? 'rtl' : 'ltr';
}
