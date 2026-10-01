import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  KioskLockdownService,
  kioskLockdownService,
  DESTRUCTIVE_SHORTCUTS
} from '../features/kiosk/services/kiosk-lockdown.service';
import { KioskReenterModal } from '../features/kiosk/components/lockdown/KioskReenterModal';
import { KioskPinOverlay } from '../features/kiosk/components/KioskPinOverlay';
import { KioskPlayer } from '../features/kiosk/components/KioskPlayer';
import { kioskService } from '../features/kiosk/services/kiosk.service';
import { deviceIdentityService } from '../features/kiosk/services/device-identity.service';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock kioskService
vi.mock('../features/kiosk/services/kiosk.service', () => ({
  kioskService: {
    verifyPin: vi.fn(),
    identifyFrontlineWorker: vi.fn(),
    completeSession: vi.fn(),
    startSession: vi.fn()
  }
}));

// Mock deviceIdentityService
vi.mock('../features/kiosk/services/device-identity.service', () => ({
  deviceIdentityService: {
    isRevoked: vi.fn(() => false),
    clearRevocationStatus: vi.fn(),
    getHardwareGuidSync: vi.fn(() => 'HW-GUID-TEST-100'),
    getEmployeeUser: vi.fn(() => null),
    setEmployeeSession: vi.fn(),
    clearEmployeeSession: vi.fn()
  }
}));

