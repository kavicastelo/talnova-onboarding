import React, { useState } from 'react';
import { cn } from './utils';
import { getInitials, getGradientPalette, getDiceBearAvatar, DiceBearStyle } from '../utils/avatar';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type AvatarStatus = 'online' | 'onboarding' | 'offline' | 'busy' | 'legal_hold';

export interface EmployeeAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string;
  email?: string;
  userId?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  fallbackStyle?: DiceBearStyle;
  showHoverEffect?: boolean;
  borderClass?: string;
}

const SIZE_CLASSES: Record<AvatarSize, { container: string; text: string; indicator: string }> = {
  xs: { container: 'size-6', text: 'text-[10px] font-semibold', indicator: 'size-1.5' },
  sm: { container: 'size-8', text: 'text-xs font-semibold', indicator: 'size-2' },
  md: { container: 'size-10', text: 'text-sm font-semibold', indicator: 'size-2.5' },
  lg: { container: 'size-12', text: 'text-base font-bold', indicator: 'size-3' },
  xl: { container: 'size-16', text: 'text-xl font-bold', indicator: 'size-3.5' },
  '2xl': { container: 'size-24', text: 'text-2xl font-bold', indicator: 'size-4' },
  '3xl': { container: 'size-28', text: 'text-3xl font-bold', indicator: 'size-5' },
};

const STATUS_CLASSES: Record<AvatarStatus, string> = {
  online: 'bg-emerald-500 ring-background',
  onboarding: 'bg-amber-500 ring-background',
  busy: 'bg-rose-500 ring-background',
  offline: 'bg-slate-400 ring-background',
  legal_hold: 'bg-rose-600 ring-rose-200 animate-pulse',
};

export const EmployeeAvatar: React.FC<EmployeeAvatarProps> = ({
  src,
  name,
  email,
  userId,
  size = 'md',
  status,
  fallbackStyle = 'avataaars',
  showHoverEffect = true,
  borderClass = 'ring-2 ring-border/50',
  className,
  ...props
}) => {
  const seed = userId || email || name || 'default-employee';
  const dicebearUrl = getDiceBearAvatar(seed, fallbackStyle);

  // Loading state tiers:
  // 0 = try custom src
  // 1 = custom src failed or empty, try dicebearUrl
  // 2 = dicebearUrl failed (network error), fallback to gradient initials
  const [loadTier, setLoadTier] = useState<number>(() => {
    return src && src.trim().length > 0 ? 0 : 1;
  });

  const initials = getInitials(name || email || 'User');
  const palette = getGradientPalette(seed);
  const sizeConfig = SIZE_CLASSES[size];

  const handleCustomImageError = () => {
    // If custom image fails, downgrade to DiceBear
    setLoadTier(1);
  };

  const handleDiceBearError = () => {
    // If DiceBear fails (e.g. offline mode), downgrade to gradient initials
    setLoadTier(2);
  };

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 select-none rounded-full',
        sizeConfig.container,
        showHoverEffect && 'transition-transform duration-200 hover:scale-105',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'relative flex size-full items-center justify-center overflow-hidden rounded-full shadow-sm',
          borderClass
        )}
      >
        {loadTier === 0 && src ? (
          <img
            src={src}
            alt={name || 'Employee avatar'}
            className="size-full object-cover rounded-full"
            onError={handleCustomImageError}
          />
        ) : loadTier === 1 ? (
          <img
            src={dicebearUrl}
            alt={name || 'Employee avatar'}
            className="size-full object-cover rounded-full bg-muted/40"
            onError={handleDiceBearError}
          />
        ) : (
          <div
            className={cn(
              'flex size-full items-center justify-center rounded-full',
              sizeConfig.text
            )}
            style={{
              background: palette.css,
              color: palette.text,
            }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Online/Status Indicator Dot */}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-background',
            sizeConfig.indicator,
            STATUS_CLASSES[status]
          )}
          title={`Status: ${status}`}
        />
      )}
    </div>
  );
};

export default EmployeeAvatar;
