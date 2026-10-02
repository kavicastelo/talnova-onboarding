/**
 * Talnova Kiosk Terminal - Watchdog & Diagnostic Logging Service (K-REL-001)
 *
 * Implements persistent local IndexedDB storage for terminal diagnostics,
 * crash loop detection (>2 crashes in 60s), and mid-session state checkpointing.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  KioskDiagnosticLogRecord,
  KioskSessionCheckpoint,
  KioskCrashResult
} from '../../../types/kiosk/diagnostic.types';
import { deviceIdentityService } from './device-identity.service';

export const WATCHDOG_DB_NAME = 'kiosk_diagnostics_store';
export const WATCHDOG_DB_VERSION = 1;

export const DEFAULT_CRASH_WINDOW_MS = 60 * 1000; // 60 seconds
export const DEFAULT_CRASH_THRESHOLD = 2; // >2 within 60s triggers crash loop protection

export interface KioskWatchdogDBSchema extends DBSchema {
  diagnostic_logs: {
    key: string;
    value: KioskDiagnosticLogRecord;
    indexes: {
      timestamp: number;
      terminalId: string;
      journeyId: string;
    };
  };
  session_checkpoints: {
    key: string; // journeyId
    value: KioskSessionCheckpoint;
    indexes: {
      timestamp: number;
    };
  };
}

// RFC 4122 UUIDv4 generator
function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class KioskWatchdogService {
  private dbPromise: Promise<IDBPDatabase<KioskWatchdogDBSchema>> | null = null;
  private crashTimestamps: number[] = [];

  constructor() {
    this.loadCrashTimestampsFromStorage();
  }

  private loadCrashTimestampsFromStorage(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const stored = window.sessionStorage.getItem('talnova_kiosk_crash_timestamps');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          this.crashTimestamps = parsed.filter((t) => typeof t === 'number' && now - t < DEFAULT_CRASH_WINDOW_MS);
        }
      }
    } catch {
      this.crashTimestamps = [];
    }
  }

  private persistCrashTimestampsToStorage(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.setItem('talnova_kiosk_crash_timestamps', JSON.stringify(this.crashTimestamps));
    } catch {
      // Ignore sessionStorage quota/security errors
    }
  }

  /**
   * Opens or returns the cached IndexedDB connection.
   */
  public async getDb(): Promise<IDBPDatabase<KioskWatchdogDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<KioskWatchdogDBSchema>(WATCHDOG_DB_NAME, WATCHDOG_DB_VERSION, {
        upgrade(db) {
          // 1. Diagnostic Logs Store
          if (!db.objectStoreNames.contains('diagnostic_logs')) {
            const logStore = db.createObjectStore('diagnostic_logs', { keyPath: 'id' });
            logStore.createIndex('timestamp', 'timestamp', { unique: false });
            logStore.createIndex('terminalId', 'terminalId', { unique: false });
            logStore.createIndex('journeyId', 'journeyId', { unique: false });
          }

          // 2. Session Checkpoints Store
          if (!db.objectStoreNames.contains('session_checkpoints')) {
            const checkpointStore = db.createObjectStore('session_checkpoints', { keyPath: 'journeyId' });
            checkpointStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        },
        terminated: () => {
          this.dbPromise = null;
        }
      });
    }
    return this.dbPromise;
  }

  /**
   * Closes the active database connection.
   */
  public async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }

  // ==========================================
  // 1. Crash Recording & Crash Loop Detection
  // ==========================================

  /**
   * Evaluates if repeated crashes have exceeded the threshold (>2 within 60s).
   */
  public isCrashLoop(
    windowMs = DEFAULT_CRASH_WINDOW_MS,
    threshold = DEFAULT_CRASH_THRESHOLD
  ): boolean {
    const now = Date.now();
    this.crashTimestamps = this.crashTimestamps.filter((t) => now - t <= windowMs);
    this.persistCrashTimestampsToStorage();
    return this.crashTimestamps.length > threshold;
  }

  /**
   * Returns current crash count within the specified window.
   */
  public getCrashCount(windowMs = DEFAULT_CRASH_WINDOW_MS): number {
    const now = Date.now();
    this.crashTimestamps = this.crashTimestamps.filter((t) => now - t <= windowMs);
    return this.crashTimestamps.length;
  }

  /**
   * Clears crash history timestamps (e.g. after clean return to home or in tests).
   */
  public resetCrashHistory(): void {
    this.crashTimestamps = [];
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem('talnova_kiosk_crash_timestamps');
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Captures an uncaught exception, persists diagnostic log to IndexedDB,
   * updates the crash window, and determines if crash loop protection triggers.
   */
  public async recordCrash(options: {
    error: any;
    errorInfo?: { componentStack?: string | null };
    terminalId?: string;
    activeStepIndex?: number | null;
    journeyId?: string | null;
    url?: string;
    windowMs?: number;
    threshold?: number;
    metadata?: Record<string, any>;
  }): Promise<KioskCrashResult> {
    const now = Date.now();
    const windowMs = options.windowMs ?? DEFAULT_CRASH_WINDOW_MS;
    const threshold = options.threshold ?? DEFAULT_CRASH_THRESHOLD;

    // 1. Register crash timestamp
    this.crashTimestamps.push(now);
    this.crashTimestamps = this.crashTimestamps.filter((t) => now - t <= windowMs);
    this.persistCrashTimestampsToStorage();

    const crashCount = this.crashTimestamps.length;
    const isCrashLoop = crashCount > threshold;

    // 2. Resolve terminal identity
    const terminalId =
      options.terminalId ||
      deviceIdentityService.getHardwareGuidSync() ||
      deviceIdentityService.getStoredDevice()?.deviceId ||
      'unknown-terminal';

    // 3. Format error details
    const err = options.error || {};
    const errorName = String(err.name || (err.constructor && err.constructor.name) || 'UnhandledException');
    const errorMessage = String(err.message || err.toString() || 'Unknown runtime error');
    const stackTrace = String(
      err.stack ||
      options.errorInfo?.componentStack ||
      (typeof err === 'string' ? err : 'No stack trace captured')
    );

    const logRecord: KioskDiagnosticLogRecord = {
      id: generateUUIDv4(),
      timestamp: now,
      terminalId,
      errorName,
      errorMessage,
      stackTrace,
      activeStepIndex: typeof options.activeStepIndex === 'number' ? options.activeStepIndex : null,
      journeyId: options.journeyId || null,
      url: options.url || (typeof window !== 'undefined' ? window.location?.href : undefined),
      crashCount,
      metadata: options.metadata
    };

    // 4. Save to IndexedDB
    try {
      const db = await this.getDb();
      await db.put('diagnostic_logs', logRecord);
    } catch (dbErr) {
      console.warn('[KioskWatchdog] Failed to save diagnostic record to IndexedDB:', dbErr);
    }

    return {
      isCrashLoop,
      crashCount,
      logRecord
    };
  }

  // ==========================================
  // 2. Mid-Session Checkpoint Management
  // ==========================================

  /**
   * Persists an active journey checkpoint (step index, tokens, progress) to IndexedDB.
   */
  public async saveCheckpoint(checkpoint: KioskSessionCheckpoint): Promise<void> {
    if (!checkpoint.journeyId) return;

    const record: KioskSessionCheckpoint = {
      ...checkpoint,
      timestamp: checkpoint.timestamp || Date.now()
    };

    try {
      const db = await this.getDb();
      await db.put('session_checkpoints', record);
    } catch (err) {
      console.warn('[KioskWatchdog] Failed to save session checkpoint to IndexedDB:', err);
    }

    // Secondary fallback in sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(
          `talnova_kiosk_cp_${checkpoint.journeyId}`,
          JSON.stringify(record)
        );
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Retrieves a checkpoint for a given journey ID.
   */
  public async getCheckpoint(journeyId: string): Promise<KioskSessionCheckpoint | null> {
    if (!journeyId) return null;

    try {
      const db = await this.getDb();
      const record = await db.get('session_checkpoints', journeyId);
      if (record) return record;
    } catch (err) {
      console.warn('[KioskWatchdog] Failed to read session checkpoint from IndexedDB:', err);
    }

    // Check sessionStorage fallback
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem(`talnova_kiosk_cp_${journeyId}`);
        if (stored) {
          return JSON.parse(stored) as KioskSessionCheckpoint;
        }
      } catch {
        // Ignore
      }
    }

    return null;
  }

  /**
   * Returns the most recent checkpoint across all journeys.
   */
  public async getLastCheckpoint(): Promise<KioskSessionCheckpoint | null> {
    try {
      const db = await this.getDb();
      const all = await db.getAll('session_checkpoints');
      if (all.length === 0) return null;
      all.sort((a, b) => b.timestamp - a.timestamp);
      return all[0];
    } catch (err) {
      console.warn('[KioskWatchdog] Failed to get latest checkpoint:', err);
      return null;
    }
  }

  /**
   * Purges corrupted or obsolete session checkpoint(s).
   * If journeyId is omitted, purges all session checkpoints.
   */
  public async purgeCheckpoint(journeyId?: string): Promise<void> {
    try {
      const db = await this.getDb();
      if (journeyId) {
        await db.delete('session_checkpoints', journeyId);
      } else {
        await db.clear('session_checkpoints');
      }
    } catch (err) {
      console.warn('[KioskWatchdog] Failed to delete session checkpoint from IndexedDB:', err);
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        if (journeyId) {
          window.sessionStorage.removeItem(`talnova_kiosk_cp_${journeyId}`);
        } else {
          for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
            const key = window.sessionStorage.key(i);
            if (key && key.startsWith('talnova_kiosk_cp_')) {
              window.sessionStorage.removeItem(key);
            }
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  // ==========================================
  // 3. Diagnostic Logs Retrieval & Maintenance
  // ==========================================

  /**
   * Retrieves recorded diagnostic logs from IndexedDB.
   */
  public async getDiagnosticLogs(terminalId?: string): Promise<KioskDiagnosticLogRecord[]> {
    try {
      const db = await this.getDb();
      let logs: KioskDiagnosticLogRecord[];
      if (terminalId) {
        logs = await db.getAllFromIndex('diagnostic_logs', 'terminalId', terminalId);
      } else {
        logs = await db.getAll('diagnostic_logs');
      }
      return logs.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      console.warn('[KioskWatchdog] Failed to retrieve diagnostic logs:', err);
      return [];
    }
  }

  /**
   * Clears all diagnostic logs.
   */
  public async clearDiagnosticLogs(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.clear('diagnostic_logs');
    } catch (err) {
      console.warn('[KioskWatchdog] Failed to clear diagnostic logs:', err);
    }
  }

  /**
   * Cleans all watchdog storage (logs and checkpoints).
   */
  public async clearAllStorage(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.clear('diagnostic_logs');
      await db.clear('session_checkpoints');
    } catch (err) {
      console.warn('[KioskWatchdog] Failed to clear watchdog storage:', err);
    }
    this.resetCrashHistory();
  }
}

export const kioskWatchdogService = new KioskWatchdogService();
export default kioskWatchdogService;
