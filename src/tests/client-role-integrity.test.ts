import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RoleProvider, useRole } from '../context/RoleContext';
import { secureStorage } from '../utils/secureStorage';
import { apiClient } from '../api/client';
import { authService } from '../services/auth.service';

function RoleTestConsumer() {
  const { role, roles, can, setRole } = useRole();
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'role' }, role),
    React.createElement('span', { 'data-testid': 'roles' }, JSON.stringify(roles)),
    React.createElement('span', { 'data-testid': 'can-super-admin' }, can('view_super_admin') ? 'PERMITTED' : 'DENIED'),
    React.createElement('span', { 'data-testid': 'can-manage-org' }, can('manage_organization') ? 'PERMITTED' : 'DENIED'),
    React.createElement(
      'button',
      {
        'data-testid': 'switch-super-admin',
        onClick: () => setRole('super_admin'),
      },
      'Switch'
    )
  );
}

describe('SEC-ROLE-INTEGRITY: Client Role State Integrity & Anti-Tamper Storage Defense', () => {
  let storageMap: Record<string, string> = {};

  beforeEach(() => {
    storageMap = {};

    const mockStorage = {
      getItem: vi.fn((key: string) => storageMap[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        storageMap[key] = String(val);
      }),
      removeItem: vi.fn((key: string) => {
        delete storageMap[key];
      }),
      clear: vi.fn(() => {
        storageMap = {};
      }),
      key: vi.fn((i: number) => Object.keys(storageMap)[i] || null),
      get length() {
        return Object.keys(storageMap).length;
      },
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    (globalThis as any).window.location = {
      pathname: '/dashboard',
      origin: 'https://talnova.io',
      host: 'talnova.io',
      hostname: 'talnova.io',
    };
  });

  afterEach(() => {
    storageMap = {};
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ELIMINATION OF PLAINTEXT localStorage ROLE AUTHORITY
  // =========================================================================
  describe('Plaintext localStorage Injection Resistance', () => {
    it('ignoring localStorage.setItem("user_role", "super_admin") tampering without privilege escalation', () => {
      // Attacker attempts local storage privilege injection in browser console
      localStorage.setItem('user_role', 'super_admin');
      localStorage.setItem('user_roles', JSON.stringify(['super_admin']));

      const html = renderToString(
        React.createElement(RoleProvider, null, React.createElement(RoleTestConsumer, null))
      );

      // Must NOT elevate to super_admin; must resolve to neutral guest role
      expect(html).toContain('data-testid="role">guest</span>');
      expect(html).toContain('data-testid="roles">[&quot;guest&quot;]</span>');
      expect(html).toContain('data-testid="can-super-admin">DENIED</span>');
      expect(html).toContain('data-testid="can-manage-org">DENIED</span>');

      // Verify rogue plaintext keys are not honored
      expect(html).not.toContain('super_admin');
    });

    it('verifies that executing localStorage.setItem("user_role", "super_admin") does NOT reveal protected navigation', () => {
      localStorage.setItem('user_role', 'super_admin');
      localStorage.setItem('user_roles', JSON.stringify(['super_admin']));

      let inspectedRole = '';
      let canViewSuperAdmin = true;

      const NavInspector = () => {
        const { role, can } = useRole();
        inspectedRole = role;
        canViewSuperAdmin = can('view_super_admin');
        return null;
      };

      renderToString(
        React.createElement(RoleProvider, null, React.createElement(NavInspector, null))
      );

      expect(inspectedRole).toBe('guest');
      expect(canViewSuperAdmin).toBe(false);
    });

    it('rejects forged plain localStorage keys and purges them on access', () => {
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('user_roles', JSON.stringify(['admin']));

      // Attempting to read role cache through secureStorage
      const result = secureStorage.getRoleCache();
      expect(result).toBeNull();

      // Rogue plaintext keys must have been scrubbed
      expect(storageMap['user_role']).toBeUndefined();
      expect(storageMap['user_roles']).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. SECURE ENCRYPTED ROLE CACHING (WITH TTL & TIMESTAMPS)
  // =========================================================================
  describe('Encrypted SecureStorage Role Cache', () => {
    it('honors valid encrypted role envelope created by verified backend login', () => {
      secureStorage.setRoleCache('admin', ['admin', 'employee']);

      const html = renderToString(
        React.createElement(RoleProvider, null, React.createElement(RoleTestConsumer, null))
      );

      expect(html).toContain('data-testid="role">admin</span>');
      expect(html).toContain('data-testid="can-manage-org">PERMITTED</span>');
      expect(html).toContain('data-testid="can-super-admin">DENIED</span>');
    });

    it('discards role envelope if TTL has expired', () => {
      // Store envelope with negative TTL (already expired)
      secureStorage.setRoleCache('admin', ['admin'], -1000);

      const cached = secureStorage.getRoleCache();
      expect(cached).toBeNull();

      const html = renderToString(
        React.createElement(RoleProvider, null, React.createElement(RoleTestConsumer, null))
      );

      // Falls back to guest
      expect(html).toContain('data-testid="role">guest</span>');
    });
  });

  // =========================================================================
  // 3. SERVER-CONFIRMED PROFILE ROLE UPDATES
  // =========================================================================
  describe('Verified Server Confirmation', () => {
    it('updates role context and secure cache when authService.login succeeds', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          data: {
            accessToken: 'mock_verified_jwt_token',
            user: {
              _id: 'emp_123',
              role: 'manager',
              roles: ['manager', 'employee'],
            },
          },
        },
      } as any);

      await authService.login('test@talnova.io', 'Password123!');

      // Verify that secureStorage holds the encrypted credentials
      const cached = secureStorage.getRoleCache();
      expect(cached).not.toBeNull();
      expect(cached?.role).toBe('manager');
      expect(cached?.roles).toEqual(['manager', 'employee']);

      // Verify that raw plaintext user_role was NOT written
      expect(storageMap['user_role']).toBeUndefined();
    });

    it('completely invalidates and wipes all role caches on logout', async () => {
      secureStorage.setRoleCache('admin', ['admin']);
      expect(secureStorage.getRoleCache()).not.toBeNull();

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: {} } as any);

      await authService.logout();

      expect(secureStorage.getRoleCache()).toBeNull();
      expect(storageMap['__tn_sec_roles__']).toBeUndefined();
      expect(storageMap['user_role']).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. VERIFY ROLE MUTATORS
  // =========================================================================
  describe('Role Mutator Restrictions', () => {
    it('prohibits arbitrary client-side role escalation to unassigned roles', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Initialize as verified employee
      let switchAttemptResult: any;
      const TestSwitcher = () => {
        const { setRole } = useRole();
        switchAttemptResult = setRole;
        return null;
      };

      renderToString(
        React.createElement(
          RoleProvider,
          { initialRole: 'employee', initialRoles: ['employee'] },
          React.createElement(TestSwitcher, null)
        )
      );

      // Attempt unauthorized switch to super_admin
      switchAttemptResult('super_admin');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blocked unauthorized role switch to: super_admin')
      );

      // Ensure rogue role was not persisted in secureStorage
      expect(secureStorage.getRoleCache()).toBeNull();
    });
  });
});
