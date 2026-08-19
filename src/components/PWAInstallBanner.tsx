import React from 'react';
import { Button } from './Button';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAStatus } from '../hooks/usePWA';

export function PWAInstallBanner() {
  const { isInstallable, promptInstall } = usePWAStatus();
  const [dismissed, setDismissed] = React.useState(false);

  if (!isInstallable || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-3 px-4 flex items-center justify-between text-xs shadow-md">
      <div className="flex items-center gap-2.5">
        <Smartphone className="h-5 w-5 shrink-0" />
        <div>
          <span className="font-bold">Install Talnova App</span>
          <span className="hidden sm:inline text-indigo-100 ml-1">
            — Add to your home screen for quick mobile & offline field access.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-semibold py-1 px-3"
          onClick={promptInstall}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Install
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-indigo-200 hover:text-white p-1 rounded"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default PWAInstallBanner;
