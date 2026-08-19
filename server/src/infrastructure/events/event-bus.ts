import crypto from "crypto";
import mongoose from "mongoose";
import { EventEnvelope, EventHandler, EventType } from "./event-types.js";

export class EventBus {
  private static instance: EventBus;
  private handlers: Map<EventType, Set<EventHandler>> = new Map();

  private constructor() {
    // Singleton
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe<T = any>(eventType: EventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);

    return () => {
      const set = this.handlers.get(eventType);
      if (set) {
        set.delete(handler as EventHandler);
      }
    };
  }

  public async publish<T = any>(params: {
    eventName: EventType;
    organizationId: mongoose.Types.ObjectId | string;
    actorId?: mongoose.Types.ObjectId | string;
    entityId?: mongoose.Types.ObjectId | string;
    payload: T;
    correlationId?: string;
  }): Promise<EventEnvelope<T>> {
    const envelope: EventEnvelope<T> = {
      eventId: crypto.randomUUID(),
      eventName: params.eventName,
      eventVersion: "1.0.0",
      occurredAt: new Date(),
      organizationId: params.organizationId,
      actorId: params.actorId,
      entityId: params.entityId,
      payload: params.payload,
      correlationId: params.correlationId || crypto.randomUUID(),
    };

    const subscribers = this.handlers.get(params.eventName);
    if (subscribers && subscribers.size > 0) {
      const promises = Array.from(subscribers).map(async (handler) => {
        try {
          await handler(envelope);
        } catch (error) {
          console.error(
            `[EventBus] Error handling event ${params.eventName} (${envelope.eventId}):`,
            error
          );
        }
      });
      await Promise.allSettled(promises);
    }

    return envelope;
  }

  public clearSubscribers(): void {
    this.handlers.clear();
  }
}

export const eventBus = EventBus.getInstance();
export default eventBus;
