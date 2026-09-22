import 'i18next';
import type { I18nNamespace, SupportedLocale } from '../i18n/localization.config';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    returnNull: false;
  }
}

export type { I18nNamespace, SupportedLocale };
