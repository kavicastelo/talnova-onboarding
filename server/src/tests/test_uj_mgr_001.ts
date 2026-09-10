import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import Task from "../modules/tasks/models/task.model.js";
import { hashPassword } from "../utils/crypto.js";

const API_BASE = "http://localhost:8080/api/v1";
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";

async function runJourneyTest() {
  console.log("===============================================================================");
  console.log("🚀 STARTING JOURNEY TEST UJ-MGR-001: Direct Report Progress Monitoring");
  console.log("===============================================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB.");

  // 1. Organization
  let org = await Organization.findOne();
  if (!org) {
    const creatorId = new mongoose.Types.ObjectId();
    org = await Organization.create({
      name: "Talnova Engineering Corp",
      slug: "talnova-eng-corp",
      domain: "talnova.test",
      createdBy: creatorId,
      branding: { primaryColor: "#4F46E5" },
    });
  }
  console.log(`✅ Organization identified: ${org.name} (${org._id})`);

  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  // 2. Prepare test accounts:
  // - manager@talnova.test (Target Manager)
  // - other_manager@talnova.test (Different Manager to test data leakage)
  // - direct_hire@talnova.test (Direct report of manager@talnova.test)
  // - other_hire@talnova.test (Direct report of other_manager@talnova.test)
  // - employee_unauthorized@talnova.test (Regular employee to test authorization)
  // - empty_manager@talnova.test (Manager with 0 direct reports to test empty state)

  const managerEmail = "manager@talnova.test";
  const otherManagerEmail = "other_manager@talnova.test";
  const directHireEmail = "direct_hire@talnova.test";
  const otherHireEmail = "other_hire@talnova.test";
  const unauthorizedEmail = "employee_unauthorized@talnova.test";
  const emptyManagerEmail = "empty_manager@talnova.test";

  await User.deleteMany({
    "auth.email": {
      $in: [
        managerEmail,
        otherManagerEmail,
        directHireEmail,
        otherHireEmail,
        unauthorizedEmail,
        emptyManagerEmail,
      ],
    },
  });

  // Create Primary Manager
  const managerUser = await User.create({
    organizationId: org._id,
    auth: { email: managerEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Sarah", lastName: "Connor", fullName: "Sarah Connor" },
    permissions: { role: "manager", capabilities: ["view_team_ops", "assign_task"] },
    employment: { status: "active", employeeId: "mgr-001", department: "Engineering" },
    isDeleted: false,
  });

  // Create Other Manager
  const otherManagerUser = await User.create({
    organizationId: org._id,
    auth: { email: otherManagerEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Miles", lastName: "Dyson", fullName: "Miles Dyson" },
    permissions: { role: "manager", capabilities: ["view_team_ops"] },
    employment: { status: "active", employeeId: "mgr-002", department: "Research & Development" },
    isDeleted: false,
  });

  // Create Empty Manager (0 direct reports)
  const emptyManagerUser = await User.create({
    organizationId: org._id,
    auth: { email: emptyManagerEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Kyle", lastName: "Reese", fullName: "Kyle Reese" },
    permissions: { role: "manager", capabilities: ["view_team_ops"] },
    employment: { status: "active", employeeId: "mgr-003", department: "Security" },
    isDeleted: false,
  });

  // Create Direct Hire (assigned to managerUser)
  const directHireUser = await User.create({
    organizationId: org._id,
    auth: { email: directHireEmail, passwordHash, emailVerified: true },
    profile: { firstName: "John", lastName: "Connor", fullName: "John Connor" },
    permissions: { role: "employee", capabilities: [] },
    employment: {
      status: "onboarding",
      employeeId: "hire-001",
      jobTitle: "Full Stack Engineer",
      department: "Engineering",
      managerId: managerUser._id,
      hireDate: new Date(),
    },
    isDeleted: false,
  });

  // Create Other Hire (assigned to otherManagerUser)
  const otherHireUser = await User.create({
    organizationId: org._id,
    auth: { email: otherHireEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Danny", lastName: "Dyson", fullName: "Danny Dyson" },
    permissions: { role: "employee", capabilities: [] },
    employment: {
      status: "onboarding",
      employeeId: "hire-002",
      jobTitle: "Data Scientist",
      department: "Research & Development",
      managerId: otherManagerUser._id,
      hireDate: new Date(),
    },
    isDeleted: false,
  });

  // Create Unauthorized Employee (regular employee without view_team_ops)
  const unauthorizedUser = await User.create({
    organizationId: org._id,
    auth: { email: unauthorizedEmail, passwordHash, emailVerified: true },
    profile: { firstName: "T-800", lastName: "Model 101", fullName: "T-800 Model 101" },
    permissions: { role: "employee", capabilities: [] },
    employment: { status: "active", employeeId: "emp-unauth", department: "Operations" },
    isDeleted: false,
  });

  console.log("✅ Seeded test accounts:");
  console.log(`   - Manager: ${managerEmail} (${managerUser._id})`);
  console.log(`   - Direct Report: ${directHireEmail} (${directHireUser._id})`);
  console.log(`   - Other Manager: ${otherManagerEmail} (${otherManagerUser._id})`);
  console.log(`   - Other Hire: ${otherHireEmail} (${otherHireUser._id})`);
  console.log(`   - Unauthorized Employee: ${unauthorizedEmail}`);
  console.log(`   - Empty Manager: ${emptyManagerEmail}`);

  // Seed sample assignment and task for directHireUser
  await EmployeeAssignment.deleteMany({ employeeId: { $in: [directHireUser._id, otherHireUser._id] } });
  await Task.deleteMany({ employeeId: { $in: [directHireUser._id, otherHireUser._id] } });

  const sampleAssignment = await EmployeeAssignment.create({
    organizationId: org._id,
    employeeId: directHireUser._id,
    assignedBy: managerUser._id,
    journey: {
      journeyId: new mongoose.Types.ObjectId(),
      title: "Engineering Onboarding Roadmap",
      version: 1,
    },
    assignment: {
      assignedAt: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      priority: "normal",
    },
    status: "in_progress",
    progress: {
      completedLessons: 3,
      totalLessons: 6,
      completionPercentage: 50,
      totalTimeSpentSeconds: 3600,
    },
    modules: [],
  });

  const sampleTask = await Task.create({
    organizationId: org._id,
    createdBy: managerUser._id,
    assignedToUserId: directHireUser._id,
    employeeId: directHireUser._id,
    title: "Configure GitHub SSH Keys & 2FA",
    category: "it_setup",
    stage: "day_1",
    priority: "high",
    status: "pending",
  });

  console.log("✅ Seeded onboarding progress data for direct report:");
  console.log(`   - Journey Assignment: ${sampleAssignment.journey.title} (50% progress)`);
  console.log(`   - Task: ${sampleTask.title} (day_1, high priority)`);

  // Authenticate users
  const [managerLogin, employeeLogin, emptyManagerLogin] = await Promise.all([
    axios.post(`${API_BASE}/auth/login`, { email: managerEmail, password }),
    axios.post(`${API_BASE}/auth/login`, { email: unauthorizedEmail, password }),
    axios.post(`${API_BASE}/auth/login`, { email: emptyManagerEmail, password }),
  ]);

  const managerToken = managerLogin.data.data.accessToken || managerLogin.data.data.token;
  const employeeToken = employeeLogin.data.data.accessToken || employeeLogin.data.data.token;
  const emptyManagerToken = emptyManagerLogin.data.data.accessToken || emptyManagerLogin.data.data.token;

  console.log("✅ Successfully authenticated test users.");

  // ============================================================================
  // Step 1: Authorization Gate Tests
  // ============================================================================
  console.log("\n--- Step 1: Authorization Tests (Employees Blocked from Manager APIs) ---");
  try {
    await axios.get(`${API_BASE}/manager/team-overview`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    throw new Error("AUTHORIZATION_FAILURE: Regular employee was unexpectedly allowed to access /manager/team-overview!");
  } catch (err: any) {
    if (err.response && err.response.status === 403) {
      console.log("✅ Regular employee GET /api/v1/manager/team-overview rejected with HTTP 403 Forbidden.");
    } else {
      throw new Error(`Unexpected error on unauthorized access: ${err.message}`);
    }
  }

  // ============================================================================
  // Step 2: Happy Path Network Request (GET /api/v1/manager/team-overview)
  // ============================================================================
  console.log("\n--- Step 2: Happy Path (GET /api/v1/manager/team-overview) ---");
  const overviewRes = await axios.get(`${API_BASE}/manager/team-overview`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });

  if (overviewRes.status !== 200) {
    throw new Error(`HAPPY_PATH_FAILURE: Expected HTTP 200 OK, got ${overviewRes.status}`);
  }
  console.log("✅ GET /api/v1/manager/team-overview returned HTTP 200 OK.");

  const overviewData = overviewRes.data.data;
  console.log("   - Summary Cards Data:");
  console.log(`     * Total Direct Reports: ${overviewData.totalDirectReports}`);
  console.log(`     * Average Roadmap %: ${overviewData.averageProgress}%`);
  console.log(`     * Overdue Items: ${overviewData.overdueCount}`);

  if (overviewData.totalDirectReports !== 1) {
    throw new Error(`Expected exactly 1 direct report for manager, found ${overviewData.totalDirectReports}`);
  }

  // ============================================================================
  // Step 3: Negative Tests (Cross-Manager Data Leakage Verification)
  // ============================================================================
  console.log("\n--- Step 3: Cross-Manager Data Leakage Verification ---");
  const teamList = overviewData.team;
  const directHireInList = teamList.find((e: any) => e.email === directHireEmail);
  const otherHireInList = teamList.find((e: any) => e.email === otherHireEmail);

  if (!directHireInList) {
    throw new Error(`DATA_LEAKAGE_FAILURE: Expected ${directHireEmail} to be in manager's roster!`);
  }
  console.log(`✅ Direct report ${directHireEmail} successfully listed in manager roster.`);
  console.log(`   - Progress: ${directHireInList.journeyStats.completionPercentage}%`);
  console.log(`   - Department: ${directHireInList.department}`);
  console.log(`   - Job Title: ${directHireInList.jobTitle}`);

  if (otherHireInList) {
    throw new Error(`DATA_LEAKAGE_FAILURE: ${otherHireEmail} belonging to another manager appeared in roster!`);
  }
  console.log(`✅ Cross-manager isolation verified: ${otherHireEmail} is strictly absent from roster.`);

  // ============================================================================
  // Step 4: Deep-Dive / Detailed Breakdown & Cross-Report Security
  // ============================================================================
  console.log("\n--- Step 4: Detailed Breakdown & Inspection ---");
  // 4a: Manager inspecting their own direct report
  const detailsRes = await axios.get(`${API_BASE}/manager/team/${directHireUser._id}`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });

  if (detailsRes.status === 200 && detailsRes.data.data) {
    const details = detailsRes.data.data;
    console.log(`✅ Successfully loaded checklist breakdown for ${details.employee.fullName}:`);
    console.log(`   - Assignments: ${details.assignments.length} (${details.assignments[0]?.journeyTitle})`);
    console.log(`   - Tasks: ${details.tasks.length} (${details.tasks[0]?.title})`);
  } else {
    throw new Error("Failed to load direct report deep-dive details.");
  }

  // 4b: Manager attempting to inspect employee belonging to another manager
  try {
    await axios.get(`${API_BASE}/manager/team/${otherHireUser._id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    throw new Error("SECURITY_FAILURE: Manager was able to inspect an employee from another manager!");
  } catch (err: any) {
    if (err.response && err.response.status === 403) {
      console.log("✅ Cross-manager deep-dive attempt rejected with HTTP 403 Forbidden.");
    } else {
      throw new Error(`Unexpected error on cross-manager inspection: ${err.message}`);
    }
  }

  // ============================================================================
  // Step 5: Alternative Path (Manager with zero direct reports)
  // ============================================================================
  console.log("\n--- Step 5: Alternative Path (Manager with Zero Direct Reports) ---");
  const emptyOverviewRes = await axios.get(`${API_BASE}/manager/team-overview`, {
    headers: { Authorization: `Bearer ${emptyManagerToken}` },
  });

  if (emptyOverviewRes.status === 200) {
    const emptyData = emptyOverviewRes.data.data;
    if (emptyData.totalDirectReports === 0 && emptyData.team.length === 0) {
      console.log("✅ Manager with 0 direct reports cleanly receives empty state (total: 0, team: []).");
    } else {
      throw new Error(`Expected 0 direct reports, got ${emptyData.totalDirectReports}`);
    }
  }

  // ============================================================================
  // Step 6: Data Integrity Checks (MongoDB Direct Query)
  // ============================================================================
  console.log("\n--- Step 6: Data Integrity Checks (MongoDB) ---");
  const directReportsInDb = await User.find({
    organizationId: org._id,
    "employment.managerId": managerUser._id,
    isDeleted: false,
  });

  console.log(`✅ Direct reports in MongoDB for manager ${managerEmail}: ${directReportsInDb.length}`);
  for (const emp of directReportsInDb) {
    if (emp.employment?.managerId?.toString() !== managerUser._id.toString()) {
      throw new Error(`DATA_INTEGRITY_FAILURE: User ${emp.auth?.email} managerId does not match!`);
    }
    console.log(`   - Verified ${emp.auth?.email}: managerId strictly matches ${managerUser._id}`);
  }

  console.log("\n===============================================================================");
  console.log("🎉 ALL UJ-MGR-001 TESTS PASSED SUCCESSFULLY! FINAL VERDICT: PASS");
  console.log("===============================================================================\n");

  await mongoose.disconnect();
}

runJourneyTest().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
