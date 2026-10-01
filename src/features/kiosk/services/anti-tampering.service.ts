/**
 * Talnova Kiosk Shell - Anti-Tampering & DOM Integrity Engine (K-SEC-003, ADR-007)
 *
 * Implements client-side defenses:
 * 1. MutationObserver Guard in player container: detects stripping of 'disabled',
 *    'hidden', or 'aria-disabled' properties on progression buttons and re-locks them.
 * 2. DOMPurify input sanitization for text and HTML content blocks.
 * 3. HMAC-SHA256 payload signing for step progression requests tied to client monotonic timers.
 */

import DOMPurify from 'dompurify';
import { computeHmacSha256 } from '../utils/hmac-sha256';

export interface TamperEvent {
  type: 'BUTTON_UNLOCK_ATTEMPT' | 'ATTRIBUTE_MUTATION' | 'DOM_INSERTION_ATTEMPT';
  target: HTMLElement;
  attributeName?: string;
  timestamp: number;
}

export interface AntiTamperingGuardOptions {
  /** Selector for protected progression elements (default: '#kiosk-btn-next, #kiosk-btn-finish, [data-tamper-guard="progression"]') */
  protectedSelector?: string;
  /** Function determining whether step progression is currently legitimately allowed */
  canProgress?: () => boolean;
  /** Callback fired whenever unauthorized manipulation is detected */
  onTamperDetected?: (event: TamperEvent) => void;
  /** Callback fired to reset step state upon tampering */
  onResetStepState?: () => void;
}

export interface StepProgressionData {
  sessionId: string;
  currentStepId: string;
  completedStepId?: string;
  completedStepIds?: string[];
  durationSeconds?: number;
  ppeItemsVerified?: string[];
  quizScore?: number;
}

export interface SignedStepProgressionPayload extends StepProgressionData {
  timestamp: number;
  sessionStartTime: number;
  monotonicElapsedMs: number;
  hmacSignature: string;
}

export class AntiTamperingService {
  private observer: MutationObserver | null = null;
  private tamperCount = 0;
  private observedContainer: HTMLElement | null = null;
  private currentOptions: AntiTamperingGuardOptions = {};

  // Monotonic timer registry per session
  private sessionTimers: Map<
    string,
    { startWallTime: number; startMonotonicMs: number }
  > = new Map();

  private defaultSecret = 'talnova-monotonic-integrity-secret-v1';

  /**
   * Initializes the client monotonic timer reference for a kiosk session
   */
  initSessionMonotonicTimer(sessionId: string): { startWallTime: number; startMonotonicMs: number } {
    const startWallTime = Date.now();
    const startMonotonicMs =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : startWallTime;

    const timer = { startWallTime, startMonotonicMs };
    this.sessionTimers.set(sessionId, timer);
    return timer;
  }

  /**
   * Returns elapsed monotonic milliseconds for an active session
   */
  getMonotonicElapsedMs(sessionId?: string): number {
    const timer = sessionId ? this.sessionTimers.get(sessionId) : null;
    const start = timer?.startMonotonicMs ?? 0;

    const currentMonotonic =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    return Math.max(0, currentMonotonic - start);
  }

  /**
   * Enforces immediate button lock by re-applying disabled attributes
   */
  enforceLock(element: HTMLElement): void {
    if (!element) return;
    try {
      element.setAttribute('disabled', 'true');
      (element as any).disabled = true;
      element.setAttribute('aria-disabled', 'true');
      element.setAttribute('data-tamper-enforced', 'true');
      element.classList.add('cursor-not-allowed', 'opacity-50');
    } catch (err) {
      console.warn('[AntiTampering] Error enforcing element lock:', err);
    }
  }

  /**
   * Checks if an element is a progression button
   */
  isProgressionElement(element: HTMLElement, selector?: string): boolean {
    if (!element) return false;

    if (element.id === 'kiosk-btn-next' || element.id === 'kiosk-btn-finish') {
      return true;
    }

    if (element.getAttribute?.('data-tamper-guard') === 'progression') {
      return true;
    }

    const defaultSelector = '#kiosk-btn-next, #kiosk-btn-finish, [data-tamper-guard="progression"]';
    if (element.matches && element.matches(selector || defaultSelector)) {
      return true;
    }

    return false;
  }

  /**
   * Starts DOM MutationObserver guard on the player container
   */
  startObserving(container: HTMLElement, options: AntiTamperingGuardOptions = {}): () => void {
    this.stopObserving();

    if (!container) {
      return () => {};
    }

    this.observedContainer = container;
    this.currentOptions = options;

    const MutationObserverClass =
      typeof MutationObserver !== 'undefined'
        ? MutationObserver
        : (globalThis as any).MutationObserver;

    if (!MutationObserverClass) {
      return () => {};
    }

    this.observer = new MutationObserverClass((mutations: MutationRecord[]) => {
      this.handleMutations(mutations);
    });

    if (this.observer) {
      this.observer.observe(container, {
        attributes: true,
        attributeFilter: ['disabled', 'aria-disabled', 'hidden', 'class', 'style'],
        subtree: true,
        childList: true
      });
    }

    return () => this.stopObserving();
  }

  getObservedContainer(): HTMLElement | null {
    return this.observedContainer;
  }

  /**
   * Mutation handler logic
   */
  handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement;
      if (!target || target.nodeType !== 1) continue;

      const isTargetProgression = this.isProgressionElement(
        target,
        this.currentOptions.protectedSelector
      );

