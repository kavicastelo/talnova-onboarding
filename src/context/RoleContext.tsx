import { useCallback, useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { Capability, hasCapability } from '../utils/rbac';
import { apiClient } from '../api/client';
import { getFeatureMetadata } from '../config/platformFeatures';

export type Role = 'admin' | 'owner' | 'employee' | 'super_admin' | 'manager' | 'hr_admin' | 'it_admin';

interface RoleContextValue {
  role: Role;
  roles: Role[];
  setRole: (role: Role) => void;
  setRoles: (roles: Role[]) => void;
  toggleRole: () => void;
  can: (capability: Capability) => boolean;
  features: Record<string, boolean>;
  hasFeature: (flagKey: string) => boolean;
  refreshFeatures: () => Promise<void>;
  simulateFlagsMode: boolean;
  setSimulateFlagsMode: (enabled: boolean) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
  initialRole?: Role;
  initialRoles?: Role[];
  initialFeatures?: Record<string, boolean>;
}

export function RoleProvider({ children, initialRole, initialRoles, initialFeatures }: RoleProviderProps) {
  const [role, setRoleState] = useState<Role>(() => {
    if (initialRole) return initialRole;
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('user_role') : null;
    if (saved === 'super_admin' || saved === 'admin' || saved === 'employee' || saved === 'manager' || saved === 'hr_admin' || saved === 'owner' || saved === 'it_admin') {
      return saved as Role;
    }
    return 'employee'; // Safe default: never default an unverified session to admin
  });

  const [roles, setRolesState] = useState<Role[]>(() => {
    if (initialRoles && initialRoles.length > 0) return initialRoles;
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('user_roles') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Role[];
      }
    } catch {
      // ignore
    }
    return [role || 'employee'];
  });

  const [features, setFeatures] = useState<Record<string, boolean>>(initialFeatures || {});
  const [simulateFlagsMode, setSimulateFlagsModeState] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('simulate_flags_mode') === 'true';
    }
    return false;
  });

  const setSimulateFlagsMode = useCallback((enabled: boolean) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('simulate_flags_mode', String(enabled));
    }
    setSimulateFlagsModeState(enabled);
  }, []);

  const refreshFeatures = useCallback(async () => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) return;

      const res = await apiClient.get<any>('/auth/me').catch(() => apiClient.get<any>('/employees/me'));
      const resData = res.data?.data;
      if (!resData) return;

      if (resData.features) {
        setFeatures(resData.features);
      }

      const userData = resData.user || resData;
      const backendRole: Role = (userData.role || userData.permissions?.role || 'employee') as Role;
      
      let backendRoles: Role[] = [];
      if (Array.isArray(userData.roles) && userData.roles.length > 0) {
        backendRoles = userData.roles;
      } else if (Array.isArray(resData.roles) && resData.roles.length > 0) {
        backendRoles = resData.roles;
      } else if (Array.isArray(userData.permissions?.roles) && userData.permissions.roles.length > 0) {
        backendRoles = userData.permissions.roles;
      } else {
        backendRoles = [backendRole];
      }

      backendRoles = backendRoles.filter((r) =>
        ['super_admin', 'admin', 'owner', 'hr_admin', 'it_admin', 'manager', 'employee'].includes(r)
      ) as Role[];
      if (backendRoles.length === 0) {
        backendRoles = [backendRole];
      }

      // Determine permitted roles for switching
      const isSuperAdmin = backendRole === 'super_admin' || backendRoles.includes('super_admin');
      const isAdminOrOwner = backendRole === 'admin' || backendRole === 'owner' || backendRoles.includes('admin') || backendRoles.includes('owner');

      const allowedRoles: Role[] = isSuperAdmin
        ? ['super_admin', 'admin', 'hr_admin', 'it_admin', 'manager', 'employee']
        : isAdminOrOwner
          ? ['admin', 'hr_admin', 'it_admin', 'manager', 'employee']
          : Array.from(new Set([backendRole, ...backendRoles]));

      // Clamp active role if invalid
      setRoleState((current) => {
        const nextRole = allowedRoles.includes(current) ? current : backendRole;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('user_role', nextRole);
        }
        return nextRole;
      });

      setRolesState(backendRoles);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('user_roles', JSON.stringify(backendRoles));
      }
    } catch {
      // Non-fatal if unauthenticated
    }
  }, []);

  useEffect(() => {
    refreshFeatures();
  }, [refreshFeatures, role]);

  const setRole = useCallback((newRole: Role) => {
    const isSuperAdmin = roles.includes('super_admin');
    const isAdminOrOwner = roles.includes('admin') || roles.includes('owner');
    const allowed = isSuperAdmin
      ? ['super_admin', 'admin', 'hr_admin', 'it_admin', 'manager', 'employee']
      : isAdminOrOwner
        ? ['admin', 'hr_admin', 'it_admin', 'manager', 'employee']
        : roles;

    if (!allowed.includes(newRole)) {
      console.warn(`[RoleContext] Blocked unauthorized role switch to: ${newRole}`);
      return;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user_role', newRole);
    }
    setRoleState(newRole);
  }, [roles]);

  const setRoles = useCallback((newRoles: Role[]) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user_roles', JSON.stringify(newRoles));
    }
    setRolesState(newRoles);
  }, []);

  const toggleRole = useCallback(() => {
    const isSuperAdmin = roles.includes('super_admin');
    const isAdminOrOwner = roles.includes('admin') || roles.includes('owner');
    const available = isSuperAdmin
      ? (['super_admin', 'admin', 'hr_admin', 'it_admin', 'manager', 'employee'] as Role[])
      : isAdminOrOwner
        ? (['admin', 'hr_admin', 'it_admin', 'manager', 'employee'] as Role[])
        : roles;

    if (available.length <= 1) return;

    setRoleState((curr) => {
      const idx = available.indexOf(curr);
      const next = available[(idx + 1) % available.length] || available[0];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('user_role', next);
      }
      return next;
    });
  }, [roles]);

  const can = useCallback((capability: Capability) => {
    const isSuperAdmin = roles.includes('super_admin');
    const isAdminOrOwner = roles.includes('admin') || roles.includes('owner');

    let effectiveRole = role;
    if (!isSuperAdmin && !isAdminOrOwner && !roles.includes(role)) {
      effectiveRole = roles[0] || 'employee';
    }

    const activeRoles = Array.from(new Set([effectiveRole, ...roles]));
    return hasCapability(activeRoles, capability);
  }, [role, roles]);

  const hasFeature = useCallback(
    (flagKey: string) => {
      const normalizedKey = (flagKey || '').toLowerCase().trim();

      // Only bypass if active role is super_admin AND not in strict simulation mode
      if (role === 'super_admin' && !simulateFlagsMode) {
        return true;
      }

      if (features[normalizedKey] !== undefined) {
        return Boolean(features[normalizedKey]);
      }
      if (features[flagKey] !== undefined) {
        return Boolean(features[flagKey]);
      }

      // Default from canonical 105 platform catalog
      const meta = getFeatureMetadata(normalizedKey);
      return meta.defaultEnabled;
    },
    [features, role, simulateFlagsMode]
  );

  return (
    <RoleContext.Provider
      value={{
        role,
        roles,
        setRole,
        setRoles,
        toggleRole,
        can,
        features,
        hasFeature,
        refreshFeatures,
        simulateFlagsMode,
        setSimulateFlagsMode,
      }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within a RoleProvider');
  return ctx;
}