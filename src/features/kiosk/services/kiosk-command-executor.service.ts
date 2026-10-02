/**
 * Talnova Kiosk Shell - Remote Command Executor Service (K-DEV-007)
 *
 * Handles client-side execution of operational commands dispatched from the
 * administrative Fleet Dashboard via heartbeat telemetry responses:
 * - RELOAD_MANIFEST: Forces immediate re-fetch of device assignments and manifest
 * - ENTER_MAINTENANCE: Activates full-screen touch-blocking maintenance overlay
 * - EXIT_MAINTENANCE: Dismisses maintenance overlay and resumes kiosk operation
 * - CLEAR_CACHE: Purges ServiceWorker caches, IndexedDB, and cached journey assets
 * - FORCE_RESET: Clears active sessions and restarts application state
 * - RESTART_APP: Triggers browser window reload
 */

import { kioskService } from './kiosk.service';
import { PendingCommand } from '../../../types/kiosk/device.types';

export interface CommandExecutionResult {
  id: string;
  type: string;
  command: string;
  success: boolean;
  executedAt: Date;
  error?: string;
  payload?: any;
}

export type KioskCommandHandler = (payload?: any, command?: any) => Promise<any> | any;
export type MaintenanceChangeListener = (isInMaintenance: boolean, payload?: any) => void;
export type ManifestReloadListener = (manifest: any, payload?: any) => void;

export class KioskCommandExecutorService {
  private inMaintenance = false;
  private maintenancePayload: any = null;
  private customHandlers = new Map<string, KioskCommandHandler>();
  private executionHistory: CommandExecutionResult[] = [];
  private maintenanceListeners: MaintenanceChangeListener[] = [];
  private manifestReloadListeners: ManifestReloadListener[] = [];

  constructor() {
    this.registerDefaultCommandHandlers();
  }

  /**
   * Registers default execution logic for standard operational commands.
   */
  private registerDefaultCommandHandlers(): void {
    // 1. RELOAD_MANIFEST: Re-fetches the latest manifest from server
    this.registerCommandHandler('RELOAD_MANIFEST', async (payload, cmd) => {
      try {
        const manifest = await kioskService.getDeviceManifest();

        // Notify registered subscribers
        this.manifestReloadListeners.forEach((listener) => {
          try {
            listener(manifest, payload);
          } catch (err) {
            console.error('[KioskCommandExecutor] Error in manifest listener:', err);
          }
        });

        // Broadcast DOM event for external or React listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('kiosk:manifest-reload', {
              detail: { manifest, payload, command: cmd }
            })
          );
        }

