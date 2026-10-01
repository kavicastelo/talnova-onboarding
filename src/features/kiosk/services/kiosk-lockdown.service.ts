/**
 * Talnova Kiosk Shell - Browser Kiosk Lockdown Service (K-SEC-002, ADR-007)
 *
 * Implements client-side browser kiosk lockdown controls:
 * 1. Fullscreen API enforcement with auto-trigger on first interaction
 * 2. Fullscreen exit detection with "Touch screen to re-enter kiosk mode" prompt
 * 3. Destructive keyboard shortcut interception (F11, F12, Ctrl+Shift+I, Ctrl+R, Alt+F4, Ctrl+W, etc.)
 * 4. Context menu suppression on right-click or long-press
 * 5. Administrative Exit PIN protection (6-digit verification)
 */

export interface KioskLockdownState {
  isActive: boolean;
  isFullscreen: boolean;
  isReenterPromptVisible: boolean;
}

export interface KioskLockdownOptions {
  /** Target root element for fullscreen (default: document.documentElement) */
  targetElement?: HTMLElement | null;
  /** Whether to automatically prompt to re-enter fullscreen if exited (default: true) */
  autoPromptReenter?: boolean;
  /** Custom 6-digit Exit PIN or validator */
  exitPin?: string;
  /** Custom exit PIN validator callback */
  onVerifyExitPin?: (enteredPin: string) => Promise<boolean> | boolean;
  /** State change listener callback */
  onStateChange?: (state: KioskLockdownState) => void;
  /** Element or window to bind keyboard/contextmenu listeners to (default: document) */
  eventTarget?: Document | Window | HTMLElement | null;
}

export const DESTRUCTIVE_SHORTCUTS = [
  'F11',
  'F12',
  'Alt+F4',
  'Ctrl+R',
  'Ctrl+Shift+R',
  'Ctrl+W',
  'Ctrl+Shift+I',
  'Ctrl+Shift+J',
  'Ctrl+Shift+C',
  'Ctrl+U',
  'Ctrl+P',
  'Ctrl+S'
] as const;

export class KioskLockdownService {
  private isActive = false;
  private isFullscreenState = false;
  private isReenterPromptVisible = false;
  private options: KioskLockdownOptions = {
    autoPromptReenter: true
  };

  private listeners: Set<(state: KioskLockdownState) => void> = new Set();
  private interactionCleanupFns: (() => void)[] = [];
  private attachedTarget: Document | Window | HTMLElement | null = null;
  private boundContextMenuHandler: ((e: MouseEvent | Event) => void) | null = null;
  private boundKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private boundFullscreenChangeHandler: (() => void) | null = null;

  constructor(options: KioskLockdownOptions = {}) {
    this.options = {
      autoPromptReenter: true,
      ...options
    };
  }

  /**
   * Current lockdown state snapshot
   */
  getState(): KioskLockdownState {
    return {
      isActive: this.isActive,
      isFullscreen: this.isFullscreen(),
      isReenterPromptVisible: this.isReenterPromptVisible
    };
  }

