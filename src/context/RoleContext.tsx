import { useCallback, useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { Capability, hasCapability } from '../utils/rbac';
import { apiClient, getAccessToken } from '../api/client';
import { getFeatureMetadata } from '../config/platformFeatures';
import { secureStorage } from '../utils/secureStorage';

export type Role = 'admin' | 'owner' | 'employee' | 'super_admin' | 'manager' | 'hr_admin' | 'it_admin' | 'guest';

const VALID_ROLES = new Set<Role>([
  'super_admin',
  'admin',
  'owner',
  'hr_admin',
  'it_admin',
  'manager',
  'employee',
  'guest',
]);

function isValidRole(r: any): r is Role {
  return typeof r === 'string' && VALID_ROLES.has(r as Role);
}

interface RoleContextValue {
  role: Role;
  roles: Role[];
  setRole: (role: Role) => void;
  setRoles: (roles: Role[]) => void;
  syncAuthRoles: (primaryRole: Role, assignedRoles: Role[]) => void;
  toggleRole: () => void;
  can: (capability: Capability) => boolean;
  features: Record<string, boolean>;
  hasFeature: (flagKey: string) => boolean;
  refreshFeatures: () => Promise<void>;
  simulateFlagsMode: boolean;
  setSimulateFlagsMode: (enabled: boolean) => void;
  isFeaturesLoaded: boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
  initialRole?: Role;
  initialRoles?: Role[];
  initialFeatures?: Record<string, boolean>;
}

export function RoleProvider({ children, initialRole, initialRoles, initialFeatures }: RoleProviderProps) {
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo');

  const [role, setRoleState] = useState<Role>(() => {
    if (initialRole) return initialRole;
    if (isDemo && typeof localStorage !== 'undefined') {
      const demoRole = localStorage.getItem('talnova_demo_role');
      if (isValidRole(demoRole)) return demoRole;
    }
    // Strict security: Never trust unverified plaintext localStorage.getItem('user_role').
    // Only trust encrypted and timestamped envelope from secureStorage.
    const cached = secureStorage.getRoleCache();
    if (cached?.role && isValidRole(cached.role) && cached.role !== 'guest') {
      return cached.role;
    }
    // Self-healing: If cached.role was guest but cached.roles contains real roles, pick the first real role
    if (cached?.roles && Array.isArray(cached.roles)) {
      const firstRealRole = cached.roles.find((r) => isValidRole(r) && r !== 'guest');
      if (firstRealRole) return firstRealRole;
    }
    return 'guest'; // Safe neutral default: unverified sessions have zero privileges
  });

  const [roles, setRolesState] = useState<Role[]>(() => {
    if (initialRoles && initialRoles.length > 0) return initialRoles;
    if (isDemo && typeof localStorage !== 'undefined') {
      try {
        const demoRoles = localStorage.getItem('talnova_demo_roles');
        if (demoRoles) {
          const parsed = JSON.parse(demoRoles);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter(isValidRole);
          }
        }
      } catch {
        // ignore
      }
    }
    const cached = secureStorage.getRoleCache();
    if (cached?.roles && Array.isArray(cached.roles) && cached.roles.length > 0) {
      const filtered = cached.roles.filter(isValidRole);
      if (filtered.length > 0) return filtered;
    }
    return [role || 'guest'];
  });

  const [features, setFeatures] = useState<Record<string, boolean>>(() => {
    if (initialFeatures && Object.keys(initialFeatures).length > 0) return initialFeatures;
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('user_features') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [isFeaturesLoaded, setIsFeaturesLoaded] = useState<boolean>(() => {
    if (initialFeatures && Object.keys(initialFeatures).length > 0) return true;
    const hasSession = Boolean(getAccessToken() || secureStorage.hasActiveSession());
    if (!hasSession) return true;
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('user_features') : null;
    return Boolean(saved);
  });
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
      if (isDemo) {
        // In demo mode, features are governed by demo tenant package, avoid calling production /auth/me
        setIsFeaturesLoaded(true);
        return;
      }

      const hasSession = Boolean(getAccessToken() || secureStorage.hasActiveSession());
      if (!hasSession) return;

      const res = await apiClient.get<any>('/auth/me').catch(() => apiClient.get<any>('/employees/me'));
      const resData = res.data?.data;
      if (!resData) return;

      if (resData.features) {
        setFeatures(resData.features);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('user_features', JSON.stringify(resData.features));
        }
      }
      setIsFeaturesLoaded(true);

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

      // Clamp active role if invalid, or promote from guest to verified backend role
      setRoleState((current) => {
        const isCurrentValid = current !== 'guest' && allowedRoles.includes(current);
        const nextRole = isCurrentValid ? current : backendRole;
        if (isDemo && typeof localStorage !== 'undefined') {
          localStorage.setItem('talnova_demo_role', nextRole);
        } else {
          secureStorage.setRoleCache(nextRole, backendRoles);
        }
        return nextRole;
      });

      setRolesState(backendRoles);
      if (isDemo && typeof localStorage !== 'undefined') {
        localStorage.setItem('talnova_demo_roles', JSON.stringify(backendRoles));
      }
      setIsFeaturesLoaded(true);
    } catch {
      // Non-fatal if unauthenticated
      setIsFeaturesLoaded(true);
    }
  }, [isDemo]);

  useEffect(() => {
    refreshFeatures();
  }, [refreshFeatures, role]);

  const setRole = useCallback((newRole: Role) => {
    const cached = secureStorage.getRoleCache();
    const effectiveRoles: Role[] = roles.length > 0 && !roles.every((r) => r === 'guest')
      ? roles
      : (cached?.roles && cached.roles.length > 0 && !cached.roles.every((r) => r === 'guest')
          ? (cached.roles.filter(isValidRole) as Role[])
          : [newRole]);

    const isSuperAdmin = effectiveRoles.includes('super_admin');
    const isAdminOrOwner = effectiveRoles.includes('admin') || effectiveRoles.includes('owner');
    const allowed = isDemo || isSuperAdmin
      ? ['super_admin', 'admin', 'hr_admin', 'it_admin', 'manager', 'employee']
      : isAdminOrOwner
        ? ['admin', 'hr_admin', 'it_admin', 'manager', 'employee']
        : effectiveRoles;

    if (!allowed.includes(newRole)) {
      console.warn(`[RoleContext] Blocked unauthorized role switch to: ${newRole}`);
      return;
    }

    if (isDemo && typeof localStorage !== 'undefined') {
      localStorage.setItem('talnova_demo_role', newRole);
    } else {
      secureStorage.setRoleCache(newRole, effectiveRoles);
    }
    setRoleState(newRole);
    if (roles.every((r) => r === 'guest')) {
      setRolesState(effectiveRoles);
    }
  }, [isDemo, roles]);

  const setRoles = useCallback((newRoles: Role[]) => {
    if (!newRoles || newRoles.length === 0) return;
    const valid = newRoles.filter(isValidRole);
    if (valid.length === 0) return;

    setRolesState(valid);
    setRoleState((currentRole) => {
      const isSuperAdmin = valid.includes('super_admin');
      const isAdminOrOwner = valid.includes('admin') || valid.includes('owner');
      const allowed = isDemo || isSuperAdmin
        ? ['super_admin', 'admin', 'hr_admin', 'it_admin', 'manager', 'employee']
        : isAdminOrOwner
          ? ['admin', 'hr_admin', 'it_admin', 'manager', 'employee']
          : valid;

      const nextRole = (currentRole !== 'guest' && allowed.includes(currentRole))
        ? currentRole
        : (valid[0] || 'employee');

      if (isDemo && typeof localStorage !== 'undefined') {
        localStorage.setItem('talnova_demo_role', nextRole);
        localStorage.setItem('talnova_demo_roles', JSON.stringify(valid));
      } else {
        secureStorage.setRoleCache(nextRole, valid);
      }
      return nextRole;
    });
  }, [isDemo]);

  const syncAuthRoles = useCallback((primaryRole: Role, assignedRoles: Role[]) => {
    const validRoles = Array.isArray(assignedRoles) && assignedRoles.length > 0
      ? assignedRoles.filter(isValidRole)
      : [primaryRole];
    const validPrimary = isValidRole(primaryRole) ? primaryRole : (validRoles[0] || 'employee');

    if (isDemo && typeof localStorage !== 'undefined') {
      localStorage.setItem('talnova_demo_role', validPrimary);
      localStorage.setItem('talnova_demo_roles', JSON.stringify(validRoles));
    } else {
      secureStorage.setRoleCache(validPrimary, validRoles);
    }
    setRoleState(validPrimary);
    setRolesState(validRoles);
  }, [isDemo]);

  const toggleRole = useCallback(() => {
    const isSuperAdmin = roles.includes('super_admin');
    const isAdminOrOwner = roles.includes('admin') || roles.includes('owner');
    const available = isDemo || isSuperAdmin
      ? (['super_admin', 'admin', 'hr_admin', 'it_admin', 'manager', 'employee'] as Role[])
      : isAdminOrOwner
        ? (['admin', 'hr_admin', 'it_admin', 'manager', 'employee'] as Role[])
        : roles;

    if (available.length <= 1) return;

    setRoleState((curr) => {
      const idx = available.indexOf(curr);
      const next = available[(idx + 1) % available.length] || available[0];
      if (isDemo && typeof localStorage !== 'undefined') {
        localStorage.setItem('talnova_demo_role', next);
      } else {
        secureStorage.setRoleCache(next, roles);
      }
      return next;
    });
  }, [isDemo, roles]);

  const can = useCallback((capability: Capability) => {
    let effectiveRole: Role = role;
    if (effectiveRole === 'guest') {
      const realRole = roles.find((r) => r !== 'guest');
      if (realRole) {
        effectiveRole = realRole;
      } else {
        return false;
      }
    }
    const isSuperAdmin = roles.includes('super_admin');
    const isAdminOrOwner = roles.includes('admin') || roles.includes('owner');

    if (!isSuperAdmin && !isAdminOrOwner && !roles.includes(effectiveRole)) {
      effectiveRole = roles[0] || 'guest';
    }

    if (effectiveRole === 'guest') return false;

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

      // If features have been loaded (or cached) for this tenant session,
      // any feature NOT present in the organization's resolved package is disabled
      if (isFeaturesLoaded && Object.keys(features).length > 0) {
        return false;
      }

      // Default from canonical 105 platform catalog only when unauthenticated
      const meta = getFeatureMetadata(normalizedKey);
      return meta.defaultEnabled;
    },
    [features, isFeaturesLoaded, role, simulateFlagsMode]
  );

  return (
    <RoleContext.Provider
      value={{
        role,
        roles,
        setRole,
        setRoles,
        syncAuthRoles,
        toggleRole,
        can,
        features,
        hasFeature,
        refreshFeatures,
        simulateFlagsMode,
        setSimulateFlagsMode,
        isFeaturesLoaded,
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