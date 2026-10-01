import { registerKioskServiceWorker } from './features/kiosk/services/kiosk-service-worker';

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Strict scope separation (DEF-010 / K-OFF-001):
  // When on a /kiosk/ path, register the dedicated kiosk service worker strictly scoped to /kiosk/
  if (window.location.pathname.startsWith('/kiosk')) {
    const registerKiosk = () => {
      registerKioskServiceWorker().catch((err) => {
        console.error('[KioskSW] Kiosk service worker registration error:', err);
      });
    };

    if (document.readyState === 'complete') {
      registerKiosk();
    } else {
      window.addEventListener('load', registerKiosk);
    }
    return;
  }

  // Otherwise on portal / admin pages, register the general application service worker
  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] ServiceWorker registered with scope: ', registration.scope);
      })
      .catch((error) => {
        console.error('[PWA] ServiceWorker registration failed: ', error);
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}
