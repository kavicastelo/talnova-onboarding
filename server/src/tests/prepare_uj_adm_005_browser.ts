import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import Task from "../modules/tasks/models/task.model.js";
import { DocumentAssignment } from "../modules/documents/models/document-assignment.model.js";
import EmployeeMilestone from "../modules/milestones/models/employee-milestone.model.js";
import { EmployeeAssignment } from "../modules/assignments/models/assignment.model.js";
import { Certificate } from "../modules/certificates/models/certificate.model.js";
import { hashPassword } from "../utils/crypto.js";

async function prepare() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding");
  console.log("Connected to MongoDB for UI preparation.");

  const org = await Organization.findOne();
  if (!org) throw new Error("Org not found");

  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  // 1. Ensure admin user
  const adminEmail = "admin_hr_ops@talnova.test";
  let admin = await User.findOne({ "auth.email": adminEmail });
  if (!admin) {
    admin = await User.create({
      organizationId: org._id,
      auth: { email: adminEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Eleanor", lastName: "Vance", fullName: "Eleanor Vance" },
      permissions: { role: "admin", capabilities: ["hr_operations", "complete_handover"] },
      employment: { status: "active", employeeId: "admin-01", department: "People Operations", jobTitle: "HR Director" },
      isDeleted: false,
    });
  } else {
    admin.auth.passwordHash = passwordHash;
    await admin.save();
  }

  // 2. Prepare emp-completed-01 (ready for handover)
  const completedEmail = "completed_hire_01@talnova.test";
  let compUser = await User.findOne({ "auth.email": completedEmail });
  if (!compUser) {
    compUser = await User.create({
      organizationId: org._id,
      auth: { email: completedEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Arthur", lastName: "Dent", fullName: "Arthur Dent" },
      permissions: { role: "employee", capabilities: [] },
      employment: {
        status: "onboarding",
        onboardingState: "active",
        employeeId: "emp-completed-01",
        department: "Engineering",
        jobTitle: "Principal Systems Architect",
      },
      isDeleted: false,
    });
  } else {
    compUser.employment = {
      status: "onboarding",
      onboardingState: "active",
      employeeId: "emp-completed-01",
      department: "Engineering",
      jobTitle: "Principal Systems Architect",
    } as any;
    compUser.isDeleted = false;
    await compUser.save();
  }

  // 3. Prepare emp-incomplete-01 (has 1 open task)
  const incompleteEmail = "incomplete_hire_01@talnova.test";
  let incUser = await User.findOne({ "auth.email": incompleteEmail });
  if (!incUser) {
    incUser = await User.create({
      organizationId: org._id,
      auth: { email: incompleteEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Ford", lastName: "Prefect", fullName: "Ford Prefect" },
      permissions: { role: "employee", capabilities: [] },
      employment: {
        status: "onboarding",
        onboardingState: "active",
        employeeId: "emp-incomplete-01",
        department: "Field Research",
        jobTitle: "Senior Field Scout",
      },
      isDeleted: false,
    });
  } else {
    incUser.employment = {
      status: "onboarding",
      onboardingState: "active",
      employeeId: "emp-incomplete-01",
      department: "Field Research",
      jobTitle: "Senior Field Scout",
    } as any;
    incUser.isDeleted = false;
    await incUser.save();
  }

  // Clean items for both
  await Promise.all([
    Task.deleteMany({ employeeId: { $in: [compUser._id, incUser._id] } }),
    Task.deleteMany({ assignedToUserId: { $in: [compUser._id, incUser._id] } }),
    DocumentAssignment.deleteMany({ employeeId: { $in: [compUser._id, incUser._id] } }),
    EmployeeMilestone.deleteMany({ employeeId: { $in: [compUser._id, incUser._id] } }),
    EmployeeAssignment.deleteMany({ employeeId: { $in: [compUser._id, incUser._id] } }),
    Certificate.deleteMany({ employeeId: { $in: [compUser._id, incUser._id] } }),
  ]);

  // Give Ford Prefect (incomplete) 1 open task
  await Task.create({
    organizationId: org._id,
    createdBy: admin._id,
    title: "Complete Information Security Handbook Review",
    category: "hr_paperwork",
    stage: "day_1",
    status: "pending",
    employeeId: incUser._id,
    assignedToUserId: incUser._id,
    dueDate: new Date(Date.now() + 86400000 * 3),
  });

  console.log("✅ UI Preparation Complete:");
  console.log(`   - Admin: ${adminEmail} / ${password}`);
  console.log(`   - Completed hire: ${compUser.profile.fullName} (ID: emp-completed-01, Status: onboarding)`);
  console.log(`   - Incomplete hire: ${incUser.profile.fullName} (ID: emp-incomplete-01, Status: onboarding, 1 open task)`);

  await mongoose.disconnect();
}

prepare().catch(console.error);
