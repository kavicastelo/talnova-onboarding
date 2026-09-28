import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoleProvider } from '../context/RoleContext';
import { LanguageProvider } from '../context/LanguageContext';
import { Login } from '../pages/Login';
import { TenantProvisionModal } from '../components/super-admin/TenantProvisionModal';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

vi.mock('../services/sso.service', () => ({
  ssoService: {
    discoverDomain: vi.fn().mockResolvedValue(null),
    initiateSSO: vi.fn().mockResolvedValue({ authUrl: '' }),
  },
}));

// Mock localStorage for SSR test environment
const storageMap: Record<string, string> = { talnova_lang: 'en' };
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap[key] ?? null,
  setItem: (key: string, val: string) => { storageMap[key] = val; },
  removeItem: (key: string) => { delete storageMap[key]; },
  clear: () => { Object.keys(storageMap).forEach((k) => delete storageMap[k]); },
  key: () => null,
  length: 1,
};

describe('Phase 3: First-Login Password Reset & Provisioning Authentication Hand-off', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it('renders Login screen with email, password, and sign-in controls', () => {
    const html = renderToString(
      <LanguageProvider>
        <RoleProvider initialRole="employee">
          <MemoryRouter>
            <Login />
          </MemoryRouter>
        </RoleProvider>
      </LanguageProvider>
    );

    expect(html).toContain('id="login-email-input"');
    expect(html).toContain('id="login-password-input"');
    expect(html).toContain('id="standard-login-submit"');
  });

  it('renders TenantProvisionModal with password generator, email dispatch toggle, and password change requirement', () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <TenantProvisionModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />
        </LanguageProvider>
      </QueryClientProvider>
    );

    // Initial password generation options
    expect(html).toContain('Initial Password Configuration');
    expect(html).toContain('Send branded Welcome Email with activation link and credentials');
    expect(html).toContain('Require user to change password upon first sign-in');
    expect(html).toContain('Regenerate');
    expect(html).toContain('Provision New Tenant Workspace');
  });
});
