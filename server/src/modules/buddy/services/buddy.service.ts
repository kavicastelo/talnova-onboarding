import mongoose from "mongoose";
import BuddyProfile, { IBuddyProfile } from "../models/buddy-profile.model.js";
import BuddyAssignment, { IBuddyAssignment } from "../models/buddy-assignment.model.js";
import User from "../../auth/models/user.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";
import { CalendarService } from "../../calendar/services/calendar.service.js";
import eventBus from "../../../infrastructure/events/event-bus.js";

const notificationService = new NotificationService(new NotificationRepository());
const calendarService = new CalendarService();

export class BuddyService {
  /**
   * Register or Update Buddy Profile
   */
  async registerBuddyProfile(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: Partial<IBuddyProfile>
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const user = await User.findOne({ _id: userObjectId, organizationId: orgObjectId, isDeleted: false });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    let profile = await BuddyProfile.findOne({ organizationId: orgObjectId, userId: userObjectId });

    if (!profile) {
      profile = await BuddyProfile.create({
        organizationId: orgObjectId,
        userId: userObjectId,
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
        maxMentees: data.maxMentees || 3,
        skills: data.skills || [],
        languages: (data as any).languages || [],
        department: user.employment?.department || "General",
        jobTitle: user.employment?.jobTitle || "Team Member",
        bio: data.bio,
      });
    } else {
      if (data.isAvailable !== undefined) profile.isAvailable = data.isAvailable;
      if (data.maxMentees) profile.maxMentees = data.maxMentees;
      if (data.skills) profile.skills = data.skills;
      if ((data as any).languages) (profile as any).languages = (data as any).languages;
      if (data.bio !== undefined) profile.bio = data.bio;
      await profile.save();
    }

    return profile;
  }

  /**
   * Get Current User Buddy Profile
   */
  async getBuddyProfile(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    return BuddyProfile.findOne({ organizationId: orgObjectId, userId: userObjectId });
  }

