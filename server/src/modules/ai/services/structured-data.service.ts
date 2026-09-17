import mongoose from "mongoose";
import User from "../../auth/models/user.model.js";
import Organization from "../../organizations/models/organization.model.js";
import EmployeeAssignment from "../../assignments/models/assignment.model.js";

export class StructuredDataService {
  /**
   * Determine if user question targets structured application entities rather than policy documents.
   */
  isStructuredQuery(query: string): boolean {
    const q = query.toLowerCase().trim();

    // Manager / Leadership / Profile
    if (
      q.includes("who is my manager") ||
      q.includes("who is my supervisor") ||
      q.includes("who is the onboarding manager") ||
      q.includes("who is the admin") ||
      q.includes("what is my role") ||
      q.includes("what is my department") ||
      q.includes("my manager") ||
      q.includes("my buddy") ||
      q.includes("who is my buddy")
    ) {
      return true;
    }

    // Organization details
    if (
      q.includes("what is our company name") ||
      q.includes("what is the organization name") ||
      q.includes("company name") ||
      q.includes("what departments do we have") ||
      q.includes("list our departments")
    ) {
      return true;
    }

    // Onboarding progress and assignment metrics
    if (
      q.includes("how many employees have completed onboarding") ||
      q.includes("how many completed onboarding") ||
      q.includes("what is my onboarding progress") ||
      q.includes("how many active journeys") ||
      q.includes("my active tasks") ||
      q.includes("my assigned journeys")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Query authorized database records to provide accurate, factual structured responses.
   */
  async resolveStructuredQuery(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    query: string
  ): Promise<{ matched: boolean; answer: string; structuredSources?: string[] }> {
    const q = query.toLowerCase().trim();
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    // 1. Manager / Supervisor
    if (q.includes("who is my manager") || q.includes("who is my supervisor") || q.includes("my manager")) {
      const currentUser = await User.findOne({ _id: userObjectId, organizationId: orgObjectId });
      if (currentUser?.employment?.managerId) {
        const manager = await User.findOne({ _id: currentUser.employment.managerId, organizationId: orgObjectId });
        if (manager) {
          const mgrName = `${manager.profile?.firstName || ""} ${manager.profile?.lastName || ""}`.trim() || manager.auth.email;
          return {
            matched: true,
            answer: `Your designated manager is **${mgrName}** (${manager.auth.email}).`,
            structuredSources: ["Employee Profile (Directory)"],
          };
        }
      }
      return {
        matched: true,
        answer: "You do not currently have a direct manager assigned in your employee profile. Please contact workspace HR or an administrator.",
        structuredSources: ["Employee Profile (Directory)"],
      };
    }

    // 2. Onboarding Manager / Workspace Admin
    if (q.includes("who is the onboarding manager") || q.includes("who is the admin")) {
      const admin = await User.findOne({
        organizationId: orgObjectId,
        "permissions.role": { $in: ["admin", "owner"] },
        isDeleted: { $ne: true },
      });
      if (admin) {
        const adminName = `${admin.profile?.firstName || ""} ${admin.profile?.lastName || ""}`.trim() || admin.auth.email;
        return {
          matched: true,
          answer: `The primary onboarding administrator for your organization is **${adminName}** (${admin.auth.email}).`,
          structuredSources: ["Organization Administration Records"],
        };
      }
    }

    // 3. User's Assigned Buddy
    if (q.includes("buddy")) {
      const activeAssignment = await EmployeeAssignment.findOne({
        organizationId: orgObjectId,
        employeeId: userObjectId,
        buddyId: { $exists: true, $ne: null },
      }).populate("buddyId", "profile.firstName profile.lastName auth.email");

      if (activeAssignment && (activeAssignment as any).buddyId) {
        const buddy = (activeAssignment as any).buddyId;
        const buddyName = `${buddy.profile?.firstName || ""} ${buddy.profile?.lastName || ""}`.trim() || buddy.auth.email;
        return {
          matched: true,
          answer: `Your assigned onboarding buddy is **${buddyName}** (${buddy.auth.email}).`,
          structuredSources: ["Onboarding Buddy Assignment"],
        };
      }
      return {
        matched: true,
        answer: "You do not currently have an active onboarding buddy assigned. You can check the Buddy Program page for more details.",
        structuredSources: ["Onboarding Buddy Assignment"],
      };
    }

    // 4. User's Department and Role
    if (q.includes("what is my role") || q.includes("what is my department")) {
      const currentUser = await User.findOne({ _id: userObjectId, organizationId: orgObjectId });
      if (currentUser) {
        return {
          matched: true,
          answer: `According to your employee profile, your role is **${currentUser.permissions?.role || "Employee"}** and your title is **${currentUser.employment?.jobTitle || "Not Specified"}**.`,
          structuredSources: ["Employee Profile"],
        };
      }
    }

    // 5. Company Name & Department List
    if (q.includes("company name") || q.includes("organization name")) {
      const org = await Organization.findById(orgObjectId);
      if (org) {
        return {
          matched: true,
          answer: `Your organization is registered on Talnova as **${org.name}**.`,
          structuredSources: ["Organization Profile"],
        };
      }
    }

    if (q.includes("departments")) {
      const org = await Organization.findById(orgObjectId);
      const depts = (org as any)?.departments || [];
      if (depts.length > 0) {
        const deptNames = depts.map((d: any) => d.name).join(", ");
        return {
          matched: true,
          answer: `Your organization currently has **${depts.length}** configured department(s): ${deptNames}.`,
          structuredSources: ["Organization Settings"],
        };
      }
    }

    // 6. Onboarding Completion Metrics
    if (q.includes("completed onboarding") || q.includes("how many employees have completed")) {
      const totalCompleted = await EmployeeAssignment.countDocuments({
        organizationId: orgObjectId,
        status: "completed",
      });
      const totalAll = await EmployeeAssignment.countDocuments({
        organizationId: orgObjectId,
      });

      return {
        matched: true,
        answer: `In your organization, **${totalCompleted}** employee assignment(s) have been completed out of **${totalAll}** total registered assignment(s).`,
        structuredSources: ["Onboarding Progress Analytics"],
      };
    }

    // 7. Personal Onboarding Progress & Active Journeys
    if (q.includes("my onboarding progress") || q.includes("my active tasks") || q.includes("my assigned journeys")) {
      const assignments = await EmployeeAssignment.find({
        organizationId: orgObjectId,
        employeeId: userObjectId,
        status: { $in: ["in_progress", "assigned"] },
      }).limit(5);

      if (assignments.length > 0) {
        const journeyList = assignments.map((a) => `• Journey Progress: **${a.progress?.completionPercentage || 0}%** (Status: ${a.status})`).join("\n");
        return {
          matched: true,
          answer: `You currently have **${assignments.length} active onboarding assignment(s)**:\n\n${journeyList}\n\nVisit your Tasks or Journeys page to view next steps.`,
          structuredSources: ["Employee Journey Tracker"],
        };
      }

      return {
        matched: true,
        answer: "You currently have no pending onboarding assignments in progress. You are all caught up!",
        structuredSources: ["Employee Journey Tracker"],
      };
    }

    return { matched: false, answer: "" };
  }
}

export default StructuredDataService;
