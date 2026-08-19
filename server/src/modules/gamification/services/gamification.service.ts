import mongoose from "mongoose";
import GamificationProfile from "../models/gamification-profile.model.js";
import User from "../../auth/models/user.model.js";

export const AVAILABLE_BADGES = [
  {
    badgeId: "first_step",
    name: "First Step",
    description: "Earned your first 50 XP in onboarding!",
    icon: "🌟",
    pointsRequired: 50,
  },
  {
    badgeId: "fast_learner",
    name: "Fast Learner",
    description: "Reached Level 3 onboarding proficiency!",
    icon: "🚀",
    levelRequired: 3,
  },
  {
    badgeId: "streak_master",
    name: "Streak Master",
    description: "Maintained a 3-day active learning streak!",
    icon: "🔥",
    streakRequired: 3,
  },
  {
    badgeId: "quiz_master",
    name: "Quiz Master",
    description: "Reached Level 5 with over 500 XP!",
    icon: "🎓",
    pointsRequired: 500,
  },
];

export class GamificationService {
  /**
   * Get or initialize employee gamification profile (GAM-001)
   */
  async getProfile(orgId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    let profile = await GamificationProfile.findOne({
      organizationId: orgObjectId,
      userId: userObjectId,
    });

    if (!profile) {
      profile = await GamificationProfile.create({
        organizationId: orgObjectId,
        userId: userObjectId,
        points: 0,
        level: 1,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: new Date(),
        unlockedBadges: [],
        pointHistory: [],
      });
    }

    return profile;
  }

  /**
   * Award points with anti-gaming rate limits (GAM-001)
   */
  async awardPoints(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    action: string,
    points: number,
    description: string
  ) {
    const profile = await this.getProfile(orgId, userId);

    // Anti-gaming rate limit check: Max 100 points for same action within 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentActionPoints = profile.pointHistory
      .filter((ph) => ph.action === action && new Date(ph.timestamp) >= oneHourAgo)
      .reduce((sum, ph) => sum + ph.points, 0);

    if (recentActionPoints + points > 150) {
      return profile; // Rate limited, skip awarding duplicate points
    }

    profile.points += points;
    profile.level = Math.floor(profile.points / 100) + 1;

    profile.pointHistory.unshift({
      action,
      points,
      description,
      timestamp: new Date(),
    });

    // Limit history log to last 50 entries
    if (profile.pointHistory.length > 50) {
      profile.pointHistory = profile.pointHistory.slice(0, 50);
    }

    await this.recordActivityStreakInternal(profile);
    await this.checkAndUnlockBadgesInternal(profile);

    await profile.save();
    return profile;
  }

  /**
   * Record learning activity streak (GAM-003)
   */
  async recordActivityStreak(orgId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId) {
    const profile = await this.getProfile(orgId, userId);
    await this.recordActivityStreakInternal(profile);
    await profile.save();
    return profile;
  }

  private async recordActivityStreakInternal(profile: any) {
    const now = new Date();
    const lastActive = profile.lastActiveDate ? new Date(profile.lastActiveDate) : null;

    if (!lastActive) {
      profile.currentStreak = 1;
      profile.longestStreak = Math.max(profile.longestStreak, 1);
      profile.lastActiveDate = now;
      return;
    }

    const isSameDay =
      now.getFullYear() === lastActive.getFullYear() &&
      now.getMonth() === lastActive.getMonth() &&
      now.getDate() === lastActive.getDate();

    if (isSameDay) return; // Already logged today

    const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      profile.currentStreak += 1;
      profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak);
    } else if (diffDays > 1) {
      profile.currentStreak = 1;
    }

    profile.lastActiveDate = now;
  }

  /**
   * Micro-credentials & Badges unlocking (GAM-002)
   */
  private async checkAndUnlockBadgesInternal(profile: any) {
    for (const b of AVAILABLE_BADGES) {
      const alreadyUnlocked = profile.unlockedBadges.some((ub: any) => ub.badgeId === b.badgeId);
      if (alreadyUnlocked) continue;

      let unlock = false;
      if (b.pointsRequired && profile.points >= b.pointsRequired) unlock = true;
      if (b.levelRequired && profile.level >= b.levelRequired) unlock = true;
      if (b.streakRequired && profile.currentStreak >= b.streakRequired) unlock = true;

      if (unlock) {
        profile.unlockedBadges.push({
          badgeId: b.badgeId,
          name: b.name,
          description: b.description,
          icon: b.icon,
          unlockedAt: new Date(),
        });
      }
    }
  }

  /**
   * Organization Leaderboard (GAM-004)
   */
  async getLeaderboard(orgId: string | mongoose.Types.ObjectId, limit = 20) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());

    const profiles = await GamificationProfile.find({ organizationId: orgObjectId })
      .sort({ points: -1 })
      .limit(limit)
      .populate("userId", "profile auth employment");

    return profiles.map((p, index) => {
      const user = p.userId as any;
      return {
        rank: index + 1,
        userId: user?._id?.toString() || p.userId.toString(),
        name: user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : "Employee",
        email: user?.auth?.email || "",
        department: user?.employment?.department || "General",
        points: p.points,
        level: p.level,
        currentStreak: p.currentStreak,
        badgesCount: p.unlockedBadges.length,
        badges: p.unlockedBadges,
      };
    });
  }
}
