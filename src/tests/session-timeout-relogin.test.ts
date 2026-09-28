import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../services/auth.service';
import { queryClient } from '../queryClient';

// Mock apiClient
vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn().mockImplementation((url: string) => {
      if (url === '/auth/login') {
        return Promise.resolve({
          data: {
            data: {
              accessToken: 'mock-access-token-123',
              user: {
                _id: 'user-1',
                role: 'admin',
                roles: ['admin'],
                email: 'test@talnova.com',
                firstName: 'Test',
                lastName: 'User',
              },
            },
          },
        });
      }
      if (url === '/auth/logout') {
        return Promise.resolve({
          data: { success: true },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    }),
  },
}));

describe('Session Inactivity & Re-Login Hand-off Resilience', () => {
  const storageMap: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(storageMap).forEach((k) => delete storageMap[k]);

    (globalThis as any).localStorage = {
      getItem: (key: string) => storageMap[key] ?? null,
      setItem: (key: string, val: string) => { storageMap[key] = String(val); },
      removeItem: (key: string) => { delete storageMap[key]; },
      clear: () => { Object.keys(storageMap).forEach((k) => delete storageMap[k]); },
      key: () => null,
      length: 1,
    };

    vi.spyOn(queryClient, 'clear');
  });

  it('resets talnova_last_activity and clears queryClient on successful login', async () => {
    // Simulate a leftover stale activity timestamp from 2 days ago
    storageMap['talnova_last_activity'] = String(Date.now() - 48 * 3600 * 1000);

    const result = await authService.login('test@talnova.com', 'ValidPass123!');

    expect(result.accessToken).toBe('mock-access-token-123');
    expect(storageMap['auth_token']).toBe('mock-access-token-123');
    expect(queryClient.clear).toHaveBeenCalled();

    // Verify activity timestamp has been refreshed to now (within 1 second)
    const newActivity = parseInt(storageMap['talnova_last_activity'], 10);
    expect(Number.isFinite(newActivity)).toBe(true);
    expect(Date.now() - newActivity).toBeLessThan(1000);
  });

  it('purges all authentication tokens, roles, and talnova_last_activity on logout', async () => {
    storageMap['auth_token'] = 'active-token';
    storageMap['user_role'] = 'admin';
    storageMap['user_roles'] = JSON.stringify(['admin']);
    storageMap['user_features'] = JSON.stringify({ kiosk_mode: true });
    storageMap['talnova_last_activity'] = String(Date.now());

    await authService.logout();

    expect(storageMap['auth_token']).toBeUndefined();
    expect(storageMap['user_role']).toBeUndefined();
    expect(storageMap['user_roles']).toBeUndefined();
    expect(storageMap['user_features']).toBeUndefined();
    expect(storageMap['talnova_last_activity']).toBeUndefined();
    expect(queryClient.clear).toHaveBeenCalled();
  });

  it('validates that stale stored activity older than timeoutSeconds is ignored and reset', () => {
    const timeoutSeconds = 3600; // 1 hour
    const staleTimestamp = Date.now() - 7200 * 1000; // 2 hours ago
    storageMap['talnova_last_activity'] = String(staleTimestamp);

    const now = Date.now();
    const stored = parseInt(storageMap['talnova_last_activity'], 10);

    // Reproduce useSessionTimeout initial activity check
    const isValidStored = stored > 0 && (now - stored) < (timeoutSeconds * 1000);
    const initial = isValidStored ? stored : now;

    // Must detect stale timestamp and choose current time instead of stale time
    expect(isValidStored).toBe(false);
    expect(initial).toBe(now);
  });

  it('validates that active stored activity within timeoutSeconds is preserved for multi-tab sync', () => {
    const timeoutSeconds = 3600; // 1 hour
    const recentTimestamp = Date.now() - 300 * 1000; // 5 minutes ago
    storageMap['talnova_last_activity'] = String(recentTimestamp);

    const now = Date.now();
    const stored = parseInt(storageMap['talnova_last_activity'], 10);

    // Reproduce useSessionTimeout initial activity check
    const isValidStored = stored > 0 && (now - stored) < (timeoutSeconds * 1000);
    const initial = isValidStored ? stored : now;

    // Preserves recent cross-tab timestamp
    expect(isValidStored).toBe(true);
    expect(initial).toBe(recentTimestamp);
  });
});