      // Also check child elements if nodes were added
      if (!isTargetProgression && mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        for (const node of addedNodes) {
          if (node.nodeType === 1) {
            const el = node as HTMLElement;
            if (this.isProgressionElement(el, this.currentOptions.protectedSelector)) {
              this.verifyAndEnforceLock(el, 'childList');
            }
          }
        }
        continue;
      }

      if (isTargetProgression) {
        this.verifyAndEnforceLock(target, mutation.attributeName || mutation.type);
      }
    }
  }

  private verifyAndEnforceLock(element: HTMLElement, attributeName: string): void {
    const canProgress = this.currentOptions.canProgress ? this.currentOptions.canProgress() : false;

    // If step is NOT eligible to progress, button MUST be locked
    if (!canProgress) {
      const hasDisabledAttr = element.hasAttribute('disabled');
      const propDisabled = (element as any).disabled;
      const ariaDisabled = element.getAttribute('aria-disabled') === 'true';

      // Tampering occurred if disabled attribute was stripped or set to false
      if (!hasDisabledAttr || propDisabled === false || !ariaDisabled) {
        this.tamperCount++;
        this.enforceLock(element);

        const tamperEvent: TamperEvent = {
          type: 'BUTTON_UNLOCK_ATTEMPT',
          target: element,
          attributeName,
          timestamp: Date.now()
        };

        if (this.currentOptions.onTamperDetected) {
          this.currentOptions.onTamperDetected(tamperEvent);
        }

        if (this.currentOptions.onResetStepState) {
          this.currentOptions.onResetStepState();
        }
      }
    }
  }

  /**
   * Stops the MutationObserver
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.observedContainer = null;
    this.currentOptions = {};
  }

  isObserving(): boolean {
    return this.observer !== null;
  }

  getTamperCount(): number {
    return this.tamperCount;
  }

  resetTamperCount(): void {
    this.tamperCount = 0;
  }

  /**
   * Sanitizes all text and HTML block inputs using DOMPurify
   */
  sanitizeHtml(dirtyHtml: string): string {
    if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

    try {
      if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
        return DOMPurify.sanitize(dirtyHtml, {
          ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'a', 'p', 'span', 'ul', 'ol', 'li',
            'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'div'
          ],
          ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'rel', 'title', 'id'],
          ALLOW_DATA_ATTR: false
        });
      }
    } catch (err) {
      console.warn('[AntiTampering] DOMPurify sanitize warning, applying fallback:', err);
    }

    // Resilient fallback for non-DOM / headless test environments
    return dirtyHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(?:href|src)\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, '');
  }

  /**
   * Signs a step progression request with HMAC-SHA256 and monotonic timer metadata
   */
  signStepProgressionPayload(
    data: StepProgressionData,
    secretKey?: string
  ): SignedStepProgressionPayload {
    const key = secretKey || this.defaultSecret;
    let timer = this.sessionTimers.get(data.sessionId);

    if (!timer) {
      timer = this.initSessionMonotonicTimer(data.sessionId);
    }

    const currentMonotonic =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    const monotonicElapsedMs = Math.max(0, Math.round(currentMonotonic - timer.startMonotonicMs));
    const timestamp = Date.now();

    const canonicalMessage = [
      data.sessionId,
      data.currentStepId,
      data.completedStepId || '',
      monotonicElapsedMs,
      timestamp
    ].join(':');

    const hmacSignature = computeHmacSha256(key, canonicalMessage);

    return {
      ...data,
      timestamp,
      sessionStartTime: timer.startWallTime,
      monotonicElapsedMs,
      hmacSignature
    };
  }

  /**
   * Verifies an HMAC signature and monotonic timer drift for step progression
   */
  verifyStepProgressionPayload(
    payload: SignedStepProgressionPayload,
    secretKey?: string,
    maxDriftMs = 5000
  ): { valid: boolean; reason?: string } {
    if (!payload || !payload.hmacSignature) {
      return { valid: false, reason: 'MISSING_SIGNATURE' };
    }

    const key = secretKey || this.defaultSecret;

    // 1. Verify HMAC Signature
    const canonicalMessage = [
      payload.sessionId,
      payload.currentStepId,
      payload.completedStepId || '',
      payload.monotonicElapsedMs,
      payload.timestamp
    ].join(':');

    const expectedSignature = computeHmacSha256(key, canonicalMessage);
    if (expectedSignature !== payload.hmacSignature) {
      return { valid: false, reason: 'INVALID_HMAC_SIGNATURE' };
    }

    // 2. Monotonic Timer Verification (Prevent clock jumps / spoofing)
    if (payload.monotonicElapsedMs < 0) {
      return { valid: false, reason: 'NEGATIVE_MONOTONIC_TIME' };
    }

    if (payload.timestamp < payload.sessionStartTime) {
      return { valid: false, reason: 'TIMESTAMP_PRECEDES_SESSION_START' };
    }

    const wallClockElapsedMs = payload.timestamp - payload.sessionStartTime;
    const drift = Math.abs(wallClockElapsedMs - payload.monotonicElapsedMs);

    if (drift > maxDriftMs) {
      return {
        valid: false,
        reason: `MONOTONIC_DRIFT_EXCEEDED (drift: ${drift}ms > max: ${maxDriftMs}ms)`
      };
    }

    return { valid: true };
  }
}

export const antiTamperingService = new AntiTamperingService();