  /**
   * List available buddies in organization
   */
  async listAvailableBuddies(orgId: string | mongoose.Types.ObjectId) {
    return BuddyProfile.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isAvailable: true,
      $expr: { $lt: ["$currentMenteeCount", "$maxMentees"] },
    }).populate("userId", "profile auth employment");
  }

  /**
   * Assign Buddy to New Hire (BUD-001, BUD-002, BUD-003)
   */
  async assignBuddy(
    orgId: string | mongoose.Types.ObjectId,
    newHireUserId: string | mongoose.Types.ObjectId,
    buddyUserId: string | mongoose.Types.ObjectId,
    assignedByUserId: string | mongoose.Types.ObjectId,
    templateName?: string,
    matchScore?: number,
    matchCriteria?: any
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const newHireObjectId = new mongoose.Types.ObjectId(newHireUserId);
    const buddyObjectId = new mongoose.Types.ObjectId(buddyUserId);

    if (newHireObjectId.toString() === buddyObjectId.toString()) {
      throw new AppError(400, "CANNOT_PAIR_SELF", "Cannot pair an employee with themselves as buddy");
    }

    const newHire = await User.findOne({ _id: newHireObjectId, organizationId: orgObjectId, isDeleted: false });
    if (!newHire) {
      throw new AppError(404, "NOT_FOUND", "New hire employee not found");
    }

    const buddy = await User.findOne({ _id: buddyObjectId, organizationId: orgObjectId, isDeleted: false });
    if (!buddy) {
      throw new AppError(404, "NOT_FOUND", "Buddy user not found");
    }

    // Re-assign previous active buddy assignment if exists (Alternative path: Buddy re-assignment)
    const existing = await BuddyAssignment.findOne({
      organizationId: orgObjectId,
      newHireUserId: newHireObjectId,
      status: "active",
      isDeleted: false,
    });
    if (existing) {
      existing.status = "reassigned";
      await existing.save();
      await BuddyProfile.findOneAndUpdate(
        { organizationId: orgObjectId, userId: existing.buddyUserId },
        { $inc: { currentMenteeCount: -1 } }
      );
    }

    // Seed Buddy Checklist Template
    let checklist = [
      { title: "Conduct virtual welcome coffee & intro", stage: "day_1", completed: false },
      { title: "Introduce mentee to engineering channel on Slack", stage: "day_1", completed: false },
      { title: "Help with IT tools & Slack channel setup", stage: "day_1", completed: false },
      { title: "Introduce new hire to team members", stage: "week_1", completed: false },
      { title: "Conduct 1-on-1 week 1 check-in meeting", stage: "week_1", completed: false },
      { title: "Conduct Day 30 peer support review", stage: "month_1", completed: false },
    ];

    if (templateName === "Technical Deep Dive & Tooling") {
      checklist = [
        { title: "Review dev environment & repo permissions", stage: "day_1", completed: false },
        { title: "Walkthrough CI/CD and deployment pipelines", stage: "day_1", completed: false },
        { title: "Pair-program on first starter issue", stage: "week_1", completed: false },
        { title: "Architecture & systems overview", stage: "week_1", completed: false },
      ];
    } else if (templateName === "Leadership & Executive Fast Track") {
      checklist = [
        { title: "Executive team intro & organizational strategy sync", stage: "day_1", completed: false },
        { title: "Review department OKRs & KPI scorecards", stage: "week_1", completed: false },
        { title: "Cross-functional stakeholder introductions", stage: "week_1", completed: false },
      ];
    }

    const assignment = await BuddyAssignment.create({
      organizationId: orgObjectId,
      buddyUserId: buddyObjectId,
      newHireUserId: newHireObjectId,
      assignedBy: new mongoose.Types.ObjectId(assignedByUserId),
      status: "active",
      checklist,
      communicationLinks: {
        email: buddy.auth?.email,
      },
      matchScore,
      matchCriteria,
    });

    // Update buddy mentee count
    await BuddyProfile.findOneAndUpdate(
      { organizationId: orgObjectId, userId: buddyObjectId },
      { $inc: { currentMenteeCount: 1 } },
      { upsert: true }
    );

    // Send notifications to both
    const newHireName = `${newHire.profile?.firstName} ${newHire.profile?.lastName}`;
    const buddyName = `${buddy.profile?.firstName} ${buddy.profile?.lastName}`;

    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: newHireUserId,
      type: "journey_assigned",
      title: "Your Onboarding Buddy is Assigned!",
      message: `Meet ${buddyName}, your designated onboarding buddy! Reach out for help and peer support.`,
      priority: "high",
    });

    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: buddyUserId,
      type: "journey_assigned",
      title: "New Onboarding Mentee Assigned",
      message: `You have been paired as the onboarding buddy for ${newHireName}. Review your buddy checklist!`,
      priority: "high",
    });

    // Automatically provision initial 1-on-1 meeting invite via CalendarService (Prompt 07 Step 2)
    try {
      const meetingStart = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days out
      meetingStart.setHours(10, 0, 0, 0);
      const meetingEnd = new Date(meetingStart.getTime() + 30 * 60 * 1000); // 30 min coffee

      await calendarService.createMeetingEvent(orgId, buddyObjectId, {
        title: `Welcome Coffee & Intro: ${buddyName} & ${newHireName}`,
        description: "Initial 1-on-1 onboarding buddy coffee chat. Suggested topics: Team culture, tool setup Q&A, and favorite coffee spots.",
        category: "buddy_coffee",
        attendeeUserIds: [buddyObjectId.toString(), newHireObjectId.toString()],
        startTime: meetingStart,
        endTime: meetingEnd,
        locationUrl: "Virtual Lounge / Office Café",
      });
    } catch (calErr) {
      console.warn("[BuddyService] Calendar meeting provisioning skipped or failed:", calErr);
    }

    // Publish BUDDY_ASSIGNED event
    try {
      await eventBus.publish({
        eventName: "BUDDY_ASSIGNED",
        organizationId: orgId,
        actorId: assignedByUserId,
        entityId: assignment._id as any,
        payload: {
          assignmentId: assignment._id.toString(),
          buddyUserId: buddyObjectId.toString(),
          newHireUserId: newHireObjectId.toString(),
          matchScore,
        },
      });
    } catch (e) {
      console.warn("[BuddyService] Failed to publish BUDDY_ASSIGNED event:", e);
    }

    return assignment;
  }

  /**
   * Get employee's assigned onboarding buddy
   */
  async getEmployeeBuddy(orgId: string | mongoose.Types.ObjectId, newHireUserId: string | mongoose.Types.ObjectId) {
    const assignment = await BuddyAssignment.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      newHireUserId: new mongoose.Types.ObjectId(newHireUserId),
      status: "active",
      isDeleted: false,
    }).populate("buddyUserId", "profile auth employment");

    return assignment;
  }

  /**
   * Get buddy's assigned mentees
   */
  async getBuddyMentees(orgId: string | mongoose.Types.ObjectId, buddyUserId: string | mongoose.Types.ObjectId) {
    return BuddyAssignment.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      buddyUserId: new mongoose.Types.ObjectId(buddyUserId),
      isDeleted: false,
    })
      .populate("newHireUserId", "profile auth employment")
      .sort({ assignedAt: -1 });
  }

  /**
   * List all organization buddy assignments
   */
  async listOrganizationAssignments(orgId: string | mongoose.Types.ObjectId) {
    return BuddyAssignment.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    })
      .populate("buddyUserId", "profile auth employment")
      .populate("newHireUserId", "profile auth employment")
      .sort({ assignedAt: -1 });
  }

  /**
   * Toggle Buddy Checklist Item Completion (BUD-004)
   */
  async updateChecklistTask(
    orgId: string | mongoose.Types.ObjectId,
    assignmentId: string | mongoose.Types.ObjectId,
    taskId: string,
    completed: boolean,
    actingUserId?: string | mongoose.Types.ObjectId,
    actingUserRole?: string
  ) {
    const assignment = await BuddyAssignment.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!assignment) {
      throw new AppError(404, "NOT_FOUND", "Buddy assignment not found");
    }

    if (actingUserId && actingUserRole !== "admin" && actingUserRole !== "owner") {
      const isBuddy = assignment.buddyUserId.toString() === actingUserId.toString();
      const isMentee = assignment.newHireUserId.toString() === actingUserId.toString();
      if (!isBuddy && !isMentee) {
        throw new AppError(403, "FORBIDDEN", "Only assigned buddy or mentee can toggle checklist items");
      }
    }

    const item = assignment.checklist.find((c) => c._id?.toString() === taskId || c.title === taskId);
    if (item) {
      item.completed = completed;
      item.completedAt = completed ? new Date() : undefined;
      await assignment.save();
    }

    return assignment;
  }

  /**
   * Add Ad-hoc Custom Task to Buddy Checklist (BUD-002)
   */
  async addCustomChecklistTask(
    orgId: string | mongoose.Types.ObjectId,
    assignmentId: string | mongoose.Types.ObjectId,
    taskData: { title: string; description?: string; stage?: "preboarding" | "day_1" | "week_1" | "month_1" },
    actingUserId?: string | mongoose.Types.ObjectId,
    actingUserRole?: string
  ) {
    const assignment = await BuddyAssignment.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!assignment) {
      throw new AppError(404, "NOT_FOUND", "Buddy assignment not found");
    }

    if (actingUserId && actingUserRole !== "admin" && actingUserRole !== "owner") {
      const isBuddy = assignment.buddyUserId.toString() === actingUserId.toString();
      const isMentee = assignment.newHireUserId.toString() === actingUserId.toString();
      if (!isBuddy && !isMentee) {
        throw new AppError(403, "FORBIDDEN", "Only assigned buddy or mentee can modify checklist items");
      }
    }

    assignment.checklist.push({
      title: taskData.title,
      description: taskData.description,
      stage: taskData.stage || "day_1",
      completed: false,
    } as any);

    await assignment.save();
    return assignment;
  }

  /**
   * Log 1-on-1 Buddy Check-In (BUD-005)
   */
  async logBuddyCheckin(
    orgId: string | mongoose.Types.ObjectId,
    assignmentId: string | mongoose.Types.ObjectId,
    payload: { notes: string; rating?: number; sentiment?: "positive" | "neutral" | "challenged" },
    actingUserId?: string | mongoose.Types.ObjectId,
    actingUserRole?: string
  ) {
    const assignment = await BuddyAssignment.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!assignment) {
      throw new AppError(404, "NOT_FOUND", "Buddy assignment not found");
    }

    if (actingUserId && actingUserRole !== "admin" && actingUserRole !== "owner") {
      const isBuddy = assignment.buddyUserId.toString() === actingUserId.toString();
      const isMentee = assignment.newHireUserId.toString() === actingUserId.toString();
      if (!isBuddy && !isMentee) {
        throw new AppError(403, "FORBIDDEN", "Only assigned buddy or mentee can log check-ins for this pairing");
      }
    }

    assignment.checkins.push({
      completedAt: new Date(),
      notes: payload.notes,
      rating: payload.rating || 5,
      sentiment: payload.sentiment || "positive",
    });

    await assignment.save();

    // Award gamification points for completing 1-on-1 buddy check-in
    try {
      const { GamificationService } = await import("../../gamification/services/gamification.service.js");
      const gamificationService = new GamificationService();
      const checkinIdx = assignment.checkins.length;
      await gamificationService.awardPoints(
        orgId,
        assignment.newHireUserId,
        "buddy_checkin",
        25,
        "Completed 1-on-1 buddy check-in meeting",
        `buddy_checkin_${assignment._id}_${checkinIdx}`
      );
    } catch (gErr) {
      console.warn("Could not award gamification points for buddy checkin:", gErr);
    }

    return assignment;
  }

  /**
   * Calculate Multi-Factor Buddy Compatibility Score (Prompt 07 Step 1)
   * Weights: Dept: 0.35, Loc/Timezone: 0.25, Language: 0.20, Capacity: 0.15, Skills: 0.05
   */
  calculateCompatibilityScore(
    newHire: any,
    candidateProfile: IBuddyProfile,
    candidateUser: any
  ): {
    score: number;
    criteria: {
      departmentScore: number;
      locationScore: number;
      languageScore: number;
      capacityScore: number;
      skillsScore: number;
    };
  } {
    // 1. Department Score (w = 0.35)
    // 1.0 exact match, 0.5 related cluster, 0.1 otherwise
    const hireDept = (newHire.employment?.department || "").trim().toLowerCase();
    const candidateDept = (
      candidateProfile.department ||
      candidateUser.employment?.department ||
      ""
    ).trim().toLowerCase();

    let departmentScore = 0.1;
    if (hireDept && candidateDept && hireDept === candidateDept) {
      departmentScore = 1.0;
    } else if (hireDept && candidateDept) {
      const clusters = [
        ["engineering", "tech", "technology", "it", "product", "software", "development", "qa", "devops", "systems"],
        ["sales", "marketing", "growth", "business development", "revenue", "partnerships", "commercial"],
        ["hr", "people", "talent", "operations", "admin", "recruiting", "legal", "compliance", "finance", "accounting"],
      ];
      const matchCluster = clusters.find(
        (c) => c.some((k) => hireDept.includes(k)) && c.some((k) => candidateDept.includes(k))
      );
      if (matchCluster) {
        departmentScore = 0.5;
      }
    }

    // 2. Location / Timezone Score (w = 0.25)
    // 1.0 same office/location or timezone within 2h, 0.2 if >6h difference, 0.6 default
    const hireLoc = (newHire.profile?.location || "").trim().toLowerCase();
    const candidateLoc = (candidateUser.profile?.location || "").trim().toLowerCase();
    const hireTz = (newHire.profile?.timezone || "").trim().toLowerCase();
    const candidateTz = (candidateUser.profile?.timezone || "").trim().toLowerCase();

    let locationScore = 0.6; // default reasonable proximity
    if (hireLoc && candidateLoc && (hireLoc === candidateLoc || hireLoc.includes(candidateLoc) || candidateLoc.includes(hireLoc))) {
      locationScore = 1.0;
    } else if (hireTz && candidateTz) {
      if (hireTz === candidateTz) {
        locationScore = 1.0;
      } else {
        // Try extracting timezone offsets if formatted as UTC+/-N or GMT+/-N
        const parseOffset = (tz: string): number | null => {
          const match = tz.match(/(?:utc|gmt)\s*([+-]\d+)/i);
          return match ? parseInt(match[1], 10) : null;
        };
        const offsetHire = parseOffset(hireTz);
        const offsetCand = parseOffset(candidateTz);
        if (offsetHire !== null && offsetCand !== null) {
          const diff = Math.abs(offsetHire - offsetCand);
          if (diff <= 2) locationScore = 1.0;
          else if (diff > 6) locationScore = 0.2;
          else locationScore = 0.5;
        }
      }
    }

    // 3. Language Score (w = 0.20)
    // 1.0 if shared working/native language, 0.2 otherwise
    const hireLang = (newHire.preferences?.language || "en").trim().toLowerCase();
    const candLanguages = (
      candidateProfile.languages && candidateProfile.languages.length > 0
        ? candidateProfile.languages
        : [candidateUser.preferences?.language || "en"]
    ).map((l: string) => l.trim().toLowerCase());

    const hasSharedLanguage = candLanguages.some(
      (cl: string) => cl === hireLang || cl.startsWith(hireLang) || hireLang.startsWith(cl)
    );
    const languageScore = hasSharedLanguage ? 1.0 : 0.2;

    // 4. Capacity Score (w = 0.15)
    // (maxMentees - currentMenteeCount) / maxMentees
    const maxMentees = Math.max(1, candidateProfile.maxMentees || 3);
    const currentMentees = candidateProfile.currentMenteeCount || 0;
    const availableCapacity = Math.max(0, maxMentees - currentMentees);
    const capacityScore = Math.min(1.0, availableCapacity / maxMentees);

    // 5. Skills Overlap Score (w = 0.05)
    // Jaccard index
    const candSkills = (candidateProfile.skills || []).map((s: string) => s.trim().toLowerCase());
    const hireSkills = ((newHire as any).skills || (newHire.employment?.jobTitle ? [newHire.employment.jobTitle] : [])).map(
      (s: string) => s.trim().toLowerCase()
    );

    let skillsScore = 0.4;
    if (hireSkills.length > 0 && candSkills.length > 0) {
      const setA = new Set(candSkills);
      const setB = new Set(hireSkills);
      let intersection = 0;
      for (const item of setA) {
        if (setB.has(item)) intersection++;
      }
      const union = new Set([...candSkills, ...hireSkills]).size;
      skillsScore = union > 0 ? intersection / union : 0.4;
    } else if (candSkills.length > 0) {
      skillsScore = 0.8;
    }

    // Composite Calculation
    const composite =
      0.35 * departmentScore +
      0.25 * locationScore +
      0.20 * languageScore +
      0.15 * capacityScore +
      0.05 * skillsScore;

    const finalScore = Math.round(composite * 100) / 100;

    return {
      score: finalScore,
      criteria: {
        departmentScore: Math.round(departmentScore * 100) / 100,
        locationScore: Math.round(locationScore * 100) / 100,
        languageScore: Math.round(languageScore * 100) / 100,
        capacityScore: Math.round(capacityScore * 100) / 100,
        skillsScore: Math.round(skillsScore * 100) / 100,
      },
    };
  }

  /**
   * Event-driven auto-assignment of buddies with Intelligent Multi-Factor Matching (Prompt 07)
   */
  async autoAssignBuddyToNewHire(
    orgId: string | mongoose.Types.ObjectId,
    newHireUserId: string | mongoose.Types.ObjectId
  ): Promise<{
    success: boolean;
    assignmentId?: string;
    buddyUserId?: string;
    matchScore?: number;
    matchCriteria?: any;
    reason?: string;
  }> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const newHireObjectId = new mongoose.Types.ObjectId(newHireUserId);

    const newHire = await User.findOne({
      _id: newHireObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });
    if (!newHire) {
      return { success: false, reason: "new_hire_not_found" };
    }

    // Fetch all active, available buddy profiles where currentMenteeCount < maxMentees
    const candidateProfiles = await BuddyProfile.find({
      organizationId: orgObjectId,
      isAvailable: true,
      userId: { $ne: newHireObjectId },
      $expr: { $lt: ["$currentMenteeCount", "$maxMentees"] },
    }).populate("userId", "profile auth employment preferences");

    const validCandidates = candidateProfiles.filter(
      (p) => p.userId && !(p.userId as any).isDeleted
    );

    // If zero available buddies found: escalate to HR Ops Exception Workbench
    if (validCandidates.length === 0) {
      const newHireName = `${newHire.profile?.firstName || ""} ${newHire.profile?.lastName || ""}`.trim() || "New Hire";
      const department = newHire.employment?.department || "General";

      const hrAdmins = await User.find({
        organizationId: orgObjectId,
        "permissions.role": { $in: ["admin", "owner"] },
        isDeleted: false,
      });

      for (const admin of hrAdmins) {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: admin._id,
          type: "manager_alert",
          title: "Buddy Matching Exception: Capacity Exhausted",
          message: `No available buddy for new hire ${newHireName} in ${department}. All mentors are at capacity or unavailable.`,
          priority: "high",
          data: {
            newHireUserId: newHireObjectId.toString(),
            department,
            reason: "no_buddies_available",
          },
        });
      }

      try {
        await eventBus.publish({
          eventName: "WORKFLOW_RULE_CONFLICT_ARBITRATED",
          organizationId: orgId,
          actorId: newHireObjectId.toString(),
          entityId: newHireObjectId as any,
          payload: {
            conflictType: "NO_BUDDY_AVAILABLE",
            newHireUserId: newHireObjectId.toString(),
            department,
            message: `No available buddy for new hire ${newHireName} in ${department}`,
          },
        });
      } catch (e) {
        console.warn("[BuddyService] Failed to publish buddy exhaustion event:", e);
      }

      return { success: false, reason: "no_buddies_available" };
    }

    // Score all candidate buddies against new hire profile
    const scoredCandidates = validCandidates.map((candidate) => {
      const candidateUser = candidate.userId as any;
      const { score, criteria } = this.calculateCompatibilityScore(newHire, candidate, candidateUser);
      return { candidate, score, criteria };
    });

    // Select candidate with highest composite score
    scoredCandidates.sort((a, b) => b.score - a.score);
    const chosen = scoredCandidates[0];

    const assignment = await this.assignBuddy(
      orgId,
      newHireObjectId,
      chosen.candidate.userId._id,
      chosen.candidate.userId._id,
      undefined,
      chosen.score,
      chosen.criteria
    );

    return {
      success: true,
      assignmentId: assignment._id.toString(),
      buddyUserId: chosen.candidate.userId._id.toString(),
      matchScore: chosen.score,
      matchCriteria: chosen.criteria,
    };
  }

  /**
   * Proactive Buddy Coaching Sentinel (Prompt 07 Step 2)
   * Scans active pairings across Week 1, Week 2, and Week 4 to dispatch conversational guidance nudges.
   */
  async scanBuddyCoachingNudges(orgId?: string | mongoose.Types.ObjectId): Promise<{
    processedCount: number;
    nudgesSentCount: number;
  }> {
    const query: any = {
      status: "active",
      isDeleted: false,
    };
    if (orgId) {
      query.organizationId = new mongoose.Types.ObjectId(orgId);
    }

    const activeAssignments = await BuddyAssignment.find(query)
      .populate("buddyUserId", "profile auth preferences")
      .populate("newHireUserId", "profile auth employment preferences");

    let nudgesSentCount = 0;
    const now = Date.now();

    for (const assignment of activeAssignments) {
      if (!assignment.buddyUserId || !assignment.newHireUserId) continue;

      const newHire = assignment.newHireUserId as any;
      const buddy = assignment.buddyUserId as any;
      const newHireName = `${newHire.profile?.firstName || ""} ${newHire.profile?.lastName || ""}`.trim() || "your mentee";

      const createdAt = new Date(assignment.createdAt).getTime();
      const daysActive = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

      assignment.coachingNudges = assignment.coachingNudges || {};
      const nudges = assignment.coachingNudges as any;

      let nudgeToSend: {
        stage: "week_1" | "week_2" | "week_4";
        field: "week1SentAt" | "week2SentAt" | "week4SentAt";
        title: string;
        message: string;
      } | null = null;

      if (daysActive >= 0 && daysActive < 7 && !nudges.week1SentAt) {
        nudgeToSend = {
          stage: "week_1",
          field: "week1SentAt",
          title: "Buddy Coaching: Week 1 Welcome Tip",
          message: `Tip: Your mentee ${newHireName} just started. Suggested agenda: Team culture, favorite coffee spots, tool setup Q&A.`,
        };
      } else if (daysActive >= 7 && daysActive < 21 && !nudges.week2SentAt) {
        nudgeToSend = {
          stage: "week_2",
          field: "week2SentAt",
          title: "Buddy Coaching: Week 2 Check-in Reminder",
          message: `Check-in Reminder: Did you have your 1-on-1 with ${newHireName}? Tap here to log quick notes in 30 seconds.`,
        };
      } else if (daysActive >= 21 && !nudges.week4SentAt) {
        nudgeToSend = {
          stage: "week_4",
          field: "week4SentAt",
          title: "Buddy Coaching: Week 4 Milestone Check",
          message: `Milestone Check: Month 1 is wrapping up for ${newHireName}. Review onboarding progress and celebrate initial wins!`,
        };
      }

      if (nudgeToSend) {
        await notificationService.createNotification({
          organizationId: assignment.organizationId,
          recipientUserId: buddy._id,
          type: "manager_alert",
          title: nudgeToSend.title,
          message: nudgeToSend.message,
          priority: "medium",
          data: {
            assignmentId: assignment._id.toString(),
            menteeUserId: newHire._id.toString(),
            stage: nudgeToSend.stage,
            deepLink: `/buddy`,
          },
        });

        if (!assignment.coachingNudges) {
          assignment.coachingNudges = {};
        }
        (assignment.coachingNudges as any)[nudgeToSend.field] = new Date();

        await assignment.save();
        nudgesSentCount++;
      }
    }

    return {
      processedCount: activeAssignments.length,
      nudgesSentCount,
    };
  }
}

export const buddyService = new BuddyService();
export default buddyService;
