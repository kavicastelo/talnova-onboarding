import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LeadTable } from '../components/super-admin/sales/LeadTable';
import { CreateLeadModal } from '../components/super-admin/sales/CreateLeadModal';
import { SuperAdminLeads } from '../pages/super-admin/sales/SuperAdminLeads';
import { salesService, LeadItem } from '../services/sales.service';
import { SuperAdminFilterProvider } from '../context/SuperAdminFilterContext';
import { RoleProvider } from '../context/RoleContext';
import { SidebarProvider } from '../components/Sidebar';
import { AppShell } from '../components/AppShell';

// Mock Sonner toast and Toaster component
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
    Toaster: () => null,
  };
});

// Mock external hooks used by AppShell and SuperAdminShell
vi.mock('../hooks/useAuth', () => ({
  useCurrentUser: () => ({
    data: { id: 'usr-super', name: 'Super Admin', email: 'super@talnova.test', role: 'super_admin' },
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

vi.mock('../hooks/useSuperAdmin', () => ({
  useSuperAdminOrganizations: () => ({
    data: { data: [] },
    isLoading: false,
  }),
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

// Mock Sales Service
vi.mock('../services/sales.service', async () => {
  const actual = await vi.importActual<any>('../services/sales.service');
  return {
    ...actual,
    salesService: {
      getLeads: vi.fn(),
      getLeadById: vi.fn(),
      createLead: vi.fn(),
      updateLead: vi.fn(),
      updateLeadStatus: vi.fn(),
      deleteLead: vi.fn(),
      recalculateScore: vi.fn(),
      checkDuplicates: vi.fn(),
      mergeLeads: vi.fn(),
      previewCsvImport: vi.fn(),
      executeCsvImport: vi.fn(),
    },
  };
});

const mockLeads: LeadItem[] = [
  {
    _id: 'lead-1',
    name: 'Sarah Connor',
    email: 'sarah@cyberdyne.test',
    phone: '+1 555-0100',
    companyName: 'Cyberdyne Systems',
    jobTitle: 'Head of Security',
    source: 'product_demo',
    status: 'qualified',
    score: 85,
    priority: 'urgent',
    currency: 'USD',
    tags: ['enterprise', 'high-intent'],
    createdAt: '2026-05-10T10:00:00.000Z',
    updatedAt: '2026-05-10T10:00:00.000Z',
  },
  {
    _id: 'lead-2',
    name: 'Miles Dyson',
    email: 'miles@cyberdyne.test',
    companyName: 'Cyberdyne Systems',
    jobTitle: 'VP Engineering',
    source: 'website',
    status: 'new',
    score: 35,
    priority: 'normal',
    currency: 'USD',
    tags: ['tech'],
    createdAt: '2026-05-12T14:30:00.000Z',
    updatedAt: '2026-05-12T14:30:00.000Z',
  },
];

function renderWithProviders(element: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SuperAdminFilterProvider>
          {element}
        </SuperAdminFilterProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LEAD-006: Super Admin Lead Management UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LeadTable Component', () => {
    it('renders honest empty state when no leads exist without hardcoded mock records', () => {
      const html = renderWithProviders(
        <LeadTable
          leads={[]}
          isLoading={false}
          total={0}
          page={1}
          limit={10}
          totalPages={0}
          onPageChange={vi.fn()}
          onCreateLeadClick={vi.fn()}
        />
      );

      expect(html).toContain('No leads found');
      expect(html).toContain('No prospective leads match your current search and filter criteria');
      expect(html).toContain('Create New Lead');
      // Verify no fake demo names leak into empty state
      expect(html).not.toContain('John Doe');
      expect(html).not.toContain('Acme Corporation');
    });

    it('renders live database records with name, company, email, score, priority, status', () => {
      const html = renderWithProviders(
        <LeadTable
          leads={mockLeads}
          isLoading={false}
          total={2}
          page={1}
          limit={10}
          totalPages={1}
          onPageChange={vi.fn()}
        />
      );

      // Lead 1
      expect(html).toContain('Sarah Connor');
      expect(html).toContain('sarah@cyberdyne.test');
      expect(html).toContain('+1 555-0100');
      expect(html).toContain('Head of Security');
      expect(html).toContain('85');
      expect(html).toContain('Qualified');
      expect(html).toContain('Urgent');

      // Lead 2
      expect(html).toContain('Miles Dyson');
      expect(html).toContain('miles@cyberdyne.test');
      expect(html).toContain('VP Engineering');
      expect(html).toContain('35');
      expect(html).toContain('New');
      expect(html).toContain('Normal');

      // Shared Company & Pagination
      expect(html).toContain('Cyberdyne Systems');
      expect(html).toContain('Showing');
      expect(html).toContain('Page');
      expect(html).toContain('leads');
    });
  });

  describe('CreateLeadModal Component', () => {
    it('renders form elements and fields for creating a prospective lead', () => {
      const html = renderWithProviders(
        <CreateLeadModal isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />
      );

      expect(html).toContain('Create Prospective Sales Lead');
      expect(html).toContain('Full Name');
      expect(html).toContain('Work Email');
      expect(html).toContain('Company Name');
      expect(html).toContain('Phone Number');
      expect(html).toContain('Job Title');
      expect(html).toContain('Industry');
      expect(html).toContain('Company Size');
      expect(html).toContain('Lead Source');
      expect(html).toContain('Initial Priority');
      expect(html).toContain('Estimated Budget (USD)');
      expect(html).toContain('Product Demo Request (+25 pts)');
    });
  });

  describe('SuperAdminLeads Page Component', () => {
    it('mounts inside SuperAdminShell with KPI cards, search input, and filter controls', () => {
      vi.mocked(salesService.getLeads).mockReturnValue(
        Promise.resolve({
          items: mockLeads,
          pagination: {
            total: 2,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        })
      );

      const html = renderWithProviders(<SuperAdminLeads />);

      // Shell Header
      expect(html).toContain('Lead Management');
      expect(html).toContain('Enterprise sales pipeline, automated prospect scoring, and CRM lead routing');

      // Metric KPI Cards
      expect(html).toContain('Total Pipeline Leads');
      expect(html).toContain('Qualified / Opps');
      expect(html).toContain('High Potential (≥50 pts)');
      expect(html).toContain('Avg Lead Score');

      // Search & Filters
      expect(html).toContain('Search leads by name, company, email, or job title...');
      expect(html).toContain('All Statuses');
      expect(html).toContain('All Sources');
      expect(html).toContain('All Priorities');
      expect(html).toContain('Newest First');
      expect(html).toContain('New Lead');
    });
  });

  describe('Navigation Integration (AppShell)', () => {
    it('includes Sales & Acquisition with Lead Management under super admin role', () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/super-admin/sales/leads']}>
            <RoleProvider initialRole="super_admin">
              <SuperAdminFilterProvider>
                <SidebarProvider>
                  <AppShell />
                </SidebarProvider>
              </SuperAdminFilterProvider>
            </RoleProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(html).toContain('Sales &amp; Acquisition');
      expect(html).toContain('Lead Management');
      expect(html).toContain('/super-admin/sales/leads');
    });
  });
});
