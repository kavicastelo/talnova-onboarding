import {
  OrganizationId,
  DeviceId,
  JourneyId,
  Timestamp,
  StepId,
} from "./common.types.js";

/**
 * State machine status values for discrete kiosk sessions (ADR-001, DEF-004).
 */
export const KIOSK_SESSION_STATUSES = [
  "active",
  "awaiting_supervisor",
  "completed",
  "aborted",
  "timed_out",
] as const;

export type KioskSessionStatus = typeof KIOSK_SESSION_STATUSES[number];

/**
 * Permitted verification methods for supervisor witness attestation (ADR-008).
 */
export const SUPERVISOR_WITNESS_METHODS = ["pin", "badge", "biometric"] as const;

export type SupervisorWitnessMethod = typeof SUPERVISOR_WITNESS_METHODS[number];

/**
 * Supervisor co-signature and attestation metadata.
 */
export interface KioskSupervisorWitness {
  readonly supervisorId: string;
  readonly witnessedAt: Timestamp;
  readonly method: SupervisorWitnessMethod;
}

/**
 * Discrete, first-class session entity tracking journey execution on a kiosk terminal (ADR-001, DEF-004).
 */
export interface KioskSession {
  readonly _id: string;
  readonly organizationId: OrganizationId;
  readonly deviceId: DeviceId;
  readonly journeyId: JourneyId;
  readonly journeyVersionId?: string; // Pinned immutable version snapshot ID (ADR-006)
  readonly versionNumber: number;
  readonly userId?: string; // Optional identified employee user ID (ADR-002)
  readonly sessionToken: string; // Ephemeral execution JWT
  readonly status: KioskSessionStatus;
  readonly startedAt: Timestamp;
  readonly completedAt?: Timestamp;
  readonly durationSeconds: number;
  readonly currentStepId: StepId;
  readonly completedStepIds: readonly StepId[];
  readonly ppeItemsVerified: readonly string[];
  readonly quizScore?: number;
  readonly supervisorWitness?: KioskSupervisorWitness;
  readonly verificationChecksum?: string; // SHA-256 HMAC of session completion facts
  readonly isOfflineSync: boolean;
  readonly clientSessionId?: string; // Idempotent offline sync identifier (UUIDv4)
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}
