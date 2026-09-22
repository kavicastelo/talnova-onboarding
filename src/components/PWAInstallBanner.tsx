import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAStatus } from '../hooks/usePWA';

export function PWAInstallBanner() {
  const { isInstallable, promptInstall } = usePWAStatus();
  const [dismissed, setDismissed] = React.useState(false);
  const { t } = useTranslation('common');

  if (!isInstallable || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-3 px-4 flex items-center justify-between text-xs shadow-md">
      <div className="flex items-center gap-2.5">
        <Smartphone className="h-5 w-5 shrink-0" />
        <div>
          <span className="font-bold">{t('pwa.banner.title', 'Install Talnova App')}</span>
          <span className="hidden sm:inline text-indigo-100 ml-1">
            {t('pwa.banner.description', '— Add to your home screen for quick mobile & offline field access.')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-semibold py-1 px-3"
          onClick={promptInstall}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> {t('pwa.banner.install', 'Install')}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-indigo-200 hover:text-white p-1 rounded"
          aria-label={t('pwa.banner.dismiss', 'Dismiss')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default PWAInstallBanner;
