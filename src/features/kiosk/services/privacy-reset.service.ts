/**
 * Talnova Kiosk Shell - Automatic Privacy Reset & Memory Wiping Engine (K-EMP-003, ADR-007)
 *
 * Enforces strict physical shared terminal hygiene under GDPR and ISO 27001 by
 * monitoring user idle timeouts, rendering a 15-second countdown warning modal,
 * terminating abandoned sessions with status 'timed_out', and purging all employee
 * PII, tokens, form inputs, and browser session storage before routing back to the
 * Multi-Journey Home Screen Launcher.
 */

import { deviceIdentityService } from './device-identity.service';
import { kioskService } from './kiosk.service';

export interface PrivacyResetConfig {
  /** Idle timeout duration before warning modal appears (default: 60 seconds) */
  idleTimeoutSeconds?: number;
  /** Duration of warning countdown modal (default: 15 seconds) */
  warningDurationSeconds?: number;
  /** Callback fired when idle timeout occurs and countdown begins */
  onWarningStart?: (countdownSeconds: number) => void;
  /** Callback fired every second during countdown */
  onWarningTick?: (secondsLeft: number) => void;
  /** Callback fired when user taps 'Still Here' and cancels countdown */
  onWarningDismissed?: () => void;
  /** Callback fired when session wipe is triggered */
  onTimeoutExpired?: () => Promise<void> | void;
  /** Custom navigation callback to route back to home launcher */
  onNavigateHome?: () => void;
  /** DOM element to listen for activity (defaults to window/document) */
  targetElement?: HTMLElement | Document | Window | null;
  /** Active session ID or getter */
  activeSessionId?: string | null | (() => string | null);
  /** Current step ID or getter */
  currentStepId?: string | null | (() => string | null);
}

export const MONITORED_DOM_EVENTS = ['touchstart', 'click', 'mousemove', 'keydown'] as const;

export class PrivacyResetService {
  private config: Required<
    Pick<PrivacyResetConfig, 'idleTimeoutSeconds' | 'warningDurationSeconds'>
  > &
    Omit<PrivacyResetConfig, 'idleTimeoutSeconds' | 'warningDurationSeconds'>;

  private idleTimeoutId: NodeJS.Timeout | null = null;
  private countdownIntervalId: NodeJS.Timeout | null = null;
  private isWarningActive = false;
  private remainingSeconds = 15;
  private isMonitoring = false;
  private lastActivityTimestamp = 0;
  private targetNode: HTMLElement | Document | Window | null = null;

  constructor(initialConfig: PrivacyResetConfig = {}) {
    this.config = {
      idleTimeoutSeconds: initialConfig.idleTimeoutSeconds ?? 60,
      warningDurationSeconds: initialConfig.warningDurationSeconds ?? 15,
      ...initialConfig
    };
    this.remainingSeconds = this.config.warningDurationSeconds;
  }

  /**
   * Activity event listener attached to DOM
   */
  private handleActivity = () => {
    // If the 15-second countdown warning is currently active, ignore generic activity
    // (user must explicitly tap 'Still Here' / call dismissWarning)
    if (this.isWarningActive) {
      return;
    }

    const now = Date.now();
    // Throttle frequent events like mousemove
    if (now - this.lastActivityTimestamp < 250) {
      return;
    }
    this.lastActivityTimestamp = now;
    this.resetIdleTimer();
  };

  /**
   * Start listening for user touch, click, keydown, and mouse activity.
   */
  startMonitoring(options: PrivacyResetConfig = {}): void {
    this.stopMonitoring();

    this.config = {
      ...this.config,
      ...options,
      idleTimeoutSeconds: options.idleTimeoutSeconds ?? this.config.idleTimeoutSeconds ?? 60,
      warningDurationSeconds: options.warningDurationSeconds ?? this.config.warningDurationSeconds ?? 15
    };

    this.remainingSeconds = this.config.warningDurationSeconds;
    this.isWarningActive = false;
    this.isMonitoring = true;
    this.lastActivityTimestamp = Date.now();

    // Attach DOM event listeners
    const target = this.config.targetElement || (typeof window !== 'undefined' ? window : null);
    if (target && typeof target.addEventListener === 'function') {
      this.targetNode = target;
      MONITORED_DOM_EVENTS.forEach((evt) => {
        this.targetNode?.addEventListener(evt, this.handleActivity as EventListener, {
          passive: true
        });
      });
    }

    this.resetIdleTimer();
  }

  /**
   * Reset idle timeout countdown
   */
  resetIdleTimer(): void {
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }

    if (!this.isMonitoring) return;

