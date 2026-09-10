import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { EmployeeAssignment } from "../modules/assignments/models/assignment.model.js";
import Task from "../modules/tasks/models/task.model.js";
import { DocumentAssignment } from "../modules/documents/models/document-assignment.model.js";
import EmployeeMilestone from "../modules/milestones/models/employee-milestone.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import { Certificate, generateCertificateSignature, verifyCertificateSignature } from "../modules/certificates/models/certificate.model.js";
import { hashPassword } from "../utils/crypto.js";

const API_BASE = "http://localhost:8080/api/v1";
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";

async function runTest() {
  console.log("=== Starting Journey Test UJ-ONB-008: Complete Handover & Receive Certificate ===");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  // 1. Ensure Organization
  let org = await Organization.findOne();
  if (!org) {
    const creatorId = new mongoose.Types.ObjectId();
    org = await Organization.create({
      name: "Talnova Test Organization",
      slug: "talnova-test-org",
      domain: "talnova.test",
      createdBy: creatorId,
      branding: {
        primaryColor: "#4F46E5",
      },
      certificate: {
        template: "classic",
        signatoryName: "Talnova Verification Authority",
        signatoryTitle: "Chief People Officer",
      },
    });
  }

  // 2. Ensure HR Admin user
  const adminEmail = "hr_admin_handover@talnova.test";
  const passwordHash = await hashPassword("Password123!");
  let admin = await User.findOne({ "auth.email": adminEmail });
  if (!admin) {
    admin = await User.create({
      organizationId: org._id,
      auth: {
        email: adminEmail,
        passwordHash,
      },
      profile: {
        firstName: "Sarah",
        lastName: "Jenkins",
        fullName: "Sarah Jenkins",
      },
      permissions: {
        role: "admin",
        capabilities: ["hr_operations", "complete_handover", "manage_employees"],
      },
      employment: {
        status: "active",
        jobTitle: "HR Director",
        department: "Human Resources",
      },
      isDeleted: false,
    });
  }

  // 3. Prepare Completed Employee: completed_hire@talnova.test
  const empEmail = "completed_hire@talnova.test";
  await Certificate.deleteMany({ recipientName: "Marcus Vance" });
  await User.deleteMany({ "auth.email": empEmail });

  const employee = await User.create({
    organizationId: org._id,
    auth: {
      email: empEmail,
      passwordHash,
    },
    profile: {
      firstName: "Marcus",
      lastName: "Vance",
      fullName: "Marcus Vance",
    },
    permissions: {
      role: "employee",
      capabilities: [],
    },
    employment: {
      status: "onboarding",
      onboardingState: "active",
      jobTitle: "Senior DevOps Engineer",
      department: "Engineering",
    },
    statistics: {
      certificates: 0,
    },
    isDeleted: false,
  });

  // Ensure Journey Template
  let journey = await Journey.findOne({ organizationId: org._id });
  if (!journey) {
    journey = await Journey.create({
      organizationId: org._id,
      title: "DevOps & Infrastructure Onboarding",
      slug: "devops-onboarding",
      description: "Comprehensive technical curriculum for DevOps engineers",
      department: "Engineering",
      createdBy: admin._id,
      publishing: {
        status: "published",
      },
      certificate: {
        enabled: true,
      },
    });
  }

  // Create completed Assignment
  await EmployeeAssignment.deleteMany({ employeeId: employee._id });
  const assignment = await EmployeeAssignment.create({
    organizationId: org._id,
    employeeId: employee._id,
    assignedBy: admin._id,
    journey: {
      journeyId: journey._id,
      title: journey.title,
      version: 1,
    },
    assignment: {
      assignedAt: new Date(),
      priority: "high",
    },
    status: "completed",
    progress: {
      totalModules: 1,
      completedModules: 1,
      totalLessons: 1,
      completedLessons: 1,
      completionPercentage: 100,
      totalTimeSpentSeconds: 1200,
    },
    modules: [
      {
        moduleId: new mongoose.Types.ObjectId(),
        title: "Kubernetes & Cloud Security Essentials",
        completed: true,
        completedAt: new Date(),
      },
    ],
    completedAt: new Date(),
    certificate: {
      issued: false,
    },
  });

  // Create completed Task
  await Task.deleteMany({ employeeId: employee._id });
  await Task.create({
    organizationId: org._id,
    employeeId: employee._id,
    assignedToUserId: employee._id,
    createdBy: admin._id,
    title: "Configure Corporate VPN & SSH Keys",
    category: "it_setup",
    stage: "day_1",
    status: "completed",
    completedAt: new Date(),
  });

  // Create signed Document
  await DocumentAssignment.deleteMany({ employeeId: employee._id });
  await DocumentAssignment.create({
    organizationId: org._id,
    templateId: new mongoose.Types.ObjectId(),
    templateTitle: "Confidentiality & Security Agreement",
    templateVersion: 1,
    employeeId: employee._id,
    assignedBy: admin._id,
    status: "signed",
    assignedAt: new Date(),
    signedAt: new Date(),
  });

  // Create completed Milestone
  await EmployeeMilestone.deleteMany({ employeeId: employee._id });
  await EmployeeMilestone.create({
    organizationId: org._id,
    templateId: new mongoose.Types.ObjectId(),
    employeeId: employee._id,
    assignedBy: admin._id,
    milestoneTitle: "Day 30 Technical Autonomy & Team Check-In",
    targetDay: 30,
    dueDate: new Date(),
    status: "completed",
    employeeRating: 5,
    managerRating: 5,
    completedAt: new Date(),
  });

  console.log("Preconditions satisfied: All documents, tasks, modules, and milestones completed.");

  // Login as employee
  const empLoginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: empEmail,
    password: "Password123!",
  });
  const empToken = empLoginRes.data.data.accessToken;
  const empHeaders = { Authorization: `Bearer ${empToken}` };

  // Login as Admin
  const adminLoginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: adminEmail,
    password: "Password123!",
  });
  const adminToken = adminLoginRes.data.data.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // -------------------------------------------------------------
  // NEGATIVE TEST: Attempt accessing certificate before handover sign-off
  // -------------------------------------------------------------
  console.log("\n[TEST] 1. Negative Test: Access certificate before handover sign-off");
  const negRes = await axios.get(`${API_BASE}/certificates/me`, { headers: empHeaders });
  console.log("Pre-handover /certificates/me status:", negRes.status, "data:", negRes.data);
  if (negRes.data.data?.certificates?.length === 0) {
    console.log("✓ PASS: Returns empty certificates array before onboarding is verified.");
  } else {
    throw new Error("FAIL: Certificate unexpectedly exists before handover!");
  }

  // -------------------------------------------------------------
  // HANDOVER TEST: POST /api/v1/hr/handover/:employeeId
  // -------------------------------------------------------------
  console.log("\n[TEST] 2. HR Handover Sign-Off: POST /api/v1/hr/handover/:employeeId");
  const handoverRes = await axios.post(
    `${API_BASE}/hr/handover/${employee._id}`,
    { reason: "All requirements completed with distinction" },
    { headers: adminHeaders }
  );
  console.log("Handover response status:", handoverRes.status, "message:", handoverRes.data?.message);
  if (handoverRes.status !== 200) {
    throw new Error(`FAIL: Handover failed with status ${handoverRes.status}`);
  }
  console.log("✓ PASS: Handover successfully executed by HR Admin.");

  // -------------------------------------------------------------
  // HAPPY PATH: GET /api/v1/certificates/me
  // -------------------------------------------------------------
  console.log("\n[TEST] 3. Happy Path: GET /api/v1/certificates/me");
  const certRes = await axios.get(`${API_BASE}/certificates/me`, { headers: empHeaders });
  console.log("/certificates/me status:", certRes.status, "certificates count:", certRes.data.data?.certificates?.length);
  if (certRes.status !== 200 || !certRes.data.data?.certificates?.length) {
    throw new Error("FAIL: /certificates/me did not return issued certificates.");
  }

  const certificate = certRes.data.data.certificates[0];
  console.log("Retrieved Certificate:", {
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    recipientName: certificate.recipientName,
    organizationName: certificate.organizationName,
    completionDate: certificate.completionDate,
    sha256Signature: certificate.sha256Signature,
  });

  // Verify fields
  if (
    !certificate.recipientName ||
    !certificate.organizationName ||
    !certificate.completionDate ||
    !certificate.certificateNumber
  ) {
    throw new Error("FAIL: Certificate missing essential fields (recipientName, orgName, date, ID)!");
  }
  console.log("✓ PASS: Certificate contains Employee Name, Org Name, Completion Date, and Credential ID.");

  // -------------------------------------------------------------
  // DATA INTEGRITY CHECK: SHA-256 Signature
  // -------------------------------------------------------------
  console.log("\n[TEST] 4. Data Integrity Check: Verify sha256Signature");
  const isSignatureValid = verifyCertificateSignature(
    certificate.certificateNumber,
    employee._id.toString(),
    org._id.toString(),
    certificate.issueDate,
    certificate.sha256Signature
  );

  console.log("Signature verification result:", isSignatureValid);
  if (!isSignatureValid) {
    throw new Error("FAIL: SHA-256 signature mismatch against certificate payload!");
  }
  console.log("✓ PASS: Certificate cryptographic signature is verified.");

  // -------------------------------------------------------------
  // PUBLIC VERIFICATION & AUTHORIZATION TEST: Public Certificate Viewer
  // -------------------------------------------------------------
  console.log("\n[TEST] 5. Public Viewer & Authorization Test: GET /api/v1/assignments/public/verify/:id");
  const publicRes = await axios.get(`${API_BASE}/assignments/public/verify/${certificate.id}`);
  console.log("Public verification response status:", publicRes.status);
  console.log("Public payload keys:", Object.keys(publicRes.data.data));

  // Authorization / Privacy assertion: No PII leak
  const publicData = publicRes.data.data;
  const rawString = JSON.stringify(publicData);

  if (rawString.includes(empEmail)) {
    throw new Error("FAIL: Public viewer leaked employee email address!");
  }
  if (rawString.includes("password") || rawString.includes("passwordHash")) {
    throw new Error("FAIL: Public viewer leaked password information!");
  }
  if (!publicData.recipientName || !publicData.journeyTitle || !publicData.certificateId) {
    throw new Error("FAIL: Public viewer missing public credential details!");
  }
  console.log("✓ PASS: Public certificate viewer successfully verifies credential and strictly protects PII.");

  // -------------------------------------------------------------
  // PERSISTENCE & LIFECYCLE CHECK: Active Employee Workspace State
  // -------------------------------------------------------------
  console.log("\n[TEST] 6. Persistence Check: User employment status in MongoDB");
  const updatedUser = await User.findById(employee._id);
  console.log("Updated user employment status:", updatedUser?.employment?.status);
  console.log("Updated user onboardingState:", updatedUser?.employment?.onboardingState);
  console.log("Updated user statistics.certificates:", updatedUser?.statistics?.certificates);

  if (updatedUser?.employment?.status !== "active" || updatedUser?.employment?.onboardingState !== "completed") {
    throw new Error("FAIL: User status was not updated to active/completed in MongoDB!");
  }
  console.log("✓ PASS: User lifecycle updated to Active Employee in MongoDB.");

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY FOR UJ-ONB-008 ===");
  await mongoose.disconnect();
}

runTest().catch((err) => {
  console.error("Test failed with error:", err.message, err.response?.data || "");
  process.exit(1);
});
