import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoleProvider } from '../context/RoleContext';
import { SidebarProvider } from '../components/Sidebar';
import { AppShell, filterNavSections, NavSection } from '../components/AppShell';

// Mock TanStack query hooks and external services used by AppShell
vi.mock('../hooks/useAuth', () => ({
  useCurrentUser: () => ({
    data: { id: 'usr-1', name: 'Test User', email: 'user@talnova.test', role: 'admin' },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useSettings', () => ({
  useWorkspaceSettings: () => ({
    data: { orgName: 'Talnova Corp', primaryColor: '#4F46E5' },
    isLoading: false,
  }),
}));

vi.mock('../hooks/useDocuments', () => ({
  useEmployeeDocumentInbox: () => ({ data: [] }),
}));

vi.mock('../hooks/useOnboardingExceptions', () => ({
  useOnboardingExceptions: () => ({ data: { pagination: { total: 0 } } }),
}));

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ data: [] }),
  useUnreadNotificationCount: () => ({ data: 0 }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

vi.mock('../hooks/useJourneys', () => ({
  useJourneys: () => ({ data: [] }),
}));

vi.mock('../hooks/useEmployees', () => ({
  useEmployees: () => ({ data: [] }),
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}));

vi.mock('../components/PWAInstallBanner', () => ({
  PWAInstallBanner: () => null,
}));

vi.mock('../components/CommandPalette', () => ({
  CommandPalette: () => null,
  useCommandPaletteHotkey: () => undefined,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'items.dashboard': 'Dashboard',
        'items.knowledgeBase': 'Knowledge Base',
        'items.myLearning': 'Journey Templates',
        'items.analytics': 'Analytics',
        'items.settings': 'Settings',
      };
      return map[key] || key;
    },
  }),
}));

// Mock localStorage for test runtime
const storageMap: Record<string, string> = { auth_token: 'mock_jwt_token' };
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap[key] ?? null,
  setItem: (key: string, val: string) => { storageMap[key] = val; },
  removeItem: (key: string) => { delete storageMap[key]; },
  clear: () => { Object.keys(storageMap).forEach((k) => delete storageMap[k]); },
  key: () => null,
  length: 1,
};

describe('PR-NAV-001: Dynamic Feature Flag & Capability Navigation Filtering', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    storageMap['auth_token'] = 'mock_jwt_token';
  });

  const renderAppShellWithFeatures = (features: Record<string, boolean>, role: any = 'admin') => {
    return renderToString(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <SidebarProvider>
            <RoleProvider initialRole={role} initialFeatures={features}>
              <AppShell />
            </RoleProvider>
          </SidebarProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('Step 1-3: When kiosk_mode and ai_course_builder are disabled, items are NOT rendered', () => {
    const html = renderAppShellWithFeatures({
      kiosk_mode: false,
      ai_course_builder: false,
    });

    // Both feature-flagged items must NOT be in the rendered output
    expect(html).not.toContain('Kiosk Terminals');
    expect(html).not.toContain('AI Course Builder');

    // Unflagged / standard items should remain present
    expect(html).toContain('Employee Directory');
    expect(html).toContain('Knowledge Base');
  });

  it('Step 4-5: Re-rendering with kiosk_mode: true restores "Kiosk Terminals" into navigation', () => {
    const html = renderAppShellWithFeatures({
      kiosk_mode: true,
      ai_course_builder: false,
    });

    // Kiosk Terminals must now appear
    expect(html).toContain('Kiosk Terminals');

    // AI Course Builder must still be hidden
    expect(html).not.toContain('AI Course Builder');
  });

  it('Re-rendering with ai_course_builder: true restores "AI Course Builder"', () => {
    const html = renderAppShellWithFeatures({
      kiosk_mode: false,
      ai_course_builder: true,
    });

    expect(html).not.toContain('Kiosk Terminals');
    expect(html).toContain('AI Course Builder');
  });

  it('Filters optional sub-items in Settings dropdown based on feature flags', () => {
    // Both sso_enforcement and advanced_hris_sync disabled
    const htmlDisabled = renderAppShellWithFeatures({
      sso_enforcement: false,
      advanced_hris_sync: false,
    });

    expect(htmlDisabled).not.toContain('SSO &amp; Identity');
    expect(htmlDisabled).not.toContain('SSO & Identity');
    expect(htmlDisabled).not.toContain('HRIS Integrations');

    // Enable SSO
    const htmlWithSSO = renderAppShellWithFeatures({
      sso_enforcement: true,
      advanced_hris_sync: false,
    });
    expect(htmlWithSSO.includes('SSO &amp; Identity') || htmlWithSSO.includes('SSO & Identity')).toBe(true);
    expect(htmlWithSSO).not.toContain('HRIS Integrations');

    // Enable HRIS
    const htmlWithHRIS = renderAppShellWithFeatures({
      sso_enforcement: false,
      advanced_hris_sync: true,
    });
    expect(htmlWithHRIS).toContain('HRIS Integrations');
  });

  it('Prunes sections when all items inside the section are filtered out', () => {
    const mockSections: NavSection[] = [
      {
        label: 'Flagged Section',
        items: [
          {
            title: 'Kiosk Terminals',
            url: '/kiosks',
            icon: (() => null) as any,
            featureFlag: 'kiosk_mode',
          },
        ],
      },
      {
        label: 'Active Section',
        items: [
          {
            title: 'Knowledge Base',
            url: '/kb',
            icon: (() => null) as any,
          },
        ],
      },
    ];

    const canMock = () => true;

    // With kiosk_mode disabled, 'Flagged Section' must be completely pruned
    const filteredDisabled = filterNavSections(mockSections, canMock, (flag) => flag !== 'kiosk_mode');
    expect(filteredDisabled).toHaveLength(1);
    expect(filteredDisabled[0].label).toBe('Active Section');

    // With kiosk_mode enabled, both sections remain
    const filteredEnabled = filterNavSections(mockSections, canMock, () => true);
    expect(filteredEnabled).toHaveLength(2);
  });

  it('Filters by role capability as well as feature flags', () => {
    const mockSections: NavSection[] = [
      {
        label: 'Operations',
        items: [
          {
            title: 'Protected Ops',
            url: '/ops',
            icon: (() => null) as any,
            capability: 'manage_it_ops',
          },
          {
            title: 'Flagged & Protected',
            url: '/flagged-ops',
            icon: (() => null) as any,
            capability: 'manage_it_ops',
            featureFlag: 'kiosk_mode',
          },
        ],
      },
    ];

    // Case 1: Capability denied
    const denied = filterNavSections(mockSections, () => false, () => true);
    expect(denied).toHaveLength(0); // Entire section pruned because all items denied

    // Case 2: Capability granted, feature denied
    const capGrantedFeatureDenied = filterNavSections(
      mockSections,
      () => true,
      (flag) => flag !== 'kiosk_mode'
    );
    expect(capGrantedFeatureDenied).toHaveLength(1);
    expect(capGrantedFeatureDenied[0].items).toHaveLength(1);
    expect(capGrantedFeatureDenied[0].items[0].title).toBe('Protected Ops');
  });
});
