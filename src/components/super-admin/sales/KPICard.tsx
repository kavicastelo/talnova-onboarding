import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { MetricDelta } from '../../../services/salesAnalytics.service';

export interface KPICardProps {
  id?: string;
  title: string;
  value: string | number;
  subValue?: string;
  delta?: MetricDelta;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'purple';
  onClick?: () => void;
  tooltip?: string;
  loading?: boolean;
  periodLabel?: string;
}

const variantStyles: Record<string, { bg: string; text: string; iconBg: string; border: string }> = {
  primary: {
    bg: 'bg-white',
    text: 'text-indigo-600',
    iconBg: 'bg-indigo-50 text-indigo-600',
    border: 'border-slate-200 hover:border-indigo-300',
  },
  success: {
    bg: 'bg-white',
    text: 'text-emerald-600',
    iconBg: 'bg-emerald-50 text-emerald-600',
    border: 'border-slate-200 hover:border-emerald-300',
  },
  warning: {
    bg: 'bg-white',
    text: 'text-amber-600',
    iconBg: 'bg-amber-50 text-amber-600',
    border: 'border-slate-200 hover:border-amber-300',
  },
  info: {
    bg: 'bg-white',
    text: 'text-sky-600',
    iconBg: 'bg-sky-50 text-sky-600',
    border: 'border-slate-200 hover:border-sky-300',
  },
  purple: {
    bg: 'bg-white',
    text: 'text-purple-600',
    iconBg: 'bg-purple-50 text-purple-600',
    border: 'border-slate-200 hover:border-purple-300',
  },
};

export const KPICard: React.FC<KPICardProps> = ({
  id,
  title,
  value,
  subValue,
  delta,
  icon: Icon,
  variant = 'primary',
  onClick,
  tooltip,
  loading = false,
  periodLabel = 'vs prior period',
}) => {
  const styles = variantStyles[variant] || variantStyles.primary;

  const isPositive = delta ? delta.delta > 0 : false;
  const isNegative = delta ? delta.delta < 0 : false;
  const isNeutral = delta ? delta.delta === 0 : true;

  return (
    <div
      id={id}
      onClick={onClick}
      title={tooltip || (onClick ? `Click to view ${title}` : undefined)}
      className={`relative p-5 rounded-xl border transition-all duration-200 ${styles.bg} ${styles.border} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-slate-100 animate-pulse rounded my-1" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${styles.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        {loading ? (
          <div className="h-4 w-32 bg-slate-100 animate-pulse rounded" />
        ) : (
          <>
            {delta !== undefined ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium ${
                    isPositive
                      ? 'bg-emerald-50 text-emerald-700'
                      : isNegative
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isPositive && <ArrowUpRight className="w-3.5 h-3.5" />}
                  {isNegative && <ArrowDownRight className="w-3.5 h-3.5" />}
                  {isNeutral && <Minus className="w-3 h-3" />}
                  {delta.percentageChange > 0 ? `+${delta.percentageChange}%` : `${delta.percentageChange}%`}
                </span>
                <span className="text-slate-400">{periodLabel}</span>
              </div>
            ) : subValue ? (
              <span className="text-slate-500 font-medium">{subValue}</span>
            ) : null}

            {onClick && (
              <span className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center gap-0.5 text-[11px] ml-auto">
                Explore &rarr;
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default KPICard;
