import { useEffect } from 'react';

export interface UseKioskKeyboardNavigationOptions {
  /** Whether keyboard listeners are enabled (default: true) */
  enabled?: boolean;
  /** Whether advancing forward is permitted */
  canGoNext?: boolean;
  /** Whether navigating backward is permitted */
  canGoBack?: boolean;
  /** Callback when Next (ArrowRight / Space) is triggered */
  onNext?: () => void;
  /** Callback when Previous (ArrowLeft) is triggered */
  onPrev?: () => void;
  /** Callback when an indexed option (keys 1-9) is selected */
  onOptionSelect?: (optionIndex: number) => void;
  /** Callback when numeric key 1-9 is pressed (e.g. for PIN or keypad entry) */
  onDigitPress?: (digit: string) => void;
  /** Callback when Yes/No decision is active ('1' = true, '2' = false) */
  onYesNo?: (response: boolean) => void;
  /** Callback when Cancel / Escape is pressed while a modal is open */
  onCancelModal?: () => void;
  /** Whether any modal dialog or overlay is currently active */
  isModalOpen?: boolean;
}

export interface KioskKeyboardEventLike {
  key: string;
  target?: any;
  preventDefault?: () => void;
}

/**
 * Pure dispatcher for Kiosk Keyboard & Assistive Switch Events (K-ACC-003).
 */
export function handleKioskKeyboardEvent(
  e: KioskKeyboardEventLike,
  options: UseKioskKeyboardNavigationOptions
) {
  const target = e.target;
  const isInput = Boolean(
    target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
  );

  // Escape key: dismiss open modal dialog regardless of input focus
  if (e.key === 'Escape') {
    if (options.isModalOpen && options.onCancelModal) {
      e.preventDefault?.();
      options.onCancelModal();
      return;
    }
  }

  // If user is currently typing in an input element, do not intercept normal keystrokes
  if (isInput) {
    return;
  }

  // ArrowRight or Space: Advance to Next Step
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Spacebar') {
    if (options.onNext && options.canGoNext !== false) {
      e.preventDefault?.();
      options.onNext();
      return;
    }
  }

  // ArrowLeft: Return to Previous Step
  if (e.key === 'ArrowLeft') {
    if (options.onPrev && options.canGoBack !== false) {
      e.preventDefault?.();
      options.onPrev();
      return;
    }
  }

  // Numeric shortcuts 1-9 (Options, Yes/No, or PIN keypad)
  if (e.key >= '1' && e.key <= '9') {
    const digit = e.key;
    const optionIndex = parseInt(digit, 10) - 1;

    // If modal with PIN / keypad is open
    if (options.isModalOpen && options.onDigitPress) {
      e.preventDefault?.();
      options.onDigitPress(digit);
      return;
    }

    // If Yes/No decision step is active ('1' = Yes, '2' = No)
    if (options.onYesNo) {
      if (digit === '1') {
        e.preventDefault?.();
        options.onYesNo(true);
        return;
      } else if (digit === '2') {
        e.preventDefault?.();
        options.onYesNo(false);
        return;
      }
    }

    // If numbered options are selectable (quiz or choice list)
    if (options.onOptionSelect) {
      e.preventDefault?.();
      options.onOptionSelect(optionIndex);
      return;
    }

    // Otherwise pass digit press if handler exists
    if (options.onDigitPress) {
      e.preventDefault?.();
      options.onDigitPress(digit);
      return;
    }
  }
}

/**
 * Universal Assistive Switch Device & Keyboard Navigation Hook (K-ACC-003).
 *
 * Supported interactions:
 * - ArrowRight / Space: Advance to next step (or finish)
 * - ArrowLeft: Return to previous step
 * - 1-9: Select corresponding multiple-choice option, Yes/No decision, or enter PIN digit
 * - Escape: Cancel / close active modal dialog
 *
 * Ensures input field keystrokes are preserved during typing.
 */
export function useKioskKeyboardNavigation(options: UseKioskKeyboardNavigationOptions) {
  const {
    enabled = true,
    canGoNext = true,
    canGoBack = true,
    onNext,
    onPrev,
    onOptionSelect,
    onDigitPress,
    onYesNo,
    onCancelModal,
    isModalOpen = false
  } = options;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      handleKioskKeyboardEvent(e, {
        enabled,
        canGoNext,
        canGoBack,
        onNext,
        onPrev,
        onOptionSelect,
        onDigitPress,
        onYesNo,
        onCancelModal,
        isModalOpen
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    canGoNext,
    canGoBack,
    onNext,
    onPrev,
    onOptionSelect,
    onDigitPress,
    onYesNo,
    onCancelModal,
    isModalOpen
  ]);
}

export default useKioskKeyboardNavigation;