    const timeoutMs = Math.max(1, this.config.idleTimeoutSeconds) * 1000;
    this.idleTimeoutId = setTimeout(() => {
      this.triggerWarning();
    }, timeoutMs);
  }

  /**
   * Trigger the 15-second visual countdown warning
   */
  private triggerWarning(): void {
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }

    this.isWarningActive = true;
    this.remainingSeconds = this.config.warningDurationSeconds;
    this.config.onWarningStart?.(this.remainingSeconds);

    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
    }

    this.countdownIntervalId = setInterval(() => {
      this.remainingSeconds -= 1;
      this.config.onWarningTick?.(this.remainingSeconds);

      if (this.remainingSeconds <= 0) {
        if (this.countdownIntervalId) {
          clearInterval(this.countdownIntervalId);
          this.countdownIntervalId = null;
        }
        this.isWarningActive = false;
        this.executePrivacyWipe();
      }
    }, 1000);
  }

  /**
   * Dismiss the countdown warning when user taps 'Still Here'.
   * Restarts the idle timer from scratch.
   */
  dismissWarning(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }

    this.isWarningActive = false;
    this.remainingSeconds = this.config.warningDurationSeconds;
    this.config.onWarningDismissed?.();
    this.resetIdleTimer();
  }

  /**
   * Execute full automatic privacy reset and memory wiping:
   * 1. Terminate active backend session (status: 'timed_out').
   * 2. Wipe employee session token and details from memory.
   * 3. Reset all form inputs, checkboxes, and quiz selections.
   * 4. Clear browser session storage and navigation history.
   * 5. Route terminal back to Multi-Journey Home Screen Launcher.
   */
  async executePrivacyWipe(options?: {
    abortedStepId?: string;
    reason?: string;
    navigate?: boolean;
  }): Promise<void> {
    this.stopMonitoring();

    const sessionId =
      typeof this.config.activeSessionId === 'function'
        ? this.config.activeSessionId()
        : this.config.activeSessionId;

    const stepId =
      options?.abortedStepId ||
      (typeof this.config.currentStepId === 'function'
        ? this.config.currentStepId()
        : this.config.currentStepId);

    // 1. Terminate backend session with status 'timed_out'
    if (sessionId) {
      try {
        await kioskService.timeoutSession(sessionId, {
          abortedStepId: stepId || undefined,
          reason: options?.reason || 'Idle timeout exceeded (Automatic Privacy Reset)'
        });
      } catch (err) {
        console.warn('Privacy reset backend session termination warning:', err);
      }
    }

    // Call onTimeoutExpired callback if provided (e.g. from React context)
    try {
      await this.config.onTimeoutExpired?.();
    } catch (err) {
      console.warn('onTimeoutExpired callback error:', err);
    }

    // 2. Wipe employee session token from React state and memory
    deviceIdentityService.clearEmployeeSession();

    // 3. Reset all form inputs, checkboxes, and quiz selections in DOM
    this.wipeFormInputs();

    // 4. Clear browser session storage and navigation history stack
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
    }

    // Purge any temporary cached form data in localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('talnova_cached_form_inputs');
        localStorage.removeItem('talnova_active_quiz_answers');
      } catch {
        // ignore
      }
    }

    // Replace navigation history state so 'back' button cannot reload confidential screens
    const historyObj =
      typeof window !== 'undefined' && window.history
        ? window.history
        : typeof history !== 'undefined'
        ? history
        : null;
    if (historyObj && typeof historyObj.replaceState === 'function') {
      try {
        historyObj.replaceState(null, '', '/kiosk/terminal');
      } catch {
        // ignore
      }
    }

    // 5. Route terminal back to the Multi-Journey Home Screen Launcher
    if (options?.navigate !== false) {
      if (typeof this.config.onNavigateHome === 'function') {
        this.config.onNavigateHome();
      } else if (typeof window !== 'undefined' && window.location) {
        // Fallback standard kiosk routing
        window.location.href = '/kiosk/terminal';
      }
    }
  }

  /**
   * Reset all form elements, checkboxes, radio buttons, and text fields in DOM
   */
  wipeFormInputs(): void {
    if (typeof document === 'undefined') return;

    try {
      // Uncheck checkboxes and radio buttons
      const checkables = document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"], input[type="radio"]'
      );
      checkables.forEach((el) => {
        el.checked = false;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Clear text inputs, password fields, numbers, search
      const textInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea'
      );
      textInputs.forEach((el) => {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Reset selects to first option
      const selects = document.querySelectorAll<HTMLSelectElement>('select');
      selects.forEach((el) => {
        el.selectedIndex = 0;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    } catch (err) {
      console.warn('Wipe form inputs error:', err);
    }
  }

  /**
   * Stop monitoring and cleanup all timers and DOM event listeners
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.isWarningActive = false;

    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }

    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }

    if (this.targetNode) {
      MONITORED_DOM_EVENTS.forEach((evt) => {
        this.targetNode?.removeEventListener(evt, this.handleActivity as EventListener);
      });
      this.targetNode = null;
    }
  }

  // --- Getters for inspection and testing ---
  getIsWarningActive(): boolean {
    return this.isWarningActive;
  }

  getRemainingSeconds(): number {
    return this.remainingSeconds;
  }

  getIsMonitoring(): boolean {
    return this.isMonitoring;
  }

  getIdleTimeoutSeconds(): number {
    return this.config.idleTimeoutSeconds;
  }
}

export const privacyResetService = new PrivacyResetService();
