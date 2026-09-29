import {
  OrganizationId,
  JourneyId,
  Timestamp,
} from "./common.types.js";

/**
 * Assignment target types supported by the M:N multi-journey assignment engine (ADR-005).
 */
export const ASSIGNMENT_TARGET_TYPES = ["device", "device_group", "site"] as const;

export type AssignmentTargetType = typeof ASSIGNMENT_TARGET_TYPES[number];

/**
 * Scheduling window rules for day-of-week and time-of-day constraints.
 */
export interface KioskAssignmentScheduling {
  readonly enabled: boolean;
  readonly startDate?: Timestamp;
  readonly endDate?: Timestamp;
  readonly daysOfWeek?: readonly number[]; // 0 = Sunday, 1 = Monday...
  readonly startTimeUtc?: string; // e.g. "06:00"
  readonly endTimeUtc?: string; // e.g. "18:00"
}

/**
 * First-class M:N entity mapping kiosk hardware/groups to journeys (ADR-001, DEF-003).
 */
export interface KioskDeviceAssignment {
  readonly _id: string;
  readonly organizationId: OrganizationId;
  readonly targetType: AssignmentTargetType;
  readonly targetId: string;
  readonly journeyId: JourneyId;
  readonly priority: number; // 0 = highest priority launcher ordering
  readonly isMandatory: boolean;
  readonly scheduling: KioskAssignmentScheduling;
  readonly isActive: boolean;
  readonly assignedBy: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}
