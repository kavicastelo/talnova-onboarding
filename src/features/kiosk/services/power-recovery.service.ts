/**
 * Talnova Kiosk Terminal - Power Failure Recovery Service (K-REL-002)
 *
 * Implements persistent IndexedDB step checkpointing in 'active_session_checkpoint'
 * allowing workers to resume an interrupted training briefing upon hardware power
 * restoration within a 15-minute validity window.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { KioskActiveSessionCheckpoint } from '../../../types/kiosk/recovery.types';

export const RECOVERY_DB_NAME = 'kiosk_recovery_store';
export const RECOVERY_DB_VERSION = 1;
export const ACTIVE_CHECKPOINT_STORE = 'active_session_checkpoint';

// 15 minutes session resumption window (ADR-011, K-REL-002)
export const DEFAULT_CHECKPOINT_MAX_AGE_MS = 15 * 60 * 1000;
export const RESUME_PROMPT_COUNTDOWN_SECONDS = 15;

export interface KioskPowerRecoveryDBSchema extends DBSchema {
  active_session_checkpoint: {
    key: string;
    value: KioskActiveSessionCheckpoint;
    indexes: {
      timestamp: number;
      journeyId: string;
    };
  };
}

class PowerRecoveryService {
  private dbPromise: Promise<IDBPDatabase<KioskPowerRecoveryDBSchema>> | null = null;
  private readonly fallbackKey = 'talnova_kiosk_active_session_checkpoint';

  /**
   * Opens or returns the cached IndexedDB connection for power recovery.
   */
  public async getDb(): Promise<IDBPDatabase<KioskPowerRecoveryDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<KioskPowerRecoveryDBSchema>(RECOVERY_DB_NAME, RECOVERY_DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(ACTIVE_CHECKPOINT_STORE)) {
            const store = db.createObjectStore(ACTIVE_CHECKPOINT_STORE, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('journeyId', 'journeyId', { unique: false });
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

  /**
   * Automatically saves the current step progress checkpoint upon every step transition.
   */
  public async saveStepCheckpoint(
    checkpoint: Omit<KioskActiveSessionCheckpoint, 'id' | 'timestamp'> & {
      id?: string;
      timestamp?: number;
    }
  ): Promise<KioskActiveSessionCheckpoint> {
    const id = checkpoint.id || 'current';
    const timestamp = checkpoint.timestamp || Date.now();
    const expiresAt = timestamp + DEFAULT_CHECKPOINT_MAX_AGE_MS;

    const record: KioskActiveSessionCheckpoint = {
      ...checkpoint,
      id,
      timestamp,
      expiresAt
    };

    try {
      const db = await this.getDb();
      await db.put(ACTIVE_CHECKPOINT_STORE, record);
    } catch (err) {
      console.warn('[PowerRecovery] Failed to save step checkpoint to IndexedDB:', err);
    }

    // Mirror to local/session storage for synchronous retrieval during boot or environments without IndexedDB
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage) {
          window.localStorage.setItem(this.fallbackKey, JSON.stringify(record));
        }
        if (window.sessionStorage) {
          window.sessionStorage.setItem(this.fallbackKey, JSON.stringify(record));
        }
      } catch {
        // Storage quota / privacy mode fallback
      }
    }

    return record;
  }

  /**
   * Checks for an active checkpoint on boot.
   * If checkpoint exists and timestamp is <15 minutes old, returns the checkpoint.
   * If checkpoint is expired (>=15 minutes old), automatically purges it and returns null.
   */
  public async getActiveCheckpoint(
    maxAgeMs = DEFAULT_CHECKPOINT_MAX_AGE_MS
  ): Promise<KioskActiveSessionCheckpoint | null> {
    let checkpoint: KioskActiveSessionCheckpoint | null = null;

    try {
      const db = await this.getDb();
      const record = await db.get(ACTIVE_CHECKPOINT_STORE, 'current');
      if (record) {
        checkpoint = record;
      } else {
        // Check if any other checkpoint exists
        const all = await db.getAll(ACTIVE_CHECKPOINT_STORE);
        if (all.length > 0) {
          all.sort((a, b) => b.timestamp - a.timestamp);
          checkpoint = all[0];
        }
      }
    } catch (err) {
      console.warn('[PowerRecovery] Failed reading IndexedDB checkpoint, checking storage fallback:', err);
    }

    // Check storage fallback if IndexedDB is empty or failed
    if (!checkpoint && typeof window !== 'undefined') {
      try {
        const stored =
          window.sessionStorage?.getItem(this.fallbackKey) ||
          window.localStorage?.getItem(this.fallbackKey);
        if (stored) {
          checkpoint = JSON.parse(stored) as KioskActiveSessionCheckpoint;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (!checkpoint) {
      return null;
    }

    // Validate 15-minute expiration window
    const now = Date.now();
    const age = now - checkpoint.timestamp;

    if (age > maxAgeMs) {
      console.info(`[PowerRecovery] Checkpoint expired (age=${Math.round(age / 1000)}s > ${maxAgeMs / 1000}s). Purging...`);
      await this.purgeCheckpoint();
      return null;
    }

    return checkpoint;
  }

  /**
   * Checks if a given checkpoint is valid (<15 minutes old).
   */
  public isCheckpointValid(
    checkpoint: KioskActiveSessionCheckpoint | null,
    maxAgeMs = DEFAULT_CHECKPOINT_MAX_AGE_MS
  ): boolean {
    if (!checkpoint || !checkpoint.timestamp) return false;
    const age = Date.now() - checkpoint.timestamp;
    return age >= 0 && age < maxAgeMs;
  }

  /**
   * Purges the active session checkpoint from IndexedDB and storage.
   * Called upon countdown expiration, user cancellation, or normal session completion.
   */
  public async purgeCheckpoint(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.clear(ACTIVE_CHECKPOINT_STORE);
    } catch (err) {
      console.warn('[PowerRecovery] Failed to clear IndexedDB active_session_checkpoint:', err);
    }

    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem(this.fallbackKey);
        window.sessionStorage?.removeItem(this.fallbackKey);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Cleans all power recovery data (useful for test resets).
   */
  public async clearAllStorage(): Promise<void> {
    await this.purgeCheckpoint();
  }
}

export const powerRecoveryService = new PowerRecoveryService();
export default powerRecoveryService;
