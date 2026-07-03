import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import {
  SUPPORTED_LOCALES,
  FALLBACK_LOCALE,
  LANG_STORAGE_KEY,
  I18N_NAMESPACES,
  LOCALE_DISPLAY_NAMES,
} from './localization.config';

// Re-export from shared config so existing imports keep working
export { SUPPORTED_LOCALES, LOCALE_DISPLAY_NAMES, LANG_STORAGE_KEY };
export type { SupportedLocale } from './localization.config';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    ns: I18N_NAMESPACES,
    defaultNS: 'common',
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ['localStorage'],
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    interpolation: {
      escapeValue: false,
    },

    partialBundledLanguages: true,

    react: {
      useSuspense: false,
    },
  });

export default i18n;
