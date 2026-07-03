import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import i18n from '../i18n';
import {
  LANG_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../i18n/localization.config';
import { apiClient } from '../api/client';

interface LanguageContextValue {
  language: SupportedLocale;
  setLanguage: (lang: SupportedLocale) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

interface LanguageProviderProps {
  children: React.ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<SupportedLocale>(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as SupportedLocale;
    return SUPPORTED_LOCALES.includes(saved) ? saved : 'en';
  });

  // Sync i18next when language state changes
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
    localStorage.setItem(LANG_STORAGE_KEY, language);
  }, [language]);

  /**
   * Change the active language.
   *
   * Priority:
   * 1. Updates in-memory state immediately (instant UI re-render)
   * 2. Persists to localStorage for guest sessions
   * 3. If authenticated, persists to user profile via API (fire-and-forget)
   */
  const setLanguage = useCallback((lang: SupportedLocale) => {
    if (!SUPPORTED_LOCALES.includes(lang)) return;

    setLanguageState(lang);
    localStorage.setItem(LANG_STORAGE_KEY, lang);

    // Persist to backend if authenticated
    const token = localStorage.getItem('auth_token');
    if (token) {
      apiClient
        .patch('/employees/me/preferences', { language: lang })
        .catch(() => {
          // Non-critical — localStorage is the source of truth for guests
        });
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access and change the application language.
 *
 * - Use `language` to know the active locale.
 * - Use `setLanguage(code)` to switch language globally.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

/**
 * Apply a language override from the authenticated user profile.
 * Call this after login to let the profile preference win over localStorage.
 */
export function applyProfileLanguage(lang: string | undefined) {
  if (!lang) return;
  const normalized = lang.toLowerCase() as SupportedLocale;
  if (SUPPORTED_LOCALES.includes(normalized)) {
    localStorage.setItem(LANG_STORAGE_KEY, normalized);
    i18n.changeLanguage(normalized);
  }
}
