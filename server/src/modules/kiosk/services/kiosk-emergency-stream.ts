/**
 * Talnova Kiosk Shell - Emergency Real-Time Server-Sent Events (SSE) Manager (K-SEC-004)
 *
 * Dispatches real-time emergency evacuation broadcast overrides and cancellation
 * notifications to physical kiosk terminals via persistent SSE connections.
 */

import { FastifyReply } from "fastify";

export interface EmergencySubscriber {
  id: string;
  reply: FastifyReply;
  orgId: string;
  connectedAt: Date;
}

export class KioskEmergencyStreamManager {
  private subscribersByOrg: Map<string, Map<string, EmergencySubscriber>> = new Map();

  /**
   * Register a new persistent SSE terminal connection
   */
  addSubscriber(orgId: string, subscriberId: string, reply: FastifyReply): void {
    if (!this.subscribersByOrg.has(orgId)) {
      this.subscribersByOrg.set(orgId, new Map());
    }

    const orgSubscribers = this.subscribersByOrg.get(orgId)!;
    const subscriber: EmergencySubscriber = {
      id: subscriberId,
      reply,
      orgId,
      connectedAt: new Date()
    };

    orgSubscribers.set(subscriberId, subscriber);

    // Initial connection handshake event
    this.sendEventToSubscriber(subscriber, "connected", {
      status: "connected",
      subscriberId,
      orgId,
      timestamp: new Date().toISOString()
    });

    // Cleanup on socket termination
    const rawReq = reply.raw as any;
    if (rawReq?.socket) {
      rawReq.socket.on("close", () => {
        this.removeSubscriber(orgId, subscriberId);
      });
    }
  }

  /**
   * Remove a subscriber upon connection close
   */
  removeSubscriber(orgId: string, subscriberId: string): void {
    const orgSubscribers = this.subscribersByOrg.get(orgId);
    if (orgSubscribers) {
      orgSubscribers.delete(subscriberId);
      if (orgSubscribers.size === 0) {
        this.subscribersByOrg.delete(orgId);
      }
    }
  }

  /**
   * Dispatches an emergency evacuation broadcast override event to all online terminals of an organization
   */
  broadcastEmergency(orgId: string, emergencyData: any): number {
    const orgSubscribers = this.subscribersByOrg.get(orgId);
    if (!orgSubscribers || orgSubscribers.size === 0) {
      return 0;
    }

    let count = 0;
    for (const subscriber of orgSubscribers.values()) {
      const ok = this.sendEventToSubscriber(subscriber, "emergency_broadcast", emergencyData);
      if (ok) count++;
    }
    return count;
  }

  /**
   * Dispatches an emergency cancellation event to all terminals of an organization
   */
  broadcastClear(orgId: string, clearData: any = { cleared: true }): number {
    const orgSubscribers = this.subscribersByOrg.get(orgId);
    if (!orgSubscribers || orgSubscribers.size === 0) {
      return 0;
    }

    let count = 0;
    for (const subscriber of orgSubscribers.values()) {
      const ok = this.sendEventToSubscriber(subscriber, "emergency_cleared", {
        ...clearData,
        clearedAt: new Date().toISOString()
      });
      if (ok) count++;
    }
    return count;
  }

  /**
   * Transmit a formatted SSE frame
   */
  private sendEventToSubscriber(
    subscriber: EmergencySubscriber,
    eventType: string,
    data: any
  ): boolean {
    try {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      subscriber.reply.raw.write(`event: ${eventType}\ndata: ${payload}\n\n`);
      return true;
    } catch (err) {
      this.removeSubscriber(subscriber.orgId, subscriber.id);
      return false;
    }
  }

  /**
   * Returns active subscriber count for monitoring
   */
  getSubscriberCount(orgId?: string): number {
    if (orgId) {
      return this.subscribersByOrg.get(orgId)?.size || 0;
    }
    let total = 0;
    for (const map of this.subscribersByOrg.values()) {
      total += map.size;
    }
    return total;
  }
}

export const kioskEmergencyStream = new KioskEmergencyStreamManager();
export default kioskEmergencyStream;
