import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from './utils';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  id?: string;
  name?: string;
  options: SearchableOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  clearable?: boolean;
  'data-testid'?: string;
  maxHeight?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options,
  value: controlledValue,
  defaultValue = '',
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No matching options found.',
  disabled = false,
  required = false,
  className,
  triggerClassName,
  dropdownClassName,
  clearable = false,
  'data-testid': testId,
  maxHeight = 'max-h-60',
}) => {
  const { t } = useTranslation('common');
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedValue = controlledValue !== undefined ? controlledValue : internalValue;

  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.value === selectedValue);
  }, [options, selectedValue]);

  // Filter options based on search text
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchSub = opt.sublabel?.toLowerCase().includes(query);
      const matchVal = opt.value.toLowerCase().includes(query);
      const matchBadge = opt.badge?.toLowerCase().includes(query);
      return matchLabel || matchSub || matchVal || matchBadge;
    });
  }, [options, search]);

  // Reset highlight index when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Handle outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when open
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Auto scroll highlighted item into view
  React.useEffect(() => {
    if (isOpen && listRef.current) {
      const itemEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (itemEl) {
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (val: string) => {
    if (controlledValue === undefined) {
      setInternalValue(val);
    }
    onChange?.(val);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (controlledValue === undefined) {
      setInternalValue('');
    }
    onChange?.('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full text-left', className)}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for form submission if required */}
      {required && (
        <input
          type="text"
          value={selectedValue}
          required={required}
          readOnly
          tabIndex={-1}
          className="sr-only"
        />
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        data-testid={testId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-foreground transition-all outline-none',
          'focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500',
          'hover:bg-slate-100/70 dark:hover:bg-slate-800/80',
          disabled && 'cursor-not-allowed opacity-50',
          triggerClassName
        )}
      >
        <span className={cn('truncate text-left flex-1', !selectedOption && 'text-muted-foreground')}>
          {selectedOption ? (
            <span className="flex items-center gap-2">
              <span className="font-medium text-foreground">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-xs text-muted-foreground">({selectedOption.sublabel})</span>
              )}
              {selectedOption.badge && (
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {selectedOption.badge}
                </span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-1 w-full min-w-[240px] rounded-xl border border-slate-200 dark:border-slate-700 bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-black/5 animate-in fade-in-80 zoom-in-95',
            dropdownClassName
          )}
        >
          {/* Search Header */}
          <div className="p-1 pb-1.5 border-b border-border mb-1">
            <div className="flex items-center gap-2 rounded-lg border border-input/40 bg-input/20 px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {options.length > 5 && (
              <div className="flex items-center justify-between px-1 pt-1 text-[10px] text-muted-foreground">
                <span>
                  {t('pagination.showingOf', {
                    count: filteredOptions.length,
                    total: options.length,
                    defaultValue: `Showing ${filteredOptions.length} of ${options.length}`
                  })}
                </span>
                {search && <span>{t('filteredResults', 'Filtered results')}</span>}
              </div>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            role="listbox"
            className={cn('overflow-y-auto overflow-x-hidden p-0.5 space-y-0.5', maxHeight)}
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === selectedValue;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    data-disabled={opt.disabled || undefined}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'relative flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors outline-none select-none',
                      isHighlighted && !isSelected && 'bg-slate-100 dark:bg-slate-800 text-foreground',
                      isSelected && 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-medium',
                      opt.disabled && 'pointer-events-none opacity-40'
                    )}
                  >
                    <div className="flex flex-col gap-0.5 truncate text-left">
                      <span className="truncate font-medium text-foreground flex items-center gap-1.5">
                        {opt.label}
                        {opt.badge && (
                          <span className="text-[10px] uppercase font-semibold px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                            {opt.badge}
                          </span>
                        )}
                      </span>
                      {opt.sublabel && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
