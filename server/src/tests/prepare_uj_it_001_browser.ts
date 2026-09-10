import mongoose from "mongoose";
import dotenv from "dotenv";
import Organization from "../modules/organizations/models/organization.model.js";
import User from "../modules/auth/models/user.model.js";
import Task from "../modules/tasks/models/task.model.js";
import { hashPassword } from "../utils/crypto.js";

dotenv.config();

async function prepare() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  let org = await Organization.findOne({ slug: "talnova-hq" });
  if (!org) {
    org = new Organization({
      name: "Talnova HQ",
      slug: "talnova-hq",
      domain: "talnova.test",
      plan: "Enterprise",
      status: "Active",
      supportEmail: "support@talnova.test",
      createdBy: new mongoose.Types.ObjectId()
    });
    await org.save();
  }

  const itEmail = "it_operator@talnova.test";
  const newHireEmail = "new_hire_alex@talnova.test";
  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  let itOperator = await User.findOne({ "auth.email": itEmail });
  if (!itOperator) {
    itOperator = new User({
      organizationId: org._id,
      auth: { email: itEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Marcus", lastName: "Vance", fullName: "Marcus Vance" },
      employment: { department: "IT Operations", jobTitle: "IT Systems Engineer", status: "active", employmentType: "full_time" },
      permissions: { role: "employee", customRoles: ["it_admin"] }
    });
    await itOperator.save();
  } else {
    itOperator.auth.passwordHash = passwordHash;
    await itOperator.save();
  }

  let newHire = await User.findOne({ "auth.email": newHireEmail });
  if (!newHire) {
    newHire = new User({
      organizationId: org._id,
      auth: { email: newHireEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Alex", lastName: "Mercer", fullName: "Alex Mercer" },
      employment: { department: "Engineering", jobTitle: "Senior Frontend Engineer", status: "active", employmentType: "full_time" },
      permissions: { role: "employee", customRoles: [] }
    });
    await newHire.save();
  }

  const taskCode = "task-it-hardware-01";
  await Task.deleteMany({ taskCode });

  const itTask = new Task({
    organizationId: org._id,
    taskCode,
    title: "Order Laptop & Provision Access",
    description: "Order Dell XPS 15 laptop, configure Okta SSO, issue VPN certificate, and record asset tag.",
    category: "it_setup",
    stage: "preboarding",
    priority: "high",
    status: "pending",
    assignedToUserId: itOperator._id,
    employeeId: newHire._id,
    createdBy: org.createdBy || itOperator._id,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    comments: [],
    statusHistory: [
      {
        status: "pending",
        changedBy: itOperator._id,
        changedAt: new Date(),
        note: "Task initialized by onboarding trigger"
      }
    ]
  });
  await itTask.save();
  console.log(`✅ Seeded IT provisioning task ${taskCode} (${itTask._id}) for it_operator@talnova.test.`);

  await mongoose.disconnect();
  process.exit(0);
}

prepare().catch(err => {
  console.error(err);
  process.exit(1);
});
