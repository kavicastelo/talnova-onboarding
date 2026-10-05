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

  // In development, do not register /sw.js to prevent hijacking Vite HMR and prebundled deps.
  // Also clean up any existing /sw.js registrations and stale dev caches.
  if ((import.meta as any).env?.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        if (!reg.scope.includes('/kiosk/')) {
          reg.unregister();
        }
      }
    });
    if ('caches' in window) {
      caches.delete('talnova-v2');
      caches.delete('talnova-v1');
    }
    return;
  }

  // Otherwise on portal / admin pages (in production), register the general application service worker
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

