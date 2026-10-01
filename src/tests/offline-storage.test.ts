/**
 * Talnova Kiosk Shell - Offline IndexedDB Storage Unit Test Suite (K-OFF-002)
 *
 * Utilizes fake-indexeddb to validate:
 * 1. Object store creation (manifest, journey_versions, media_blobs, pending_sessions)
 * 2. Caching assigned journeys & localized audio blobs on manifest updates (Acceptance Criteria 1)
 * 3. Secure AES-GCM encrypted buffering of completed offline sessions (Acceptance Criteria 2)
 * 4. Offline session retrieval, decryption, and sync state transitions
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  offlineStorageService,
  OFFLINE_DB_NAME,
  extractMediaUploadIds,
  encryptSessionPayload,
  decryptSessionPayload,
  generateUUIDv4
} from '../features/kiosk/services/offline-storage.service';
import { KioskDeviceManifest } from '../types/kiosk/device.types';
import { KioskJourney } from '../types/kiosk/journey.types';
import { KioskStep } from '../types/kiosk/step.types';

describe('K-OFF-002: Offline IndexedDB Storage Service Suite', () => {
  beforeEach(async () => {
    await offlineStorageService.clearAllStorage();
  });

  afterEach(async () => {
    await offlineStorageService.close();
    vi.restoreAllMocks();
  });

  describe('1. Database Initialization & Schema Definition', () => {
    it('initializes kiosk_offline_store with all four required object stores and indexes', async () => {
      const db = await offlineStorageService.getDb();
      expect(db.name).toBe(OFFLINE_DB_NAME);

      const storeNames = Array.from(db.objectStoreNames);
      expect(storeNames).toContain('manifest');
      expect(storeNames).toContain('journey_versions');
      expect(storeNames).toContain('media_blobs');
      expect(storeNames).toContain('pending_sessions');

      const tx = db.transaction(['journey_versions', 'pending_sessions'], 'readonly');
      const versionStore = tx.objectStore('journey_versions');
      const sessionStore = tx.objectStore('pending_sessions');

      expect(Array.from(versionStore.indexNames)).toContain('journeyId');
      expect(Array.from(sessionStore.indexNames)).toContain('syncStatus');
      expect(Array.from(sessionStore.indexNames)).toContain('createdAt');
      expect(Array.from(sessionStore.indexNames)).toContain('deviceId');
      await tx.done;
    });
  });

  describe('2. Manifest Store Operations', () => {
    it('stores and retrieves terminal device manifest', async () => {
      const mockManifest: KioskDeviceManifest = {
        deviceId: 'kiosk-unit-alpha-44',
        organizationId: 'org-enterprise-99',
        launchMode: 'launcher',
        journeys: [],
        settings: {
          screenTimeout: 120
        }
      };

      await offlineStorageService.saveManifest(mockManifest);
      const retrieved = await offlineStorageService.getManifest('kiosk-unit-alpha-44');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.deviceId).toBe('kiosk-unit-alpha-44');
      expect(retrieved?.organizationId).toBe('org-enterprise-99');
      expect(retrieved?.launchMode).toBe('launcher');
    });

    it('retrieves default or first manifest when deviceId parameter is omitted', async () => {
      const mockManifest: KioskDeviceManifest = {
        deviceId: 'kiosk-auto-01',
        organizationId: 'org-test',
        launchMode: 'autoplay',
        journeys: []
      };

      await offlineStorageService.saveManifest(mockManifest);
      const retrieved = await offlineStorageService.getManifest();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.deviceId).toBe('kiosk-auto-01');
    });
  });

  describe('3. Journey Versions Snapshots & Media Extraction', () => {
    const mockStep: KioskStep = {
      id: 'step-safety-ppe',
      type: 'content',
      title: 'PPE Verification',
      order: 1,
      blocks: [
        {
          id: 'block-audio-narration' as any,
          type: 'audio',
          order: 1,
          mediaReferences: {
            en: { audioUploadId: 'audio-narrate-ppe-en' as any },
            es: { audioUploadId: 'audio-narrate-ppe-es' as any },
            ar: { audioUploadId: 'audio-narrate-ppe-ar' as any }
          },
          settings: {
            autoplay: true,
            loop: false,
            controls: true
          }
        },
        {
          id: 'block-image-helmet' as any,
          type: 'image',
          order: 2,
          mediaReferences: {
            en: { uploadId: 'img-hard-hat-guidance' as any }
          },
          settings: {
            zoomable: true
          }
        }
      ],
      interaction: {
        type: 'confirm'
      }
    };

    const mockJourney: KioskJourney = {
      _id: 'jrn-mine-safety' as any,
      organizationId: 'org-mining' as any,
      title: 'Underground Mine Safety Protocol',
      description: 'Mandatory PPE and breathing apparatus protocol',
      languages: ['en', 'es', 'ar'] as any,
      steps: [mockStep],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        autoReturnHome: true,
        hideNavigation: false,
        disableExit: true,
        security: { protectionType: 'none' }
      },
      publishing: {
        status: 'published',
        version: 3 as any,
        publishedAt: new Date().toISOString() as any
      },
      createdAt: new Date().toISOString() as any,
      updatedAt: new Date().toISOString() as any,
      createdBy: 'admin-safety',
      isDeleted: false
    };

    it('extracts all audio and image upload IDs across language configurations', () => {
      const extracted = extractMediaUploadIds(mockJourney);
      expect(extracted).toContain('audio-narrate-ppe-en');
      expect(extracted).toContain('audio-narrate-ppe-es');
      expect(extracted).toContain('audio-narrate-ppe-ar');
      expect(extracted).toContain('img-hard-hat-guidance');
      expect(extracted.length).toBe(4);
    });

    it('saves and retrieves immutable journey version snapshots with indices', async () => {
      const versionId = await offlineStorageService.saveJourneyVersion({
        journeyId: mockJourney._id,
        versionNumber: 3,
        title: mockJourney.title,
        languages: mockJourney.languages as string[],
        steps: mockJourney.steps as KioskStep[],
        snapshot: mockJourney
      });

      expect(versionId).toBe('jrn-mine-safety_v3');

      const retrieved = await offlineStorageService.getJourneyVersion(versionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Underground Mine Safety Protocol');
      expect(retrieved?.steps.length).toBe(1);
      expect(retrieved?.steps[0].id).toBe('step-safety-ppe');

      const byJourney = await offlineStorageService.getJourneyVersionsByJourneyId(mockJourney._id);
      expect(byJourney.length).toBe(1);
      expect(byJourney[0].versionNumber).toBe(3);

      const latest = await offlineStorageService.getLatestJourneyVersion(mockJourney._id);
      expect(latest?.versionId).toBe('jrn-mine-safety_v3');
    });
  });

  describe('4. Media Blobs Storage Operations', () => {
    it('stores and retrieves binary media blobs with MIME types', async () => {
      const audioBlob = new Blob(['MOCK_AUDIO_DATA_BYTES'], { type: 'audio/mp3' });
      await offlineStorageService.saveMediaBlob('upload-audio-spanish-01', audioBlob, {
        filename: 'spanish-intro.mp3',
        mimeType: 'audio/mp3'
      });

      const exists = await offlineStorageService.hasMediaBlob('upload-audio-spanish-01');
      expect(exists).toBe(true);

      const retrieved = await offlineStorageService.getMediaBlob('upload-audio-spanish-01');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.type).toBe('audio/mp3');
      expect(retrieved?.size).toBe(audioBlob.size);
    });

    it('returns false for non-existent upload IDs', async () => {
      const exists = await offlineStorageService.hasMediaBlob('non-existent-upload');
      expect(exists).toBe(false);
      const retrieved = await offlineStorageService.getMediaBlob('non-existent-upload');
      expect(retrieved).toBeNull();
    });
  });

  describe('5. Acceptance Criteria 1: cacheAssignedJourneys() on Manifest Update', () => {
    it('pre-fetches and stores all assigned journey JSON and audio/image assets in IndexedDB', async () => {
      const mockAudioBlob = new Blob(['MOCK_AUDIO_MP3_STREAM'], { type: 'audio/mp3' });
      const mockImageBlob = new Blob(['MOCK_PNG_IMAGE_STREAM'], { type: 'image/png' });

      const mockManifest: KioskDeviceManifest = {
        deviceId: 'kiosk-dock-terminal-03',
        organizationId: 'org-logistics',
        launchMode: 'launcher',
        journeys: [
          {
            _id: 'jrn-dock-safety' as any,
            organizationId: 'org-logistics' as any,
            title: 'Ship Dock Safety Protocol',
            languages: ['en', 'es'] as any,
            steps: [
              {
                id: 'step-1',
                type: 'content',
                title: 'Introduction',
                order: 1,
                blocks: [
                  {
                    id: 'b-audio' as any,
                    type: 'audio',
                    order: 1,
                    mediaReferences: {
                      en: { audioUploadId: 'audio-dock-en' as any },
                      es: { audioUploadId: 'audio-dock-es' as any }
                    },
                    settings: { autoplay: true, loop: false, controls: true }
                  },
                  {
                    id: 'b-img' as any,
                    type: 'image',
                    order: 2,
                    mediaReferences: {
                      en: { uploadId: 'img-vest-guidance' as any }
                    },
                    settings: { zoomable: false }
                  }
                ],
                interaction: { type: 'confirm' }
              }
            ],
            settings: {
              autoPlay: false,
              loopForever: false,
              idleTimeoutSeconds: 30,
              autoReturnHome: true,
              hideNavigation: false,
              disableExit: true,
              security: { protectionType: 'none' }
            },
            publishing: {
              status: 'published',
              version: 2 as any,
              publishedAt: new Date().toISOString() as any
            },
            createdAt: new Date().toISOString() as any,
            updatedAt: new Date().toISOString() as any,
            createdBy: 'safety-officer',
            isDeleted: false,
            priority: 1,
            isMandatory: true
          }
        ]
      };

      // Mock fetcher to simulate network retrieval of media blobs
      const fetchBlobMock = vi.fn().mockImplementation(async (uploadId: string) => {
        if (uploadId.startsWith('audio-')) {
          return mockAudioBlob;
        }
        if (uploadId.startsWith('img-')) {
          return mockImageBlob;
        }
        return null;
      });

      const result = await offlineStorageService.cacheAssignedJourneys(mockManifest, {
        fetchBlobFn: fetchBlobMock
      });

      // Verification of result summary
      expect(result.manifestCached).toBe(true);
      expect(result.journeysCached).toBe(1);
      expect(result.journeyVersionsCached).toBe(1);
      expect(result.mediaCached).toBe(3); // audio-dock-en, audio-dock-es, img-vest-guidance
      expect(result.failedUploads.length).toBe(0);

      // Verify manifest stored in IndexedDB
      const storedManifest = await offlineStorageService.getManifest('kiosk-dock-terminal-03');
      expect(storedManifest).not.toBeNull();
      expect(storedManifest?.journeys.length).toBe(1);

      // Verify journey version stored in IndexedDB
      const storedVersion = await offlineStorageService.getJourneyVersion('jrn-dock-safety_v2');
      expect(storedVersion).not.toBeNull();
      expect(storedVersion?.title).toBe('Ship Dock Safety Protocol');

      // Verify all audio and image blobs stored in IndexedDB
      expect(await offlineStorageService.hasMediaBlob('audio-dock-en')).toBe(true);
      expect(await offlineStorageService.hasMediaBlob('audio-dock-es')).toBe(true);
      expect(await offlineStorageService.hasMediaBlob('img-vest-guidance')).toBe(true);

      // Verify caching idempotency: second run detects existing blobs without re-fetching
      const secondRun = await offlineStorageService.cacheAssignedJourneys(mockManifest, {
        fetchBlobFn: fetchBlobMock
      });
      expect(secondRun.mediaAlreadyCached).toBe(3);
      expect(secondRun.mediaCached).toBe(0);
    });
  });

  describe('6. Acceptance Criteria 2: Offline Journey Completion & Encrypted pending_sessions', () => {
    it('buffers completed session payload into pending_sessions with AES-GCM encryption', async () => {
      const mockCompletionPayload = {
        sessionId: 'sess-temp-offline-101',
        deviceId: 'kiosk-warehouse-south',
        journeyId: 'jrn-forklift-safety',
        journeyVersionId: 'jrn-forklift-safety_v1',
        versionNumber: 1,
        userId: 'emp-worker-5542',
        durationSeconds: 245,
        quizScore: 95,
        ppeItemsVerified: ['hard_hat', 'steel_toe_boots', 'high_vis_vest'],
        verificationChecksum: 'sha256-mock-hmac-checksum-valid',
        completedStepIds: ['step-intro', 'step-ppe', 'step-quiz', 'step-finish']
      };

      const pendingRecord = await offlineStorageService.savePendingSession(mockCompletionPayload);

      // Verification of stored record attributes
      expect(pendingRecord.clientSessionId).toBeDefined();
      expect(pendingRecord.clientSessionId.length).toBeGreaterThan(20);
      expect(pendingRecord.syncStatus).toBe('pending');
      expect(pendingRecord.isOfflineSync).toBe(true);
      expect(pendingRecord.durationSeconds).toBe(245);
      expect(pendingRecord.quizScore).toBe(95);

      // Verification of AES-GCM encryption: raw payload must NOT appear in encryptedPayload
      expect(pendingRecord.encryptedPayload).toBeDefined();
      expect(pendingRecord.iv).toBeDefined();
      expect(pendingRecord.encryptedPayload).not.toContain('emp-worker-5542');
      expect(pendingRecord.encryptedPayload).not.toContain('jrn-forklift-safety');

      // Query from pending_sessions store
      const pendingList = await offlineStorageService.getPendingSessions();
      expect(pendingList.length).toBe(1);
      expect(pendingList[0].clientSessionId).toBe(pendingRecord.clientSessionId);

      // Decrypt and verify facts fidelity
      const decrypted = await offlineStorageService.decryptPendingSession(pendingList[0]);
      expect(decrypted.clientSessionId).toBe(pendingRecord.clientSessionId);
      expect(decrypted.userId).toBe('emp-worker-5542');
      expect(decrypted.quizScore).toBe(95);
      expect(decrypted.ppeItemsVerified).toEqual(['hard_hat', 'steel_toe_boots', 'high_vis_vest']);
      expect(decrypted.verificationChecksum).toBe('sha256-mock-hmac-checksum-valid');
    });

    it('manages session lifecycle states (pending -> syncing -> synced / delete)', async () => {
      const record = await offlineStorageService.savePendingSession({
        journeyId: 'jrn-test',
        durationSeconds: 60
      });

      const id = record.clientSessionId;
      expect((await offlineStorageService.getPendingSession(id))?.syncStatus).toBe('pending');

      await offlineStorageService.updatePendingSessionSyncStatus(id, 'syncing');
      expect((await offlineStorageService.getPendingSession(id))?.syncStatus).toBe('syncing');

      // When synced, getPendingSessions(true) filters it out
      await offlineStorageService.markSessionSynced(id);
      expect((await offlineStorageService.getPendingSession(id))?.syncStatus).toBe('synced');
      const activePending = await offlineStorageService.getPendingSessions(true);
      expect(activePending.length).toBe(0);

      // Cleanup
      await offlineStorageService.deletePendingSession(id);
      expect(await offlineStorageService.getPendingSession(id)).toBeNull();
    });

    it('records failed sync retries and stores error messages', async () => {
      const record = await offlineStorageService.savePendingSession({
        journeyId: 'jrn-retry-test'
      });

      await offlineStorageService.updatePendingSessionSyncStatus(
        record.clientSessionId,
        'failed',
        'HTTP 503: Service Unavailable'
      );

      const updated = await offlineStorageService.getPendingSession(record.clientSessionId);
      expect(updated?.syncStatus).toBe('failed');
      expect(updated?.retryCount).toBe(1);
      expect(updated?.lastError).toContain('HTTP 503');
    });

    it('transmits pending sessions in bulk and purges them strictly upon HTTP 200 confirmation (K-OFF-003)', async () => {
      // Queue 3 offline completed sessions
      const s1 = await offlineStorageService.savePendingSession({ journeyId: 'jrn-1', quizScore: 90 });
      const s2 = await offlineStorageService.savePendingSession({ journeyId: 'jrn-2', quizScore: 85 });
      const s3 = await offlineStorageService.savePendingSession({ journeyId: 'jrn-3', quizScore: 100 });

      expect((await offlineStorageService.getPendingSessions()).length).toBe(3);

      const syncMock = vi.fn().mockResolvedValue({
        syncedCount: 3,
        duplicateCount: 0,
        failedCount: 0
      });

      const result = await offlineStorageService.syncPendingSessions({ syncFn: syncMock });

      expect(syncMock).toHaveBeenCalledTimes(1);
      const callArg = syncMock.mock.calls[0][0];
      expect(callArg.sessions.length).toBe(3);
      expect(callArg.sessions.map((s: any) => s.clientSessionId)).toContain(s1.clientSessionId);
      expect(callArg.sessions.map((s: any) => s.clientSessionId)).toContain(s2.clientSessionId);
      expect(callArg.sessions.map((s: any) => s.clientSessionId)).toContain(s3.clientSessionId);

      expect(result.syncedCount).toBe(3);
      expect(result.duplicateCount).toBe(0);

      // Verify that after 200 OK confirmation, pending_sessions are purged from IndexedDB
      const remainingPending = await offlineStorageService.getPendingSessions();
      expect(remainingPending.length).toBe(0);
    });

    it('retains sessions in pending_sessions when network sync fails', async () => {
      const s = await offlineStorageService.savePendingSession({ journeyId: 'jrn-fail' });

      const syncMock = vi.fn().mockRejectedValue(new Error('Network offline or timeout'));

      await expect(
        offlineStorageService.syncPendingSessions({ syncFn: syncMock })
      ).rejects.toThrow('Network offline or timeout');

      // Records must remain in IndexedDB with status 'failed'
      const remaining = await offlineStorageService.getPendingSessions(false);
      expect(remaining.length).toBe(1);
      expect(remaining[0].clientSessionId).toBe(s.clientSessionId);
      expect(remaining[0].syncStatus).toBe('failed');
      expect(remaining[0].lastError).toContain('Network offline');
    });
  });

  describe('7. Storage Statistics and Cache Purging', () => {
    it('calculates storage stats and purges offline cache while safeguarding pending sessions', async () => {
      // 1. Populate manifest, journey version, and media blob
      await offlineStorageService.saveManifest({
        deviceId: 'kiosk-stats',
        organizationId: 'org-test',
        launchMode: 'launcher',
        journeys: []
      });

      await offlineStorageService.saveJourneyVersion({
        journeyId: 'jrn-stat',
        steps: []
      });

      const testBlob = new Blob(['1234567890'], { type: 'text/plain' });
      await offlineStorageService.saveMediaBlob('blob-stat-1', testBlob);

      // 2. Buffer a pending offline session
      await offlineStorageService.savePendingSession({
        journeyId: 'jrn-stat'
      });

      const initialStats = await offlineStorageService.getStorageStats();
      expect(initialStats.manifestCount).toBe(1);
      expect(initialStats.journeyVersionsCount).toBe(1);
      expect(initialStats.mediaBlobsCount).toBe(1);
      expect(initialStats.pendingSessionsCount).toBe(1);
      expect(initialStats.totalMediaSizeBytes).toBe(10);

      // 3. Clear offline cache (must preserve pending employee sessions!)
      await offlineStorageService.clearOfflineCache();

      const postClearStats = await offlineStorageService.getStorageStats();
      expect(postClearStats.manifestCount).toBe(0);
      expect(postClearStats.journeyVersionsCount).toBe(0);
      expect(postClearStats.mediaBlobsCount).toBe(0);
      expect(postClearStats.pendingSessionsCount).toBe(1); // Pending sessions preserved!

      // 4. Clear all storage clears pending sessions as well
      await offlineStorageService.clearAllStorage();
      const finalStats = await offlineStorageService.getStorageStats();
      expect(finalStats.pendingSessionsCount).toBe(0);
    });
  });
});
