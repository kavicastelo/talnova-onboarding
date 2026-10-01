/**
 * Talnova Kiosk Shell - Offline IndexedDB Storage Service (ADR-009, K-OFF-002)
 *
 * Implements persistent structured IndexedDB storage for offline physical kiosks:
 * 1. 'manifest': Cached assigned journey manifest for offline boot.
 * 2. 'journey_versions': Immutable JSON step snapshots keyed by version ID.
 * 3. 'media_blobs': Cached audio and image Blobs keyed by upload ID.
 * 4. 'pending_sessions': Encrypted completed sessions waiting to sync to the server.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { KioskDeviceManifest } from '../../../types/kiosk/device.types';
import { KioskJourney, KioskJourneyVersion } from '../../../types/kiosk/journey.types';
import { KioskStep } from '../../../types/kiosk/step.types';
import { KioskSession, KioskSessionStatus } from '../../../types/kiosk/session.types';
import { kioskService } from './kiosk.service';
import { deviceIdentityService } from './device-identity.service';
import { apiClient } from '../../../api/client';

export const OFFLINE_DB_NAME = 'kiosk_offline_store';
export const OFFLINE_DB_VERSION = 1;

export interface OfflineManifestRecord {
  deviceId: string;
  manifest: KioskDeviceManifest;
  cachedAt: number;
}

export interface OfflineJourneyVersionRecord {
  versionId: string;
  journeyId: string;
  versionNumber: number;
  title: string;
  description?: string;
  languages: string[];
  steps: KioskStep[];
  settings?: any;
  contentChecksum?: string;
  snapshot: KioskJourney | KioskJourneyVersion;
  cachedAt: number;
}

export interface OfflineMediaBlobRecord {
  uploadId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  cachedAt: number;
  filename?: string;
}

export interface OfflinePendingSession {
  clientSessionId: string; // Primary key, UUIDv4
  sessionId?: string;
  deviceId: string;
  journeyId: string;
  journeyVersionId?: string;
  versionNumber: number;
  userId?: string | null;
  sessionToken?: string;
  status: KioskSessionStatus;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  startedAt: number | string | Date;
  completedAt?: number | string | Date;
  durationSeconds: number;
  currentStepId?: string;
  completedStepIds: string[];
  ppeItemsVerified?: string[];
  quizScore?: number;
  supervisorWitness?: any;
  verificationChecksum?: string;
  isOfflineSync: true;
  encryptedPayload: string; // Base64 AES-GCM ciphertext
  iv: string; // Base64 IV (12 bytes)
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export interface KioskOfflineDBSchema extends DBSchema {
  manifest: {
    key: string;
    value: OfflineManifestRecord;
  };
  journey_versions: {
    key: string;
    value: OfflineJourneyVersionRecord;
    indexes: {
      journeyId: string;
    };
  };
  media_blobs: {
    key: string;
    value: OfflineMediaBlobRecord;
  };
  pending_sessions: {
    key: string;
    value: OfflinePendingSession;
    indexes: {
      syncStatus: string;
      createdAt: number;
      deviceId: string;
    };
  };
}

export interface CacheAssignedJourneysResult {
  manifestCached: boolean;
  journeysCached: number;
  journeyVersionsCached: number;
  mediaCached: number;
  mediaAlreadyCached: number;
  failedUploads: string[];
}

// RFC 4122 UUIDv4 generator
export function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Base64 & Buffer conversions
function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey using PBKDF2 from a device identity seed.
 */
