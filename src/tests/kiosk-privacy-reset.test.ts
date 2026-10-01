import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  PrivacyResetService,
  privacyResetService,
  MONITORED_DOM_EVENTS
} from '../features/kiosk/services/privacy-reset.service';
import { PrivacyTimeoutModal } from '../features/kiosk/components/privacy/PrivacyTimeoutModal';
import { deviceIdentityService } from '../features/kiosk/services/device-identity.service';
import { kioskService } from '../features/kiosk/services/kiosk.service';

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
    timeoutSession: vi.fn(),
    abortSession: vi.fn(),
    createSession: vi.fn()
  }
}));

// Mock deviceIdentityService
vi.mock('../features/kiosk/services/device-identity.service', () => {
  let employeeToken: string | null = null;
  let employeeUser: any = null;

  return {
    deviceIdentityService: {
      getEmployeeToken: vi.fn(() => employeeToken),
      getEmployeeUser: vi.fn(() => employeeUser),
      setEmployeeSession: vi.fn((token: string, user: any) => {
        employeeToken = token;
        employeeUser = user;
      }),
      clearEmployeeSession: vi.fn(() => {
        employeeToken = null;
        employeeUser = null;
      })
    }
  };
});

describe('K-EMP-003: Automatic Privacy Reset & Memory Wiping Engine Suite', () => {
  let sessionStorageStore: Record<string, string> = {};
  let localStorageStore: Record<string, string> = {};
  let mockHistoryReplaceState: any;
  let mockWindowLocation: { href: string };

  const createMockTarget = () => {
    const listeners: Record<string, ((e?: any) => void)[]> = {};
    return {
      addEventListener: vi.fn((event: string, handler: (e?: any) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (e?: any) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      }),
      dispatch: (event: string) => {
        (listeners[event] || []).forEach((h) => h({ type: event }));
      },
      _getListeners: () => listeners
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionStorageStore = {};
    localStorageStore = {};

    // Mock sessionStorage
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: {
        getItem: vi.fn((k: string) => sessionStorageStore[k] ?? null),
        setItem: vi.fn((k: string, v: string) => {
          sessionStorageStore[k] = String(v);
        }),
        removeItem: vi.fn((k: string) => {
          delete sessionStorageStore[k];
        }),
        clear: vi.fn(() => {
          sessionStorageStore = {};
        })
      },
      writable: true,
      configurable: true
    });

    // Mock localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn((k: string) => localStorageStore[k] ?? null),
        setItem: vi.fn((k: string, v: string) => {
          localStorageStore[k] = String(v);
        }),
        removeItem: vi.fn((k: string) => {
          delete localStorageStore[k];
        }),
        clear: vi.fn(() => {
          localStorageStore = {};
        })
      },
      writable: true,
      configurable: true
    });

    // Mock window.history
    mockHistoryReplaceState = vi.fn();
    Object.defineProperty(globalThis, 'history', {
      value: {
        replaceState: mockHistoryReplaceState
      },
      writable: true,
      configurable: true
    });

    // Mock window.location
    mockWindowLocation = { href: '/kiosk/play/journey-123' };
    Object.defineProperty(globalThis, 'location', {
      value: mockWindowLocation,
      writable: true,
      configurable: true
    });

    // Mock document
    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelectorAll: vi.fn(() => [])
      },
      writable: true,
      configurable: true
    });

    // Mock window
    Object.defineProperty(globalThis, 'window', {
      value: {
        history: { replaceState: mockHistoryReplaceState },
        location: mockWindowLocation,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    privacyResetService.stopMonitoring();
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. Acceptance Criteria 1: Inactive Terminal Triggers 15s Countdown Modal
  // =========================================================================
  describe('Acceptance Criteria 1: Idle Timeout Detection & Warning Modal Trigger', () => {
    it('monitors all required DOM events: touchstart, click, mousemove, keydown', () => {
      expect(MONITORED_DOM_EVENTS).toEqual(['touchstart', 'click', 'mousemove', 'keydown']);

      const mockTarget = createMockTarget();
      const service = new PrivacyResetService();

      service.startMonitoring({
        targetElement: mockTarget as any,
        idleTimeoutSeconds: 60
      });

      MONITORED_DOM_EVENTS.forEach((evt) => {
        expect(mockTarget.addEventListener).toHaveBeenCalledWith(
          evt,
          expect.any(Function),
          { passive: true }
        );
      });

      service.stopMonitoring();

      MONITORED_DOM_EVENTS.forEach((evt) => {
        expect(mockTarget.removeEventListener).toHaveBeenCalledWith(
          evt,
          expect.any(Function)
        );
      });
    });

    it('triggers onWarningStart with 15-second countdown after 60s of inactivity', () => {
      const mockTarget = createMockTarget();
      const onWarningStartSpy = vi.fn();
      const onWarningTickSpy = vi.fn();

      // Frontline worker logs in
      deviceIdentityService.setEmployeeSession('mock-jwt-worker-token', {
        id: 'worker-007',
        name: 'Alex Chen',
        badgeId: 'BADGE-445'
      });

      const service = new PrivacyResetService({
        idleTimeoutSeconds: 60,
        warningDurationSeconds: 15,
        targetElement: mockTarget as any,
        onWarningStart: onWarningStartSpy,
        onWarningTick: onWarningTickSpy
      });

      service.startMonitoring();

      // Advance 30s (halfway through idle timeout)
      vi.advanceTimersByTime(30000);
      expect(onWarningStartSpy).not.toHaveBeenCalled();
      expect(service.getIsWarningActive()).toBe(false);

      // Advance remaining 30s (total 60s idle)
      vi.advanceTimersByTime(30000);
      expect(onWarningStartSpy).toHaveBeenCalledTimes(1);
      expect(onWarningStartSpy).toHaveBeenCalledWith(15);
      expect(service.getIsWarningActive()).toBe(true);

      service.stopMonitoring();
    });

    it('resets idle timer when touch or key activity occurs before timeout expires', () => {
      const mockTarget = createMockTarget();
      const onWarningStartSpy = vi.fn();

      const service = new PrivacyResetService({
        idleTimeoutSeconds: 60,
        warningDurationSeconds: 15,
        targetElement: mockTarget as any,
        onWarningStart: onWarningStartSpy
      });

      service.startMonitoring();

      // User interacts after 45s of idle
      vi.advanceTimersByTime(45000);
      expect(onWarningStartSpy).not.toHaveBeenCalled();

      // User touches the screen
      mockTarget.dispatch('touchstart');

      // Advance another 45s (90s total, but only 45s since last interaction)
      vi.advanceTimersByTime(45000);
      expect(onWarningStartSpy).not.toHaveBeenCalled();

      // Advance final 15s to reach 60s since touch activity
      vi.advanceTimersByTime(15000);
      expect(onWarningStartSpy).toHaveBeenCalledTimes(1);

      service.stopMonitoring();
    });
  });

  // =========================================================================
  // 2. Acceptance Criteria 3: Employee Taps "Still Here"
  // =========================================================================
  describe('Acceptance Criteria 3: Employee Tapping "Still Here" Cancels Warning & Restarts Idle Timer', () => {
    it('cancels countdown, invokes onWarningDismissed, and restarts idle timer when dismissWarning is called', () => {
      const mockTarget = createMockTarget();
      const onWarningStartSpy = vi.fn();
      const onWarningDismissedSpy = vi.fn();
      const onWarningTickSpy = vi.fn();

      const service = new PrivacyResetService({
        idleTimeoutSeconds: 60,
        warningDurationSeconds: 15,
        targetElement: mockTarget as any,
        onWarningStart: onWarningStartSpy,
        onWarningTick: onWarningTickSpy,
        onWarningDismissed: onWarningDismissedSpy
      });

      service.startMonitoring();

      // Reach 60s idle -> countdown modal appears
      vi.advanceTimersByTime(60000);
      expect(onWarningStartSpy).toHaveBeenCalledTimes(1);
      expect(service.getIsWarningActive()).toBe(true);

      // Countdown advances 5 seconds (10s remaining)
      vi.advanceTimersByTime(5000);
      expect(onWarningTickSpy).toHaveBeenCalled();
      expect(service.getRemainingSeconds()).toBe(10);

      // Employee taps "Still Here"
      service.dismissWarning();
      expect(service.getIsWarningActive()).toBe(false);
      expect(onWarningDismissedSpy).toHaveBeenCalledTimes(1);

      // Verify countdown is cleared and idle timer restarts: advance 30s (should not warn)
      vi.advanceTimersByTime(30000);
      expect(onWarningStartSpy).toHaveBeenCalledTimes(1); // Still 1

      // Advance another 30s (total 60s since "Still Here" tapped)
      vi.advanceTimersByTime(30000);
      expect(onWarningStartSpy).toHaveBeenCalledTimes(2); // Second warning triggered

      service.stopMonitoring();
    });
  });

  // =========================================================================
  // 3. Acceptance Criteria 2: Countdown Reaches 0 & Automatic Memory Wipe
  // =========================================================================
  describe('Acceptance Criteria 2: Countdown Reaching 0 Wipes Memory & Navigates to Launcher', () => {
    it('terminates backend session (status: timed_out) upon countdown expiration', async () => {
      (kioskService.timeoutSession as any).mockResolvedValueOnce({
        _id: 'sess-active-888',
        status: 'timed_out'
      });

      // Verified frontline worker logged in
      deviceIdentityService.setEmployeeSession('worker-token-xyz-123', {
        id: 'usr_emp_456',
        badgeId: 'B-778',
        name: 'Sarah Connor'
      });
      expect(deviceIdentityService.getEmployeeToken()).toBe('worker-token-xyz-123');

      sessionStorageStore['active_form_step'] = '2';
      sessionStorageStore['worker_draft_answer'] = 'PPE checklist checked';
      localStorageStore['talnova_cached_form_inputs'] = JSON.stringify({ q1: 'A' });

      const onNavigateHomeSpy = vi.fn();
      const service = new PrivacyResetService({
        idleTimeoutSeconds: 60,
        warningDurationSeconds: 15,
        activeSessionId: 'sess-active-888',
        currentStepId: 'step-02',
        onNavigateHome: onNavigateHomeSpy
      });

      service.startMonitoring();

      // Trigger warning (60s)
      vi.advanceTimersByTime(60000);
      expect(service.getIsWarningActive()).toBe(true);

      // Countdown reaches 0 (15 seconds)
      await vi.advanceTimersByTimeAsync(15000);

      // 1. Backend session terminated with status timed_out
      expect(kioskService.timeoutSession).toHaveBeenCalledTimes(1);
      expect(kioskService.timeoutSession).toHaveBeenCalledWith('sess-active-888', {
        abortedStepId: 'step-02',
        reason: 'Idle timeout exceeded (Automatic Privacy Reset)'
      });

      // 2. Employee token and identity wiped from memory
      expect(deviceIdentityService.getEmployeeToken()).toBeNull();
      expect(deviceIdentityService.getEmployeeUser()).toBeNull();

      // 3. Browser session storage cleared
      expect(sessionStorage.clear).toHaveBeenCalled();
      expect(sessionStorageStore).toEqual({});

      // 4. Temporary cached form storage purged
      expect(localStorageStore['talnova_cached_form_inputs']).toBeUndefined();

      // 5. History stack replaced and terminal routed back to launcher
      expect(mockHistoryReplaceState).toHaveBeenCalledWith(null, '', '/kiosk/terminal');
      expect(onNavigateHomeSpy).toHaveBeenCalledTimes(1);

      service.stopMonitoring();
    });

    it('wipes DOM form inputs, checkboxes, and textareas during privacy reset', async () => {
      const service = new PrivacyResetService();

      // Set up simulated form elements in document
      const mockCheckbox = { checked: true, dispatchEvent: vi.fn() };
      const mockRadio = { checked: true, dispatchEvent: vi.fn() };
      const mockTextInput = { value: 'Secret employee SSN/ID', dispatchEvent: vi.fn() };
      const mockSelect = { selectedIndex: 3, dispatchEvent: vi.fn() };

      const querySelectorAllSpy = vi.spyOn(document, 'querySelectorAll').mockImplementation((selector: string) => {
        if (selector.startsWith('input[type="checkbox"]')) {
          return [mockCheckbox, mockRadio] as any;
        }
        if (selector.includes('select')) {
          return [mockSelect] as any;
        }
        return [mockTextInput] as any;
      });

      service.wipeFormInputs();

      expect(mockCheckbox.checked).toBe(false);
      expect(mockRadio.checked).toBe(false);
      expect(mockTextInput.value).toBe('');
      expect(mockSelect.selectedIndex).toBe(0);

      querySelectorAllSpy.mockRestore();
    });

    it('executes privacy wipe immediately when executePrivacyWipe is explicitly invoked', async () => {
      (kioskService.timeoutSession as any).mockResolvedValueOnce({
        _id: 'sess-active-999',
        status: 'timed_out'
      });

      deviceIdentityService.setEmployeeSession('worker-token-xyz', { id: 'usr-1' });
      const onNavigateHomeSpy = vi.fn();

      const service = new PrivacyResetService({
        activeSessionId: () => 'sess-active-999',
        currentStepId: () => 'step-01',
        onNavigateHome: onNavigateHomeSpy
      });

      await service.executePrivacyWipe({ reason: 'Worker tapped Exit Now' });

      expect(kioskService.timeoutSession).toHaveBeenCalledWith('sess-active-999', {
        abortedStepId: 'step-01',
        reason: 'Worker tapped Exit Now'
      });
      expect(deviceIdentityService.getEmployeeToken()).toBeNull();
      expect(onNavigateHomeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 4. PrivacyTimeoutModal Component Render & Interactivity
  // =========================================================================
  describe('PrivacyTimeoutModal Component UI', () => {
    it('renders the 15-second countdown warning modal with correct text and countdown display', () => {
      const onStaySpy = vi.fn();
      const onExitSpy = vi.fn();

      const html = renderToString(
        React.createElement(PrivacyTimeoutModal, {
          isOpen: true,
          remainingSeconds: 15,
          onStay: onStaySpy,
          onExit: onExitSpy
        })
      );

      // Container and accessibility attributes
      expect(html).toContain('data-testid="privacy-timeout-modal"');
      expect(html).toContain('role="alertdialog"');
      expect(html).toContain('aria-modal="true"');

      // Heading and description
      expect(html).toContain('Session timing out. Still here?');
      expect(html).toContain('For your privacy and security');

      // Countdown display
      expect(html).toContain('data-testid="privacy-countdown-timer"');
      expect(html).toContain('15s');

      // Compliance badge
      expect(html).toContain('GDPR / ISO 27001');

      // Action buttons
      expect(html).toContain('data-testid="btn-still-here"');
      expect(html).toContain('Still Here — Continue');
      expect(html).toContain('data-testid="btn-exit-now"');
      expect(html).toContain('Exit Now');
    });

    it('returns null when isOpen is false', () => {
      const html = renderToString(
        React.createElement(PrivacyTimeoutModal, {
          isOpen: false,
          remainingSeconds: 10,
          onStay: vi.fn(),
          onExit: vi.fn()
        })
      );

      expect(html).toBe('');
    });

    it('switches to urgent styling (rose) when remainingSeconds <= 5', () => {
      const htmlUrgent = renderToString(
        React.createElement(PrivacyTimeoutModal, {
          isOpen: true,
          remainingSeconds: 4,
          onStay: vi.fn(),
          onExit: vi.fn()
        })
      );

      expect(htmlUrgent).toContain('text-rose-400');
      expect(htmlUrgent).toContain('4s');
    });
  });
});
