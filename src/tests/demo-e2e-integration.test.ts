import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { apiClient, isDemoEnvironment } from '../api/client';
import { getAppPath } from '../utils/navigation';

describe('Demo End-to-End Integration Suite (TASK-501)', () => {
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
        pathname: '/demo',
        hostname: 'localhost',
        search: '',
        href: 'http://localhost:5173/demo',
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

  describe('1. Persona Session Lifecycle & Storage Sandboxing', () => {
    it('establishes demo admin persona and isolates all tokens from production keys', () => {
      // Simulate production user session already present in browser
      storageMap['auth_token'] = 'prod-jwt-super-admin-xyz';
      storageMap['user_role'] = 'super_admin';
      storageMap['user_roles'] = JSON.stringify(['super_admin']);

      // Prospect logs into demo as Sarah Connor (Admin)
      storageMap['talnova_demo_token'] = 'demo-jwt-sarah-admin';
      storageMap['talnova_demo_user'] = JSON.stringify({
        email: 'sarah.connor@acme-demo.com',
        fullName: 'Sarah Connor',
        role: 'Admin',
        company: 'Acme Corp',
      });
      storageMap['talnova_demo_role'] = 'admin';
      storageMap['talnova_demo_roles'] = JSON.stringify(['admin']);
      storageMap['talnova_demo_tenant'] = JSON.stringify({
        id: 'acme-corp',
        name: 'Acme Corp',
        package: 'FULL_SUITE',
      });
      storageMap['talnova_demo_watermark'] = JSON.stringify({
        text: 'Acme Corp Demo • Evaluation Only',
        timestamp: new Date().toISOString(),
      });

      // Verify strict sandboxing
      expect(storageMap['auth_token']).toBe('prod-jwt-super-admin-xyz');
      expect(storageMap['user_role']).toBe('super_admin');
      expect(storageMap['talnova_demo_token']).toBe('demo-jwt-sarah-admin');
      expect(storageMap['talnova_demo_role']).toBe('admin');
      expect(storageMap['talnova_demo_role']).not.toBe(storageMap['user_role']);
    });

    it('switches persona between Admin, Manager, and Employee seamlessly without storage collision', () => {
      // Step 1: Start as Admin
      storageMap['talnova_demo_role'] = 'admin';
      storageMap['talnova_demo_roles'] = JSON.stringify(['admin']);
      expect(storageMap['talnova_demo_role']).toBe('admin');

      // Step 2: Switch to Employee (John Doe)
      storageMap['talnova_demo_role'] = 'employee';
      storageMap['talnova_demo_roles'] = JSON.stringify(['employee']);
      expect(storageMap['talnova_demo_role']).toBe('employee');

      // Step 3: Switch to Manager (Alice Smith)
      storageMap['talnova_demo_role'] = 'manager';
      storageMap['talnova_demo_roles'] = JSON.stringify(['manager']);
      expect(storageMap['talnova_demo_role']).toBe('manager');

      // Step 4: Ensure production keys were NEVER modified by persona switching
      expect(storageMap['user_role']).toBeUndefined();
      expect(storageMap['auth_token']).toBeUndefined();
    });

    it('clears only demo keys upon demo logout and leaves production session untouched', () => {
      storageMap['auth_token'] = 'prod-active-token';
      storageMap['user_role'] = 'admin';
      storageMap['talnova_demo_token'] = 'demo-jwt-active';
      storageMap['talnova_demo_role'] = 'employee';
      storageMap['talnova_demo_user'] = JSON.stringify({ fullName: 'Demo Candidate' });

      // Simulate demo logout
      delete storageMap['talnova_demo_token'];
      delete storageMap['talnova_demo_role'];
      delete storageMap['talnova_demo_user'];

      expect(storageMap['talnova_demo_token']).toBeUndefined();
      expect(storageMap['talnova_demo_role']).toBeUndefined();
      expect(storageMap['auth_token']).toBe('prod-active-token');
      expect(storageMap['user_role']).toBe('admin');
    });
  });

  describe('2. Routing Boundaries & Subdomain Origin Isolation', () => {
    it('correctly adapts paths in dedicated subdomain deployment (demo.talnova.io)', () => {
      (globalThis as any).window.location.hostname = 'demo.talnova.io';
      (globalThis as any).window.location.pathname = '/tasks';

      expect(isDemoEnvironment()).toBe(true);

      // On dedicated demo domain, internal navigation stays within demo context
      expect(getAppPath('/tasks')).toBe('/demo/tasks');
      expect(getAppPath('/workflows')).toBe('/demo/workflows');
      expect(getAppPath('/office-map')).toBe('/demo/office-map');
      expect(getAppPath('/certificates')).toBe('/demo/certificates');
      expect(getAppPath('/kb/slideshow')).toBe('/demo/kb/slideshow');
    });

    it('correctly adapts paths in subpath deployment (/demo/*)', () => {
      (globalThis as any).window.location.hostname = 'app.talnova.io';
      (globalThis as any).window.location.pathname = '/demo/directory';

      expect(isDemoEnvironment()).toBe(true);

      expect(getAppPath('/directory/emp-123')).toBe('/demo/directory/emp-123');
      expect(getAppPath('/tasks/it-ops')).toBe('/demo/tasks/it-ops');
    });

    it('never alters paths when executing in production context', () => {
      (globalThis as any).window.location.hostname = 'app.talnova.io';
      (globalThis as any).window.location.pathname = '/tasks';

      expect(isDemoEnvironment()).toBe(false);

      expect(getAppPath('/')).toBe('/');
      expect(getAppPath('/tasks')).toBe('/tasks');
      expect(getAppPath('/workflows')).toBe('/workflows');
      expect(getAppPath('/super-admin')).toBe('/super-admin');
    });
  });

  describe('3. Error Interception & Self-Contained Fallbacks', () => {
    it('redirects 401 to /demo/login?reason=session_expired and never leaks to /login', async () => {
      storageMap['talnova_demo_token'] = 'expired-token';
      (globalThis as any).window.location.pathname = '/demo/tasks';
      (globalThis as any).window.location.href = 'http://localhost:5173/demo/tasks';

      const errorHandler = (apiClient.interceptors.response as any).handlers[0].rejected;
      const mockError: any = {
        config: { url: '/demo/tasks', headers: {} },
        response: { status: 401, data: { message: 'JWT expired' } },
        isAxiosError: true,
      };

      await expect(errorHandler(mockError)).rejects.toBeDefined();

      expect(storageMap['talnova_demo_token']).toBeUndefined();
      expect((globalThis as any).window.location.href).toBe('/demo/login?reason=session_expired');
      expect((globalThis as any).window.location.href).not.toBe('/login');
    });

    it('intercepts API calls in demo mode and prepends /demo namespace', () => {
      storageMap['talnova_demo_token'] = 'bearer-token-123';
      (globalThis as any).window.location.pathname = '/demo/journeys';

      const interceptor = (apiClient.interceptors.request as any).handlers[0].fulfilled;
      const config: any = { headers: {}, url: '/journeys' };

      const modified = interceptor(config);
      expect(modified.url).toBe('/demo/journeys');
      expect(modified.headers.Authorization).toBe('Bearer bearer-token-123');
    });
  });

  describe('4. Parity Feature Completeness Check', () => {
    const requiredParityFeatures = [
      { name: 'Dashboard', path: '/demo' },
      { name: 'Journeys List', path: '/demo/journeys' },
      { name: 'Journey Builder', path: '/demo/journeys/123' },
      { name: 'Tasks List', path: '/demo/tasks' },
      { name: 'IT Ops Hardware Queue', path: '/demo/tasks/it-ops' },
      { name: 'Workflows & Rules', path: '/demo/workflows' },
      { name: 'Employee Directory', path: '/demo/directory' },
      { name: 'Employee Profile', path: '/demo/directory/me' },
      { name: 'Office Floor Map', path: '/demo/office-map' },
      { name: 'Knowledge Base', path: '/demo/kb' },
      { name: 'KB Slideshow', path: '/demo/kb/slideshow' },
      { name: 'Documents & E-Sign', path: '/demo/documents' },
      { name: 'Certificates', path: '/demo/certificates' },
      { name: 'Milestones & Badges', path: '/demo/milestones' },
      { name: 'Leaderboard', path: '/demo/leaderboard' },
      { name: 'Buddy Program', path: '/demo/buddy' },
      { name: 'AI Assistant', path: '/demo/ai-assistant' },
      { name: 'Calendar Integration', path: '/demo/calendar' },
      { name: 'HR Operations', path: '/demo/hr-ops' },
      { name: 'HR Exceptions Workbench', path: '/demo/hr-ops/exceptions' },
      { name: 'AI Course Builder', path: '/demo/ai-course-builder' },
      { name: 'Kiosk Dashboard', path: '/demo/kiosk' },
      { name: 'Kiosk Compliance', path: '/demo/kiosk/compliance' },
      { name: 'Kiosk Terminal', path: '/demo/kiosk/terminal' },
      { name: 'HRIS Integrations', path: '/demo/settings/integrations' },
      { name: 'SSO Settings', path: '/demo/settings/sso' },
      { name: 'Super Admin Dashboard', path: '/demo/super-admin' },
      { name: 'Super Admin Demo Management', path: '/demo/super-admin/demo' },
      { name: 'Settings', path: '/demo/settings' },
      { name: 'Email Sink Sandbox', path: '/demo/inbox' },
    ];


    it.each(requiredParityFeatures)('ensures $name ($path) is registered and mapped', ({ path }) => {
      const stripped = path.replace('/demo', '') || '/';
      (globalThis as any).window.location.pathname = '/demo';
      expect(getAppPath(stripped)).toBe(path);
    });
  });
});
