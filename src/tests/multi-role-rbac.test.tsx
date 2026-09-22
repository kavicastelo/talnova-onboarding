import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider, useRole } from '../context/RoleContext';
import { ProtectedRoute } from '../components/ProtectedRoute';

function CapabilityTester() {
  const { can, role, roles } = useRole();
  return (
    <div>
      <span data-testid="current-role">{role}</span>
      <span data-testid="current-roles">{JSON.stringify(roles)}</span>
      <span data-testid="can-manage-org">{can('manage_organization') ? 'CAN_MANAGE_ORG' : 'CANNOT_MANAGE_ORG'}</span>
      <span data-testid="can-view-hr">{can('view_hr_ops') ? 'CAN_VIEW_HR' : 'CANNOT_VIEW_HR'}</span>
      <span data-testid="can-view-team">{can('view_team_ops') ? 'CAN_VIEW_TEAM' : 'CANNOT_VIEW_TEAM'}</span>
      <span data-testid="can-manage-it">{can('manage_it_ops') ? 'CAN_MANAGE_IT' : 'CANNOT_MANAGE_IT'}</span>
      <span data-testid="can-view-analytics">{can('view_analytics') ? 'CAN_VIEW_ANALYTICS' : 'CANNOT_VIEW_ANALYTICS'}</span>
      <span data-testid="can-view-directory">{can('view_directory') ? 'CAN_VIEW_DIRECTORY' : 'CANNOT_VIEW_DIRECTORY'}</span>
    </div>
  );
}

describe('Multi-Role RBAC and Dashboard Isolation Tests', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it('Requirement 1: Standard employee has zero administrative capabilities', () => {
    const html = renderToString(
      <RoleProvider initialRole="employee" initialRoles={['employee']}>
        <CapabilityTester />
      </RoleProvider>
    );

    expect(html).toContain('CANNOT_MANAGE_ORG');
    expect(html).toContain('CANNOT_VIEW_HR');
    expect(html).toContain('CANNOT_VIEW_TEAM');
    expect(html).toContain('CANNOT_MANAGE_IT');
    expect(html).toContain('CANNOT_VIEW_ANALYTICS');
    expect(html).toContain('CANNOT_VIEW_DIRECTORY');
    expect(html).not.toContain('CAN_MANAGE_ORG');
  });

  it('Requirement 2: Clamps unauthorized role state to assigned roles if not an admin/owner', () => {
    // Attempting to set active role = 'admin' when initialRoles only contains 'employee'
    const html = renderToString(
      <RoleProvider initialRole="admin" initialRoles={['employee']}>
        <CapabilityTester />
      </RoleProvider>
    );

    // Because 'admin' is not in ['employee'], RoleContext clamps capability evaluation to 'employee'
    expect(html).toContain('CANNOT_MANAGE_ORG');
    expect(html).toContain('CANNOT_VIEW_HR');
    expect(html).toContain('CANNOT_VIEW_TEAM');
  });

  it('Requirement 3: Multi-role employee with manager role has team ops and analytics, but not org settings or hr ops', () => {
    const html = renderToString(
      <RoleProvider initialRole="employee" initialRoles={['employee', 'manager']}>
        <CapabilityTester />
      </RoleProvider>
    );

    expect(html).toContain('CAN_VIEW_TEAM');
    expect(html).toContain('CAN_VIEW_ANALYTICS');
    expect(html).toContain('CAN_VIEW_DIRECTORY');

    // Blocked from admin & hr capabilities
    expect(html).toContain('CANNOT_MANAGE_ORG');
    expect(html).toContain('CANNOT_VIEW_HR');
    expect(html).toContain('CANNOT_MANAGE_IT');
  });

  it('Requirement 4: Multi-role employee with it_admin has manage_it_ops and view_directory', () => {
    const html = renderToString(
      <RoleProvider initialRole="employee" initialRoles={['employee', 'it_admin']}>
        <CapabilityTester />
      </RoleProvider>
    );

    expect(html).toContain('CAN_MANAGE_IT');
    expect(html).toContain('CAN_VIEW_DIRECTORY');

    // Blocked from other administrative areas
    expect(html).toContain('CANNOT_MANAGE_ORG');
    expect(html).toContain('CANNOT_VIEW_HR');
    expect(html).toContain('CANNOT_VIEW_TEAM');
  });

  it('Requirement 5: ProtectedRoute blocks employee from administrative areas with Access Restricted', () => {
    const html = renderToString(
      <MemoryRouter>
        <RoleProvider initialRole="employee" initialRoles={['employee']}>
          <ProtectedRoute capability="manage_organization">
            <div>Sensitive Admin Settings</div>
          </ProtectedRoute>
        </RoleProvider>
      </MemoryRouter>
    );

    expect(html).not.toContain('Sensitive Admin Settings');
    expect(html).toContain('Access Restricted');
    expect(html).toContain('manage_organization');
  });

  it('Requirement 6: ProtectedRoute blocks employee from directory, hr-ops, and manager dashboards', () => {
    const dirHtml = renderToString(
      <MemoryRouter>
        <RoleProvider initialRole="employee" initialRoles={['employee']}>
          <ProtectedRoute capability="view_directory">
            <div>Employee Directory Content</div>
          </ProtectedRoute>
        </RoleProvider>
      </MemoryRouter>
    );

    expect(dirHtml).not.toContain('Employee Directory Content');
    expect(dirHtml).toContain('Access Restricted');

    const hrHtml = renderToString(
      <MemoryRouter>
        <RoleProvider initialRole="employee" initialRoles={['employee']}>
          <ProtectedRoute capability="view_hr_ops">
            <div>HR Operations Content</div>
          </ProtectedRoute>
        </RoleProvider>
      </MemoryRouter>
    );

    expect(hrHtml).not.toContain('HR Operations Content');
    expect(hrHtml).toContain('Access Restricted');
  });

  it('Requirement 7: ProtectedRoute permits multi-role manager to access team operations while blocking org settings', () => {
    const html = renderToString(
      <MemoryRouter>
        <RoleProvider initialRole="employee" initialRoles={['employee', 'manager']}>
          <ProtectedRoute capability="view_team_ops">
            <div>Team Operations Accessible</div>
          </ProtectedRoute>
          <ProtectedRoute capability="manage_organization">
            <div>Settings Accessible</div>
          </ProtectedRoute>
        </RoleProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Team Operations Accessible');
    expect(html).not.toContain('Settings Accessible');
    expect(html).toContain('Access Restricted');
  });
});