  /**
   * Subscribe to lockdown state changes
   */
  subscribe(listener: (state: KioskLockdownState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.isFullscreenState = state.isFullscreen;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in kiosk lockdown state listener:', err);
      }
    }
    if (this.options.onStateChange) {
      this.options.onStateChange(state);
    }
  }

  /**
   * Checks whether the browser is currently in fullscreen mode
   */
  isFullscreen(): boolean {
    if (typeof document !== 'undefined') {
      const doc = document as any;
      if (
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      ) {
        return true;
      }
    }
    return this.isFullscreenState;
  }

  /**
   * Triggers fullscreen mode on the target element or document element
   */
  async requestFullscreen(targetElement?: Element | null): Promise<boolean> {
    const elem = (targetElement ||
      this.options.targetElement ||
      (typeof document !== 'undefined' ? document.documentElement : null)) as any;

    if (!elem) return false;

    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      } else {
        return false;
      }

      this.isFullscreenState = true;
      this.isReenterPromptVisible = false;
      this.notify();
      return true;
    } catch (err) {
      // Browsers reject if not initiated by a user gesture or if denied by policy
      console.warn('Unable to enter fullscreen mode:', err);
      return false;
    }
  }

  /**
   * Exits fullscreen mode if active
   */
  async exitFullscreen(): Promise<boolean> {
    const doc =
      (this.attachedTarget as any)?.ownerDocument ||
      (typeof document !== 'undefined' ? document : null);

    if (!doc) {
      this.isFullscreenState = false;
      this.notify();
      return true;
    }

    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
      this.isFullscreenState = false;
      this.notify();
      return true;
    } catch (err) {
      console.warn('Unable to exit fullscreen mode:', err);
      return false;
    }
  }

  /**
   * Suppresses context menu on right click or long press
   */
  suppressContextMenu = (e: MouseEvent | Event): void => {
    e.preventDefault();
    if (typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
  };

  /**
   * Determines if a keyboard event corresponds to a destructive shortcut
   */
  isDestructiveShortcut(e: KeyboardEvent): boolean {
    const key = e.key;
    const code = e.code;
    const ctrlOrMeta = Boolean(e.ctrlKey || e.metaKey);
    const shift = Boolean(e.shiftKey);
    const alt = Boolean(e.altKey);

    // F11 (Fullscreen toggle)
    if (key === 'F11' || code === 'F11') return true;

    // F12 (DevTools)
    if (key === 'F12' || code === 'F12') return true;

    // Alt+F4 (Close window)
    if (alt && (key === 'F4' || code === 'F4')) return true;

    // DevTools Inspector / Console / Elements: Ctrl+Shift+I / J / C
    if (ctrlOrMeta && shift && (key === 'I' || key === 'i' || key === 'J' || key === 'j' || key === 'C' || key === 'c')) {
      return true;
    }

    // Page Reload: Ctrl+R, Ctrl+Shift+R, F5, Ctrl+F5
    if (ctrlOrMeta && (key === 'r' || key === 'R')) return true;
    if (key === 'F5' || code === 'F5') return true;

    // Close Tab / Window: Ctrl+W, Ctrl+Q
    if (ctrlOrMeta && (key === 'w' || key === 'W' || key === 'q' || key === 'Q')) return true;

    // View Source: Ctrl+U
    if (ctrlOrMeta && (key === 'u' || key === 'U')) return true;

    // Print: Ctrl+P
    if (ctrlOrMeta && (key === 'p' || key === 'P')) return true;

    // Save: Ctrl+S
    if (ctrlOrMeta && (key === 's' || key === 'S')) return true;

    // History navigation: Alt+Left, Alt+Right
    if (alt && (key === 'ArrowLeft' || key === 'ArrowRight')) return true;

    return false;
  }

  /**
   * Intercepts destructive keystrokes
   */
  interceptKeyboardShortcuts = (e: KeyboardEvent): void => {
    if (this.isDestructiveShortcut(e)) {
      e.preventDefault();
      if (typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
    }
  };

  /**
   * Handles fullscreen change events across vendor implementations
   */
  handleFullscreenChange = (): void => {
    const isNowFullscreen = this.isFullscreen();
    this.isFullscreenState = isNowFullscreen;

    if (!isNowFullscreen && this.isActive && this.options.autoPromptReenter !== false) {
      this.isReenterPromptVisible = true;
    } else if (isNowFullscreen) {
      this.isReenterPromptVisible = false;
    }

    this.notify();
  };

  /**
   * Starts browser lockdown:
   * - Enforces fullscreen on first interaction
   * - Listens for fullscreen exit and triggers re-enter modal
   * - Traps destructive shortcuts
   * - Suppresses context menu
   */
  startLockdown(options?: KioskLockdownOptions): void {
    this.stopLockdown();

    if (options) {
      this.options = { ...this.options, ...options };
    }

    this.isActive = true;
    this.isFullscreenState = this.isFullscreen();
    this.isReenterPromptVisible = false;

    const target = this.options.eventTarget || (typeof document !== 'undefined' ? document : null);
    if (!target) {
      this.notify();
      return;
    }

    this.attachedTarget = target;

    // 1. Context Menu Suppression
    this.boundContextMenuHandler = this.suppressContextMenu;
    target.addEventListener('contextmenu', this.boundContextMenuHandler as any, { capture: true });

    // 2. Destructive Shortcut Interception
    this.boundKeydownHandler = this.interceptKeyboardShortcuts;
    target.addEventListener('keydown', this.boundKeydownHandler as any, { capture: true });

    // 3. Fullscreen Change Detection
    this.boundFullscreenChangeHandler = this.handleFullscreenChange;
    const fullscreenEvents = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];
    if (typeof document !== 'undefined') {
      for (const evt of fullscreenEvents) {
        document.addEventListener(evt, this.boundFullscreenChangeHandler);
      }
    }

    // 4. First interaction listener to trigger fullscreen
    this.setupFirstInteractionFullscreen();

    this.notify();
  }

  /**
   * Binds one-time user interaction listeners to enter fullscreen
   */
  private setupFirstInteractionFullscreen(): void {
    const target = this.attachedTarget || (typeof document !== 'undefined' ? document : null);
    if (!target) return;

    // If already in fullscreen, do not attach one-time gesture listeners
    if (this.isFullscreen()) {
      return;
    }

    const interactionEvents = ['click', 'touchstart', 'pointerdown', 'keydown'] as const;
    const triggerFullscreen = async () => {
      if (!this.isActive) return;
      if (!this.isFullscreen()) {
        await this.requestFullscreen();
      }
      this.cleanupFirstInteractionListeners();
    };

    this.interactionCleanupFns = interactionEvents.map((event) => {
      const handler = () => {
        triggerFullscreen();
      };
      target.addEventListener(event, handler, { once: true, capture: true });
      return () => {
        target.removeEventListener(event, handler, { capture: true });
      };
    });
  }

  private cleanupFirstInteractionListeners(): void {
    for (const cleanup of this.interactionCleanupFns) {
      try {
        cleanup();
      } catch (err) {
        // Ignore cleanup error
      }
    }
    this.interactionCleanupFns = [];
  }

  /**
   * Stops lockdown and restores default browser behavior
   */
  stopLockdown(): void {
    this.isActive = false;
    this.isReenterPromptVisible = false;

    this.cleanupFirstInteractionListeners();

    if (this.attachedTarget) {
      if (this.boundContextMenuHandler) {
        this.attachedTarget.removeEventListener(
          'contextmenu',
          this.boundContextMenuHandler as any,
          { capture: true }
        );
      }
      if (this.boundKeydownHandler) {
        this.attachedTarget.removeEventListener(
          'keydown',
          this.boundKeydownHandler as any,
          { capture: true }
        );
      }
    }

    if (typeof document !== 'undefined' && this.boundFullscreenChangeHandler) {
      const fullscreenEvents = [
        'fullscreenchange',
        'webkitfullscreenchange',
        'mozfullscreenchange',
        'MSFullscreenChange'
      ];
      for (const evt of fullscreenEvents) {
        document.removeEventListener(evt, this.boundFullscreenChangeHandler);
      }
    }

    this.attachedTarget = null;
    this.boundContextMenuHandler = null;
    this.boundKeydownHandler = null;
    this.boundFullscreenChangeHandler = null;

    this.notify();
  }

  /**
   * Explicitly dismisses the "Touch screen to re-enter" prompt
   */
  dismissReenterPrompt(): void {
    this.isReenterPromptVisible = false;
    this.notify();
  }

  /**
   * Explicitly displays the "Touch screen to re-enter" prompt
   */
  showReenterPrompt(): void {
    this.isReenterPromptVisible = true;
    this.notify();
  }

  /**
   * Validates the 6-digit administrative Exit PIN code
   */
  async verifyExitPin(enteredPin: string, expectedPin?: string): Promise<boolean> {
    if (!enteredPin || enteredPin.length !== 6) {
      return false;
    }

    if (this.options.onVerifyExitPin) {
      return await this.options.onVerifyExitPin(enteredPin);
    }

    const targetPin = expectedPin || this.options.exitPin;
    if (targetPin) {
      return enteredPin === targetPin;
    }

    return false;
  }
}

export const kioskLockdownService = new KioskLockdownService();
