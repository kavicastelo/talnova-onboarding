import { apiClient } from '../api/client';

export interface OfflineQueueItem {
  id: string;
  type: 'task_completion' | 'journey_progress';
  payload: any;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'talnova_offline_sync_queue';

export const pwaService = {
  // Push Notification Subscription (MOB-004)
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

  // Offline Task & Event Queueing (MOB-003, MOB-005)
  enqueueOfflineAction: (type: 'task_completion' | 'journey_progress', payload: any) => {
    const queue = pwaService.getOfflineQueue();
    const newItem: OfflineQueueItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
    };
    queue.push(newItem);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  },

  getOfflineQueue: (): OfflineQueueItem[] => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  flushOfflineQueue: async (): Promise<number> => {
    const queue = pwaService.getOfflineQueue();
    if (queue.length === 0) return 0;

    let syncedCount = 0;
    const remainingQueue: OfflineQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'task_completion') {
          await apiClient.post(`/tasks/${item.payload.taskId}/complete`, item.payload);
        } else if (item.type === 'journey_progress') {
          await apiClient.post(`/assignments/${item.payload.assignmentId}/progress`, item.payload);
        }
        syncedCount++;
      } catch (err) {
        remainingQueue.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    return syncedCount;
  },
};

export default pwaService;
