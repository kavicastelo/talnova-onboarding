import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type DateRangePreset = '1h' | '24h' | '7d' | '30d' | '90d' | '1y' | 'custom';
export type Environment = 'production' | 'staging' | 'development';
export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

export function getDateRangeBounds(preset: DateRangePreset, customStart?: string, customEnd?: string): {
  startDate: string;
  endDate: string;
  days: number;
} {
  const now = new Date();
  if (preset === 'custom' && customStart && customEnd) {
    const s = new Date(customStart);
    const e = new Date(customEnd);
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)));
    return { startDate: customStart, endDate: customEnd, days };
  }
  let ms = 30 * 24 * 60 * 60 * 1000;
  let days = 30;
  switch (preset) {
    case '1h':
      ms = 60 * 60 * 1000;
      days = 1;
      break;
    case '24h':
      ms = 24 * 60 * 60 * 1000;
      days = 1;
      break;
    case '7d':
      ms = 7 * 24 * 60 * 60 * 1000;
      days = 7;
      break;
    case '30d':
      ms = 30 * 24 * 60 * 60 * 1000;
      days = 30;
      break;
    case '90d':
      ms = 90 * 24 * 60 * 60 * 1000;
      days = 90;
      break;
    case '1y':
      ms = 365 * 24 * 60 * 60 * 1000;
      days = 365;
      break;
  }
  return {
    startDate: new Date(now.getTime() - ms).toISOString(),
    endDate: now.toISOString(),
    days,
  };
}

interface SuperAdminFilterContextValue {
  dateRange: DateRangePreset;
  setDateRange: (range: DateRangePreset) => void;
  startDate?: string;
  setStartDate: (date?: string) => void;
  endDate?: string;
  setEndDate: (date?: string) => void;
  computedStartDate: string;
  computedEndDate: string;
  computedDays: number;
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

  // Dynamic computed date bounds
  const bounds = getDateRangeBounds(dateRange, startDate, endDate);

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
        computedStartDate: bounds.startDate,
        computedEndDate: bounds.endDate,
        computedDays: bounds.days,
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

const fallbackBounds = getDateRangeBounds('30d');

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
  computedStartDate: fallbackBounds.startDate,
  computedEndDate: fallbackBounds.endDate,
  computedDays: fallbackBounds.days,
};

export function useSuperAdminFilter() {
  const ctx = useContext(SuperAdminFilterContext);
  return ctx || defaultFilterContext;
}


