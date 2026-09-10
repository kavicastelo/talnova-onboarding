import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { EmployeeAssignment } from "../modules/assignments/models/assignment.model.js";
import Task from "../modules/tasks/models/task.model.js";
import { DocumentAssignment } from "../modules/documents/models/document-assignment.model.js";
import EmployeeMilestone from "../modules/milestones/models/employee-milestone.model.js";
import { Certificate, verifyCertificateSignature } from "../modules/certificates/models/certificate.model.js";
import { hashPassword } from "../utils/crypto.js";

const API_BASE = "http://localhost:8080/api/v1";
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";

async function runJourneyTest() {
  console.log("===============================================================================");
  console.log("🚀 STARTING JOURNEY TEST UJ-ADM-005: HR Ops Handover Verification & Analytics");
  console.log("===============================================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB.");

  // 1. Organization Setup
  let org = await Organization.findOne();
  if (!org) {
    const creatorId = new mongoose.Types.ObjectId();
    org = await Organization.create({
      name: "Talnova Operations Corp",
      slug: "talnova-ops-corp",
      domain: "talnova.test",
      createdBy: creatorId,
      branding: { primaryColor: "#4F46E5" },
    });
  }
  console.log(`✅ Organization identified: ${org.name} (${org._id})`);

  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  // 2. Clean & Prepare Test Users
  const adminEmail = "admin_hr_ops@talnova.test";
  const managerEmail = "manager_hr_ops@talnova.test";
  const completedEmpEmail = "completed_hire_01@talnova.test";
  const incompleteEmpEmail = "incomplete_hire_01@talnova.test";

  await User.deleteMany({
    "auth.email": { $in: [adminEmail, managerEmail, completedEmpEmail, incompleteEmpEmail] },
  });

  // Create Admin
  const adminUser = await User.create({
    organizationId: org._id,
    auth: { email: adminEmail, passwordHash },
    profile: { firstName: "Eleanor", lastName: "Vance", fullName: "Eleanor Vance" },
    permissions: { role: "admin", capabilities: ["hr_operations", "complete_handover"] },
    employment: { status: "active", employeeId: "admin-01", department: "People Operations", jobTitle: "HR Director" },
    isDeleted: false,
  });

  // Create Manager
  const managerUser = await User.create({
    organizationId: org._id,
    auth: { email: managerEmail, passwordHash },
    profile: { firstName: "Marcus", lastName: "Briggs", fullName: "Marcus Briggs" },
    permissions: { role: "manager", capabilities: [] },
    employment: { status: "active", employeeId: "mgr-01", department: "Engineering", jobTitle: "Engineering Manager" },
    isDeleted: false,
  });

  // Create Completed Employee: emp-completed-01
  const completedEmp = await User.create({
    organizationId: org._id,
    auth: { email: completedEmpEmail, passwordHash },
    profile: { firstName: "Arthur", lastName: "Dent", fullName: "Arthur Dent" },
    permissions: { role: "employee", capabilities: [] },
    employment: {
      status: "onboarding",
      onboardingState: "active",
      employeeId: "emp-completed-01",
      department: "Engineering",
      jobTitle: "Principal Systems Architect",
    },
    statistics: { certificates: 0 },
    isDeleted: false,
  });

  // Create Incomplete Employee: emp-incomplete-01
  const incompleteEmp = await User.create({
    organizationId: org._id,
    auth: { email: incompleteEmpEmail, passwordHash },
    profile: { firstName: "Ford", lastName: "Prefect", fullName: "Ford Prefect" },
    permissions: { role: "employee", capabilities: [] },
    employment: {
      status: "onboarding",
      onboardingState: "active",
      employeeId: "emp-incomplete-01",
      department: "Field Research",
      jobTitle: "Senior Field Scout",
    },
    statistics: { certificates: 0 },
    isDeleted: false,
  });

  // Clean artifacts for both test employees
  await Promise.all([
    Task.deleteMany({ employeeId: { $in: [completedEmp._id, incompleteEmp._id] } }),
    Task.deleteMany({ assignedToUserId: { $in: [completedEmp._id, incompleteEmp._id] } }),
    DocumentAssignment.deleteMany({ employeeId: { $in: [completedEmp._id, incompleteEmp._id] } }),
    EmployeeMilestone.deleteMany({ employeeId: { $in: [completedEmp._id, incompleteEmp._id] } }),
    EmployeeAssignment.deleteMany({ employeeId: { $in: [completedEmp._id, incompleteEmp._id] } }),
    Certificate.deleteMany({ employeeId: { $in: [completedEmp._id, incompleteEmp._id] } }),
  ]);

  // Give incomplete employee 1 open task
  await Task.create({
    organizationId: org._id,
    createdBy: adminUser._id,
    title: "Complete Information Security Handbook Review",
    category: "hr_paperwork",
    stage: "day_1",
    status: "pending",
    employeeId: incompleteEmp._id,
    assignedToUserId: incompleteEmp._id,
    dueDate: new Date(Date.now() + 86400000 * 3),
  });

  console.log("✅ Seeded test users:");
  console.log(`   - Admin: ${adminEmail} (Role: admin)`);
  console.log(`   - Manager: ${managerEmail} (Role: manager)`);
  console.log(`   - Completed Employee: ${completedEmpEmail} (ID: emp-completed-01, 0 open tasks)`);
  console.log(`   - Incomplete Employee: ${incompleteEmpEmail} (ID: emp-incomplete-01, 1 open task)`);

  // 3. Authenticate to obtain tokens
  console.log("\n--- Authenticating Users ---");
  const [adminLogin, managerLogin, employeeLogin] = await Promise.all([
    axios.post(`${API_BASE}/auth/login`, { email: adminEmail, password }),
    axios.post(`${API_BASE}/auth/login`, { email: managerEmail, password }),
    axios.post(`${API_BASE}/auth/login`, { email: completedEmpEmail, password }),
  ]);

  const adminToken = adminLogin.data.data.accessToken || adminLogin.data.data.token;
  const managerToken = managerLogin.data.data.accessToken || managerLogin.data.data.token;
  const employeeToken = employeeLogin.data.data.accessToken || employeeLogin.data.data.token;
  console.log("✅ Retrieved JWT tokens for Admin, Manager, and Employee.");

  // 4. Test Step 1: Verify Cohort Analytics Cards Load
  console.log("\n--- Step 1: GET /api/v1/hr/dashboard-metrics ---");
  const metricsRes = await axios.get(`${API_BASE}/hr/dashboard-metrics`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  if (metricsRes.status !== 200 || !metricsRes.data.success) {
    throw new Error(`Failed to load metrics: ${JSON.stringify(metricsRes.data)}`);
  }
  const metrics = metricsRes.data.data;
  console.log("✅ Metrics response received (200 OK):");
  console.log(`   - Total Employees: ${metrics.totalEmployees}`);
  console.log(`   - Active Onboardees: ${metrics.activeOnboardees}`);
  console.log(`   - Journey Compliance Rate: ${metrics.journeyComplianceRate}%`);
  console.log(`   - Pending Documents: ${metrics.pendingDocuments}`);

  // 5. Test Step 2: Authorization Gate Enforcement (Manager & Employee Blocked)
  console.log("\n--- Step 2: Authorization Gate Tests (HTTP 403 Forbidden) ---");

  // Manager attempt
  try {
    await axios.post(
      `${API_BASE}/hr/handover/emp-completed-01`,
      {},
      { headers: { Authorization: `Bearer ${managerToken}` } }
    );
    throw new Error("AUTHORIZATION_FAILURE: Manager was unexpectedly allowed to invoke handover!");
  } catch (err: any) {
    if (err.response && err.response.status === 403) {
      console.log("✅ Manager correctly rejected with HTTP 403 Forbidden.");
    } else {
      throw new Error(`Unexpected response for manager handover: ${err.message}`);
    }
  }

  // Employee attempt
  try {
    await axios.post(
      `${API_BASE}/hr/handover/emp-completed-01`,
      {},
      { headers: { Authorization: `Bearer ${employeeToken}` } }
    );
    throw new Error("AUTHORIZATION_FAILURE: Employee was unexpectedly allowed to invoke handover!");
  } catch (err: any) {
    if (err.response && err.response.status === 403) {
      console.log("✅ Employee correctly rejected with HTTP 403 Forbidden.");
    } else {
      throw new Error(`Unexpected response for employee handover: ${err.message}`);
    }
  }

  // 6. Test Step 3: Negative Test (Incomplete Employee Handover Blocked)
  console.log("\n--- Step 3: Negative Test on Incomplete Employee (emp-incomplete-01) ---");
  try {
    await axios.post(
      `${API_BASE}/hr/handover/emp-incomplete-01`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    throw new Error("AUTHORIZATION_FAILURE: Incomplete employee was unexpectedly handed over!");
  } catch (err: any) {
    if (!err.response) {
      throw err;
    }
    console.log(`✅ Handover rejected with HTTP status: ${err.response.status}`);
    const body = err.response.data;
    console.log("✅ Response payload:", JSON.stringify(body, null, 2));

    if (err.response.status !== 400) {
      throw new Error(`Expected HTTP 400, got ${err.response.status}`);
    }
    if (body.error !== "ONBOARDING_INCOMPLETE" && body.code !== "ONBOARDING_INCOMPLETE") {
      throw new Error(`Expected error 'ONBOARDING_INCOMPLETE', got '${body.error}'`);
    }
    if (body.openTasks !== 1) {
      throw new Error(`Expected openTasks: 1, got ${body.openTasks}`);
    }

    // Verify Incomplete Employee remains in onboarding status in MongoDB
    const incEmpDb = await User.findById(incompleteEmp._id);
    if (incEmpDb?.employment?.status !== "onboarding") {
      throw new Error(`Expected status 'onboarding', found '${incEmpDb?.employment?.status}'`);
    }
    console.log("✅ Incomplete employee remains in 'onboarding' status in MongoDB.");
  }

  // 7. Test Step 4: Happy Path (Complete Employee Finalize Handover)
  console.log("\n--- Step 4: Happy Path Handover on Complete Employee (emp-completed-01) ---");
  const handoverRes = await axios.post(
    `${API_BASE}/hr/handover/emp-completed-01`,
    { reason: "HR Administrator authoritatively approved cohort handover" },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  console.log(`✅ Handover response status: ${handoverRes.status}`);
  const handoverBody = handoverRes.data;
  console.log("✅ Handover response body:", JSON.stringify(handoverBody, null, 2));

  if (handoverRes.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${handoverRes.status}`);
  }
  if (!handoverBody.success) {
    throw new Error("Expected success: true");
  }
  if (!handoverBody.certificateId) {
    throw new Error("Missing certificateId in response body!");
  }
  if (handoverBody.employeeStatus !== "active") {
    throw new Error(`Expected employeeStatus: 'active', got '${handoverBody.employeeStatus}'`);
  }
  console.log(`✅ Handover completed successfully with Certificate ID: ${handoverBody.certificateId}`);

  // 8. Test Step 5: Data Integrity & Integration Checks in MongoDB
  console.log("\n--- Step 5: Data Integrity & Integration Verification in MongoDB ---");
  const compEmpDb = await User.findById(completedEmp._id);
  if (compEmpDb?.employment?.status !== "active") {
    throw new Error(`Expected MongoDB User.employment.status == 'active', got '${compEmpDb?.employment?.status}'`);
  }
  if (compEmpDb?.employment?.onboardingState !== "completed") {
    throw new Error(`Expected MongoDB User.employment.onboardingState == 'completed', got '${compEmpDb?.employment?.onboardingState}'`);
  }
  console.log("✅ MongoDB User record verified:");
  console.log(`   - employment.status: ${compEmpDb.employment.status}`);
  console.log(`   - employment.onboardingState: ${compEmpDb.employment.onboardingState}`);

  const certDb = await Certificate.findById(handoverBody.certificateId);
  if (!certDb) {
    throw new Error(`Certificate record ${handoverBody.certificateId} not found in certificates collection!`);
  }
  if (certDb.status !== "active") {
    throw new Error(`Certificate status is '${certDb.status}', expected 'active'`);
  }
  if (certDb.employeeId.toString() !== completedEmp._id.toString()) {
    throw new Error("Certificate employeeId does not match!");
  }
  const isSignatureValid = verifyCertificateSignature(
    certDb.certificateNumber,
    certDb.employeeId.toString(),
    certDb.organizationId.toString(),
    certDb.issueDate,
    certDb.sha256Signature
  );
  if (!isSignatureValid) {
    throw new Error("Certificate cryptographic signature verification failed!");
  }
  console.log("✅ MongoDB Certificate record verified:");
  console.log(`   - Certificate Number: ${certDb.certificateNumber}`);
  console.log(`   - Recipient Name: ${certDb.recipientName}`);
  console.log(`   - Cryptographic Signature Verified: ${isSignatureValid}`);

  // 9. Test Step 6: Idempotency Check
  console.log("\n--- Step 6: Idempotency Verification ---");
  const secondHandoverRes = await axios.post(
    `${API_BASE}/hr/handover/emp-completed-01`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  if (secondHandoverRes.status !== 200 || !secondHandoverRes.data.success) {
    throw new Error("Idempotent handover call failed!");
  }
  const certCount = await Certificate.countDocuments({ employeeId: completedEmp._id });
  if (certCount !== 1) {
    throw new Error(`Expected exactly 1 certificate document, found ${certCount}`);
  }
  console.log("✅ Handover is idempotent. No duplicate certificate generated.");

  console.log("\n===============================================================================");
  console.log("🎉 ALL PROGRAMMATIC TEST SUITES PASSED FOR UJ-ADM-005!");
  console.log("===============================================================================\n");

  await mongoose.disconnect();
}

runJourneyTest().catch(async (err) => {
  console.error("❌ TEST FAILED:", err.response?.data || err.message || err);
  await mongoose.disconnect();
  process.exit(1);
});
