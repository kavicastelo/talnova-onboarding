import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRole } from '../context/RoleContext';
import { Capability } from '../utils/rbac';
import { ShieldAlert } from 'lucide-react';
import { Button } from './Button';
import { useNavigate } from 'react-router-dom';
import { FeatureDisabledBanner } from './FeatureDisabledBanner';

interface ProtectedRouteProps {
  capability?: Capability;
  featureFlag?: string;
  children: ReactNode;
}

export function ProtectedRoute({ capability, featureFlag, children }: ProtectedRouteProps) {
  const { can, hasFeature } = useRole();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  // 1. RBAC Capability Check
  if (capability && !can(capability)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('accessRestricted', 'Access Restricted')}</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          {t('accessRestrictedWithCap', {
            capability,
            defaultValue: `You do not have the required permissions to access this management area (${capability}). Please contact your organization administrator if you believe this is an error.`
          })}
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            {t('goBack', 'Go Back')}
          </Button>
          <Button onClick={() => navigate('/')}>
            {t('returnToDashboard', 'Return to Dashboard')}
          </Button>
        </div>
      </div>
    );
  }

  // 2. Runtime Feature Flag Check across all 105 capabilities
  if (featureFlag && !hasFeature(featureFlag)) {
    return <FeatureDisabledBanner featureKey={featureFlag} />;
  }

  return <>{children}</>;
}
