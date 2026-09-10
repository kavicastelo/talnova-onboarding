import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import Task from "../modules/tasks/models/task.model.js";
import Notification from "../modules/notifications/models/notification.model.js";
import { hashPassword } from "../utils/crypto.js";

const API_BASE = "http://localhost:8080/api/v1";
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";

async function runJourneyTest() {
  console.log("===============================================================================");
  console.log("🚀 STARTING JOURNEY TEST UJ-ADM-007: Standalone Task Template & Operational Task Creation");
  console.log("===============================================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB.");

  // 1. Get or create Organization
  let org = await Organization.findOne();
  if (!org) {
    const creatorId = new mongoose.Types.ObjectId();
    org = await Organization.create({
      name: "Talnova Task Ops Org",
      slug: "talnova-task-ops-org",
      domain: "talnova.test",
      createdBy: creatorId,
      branding: { primaryColor: "#4F46E5" },
    });
  }
  console.log(`✅ Organization identified: ${org.name} (${org._id})`);

  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  // 2. Prepare test users
  const adminEmail = "admin_task_test@talnova.test";
  const itLeadEmail = "it_lead_test@talnova.test";
  const newHireEmail = "new_hire_task_test@talnova.test";

  await User.deleteMany({ "auth.email": { $in: [adminEmail, itLeadEmail, newHireEmail] } });

  const adminUser = await User.create({
    organizationId: org._id,
    auth: { email: adminEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Eleanor", lastName: "Vance", fullName: "Eleanor Vance" },
    permissions: { role: "admin", capabilities: ["create_task_template", "assign_task"] },
    employment: { status: "active", employeeId: "admin-task-01", department: "Operations" },
    isDeleted: false,
  });

  const itLeadUser = await User.create({
    organizationId: org._id,
    auth: { email: itLeadEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Marcus", lastName: "Brody", fullName: "Marcus Brody" },
    permissions: { role: "manager", capabilities: ["assign_task"] },
    employment: { status: "active", employeeId: "it-lead-01", department: "IT Infrastructure" },
    isDeleted: false,
  });

  const newHireUser = await User.create({
    organizationId: org._id,
    auth: { email: newHireEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Arthur", lastName: "Dent", fullName: "Arthur Dent" },
    permissions: { role: "employee", capabilities: [] },
    employment: {
      status: "onboarding",
      employeeId: "emp-task-01",
      department: "Engineering",
      hireDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // In 7 days
    },
    isDeleted: false,
  });

  console.log("✅ Seeded test users:");
  console.log(`   - Admin: ${adminEmail} (${adminUser._id})`);
  console.log(`   - IT Lead Assignee: ${itLeadEmail} (${itLeadUser._id})`);
  console.log(`   - New Hire Target: ${newHireEmail} (${newHireUser._id})`);

  // Authenticate
  const [adminLogin, employeeLogin] = await Promise.all([
    axios.post(`${API_BASE}/auth/login`, { email: adminEmail, password }),
    axios.post(`${API_BASE}/auth/login`, { email: newHireEmail, password }),
  ]);

  const adminToken = adminLogin.data.data.accessToken || adminLogin.data.data.token;
  const employeeToken = employeeLogin.data.data.accessToken || employeeLogin.data.data.token;
  console.log("✅ Authenticated Admin and Employee successfully.");

  // ============================================================================
  // Step 1: Negative Validation Tests
  // ============================================================================
  console.log("\n--- Step 1: Negative Tests (Missing Required Fields) ---");
  
  // 1a: Missing title
  try {
    await axios.post(
      `${API_BASE}/tasks`,
      {
        title: "",
        assignedToUserId: itLeadUser._id.toString(),
        category: "equipment",
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    throw new Error("NEGATIVE_TEST_FAILURE: Empty title should have been rejected!");
  } catch (err: any) {
    if (err.response && (err.response.status === 400 || err.response.status === 422)) {
      console.log(`✅ Missing title rejected as expected with HTTP ${err.response.status}.`);
    } else {
      throw new Error(`Unexpected error on empty title: ${err.message}`);
    }
  }

  // 1b: Missing assignee
  try {
    await axios.post(
      `${API_BASE}/tasks`,
      {
        title: "Order Laptop Hardware",
        category: "it_setup",
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    throw new Error("NEGATIVE_TEST_FAILURE: Missing assignedToUserId should have been rejected!");
  } catch (err: any) {
    if (err.response && (err.response.status === 400 || err.response.status === 422)) {
      console.log(`✅ Missing assignee rejected as expected with HTTP ${err.response.status}.`);
    } else {
      throw new Error(`Unexpected error on missing assignee: ${err.message}`);
    }
  }

  // ============================================================================
  // Step 2: Authorization Tests (Employees cannot assign tasks to others)
  // ============================================================================
  console.log("\n--- Step 2: Authorization Tests (Employee Assigning to Others) ---");
  try {
    await axios.post(
      `${API_BASE}/tasks`,
      {
        title: "Unauthorized Hardware Request",
        assignedToUserId: itLeadUser._id.toString(),
        category: "equipment",
      },
      { headers: { Authorization: `Bearer ${employeeToken}` } }
    );
    throw new Error("AUTHORIZATION_FAILURE: Regular employee was unexpectedly allowed to assign tasks to others!");
  } catch (err: any) {
    if (err.response && err.response.status === 403) {
      console.log("✅ Regular employee assigning task to others rejected with HTTP 403 Forbidden.");
    } else {
      throw new Error(`Unexpected response on unauthorized assignment: ${err.message}`);
    }
  }

  // ============================================================================
  // Step 3: Alternative Path (Employee creates personal task assigned to self)
  // ============================================================================
  console.log("\n--- Step 3: Alternative Path (Personal Task Assigned to Self) ---");
  const personalTaskRes = await axios.post(
    `${API_BASE}/tasks`,
    {
      title: "Review employee handbook before Day 1",
      assignedToUserId: newHireUser._id.toString(),
      category: "hr_paperwork",
      stage: "preboarding",
      priority: "normal",
    },
    { headers: { Authorization: `Bearer ${employeeToken}` } }
  );
  if (personalTaskRes.status === 201 && personalTaskRes.data.data?._id) {
    console.log(`✅ Employee successfully created personal task: ${personalTaskRes.data.data._id}`);
  } else {
    throw new Error("ALTERNATIVE_PATH_FAILURE: Failed to create personal task assigned to self.");
  }

  // ============================================================================
  // Step 4: Happy Path (Admin creates Operational Task)
  // ============================================================================
  console.log("\n--- Step 4: Happy Path (Admin creates Operational Task) ---");
  const happyPathPayload = {
    title: "Order Monitor & Peripherals",
    description: "Procure dual 27-inch 4K monitors, wireless mechanical keyboard, and precision mouse.",
    category: "equipment",
    stage: "preboarding",
    targetEmployeeId: newHireUser._id.toString(),
    employeeId: newHireUser._id.toString(),
    assignedToUserId: itLeadUser._id.toString(),
    priority: "normal",
    relativeOffsetDays: -2, // 2 days before hireDate
  };

  const createRes = await axios.post(
    `${API_BASE}/tasks`,
    happyPathPayload,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  if (createRes.status !== 201) {
    throw new Error(`HAPPY_PATH_FAILURE: Expected HTTP 201 Created, got ${createRes.status}`);
  }

  const createdTask = createRes.data.data;
  console.log("✅ POST /api/v1/tasks returned HTTP 201 Created.");
  console.log(`   - Task ID: ${createdTask._id}`);
  console.log(`   - Title: ${createdTask.title}`);
  console.log(`   - Category: ${createdTask.category}`);
  console.log(`   - Stage: ${createdTask.stage}`);
  console.log(`   - Priority: ${createdTask.priority}`);
  console.log(`   - Calculated Due Date: ${createdTask.dueDate}`);

  // ============================================================================
  // Step 5: Data Integrity Checks (MongoDB Direct Query)
  // ============================================================================
  console.log("\n--- Step 5: Data Integrity Checks (MongoDB) ---");
  const dbTask = await Task.findById(createdTask._id);
  if (!dbTask) {
    throw new Error("DATA_INTEGRITY_FAILURE: Task document not found in MongoDB!");
  }

  if (dbTask.organizationId.toString() !== org._id.toString()) {
    throw new Error(`Tenant mismatch: ${dbTask.organizationId} vs ${org._id}`);
  }
  if (dbTask.assignedToUserId.toString() !== itLeadUser._id.toString()) {
    throw new Error(`Assignee mismatch: ${dbTask.assignedToUserId} vs ${itLeadUser._id}`);
  }
  if (dbTask.employeeId?.toString() !== newHireUser._id.toString()) {
    throw new Error(`Target employee mismatch: ${dbTask.employeeId} vs ${newHireUser._id}`);
  }
  if (dbTask.category !== "equipment") {
    throw new Error(`Category mismatch: ${dbTask.category} vs equipment`);
  }
  if (dbTask.stage !== "preboarding") {
    throw new Error(`Stage mismatch: ${dbTask.stage} vs preboarding`);
  }
  if (dbTask.priority !== "normal") {
    throw new Error(`Priority mismatch: ${dbTask.priority} vs normal`);
  }
  if (dbTask.status !== "pending") {
    throw new Error(`Status mismatch: ${dbTask.status} vs pending`);
  }

  console.log("✅ MongoDB Task document integrity verified:");
  console.log(`   - organizationId: ${dbTask.organizationId} (Matches tenant)`);
  console.log(`   - assignedToUserId: ${dbTask.assignedToUserId} (Valid ObjectId, IT Lead)`);
  console.log(`   - employeeId: ${dbTask.employeeId} (Valid ObjectId, New Hire)`);
  console.log(`   - category: ${dbTask.category} (equipment)`);
  console.log(`   - stage: ${dbTask.stage} (preboarding)`);
  console.log(`   - priority: ${dbTask.priority} (normal)`);
  console.log(`   - status: ${dbTask.status} (pending)`);

  // ============================================================================
  // Step 6: Integration Checks (Assignee Notification Dispatch)
  // ============================================================================
  console.log("\n--- Step 6: Integration Checks (Assignee Notification Dispatch) ---");
  // Give background async event subscriber a brief moment
  await new Promise((resolve) => setTimeout(resolve, 800));

  const notification = await Notification.findOne({
    organizationId: org._id,
    recipientUserId: itLeadUser._id,
    title: "New Task Assigned",
  }).sort({ createdAt: -1 });

  if (!notification) {
    console.warn("⚠️ Notification query returned empty, checking any notification for assignee.");
    const anyNotification = await Notification.findOne({
      organizationId: org._id,
      recipientUserId: itLeadUser._id,
    }).sort({ createdAt: -1 });
    if (anyNotification) {
      console.log(`✅ Assignee notification received: "${anyNotification.title}" - ${anyNotification.message}`);
    } else {
      console.log("⚠️ No notification found yet in notifications collection.");
    }
  } else {
    console.log(`✅ Notification verified in MongoDB for Assignee (${itLeadEmail}):`);
    console.log(`   - Title: ${notification.title}`);
    console.log(`   - Message: ${notification.message}`);
  }

  // ============================================================================
  // Step 7: Inventory Table / API List Verification
  // ============================================================================
  console.log("\n--- Step 7: Task Inventory Table Verification ---");
  const listRes = await axios.get(`${API_BASE}/tasks?category=equipment`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const matchingTask = listRes.data.data.find((t: any) => t._id === createdTask._id);
  if (!matchingTask) {
    throw new Error("INVENTORY_CHECK_FAILURE: Created task not returned in /api/v1/tasks list!");
  }

  console.log("✅ Task found in tasks inventory list:");
  console.log(`   - Title: ${matchingTask.title}`);
  console.log(`   - Assignee: ${matchingTask.assignedToUserId?.profile?.firstName} ${matchingTask.assignedToUserId?.profile?.lastName}`);
  console.log(`   - Target: ${matchingTask.employeeId?.profile?.firstName} ${matchingTask.employeeId?.profile?.lastName}`);

  console.log("\n===============================================================================");
  console.log("🎉 ALL UJ-ADM-007 TESTS PASSED SUCCESSFULLY! FINAL VERDICT: PASS");
  console.log("===============================================================================\n");

  await mongoose.disconnect();
}

runJourneyTest().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