        return manifest;
      } catch (err: any) {
        console.error('[KioskCommandExecutor] Failed to re-fetch manifest:', err);
        throw err;
      }
    });

    // 2. ENTER_MAINTENANCE: Activates full-screen maintenance overlay
    this.registerCommandHandler('ENTER_MAINTENANCE', (payload, cmd) => {
      this.inMaintenance = true;
      this.maintenancePayload = payload || {};

      this.notifyMaintenanceListeners(true, payload);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kiosk:enter-maintenance', {
            detail: { payload, command: cmd, enteredAt: new Date() }
          })
        );
      }
    });

    // 3. EXIT_MAINTENANCE: Deactivates maintenance overlay
    this.registerCommandHandler('EXIT_MAINTENANCE', (payload, cmd) => {
      this.inMaintenance = false;
      this.maintenancePayload = null;

      this.notifyMaintenanceListeners(false, payload);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kiosk:exit-maintenance', {
            detail: { payload, command: cmd, exitedAt: new Date() }
          })
        );
      }
    });

    // 4. CLEAR_CACHE / CLEAR_STORAGE: Purges browser caches
    this.registerCommandHandler('CLEAR_CACHE', async (payload, cmd) => {
      let cachesDeleted = 0;
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
          cachesDeleted = keys.length;
        } catch (cacheErr) {
          console.warn('[KioskCommandExecutor] Warning clearing CacheStorage:', cacheErr);
        }
      }

      // Clear session storage and non-device identity local storage
      if (typeof window !== 'undefined') {
        try {
          if (typeof sessionStorage !== 'undefined' && sessionStorage && typeof sessionStorage.clear === 'function') {
            sessionStorage.clear();
          }
          // Clear cached journey or step offline items if stored in localStorage
          if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.length === 'number') {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith('kiosk_cache_') || key.startsWith('offline_queue_'))) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          }
        } catch (storageErr) {
          console.warn('[KioskCommandExecutor] Warning clearing WebStorage:', storageErr);
        }

        window.dispatchEvent(
          new CustomEvent('kiosk:cache-cleared', {
            detail: { payload, command: cmd, cachesDeleted }
          })
        );
      }

      return { cachesDeleted };
    });

    // Alias CLEAR_STORAGE to CLEAR_CACHE
    this.registerCommandHandler('CLEAR_STORAGE', async (payload, cmd) => {
      return this.executeDirect('CLEAR_CACHE', payload, cmd);
    });

    // 5. FORCE_RESET: Hard reset of session, cache, and state
    this.registerCommandHandler('FORCE_RESET', async (payload, cmd) => {
      this.inMaintenance = false;
      this.maintenancePayload = null;

      // Clear cache first
      await this.executeDirect('CLEAR_CACHE', payload, cmd);

      if (typeof window !== 'undefined') {
        try {
          // Clear employee auth session token
          if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.removeItem === 'function') {
            localStorage.removeItem('talnova_kiosk_employee_token');
          }
          if (typeof sessionStorage !== 'undefined' && sessionStorage && typeof sessionStorage.clear === 'function') {
            sessionStorage.clear();
          }
        } catch (err) {
          console.warn('[KioskCommandExecutor] Reset storage error:', err);
        }

        window.dispatchEvent(
          new CustomEvent('kiosk:force-reset', {
            detail: { payload, command: cmd, resetAt: new Date() }
          })
        );

        if (window.location && typeof window.location.reload === 'function') {
          setTimeout(() => {
            window.location.reload();
          }, 300);
        }
      }
    });

    // 6. RESTART_APP: Soft restart of web application
    this.registerCommandHandler('RESTART_APP', (payload, cmd) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kiosk:restart-app', {
            detail: { payload, command: cmd }
          })
        );
        if (window.location && typeof window.location.reload === 'function') {
          setTimeout(() => {
            window.location.reload();
          }, 200);
        }
      }
    });
  }

  /**
   * Registers a custom handler for a given command name.
   */
  public registerCommandHandler(commandType: string, handler: KioskCommandHandler): () => void {
    const key = commandType.toUpperCase().trim();
    this.customHandlers.set(key, handler);

    return () => {
      this.customHandlers.delete(key);
    };
  }

  /**
   * Normalizes command string to uppercase standard identifier.
   */
  private normalizeCommandType(cmd: any): string {
    const raw = cmd?.type || cmd?.command || cmd?.name || '';
    return typeof raw === 'string' ? raw.toUpperCase().trim() : 'UNKNOWN';
  }

  /**
   * Executes a single command received from the heartbeat response.
   */
  public async executeCommand(command: PendingCommand | any): Promise<CommandExecutionResult> {
    const normType = this.normalizeCommandType(command);
    const commandId = command?.id || `cmd-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const payload = command?.payload || {};

    const result: CommandExecutionResult = {
      id: commandId,
      type: normType,
      command: command?.command || normType,
      payload,
      executedAt: new Date(),
      success: false
    };

    try {
      const handler = this.customHandlers.get(normType);
      if (handler) {
        await handler(payload, command);
      } else {
        console.warn(`[KioskCommandExecutor] Unrecognized command type: ${normType}`);
      }

      result.success = true;
    } catch (err: any) {
      result.success = false;
      result.error = err?.message || String(err);
      console.error(`[KioskCommandExecutor] Error executing command ${normType}:`, err);
    }

    this.executionHistory.unshift(result);
    if (this.executionHistory.length > 50) {
      this.executionHistory.pop();
    }

    return result;
  }

  /**
   * Executes multiple commands in chronological sequence.
   */
  public async executeCommands(commands: Array<PendingCommand | any>): Promise<CommandExecutionResult[]> {
    if (!Array.isArray(commands) || commands.length === 0) {
      return [];
    }

    const results: CommandExecutionResult[] = [];
    for (const cmd of commands) {
      const res = await this.executeCommand(cmd);
      results.push(res);
    }
    return results;
  }

  /**
   * Internal direct executor helper for aliased commands.
   */
  private async executeDirect(type: string, payload: any, cmd: any): Promise<any> {
    const handler = this.customHandlers.get(type);
    if (handler) {
      return handler(payload, cmd);
    }
  }

  /**
   * Returns current maintenance state.
   */
  public isInMaintenance(): boolean {
    return this.inMaintenance;
  }

  /**
   * Returns current maintenance details including payload.
   */
  public getMaintenanceDetails(): { inMaintenance: boolean; payload?: any } {
    return {
      inMaintenance: this.inMaintenance,
      payload: this.maintenancePayload
    };
  }

  /**
   * Manually sets maintenance mode locally (e.g. via technician toggle).
   */
  public setMaintenance(active: boolean, payload?: any): void {
    if (this.inMaintenance === active) return;

    this.inMaintenance = active;
    this.maintenancePayload = active ? payload || {} : null;

    this.notifyMaintenanceListeners(active, payload);

    if (typeof window !== 'undefined') {
      const eventName = active ? 'kiosk:enter-maintenance' : 'kiosk:exit-maintenance';
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { payload, enteredAt: new Date() }
        })
      );
    }
  }

  /**
   * Subscribes to maintenance mode changes.
   */
  public onMaintenanceChange(listener: MaintenanceChangeListener): () => void {
    this.maintenanceListeners.push(listener);
    return () => {
      this.maintenanceListeners = this.maintenanceListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Subscribes to manifest reload events.
   */
  public onManifestReload(listener: ManifestReloadListener): () => void {
    this.manifestReloadListeners.push(listener);
    return () => {
      this.manifestReloadListeners = this.manifestReloadListeners.filter((l) => l !== listener);
    };
  }

  private notifyMaintenanceListeners(active: boolean, payload?: any): void {
    this.maintenanceListeners.forEach((listener) => {
      try {
        listener(active, payload);
      } catch (err) {
        console.error('[KioskCommandExecutor] Error in maintenance listener:', err);
      }
    });
  }

  /**
   * Returns command execution logs.
   */
  public getExecutionHistory(): CommandExecutionResult[] {
    return [...this.executionHistory];
  }

  /**
   * Clears execution history logs.
   */
  public clearExecutionHistory(): void {
    this.executionHistory = [];
  }
}

export const kioskCommandExecutorService = new KioskCommandExecutorService();
