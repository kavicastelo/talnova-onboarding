import mongoose from "mongoose";
import eventBus from "../../../infrastructure/events/event-bus.js";
import { EventEnvelope } from "../../../infrastructure/events/event-types.js";
import EmployeeAssignmentRepository from "../repositories/assignment.repository.js";
import EmployeeAssignmentService from "../services/assignment.service.js";

const assignmentService = new EmployeeAssignmentService(new EmployeeAssignmentRepository());

export function registerAssignmentSubscribers() {
  const isValidId = (id: any) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

  // Listen for TASK_COMPLETED
  eventBus.subscribe("TASK_COMPLETED", async (event: EventEnvelope) => {
    try {
      const employeeId = event.payload?.employeeId;
      const orgId = event.organizationId;
      if (isValidId(employeeId) && isValidId(orgId)) {
        await assignmentService.evaluateEmployeeAssignments(orgId, employeeId);
      }
    } catch (err) {
      console.error("[AssignmentSubscriber] Failed processing TASK_COMPLETED:", err);
    }
  });

  // Listen for DOCUMENT_SIGNED
  eventBus.subscribe("DOCUMENT_SIGNED", async (event: EventEnvelope) => {
    try {
      const employeeId = event.payload?.employeeId;
      const orgId = event.organizationId;
      if (isValidId(employeeId) && isValidId(orgId)) {
        await assignmentService.evaluateEmployeeAssignments(orgId, employeeId);
      }
    } catch (err) {
      console.error("[AssignmentSubscriber] Failed processing DOCUMENT_SIGNED:", err);
    }
  });

  // Listen for MILESTONE_COMPLETED
  eventBus.subscribe("MILESTONE_COMPLETED", async (event: EventEnvelope) => {
    try {
      const employeeId = event.payload?.employeeId;
      const orgId = event.organizationId;
      if (isValidId(employeeId) && isValidId(orgId)) {
        await assignmentService.evaluateEmployeeAssignments(orgId, employeeId);
      }
    } catch (err) {
      console.error("[AssignmentSubscriber] Failed processing MILESTONE_COMPLETED:", err);
    }
  });
}

export default registerAssignmentSubscribers;