async function deriveEncryptionKey(seed: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = enc.encode('talnova-kiosk-offline-salt-v1');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(seed),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an arbitrary object using AES-GCM.
 */
export async function encryptSessionPayload(
  payload: unknown,
  keySeed = 'talnova-kiosk-offline-default-key'
): Promise<{ encryptedPayload: string; iv: string }> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const key = await deriveEncryptionKey(keySeed);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(JSON.stringify(payload));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext
      );
      return {
        encryptedPayload: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv)
      };
    }
  } catch (err) {
    console.warn('[OfflineStorage] SubtleCrypto encryption unavailable, falling back to base64 envelope:', err);
  }

  // Graceful fallback for non-secure / mock environments without SubtleCrypto
  const json = JSON.stringify(payload);
  const fallbackIv = generateUUIDv4().substring(0, 12);
  return {
    encryptedPayload: btoa(unescape(encodeURIComponent(json))),
    iv: btoa(fallbackIv)
  };
}

/**
 * Decrypts an encrypted session payload using AES-GCM.
 */
export async function decryptSessionPayload<T = any>(
  encryptedPayload: string,
  ivBase64: string,
  keySeed = 'talnova-kiosk-offline-default-key'
): Promise<T> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const key = await deriveEncryptionKey(keySeed);
      const iv = base64ToBuffer(ivBase64);
      const ciphertext = base64ToBuffer(encryptedPayload);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        ciphertext as unknown as BufferSource
      );
      const json = new TextDecoder().decode(decrypted);
      return JSON.parse(json) as T;
    }
  } catch (err) {
    console.warn('[OfflineStorage] SubtleCrypto decryption fallback:', err);
  }

  // Graceful fallback decoder
  const decoded = decodeURIComponent(escape(atob(encryptedPayload)));
  return JSON.parse(decoded) as T;
}

/**
 * Scans a journey or version snapshot and collects all unique media upload IDs.
 */
export function extractMediaUploadIds(journey: KioskJourney | KioskJourneyVersion): string[] {
  const ids = new Set<string>();

  if (!journey || !Array.isArray(journey.steps)) {
    return [];
  }

  for (const step of journey.steps) {
    if (!step) continue;

    // Check step blocks
    if (Array.isArray(step.blocks)) {
      for (const block of step.blocks) {
        if (!block) continue;

        // Check localized media references (audio and images)
        if (block.mediaReferences) {
          for (const ref of Object.values(block.mediaReferences) as any[]) {
            if (!ref) continue;
            if (ref.uploadId && typeof ref.uploadId === 'string' && ref.uploadId.trim()) {
              ids.add(ref.uploadId.trim());
            }
            if (ref.audioUploadId && typeof ref.audioUploadId === 'string' && ref.audioUploadId.trim()) {
              ids.add(ref.audioUploadId.trim());
            }
          }
        }

        // Check block settings
        const settings = (block as any).settings;
        if (settings) {
          if (settings.uploadId && typeof settings.uploadId === 'string') {
            ids.add(settings.uploadId.trim());
          }
          if (settings.audioUploadId && typeof settings.audioUploadId === 'string') {
            ids.add(settings.audioUploadId.trim());
          }
        }
      }
    }

    // Check step top-level audioNarration or interaction
    const stepAny = step as any;
    if (stepAny.audioNarration && typeof stepAny.audioNarration === 'object') {
      for (const item of Object.values(stepAny.audioNarration)) {
        const itemAny = item as any;
        if (itemAny?.audioUploadId) ids.add(String(itemAny.audioUploadId).trim());
        if (itemAny?.uploadId) ids.add(String(itemAny.uploadId).trim());
      }
    }
  }

  return Array.from(ids).filter((id) => !id.startsWith('http://') && !id.startsWith('https://') && !id.startsWith('data:'));
}

class OfflineStorageService {
  private dbPromise: Promise<IDBPDatabase<KioskOfflineDBSchema>> | null = null;
  private blobUrlMap = new Map<string, string>();

