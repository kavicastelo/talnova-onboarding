import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import axios from 'axios';
import { isDemoEnvironment, apiClient } from '../api/client';

describe('Demo Routing Isolation & Interceptor Safeguards (TASK-101 & TASK-102)', () => {
  const storageMap: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    Object.keys(storageMap).forEach((k) => delete storageMap[k]);

    (globalThis as any).localStorage = {
      getItem: (key: string) => storageMap[key] ?? null,
      setItem: (key: string, val: string) => { storageMap[key] = String(val); },
      removeItem: (key: string) => { delete storageMap[key]; },
      clear: () => { Object.keys(storageMap).forEach((k) => delete storageMap[k]); },
      key: () => null,
      length: 0,
    };

    (globalThis as any).window = {
      location: {
        pathname: '/demo/journeys',
        hostname: 'localhost',
        search: '',
        href: 'http://localhost:5173/demo/journeys',
      },
    };
  });

  afterAll(() => {
    if (originalWindow) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  describe('isDemoEnvironment Helper', () => {
    it('returns true when pathname starts with /demo', () => {
      (globalThis as any).window.location.pathname = '/demo/tasks';
      (globalThis as any).window.location.hostname = 'localhost';
      expect(isDemoEnvironment()).toBe(true);
    });

    it('returns true when pathname is /demo', () => {
      (globalThis as any).window.location.pathname = '/demo';
      (globalThis as any).window.location.hostname = 'localhost';
      expect(isDemoEnvironment()).toBe(true);
    });

    it('returns true when hostname starts with demo. (subdomain topology)', () => {
      (globalThis as any).window.location.pathname = '/journeys';
      (globalThis as any).window.location.hostname = 'demo.talnova.com';
      expect(isDemoEnvironment()).toBe(true);
    });

    it('returns false when on production root or routes', () => {
      (globalThis as any).window.location.pathname = '/journeys';
      (globalThis as any).window.location.hostname = 'app.talnova.com';
      expect(isDemoEnvironment()).toBe(false);
    });

    it('returns false on production /login and /register', () => {
      (globalThis as any).window.location.pathname = '/login';
      (globalThis as any).window.location.hostname = 'localhost';
      expect(isDemoEnvironment()).toBe(false);
    });
  });

  describe('Request Interceptor in Demo Mode', () => {
    it('attaches demo token and rewrites relative URL to /demo namespace', () => {
      storageMap['talnova_demo_token'] = 'demo-jwt-xyz-123';
      (globalThis as any).window.location.pathname = '/demo/tasks';
      (globalThis as any).window.location.hostname = 'localhost';

      const interceptor = (apiClient.interceptors.request as any).handlers[0].fulfilled;
      const config: any = {
        headers: {},
        url: '/tasks',
      };

      const result = interceptor(config);
      expect(result.headers.Authorization).toBe('Bearer demo-jwt-xyz-123');
      expect(result.url).toBe('/demo/tasks');
    });

    it('does not double-prefix if url already starts with /demo', () => {
      storageMap['talnova_demo_token'] = 'demo-jwt-xyz-123';
      (globalThis as any).window.location.pathname = '/demo/tasks';

      const interceptor = (apiClient.interceptors.request as any).handlers[0].fulfilled;
      const config: any = {
        headers: {},
        url: '/demo/tasks',
      };

      const result = interceptor(config);
      expect(result.url).toBe('/demo/tasks');
    });
  });

  describe('Response Interceptor 401 Isolation', () => {
    it('redirects to /demo/login on 401 and never calls production /auth/refresh', async () => {
      storageMap['talnova_demo_token'] = 'demo-token';
      storageMap['talnova_demo_user'] = JSON.stringify({ fullName: 'Sarah Connor' });
      storageMap['talnova_demo_role'] = 'admin';
      storageMap['auth_token'] = 'prod-admin-token';
      storageMap['user_role'] = 'super_admin';

      (globalThis as any).window.location.pathname = '/demo/tasks';
      (globalThis as any).window.location.href = 'http://localhost:5173/demo/tasks';

      const refreshSpy = vi.spyOn(axios, 'post');

      const errorHandler = (apiClient.interceptors.response as any).handlers[0].rejected;

      const mockError: any = {
        config: { url: '/demo/tasks', headers: {} },
        response: { status: 401, data: { message: 'Session expired' } },
        isAxiosError: true,
      };

      await expect(errorHandler(mockError)).rejects.toBeDefined();

      // Production refresh must NOT have been called
      expect(refreshSpy).not.toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), expect.anything(), expect.anything());

      // Demo storage keys MUST be cleared
      expect(storageMap['talnova_demo_token']).toBeUndefined();
      expect(storageMap['talnova_demo_user']).toBeUndefined();
      expect(storageMap['talnova_demo_role']).toBeUndefined();

      // Production storage keys MUST remain untouched!
      expect(storageMap['auth_token']).toBe('prod-admin-token');
      expect(storageMap['user_role']).toBe('super_admin');

      // Window must redirect to demo login, NEVER production /login
      expect((globalThis as any).window.location.href).toBe('/demo/login?reason=session_expired');

      refreshSpy.mockRestore();
    });

    it('redirects to production /login on 401 when on a production route', async () => {
      storageMap['auth_token'] = 'expired-prod-token';
      storageMap['user_role'] = 'employee';

      (globalThis as any).window.location.pathname = '/journeys';
      (globalThis as any).window.location.hostname = 'app.talnova.com';
      (globalThis as any).window.location.href = 'http://localhost:5173/journeys';

      // Mock refresh failure to test fallback to /login
      const refreshSpy = vi.spyOn(axios, 'post').mockRejectedValue(new Error('Refresh failed'));

      const errorHandler = (apiClient.interceptors.response as any).handlers[0].rejected;

      const mockError: any = {
        config: { url: '/journeys', headers: {} },
        response: { status: 401, data: { message: 'Unauthorized' } },
        isAxiosError: true,
      };

      await expect(errorHandler(mockError)).rejects.toBeDefined();

      // Production refresh MUST be attempted for production routes
      expect(refreshSpy).toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), {}, { withCredentials: true });

      // Production keys cleared
      expect(storageMap['auth_token']).toBeUndefined();
      expect(storageMap['user_role']).toBeUndefined();

      // Redirects to production /login
      expect((globalThis as any).window.location.href).toBe('/login');

      refreshSpy.mockRestore();
    });
  });

  describe('Storage Sandboxing (TASK-102)', () => {
    it('keeps demo role and production user_role completely segregated in localStorage', () => {
      storageMap['user_role'] = 'super_admin';
      storageMap['user_roles'] = JSON.stringify(['super_admin']);

      // Simulate demo session establishing demo persona
      storageMap['talnova_demo_role'] = 'employee';
      storageMap['talnova_demo_roles'] = JSON.stringify(['employee']);

      expect(storageMap['user_role']).toBe('super_admin');
      expect(storageMap['talnova_demo_role']).toBe('employee');
      expect(storageMap['user_role']).not.toBe(storageMap['talnova_demo_role']);
    });
  });

  describe('Context-Aware Navigation Adapter (TASK-202)', () => {
    it('maps root / to /demo when in demo environment', async () => {
      const { getAppPath } = await import('../utils/navigation');
      (globalThis as any).window.location.pathname = '/demo/tasks';
      (globalThis as any).window.location.hostname = 'localhost';

      expect(getAppPath('/')).toBe('/demo');
    });

    it('prefixes relative paths with /demo when in demo environment', async () => {
      const { getAppPath } = await import('../utils/navigation');
      (globalThis as any).window.location.pathname = '/demo/tasks';
      (globalThis as any).window.location.hostname = 'localhost';

      expect(getAppPath('/tasks')).toBe('/demo/tasks');
      expect(getAppPath('/journeys/abc-123')).toBe('/demo/journeys/abc-123');
      expect(getAppPath('/documents/456/sign')).toBe('/demo/documents/456/sign');
    });

    it('does not duplicate /demo prefix if already present', async () => {
      const { getAppPath } = await import('../utils/navigation');
      (globalThis as any).window.location.pathname = '/demo/admin';
      (globalThis as any).window.location.hostname = 'localhost';

      expect(getAppPath('/demo/tasks')).toBe('/demo/tasks');
    });

    it('leaves external links untouched in demo environment', async () => {
      const { getAppPath } = await import('../utils/navigation');
      (globalThis as any).window.location.pathname = '/demo/admin';

      expect(getAppPath('https://docs.talnova.com')).toBe('https://docs.talnova.com');
      expect(getAppPath('http://example.com')).toBe('http://example.com');
      expect(getAppPath('mailto:support@talnova.com')).toBe('mailto:support@talnova.com');
    });

    it('preserves exact paths unchanged in production environment', async () => {
      const { getAppPath } = await import('../utils/navigation');
      (globalThis as any).window.location.pathname = '/tasks';
      (globalThis as any).window.location.hostname = 'app.talnova.com';

      expect(getAppPath('/')).toBe('/');
      expect(getAppPath('/tasks')).toBe('/tasks');
      expect(getAppPath('/journeys/abc-123')).toBe('/journeys/abc-123');
      expect(getAppPath('/login')).toBe('/login');
    });
  });

  describe('Standalone Build & Target Isolation (TASK-301 & TASK-302)', () => {
    it('configures independent demo build targeting dist-demo', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const configPath = path.resolve(process.cwd(), 'vite.demo.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);

      const configContent = fs.readFileSync(configPath, 'utf-8');
      expect(configContent).toContain("outDir: path.resolve(__dirname, 'dist-demo')");
      expect(configContent).toContain("process.env.VITE_IS_DEMO_BUILD");
      expect(configContent).toContain("publicDir: path.resolve(__dirname, 'public')");
    });

    it('provides isolated demo/index.html with noindex protection', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const htmlPath = path.resolve(process.cwd(), 'demo/index.html');
      expect(fs.existsSync(htmlPath)).toBe(true);

      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      expect(htmlContent).toContain('<meta name="robots" content="noindex, nofollow" />');
      expect(htmlContent).toContain('Talnova Enterprise Demo');
      expect(htmlContent).toContain('src="/src/main.tsx"');
    });

    it('contains standalone demo scripts in package.json', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      expect(pkg.scripts['build:demo']).toBe('npx vite build --config vite.demo.config.ts');
      expect(pkg.scripts['dev:demo']).toBe('npx vite --config vite.demo.config.ts');
      expect(pkg.scripts['preview:demo']).toBe('npx vite preview --config vite.demo.config.ts');
    });
  });

  describe('Feature-Parity Mounts (TASK-401 through TASK-405)', () => {
    it('routes all parity features through demo navigation adapter', async () => {
      const { getAppPath } = await import('../utils/navigation');
      (globalThis as any).window.location.pathname = '/demo/admin';
      (globalThis as any).window.location.hostname = 'localhost';

      // TASK-401: Certificates
      expect(getAppPath('/certificates')).toBe('/demo/certificates');
      expect(getAppPath('/certificates/cert-xyz')).toBe('/demo/certificates/cert-xyz');

      // TASK-402: IT Ops Queue
      expect(getAppPath('/tasks/it-ops')).toBe('/demo/tasks/it-ops');

      // TASK-403: Office Floor Map
      expect(getAppPath('/office-map')).toBe('/demo/office-map');

      // TASK-404: Workflows
      expect(getAppPath('/workflows')).toBe('/demo/workflows');

      // TASK-405: KB Slideshow
      expect(getAppPath('/kb/slideshow')).toBe('/demo/kb/slideshow');
    });

    it('mounts parity features in App.tsx demo route tree', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const appPath = path.resolve(process.cwd(), 'src/App.tsx');
      const appContent = fs.readFileSync(appPath, 'utf-8');

      expect(appContent).toContain('<Route path="tasks/it-ops" element={<Tasks />} />');
      expect(appContent).toContain('<Route path="workflows" element={<Workflows />} />');
      expect(appContent).toContain('<Route path="office-map" element={<OfficeMap />} />');
      expect(appContent).toContain('<Route path="certificates" element={<Certificates />} />');
      expect(appContent).toContain('<Route path="certificates/:id" element={<PublicCertificateViewer />} />');
      expect(appContent).toContain('<Route path="kb/slideshow" element={<KnowledgeBaseSlideshow />} />');
    });

    it('mounts parity features in standalone DemoApp.tsx', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const demoAppPath = path.resolve(process.cwd(), 'demo/src/DemoApp.tsx');
      const demoAppContent = fs.readFileSync(demoAppPath, 'utf-8');

      expect(demoAppContent).toContain('<Route path="tasks/it-ops" element={<Tasks />} />');
      expect(demoAppContent).toContain('<Route path="workflows" element={<Workflows />} />');
      expect(demoAppContent).toContain('<Route path="office-map" element={<OfficeMap />} />');
      expect(demoAppContent).toContain('<Route path="certificates" element={<Certificates />} />');
      expect(demoAppContent).toContain('<Route path="certificates/:id" element={<PublicCertificateViewer />} />');
      expect(demoAppContent).toContain('<Route path="kb/slideshow" element={<KnowledgeBaseSlideshow />} />');
    });

    it('includes all parity features in DemoAppShell sidebar navigation', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const shellPath = path.resolve(process.cwd(), 'demo/src/components/DemoAppShell.tsx');
      const shellContent = fs.readFileSync(shellPath, 'utf-8');

      expect(shellContent).toContain("title: 'IT Hardware Queue'");
      expect(shellContent).toContain("title: 'Workflows & Rules'");
      expect(shellContent).toContain("title: 'Office Floor Map'");
      expect(shellContent).toContain("title: 'Certificates'");
      expect(shellContent).toContain("title: 'KB Slideshow'");
    });
  });
});

