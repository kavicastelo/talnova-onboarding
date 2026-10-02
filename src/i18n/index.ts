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

import enCommon from './locales/en/common.json';
import enNav from './locales/en/nav.json';
import enAuth from './locales/en/auth.json';
import enKiosk from './locales/en/kiosk.json';
import esCommon from './locales/es/common.json';
import esKiosk from './locales/es/kiosk.json';
import arCommon from './locales/ar/common.json';
import arKiosk from './locales/ar/kiosk.json';

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

    // Core English, Spanish, and Arabic namespaces are bundled synchronously for zero-latency initial render
    resources: {
      en: {
        common: enCommon,
        nav: enNav,
        auth: enAuth,
        kiosk: enKiosk,
      },
      es: {
        common: esCommon,
        kiosk: esKiosk,
      },
      ar: {
        common: arCommon,
        kiosk: arKiosk,
      },
    },

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
    returnNull: false,
    returnEmptyString: false,

    react: {
      useSuspense: false,
    },
  });

export default i18n;
