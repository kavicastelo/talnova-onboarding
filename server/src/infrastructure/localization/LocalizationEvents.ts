import mongoose from "mongoose";
import { TranslationStatus } from "../../modules/localization/models/translation.model.js";
import { SupportedLocale } from "../../config/localization.config.js";

/**
 * LocalizationEvents
 *
 * Lightweight event type interfaces for localization domain events.
 * No external event bus required — implementations can use Node EventEmitter,
 * Fastify hooks, or any pub/sub mechanism.
 *
 * These interfaces define the contract only. Future subscribers can react to
 * events without coupling to the localization internals.
 */

export interface LocalizationEvent {
  readonly timestamp: Date;
  readonly entityType: string;
  readonly entityId: string;
}

export interface TranslationCreated extends LocalizationEvent {
  readonly type: "TranslationCreated";
  readonly field: string;
  readonly language: SupportedLocale;
  readonly status: TranslationStatus;
}

export interface TranslationUpdated extends LocalizationEvent {
  readonly type: "TranslationUpdated";
  readonly field: string;
  readonly language: SupportedLocale;
  readonly previousStatus: TranslationStatus;
  readonly newStatus: TranslationStatus;
  readonly version: number;
}

export interface TranslationApproved extends LocalizationEvent {
  readonly type: "TranslationApproved";
  readonly field: string;
  readonly language: SupportedLocale;
  readonly approvedBy: string;
  readonly version: number;
}

export interface SourceUpdated extends LocalizationEvent {
  readonly type: "SourceUpdated";
  readonly field: string;
  readonly newSourceVersion: number;
  readonly affectedLanguages: string[];
}

export interface LanguageAdded {
  readonly type: "LanguageAdded";
  readonly language: SupportedLocale;
  readonly displayName: string;
  readonly timestamp: Date;
}

/** Union of all localization event types */
export type LocalizationEventType =
  | TranslationCreated
  | TranslationUpdated
  | TranslationApproved
  | SourceUpdated
  | LanguageAdded;

/**
 * ILocalizationEventBus
 *
 * Interface for publishing and subscribing to localization events.
 * Implement with Node EventEmitter, Fastify hooks, or any event bus.
 * No implementation provided — keep pluggable.
 */
export interface ILocalizationEventBus {
  publish(event: LocalizationEventType): void;
  subscribe<T extends LocalizationEventType>(
    type: T["type"],
    handler: (event: T) => void | Promise<void>
  ): void;
  unsubscribe(type: string, handler: Function): void;
}

/**
 * NoOpEventBus — default implementation that discards all events.
 * Replace with a real implementation when needed.
 */
export class NoOpEventBus implements ILocalizationEventBus {
  publish(_event: LocalizationEventType): void {}
  subscribe<T extends LocalizationEventType>(_type: T["type"], _handler: (e: T) => void): void {}
  unsubscribe(_type: string, _handler: Function): void {}
}
