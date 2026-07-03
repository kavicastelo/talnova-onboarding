import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { LanguageProvider } from './LanguageContext';

/**
 * LocalizationProvider
 *
 * Wraps the application with both the i18next provider and the custom
 * LanguageContext that handles persistence and profile sync.
 *
 * Mount this OUTSIDE RoleProvider in App.tsx so language is available
 * to all contexts and components.
 */
export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </I18nextProvider>
  );
}
