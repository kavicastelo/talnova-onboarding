/**
 * Talnova Kiosk Terminal - Power Failure & Sudden Reboot Recovery Types (K-REL-002)
 */

export interface KioskActiveSessionCheckpoint {
  id: string; // Typically 'current' or journey ID
  journeyId: string;
  journeyTitle?: string;
  stepIndex: number; // 0-indexed step progression (e.g. 4 for Step 5)
  stepTitle?: string;
  totalSteps?: number;
  completedStepIds?: string[];
  userId?: string | null;
  userDisplayName?: string | null;
  sessionToken?: string;
  sessionId?: string;
  timestamp: number; // Epoch milliseconds when checkpoint was saved
  expiresAt?: number; // Epoch milliseconds when checkpoint expires (15 min default)
}

export interface PowerRecoveryOptions {
  maxAgeMs?: number; // Default: 15 * 60 * 1000 (15 minutes)
  countdownSeconds?: number; // Default: 15 seconds
}
