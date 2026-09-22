import { useState, useEffect } from 'react';
import { pwaService } from '../services/pwa.service';
import { toast } from 'sonner';
import i18n from '../i18n';

export function usePWAStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.success(i18n.t('common:pwa.connectionRestored', 'Connection restored! Syncing offline progress...'));
      const count = await pwaService.flushOfflineQueue();
      if (count > 0) {
        toast.success(i18n.t('common:pwa.syncedOfflineTasks', { count, defaultValue: 'Successfully synced {{count}} offline task completion(s)!' }));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning(i18n.t('common:pwa.offlineWarning', 'You are currently offline. Field actions will be queued and synced automatically.'));
    };

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    }
  };

  return {
    isOnline,
    isInstallable,
    promptInstall,
  };
}
