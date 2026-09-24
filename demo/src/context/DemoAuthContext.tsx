import React, { createContext, useContext, useState } from 'react';

export interface DemoUserIdentity {
  id: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  jobTitle: string;
  expiresAt: string;
}

export interface DemoTenantInfo {
  id: string;
  name: string;
  slug: string;
  entitlementPackage: string;
  allowedFeatures: string[];
  expiresAt: string;
}

export interface DemoWatermarkData {
  text: string;
  companyName: string;
  userName: string;
  sessionId: string;
  date: string;
}

interface DemoAuthContextType {
  token: string | null;
  user: DemoUserIdentity | null;
  tenant: DemoTenantInfo | null;
  watermark: DemoWatermarkData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  setRestrictedModalFeature: (featureName: string | null) => void;
  restrictedModalFeature: string | null;
}

const DemoAuthContext = createContext<DemoAuthContextType | undefined>(undefined);

export const DemoAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('talnova_demo_token'));
  const [user, setUser] = useState<DemoUserIdentity | null>(() => {
    const cached = localStorage.getItem('talnova_demo_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [tenant, setTenant] = useState<DemoTenantInfo | null>(() => {
    const cached = localStorage.getItem('talnova_demo_tenant');
    return cached ? JSON.parse(cached) : null;
  });
  const [watermark, setWatermark] = useState<DemoWatermarkData | null>(() => {
    const cached = localStorage.getItem('talnova_demo_watermark');
    return cached ? JSON.parse(cached) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [restrictedModalFeature, setRestrictedModalFeature] = useState<string | null>(null);

  const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || '/api/v1';

  const login = async (email: string, password: string = 'DemoPass123!') => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/demo/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceInfo: navigator.userAgent }),
      });

      let resData: any = {};
      try {
        const text = await response.text();
        resData = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(resData.message || resData.error || `Demo login failed (${response.status})`);
      }

      const { token: receivedToken, user: u, tenant: t, watermark: wm } = resData.data;

      setToken(receivedToken);
      setUser(u);
      setTenant(t);
      setWatermark(wm);

      const roleStr = (u.role || '').toLowerCase();
      const normalizedRole = roleStr.includes('admin')
        ? 'admin'
        : roleStr.includes('manager')
        ? 'manager'
        : 'employee';

      localStorage.setItem('talnova_demo_token', receivedToken);
      localStorage.setItem('talnova_demo_user', JSON.stringify(u));
      localStorage.setItem('talnova_demo_tenant', JSON.stringify(t));
      localStorage.setItem('talnova_demo_watermark', JSON.stringify(wm));
      localStorage.setItem('user_role', normalizedRole);
      localStorage.setItem('user_roles', JSON.stringify([normalizedRole]));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/demo/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // silent fail on network disconnect
      }
    }
    setToken(null);
    setUser(null);
    setTenant(null);
    setWatermark(null);
    localStorage.removeItem('talnova_demo_token');
    localStorage.removeItem('talnova_demo_user');
    localStorage.removeItem('talnova_demo_tenant');
    localStorage.removeItem('talnova_demo_watermark');
  };

  return (
    <DemoAuthContext.Provider
      value={{
        token,
        user,
        tenant,
        watermark,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        restrictedModalFeature,
        setRestrictedModalFeature,
      }}
    >
      {children}
    </DemoAuthContext.Provider>
  );
};

export function useDemoAuth() {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error('useDemoAuth must be used within a DemoAuthProvider');
  }
  return context;
}

export default DemoAuthContext;
