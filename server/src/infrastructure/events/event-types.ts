import mongoose from "mongoose";

export type EventType =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "USER_ROLE_CHANGED"
  | "USER_DEPARTMENT_CHANGED"
  | "JOURNEY_ASSIGNED"
  | "JOURNEY_STARTED"
  | "JOURNEY_COMPLETED"
  | "JOURNEY_OVERDUE"
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "TASK_VERIFIED"
  | "TASK_AUTO_VERIFIED"
  | "TASK_OVERDUE"
  | "DOCUMENT_ASSIGNED"
  | "DOCUMENT_SIGNED"
  | "QUIZ_COMPLETED"
  | "LMS_PROGRESS_UPDATED"
  | "MILESTONE_REACHED"
  | "MILESTONE_COMPLETED"
  | "BUDDY_ASSIGNED"
  | "CHECKIN_DUE"
  | "CHECKIN_COMPLETED"
  | "MEETING_CREATED"
  | "MEETING_UPDATED"
  | "ONBOARDING_CASE_CREATED"
  | "ONBOARDING_CASE_STATE_CHANGED"
  | "ONBOARDING_NUDGE_SENT"
  | "DROP_OFF_RISK_DETECTED"
  | "WORKFLOW_RULE_CONFLICT_ARBITRATED";

export interface EventEnvelope<T = any> {
  eventId: string;
  eventName: EventType;
  eventVersion: string;
  occurredAt: Date;
  organizationId: mongoose.Types.ObjectId | string;
  actorId?: mongoose.Types.ObjectId | string;
  entityId?: mongoose.Types.ObjectId | string;
  payload: T;
  correlationId?: string;
}

export type EventHandler<T = any> = (event: EventEnvelope<T>) => Promise<void> | void;