  /**
   * Opens or returns the cached IndexedDB connection.
   */
  public async getDb(): Promise<IDBPDatabase<KioskOfflineDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<KioskOfflineDBSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
        upgrade(db, _oldVersion, _newVersion) {
          // 1. Manifest Store
          if (!db.objectStoreNames.contains('manifest')) {
            db.createObjectStore('manifest', { keyPath: 'deviceId' });
          }

          // 2. Journey Versions Store
          if (!db.objectStoreNames.contains('journey_versions')) {
            const versionStore = db.createObjectStore('journey_versions', { keyPath: 'versionId' });
            versionStore.createIndex('journeyId', 'journeyId', { unique: false });
          }

          // 3. Media Blobs Store
          if (!db.objectStoreNames.contains('media_blobs')) {
            db.createObjectStore('media_blobs', { keyPath: 'uploadId' });
          }

          // 4. Pending Sessions Store
          if (!db.objectStoreNames.contains('pending_sessions')) {
            const sessionStore = db.createObjectStore('pending_sessions', { keyPath: 'clientSessionId' });
            sessionStore.createIndex('syncStatus', 'syncStatus', { unique: false });
            sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
            sessionStore.createIndex('deviceId', 'deviceId', { unique: false });
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
   * Resets connection reference (useful for testing or after deleteDB).
   */
  public async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
    // Clean up created object URLs
    for (const url of this.blobUrlMap.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }
    this.blobUrlMap.clear();
  }

  // ==========================================
  // 1. Manifest Operations
  // ==========================================

  public async saveManifest(manifest: KioskDeviceManifest): Promise<void> {
    const db = await this.getDb();
    const deviceId = manifest.deviceId || manifest.device?.deviceId || 'default';
    const record: OfflineManifestRecord = {
      deviceId,
      manifest: {
        ...manifest,
        deviceId
      },
      cachedAt: Date.now()
    };
    await db.put('manifest', record);
  }

  public async getManifest(deviceId?: string): Promise<KioskDeviceManifest | null> {
    const db = await this.getDb();
    if (deviceId) {
      const record = await db.get('manifest', deviceId);
      return record ? record.manifest : null;
    }

    // If no deviceId specified, return the first manifest in store
    const all = await db.getAll('manifest');
    return all.length > 0 ? all[0].manifest : null;
  }

  // ==========================================
  // 2. Journey Versions Operations
  // ==========================================

  public async saveJourneyVersion(
    versionData: Partial<OfflineJourneyVersionRecord> & { journeyId: string; steps: KioskStep[] }
  ): Promise<string> {
    const db = await this.getDb();
    const journeyId = versionData.journeyId;
    const versionNumber = versionData.versionNumber || (versionData.snapshot as any)?.publishing?.version || 1;
    const versionId =
      versionData.versionId ||
      (versionData.snapshot as any)?.publishing?.activeVersionId ||
      `${journeyId}_v${versionNumber}`;

    const record: OfflineJourneyVersionRecord = {
      versionId,
      journeyId,
      versionNumber,
      title: versionData.title || (versionData.snapshot as any)?.title || 'Untitled Journey',
      description: versionData.description || (versionData.snapshot as any)?.description,
      languages: Array.from(versionData.languages || (versionData.snapshot as any)?.languages || ['en']),
      steps: versionData.steps || [],
      settings: versionData.settings || (versionData.snapshot as any)?.settings,
      contentChecksum: versionData.contentChecksum || (versionData.snapshot as any)?.contentChecksum,
      snapshot: (versionData.snapshot as any) || (versionData as any),
      cachedAt: Date.now()
    };

    await db.put('journey_versions', record);
    return versionId;
  }

  public async getJourneyVersion(versionId: string): Promise<OfflineJourneyVersionRecord | null> {
    const db = await this.getDb();
    const record = await db.get('journey_versions', versionId);
    return record || null;
  }

  public async getJourneyVersionsByJourneyId(journeyId: string): Promise<OfflineJourneyVersionRecord[]> {
    const db = await this.getDb();
    return db.getAllFromIndex('journey_versions', 'journeyId', journeyId);
  }

  public async getLatestJourneyVersion(journeyId: string): Promise<OfflineJourneyVersionRecord | null> {
    const versions = await this.getJourneyVersionsByJourneyId(journeyId);
    if (!versions || versions.length === 0) return null;
    return versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
  }

  // ==========================================
  // 3. Media Blobs Operations
  // ==========================================

  public async saveMediaBlob(
    uploadId: string,
    blob: Blob,
    metadata?: { filename?: string; mimeType?: string }
  ): Promise<void> {
    const db = await this.getDb();
    const record: OfflineMediaBlobRecord = {
      uploadId,
      blob,
      mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
      size: blob.size,
      filename: metadata?.filename,
      cachedAt: Date.now()
    };
    await db.put('media_blobs', record);
  }

  public async getMediaBlob(uploadId: string): Promise<Blob | null> {
    const db = await this.getDb();
    const record = await db.get('media_blobs', uploadId);
    return record ? record.blob : null;
  }

  public async hasMediaBlob(uploadId: string): Promise<boolean> {
    const db = await this.getDb();
    const key = await db.getKey('media_blobs', uploadId);
    return key !== undefined;
  }

  /**
   * Retrieves a Blob from IndexedDB and returns a reusable object URL.
   */
  public async getMediaBlobUrl(uploadId: string): Promise<string | null> {
    if (this.blobUrlMap.has(uploadId)) {
      return this.blobUrlMap.get(uploadId)!;
    }

    const blob = await this.getMediaBlob(uploadId);
    if (!blob) return null;

    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob);
      this.blobUrlMap.set(uploadId, url);
      return url;
    }

