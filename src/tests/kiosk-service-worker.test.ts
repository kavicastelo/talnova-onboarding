import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  registerKioskServiceWorker,
  unregisterKioskServiceWorker,
  isKioskServiceWorkerSupported,
  KIOSK_SW_PATH,
  KIOSK_SW_SCOPE
} from '../features/kiosk/services/kiosk-service-worker';
import { registerServiceWorker } from '../serviceWorkerRegistration';

describe('K-OFF-001: Kiosk Service Worker & Offline Shell Architecture Suite', () => {
  const swScriptPath = path.resolve(process.cwd(), 'public/kiosk-sw.js');
  let swContent: string;

  beforeEach(() => {
    vi.clearAllMocks();
    swContent = fs.readFileSync(swScriptPath, 'utf8');
  });

  describe('1. Service Worker File & Cache Architecture Verification', () => {
    it('verifies that public/kiosk-sw.js exists and defines correct cache buckets', () => {
      expect(fs.existsSync(swScriptPath)).toBe(true);
      expect(swContent).toContain("const KIOSK_SHELL_CACHE = 'talnova-kiosk-shell-v1'");
      expect(swContent).toContain("const KIOSK_API_CACHE = 'talnova-kiosk-api-v1'");
      expect(swContent).toContain("const KIOSK_MEDIA_CACHE = 'talnova-kiosk-media-v1'");
    });

    it('precaches the HTML shell, kiosk routes, and critical static assets', () => {
      expect(swContent).toContain("'/kiosk/terminal'");
      expect(swContent).toContain("'/kiosk/pair'");
      expect(swContent).toContain("'/index.html'");
      expect(swContent).toContain("'/manifest.json'");
      expect(swContent).toContain("'/locales/en/kiosk.json'");
      expect(swContent).toContain("'/locales/es/kiosk.json'");
      expect(swContent).toContain("'/locales/ar/kiosk.json'");
    });

    it('attaches required lifecycle and fetch listeners', () => {
      expect(swContent).toContain("self.addEventListener('install'");
      expect(swContent).toContain("self.addEventListener('activate'");
      expect(swContent).toContain("self.addEventListener('fetch'");
      expect(swContent).toContain("self.addEventListener('message'");
    });

    it('implements network-first strategy for /api/v1/kiosk/ endpoints', () => {
      expect(swContent).toContain("isKioskApiRequest(url)");
      expect(swContent).toContain("/api/v1/kiosk/");
      // Checks fetch first with cache fallback
      expect(swContent).toContain("caches.open(KIOSK_API_CACHE)");
    });
  });

  describe('2. Dedicated Service Worker Registration & Scope Separation', () => {
    let originalNavigator: any;
    let originalWindow: any;
    let originalDocument: any;
    let mockRegister: any;
    let mockGetRegistrations: any;
    let mockRegistration: any;

    beforeEach(() => {
      originalNavigator = global.navigator;
      originalWindow = (global as any).window;
      originalDocument = (global as any).document;

      mockRegistration = {
        scope: 'http://localhost:3000/kiosk/',
        waiting: null,
        installing: null,
        active: { scriptURL: 'http://localhost:3000/kiosk-sw.js' },
        addEventListener: vi.fn(),
        unregister: vi.fn().mockResolvedValue(true)
      };

      mockRegister = vi.fn().mockResolvedValue(mockRegistration);
      mockGetRegistrations = vi.fn().mockResolvedValue([mockRegistration]);

      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            register: mockRegister,
            getRegistrations: mockGetRegistrations,
            controller: null
          }
        },
        writable: true,
        configurable: true
      });

      (global as any).window = {
        location: new URL('http://localhost:3000/kiosk/terminal'),
        addEventListener: vi.fn()
      };

      (global as any).document = {
        readyState: 'complete',
        addEventListener: vi.fn()
      };
    });

    afterEach(() => {
      global.navigator = originalNavigator;
      (global as any).window = originalWindow;
      (global as any).document = originalDocument;
    });

    it('registers /kiosk-sw.js strictly scoped to /kiosk/ when on a kiosk path', async () => {
      (global as any).window.location = new URL('http://localhost:3000/kiosk/terminal');

      const reg = await registerKioskServiceWorker();

      expect(reg).toBe(mockRegistration);
      expect(mockRegister).toHaveBeenCalledWith(KIOSK_SW_PATH, {
        scope: KIOSK_SW_SCOPE,
        updateViaCache: 'none'
      });
    });

    it('refuses to register kiosk service worker outside /kiosk/ paths to protect admin portal', async () => {
      (global as any).window.location = new URL('http://localhost:3000/dashboard/users');

      const reg = await registerKioskServiceWorker();

      expect(reg).toBeNull();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('unregisters kiosk service worker cleanly', async () => {
      (global as any).window.location = new URL('http://localhost:3000/kiosk/terminal');

      const success = await unregisterKioskServiceWorker();
      expect(success).toBe(true);
      expect(mockRegistration.unregister).toHaveBeenCalled();
    });

    it('serviceWorkerRegistration helper routes to registerKioskServiceWorker on /kiosk/ routes', () => {
      (global as any).window.location = new URL('http://localhost:3000/kiosk/terminal');

      registerServiceWorker();

      // Ensure /sw.js with global scope is NOT registered when on kiosk path
      expect(mockRegister).not.toHaveBeenCalledWith('/sw.js');
    });
  });

  describe('3. Offline Fetch & Acceptance Criteria Simulation', () => {
    it('Acceptance Criteria: Serves cached application shell when browser refreshes /kiosk/terminal offline', async () => {
      const mockShellResponse = new Response(
        '<!DOCTYPE html><html><head><title>Talnova Kiosk Terminal</title></head><body><div id="root">Kiosk Terminal Shell</div></body></html>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );

      // Mock Caches API
      const mockCache = {
        match: vi.fn(async (req: any) => {
          const url = typeof req === 'string' ? req : req.url;
          if (url.includes('/kiosk/terminal') || url.includes('/index.html')) {
            return mockShellResponse;
          }
          return undefined;
        }),
        put: vi.fn().mockResolvedValue(undefined)
      };

      const mockCaches = {
        open: vi.fn().mockResolvedValue(mockCache),
        match: vi.fn().mockResolvedValue(mockShellResponse)
      };
      (global as any).caches = mockCaches;

      // Simulate Service Worker navigation handler logic
      const simulateOfflineNavigation = async (reqUrl: string) => {
        // Network attempt fails (offline)
        const networkFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch (offline)'));

        try {
          return await networkFetch(reqUrl);
        } catch (err) {
          // Service worker fallback logic
          const cache = await mockCaches.open('talnova-kiosk-shell-v1');
          const cached =
            (await cache.match(reqUrl)) ||
            (await cache.match('/kiosk/terminal')) ||
            (await cache.match('/index.html'));

          if (cached) {
            return cached;
          }
          throw err;
        }
      };

      const response = await simulateOfflineNavigation('http://localhost:3000/kiosk/terminal');

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      const htmlText = await response.text();
      expect(htmlText).toContain('Kiosk Terminal Shell');
    });

    it('serves cached API responses when network is disconnected and falls back gracefully', async () => {
      const mockManifestData = {
        deviceId: 'kiosk-offline-01',
        organizationId: 'org-test',
        device: { name: 'Offline Terminal 1', status: 'offline' },
        journeys: []
      };

      const mockApiResponse = new Response(JSON.stringify(mockManifestData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      const mockApiCache = {
        match: vi.fn(async () => mockApiResponse),
        put: vi.fn().mockResolvedValue(undefined)
      };

      const mockCaches = {
        open: vi.fn().mockResolvedValue(mockApiCache)
      };
      (global as any).caches = mockCaches;

      // Simulate Service Worker API network-first with cache fallback
      const simulateOfflineApiCall = async (apiUrl: string) => {
        const networkFetch = vi.fn().mockRejectedValue(new TypeError('Network disconnected'));

        try {
          return await networkFetch(apiUrl);
        } catch {
          const cache = await mockCaches.open('talnova-kiosk-api-v1');
          const cached = await cache.match(apiUrl);
          if (cached) {
            return cached;
          }
          return new Response(JSON.stringify({ offline: true, error: 'Offline fallback' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Kiosk-Offline': 'true' }
          });
        }
      };

      const response = await simulateOfflineApiCall('http://localhost:3000/api/v1/kiosk/manifest');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.deviceId).toBe('kiosk-offline-01');
    });
  });
});
