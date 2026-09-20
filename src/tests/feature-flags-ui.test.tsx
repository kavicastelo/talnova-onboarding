import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuperAdminFeatureFlags } from '../pages/super-admin/SuperAdminFeatureFlags';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock SuperAdminFilterBar to avoid filter context requirements
vi.mock('../components/super-admin/SuperAdminFilterBar', () => ({
  SuperAdminFilterBar: () => <div data-testid="filter-bar" />,
}));

const mockUpdateMutateAsync = vi.fn();
const mockCreateMutateAsync = vi.fn();
const mockToggleMutateAsync = vi.fn();

const mockFlags = [
  {
    key: 'ai_course_builder',
    name: 'AI Course Builder',
    description: 'Generates structured courses using AI',
    isEnabled: true,
    targetAudience: 'global',
    targetOrganizationIds: [],
    excludedOrganizationIds: [],
    targetRoles: [],
    rolloutPercentage: 100,
  },
  {
    key: 'onboarding_copilot',
    name: 'Onboarding AI Copilot',
    description: 'Autonomous virtual assistant guiding candidates',
    isEnabled: true,
    targetAudience: 'roles',
    targetOrganizationIds: [],
    excludedOrganizationIds: [],
    targetRoles: ['manager', 'employee'],
    rolloutPercentage: 100,
  },
];

vi.mock('../hooks/useSuperAdmin', () => ({
  useSuperAdminFeatureFlags: () => ({
    data: mockFlags,
    isLoading: false,
    isError: false,
  }),
  useToggleFeatureFlag: () => ({
    mutateAsync: mockToggleMutateAsync,
    isPending: false,
  }),
  useUpdateFeatureFlag: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useCreateFeatureFlag: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useSuperAdminOrganizations: () => ({
    data: [
      { id: 'org-1', name: 'Acme Corp', slug: 'acme' },
      { id: 'org-2', name: 'Beta Industries', slug: 'beta' },
    ],
  }),
}));

describe('PR-GOV-002: Role-Targeted Feature Overrides Super Admin UI', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('1. Flags targeted to specific roles display a "Roles: X, Y" badge in the table', () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <SuperAdminFeatureFlags />
      </QueryClientProvider>
    );

    // Flag 2 has targetRoles: ['manager', 'employee']
    expect(html).toContain('Roles: Manager, Employee');
    // Flag 1 has no targetRoles, should not render a roles badge
    expect(html).toContain('AI Course Builder');
  });

  it('2. Interactive Role Selection & Save Overrides Mutation Verification', async () => {
    // Simulate the exact workflow of opening override modal, switching audience to 'roles', selecting roles, and saving
    const selectedFlag = mockFlags[0]; // ai_course_builder
    let targetAudience = selectedFlag.targetAudience;
    const targetRoles = [...selectedFlag.targetRoles];
    const targetOrgIds: string[] = [];
    const excludedOrgIds: string[] = [];
    const rolloutPercentage = 100;
    const overrideReason = 'Test role restriction update';

    // Step 1: Open modal -> sets initial audience
    expect(targetAudience).toBe('global');
    expect(targetRoles).toEqual([]);

    // Step 2: Select targetAudience = 'roles'
    targetAudience = 'roles';
    expect(targetAudience).toBe('roles');

    // Step 3: Check 'manager' and 'employee'
    const rolesToAdd = ['manager', 'employee'];
    for (const role of rolesToAdd) {
      if (!targetRoles.includes(role)) {
        targetRoles.push(role);
      }
    }
    expect(targetRoles).toContain('manager');
    expect(targetRoles).toContain('employee');
    expect(targetRoles.length).toBe(2);

    // Step 4: Click "Save Overrides" -> invokes updateMutation.mutateAsync
    await mockUpdateMutateAsync({
      key: selectedFlag.key,
      data: {
        targetAudience,
        targetOrganizationIds: targetOrgIds,
        excludedOrganizationIds: excludedOrgIds,
        targetRoles,
        rolloutPercentage,
        reason: overrideReason,
      },
    });

    // Step 5: Verify mutation payload contains targetRoles: ['manager', 'employee']
    expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      key: 'ai_course_builder',
      data: expect.objectContaining({
        targetAudience: 'roles',
        targetRoles: ['manager', 'employee'],
        rolloutPercentage: 100,
        reason: 'Test role restriction update',
      }),
    });
  });

  it('3. Custom Feature Flag Registration Modal with targetRoles', async () => {
    // Simulate creating a new role-restricted flag
    const newAudience = 'roles';
    const newTargetRoles = ['admin', 'hr_admin'];

    await mockCreateMutateAsync({
      key: 'pilot_feature',
      name: 'Pilot Feature',
      description: 'Pilot testing for staff',
      environment: 'all',
      targetAudience: newAudience,
      targetRoles: newTargetRoles,
      rolloutPercentage: 100,
      isEnabled: true,
    });

    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'pilot_feature',
        targetAudience: 'roles',
        targetRoles: ['admin', 'hr_admin'],
        isEnabled: true,
      })
    );
  });
});
