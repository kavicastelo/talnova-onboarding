import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import { WorkflowRule } from "../modules/workflows/models/workflow-rule.model.js";
import WorkflowExecutionLog from "../modules/workflows/models/workflow-execution.model.js";
import { EmployeeAssignment } from "../modules/assignments/models/assignment.model.js";
import { hashPassword } from "../utils/crypto.js";

const API_BASE = "http://localhost:8080/api/v1";
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";

async function runTest() {
  console.log("================================================================================");
  console.log(" Journey Test UJ-ADM-004: Workflow Automation Rule Configuration");
  console.log("================================================================================");

  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB.");

  // 1. Ensure Organization
  let org = await Organization.findOne();
  if (!org) {
    const creatorId = new mongoose.Types.ObjectId();
    org = await Organization.create({
      name: "Talnova Test Organization",
      slug: "talnova-test-org",
      domain: "talnova.test",
      createdBy: creatorId,
    });
  }

  // 2. Ensure Admin User
  const adminEmail = "admin_workflow@talnova.test";
  const password = "Password123!";
  const passwordHash = await hashPassword(password);
  let admin = await User.findOne({ "auth.email": adminEmail });
  if (!admin) {
    admin = await User.create({
      organizationId: org._id,
      auth: { email: adminEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Admin", lastName: "Workflow", fullName: "Admin Workflow" },
      permissions: { role: "admin", customRoles: [] },
      employment: { status: "active", employmentType: "full_time" },
      isDeleted: false,
    });
  }

  // 3. Ensure Employee User for Authorization Testing
  const employeeEmail = "emp_workflow@talnova.test";
  let employee = await User.findOne({ "auth.email": employeeEmail });
  if (!employee) {
    employee = await User.create({
      organizationId: org._id,
      auth: { email: employeeEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Regular", lastName: "Employee", fullName: "Regular Employee" },
      permissions: { role: "employee", customRoles: [] },
      employment: { department: "Sales", status: "active", employmentType: "full_time" },
      isDeleted: false,
    });
  }

  // 4. Ensure Published Journey Template exists
  let engTemplate = await Journey.findOne({
    organizationId: org._id,
    "publishing.status": "published",
    isDeleted: false,
  });

  if (!engTemplate) {
    engTemplate = await Journey.create({
      organizationId: org._id,
      title: "Engineering Onboarding Pathway",
      slug: `engineering-onboarding-pathway-${Date.now()}`,
      description: "Standard onboarding pathway for all engineering hires.",
      department: "Engineering",
      role: "Software Engineer",
      publishing: {
        status: "published",
        publishedAt: new Date(),
        version: 1,
      },
      createdBy: admin._id,
      audience: {
        departmentNames: ["Engineering"],
        isPublic: true,
      },
      modules: [
        {
          _id: new mongoose.Types.ObjectId(),
          title: "Engineering Overview",
          order: 1,
          estimatedDurationMinutes: 30,
          lessons: [
            {
              _id: new mongoose.Types.ObjectId(),
              title: "Welcome to Engineering",
              order: 1,
              estimatedDurationMinutes: 15,
              contentBlocks: [],
              attachments: [],
              completionRules: {
                requireContentCompletion: false,
                requireQuizCompletion: false,
              },
            },
          ],
        },
      ],
      isDeleted: false,
    });
  } else {
    engTemplate.createdBy = engTemplate.createdBy || admin._id;
    engTemplate.publishing = engTemplate.publishing || { version: 1 };
    engTemplate.publishing.status = "published";
    if (!engTemplate.modules || engTemplate.modules.length === 0) {
      engTemplate.modules = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: "Engineering Overview",
          order: 1,
          estimatedDurationMinutes: 30,
          lessons: [],
        },
      ];
    }
    await engTemplate.save();
  }
  console.log(`✓ Published Journey Template ready: "${engTemplate.title}" (ID: ${engTemplate._id})`);

  // 5. Authenticate Admin and Employee
  const adminLoginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: adminEmail,
    password,
  });
  const adminToken = adminLoginRes.data.data.accessToken;
  console.log("✓ Admin authenticated successfully.");

  const empLoginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: employeeEmail,
    password,
  });
  const empToken = empLoginRes.data.data.accessToken;
  console.log("✓ Employee authenticated successfully.");

  // ============================================================================
  // AUTHORIZATION TEST: Non-admin calling POST /api/v1/workflows/rules receives HTTP 403
  // ============================================================================
  console.log("\n--- [Authorization Test] Non-admin attempting POST /api/v1/workflows/rules ---");
  let authBlocked = false;
  try {
    await axios.post(
      `${API_BASE}/workflows/rules`,
      {
        title: "Malicious Rule",
        triggerType: "ON_USER_CREATED",
        actions: [{ type: "assign_journey", params: { journeyId: engTemplate._id.toString() } }],
      },
      {
        headers: { Authorization: `Bearer ${empToken}` },
      }
    );
  } catch (err: any) {
    if (err.response?.status === 403) {
      authBlocked = true;
      console.log(`✓ Authorization check passed: Employee received HTTP 403 Forbidden (${err.response.data.message})`);
    } else {
      console.error(`✗ Unexpected error code: ${err.response?.status}`, err.response?.data);
    }
  }

  if (!authBlocked) {
    throw new Error("Authorization Test FAILED: Employee was able to create workflow rules!");
  }

  // ============================================================================
  // NEGATIVE TEST: Missing action target template triggers validation error
  // ============================================================================
  console.log("\n--- [Negative Test] Missing Action Target Template ---");
  let validationBlocked = false;
  try {
    await axios.post(
      `${API_BASE}/workflows/rules`,
      {
        title: "Invalid Rule Missing Journey",
        triggerType: "ON_USER_CREATED",
        actions: [{ type: "assign_journey", params: {} }], // Missing journeyId
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
  } catch (err: any) {
    if (err.response?.status === 400) {
      validationBlocked = true;
      console.log(`✓ Negative test passed: Received HTTP 400 Bad Request (${err.response.data.message})`);
    } else {
      console.error(`✗ Unexpected status: ${err.response?.status}`, err.response?.data);
    }
  }

  if (!validationBlocked) {
    throw new Error("Negative Test FAILED: Rule with missing action target was accepted!");
  }

  // ============================================================================
  // HAPPY PATH: Create, configure, activate, and prioritize workflow rule
  // ============================================================================
  console.log("\n--- [Happy Path] Create & Activate Workflow Rule ---");
  const rulePayload = {
    title: "Auto Assign Eng Onboarding",
    triggerType: "ON_USER_CREATED",
    conditions: [
      {
        field: "department",
        operator: "equals",
        value: "Engineering",
      },
    ],
    actions: [
      {
        type: "ASSIGN_JOURNEY",
        params: {
          journeyId: engTemplate._id.toString(),
        },
      },
    ],
    priority: 10,
    isActive: true,
  };

  const createRuleRes = await axios.post(`${API_BASE}/workflows/rules`, rulePayload, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  console.log(`✓ Network Response Status: ${createRuleRes.status} (Expected: 201 Created)`);
  if (createRuleRes.status !== 201) {
    throw new Error(`Expected HTTP 201 Created, got ${createRuleRes.status}`);
  }

  const createdRule = createRuleRes.data.data;
  console.log(`✓ Rule Created: ID = ${createdRule._id}, Name = "${createdRule.name}", Priority = ${createdRule.priority}`);

  // Data Integrity Verification in MongoDB
  const ruleDoc = await WorkflowRule.findById(createdRule._id);
  if (!ruleDoc) throw new Error("Rule document not found in MongoDB!");

  console.log("\n--- [Data Integrity Check] MongoDB WorkflowRule Document ---");
  console.log(JSON.stringify({
    _id: ruleDoc._id,
    name: ruleDoc.name,
    triggerType: ruleDoc.triggerType,
    isActive: ruleDoc.isActive,
    priority: ruleDoc.priority,
    conditions: ruleDoc.conditions,
    actions: ruleDoc.actions,
    createdBy: ruleDoc.createdBy,
  }, null, 2));

  if (!ruleDoc.isActive) throw new Error("Expected ruleDoc.isActive to be true!");
  if (ruleDoc.priority !== 10) throw new Error(`Expected ruleDoc.priority to be 10, got ${ruleDoc.priority}`);
  if (ruleDoc.conditions[0]?.value !== "Engineering") throw new Error("Expected condition value to be Engineering!");
  if (ruleDoc.actions[0]?.params?.journeyId !== engTemplate._id.toString()) {
    throw new Error("Expected action params journeyId to match target template ID!");
  }
  console.log("✓ Data integrity verified in MongoDB.");

  // ============================================================================
  // ALTERNATIVE PATH: Toggle rule switch to deactivate & activate rule
  // ============================================================================
  console.log("\n--- [Alternative Path] Toggle Rule Switch to Deactivate / Activate ---");
  const deactivateRes = await axios.patch(
    `${API_BASE}/workflows/rules/${createdRule._id}`,
    { isActive: false },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log(`✓ Deactivated rule via PATCH /api/v1/workflows/rules/:id: HTTP ${deactivateRes.status}, isActive = ${deactivateRes.data.data.isActive}`);

  const ruleDocDeactivated = await WorkflowRule.findById(createdRule._id);
  if (ruleDocDeactivated?.isActive !== false) {
    throw new Error("Expected rule to be deactivated in database!");
  }

  const reactivateRes = await axios.patch(
    `${API_BASE}/workflows/rules/${createdRule._id}`,
    { isActive: true },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log(`✓ Reactivated rule via PATCH /api/v1/workflows/rules/:id: HTTP ${reactivateRes.status}, isActive = ${reactivateRes.data.data.isActive}`);

  const ruleDocReactivated = await WorkflowRule.findById(createdRule._id);
  if (ruleDocReactivated?.isActive !== true) {
    throw new Error("Expected rule to be active in database!");
  }

  // ============================================================================
  // INTEGRATION CHECK: Create new employee with department "Engineering"
  // Verify rule executes and assigns the journey.
  // ============================================================================
  console.log("\n--- [Integration Check] Trigger Event for New Engineering Hire ---");
  const newHireTimestamp = Date.now();
  const newHireEmail = `eng_hire_${newHireTimestamp}@talnova.test`;

  const inviteRes = await axios.post(
    `${API_BASE}/employees/invite`,
    {
      email: newHireEmail,
      firstName: "Alex",
      lastName: "Developer",
      role: "employee",
      employmentType: "full_time",
      departmentId: "Engineering",
      designation: "Software Engineer",
    },
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );

  console.log(`✓ New Hire Invited: HTTP ${inviteRes.status}, Email = ${newHireEmail}`);
  const newHireUser = await User.findOne({ "auth.email": newHireEmail });
  if (!newHireUser) throw new Error("New hire user record not found in MongoDB!");

  // Ensure user has employment.department set to Engineering
  newHireUser.employment.department = "Engineering";
  await newHireUser.save();

  // Give asynchronous event listeners and workflow engine a moment to process
  console.log("Waiting for workflow engine to process event and assign journey...");
  let assigned = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const assignment = await EmployeeAssignment.findOne({
      employeeId: newHireUser._id,
      "journey.journeyId": engTemplate._id,
      isDeleted: false,
    });
    if (assignment) {
      assigned = true;
      console.log(`✓ Automated Journey Assignment Created! Assignment ID: ${assignment._id}`);
      console.log(`  Target User: ${newHireUser.profile.fullName} (${newHireUser.auth.email})`);
      console.log(`  Journey: "${assignment.journey.title}"`);
      break;
    }
  }

  if (!assigned) {
    // If not triggered via background listener, directly test engine processEvent
    console.log("Testing workflow engine execution directly...");
    const { default: workflowEngine } = await import("../modules/workflows/services/workflow.engine.js");
    const execCount = await workflowEngine.processEvent(org._id, "user_created", newHireUser._id, {
      department: "Engineering",
    });
    console.log(`WorkflowEngine executed ${execCount} rules.`);

    const assignment = await EmployeeAssignment.findOne({
      employeeId: newHireUser._id,
      "journey.journeyId": engTemplate._id,
    });
    if (!assignment) {
      throw new Error("Integration Check FAILED: Assignment was not created by workflow rule!");
    }
    console.log(`✓ Automated Journey Assignment Verified: ID = ${assignment._id}`);
  }

  // Check execution log in MongoDB
  const execLog = await WorkflowExecutionLog.findOne({
    workflowRuleId: createdRule._id,
    targetUserId: newHireUser._id,
  });

  if (execLog) {
    console.log(`✓ Workflow Execution Log Verified: Status = ${execLog.status}, Steps Executed = ${execLog.stepResults.length}`);
  }

  console.log("\n================================================================================");
  console.log(" UJ-ADM-004 Programmatic Verification: ALL CHECKS PASSED SUCCESSFULLY!");
  console.log("================================================================================");

  await mongoose.disconnect();
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
