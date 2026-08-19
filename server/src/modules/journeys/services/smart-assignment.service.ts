import mongoose from "mongoose";
import Journey, { IJourney } from "../models/journey.model.js";
import User from "../../auth/models/user.model.js";
import EmployeeAssignment from "../../assignments/models/assignment.model.js";
import EmployeeAssignmentService from "../../assignments/services/assignment.service.js";
import AssignmentRepository from "../../assignments/repositories/assignment.repository.js";
import AppError from "../../../common/errors/app-error.js";

const assignmentService = new EmployeeAssignmentService(new AssignmentRepository());

export interface SmartAssignmentPreviewResult {
  journeyId: string;
  journeyTitle: string;
  totalMatchingEmployees: number;
  alreadyAssignedCount: number;
  netNewEnrolleesCount: number;
  matchingEmployees: Array<{
    _id: string;
    fullName: string;
    email: string;
    department?: string;
    jobTitle?: string;
    location?: string;
    isAlreadyAssigned: boolean;
  }>;
}

export class SmartAssignmentService {
  /**
   * Evaluate targeting rules against active organization users
   */
  async findMatchingEmployees(
    orgId: string | mongoose.Types.ObjectId,
    audienceRules: IJourney["audience"]
  ) {
    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    };

    const conditions: any[] = [];

    if (audienceRules?.departmentNames && audienceRules.departmentNames.length > 0) {
      conditions.push({
        "employment.department": {
          $in: audienceRules.departmentNames.map((d) => new RegExp(`^${d}$`, "i")),
        },
      });
    }

    if (audienceRules?.jobTitleNames && audienceRules.jobTitleNames.length > 0) {
      conditions.push({
        $or: [
          { "employment.jobTitle": { $in: audienceRules.jobTitleNames.map((j) => new RegExp(`^${j}$`, "i")) } },
          { "employment.designation": { $in: audienceRules.jobTitleNames.map((j) => new RegExp(`^${j}$`, "i")) } },
        ],
      });
    }

    if (audienceRules?.locations && audienceRules.locations.length > 0) {
      conditions.push({
        "profile.location": { $in: audienceRules.locations.map((l) => new RegExp(`^${l}$`, "i")) },
      });
    }

    if (audienceRules?.employmentTypes && audienceRules.employmentTypes.length > 0) {
      conditions.push({
        "employment.employmentType": { $in: audienceRules.employmentTypes },
      });
    }

    if (conditions.length > 0) {
      query.$and = conditions;
    }

    return User.find(query).select("profile auth.email employment");
  }

  /**
   * Dry-run preview for smart journey auto-assignment
   */
  async previewSmartAssignment(
    orgId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId
  ): Promise<SmartAssignmentPreviewResult> {
    const journey = await Journey.findOne({
      _id: journeyId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Journey not found");
    }

    const matchingUsers = await this.findMatchingEmployees(orgId, journey.audience);

    // Find existing assignments for this journey
    const existingAssignments = await EmployeeAssignment.find({
      organizationId: orgId,
      "journey.journeyId": journeyId,
      status: { $ne: "expired" },
    }).select("employeeId status");

    const assignedUserIds = new Set(existingAssignments.map((a) => a.employeeId.toString()));

    const matchingEmployees = matchingUsers.map((u) => {
      const userIdStr = u._id.toString();
      const isAlreadyAssigned = assignedUserIds.has(userIdStr);
      return {
        _id: userIdStr,
        fullName: `${u.profile?.firstName} ${u.profile?.lastName}`,
        email: u.auth?.email || "",
        department: u.employment?.department,
        jobTitle: u.employment?.jobTitle || u.employment?.designation,
        location: u.profile?.location,
        isAlreadyAssigned,
      };
    });

    const totalMatchingEmployees = matchingEmployees.length;
    const alreadyAssignedCount = matchingEmployees.filter((m) => m.isAlreadyAssigned).length;
    const netNewEnrolleesCount = totalMatchingEmployees - alreadyAssignedCount;

    return {
      journeyId: journey._id.toString(),
      journeyTitle: journey.title,
      totalMatchingEmployees,
      alreadyAssignedCount,
      netNewEnrolleesCount,
      matchingEmployees,
    };
  }

  /**
   * Bulk execute smart journey auto-assignment for matching employees
   */
  async executeSmartAssignment(
    orgId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId,
    assignedByUserId: string | mongoose.Types.ObjectId,
    options?: { overrideDueDate?: Date }
  ): Promise<{ assignedCount: number; skippedCount: number; message: string }> {
    const preview = await this.previewSmartAssignment(orgId, journeyId);
    const unassignedEmployees = preview.matchingEmployees.filter((m) => !m.isAlreadyAssigned);

    let assignedCount = 0;
    let skippedCount = preview.alreadyAssignedCount;

    for (const emp of unassignedEmployees) {
      try {
        await assignmentService.assignJourney(
          orgId,
          emp._id,
          journeyId,
          assignedByUserId,
          {
            dueDate: options?.overrideDueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          }
        );
        assignedCount++;
      } catch (err: any) {
        skippedCount++;
      }
    }

    return {
      assignedCount,
      skippedCount,
      message: `Successfully smart-assigned journey "${preview.journeyTitle}" to ${assignedCount} employees. (${skippedCount} already assigned/skipped)`,
    };
  }

  /**
   * Auto-enroll new hire into matching published journeys upon user creation
   */
  async autoEnrollNewHire(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const user = await User.findOne({ _id: userId, organizationId: orgId, isDeleted: false });
    if (!user) return 0;

    // Find all published journeys with autoEnrollNewHires enabled
    const journeys = await Journey.find({
      organizationId: orgId,
      "publishing.status": "published",
      "audience.autoEnrollNewHires": true,
      isDeleted: false,
    });

    let autoEnrolledCount = 0;

    for (const journey of journeys) {
      const matchingUsers = await this.findMatchingEmployees(orgId, journey.audience);
      const isMatch = matchingUsers.some((u) => u._id.toString() === userId.toString());

      if (isMatch) {
        try {
          await assignmentService.assignJourney(
            orgId,
            userId,
            journey._id,
            journey.createdBy,
            {
              dueDate: new Date(
                Date.now() + (journey.audience.startDateOffsetDays || 14) * 24 * 60 * 60 * 1000
              ),
            }
          );
          autoEnrolledCount++;
        } catch (err: any) {
          // Already assigned or skipped
        }
      }
    }

    return autoEnrolledCount;
  }
}

export const smartAssignmentService = new SmartAssignmentService();
export default smartAssignmentService;
