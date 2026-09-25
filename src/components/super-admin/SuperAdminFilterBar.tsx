import { useEffect, useState } from 'react';
import { Calendar, Building2, Server, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../Button';
import { useSuperAdminFilter, DateRangePreset, Environment, SeverityFilter } from '../../context/SuperAdminFilterContext';
import { useSuperAdminOrganizations } from '../../hooks/useSuperAdmin';

export interface SuperAdminFilterBarProps {
  className?: string;
  showDateRange?: boolean;
  showTenant?: boolean;
  showSeverity?: boolean;
  showEnvironment?: boolean;
  showRefresh?: boolean;
  tenantLabel?: string;
}

export function SuperAdminFilterBar({
  className = '',
  showDateRange = true,
  showTenant = true,
  showSeverity = false,
  showEnvironment = true,
  showRefresh = true,
  tenantLabel = 'Tenant:',
}: SuperAdminFilterBarProps) {
  const {
    dateRange,
    setDateRange,
    selectedOrgId,
    setSelectedOrgId,
    environment,
    setEnvironment,
    severity,
    setSeverity,
    triggerRefresh,
    lastUpdated,
  } = useSuperAdminFilter();

  const { data: orgsData } = useSuperAdminOrganizations({ limit: 100 });
  const organizations = orgsData?.data || [];

  const [timeAgo, setTimeAgo] = useState('just now');
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    const updateTimeAgo = () => {
      const diffSec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (diffSec < 10) setTimeAgo('just now');
      else if (diffSec < 60) setTimeAgo(`${diffSec}s ago`);
      else setTimeAgo(`${Math.floor(diffSec / 60)}m ago`);
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 5000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleRefreshClick = () => {
    setIsRotating(true);
    triggerRefresh();
    setTimeout(() => setIsRotating(false), 600);
  };

  const hasLeftSelectors = showDateRange || showTenant || showSeverity;
  const hasRightSelectors = showEnvironment || showRefresh;

  if (!hasLeftSelectors && !hasRightSelectors) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-sm text-slate-700 ${className}`}
    >
      {/* Left side: Context selectors */}
      {hasLeftSelectors && (
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector */}
          {showDateRange && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs text-slate-500 font-medium">Window:</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                aria-label="Filter date range window"
              >
                <option value="1h" className="bg-white text-slate-900">Last 1 Hour</option>
                <option value="24h" className="bg-white text-slate-900">Last 24 Hours</option>
                <option value="7d" className="bg-white text-slate-900">Last 7 Days</option>
                <option value="30d" className="bg-white text-slate-900">Last 30 Days</option>
                <option value="90d" className="bg-white text-slate-900">Last 90 Days</option>
                <option value="1y" className="bg-white text-slate-900">Last 1 Year</option>
              </select>
            </div>
          )}

          {/* Tenant Organization Selector */}
          {showTenant && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs text-slate-500 font-medium">{tenantLabel}</span>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer max-w-[180px] truncate"
                aria-label="Filter by organization tenant"
              >
                <option value="all" className="bg-white text-slate-900">All Organizations</option>
                {organizations.map((org: any) => (
                  <option key={org.id || org._id} value={org.id || org._id} className="bg-white text-slate-900">
                    {org.name} ({org.plan})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Severity Filter */}
          {showSeverity && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs text-slate-500 font-medium">Severity:</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
                className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                aria-label="Filter by severity level"
              >
                <option value="all" className="bg-white text-slate-900">All Severities</option>
                <option value="critical" className="bg-white text-rose-600">Critical Only</option>
                <option value="warning" className="bg-white text-amber-600">Warning & Above</option>
                <option value="info" className="bg-white text-blue-600">Informational</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Right side: Environment, Refresh & Timestamp */}
      {hasRightSelectors && (
        <div className="flex items-center gap-3 ml-auto">
          {/* Environment Badge */}
          {showEnvironment && (
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as Environment)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-emerald-700 focus:outline-none cursor-pointer uppercase tracking-wider"
                aria-label="Filter by deployment environment"
              >
                <option value="production" className="bg-white text-emerald-700">PROD</option>
                <option value="staging" className="bg-white text-amber-700">STAGE</option>
                <option value="development" className="bg-white text-blue-700">DEV</option>
              </select>
            </div>
          )}

          {showEnvironment && showRefresh && (
            <div className="h-4 w-[1px] bg-slate-200" />
          )}

          {/* Updated indicator & Refresh Button */}
          {showRefresh && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                Updated {timeAgo}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshClick}
                className="h-7 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md"
                title="Refresh dashboard data"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin text-indigo-600' : ''}`} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

