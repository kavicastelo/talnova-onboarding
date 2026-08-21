import React, { useCallback, useState, createContext, useContext } from 'react';
import { Capability, hasCapability } from '../utils/rbac';

export type Role = 'admin' | 'owner' | 'employee' | 'super_admin' | 'manager' | 'hr_admin';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  toggleRole: () => void;
  can: (capability: Capability) => boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode; }) {
  const [role, setRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem('user_role');
    if (saved === 'super_admin' || saved === 'admin' || saved === 'employee' || saved === 'manager' || saved === 'hr_admin' || saved === 'owner') {
      return saved as Role;
    }
    return 'admin';
  });

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

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        toggleRole,
        can,
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