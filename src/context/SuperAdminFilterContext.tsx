import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type DateRangePreset = '1h' | '24h' | '7d' | '30d' | '90d' | '1y' | 'custom';
export type Environment = 'production' | 'staging' | 'development';
export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

interface SuperAdminFilterContextValue {
  dateRange: DateRangePreset;
  setDateRange: (range: DateRangePreset) => void;
  startDate?: string;
  setStartDate: (date?: string) => void;
  endDate?: string;
  setEndDate: (date?: string) => void;
  selectedOrgId: string; // 'all' or organization ObjectId
  setSelectedOrgId: (orgId: string) => void;
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  severity: SeverityFilter;
  setSeverity: (sev: SeverityFilter) => void;
  refreshKey: number;
  triggerRefresh: () => void;
  lastUpdated: Date;
}

const SuperAdminFilterContext = createContext<SuperAdminFilterContextValue | undefined>(undefined);

export function SuperAdminFilterProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize from URL params or defaults
  const [dateRange, setDateRangeState] = useState<DateRangePreset>(() => {
    return (searchParams.get('range') as DateRangePreset) || '30d';
  });

  const [selectedOrgId, setSelectedOrgIdState] = useState<string>(() => {
    return searchParams.get('orgId') || 'all';
  });

  const [environment, setEnvironmentState] = useState<Environment>(() => {
    return (searchParams.get('env') as Environment) || 'production';
  });

  const [severity, setSeverityState] = useState<SeverityFilter>(() => {
    return (searchParams.get('severity') as SeverityFilter) || 'all';
  });

  const [startDate, setStartDateState] = useState<string | undefined>(() => {
    return searchParams.get('startDate') || undefined;
  });

  const [endDate, setEndDateState] = useState<string | undefined>(() => {
    return searchParams.get('endDate') || undefined;
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Sync to URL parameters cleanly
  const updateUrlParam = useCallback((key: string, val?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val && val !== 'all' && val !== 'production' && val !== '30d') {
        next.set(key, val);
      } else {
        next.delete(key);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setDateRange = useCallback((range: DateRangePreset) => {
    setDateRangeState(range);
    updateUrlParam('range', range);
  }, [updateUrlParam]);

  const setSelectedOrgId = useCallback((orgId: string) => {
    setSelectedOrgIdState(orgId);
    updateUrlParam('orgId', orgId);
  }, [updateUrlParam]);

  const setEnvironment = useCallback((env: Environment) => {
    setEnvironmentState(env);
    updateUrlParam('env', env);
  }, [updateUrlParam]);

  const setSeverity = useCallback((sev: SeverityFilter) => {
    setSeverityState(sev);
    updateUrlParam('severity', sev);
  }, [updateUrlParam]);

  const setStartDate = useCallback((d?: string) => {
    setStartDateState(d);
    updateUrlParam('startDate', d);
  }, [updateUrlParam]);

  const setEndDate = useCallback((d?: string) => {
    setEndDateState(d);
    updateUrlParam('endDate', d);
  }, [updateUrlParam]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLastUpdated(new Date());
  }, []);

  return (
    <SuperAdminFilterContext.Provider
      value={{
        dateRange,
        setDateRange,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        selectedOrgId,
        setSelectedOrgId,
        environment,
        setEnvironment,
        severity,
        setSeverity,
        refreshKey,
        triggerRefresh,
        lastUpdated,
      }}
    >
      {children}
    </SuperAdminFilterContext.Provider>
  );
}

const noop = () => undefined;

const defaultFilterContext: SuperAdminFilterContextValue = {
  dateRange: '30d',
  setDateRange: noop,
  selectedOrgId: 'all',
  setSelectedOrgId: noop,
  environment: 'production',
  setEnvironment: noop,
  severity: 'all',
  setSeverity: noop,
  refreshKey: 0,
  triggerRefresh: noop,
  lastUpdated: new Date(),
  setStartDate: noop,
  setEndDate: noop,
};


export function useSuperAdminFilter() {
  const ctx = useContext(SuperAdminFilterContext);
  return ctx || defaultFilterContext;
}

