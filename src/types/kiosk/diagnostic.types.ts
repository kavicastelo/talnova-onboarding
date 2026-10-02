/**
 * Talnova Kiosk Terminal - Diagnostic & Watchdog Reliability Types (K-REL-001)
 */

export interface KioskDiagnosticLogRecord {
  id: string; // Unique UUID
  timestamp: number; // Epoch milliseconds
  terminalId: string;
  errorName: string;
  errorMessage: string;
  stackTrace: string;
  activeStepIndex?: number | null;
  journeyId?: string | null;
  url?: string;
  crashCount?: number;
  metadata?: Record<string, any>;
}

export interface KioskSessionCheckpoint {
  journeyId: string;
  stepIndex: number;
  timestamp: number;
  terminalId?: string;
  sessionToken?: string;
  userId?: string | null;
  completedStepIds?: string[];
  metadata?: Record<string, any>;
}

export interface KioskCrashResult {
  isCrashLoop: boolean;
  crashCount: number;
  logRecord: KioskDiagnosticLogRecord;
}
