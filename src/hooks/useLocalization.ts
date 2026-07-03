import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import type { SupportedLocale } from '../i18n';

/**
 * useLocalization
 *
 * Convenience hook that combines i18next's `useTranslation` with the
 * app-level `useLanguage` context.
 *
 * Usage:
 * ```tsx
 * const { t, language, setLanguage } = useLocalization('auth');
 * // t('login.title') — from the 'auth' namespace
 * // language          — current SupportedLocale
 * // setLanguage('si') — switches and persists language
 * ```
 *
 * @param namespace  The i18n namespace to load (default: 'common')
 */
export function useLocalization(namespace: string = 'common') {
  const { t, i18n, ready } = useTranslation(namespace);
  const { language, setLanguage } = useLanguage();

  return {
    /** Translate a key within the given namespace */
    t,
    /** i18next instance (advanced use) */
    i18n,
    /** Whether translations are loaded */
    ready,
    /** Active locale code */
    language: language as SupportedLocale,
    /** Switch the application language */
    setLanguage,
  };
}

export default useLocalization;
