import { apiClient } from '../../../api/client';
import { KioskEmergency, EmergencyBroadcastPayload, EmergencyClearPayload } from '../../../types/kiosk/emergency.types';
import { deviceIdentityService } from './device-identity.service';

export interface EmergencyStateListener {
  (emergency: KioskEmergency | null): void;
}

class EmergencySirenSynthesizer {
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private lfo: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private isMuted = false;

  public start(): void {
    if (this.isPlaying) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        const resumeAudio = () => {
          this.audioCtx?.resume();
          window.removeEventListener('click', resumeAudio);
          window.removeEventListener('touchstart', resumeAudio);
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('touchstart', resumeAudio);
      }

      const osc = this.audioCtx.createOscillator();
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      const masterGain = this.audioCtx.createGain();

      // Industrial Emergency Siren: Dual-tone European/US alarm oscillation
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, this.audioCtx.currentTime); // Base center frequency

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.8, this.audioCtx.currentTime); // 0.8 Hz sweep
      lfoGain.gain.setValueAtTime(250, this.audioCtx.currentTime); // Sweep +/- 250 Hz (400Hz - 900Hz)

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.audioCtx.currentTime);

      osc.connect(masterGain);
      masterGain.connect(this.audioCtx.destination);

      osc.start();
      lfo.start();

      this.oscillator = osc;
      this.lfo = lfo;
      this.gainNode = masterGain;
      this.isPlaying = true;
    } catch (err) {
      console.warn('[EmergencySiren] Audio synthesis unavailable or blocked by autoplay policy:', err);
    }
  }

  public stop(): void {
    if (!this.isPlaying) return;
    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
      }
      if (this.lfo) {
        this.lfo.stop();
        this.lfo.disconnect();
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
      }
    } catch (err) {
      console.warn('[EmergencySiren] Error stopping siren:', err);
    } finally {
      this.oscillator = null;
      this.lfo = null;
      this.audioCtx = null;
      this.gainNode = null;
      this.isPlaying = false;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.audioCtx.currentTime);
    }
    return this.isMuted;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export class EmergencyService {
  private activeEmergency: KioskEmergency | null = null;
  private listeners: Set<EmergencyStateListener> = new Set();
  private eventSource: EventSource | null = null;
  private pollIntervalId: any = null;
  private siren = new EmergencySirenSynthesizer();
  private currentOrgId: string | null = null;

  constructor() {
    // Check initial memory or sessionStorage if reloaded during emergency
    try {
      const stored = sessionStorage.getItem('talnova_active_emergency');
      if (stored) {
        this.activeEmergency = JSON.parse(stored);
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }

  public isEmergencyActive(): boolean {
    return Boolean(this.activeEmergency && this.activeEmergency.isActive);
  }

  public getActiveEmergency(): KioskEmergency | null {
    return this.activeEmergency;
  }

  public getSiren(): EmergencySirenSynthesizer {
    return this.siren;
  }

  public subscribe(listener: EmergencyStateListener): () => void {
    this.listeners.add(listener);
    listener(this.activeEmergency);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activeEmergency);
      } catch (err) {
        console.error('[EmergencyService] Listener error:', err);
      }
    }
  }

  /**
   * Set emergency state locally and emit custom DOM events
   */
  public setEmergencyState(emergency: KioskEmergency | null): void {
    const wasActive = Boolean(this.activeEmergency && this.activeEmergency.isActive);
    const nowActive = Boolean(emergency && emergency.isActive);

    this.activeEmergency = emergency;

    try {
      if (emergency && emergency.isActive) {
        sessionStorage.setItem('talnova_active_emergency', JSON.stringify(emergency));
      } else {
        sessionStorage.removeItem('talnova_active_emergency');
      }
    } catch {
      // Ignore sessionStorage error
    }

    this.notifyListeners();

    if (nowActive && emergency) {
      // Play audio siren if configured
      if (emergency.soundSiren) {
        this.siren.start();
      }

      // Dispatch global window event
      window.dispatchEvent(
        new CustomEvent('talnova:kiosk:emergency', {
          detail: emergency,
          bubbles: true
        })
      );
    } else if (wasActive && !nowActive) {
      this.siren.stop();

      // Dispatch clear event
      window.dispatchEvent(
        new CustomEvent('talnova:kiosk:emergency_cleared', {
          detail: { clearedAt: new Date().toISOString() },
          bubbles: true
        })
      );
    }
  }

  /**
   * Initialize Real-time Server-Sent Events (SSE) connection
   */
  public startStream(organizationId?: string): void {
    const targetOrgId =
      organizationId ||
      deviceIdentityService.getStoredDevice()?.organizationId ||
      this.currentOrgId;

    if (!targetOrgId) {
      console.warn('[EmergencyService] Cannot start stream: organizationId missing');
      return;
    }

    if (this.currentOrgId === targetOrgId && this.eventSource) {
      return; // Already streaming for this org
    }

    this.currentOrgId = targetOrgId;
    this.stopStream();

    const baseUrl = (apiClient.defaults.baseURL || '/api/v1').replace(/\/$/, '');
    const streamUrl = `${baseUrl}/kiosk/emergency/stream?organizationId=${encodeURIComponent(targetOrgId)}`;

    try {
      const es = new EventSource(streamUrl, { withCredentials: false });

      es.addEventListener('emergency_broadcast', (e: MessageEvent) => {
        try {
          const emergency: KioskEmergency = JSON.parse(e.data);
          console.warn('[EmergencyService] Active emergency received via SSE:', emergency.title);
          this.setEmergencyState(emergency);
        } catch (parseErr) {
          console.error('[EmergencyService] Failed to parse emergency broadcast payload:', parseErr);
        }
      });

      es.addEventListener('emergency_cleared', () => {
        try {
          console.warn('[EmergencyService] Emergency cleared event received via SSE');
          this.setEmergencyState(null);
        } catch (parseErr) {
          console.error('[EmergencyService] Failed to handle emergency cleared event:', parseErr);
        }
      });

      es.onerror = () => {
        // SSE connection dropped; will auto-reconnect or fallback to heartbeat/polling
        console.warn('[EmergencyService] SSE stream disconnected, reconnecting in background...');
      };

      this.eventSource = es;
    } catch (err) {
      console.error('[EmergencyService] Failed to establish SSE stream:', err);
    }

    // Start background status poll as resilient safety net
    this.startPolling(targetOrgId);
  }

  public stopStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  private startPolling(organizationId: string): void {
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);

    // Initial check
    this.fetchEmergencyStatus(organizationId).catch(() => {
      // Ignore initial poll failure
    });

    // Poll every 15 seconds
    this.pollIntervalId = setInterval(() => {
      this.fetchEmergencyStatus(organizationId).catch(() => {
        // Ignore background poll failure
      });
    }, 15000);
  }

  /**
   * Query backend for active emergency
   */
  public async fetchEmergencyStatus(organizationId: string): Promise<KioskEmergency | null> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        active: boolean;
        data: KioskEmergency | null;
        emergency: KioskEmergency | null;
      }>('/kiosk/emergency/status', {
        params: { organizationId }
      });

      const emergency = response.data?.emergency || response.data?.data || null;
      if (emergency && emergency.isActive) {
        if (!this.activeEmergency || this.activeEmergency._id !== emergency._id) {
          this.setEmergencyState(emergency);
        }
      } else if (this.activeEmergency) {
        this.setEmergencyState(null);
      }
      return emergency;
    } catch (err) {
      // Failed poll; silent catch
      return null;
    }
  }

  /**
   * Broadcast emergency (Admin or Webhook)
   */
  public async broadcastEmergency(payload: EmergencyBroadcastPayload): Promise<KioskEmergency> {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: KioskEmergency;
      emergency: KioskEmergency;
    }>('/kiosk/emergency/broadcast', payload);

    const emergency = response.data?.emergency || response.data?.data;
    if (emergency) {
      this.setEmergencyState(emergency);
    }
    return emergency;
  }

  /**
   * Clear active emergency
   */
  public async clearEmergency(payload?: EmergencyClearPayload): Promise<void> {
    await apiClient.post('/kiosk/emergency/clear', payload || {});
    this.setEmergencyState(null);
  }
}

export const emergencyService = new EmergencyService();
export default emergencyService;
