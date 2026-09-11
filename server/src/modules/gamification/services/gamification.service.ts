import mongoose from "mongoose";
import GamificationProfile from "../models/gamification-profile.model.js";
import User from "../../auth/models/user.model.js";

export const AVAILABLE_BADGES = [
  {
    badgeId: "quick_starter",
    name: "Quick Starter",
    description: "Earned your first onboarding points!",
    icon: "⚡",
    pointsRequired: 25,
  },
  {
    badgeId: "first_step",
    name: "First Step",
    description: "Earned your first 50 points in onboarding!",
    icon: "🌟",
    pointsRequired: 50,
  },
  {
    badgeId: "first_signer",
    name: "First Signer",
    description: "Completed key onboarding documents!",
    icon: "✍️",
    actionRequired: "document_signed",
    pointsRequired: 100,
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
    description: "Reached Level 5 with over 500 points!",
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
   * Award points with anti-gaming rate limits & entity idempotency (GAM-001)
   */
  async awardPoints(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    action: string,
    points: number,
    description: string,
    referenceId?: string
  ) {
    const profile = await this.getProfile(orgId, userId);

    // 1. If referenceId is provided, enforce strict deduplication (anti-gaming idempotency)
    if (referenceId) {
      const alreadyAwarded = profile.pointHistory.some((ph) => ph.referenceId === referenceId);
      if (alreadyAwarded) {
        return profile; // Idempotent: points already earned for this specific entity
      }
    } else {
      // 2. Anti-gaming rate limit check for generic/manual claims: Max 150 points for same action within 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentActionPoints = profile.pointHistory
        .filter((ph) => ph.action === action && !ph.referenceId && new Date(ph.timestamp) >= oneHourAgo)
        .reduce((sum, ph) => sum + ph.points, 0);

      if (recentActionPoints + points > 150) {
        return profile; // Rate limited, skip awarding duplicate points
      }
    }

    profile.points += points;
    profile.level = Math.floor(profile.points / 100) + 1;

    profile.pointHistory.unshift({
      action,
      points,
      description,
      referenceId,
      timestamp: new Date(),
    });

    // Limit history log to last 50 entries
    if (profile.pointHistory.length > 50) {
      profile.pointHistory = profile.pointHistory.slice(0, 50);
    }

    await this.recordActivityStreakInternal(profile);
    await this.checkAndUnlockBadgesInternal(profile);

    profile.markModified("pointHistory");
    profile.markModified("unlockedBadges");

    await profile.save();
    return profile;
  }

  /**
   * Record learning activity streak (GAM-003)
   */
  async recordActivityStreak(orgId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId) {
    const profile = await this.getProfile(orgId, userId);
    await this.recordActivityStreakInternal(profile);
    await this.checkAndUnlockBadgesInternal(profile);
    profile.markModified("unlockedBadges");
    await profile.save();
    return profile;
  }

  private async recordActivityStreakInternal(profile: any) {
    const now = new Date();
    const lastActive = profile.lastActiveDate ? new Date(profile.lastActiveDate) : null;

    if (!lastActive) {
      profile.currentStreak = 1;
      profile.longestStreak = Math.max(profile.longestStreak || 0, 1);
      profile.lastActiveDate = now;
      return;
    }

    // Accurate calendar day difference based on UTC midnight boundaries
    const lastMidnight = Date.UTC(lastActive.getUTCFullYear(), lastActive.getUTCMonth(), lastActive.getUTCDate());
    const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const dayDiff = Math.round((nowMidnight - lastMidnight) / (24 * 60 * 60 * 1000));

    if (dayDiff === 0) {
      // Same calendar day: streak already credited today, update timestamp only
      profile.lastActiveDate = now;
      return;
    }

    if (dayDiff === 1) {
      // Exactly consecutive calendar day: increment streak
      profile.currentStreak = (profile.currentStreak || 0) + 1;
      profile.longestStreak = Math.max(profile.longestStreak || 0, profile.currentStreak);
    } else if (dayDiff > 1) {
      // Missed at least one full calendar day: reset streak to 1
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
      if ((b as any).actionRequired && profile.pointHistory.some((ph: any) => ph.action === (b as any).actionRequired)) {
        unlock = true;
      }
      if (b.pointsRequired && profile.points >= b.pointsRequired) unlock = true;
      if ((b as any).levelRequired && profile.level >= (b as any).levelRequired) unlock = true;
      if ((b as any).streakRequired && profile.currentStreak >= (b as any).streakRequired) unlock = true;

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
