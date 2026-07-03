
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './DropdownMenu';
import { Button } from './Button';
import { useLanguage } from '../context/LanguageContext';
import {
  LOCALE_DISPLAY_NAMES,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../i18n/localization.config';

interface LanguageSwitcherProps {
  /** Visual variant — 'icon' shows only the globe, 'full' shows locale label too */
  variant?: 'icon' | 'full';
}

/**
 * LanguageSwitcher
 *
 * Dropdown that lets the user switch between supported locales.
 * On change:
 *   - Updates i18next immediately (UI re-renders with new strings)
 *   - Persists to localStorage (guest)
 *   - If authenticated, syncs to user profile via PATCH /employees/me/preferences
 */
export function LanguageSwitcher({ variant = 'icon' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'icon' ? 'icon' : 'sm'}
          aria-label="Switch language"
          className="gap-1.5"
        >
          <Globe className="h-4 w-4" />
          {variant === 'full' && (
            <span className="text-xs font-medium uppercase">{language}</span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" />
          Language
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setLanguage(code as SupportedLocale)}
            className={`flex items-center justify-between ${language === code ? 'font-semibold text-primary' : ''}`}
          >
            <span>{LOCALE_DISPLAY_NAMES[code as SupportedLocale]}</span>
            <span className="text-xs text-muted-foreground uppercase">{code}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;