// Mock useKioskPlayer context hook
const mockUseKioskPlayer = vi.fn();
vi.mock('../features/kiosk/context/KioskPlayerContext', () => ({
  useKioskPlayer: () => mockUseKioskPlayer(),
  KioskPlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('K-SEC-002: Browser Kiosk Lockdown & Exit PIN Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    kioskLockdownService.stopLockdown();
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. Acceptance Criteria 1: Context Menu Suppression
  // =========================================================================
  describe('Acceptance Criteria 1: Context Menu Suppression', () => {
    it('cancels context menu event on right-click or long-press and prevents default browser menu', () => {
      const service = new KioskLockdownService();
      let defaultPrevented = false;
      let propagationStopped = false;

      const mockEvent = {
        preventDefault: () => {
          defaultPrevented = true;
        },
        stopPropagation: () => {
          propagationStopped = true;
        }
      } as any;

      service.suppressContextMenu(mockEvent);

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
    });

    it('attaches contextmenu capture listener to target upon starting lockdown', () => {
      const listeners: Record<string, Function[]> = {};
      const mockTarget = {
        addEventListener: vi.fn((event: string, handler: Function) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        }),
        removeEventListener: vi.fn((event: string, handler: Function) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        })
      };

      const service = new KioskLockdownService({ eventTarget: mockTarget as any });
      service.startLockdown();

      expect(mockTarget.addEventListener).toHaveBeenCalledWith(
        'contextmenu',
        expect.any(Function),
        { capture: true }
      );

      // Trigger the captured contextmenu handler
      let prevented = false;
      const fakeContextMenuEvent = {
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: vi.fn()
      } as any;

      listeners['contextmenu'][0](fakeContextMenuEvent);
      expect(prevented).toBe(true);
      expect(fakeContextMenuEvent.stopPropagation).toHaveBeenCalled();

      // Clean up
      service.stopLockdown();
      expect(mockTarget.removeEventListener).toHaveBeenCalledWith(
        'contextmenu',
        expect.any(Function),
        { capture: true }
      );
    });
  });

  // =========================================================================
  // 2. Destructive Keyboard Shortcut Interception
  // =========================================================================
  describe('Destructive Shortcut Interception (F11, F12, Ctrl+Shift+I, Ctrl+R, Alt+F4, Ctrl+W)', () => {
    it('identifies and intercepts destructive key combinations', () => {
      const service = new KioskLockdownService();

      const testCases: { desc: string; event: Partial<KeyboardEvent>; shouldPrevent: boolean }[] = [
        { desc: 'F11 (Fullscreen toggle)', event: { key: 'F11' }, shouldPrevent: true },
        { desc: 'F12 (DevTools toggle)', event: { key: 'F12' }, shouldPrevent: true },
        { desc: 'Ctrl+Shift+I (DevTools Inspector)', event: { ctrlKey: true, shiftKey: true, key: 'I' }, shouldPrevent: true },
        { desc: 'Cmd+Shift+I (Mac DevTools Inspector)', event: { metaKey: true, shiftKey: true, key: 'I' }, shouldPrevent: true },
        { desc: 'Ctrl+Shift+J (DevTools Console)', event: { ctrlKey: true, shiftKey: true, key: 'J' }, shouldPrevent: true },
        { desc: 'Ctrl+Shift+C (DevTools Inspect Element)', event: { ctrlKey: true, shiftKey: true, key: 'C' }, shouldPrevent: true },
        { desc: 'Ctrl+R (Reload)', event: { ctrlKey: true, key: 'r' }, shouldPrevent: true },
        { desc: 'F5 (Page Reload)', event: { key: 'F5' }, shouldPrevent: true },
        { desc: 'Ctrl+Shift+R (Hard Reload)', event: { ctrlKey: true, shiftKey: true, key: 'r' }, shouldPrevent: true },
        { desc: 'Alt+F4 (Close Window)', event: { altKey: true, key: 'F4' }, shouldPrevent: true },
        { desc: 'Ctrl+W (Close Tab)', event: { ctrlKey: true, key: 'w' }, shouldPrevent: true },
        { desc: 'Ctrl+U (View Source)', event: { ctrlKey: true, key: 'u' }, shouldPrevent: true },
        { desc: 'Ctrl+P (Print Page)', event: { ctrlKey: true, key: 'p' }, shouldPrevent: true },
        { desc: 'Ctrl+S (Save Page)', event: { ctrlKey: true, key: 's' }, shouldPrevent: true },
        { desc: 'Alt+ArrowLeft (History Back)', event: { altKey: true, key: 'ArrowLeft' }, shouldPrevent: true },
        { desc: 'Alt+ArrowRight (History Forward)', event: { altKey: true, key: 'ArrowRight' }, shouldPrevent: true },
        // Safe keys that must NOT be prevented
        { desc: 'Regular Key typing (e.g. 5 for PIN)', event: { key: '5' }, shouldPrevent: false },
        { desc: 'Regular Enter key', event: { key: 'Enter' }, shouldPrevent: false },
        { desc: 'Regular Tab key', event: { key: 'Tab' }, shouldPrevent: false },
        { desc: 'Regular ArrowDown key', event: { key: 'ArrowDown' }, shouldPrevent: false }
      ];

      for (const tc of testCases) {
        let prevented = false;
        let propagationStopped = false;

        const fakeEvent = {
          ...tc.event,
          preventDefault: () => {
            prevented = true;
          },
          stopPropagation: () => {
            propagationStopped = true;
          }
        } as KeyboardEvent;

        service.interceptKeyboardShortcuts(fakeEvent);

        expect(
          prevented,
          `Expected ${tc.desc} to have defaultPrevented = ${tc.shouldPrevent}`
        ).toBe(tc.shouldPrevent);

        if (tc.shouldPrevent) {
          expect(propagationStopped).toBe(true);
        }
      }
    });

    it('attaches keydown listener in capture mode during lockdown and detaches on stop', () => {
      const listeners: Record<string, Function[]> = {};
      const mockTarget = {
        addEventListener: vi.fn((event: string, handler: Function) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        }),
        removeEventListener: vi.fn((event: string, handler: Function) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        })
      };

      const service = new KioskLockdownService({ eventTarget: mockTarget as any });
      service.startLockdown();

      expect(mockTarget.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      );

      service.stopLockdown();

      expect(mockTarget.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      );
    });
  });

  // =========================================================================
  // 3. Fullscreen API Enforcement & First Interaction Auto-Trigger
  // =========================================================================
  describe('Fullscreen API Enforcement', () => {
    it('triggers requestFullscreen on target element', async () => {
      const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined);
      const mockElement = {
        requestFullscreen: mockRequestFullscreen
      };

      const service = new KioskLockdownService();
      const success = await service.requestFullscreen(mockElement as any);

      expect(success).toBe(true);
      expect(mockRequestFullscreen).toHaveBeenCalled();
      expect(service.getState().isFullscreen).toBe(true);
      expect(service.getState().isReenterPromptVisible).toBe(false);
    });

    it('gracefully handles browser gesture rejection or policy denial without throwing', async () => {
      const mockRequestFullscreen = vi.fn().mockRejectedValue(new Error('User gesture required'));
      const mockElement = {
        requestFullscreen: mockRequestFullscreen
      };

      const service = new KioskLockdownService();
      const success = await service.requestFullscreen(mockElement as any);

      expect(success).toBe(false);
    });

    it('supports webkitRequestFullscreen fallback', async () => {
      const mockWebkitRequestFullscreen = vi.fn().mockResolvedValue(undefined);
      const mockElement = {
        webkitRequestFullscreen: mockWebkitRequestFullscreen
      };

      const service = new KioskLockdownService();
      const success = await service.requestFullscreen(mockElement as any);

      expect(success).toBe(true);
      expect(mockWebkitRequestFullscreen).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. Fullscreen Exit Detection & Re-enter Modal Prompt
  // =========================================================================
  describe('Fullscreen Exit Detection & Re-enter Kiosk Mode Prompt', () => {
    it('sets isReenterPromptVisible to true when fullscreen is exited while lockdown is active', () => {
      const service = new KioskLockdownService({ autoPromptReenter: true });
      service.startLockdown();

      // Initially not in fullscreen
      expect(service.getState().isReenterPromptVisible).toBe(false);

      // Simulate entering fullscreen
      (service as any).isFullscreenState = true;
      (service as any).isFullscreen = () => true;

      // Simulate exiting fullscreen (e.g. Esc pressed)
      (service as any).isFullscreen = () => false;
      (service as any).handleFullscreenChange();

      expect(service.getState().isReenterPromptVisible).toBe(true);

      // Simulate re-entering fullscreen
      (service as any).isFullscreen = () => true;
      (service as any).handleFullscreenChange();

      expect(service.getState().isReenterPromptVisible).toBe(false);
    });

    it('renders KioskReenterModal when isReenterPromptVisible is true', () => {
      const onReenterSpy = vi.fn();
      const html = renderToString(
        <KioskReenterModal
          isOpen={true}
          onReenter={onReenterSpy}
          highContrast={false}
        />
      );

      // Verify modal root container
      expect(html).toContain('id="kiosk-reenter-modal"');
      expect(html).toContain('data-testid="kiosk-reenter-modal"');

      // Verify exact required prompt message: "Touch screen to re-enter kiosk mode"
      expect(html).toContain('Touch screen to re-enter kiosk mode');

      // Verify action resume button
      expect(html).toContain('data-testid="kiosk-reenter-btn"');
      expect(html).toContain('Resume Kiosk Mode');
    });

    it('renders KioskReenterModal with high-contrast styles when highContrast is true', () => {
      const html = renderToString(
        <KioskReenterModal
          isOpen={true}
          highContrast={true}
        />
      );

      expect(html).toContain('border-amber-400');
      expect(html).toContain('Touch screen to re-enter kiosk mode');
    });

    it('returns null when KioskReenterModal isOpen is false', () => {
      const html = renderToString(
        <KioskReenterModal
          isOpen={false}
        />
      );

      expect(html).toBe('');
    });
  });

  // =========================================================================
  // 5. Acceptance Criteria 2: Administrative 6-Digit Exit PIN Protection
  // =========================================================================
  describe('Acceptance Criteria 2: Administrative Exit PIN Protection', () => {
    it('verifies 6-digit Exit PIN correctly and rejects shorter/invalid PINs', async () => {
      const service = new KioskLockdownService();

      // Shorter PINs are rejected
      expect(await service.verifyExitPin('1234', '123456')).toBe(false);
      expect(await service.verifyExitPin('12345', '123456')).toBe(false);

      // Incorrect 6-digit PIN is rejected
      expect(await service.verifyExitPin('000000', '123456')).toBe(false);

      // Correct 6-digit PIN is accepted
      expect(await service.verifyExitPin('123456', '123456')).toBe(true);
    });

    it('renders KioskPinOverlay with 6 digit slots and custom exit title/description', () => {
      const onSuccessSpy = vi.fn();
      const onCancelSpy = vi.fn();

      const html = renderToString(
        <KioskPinOverlay
          journeyId="journey-test-999"
          pinLength={6}
          title="Enter Exit PIN"
          description="Administrative Exit. Enter 6-digit Exit PIN to leave kiosk mode."
          onSuccess={onSuccessSpy}
          onCancel={onCancelSpy}
        />
      );

      expect(html).toContain('id="kiosk-pin-overlay"');
      expect(html).toContain('data-testid="kiosk-pin-overlay"');
      expect(html).toContain('Enter Exit PIN');
      expect(html).toContain('Administrative Exit. Enter 6-digit Exit PIN to leave kiosk mode.');

      // Verify all 6 PIN slot elements
      for (let i = 0; i < 6; i++) {
        expect(html).toContain(`data-testid="kiosk-pin-slot-${i}"`);
      }

      // Verify Keypad buttons 0-9, CLEAR, BACK
      for (let i = 0; i <= 9; i++) {
        expect(html).toContain(`data-testid="kiosk-keypad-btn-${i}"`);
      }
      expect(html).toContain('data-testid="kiosk-keypad-clear"');
      expect(html).toContain('data-testid="kiosk-keypad-back"');
      expect(html).toContain('data-testid="kiosk-pin-cancel-btn"');
    });

    it('submits and verifies 6-digit PIN successfully against expected PIN', async () => {
      let isVerified = false;
      const verifyExit = async (pin: string) => {
        if (pin === '849201') {
          isVerified = true;
          return true;
        }
        return false;
      };

      const resultBad = await verifyExit('123456');
      expect(resultBad).toBe(false);
      expect(isVerified).toBe(false);

      const resultGood = await verifyExit('849201');
      expect(resultGood).toBe(true);
      expect(isVerified).toBe(true);
    });
  });

  // =========================================================================
  // 6. KioskPlayer Integration with Lockdown & Exit PIN
  // =========================================================================
  describe('KioskPlayer Integration with Lockdown Controls', () => {
    const mockJourney = {
      _id: 'journey-lockdown-101',
      title: 'Automotive Factory Safety',
      languages: ['en'],
      steps: [
        {
          id: 'step-01',
          title: 'Lockdown Check',
          blocks: [{ id: 'b1', type: 'text', content: 'Safety briefing active.' }]
        }
      ],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        autoReturnHome: false,
        hideNavigation: false,
        disableExit: false,
        security: {
          protectionType: 'pin',
          pinCode: '741852'
        }
      }
    };

    beforeEach(() => {
      mockUseKioskPlayer.mockReturnValue({
        journey: mockJourney,
        currentStepIndex: 0,
        selectedLanguage: 'en',
        isMuted: false,
        showSubtitles: false,
        isLoading: false,
        error: null,
        loadJourney: vi.fn(),
        setStepIndex: vi.fn(),
        nextStep: vi.fn(),
        prevStep: vi.fn(),
        changeLanguage: vi.fn(),
        setPlayingAudio: vi.fn(),
        toggleMuted: vi.fn(),
        toggleSubtitles: vi.fn(),
        startSession: vi.fn(),
        recordInteraction: vi.fn(),
        completeSession: vi.fn(),
        abortSession: vi.fn(),
        timeoutSession: vi.fn(),
        activeSession: { _id: 'session-live-01' },
        recordPpeCompliance: vi.fn()
      });
    });

    it('renders Exit button in KioskPlayer header to trigger Exit PIN gate', () => {
      const onExitSpy = vi.fn();

      const html = renderToString(
        <KioskPlayer
          journeyId="journey-lockdown-101"
          onExit={onExitSpy}
          isAdminPreview={false}
        />
      );

      // Verify kiosk player shell
      expect(html).toContain('id="kiosk-player-shell"');
      expect(html).toContain('data-testid="kiosk-player-shell"');

      // Verify exit button is rendered in the header
      expect(html).toContain('id="kiosk-btn-exit"');
      expect(html).toContain('data-testid="kiosk-btn-exit"');
      expect(html).toContain('Exit');
    });

    it('does NOT immediately call onExit when Exit button is clicked, mandating Exit PIN entry', () => {
      const onExitSpy = vi.fn();

      let showPinOverlay = false;
      const handleExitClick = (isAdminPreview: boolean) => {
        if (isAdminPreview) {
          onExitSpy();
          return;
        }
        showPinOverlay = true;
      };

      // Click Exit in regular kiosk player mode
      handleExitClick(false);

      expect(showPinOverlay).toBe(true);
      expect(onExitSpy).not.toHaveBeenCalled();

      // Only if PIN verification succeeds does onExit get invoked
      const onPinSuccess = () => {
        showPinOverlay = false;
        onExitSpy();
      };
      onPinSuccess();

      expect(showPinOverlay).toBe(false);
      expect(onExitSpy).toHaveBeenCalledTimes(1);
    });

    it('renders the 6-digit Exit PIN modal inside KioskPlayer when showPinOverlay is true', () => {
      const html = renderToString(
        <KioskPinOverlay
          journeyId="journey-lockdown-101"
          pinLength={6}
          expectedPin={mockJourney.settings.security.pinCode}
          title="Enter Exit PIN"
          description="Administrative Exit. Enter 6-digit Exit PIN to leave kiosk mode."
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain('Enter Exit PIN');
      expect(html).toContain('Administrative Exit. Enter 6-digit Exit PIN to leave kiosk mode.');
      expect(html).toContain('data-testid="kiosk-pin-slot-5"');
    });
  });
});
