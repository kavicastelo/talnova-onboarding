import { apiClient } from '../api/client';
import { toast } from 'sonner';

export interface OfflineQueueItem {
  id: string;
  type: 'task_completion' | 'journey_progress';
  payload: any;
  timestamp: number;
}

export interface OfflineProgressRecord {
  id: string;
  assignmentId: string;
  lessonId: string;
  type: 'lesson_completion';
  timestamp: number;
  synced: boolean;
}

const DB_NAME = 'talnova_pwa_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_queue';
const LEGACY_STORAGE_KEY = 'talnova_offline_sync_queue';

// Open / Initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const pwaService = {
  // 1. Push Notification Subscription (MOB-004)
  subscribePushNotifications: async (subscription: PushSubscriptionJSON): Promise<void> => {
    await apiClient.post('/notifications/push-subscription', {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    });
  },

  unsubscribePushNotifications: async (endpoint: string): Promise<void> => {
    await apiClient.delete('/notifications/push-subscription', {
      data: { endpoint },
    });
  },

  // 2. Enqueue Offline Progress into IndexedDB (UJ-ONB-009)
  enqueueOfflineProgress: async (assignmentId: string, lessonId: string): Promise<OfflineProgressRecord> => {
    const record: OfflineProgressRecord = {
      id: `sync_${Date.now()}_${lessonId}`,
      assignmentId,
      lessonId,
      type: 'lesson_completion',
      timestamp: Date.now(),
      synced: false,
    };

    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      console.log('[PWA Sync] Enqueued offline lesson progress to IndexedDB:', record);
    } catch (err) {
      console.warn('[PWA Sync] IndexedDB save failed, falling back to localStorage:', err);
    }

    // Mirror to localStorage for dual-layer reliability
    try {
      const legacyQueue = pwaService.getOfflineQueue();
      legacyQueue.push({
        id: record.id,
        type: 'journey_progress',
        payload: { assignmentId, completedLessonIds: [lessonId] },
        timestamp: record.timestamp,
      });
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyQueue));
    } catch {}

    return record;
  },

  // 3. Get all offline progress items from IndexedDB
  getIndexedDBQueue: async (): Promise<OfflineProgressRecord[]> => {
    try {
      const db = await openDB();
      return new Promise<OfflineProgressRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback from localStorage
      const stored = pwaService.getOfflineQueue();
      return stored.map((item) => ({
        id: item.id,
        assignmentId: item.payload?.assignmentId || 'unknown',
        lessonId: item.payload?.completedLessonIds?.[0] || 'unknown',
        type: 'lesson_completion',
        timestamp: item.timestamp,
        synced: false,
      }));
    }
  },

  // 4. Flush Offline Progress to Backend (Happy Path step 7)
  flushOfflineProgress: async (): Promise<{ syncedCount: number; syncedLessonIds: string[] }> => {
    const items = await pwaService.getIndexedDBQueue();
    if (items.length === 0) {
      return { syncedCount: 0, syncedLessonIds: [] };
    }

    // Negative Test: check auth token before sync flush
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('[PWA Sync] No auth token available. Re-authentication required before progress sync.');
      toast.warning('Session expired. Please log in to synchronize your offline learning progress.');
      return { syncedCount: 0, syncedLessonIds: [] };
    }

    // Group completed lessons by assignment
    const byAssignment: Record<string, string[]> = {};
    for (const item of items) {
      if (!byAssignment[item.assignmentId]) {
        byAssignment[item.assignmentId] = [];
      }
      if (!byAssignment[item.assignmentId].includes(item.lessonId)) {
        byAssignment[item.assignmentId].push(item.lessonId);
      }
    }

    const syncedIds: string[] = [];
    const syncedLessons: string[] = [];

    for (const [assignmentId, lessonIds] of Object.entries(byAssignment)) {
      try {
        console.log(`[PWA Sync] Dispatching POST /api/v1/assignments/${assignmentId}/progress with completedLessonIds:`, lessonIds);
        const response = await apiClient.post(`/assignments/${assignmentId}/progress`, {
          completedLessonIds: lessonIds,
        });

        if (response.status === 200) {
          syncedLessons.push(...lessonIds);
          items.filter((it) => it.assignmentId === assignmentId).forEach((it) => syncedIds.push(it.id));
        }
      } catch (err: any) {
        console.error(`[PWA Sync] Failed to synchronize progress for assignment ${assignmentId}:`, err);
      }
    }

    // Clear synced records from IndexedDB
    if (syncedIds.length > 0) {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const id of syncedIds) {
          store.delete(id);
        }
      } catch {}

      // Clear legacy localStorage queue
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      console.log(`[PWA Sync] Successfully flushed ${syncedIds.length} offline progress record(s).`);
    }

    return { syncedCount: syncedIds.length, syncedLessonIds: syncedLessons };
  },

  // Legacy queue helpers
  enqueueOfflineAction: (type: 'task_completion' | 'journey_progress', payload: any) => {
    const queue = pwaService.getOfflineQueue();
    const newItem: OfflineQueueItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
    };
    queue.push(newItem);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(queue));
  },

  getOfflineQueue: (): OfflineQueueItem[] => {
    try {
      const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  flushOfflineQueue: async (): Promise<number> => {
    const res = await pwaService.flushOfflineProgress();
    return res.syncedCount;
  },
};

// Global reconnection listener (Happy Path step 6 & 7)
if (typeof window !== 'undefined') {
  (window as any).pwaService = pwaService;
  (window as any).flushOfflineProgress = pwaService.flushOfflineProgress;
  (window as any).getIndexedDBQueue = pwaService.getIndexedDBQueue;

  window.addEventListener('online', async () => {
    console.log('[PWA Sync] Browser online event detected. Synchronizing offline queue...');
    const result = await pwaService.flushOfflineProgress();
    if (result.syncedCount > 0) {
      toast.success(`Online: Successfully synced ${result.syncedCount} lesson(s) to server.`);
      window.dispatchEvent(new CustomEvent('talnova:offline_synced', { detail: result }));
    }
  });
}

export default pwaService;
