import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Check,
  AlertTriangle,
  RotateCcw,
  Eye,
  Hand,
  Headphones,
  Footprints,
  Sparkles,
  Shirt
} from 'lucide-react';

export interface PpeChecklistEngineProps {
  requiredItems?: readonly string[];
  checkedItems?: Set<string> | readonly string[];
  onToggleItem?: (item: string) => void;
  onConfirm: (checkedItems: string[]) => void;
  isSubmitted?: boolean;
  autoResetCountdown?: number;
  onReset?: () => void;
  title?: string;
  subtitle?: string;
  highContrast?: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
  confirmButtonTestId?: string;
  className?: string;
}

const DEFAULT_PPE_ITEMS = [
  'Hard Hat',
  'Safety Glasses',
  'High-Vis Vest',
  'Steel-Toe Boots',
  'Gloves'
];

export const PpeChecklistEngine: React.FC<PpeChecklistEngineProps> = ({
  requiredItems = DEFAULT_PPE_ITEMS,
  checkedItems: controlledChecked,
  onToggleItem,
  onConfirm,
  isSubmitted = false,
  autoResetCountdown,
  onReset,
  title,
  subtitle,
  highContrast = false,
  disabled = false,
  errorMessage,
  confirmButtonTestId = 'confirm-ppe-btn',
  className = ''
}) => {
  const { t } = useTranslation('kiosk');

  // Internal state if uncontrolled
  const [internalChecked, setInternalChecked] = useState<Set<string>>(new Set());

  const currentCheckedSet = useMemo(() => {
    if (controlledChecked instanceof Set) {
      return controlledChecked;
    }
    if (Array.isArray(controlledChecked)) {
      return new Set(controlledChecked);
    }
    return internalChecked;
  }, [controlledChecked, internalChecked]);

  const allChecked = useMemo(() => {
    return requiredItems.length > 0 && requiredItems.every((item) => currentCheckedSet.has(item));
  }, [requiredItems, currentCheckedSet]);

  const toggleItem = (item: string) => {
    if (disabled || isSubmitted) return;

    if (onToggleItem) {
      onToggleItem(item);
    } else {
      setInternalChecked((prev) => {
        const next = new Set(prev);
        if (next.has(item)) {
          next.delete(item);
        } else {
          next.add(item);
        }
        return next;
      });
    }
  };

  const handleSelectAll = () => {
    if (disabled || isSubmitted) return;

    if (allChecked) {
      // Deselect all
      if (onToggleItem) {
        requiredItems.forEach((item) => {
          if (currentCheckedSet.has(item)) onToggleItem(item);
        });
      } else {
        setInternalChecked(new Set());
      }
    } else {
      // Select all
      if (onToggleItem) {
        requiredItems.forEach((item) => {
          if (!currentCheckedSet.has(item)) onToggleItem(item);
        });
      } else {
        setInternalChecked(new Set(requiredItems));
      }
    }
  };

  const handleConfirm = () => {
    if (!allChecked || disabled || isSubmitted) return;
    onConfirm(Array.from(currentCheckedSet));
  };

  const getItemIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('eye') || lower.includes('glass') || lower.includes('goggle')) {
      return <Eye className="w-6 h-6 shrink-0" />;
    }
    if (lower.includes('boot') || lower.includes('shoe') || lower.includes('foot')) {
      return <Footprints className="w-6 h-6 shrink-0" />;
    }
    if (lower.includes('glove') || lower.includes('hand')) {
      return <Hand className="w-6 h-6 shrink-0" />;
    }
    if (lower.includes('vest') || lower.includes('jacket') || lower.includes('shirt')) {
      return <Shirt className="w-6 h-6 shrink-0" />;
    }
    if (lower.includes('ear') || lower.includes('hearing') || lower.includes('plug')) {
      return <Headphones className="w-6 h-6 shrink-0" />;
    }
    if (lower.includes('hat') || lower.includes('helmet') || lower.includes('head')) {
      return <ShieldCheck className="w-6 h-6 shrink-0" />;
    }
    return <Sparkles className="w-6 h-6 shrink-0" />;
  };

  return (
    <div
      data-testid="ppe-checklist-engine"
      className={`w-full max-w-2xl mx-auto rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl transition-all ${
        highContrast
          ? 'bg-black border-2 border-amber-400 text-white'
          : 'bg-slate-900/80 border-slate-800 text-slate-100 backdrop-blur-md'
      } ${className}`}
    >
      {/* Header section with progress indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-800">
        <div>
          <h3
            data-testid="ppe-checklist-title"
            className="text-xl sm:text-2xl font-black tracking-tight flex items-center space-x-2.5"
          >
            <ShieldCheck className={`w-7 h-7 ${highContrast ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>{title || t('ppe.title', { defaultValue: 'Mandatory PPE Verification Checklist' })}</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {subtitle || t('ppe.instruction', { defaultValue: 'Inspect and confirm required protective equipment before proceeding.' })}
          </p>
        </div>

        {/* Count badge & select all button */}
        {!isSubmitted && (
          <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
            <span
              data-testid="ppe-progress-count"
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                allChecked
                  ? highContrast
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {`${currentCheckedSet.size} / ${requiredItems.length} ${t('ppe.verified', { defaultValue: 'Checked' })}`}
            </span>
            <button
              type="button"
              data-testid="ppe-select-all-btn"
              onClick={handleSelectAll}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 ${
                highContrast
                  ? 'text-amber-300 hover:text-amber-200 underline'
                  : 'text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-900/60'
              }`}
            >
              {allChecked ? t('ppe.deselectAll', { defaultValue: 'Clear All' }) : t('ppe.selectAll', { defaultValue: 'Select All' })}
            </button>
          </div>
        )}
      </div>

      {/* Submitted Verified View */}
      {isSubmitted ? (
        <div
          data-testid="ppe-verified-banner"
          className={`p-6 sm:p-8 rounded-2xl border-2 text-center flex flex-col items-center space-y-4 animate-fade-in ${
            highContrast
              ? 'bg-black border-amber-400 text-amber-300'
              : 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
          }`}
        >
          <div className="h-16 w-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>
          <h4 className="text-2xl font-black tracking-tight">
            {t('ppe.complianceVerified', { defaultValue: 'PPE Verified & Compliance Recorded' })}
          </h4>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md">
            {t('ppe.telemetryLogged', { defaultValue: 'Telemetry confirmation event logged. Ready for operational access.' })}
          </p>

          {typeof autoResetCountdown === 'number' && (
            <div className="text-xs font-bold tracking-widest uppercase bg-slate-900/90 px-5 py-2.5 rounded-full border border-slate-800 text-slate-300">
              {`Terminal auto-reset in ${autoResetCountdown}s`}
            </div>
          )}

          {onReset && (
            <button
              type="button"
              data-testid="ppe-reset-btn"
              onClick={onReset}
              className="text-xs font-bold text-emerald-400 hover:underline flex items-center space-x-1 pt-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('ppe.resetImmediately', { defaultValue: 'Reset Immediately' })}</span>
            </button>
          )}
        </div>
      ) : (
        /* Checklist Touch Items */
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {requiredItems.map((item) => {
              const itemId = item.toLowerCase().replace(/[^a-z0-9]/g, '-');
              const isChecked = currentCheckedSet.has(item);

              return (
                <button
                  key={item}
                  type="button"
                  id={`ppe-check-${itemId}`}
                  data-testid={`ppe-check-${itemId}`}
                  onClick={() => toggleItem(item)}
                  className={`w-full min-h-[64px] px-5 py-4 rounded-2xl border-2 flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer select-none text-left ${
                    isChecked
                      ? highContrast
                        ? 'bg-amber-400 text-black border-amber-300 shadow-lg'
                        : 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-500/10'
                      : highContrast
                      ? 'bg-black border-neutral-700 text-white hover:border-amber-400/60'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div
                      className={`p-2 rounded-xl border ${
                        isChecked
                          ? highContrast
                            ? 'bg-black text-amber-300 border-black'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {getItemIcon(item)}
                    </div>
                    <span className="font-bold text-base truncate">{item}</span>
                  </div>

                  <div
                    className={`h-7 w-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition ${
                      isChecked
                        ? highContrast
                          ? 'bg-black border-black text-amber-300'
                          : 'bg-emerald-500 border-emerald-500 text-slate-950'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Warning banner when incomplete */}
          {!allChecked && (
            <div
              data-testid="ppe-incomplete-banner"
              className="flex items-center space-x-2.5 text-xs sm:text-sm text-amber-400 bg-amber-950/30 border border-amber-500/30 px-4 py-3 rounded-2xl"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
              <span>
                {t('ppe.allMandatoryWarning', { defaultValue: 'All mandatory gear items must be confirmed before briefing can conclude.' })}
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center space-x-2 text-xs font-semibold text-rose-400 bg-rose-950/30 border border-rose-500/30 px-4 py-2.5 rounded-xl">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Large Touch Action Button (min 64px height) */}
          <div className="pt-2">
            <button
              type="button"
              id="ppe-confirm-btn"
              data-testid={confirmButtonTestId}
              disabled={!allChecked || disabled}
              onClick={handleConfirm}
              className={`w-full min-h-[64px] px-8 py-4 rounded-2xl font-black text-base sm:text-lg tracking-wide transition-all flex items-center justify-center space-x-3 select-none ${
                allChecked && !disabled
                  ? highContrast
                    ? 'bg-amber-400 text-black border-2 border-amber-300 hover:bg-amber-300 active:scale-98 cursor-pointer shadow-xl'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-98 cursor-pointer shadow-xl shadow-emerald-500/25'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
              }`}
            >
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              <span>{t('ppe.confirmAction', { defaultValue: 'Confirm PPE & Advance' })}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PpeChecklistEngine;
