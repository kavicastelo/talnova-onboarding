import React from 'react';
import { SuperAdminFilterBar, type SuperAdminFilterBarProps } from './SuperAdminFilterBar';

interface SuperAdminShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  description?: string;
  actions?: React.ReactNode;
  hideFilterBar?: boolean;
  filterBarProps?: SuperAdminFilterBarProps;
  showSeverity?: boolean;
  showTenant?: boolean;
  showDateRange?: boolean;
  showEnvironment?: boolean;
  showRefresh?: boolean;
}

export function SuperAdminShell({
  children,
  title,
  subtitle,
  description,
  actions,
  hideFilterBar = false,
  filterBarProps,
  showSeverity,
  showTenant,
  showDateRange,
  showEnvironment,
  showRefresh,
}: SuperAdminShellProps) {
  const displaySubtitle = subtitle || description;
  return (
    <div className="min-h-full -m-4 lg:-m-6 p-4 lg:p-6 bg-slate-50 text-slate-900 space-y-5">
      {/* Top Header Bar if title provided */}
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            {title && (
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                {title}
              </h1>
            )}
            {displaySubtitle && (
              <p className="text-sm text-slate-600 mt-1">{displaySubtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
        </div>
      )}

      {/* Universal Filter Bar */}
      {!hideFilterBar && (
        <SuperAdminFilterBar
          showSeverity={showSeverity ?? filterBarProps?.showSeverity ?? false}
          showTenant={showTenant ?? filterBarProps?.showTenant ?? true}
          showDateRange={showDateRange ?? filterBarProps?.showDateRange ?? true}
          showEnvironment={showEnvironment ?? filterBarProps?.showEnvironment ?? true}
          showRefresh={showRefresh ?? filterBarProps?.showRefresh ?? true}
          {...filterBarProps}
        />
      )}

      {/* Content Area */}
      <div className="space-y-6">{children}</div>
    </div>
  );
}


