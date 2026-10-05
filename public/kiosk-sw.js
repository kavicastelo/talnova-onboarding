/* eslint-env serviceworker */
/**
 * Talnova Kiosk Dedicated Service Worker (K-OFF-001 / ADR-009 / DEF-010)
 * Scoped strictly to /kiosk/ to provide resilient offline application shell,
 * static asset precaching, and network-first runtime routing with cached fallbacks.
 */

const KIOSK_SHELL_CACHE = 'talnova-kiosk-shell-v1';
const KIOSK_API_CACHE = 'talnova-kiosk-api-v1';
const KIOSK_MEDIA_CACHE = 'talnova-kiosk-media-v1';

// Static resources to precache upon installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/kiosk/terminal',
  '/kiosk/pair',
  '/manifest.json',
  '/src/index.tsx',
  '/src/index.css',
  // Translations
  '/locales/en/kiosk.json',
  '/locales/es/kiosk.json',
  '/locales/ar/kiosk.json',
  '/locales/en/common.json',
  '/locales/es/common.json',
  '/locales/ar/common.json'
];

// Helper: Check if request is a navigation request for HTML shell
function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept') && request.headers.get('accept').includes('text/html'))
  );
}

// Helper: Check if URL belongs to Kiosk API
function isKioskApiRequest(url) {
  return url.pathname.startsWith('/api/v1/kiosk/');
}

// Helper: Check if URL belongs to Kiosk Media Uploads
function isKioskMediaRequest(url) {
  return url.pathname.startsWith('/api/v1/kiosk/uploads/');
}

// Helper: Check if URL is static asset (scripts, styles, fonts, locales)
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/locales/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

// 1. INSTALLATION EVENT: Precache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(KIOSK_SHELL_CACHE).then(async (cache) => {
      // Precache assets individually to ensure one failing asset doesn't abort the entire install
      const cachePromises = PRECACHE_ASSETS.map(async (asset) => {
        try {
          const response = await fetch(asset, { cache: 'no-cache' });
          if (response && response.ok) {
            await cache.put(asset, response);
          }
        } catch (err) {
          // In development/test environments, some bundled files might resolve dynamically
          // Log and continue gracefully
          console.warn(`[KioskSW] Precaching skipped for ${asset}:`, err?.message || err);
        }
      });
      await Promise.all(cachePromises);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATION EVENT: Clean obsolete kiosk caches & claim clients
self.addEventListener('activate', (event) => {
  const currentCaches = [KIOSK_SHELL_CACHE, KIOSK_API_CACHE, KIOSK_MEDIA_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('talnova-kiosk-') && !currentCaches.includes(key))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH EVENT: Intelligent routing based on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-http/https schemes (such as chrome-extension://, moz-extension://)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Never intercept or cache Vite development server requests or HMR modules
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('/node_modules/') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t') ||
    url.searchParams.has('import')
  ) {
    return;
  }

  // Ignore non-GET requests for caching (let them pass through to network)
  if (event.request.method !== 'GET') {
    return;
  }

  // Strategy A: HTML Navigation Requests (e.g., /kiosk/terminal, /kiosk/pair, /kiosk/device/123)
  // Network-First with Cache Fallback to Shell (Acceptance Criteria 1)
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(KIOSK_SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback: try specific request, then /kiosk/terminal, then /index.html
          const cache = await caches.open(KIOSK_SHELL_CACHE);
          const cachedMatch =
            (await cache.match(event.request)) ||
            (await cache.match('/kiosk/terminal')) ||
            (await cache.match('/index.html')) ||
            (await cache.match('/'));

          if (cachedMatch) {
            return cachedMatch;
          }

          // Minimal fallback HTML if cache was somehow empty
          return new Response(
            '<!DOCTYPE html><html><head><title>Talnova Kiosk (Offline)</title></head><body><div id="root"></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Strategy B: Kiosk Media Uploads (/api/v1/kiosk/uploads/:id)
  // Cache-First with Network Fallback & Population
  if (isKioskMediaRequest(url)) {
    event.respondWith(
      caches.open(KIOSK_MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          return cached;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response(null, { status: 504, statusText: 'Gateway Timeout (Offline Media)' });
        }
      })
    );
    return;
  }

  // Strategy C: Kiosk API Endpoints (/api/v1/kiosk/...)
  // Network-First with Fallback to Cached API Responses
  if (isKioskApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(KIOSK_API_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(KIOSK_API_CACHE);
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // Return synthetic offline response if not in cache
          return new Response(
            JSON.stringify({
              error: 'Offline: Network request failed and no cached response available.',
              offline: true,
              timestamp: new Date().toISOString()
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Kiosk-Offline': 'true'
              }
            }
          );
        })
    );
    return;
  }

  // Strategy D: Static Assets (JS, CSS, Locales, Fonts, SVGs)
  // Cache-First / Stale-While-Revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(KIOSK_SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});

// 4. MESSAGE EVENT: External commands from frontend
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'PRECACHE_JOURNEY_ASSETS' && Array.isArray(event.data.assets)) {
    event.waitUntil(
      caches.open(KIOSK_MEDIA_CACHE).then((cache) => {
        return Promise.all(
          event.data.assets.map(async (assetUrl) => {
            try {
              const res = await fetch(assetUrl);
              if (res && res.ok) {
                await cache.put(assetUrl, res);
              }
            } catch (err) {
              console.warn('[KioskSW] Failed to precache journey asset:', assetUrl, err);
            }
          })
        );
      })
    );
  }

  if (event.data.type === 'CLEAR_OFFLINE_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(KIOSK_SHELL_CACHE),
        caches.delete(KIOSK_API_CACHE),
        caches.delete(KIOSK_MEDIA_CACHE)
      ])
    );
  }
});
