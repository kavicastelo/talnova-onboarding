import type { ReactNode } from 'react';
import { useRole } from '../context/RoleContext';
import { FeatureDisabledBanner } from './FeatureDisabledBanner';

export interface FeatureGateProps {
  flagKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  showBanner?: boolean;
  compactBanner?: boolean;
}

export function FeatureGate({
  flagKey,
  children,
  fallback = null,
  showBanner = false,
  compactBanner = true,
}: FeatureGateProps) {
  const { hasFeature } = useRole();

  const isEnabled = hasFeature(flagKey);

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showBanner) {
    return <FeatureDisabledBanner featureKey={flagKey} compact={compactBanner} />;
  }

  return null;
}
