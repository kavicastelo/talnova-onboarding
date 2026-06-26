import React, { useCallback, useState, createContext, useContext } from 'react';
export type Role = 'admin' | 'employee';
interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  toggleRole: () => void;
}
const RoleContext = createContext<RoleContextValue | undefined>(undefined);
export function RoleProvider({ children }: {children: React.ReactNode;}) {
  const [role, setRole] = useState<Role>('admin');
  const toggleRole = useCallback(
    () => setRole((r) => r === 'admin' ? 'employee' : 'admin'),
    []
  );
  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        toggleRole
      }}>
      
      {children}
    </RoleContext.Provider>);

}
export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within a RoleProvider');
  return ctx;
}