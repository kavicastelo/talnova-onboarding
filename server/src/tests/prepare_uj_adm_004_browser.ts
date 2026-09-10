import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import { WorkflowRule } from "../modules/workflows/models/workflow-rule.model.js";
import { hashPassword } from "../utils/crypto.js";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";

async function prepare() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  let org = await Organization.findOne();
  if (!org) {
    org = await Organization.create({
      name: "Talnova Test Organization",
      slug: "talnova-test-org",
      domain: "talnova.test",
      createdBy: new mongoose.Types.ObjectId(),
    });
  }

  // Ensure default admin user
  const adminEmail = "admin@talnova.test";
  const passwordHash = await hashPassword("Password123!");
  let admin = await User.findOne({ "auth.email": adminEmail });
  if (!admin) {
    admin = await User.create({
      organizationId: org._id,
      auth: { email: adminEmail, passwordHash, emailVerified: true },
      profile: { firstName: "System", lastName: "Admin", fullName: "System Admin" },
      permissions: { role: "admin", customRoles: [] },
      employment: { status: "active", employmentType: "full_time" },
      isDeleted: false,
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    admin.auth.passwordHash = passwordHash;
    admin.permissions.role = "admin";
    await admin.save();
    console.log(`Updated admin user: ${adminEmail}`);
  }

  // Ensure all journeys are published
  await Journey.updateMany(
    { organizationId: org._id },
    { $set: { "publishing.status": "published", "publishing.version": 1 } }
  );

  // Ensure Engineering Onboarding Journey exists
  let engJourney = await Journey.findOne({
    organizationId: org._id,
    title: "Engineering Onboarding Pathway",
    isDeleted: false,
  });

  if (!engJourney) {
    engJourney = await Journey.create({
      organizationId: org._id,
      title: "Engineering Onboarding Pathway",
      slug: `engineering-onboarding-pathway-${Date.now()}`,
      description: "Comprehensive technical roadmap for engineering hires.",
      department: "Engineering",
      role: "Software Engineer",
      publishing: { status: "published", publishedAt: new Date(), version: 1 },
      createdBy: admin._id,
      audience: { departmentNames: ["Engineering"], isPublic: true },
      modules: [
        {
          _id: new mongoose.Types.ObjectId(),
          title: "Engineering Overview",
          order: 1,
          estimatedDurationMinutes: 30,
          lessons: [],
        },
      ],
      isDeleted: false,
    });
    console.log(`Created Engineering Journey: ${engJourney._id}`);
  } else {
    engJourney.department = "Engineering";
    engJourney.publishing.status = "published";
    await engJourney.save();
    console.log(`Updated Engineering Journey: ${engJourney._id}`);
  }

  // Clear existing rules with name 'Auto Assign Eng Onboarding' or 'Eng Journey Auto-Assign' so we can create it in the UI cleanly
  await WorkflowRule.deleteMany({
    name: { $in: ["Auto Assign Eng Onboarding", "Eng Journey Auto-Assign"] },
  });
  console.log("Cleared existing test workflow rules.");

  await mongoose.disconnect();
  console.log("Ready for browser journey testing.");
}

prepare().catch((err) => {
  console.error("Preparation error:", err);
  process.exit(1);
});
