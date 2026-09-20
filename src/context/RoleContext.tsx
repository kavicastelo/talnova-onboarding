import React, { useCallback, useState, useEffect, createContext, useContext } from 'react';
import { Capability, hasCapability } from '../utils/rbac';
import { apiClient } from '../api/client';

export type Role = 'admin' | 'owner' | 'employee' | 'super_admin' | 'manager' | 'hr_admin' | 'it_admin';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  toggleRole: () => void;
  can: (capability: Capability) => boolean;
  features: Record<string, boolean>;
  hasFeature: (flagKey: string) => boolean;
  refreshFeatures: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

interface RoleProviderProps {
  children: React.ReactNode;
  initialRole?: Role;
  initialFeatures?: Record<string, boolean>;
}

export function RoleProvider({ children, initialRole, initialFeatures }: RoleProviderProps) {
  const [role, setRoleState] = useState<Role>(() => {
    if (initialRole) return initialRole;
    const saved = localStorage.getItem('user_role');
    if (saved === 'super_admin' || saved === 'admin' || saved === 'employee' || saved === 'manager' || saved === 'hr_admin' || saved === 'owner' || saved === 'it_admin') {
      return saved as Role;
    }
    return 'admin';
  });

  const [features, setFeatures] = useState<Record<string, boolean>>(initialFeatures || {});

  const refreshFeatures = useCallback(async () => {
    try {
      if (initialFeatures && Object.keys(initialFeatures).length > 0) return;
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const res = await apiClient.get<any>('/auth/me').catch(() => apiClient.get<any>('/employees/me'));
      if (res.data?.data?.features) {
        setFeatures(res.data.data.features);
      }
    } catch {
      // Non-fatal if unauthenticated
    }
  }, [initialFeatures]);

  useEffect(() => {
    refreshFeatures();
  }, [refreshFeatures, role]);

  const setRole = useCallback((newRole: Role) => {
    localStorage.setItem('user_role', newRole);
    setRoleState(newRole);
  }, []);

  const toggleRole = useCallback(
    () => setRoleState((r) => {
      const next = r === 'admin' ? 'manager' : r === 'manager' ? 'employee' : r === 'employee' ? 'super_admin' : 'admin';
      localStorage.setItem('user_role', next);
      return next;
    }),
    []
  );

  const can = useCallback((capability: Capability) => hasCapability(role, capability), [role]);

  const hasFeature = useCallback(
    (flagKey: string) => {
      if (role === 'super_admin') {
        return true;
      }
      if (features[flagKey] !== undefined) {
        return Boolean(features[flagKey]);
      }
      // If feature is not explicitly mapped or loading, default to enabled
      return true;
    },
    [features, role]
  );

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        toggleRole,
        can,
        features,
        hasFeature,
        refreshFeatures,
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