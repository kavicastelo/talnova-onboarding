import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Search,
  X,
  Check,
  Info,
  Sparkles
} from 'lucide-react';
import {
  WORKFORCE_LANGUAGES,
  WorkforceLanguage,
  getLanguageDisplayName
} from '../../constants/language.constants';

export interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage: string;
  onSelectLanguage: (languageCode: string) => void;
  supportedLanguages?: readonly string[];
  defaultLanguage?: string;
  highContrast?: boolean;
  className?: string;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedLanguage,
  onSelectLanguage,
  supportedLanguages,
  defaultLanguage = 'en',
  highContrast = false,
  className = ''
}) => {
  const { t } = useTranslation(['kiosk', 'common']);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search query when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter languages based on search query
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return WORKFORCE_LANGUAGES;

    return WORKFORCE_LANGUAGES.filter((lang) => {
      return (
        lang.code.toLowerCase().includes(q) ||
        lang.englishName.toLowerCase().includes(q) ||
        lang.autonym.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleSelect = (langCode: string) => {
    onSelectLanguage(langCode);
    onClose();
  };

  const defaultLangName = getLanguageDisplayName(defaultLanguage);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-modal-title"
      data-testid="language-selector-modal"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none ${
        highContrast ? 'bg-black/90' : 'bg-slate-950/80 backdrop-blur-md'
      } ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-200 animate-in fade-in zoom-in-95 ${
          highContrast
            ? 'high-contrast-mode bg-black border-amber-400 text-white'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`p-6 border-b flex items-start justify-between gap-4 ${
            highContrast ? 'border-amber-400/80 bg-black' : 'border-slate-800 bg-slate-950/50'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div
              className={`p-3 rounded-2xl ${
                highContrast
                  ? 'bg-amber-400 text-black'
                  : 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
              }`}
            >
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="language-modal-title"
                data-testid="language-modal-title"
                className="text-xl sm:text-2xl font-black tracking-tight"
              >
                {t('modal.languageTitle', { defaultValue: 'Select Terminal Language' })}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {t('modal.languageSubtitle', {
                  defaultValue:
                    'Choose your preferred language for safety instructions, checklists, and voiceover.'
                })}
              </p>
            </div>
          </div>

          {/* Close button with >= 48px touch target */}
          <button
            type="button"
            data-testid="close-language-modal-btn"
            onClick={onClose}
            aria-label="Close language selector"
            className="min-h-[48px] min-w-[48px] h-12 w-12 rounded-2xl border border-slate-700 hover:border-slate-500 flex items-center justify-center text-slate-400 hover:text-white transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-6 pb-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              role="searchbox"
              data-testid="language-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('modal.searchPlaceholder', {
                defaultValue: 'Search by language or code (e.g. Spanish, Español, Arabic, es)...'
              })}
              className={`w-full min-h-[48px] h-14 pl-12 pr-12 rounded-2xl text-base border focus:outline-hidden transition ${
                highContrast
                  ? 'bg-black border-white text-white focus:border-amber-400'
                  : 'bg-slate-950/70 border-slate-800 focus:border-indigo-500 text-white placeholder-slate-500'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                data-testid="clear-language-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear language search"
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-white transition active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Language Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2">
          {filteredLanguages.length === 0 ? (
            <div
              data-testid="no-languages-found"
              className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3"
            >
              <Globe className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-semibold">
                No languages found matching &quot;{searchQuery}&quot;
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition active:scale-95"
              >
                Reset Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredLanguages.map((lang: WorkforceLanguage) => {
                const isSelected = selectedLanguage === lang.code;
                const isJourneySupported =
                  !supportedLanguages || supportedLanguages.length === 0 || supportedLanguages.includes(lang.code);

                return (
                  <button
                    key={lang.code}
                    type="button"
                    data-testid={`language-card-${lang.code}`}
                    data-selected={isSelected}
                    aria-selected={isSelected}
                    onClick={() => handleSelect(lang.code)}
                    className={`min-h-[64px] p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-150 active:scale-[0.98] focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${
                      isSelected
                        ? highContrast
                          ? 'bg-amber-400 text-black border-amber-300 shadow-lg font-black'
                          : 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : highContrast
                        ? 'bg-black border-white text-white hover:border-amber-400'
                        : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      {/* English Name / Native Autonym */}
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span className="font-extrabold text-base tracking-tight">
                          {lang.englishName}
                        </span>
                        {lang.englishName.toLowerCase() !== lang.autonym.toLowerCase() && (
                          <>
                            <span className="text-slate-400 font-light">/</span>
                            <span
                              className={`text-sm font-semibold ${
                                isSelected
                                  ? highContrast
                                    ? 'text-black/80'
                                    : 'text-emerald-300'
                                  : 'text-slate-400'
                              }`}
                              dir={lang.direction}
                            >
                              {lang.autonym}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Language metadata & support status */}
                      <div className="flex items-center space-x-2 mt-1">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                            isSelected
                              ? highContrast
                                ? 'bg-black text-amber-400'
                                : 'bg-emerald-500/30 text-emerald-200'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {lang.code}
                        </span>

                        {isJourneySupported ? (
                          <span
                            className={`text-[10px] font-semibold flex items-center space-x-1 ${
                              isSelected
                                ? highContrast
                                  ? 'text-black'
                                  : 'text-emerald-300'
                                : 'text-slate-400'
                            }`}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Supported</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500">
                            Fallback to {defaultLanguage.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Active Selected Checkmark */}
                    <div
                      className={`min-h-[32px] min-w-[32px] rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? highContrast
                            ? 'bg-black text-amber-400 border-black'
                            : 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'border-slate-800 bg-slate-900/60 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isSelected && <Check className="w-5 h-5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Informational Untranslated Fallback Notice Footer */}
        <div
          className={`p-4 sm:p-5 border-t flex items-center space-x-3 text-xs ${
            highContrast
              ? 'bg-black border-amber-400/80 text-amber-200'
              : 'bg-slate-950/70 border-slate-800 text-slate-400'
          }`}
        >
          <Info className="w-4 h-4 shrink-0 text-indigo-400" />
          <p className="leading-relaxed">
            {t('modal.fallbackNotice', {
              defaultValue:
                `Safety journeys will automatically display instructions in ${defaultLangName} if specific step translations are unavailable.`,
              defaultLang: defaultLangName
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelectorModal;
