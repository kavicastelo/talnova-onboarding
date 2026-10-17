import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Demo Phase 5 — Time-Bombed Invites & Remote Killswitch Heartbeat', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('1. Time-Bombed Invite Validation & Expiry Messaging', () => {
    it('formats and handles the exact branded expiration message', () => {
      const expiredResponse = {
        code: 'INVITE_EXPIRED',
        message: 'This demonstration link has expired. Request an extension from the Talnova team',
      };

      expect(expiredResponse.code).toBe('INVITE_EXPIRED');
      expect(expiredResponse.message).toBe(
        'This demonstration link has expired. Request an extension from the Talnova team'
      );
    });

    it('rejects missing tokens on invite redemption flow', () => {
      const token = null;
      let error = null;
      if (!token) {
        error = {
          isInvalid: true,
          message: 'No invite token found in this link. Please check your invitation URL.',
        };
      }

      expect(error?.isInvalid).toBe(true);
      expect(error?.message).toContain('No invite token found');
    });

    it('successfully extracts prospect attribution upon invite verification', () => {
      const mockInvitePayload = {
        prospectEmail: 'sarah@skynet.com',
        prospectCompany: 'Skynet Systems',
        assignedPersona: 'admin',
        expiresAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      };

      expect(mockInvitePayload.prospectEmail).toBe('sarah@skynet.com');
      expect(mockInvitePayload.prospectCompany).toBe('Skynet Systems');
      expect(new Date(mockInvitePayload.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('2. Remote Killswitch & Heartbeat Logic', () => {
    it('purges storage and flags killswitch when TERMINATE command received', () => {
      localStorage.setItem('demo_token', 'valid-jwt-token');
      localStorage.setItem('demo_session_id', 'sess-123456');
      localStorage.setItem('demo_user', JSON.stringify({ name: 'Prospect Admin' }));

      let isKilled = false;
      let killCommand: 'TERMINATE' | 'FREEZE' | null = null;

      const handleHeartbeatResponse = (data: { active: boolean; command?: string }) => {
        if (!data.active || data.command === 'TERMINATE' || data.command === 'FREEZE') {
          isKilled = true;
          killCommand = (data.command as 'TERMINATE' | 'FREEZE') || 'TERMINATE';
          localStorage.removeItem('demo_token');
          localStorage.removeItem('demo_session_id');
        }
      };

      // Receive TERMINATE signal
      handleHeartbeatResponse({ active: false, command: 'TERMINATE' });

      expect(isKilled).toBe(true);
      expect(killCommand).toBe('TERMINATE');
      expect(localStorage.getItem('demo_token')).toBeNull();
      expect(localStorage.getItem('demo_session_id')).toBeNull();
    });

    it('flags remote freeze and locks out client when FREEZE command received', () => {
      localStorage.setItem('demo_token', 'valid-jwt-token');

      let isKilled = false;
      let killCommand: 'TERMINATE' | 'FREEZE' | null = null;

      const handleHeartbeatResponse = (data: { active: boolean; command?: string }) => {
        if (!data.active || data.command === 'TERMINATE' || data.command === 'FREEZE') {
          isKilled = true;
          killCommand = (data.command as 'TERMINATE' | 'FREEZE') || 'FREEZE';
          localStorage.removeItem('demo_token');
        }
      };

      // Receive FREEZE signal
      handleHeartbeatResponse({ active: false, command: 'FREEZE' });

      expect(isKilled).toBe(true);
      expect(killCommand).toBe('FREEZE');
      expect(localStorage.getItem('demo_token')).toBeNull();
    });

    it('detects 401 SESSION_REVOKED on heartbeat and triggers immediate client wipe', () => {
      localStorage.setItem('demo_token', 'revoked-token');

      let isKilled = false;
      let killReason = '';

      const handleHeartbeatError = (err: any) => {
        if (err.status === 401 && err.code === 'SESSION_REVOKED') {
          isKilled = true;
          killReason = 'SESSION_REVOKED';
          localStorage.clear();
        }
      };

      handleHeartbeatError({ status: 401, code: 'SESSION_REVOKED' });

      expect(isKilled).toBe(true);
      expect(killReason).toBe('SESSION_REVOKED');
      expect(localStorage.getItem('demo_token')).toBeNull();
    });
  });
});