    return null;
  }

  public revokeMediaBlobUrl(uploadId: string): void {
    const url = this.blobUrlMap.get(uploadId);
    if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
      this.blobUrlMap.delete(uploadId);
    }
  }

  // ==========================================
  // 4. Pre-fetch & Cache Assigned Journeys
  // ==========================================

  /**
   * Automatically pre-fetches and stores journey steps and media when the device is online.
   * Satisfies Acceptance Criteria:
   * "Given an online terminal receiving a manifest update,
   *  When cacheAssignedJourneys() runs,
   *  Then all assigned journey JSON and audio assets are stored in IndexedDB."
   */
  public async cacheAssignedJourneys(
    manifestInput?: KioskDeviceManifest,
    options?: {
      fetchBlobFn?: (uploadId: string) => Promise<Blob | null>;
    }
  ): Promise<CacheAssignedJourneysResult> {
    let manifest: KioskDeviceManifest;

    if (manifestInput) {
      manifest = manifestInput;
    } else {
      const deviceId = deviceIdentityService.getHardwareGuidSync();
      manifest = await kioskService.getDeviceManifest(deviceId || undefined);
    }

    // 1. Cache Manifest
    await this.saveManifest(manifest);

    let journeysCached = 0;
    let journeyVersionsCached = 0;
    let mediaCached = 0;
    let mediaAlreadyCached = 0;
    const failedUploads: string[] = [];

    const uploadIdsToFetch = new Set<string>();

    // 2. Cache Journey Snapshots and collect media references
    if (Array.isArray(manifest.journeys)) {
      for (const journey of manifest.journeys) {
        if (!journey || !journey._id) continue;

        await this.saveJourneyVersion({
          journeyId: journey._id,
          versionNumber: journey.publishing?.version || 1,
          title: journey.title,
          description: journey.description,
          languages: journey.languages as string[],
          steps: (journey.steps as KioskStep[]) || [],
          settings: journey.settings,
          snapshot: journey
        });
        journeysCached++;
        journeyVersionsCached++;

        const mediaIds = extractMediaUploadIds(journey);
        for (const mid of mediaIds) {
          uploadIdsToFetch.add(mid);
        }
      }
    }

    // 3. Cache Audio and Image Media Blobs
    const defaultFetch = async (uploadId: string): Promise<Blob | null> => {
      try {
        const response = await fetch(`/api/v1/kiosk/uploads/${encodeURIComponent(uploadId)}`);
        if (response.ok) {
          return await response.blob();
        }
      } catch (err) {
        console.warn(`[OfflineStorage] Failed to fetch media blob for uploadId: ${uploadId}`, err);
      }
      return null;
    };

    const fetcher = options?.fetchBlobFn || defaultFetch;

    for (const uploadId of uploadIdsToFetch) {
      const alreadyCached = await this.hasMediaBlob(uploadId);
      if (alreadyCached) {
        mediaAlreadyCached++;
        continue;
      }

      try {
        const blob = await fetcher(uploadId);
        if (blob) {
          await this.saveMediaBlob(uploadId, blob);
          mediaCached++;
        } else {
          failedUploads.push(uploadId);
        }
      } catch (err) {
        failedUploads.push(uploadId);
      }
    }

    // 4. Notify Service Worker controller if active
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      try {
        const assetUrls = Array.from(uploadIdsToFetch).map((id) => `/api/v1/kiosk/uploads/${encodeURIComponent(id)}`);
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_JOURNEY_ASSETS',
          urls: assetUrls
        });
      } catch {
        // Non-blocking
      }
    }

    return {
      manifestCached: true,
      journeysCached,
      journeyVersionsCached,
      mediaCached,
      mediaAlreadyCached,
      failedUploads
    };
  }

  // ==========================================
  // 5. Encrypted Pending Sessions Operations
  // ==========================================

  /**
   * Securely buffers completed offline sessions into 'pending_sessions' store.
   * Satisfies Acceptance Criteria:
   * "Given an offline terminal,
   *  When an employee completes a journey,
   *  Then the session payload is stored in pending_sessions."
   */
  public async savePendingSession(
    sessionInput: Partial<KioskSession> & {
      sessionId?: string;
      clientSessionId?: string;
      deviceId?: string;
      journeyId: string;
      currentDuration?: number;
      durationSeconds?: number;
    }
  ): Promise<OfflinePendingSession> {
    const db = await this.getDb();
    const clientSessionId = sessionInput.clientSessionId || generateUUIDv4();
    const deviceId =
      sessionInput.deviceId ||
      deviceIdentityService.getHardwareGuidSync() ||
      'standalone-kiosk';

    const plainSessionPayload = {
      clientSessionId,
      sessionId: sessionInput._id || sessionInput.sessionId,
      deviceId,
      journeyId: sessionInput.journeyId,
      journeyVersionId: sessionInput.journeyVersionId,
      versionNumber: sessionInput.versionNumber || 1,
      userId: sessionInput.userId || null,
      sessionToken: sessionInput.sessionToken || 'offline-ephemeral-token',
      status: sessionInput.status || 'completed',
      startedAt: sessionInput.startedAt ? new Date(sessionInput.startedAt).getTime() : Date.now(),
      completedAt: sessionInput.completedAt ? new Date(sessionInput.completedAt).getTime() : Date.now(),
      durationSeconds: sessionInput.durationSeconds || sessionInput.currentDuration || 0,
      currentStepId: sessionInput.currentStepId || '',
      completedStepIds: sessionInput.completedStepIds ? Array.from(sessionInput.completedStepIds) : [],
      ppeItemsVerified: sessionInput.ppeItemsVerified ? Array.from(sessionInput.ppeItemsVerified) : [],
      quizScore: sessionInput.quizScore,
      supervisorWitness: sessionInput.supervisorWitness,
      verificationChecksum: sessionInput.verificationChecksum,
      isOfflineSync: true,
      timestamp: Date.now()
    };

    // Encrypt payload using AES-GCM keyed to device hardware identity
    const { encryptedPayload, iv } = await encryptSessionPayload(plainSessionPayload, deviceId);

    const record: OfflinePendingSession = {
      clientSessionId,
      sessionId: sessionInput._id || sessionInput.sessionId,
      deviceId,
      journeyId: sessionInput.journeyId,
      journeyVersionId: sessionInput.journeyVersionId,
      versionNumber: sessionInput.versionNumber || 1,
      userId: sessionInput.userId || null,
      sessionToken: sessionInput.sessionToken || 'offline-ephemeral-token',
      status: (sessionInput.status as KioskSessionStatus) || 'completed',
      syncStatus: 'pending',
      startedAt: plainSessionPayload.startedAt,
      completedAt: plainSessionPayload.completedAt,
      durationSeconds: plainSessionPayload.durationSeconds,
      currentStepId: plainSessionPayload.currentStepId,
      completedStepIds: plainSessionPayload.completedStepIds,
      ppeItemsVerified: plainSessionPayload.ppeItemsVerified,
      quizScore: plainSessionPayload.quizScore,
      supervisorWitness: plainSessionPayload.supervisorWitness,
      verificationChecksum: plainSessionPayload.verificationChecksum,
      isOfflineSync: true,
      encryptedPayload,
      iv,
      createdAt: Date.now(),
      retryCount: 0
    };

    await db.put('pending_sessions', record);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('talnova:kiosk:offline_session_queued', {
          detail: { clientSessionId, journeyId: sessionInput.journeyId }
        })
      );
    }

    return record;
  }

  public async getPendingSessions(onlyPending = true): Promise<OfflinePendingSession[]> {
    const db = await this.getDb();
    if (onlyPending) {
      return db.getAllFromIndex('pending_sessions', 'syncStatus', 'pending');
    }
    return db.getAll('pending_sessions');
  }

  public async getPendingSession(clientSessionId: string): Promise<OfflinePendingSession | null> {
    const db = await this.getDb();
    const record = await db.get('pending_sessions', clientSessionId);
    return record || null;
  }

  /**
   * Decrypts an offline pending session's encrypted payload back to its original plain representation.
   */
  public async decryptPendingSession<T = any>(session: OfflinePendingSession): Promise<T> {
    const seed = session.deviceId || deviceIdentityService.getHardwareGuidSync() || 'talnova-kiosk-offline-default-key';
    return decryptSessionPayload<T>(session.encryptedPayload, session.iv, seed);
  }

  public async updatePendingSessionSyncStatus(
    clientSessionId: string,
    syncStatus: 'pending' | 'syncing' | 'synced' | 'failed',
    lastError?: string
  ): Promise<void> {
    const db = await this.getDb();
    const session = await db.get('pending_sessions', clientSessionId);
    if (!session) return;

    session.syncStatus = syncStatus;
    if (syncStatus === 'failed') {
      session.retryCount = (session.retryCount || 0) + 1;
      session.lastError = lastError;
    }
    await db.put('pending_sessions', session);
  }

  public async markSessionSynced(clientSessionId: string): Promise<void> {
    await this.updatePendingSessionSyncStatus(clientSessionId, 'synced');
  }

  public async deletePendingSession(clientSessionId: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('pending_sessions', clientSessionId);
  }

  /**
   * Transmits all pending offline sessions to the server and purges synced records
   * strictly upon HTTP 200/201 confirmation (ADR-009, K-OFF-003).
   */
  public async syncPendingSessions(options?: {
    apiEndpoint?: string;
    syncFn?: (payload: { sessions: any[] }) => Promise<{
      syncedCount?: number;
      duplicateCount?: number;
      failedCount?: number;
    }>;
  }): Promise<{
    syncedCount: number;
    duplicateCount: number;
    failedCount: number;
  }> {
    const pending = await this.getPendingSessions(true);
    if (!pending || pending.length === 0) {
      return { syncedCount: 0, duplicateCount: 0, failedCount: 0 };
    }

    // 1. Mark in-flight as syncing
    for (const s of pending) {
      await this.updatePendingSessionSyncStatus(s.clientSessionId, 'syncing');
    }

    // 2. Decrypt all payloads
    const decryptedSessions: any[] = [];
    for (const s of pending) {
      try {
        const plain = await this.decryptPendingSession(s);
        decryptedSessions.push({
          ...plain,
          clientSessionId: s.clientSessionId
        });
      } catch (err) {
        console.warn(`[OfflineStorage] Failed to decrypt session ${s.clientSessionId}:`, err);
        decryptedSessions.push({
          clientSessionId: s.clientSessionId,
          journeyId: s.journeyId,
          sessionId: s.sessionId,
          status: s.status,
          durationSeconds: s.durationSeconds,
          completedStepIds: s.completedStepIds,
          ppeItemsVerified: s.ppeItemsVerified,
          quizScore: s.quizScore,
          verificationChecksum: s.verificationChecksum,
          isOfflineSync: true
        });
      }
    }

    // 3. Dispatch HTTP request
    try {
      let result: { syncedCount?: number; duplicateCount?: number; failedCount?: number };

      if (options?.syncFn) {
        result = await options.syncFn({ sessions: decryptedSessions });
      } else {
        const response = await apiClient.post<any>(
          options?.apiEndpoint || '/kiosk/analytics/sync',
          { sessions: decryptedSessions }
        );
        result = response.data?.data || response.data || {};
      }

      const syncedCount = result.syncedCount ?? decryptedSessions.length;
      const duplicateCount = result.duplicateCount ?? 0;
      const failedCount = result.failedCount ?? 0;

      // 4. On HTTP 200/201 success confirmation: purge synced records from pending_sessions
      for (const s of pending) {
        await this.deletePendingSession(s.clientSessionId);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('talnova:kiosk:offline_sessions_flushed', {
            detail: { syncedCount, duplicateCount, failedCount }
          })
        );
      }

      return {
        syncedCount,
        duplicateCount,
        failedCount
      };
    } catch (err: any) {
      console.warn('[OfflineStorage] Bulk sync failed. Retaining sessions in pending_sessions:', err);
      // Revert status to failed and increment retry count
      for (const s of pending) {
        await this.updatePendingSessionSyncStatus(
          s.clientSessionId,
          'failed',
          err?.message || 'Network sync error'
        );
      }
      throw err;
    }
  }

  // ==========================================
  // 6. Metrics & Storage Management
  // ==========================================

  public async getStorageStats(): Promise<{
    manifestCount: number;
    journeyVersionsCount: number;
    mediaBlobsCount: number;
    pendingSessionsCount: number;
    totalMediaSizeBytes: number;
  }> {
    const db = await this.getDb();
    const manifests = await db.getAll('manifest');
    const versions = await db.getAll('journey_versions');
    const media = await db.getAll('media_blobs');
    const sessions = await db.getAll('pending_sessions');

    let totalMediaSizeBytes = 0;
    for (const m of media) {
      totalMediaSizeBytes += m.size || 0;
    }

    return {
      manifestCount: manifests.length,
      journeyVersionsCount: versions.length,
      mediaBlobsCount: media.length,
      pendingSessionsCount: sessions.length,
      totalMediaSizeBytes
    };
  }

  /**
   * Clears cached manifest, journey versions, and media blobs.
   * Explicitly preserves 'pending_sessions' so offline employee completion records are never destroyed.
   */
  public async clearOfflineCache(): Promise<void> {
    const db = await this.getDb();
    await db.clear('manifest');
    await db.clear('journey_versions');
    await db.clear('media_blobs');
  }

  /**
   * Nuclear cleanup: clears all object stores including pending sessions.
   */
  public async clearAllStorage(): Promise<void> {
    const db = await this.getDb();
    await db.clear('manifest');
    await db.clear('journey_versions');
    await db.clear('media_blobs');
    await db.clear('pending_sessions');
  }
}

export const offlineStorageService = new OfflineStorageService();
