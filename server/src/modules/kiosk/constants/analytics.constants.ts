/**
 * Maximum number of analytics sessions buffered locally before flushing to API.
 */
export const ANALYTICS_BATCH_SIZE = 50;

/**
 * Frequency in milliseconds at which the offline analytics buffer checks for connectivity to sync.
 */
export const ANALYTICS_SYNC_INTERVAL_MS = 300000; // 5 minutes
