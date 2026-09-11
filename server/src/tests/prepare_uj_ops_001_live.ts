import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../modules/auth/models/user.model.js';
import Organization from '../modules/organizations/models/organization.model.js';
import GamificationProfile from '../modules/gamification/models/gamification-profile.model.js';
import { AVAILABLE_BADGES } from '../modules/gamification/services/gamification.service.js';

dotenv.config();

async function prepare() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Find Talnova Dev or primary active organization
  const devOrg = await Organization.findOne({ name: 'Talnova Dev', isDeleted: false }) ||
                 await Organization.findOne({ isDeleted: false });

  if (!devOrg) {
    console.error('No organization found');
    await mongoose.disconnect();
    return;
  }

  console.log('Target Organization:', devOrg._id, devOrg.name);

  // Find all users in this organization
  const orgUsers = await User.find({ organizationId: devOrg._id, isDeleted: { $ne: true } });
  console.log('Found users in org:', orgUsers.map(u => ({ id: u._id, email: u.auth?.email, name: u.profile?.fullName })));

  // If fewer than 5 users, create cohort members
  const cohortNames = [
    { first: "Sarah", last: "Connor", email: "sarah.connor@talnova.dev", dept: "Engineering", points: 420, streak: 8 },
    { first: "Michael", last: "Chang", email: "michael.chang@talnova.dev", dept: "Product", points: 350, streak: 5 },
    { first: "Priya", last: "Patel", email: "priya.patel@talnova.dev", dept: "Design", points: 280, streak: 4 },
    { first: "David", last: "Kim", email: "david.kim@talnova.dev", dept: "Marketing", points: 190, streak: 2 },
    { first: "Elena", last: "Rostova", email: "elena.rostova@talnova.dev", dept: "Customer Success", points: 140, streak: 3 },
  ];

  for (const c of cohortNames) {
    let u = await User.findOne({ organizationId: devOrg._id, "auth.email": c.email });
    if (!u) {
      u = await User.create({
        organizationId: devOrg._id,
        auth: {
          email: c.email,
          passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        },
        profile: {
          firstName: c.first,
          lastName: c.last,
          fullName: `${c.first} ${c.last}`,
        },
        employment: {
          department: c.dept,
          jobTitle: "Onboarding Specialist",
          status: "active",
        },
        permissions: {
          role: "employee",
        },
      });
    }

    // Upsert gamification profile
    let prof = await GamificationProfile.findOne({ organizationId: devOrg._id, userId: u._id });
    if (!prof) {
      prof = await GamificationProfile.create({
        organizationId: devOrg._id,
        userId: u._id,
        points: c.points,
        level: Math.floor(c.points / 100) + 1,
        currentStreak: c.streak,
        longestStreak: c.streak + 2,
        lastActiveDate: new Date(),
        unlockedBadges: AVAILABLE_BADGES.filter(b => (b.pointsRequired && c.points >= b.pointsRequired) || (b.streakRequired && c.streak >= b.streakRequired)).map(b => ({
          badgeId: b.badgeId,
          name: b.name,
          description: b.description,
          icon: b.icon,
          unlockedAt: new Date(),
        })),
        pointHistory: [
          {
            action: "lesson_completed",
            points: 50,
            description: "Completed onboarding orientation module",
            timestamp: new Date(),
          },
        ],
      });
    } else {
      prof.points = c.points;
      prof.level = Math.floor(c.points / 100) + 1;
      prof.currentStreak = c.streak;
      prof.unlockedBadges = AVAILABLE_BADGES.filter(b => (b.pointsRequired && c.points >= b.pointsRequired) || (b.streakRequired && c.streak >= b.streakRequired)).map(b => ({
        badgeId: b.badgeId,
        name: b.name,
        description: b.description,
        icon: b.icon,
        unlockedAt: new Date(),
      }));
      await prof.save();
    }
    console.log(`Seeded cohort member: ${c.first} ${c.last} (${c.points} pts)`);
  }

  // Ensure logged in admin/user (e.g. Alex Developer) has 250 points, 5-day streak, and badges
  const activeUser = orgUsers[0];
  if (activeUser) {
    let myProf = await GamificationProfile.findOne({ organizationId: devOrg._id, userId: activeUser._id });
    if (!myProf) {
      myProf = await GamificationProfile.create({
        organizationId: devOrg._id,
        userId: activeUser._id,
        points: 250,
        level: 3,
        currentStreak: 5,
        longestStreak: 7,
        lastActiveDate: new Date(),
        unlockedBadges: [
          {
            badgeId: "quick_starter",
            name: "Quick Starter",
            description: "Earned your first onboarding points!",
            icon: "⚡",
            unlockedAt: new Date(),
          },
          {
            badgeId: "first_step",
            name: "First Step",
            description: "Earned your first 50 points in onboarding!",
            icon: "🌟",
            unlockedAt: new Date(),
          },
          {
            badgeId: "first_signer",
            name: "First Signer",
            description: "Completed key onboarding documents!",
            icon: "✍️",
            unlockedAt: new Date(),
          },
          {
            badgeId: "streak_master",
            name: "Streak Master",
            description: "Maintained a 3-day active learning streak!",
            icon: "🔥",
            unlockedAt: new Date(),
          },
        ],
        pointHistory: [
          {
            action: "quiz_completed",
            points: 50,
            description: "Passed Core Onboarding Quiz",
            timestamp: new Date(),
          },
        ],
      });
    } else {
      myProf.points = 250;
      myProf.level = 3;
      myProf.currentStreak = 5;
      myProf.longestStreak = 7;
      myProf.unlockedBadges = [
        {
          badgeId: "quick_starter",
          name: "Quick Starter",
          description: "Earned your first onboarding points!",
          icon: "⚡",
          unlockedAt: new Date(),
        },
        {
          badgeId: "first_step",
          name: "First Step",
          description: "Earned your first 50 points in onboarding!",
          icon: "🌟",
          unlockedAt: new Date(),
        },
        {
          badgeId: "first_signer",
          name: "First Signer",
          description: "Completed key onboarding documents!",
          icon: "✍️",
          unlockedAt: new Date(),
        },
        {
          badgeId: "streak_master",
          name: "Streak Master",
          description: "Maintained a 3-day active learning streak!",
          icon: "🔥",
          unlockedAt: new Date(),
        },
      ];
      await myProf.save();
    }
    console.log(`Set active user ${activeUser.profile?.fullName || activeUser.auth?.email} to 250 pts, 5-day streak, 4 badges`);
  }

  await mongoose.disconnect();
  console.log('Preparation complete!');
}

prepare().catch(console.error);
