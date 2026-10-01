/**
 * Kiosk Service Worker Client Service (K-OFF-001 / ADR-009 / DEF-010)
 * Scopes registration strictly to `/kiosk/` paths to avoid interfering with
 * administrative web portal caching.
 */

export const KIOSK_SW_PATH = '/kiosk-sw.js';
export const KIOSK_SW_SCOPE = '/kiosk/';

export function isKioskServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

export async function getKioskRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isKioskServiceWorkerSupported()) {
    return null;
  }
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const kioskReg = registrations.find((reg) =>
      reg.scope.includes(KIOSK_SW_SCOPE) || reg.active?.scriptURL.includes('kiosk-sw')
    );
    return kioskReg || null;
  } catch (err) {
    console.warn('[KioskSW] Error retrieving registrations:', err);
    return null;
  }
}

/**
 * Registers the dedicated Kiosk Service Worker strictly scoped to /kiosk/
 */
export async function registerKioskServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isKioskServiceWorkerSupported()) {
    return null;
  }

  // Ensure current path is within kiosk domain before registering with kiosk scope
  const isKioskPath =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/kiosk');

  if (!isKioskPath) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(KIOSK_SW_PATH, {
      scope: KIOSK_SW_SCOPE,
      updateViaCache: 'none'
    });

    console.log('[KioskSW] Dedicated Kiosk Service Worker registered with scope:', registration.scope);

    // Prompt worker to activate immediately if waiting
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[KioskSW] New kiosk service worker content available; ready for seamless offline transition.');
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[KioskSW] Registration failed:', error);
    return null;
  }
}

/**
 * Unregisters any active Kiosk Service Worker
 */
export async function unregisterKioskServiceWorker(): Promise<boolean> {
  if (!isKioskServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await getKioskRegistration();
    if (registration) {
      const success = await registration.unregister();
      console.log('[KioskSW] Unregistered kiosk service worker:', success);
      return success;
    }
    return false;
  } catch (error) {
    console.error('[KioskSW] Unregistration failed:', error);
    return false;
  }
}

/**
 * Sends a list of media or bundle assets to the Service Worker to precache
 */
export function precacheJourneyAssets(assets: string[]): void {
  if (!isKioskServiceWorkerSupported() || !Array.isArray(assets) || assets.length === 0) {
    return;
  }

  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'PRECACHE_JOURNEY_ASSETS',
      assets
    });
  }
}

/**
 * Clears offline cache storage for kiosk
 */
export async function clearKioskOfflineCache(): Promise<void> {
  if (!isKioskServiceWorkerSupported()) {
    return;
  }

  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_OFFLINE_CACHE'
    });
  } else if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('talnova-kiosk-'))
        .map((k) => caches.delete(k))
    );
  }
}
