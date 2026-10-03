import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeleteOrganizationModal } from '../components/super-admin/DeleteOrganizationModal';
import { SuperAdminOrganizations } from '../pages/SuperAdminOrganizations';
import { superAdminService } from '../services/superAdmin.service';
import { apiClient } from '../api/client';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock SuperAdminFilterBar
vi.mock('../components/super-admin/SuperAdminFilterBar', () => ({
  SuperAdminFilterBar: () => <div data-testid="filter-bar" />,
}));

// Mock apiClient
vi.mock('../api/client', () => ({
  apiClient: {
    delete: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockDeleteMutateAsync = vi.fn();
const mockRestoreMutateAsync = vi.fn();

const mockOrganizations = [
  {
    id: 'org_active_1',
    name: 'Acme Technologies',
    slug: 'acme-corp',
    domain: 'acme.talnova.app',
    status: 'Active' as const,
    plan: 'Enterprise',
    seatLimit: 100,
    usersCount: 42,
    createdAt: '2026-01-15',
    supportEmail: 'admin@acme.com',
    isDeleted: false,
  },
  {
    id: 'org_archived_2',
    name: 'Legacy Global',
    slug: 'legacy-global',
    domain: 'legacy.talnova.app',
    status: 'Suspended' as const,
    plan: 'Growth',
    seatLimit: 25,
    usersCount: 5,
    createdAt: '2025-11-01',
    supportEmail: 'ops@legacy.com',
    isDeleted: true,
    deletedAt: '2026-03-01T00:00:00Z',
  },
];

vi.mock('../hooks/useSuperAdmin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useSuperAdmin')>();
  return {
    ...actual,
    useSuperAdminOrganizations: () => ({
      data: {
        data: mockOrganizations,
        total: mockOrganizations.length,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useUpdateOrganization: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useCreateOrganization: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useToggleOrganizationStatus: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useDeleteOrganization: () => ({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    }),
    useRestoreOrganization: () => ({
      mutateAsync: mockRestoreMutateAsync,
      isPending: false,
    }),
    useSuperAdminPackages: () => ({
      data: { packages: [] },
      isLoading: false,
    }),
    useAssignOrganizationPackage: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

describe('Phase 3: Super Admin Delete & Purge Organization Integration Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  describe('DeleteOrganizationModal Component', () => {
    it('renders modal with dual-mode tabs and default Soft Delete (Archive) state', () => {
      const org = {
        id: 'org_123',
        name: 'Nexus Dynamics',
        slug: 'nexus-dynamics',
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DeleteOrganizationModal
            isOpen={true}
            onClose={vi.fn()}
            organization={org}
          />
        </QueryClientProvider>
      );

      // Verify header & titles
      expect(html).toContain('Archive Organization');
      expect(html).toContain('Nexus Dynamics');

      // Verify dual-mode tabs
      expect(html).toContain('id="delete-mode-soft-tab"');
      expect(html).toContain('Archive (Soft Delete)');
      expect(html).toContain('id="delete-mode-hard-tab"');
      expect(html).toContain('Permanent Purge (GDPR)');

      // Verify Soft Delete explanation
      expect(html).toContain('Soft Delete / Archive Behavior');
      expect(html).toContain('Tenant status is set to');
      expect(html).toContain('Suspended');
      expect(html).toContain('can be restored anytime');

      // Verify Safety Barrier input
      expect(html).toContain('nexus-dynamics');
      expect(html).toContain('id="confirm-delete-slug-input"');
      expect(html).toContain('id="confirm-delete-organization-btn"');
    });

    it('renders modal correctly with target slug placeholder in safety barrier', () => {
      const org = {
        id: 'org_gdpr_456',
        name: 'EuroCorp AG',
        slug: 'eurocorp-ag',
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DeleteOrganizationModal
            isOpen={true}
            onClose={vi.fn()}
            organization={org}
          />
        </QueryClientProvider>
      );

      expect(html).toContain('eurocorp-ag');
      expect(html).toContain('placeholder="eurocorp-ag"');
    });
  });

  describe('SuperAdminOrganizations Page Component', () => {
    it('renders status filter tabs for All Tenants, Active, and Archived', () => {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SuperAdminOrganizations />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(html).toContain('All Tenants');
      expect(html).toContain('Active');
      expect(html).toContain('Archived');
    });

    it('renders active organizations with Delete button and 360 View', () => {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SuperAdminOrganizations />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Active tenant Acme Technologies
      expect(html).toContain('Acme Technologies');
      expect(html).toContain('id="tenant-row-acme-corp"');
      expect(html).toContain('id="delete-tenant-btn-acme-corp"');
      expect(html).toContain('id="edit-tenant-btn-acme-corp"');
      expect(html).toContain('id="suspend-tenant-btn-acme-corp"');
    });

    it('renders archived organizations with Archived badge, Restore button, and Hard Purge button', () => {
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SuperAdminOrganizations />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Archived tenant Legacy Global
      expect(html).toContain('Legacy Global');
      expect(html).toContain('id="tenant-row-legacy-global"');
      expect(html).toContain('id="restore-tenant-btn-legacy-global"');
      expect(html).toContain('id="purge-tenant-btn-legacy-global"');
    });
  });

  describe('SuperAdmin Service API Functions', () => {
    it('calls DELETE /super-admin/organizations/:id with soft mode query parameter', async () => {
      (apiClient.delete as any).mockResolvedValueOnce({
        data: { success: true, message: 'Organization archived' },
      });

      const res = await superAdminService.deleteOrganization('acme-corp', 'soft');
      expect(apiClient.delete).toHaveBeenCalledWith(
        '/super-admin/organizations/acme-corp',
        { params: { mode: 'soft' } }
      );
      expect(res.success).toBe(true);
    });

    it('calls DELETE /super-admin/organizations/:id with hard mode query parameter', async () => {
      (apiClient.delete as any).mockResolvedValueOnce({
        data: { success: true, message: 'Organization permanently purged' },
      });

      const res = await superAdminService.deleteOrganization('acme-corp', 'hard');
      expect(apiClient.delete).toHaveBeenCalledWith(
        '/super-admin/organizations/acme-corp',
        { params: { mode: 'hard' } }
      );
      expect(res.success).toBe(true);
    });

    it('calls POST /super-admin/organizations/:id/restore', async () => {
      (apiClient.post as any).mockResolvedValueOnce({
        data: { success: true, message: 'Organization restored' },
      });

      const res = await superAdminService.restoreOrganization('acme-corp');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/super-admin/organizations/acme-corp/restore'
      );
      expect(res.success).toBe(true);
    });
  });
});
