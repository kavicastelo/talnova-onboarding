import mongoose from "mongoose";
import BuddyProfile, { IBuddyProfile } from "../models/buddy-profile.model.js";
import BuddyAssignment, { IBuddyAssignment } from "../models/buddy-assignment.model.js";
import User from "../../auth/models/user.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";

const notificationService = new NotificationService(new NotificationRepository());

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
        department: user.employment?.department || "General",
        jobTitle: user.employment?.jobTitle || "Team Member",
        bio: data.bio,
      });
    } else {
      if (data.isAvailable !== undefined) profile.isAvailable = data.isAvailable;
      if (data.maxMentees) profile.maxMentees = data.maxMentees;
      if (data.skills) profile.skills = data.skills;
      if (data.bio !== undefined) profile.bio = data.bio;
      await profile.save();
    }

    return profile;
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
    assignedByUserId: string | mongoose.Types.ObjectId
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const newHireObjectId = new mongoose.Types.ObjectId(newHireUserId);
    const buddyObjectId = new mongoose.Types.ObjectId(buddyUserId);

    const newHire = await User.findOne({ _id: newHireObjectId, organizationId: orgObjectId, isDeleted: false });
    if (!newHire) {
      throw new AppError(404, "NOT_FOUND", "New hire employee not found");
    }

    const buddy = await User.findOne({ _id: buddyObjectId, organizationId: orgObjectId, isDeleted: false });
    if (!buddy) {
      throw new AppError(404, "NOT_FOUND", "Buddy user not found");
    }

    // Default Buddy Checklist
    const defaultChecklist = [
      { title: "Conduct virtual welcome coffee & intro", stage: "day_1", completed: false },
      { title: "Help with IT tools & Slack channel setup", stage: "day_1", completed: false },
      { title: "Introduce new hire to team members", stage: "week_1", completed: false },
      { title: "Conduct 1-on-1 week 1 check-in meeting", stage: "week_1", completed: false },
      { title: "Conduct Day 30 peer support review", stage: "month_1", completed: false },
    ];

    const assignment = await BuddyAssignment.create({
      organizationId: orgObjectId,
      buddyUserId: buddyObjectId,
      newHireUserId: newHireObjectId,
      assignedBy: new mongoose.Types.ObjectId(assignedByUserId),
      status: "active",
      checklist: defaultChecklist,
      communicationLinks: {
        email: buddy.auth?.email,
      },
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
   * Toggle Buddy Checklist Item Completion (BUD-004)
   */
  async updateChecklistTask(
    orgId: string | mongoose.Types.ObjectId,
    assignmentId: string | mongoose.Types.ObjectId,
    taskId: string,
    completed: boolean
  ) {
    const assignment = await BuddyAssignment.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!assignment) {
      throw new AppError(404, "NOT_FOUND", "Buddy assignment not found");
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
   * Log 1-on-1 Buddy Check-In (BUD-005)
   */
  async logBuddyCheckin(
    orgId: string | mongoose.Types.ObjectId,
    assignmentId: string | mongoose.Types.ObjectId,
    payload: { notes: string; rating?: number }
  ) {
    const assignment = await BuddyAssignment.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!assignment) {
      throw new AppError(404, "NOT_FOUND", "Buddy assignment not found");
    }

    assignment.checkins.push({
      completedAt: new Date(),
      notes: payload.notes,
      rating: payload.rating || 5,
    });

    await assignment.save();
    return assignment;
  }

  /**
   * Event-driven auto-assignment of buddies on USER_CREATED
   */
  async autoAssignBuddyToNewHire(
    orgId: string | mongoose.Types.ObjectId,
    newHireUserId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const availableBuddies = await this.listAvailableBuddies(orgId);
    if (availableBuddies.length === 0) return false;

    // Pick first available buddy
    const chosenBuddy = availableBuddies[0];
    await this.assignBuddy(orgId, newHireUserId, chosenBuddy.userId._id, chosenBuddy.userId._id);
    return true;
  }
}

export const buddyService = new BuddyService();
export default buddyService;
