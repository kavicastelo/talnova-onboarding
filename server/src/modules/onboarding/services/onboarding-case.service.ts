import crypto from "crypto";
import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import OnboardingCase, { IOnboardingCase, OnboardingCaseSource, OnboardingCaseState } from "../models/onboarding-case.model.js";
import OutboxEvent from "../models/outbox-event.model.js";

const transitions: Record<OnboardingCaseState, OnboardingCaseState[]> = {
  created: ["resolving", "cancelled"], resolving: ["provisioning", "provisioning_failed", "cancelled"],
  provisioning: ["ready", "provisioning_failed", "cancelled"], provisioning_failed: ["provisioning", "cancelled"],
  ready: ["active", "cancelled"], active: ["paused", "ready_for_handover", "cancelled"],
  paused: ["active", "cancelled"], ready_for_handover: ["handover_pending", "completed", "paused"],
  handover_pending: ["completed", "paused"], completed: ["archived"], archived: [], cancelled: [],
};

export class OnboardingCaseService {
  async createCase(input: { organizationId: string; employeeId: string; source: OnboardingCaseSource; idempotencyKey: string; createdBy?: string; correlationId?: string }): Promise<{ case: IOnboardingCase; created: boolean }> {
    const organizationId = new mongoose.Types.ObjectId(input.organizationId);
    const employeeId = new mongoose.Types.ObjectId(input.employeeId);
    const existing = await OnboardingCase.findOne({ organizationId, idempotencyKey: input.idempotencyKey, isDeleted: false });
    if (existing) return { case: existing, created: false };

    const correlationId = input.correlationId || crypto.randomUUID();
    try {
      const created = await OnboardingCase.create({ organizationId, employeeId, source: input.source, idempotencyKey: input.idempotencyKey, state: "created", transitions: [{ from: null, to: "created", at: new Date(), actorUserId: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : undefined }], createdBy: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : undefined, isDeleted: false });
      await OutboxEvent.create({ organizationId, aggregateType: "onboarding_case", aggregateId: created._id, eventName: "onboarding.case.created", correlationId, payload: { caseId: created._id.toString(), employeeId: employeeId.toString(), source: input.source } });
      return { case: created, created: true };
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicate = await OnboardingCase.findOne({ organizationId, idempotencyKey: input.idempotencyKey, isDeleted: false });
        if (duplicate) return { case: duplicate, created: false };
      }
      throw error;
    }
  }

  async transition(caseId: string, organizationId: string, to: OnboardingCaseState, actorUserId?: string, reason?: string) {
    const record = await OnboardingCase.findOne({ _id: caseId, organizationId, isDeleted: false });
    if (!record) throw new AppError(404, "NOT_FOUND", "Onboarding case not found");
    if (!transitions[record.state].includes(to)) throw new AppError(409, "INVALID_STATE_TRANSITION", `Cannot transition onboarding case from ${record.state} to ${to}`);
    const from = record.state;
    record.state = to;
    record.stateReason = reason;
    record.transitions.push({ from, to, at: new Date(), actorUserId: actorUserId ? new mongoose.Types.ObjectId(actorUserId) : undefined, reason });
    await record.save();
    await OutboxEvent.create({ organizationId: record.organizationId, aggregateType: "onboarding_case", aggregateId: record._id, eventName: `onboarding.case.${to}`, correlationId: crypto.randomUUID(), payload: { caseId: record._id.toString(), from, to, reason } });
    return record;
  }
}

export const onboardingCaseService = new OnboardingCaseService();
export default onboardingCaseService;
