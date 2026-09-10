import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { DocumentTemplate } from "../modules/documents/models/document-template.model.js";
import { DocumentAssignment } from "../modules/documents/models/document-assignment.model.js";
import { hashPassword } from "../utils/crypto.js";

const API_BASE = "http://localhost:8080/api/v1";
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";

async function runJourneyTest() {
  console.log("===============================================================================");
  console.log("🚀 STARTING JOURNEY TEST UJ-ADM-006: Compliance Document Template Authoring");
  console.log("===============================================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB.");

  // 1. Organization
  let org = await Organization.findOne();
  if (!org) {
    const creatorId = new mongoose.Types.ObjectId();
    org = await Organization.create({
      name: "Talnova Compliance Org",
      slug: "talnova-compliance-org",
      domain: "talnova.test",
      createdBy: creatorId,
      branding: { primaryColor: "#4F46E5" },
    });
  }
  console.log(`✅ Organization identified: ${org.name} (${org._id})`);

  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  // 2. Prepare Admin & Employee users
  const adminEmail = "admin_docs_test@talnova.test";
  const employeeEmail = "employee_docs_test@talnova.test";

  await User.deleteMany({ "auth.email": { $in: [adminEmail, employeeEmail] } });

  const adminUser = await User.create({
    organizationId: org._id,
    auth: { email: adminEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Diana", lastName: "Prince", fullName: "Diana Prince" },
    permissions: { role: "admin", capabilities: ["manage_documents", "manage_compliance"] },
    employment: { status: "active", employeeId: "admin-doc-01", department: "Legal & Compliance" },
    isDeleted: false,
  });

  const employeeUser = await User.create({
    organizationId: org._id,
    auth: { email: employeeEmail, passwordHash, emailVerified: true },
    profile: { firstName: "Clark", lastName: "Kent", fullName: "Clark Kent" },
    permissions: { role: "employee", capabilities: [] },
    employment: { status: "active", employeeId: "emp-doc-01", department: "Communications" },
    isDeleted: false,
  });

  console.log("✅ Seeded test users:");
  console.log(`   - Admin: ${adminEmail}`);
  console.log(`   - Employee: ${employeeEmail}`);

  // Authenticate both
  const [adminLogin, employeeLogin] = await Promise.all([
    axios.post(`${API_BASE}/auth/login`, { email: adminEmail, password }),
    axios.post(`${API_BASE}/auth/login`, { email: employeeEmail, password }),
  ]);

  const adminToken = adminLogin.data.data.accessToken || adminLogin.data.data.token;
  const employeeToken = employeeLogin.data.data.accessToken || employeeLogin.data.data.token;
  console.log("✅ Authenticated Admin and Employee successfully.");

  // ============================================================================
  // Step 1: Authorization Gate Tests
  // ============================================================================
  console.log("\n--- Step 1: Authorization Tests (Employees Blocked from Template Authoring) ---");
  try {
    await axios.post(
      `${API_BASE}/documents`,
      {
        title: "Malicious Employee Policy",
        content: "Unauthorized content body requiring signature.",
        signatureRequired: true,
      },
      { headers: { Authorization: `Bearer ${employeeToken}` } }
    );
    throw new Error("AUTHORIZATION_FAILURE: Employee was unexpectedly allowed to create document templates!");
  } catch (err: any) {
    if (err.response && err.response.status === 403) {
      console.log("✅ Employee POST /api/v1/documents rejected with HTTP 403 Forbidden.");
    } else {
      throw new Error(`Unexpected error on employee authoring: ${err.message}`);
    }
  }

  // ============================================================================
  // Step 2: Negative Tests (Validation Enforcement)
  // ============================================================================
  console.log("\n--- Step 2: Negative Tests (Validation Enforcement) ---");
  try {
    await axios.post(
      `${API_BASE}/documents`,
      {
        title: "", // Empty title
        content: "Short", // Too short
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    throw new Error("Validation failure: Server accepted invalid document template payload!");
  } catch (err: any) {
    if (err.response && (err.response.status === 422 || err.response.status === 400)) {
      console.log(`✅ Invalid document submission correctly rejected with HTTP ${err.response.status}.`);
    } else {
      throw new Error(`Unexpected response on invalid document submission: ${err.message}`);
    }
  }

  // ============================================================================
  // Step 3: Happy Path — Author Compliance Document Template
  // ============================================================================
  console.log("\n--- Step 3: Happy Path — Create Document Template (POST /api/v1/documents) ---");
  const templatePayload = {
    title: "Global Information Security Agreement",
    category: "custom",
    content: "Employees must maintain confidentiality of all systems, credentials, and client information at all times.",
    signatureRequired: true,
    isMandatory: true,
    audience: {
      autoAssignNewHires: true,
    },
  };

  const createRes = await axios.post(`${API_BASE}/documents`, templatePayload, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  console.log(`✅ Create template status: ${createRes.status} (Expected 201 Created)`);
  if (createRes.status !== 201) {
    throw new Error(`Expected HTTP 201 Created, got ${createRes.status}`);
  }

  const createdTemplate = createRes.data.data;
  console.log("✅ Created template response data:", JSON.stringify(createdTemplate, null, 2));

  if (!createdTemplate._id) throw new Error("Missing _id in created template response");
  if (createdTemplate.title !== templatePayload.title) throw new Error("Title mismatch in created template");
  if (!createdTemplate.isMandatory) throw new Error("Expected isMandatory: true in created template");
  if (!createdTemplate.signatureRequired) throw new Error("Expected signatureRequired: true in created template");

  // ============================================================================
  // Step 4: Alternative Path — Edit Existing Document Template Content (PATCH /api/v1/documents/:id)
  // ============================================================================
  console.log("\n--- Step 4: Alternative Path — Edit Template (PATCH /api/v1/documents/:id) ---");
  const updatePayload = {
    title: "Global Information Security Agreement 2026 (v2)",
    content: "Updated 2026 Terms: Employees must maintain absolute confidentiality of all systems, AI pipelines, and proprietary code.",
  };

  const updateRes = await axios.patch(
    `${API_BASE}/documents/${createdTemplate._id}`,
    updatePayload,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  console.log(`✅ Update template status: ${updateRes.status} (Expected 200 OK)`);
  if (updateRes.status !== 200) {
    throw new Error(`Expected HTTP 200 OK, got ${updateRes.status}`);
  }
  const updatedTemplate = updateRes.data.data;
  if (updatedTemplate.title !== updatePayload.title) throw new Error("Updated title mismatch");
  if (updatedTemplate.version < 2) throw new Error(`Expected version >= 2, got ${updatedTemplate.version}`);
  console.log(`✅ Template updated to version ${updatedTemplate.version} with title: "${updatedTemplate.title}"`);

  // ============================================================================
  // Step 5: Data Integrity Checks in MongoDB
  // ============================================================================
  console.log("\n--- Step 5: MongoDB Data Integrity Verification ---");
  const templateInDb = await DocumentTemplate.findById(createdTemplate._id);
  if (!templateInDb) throw new Error("Template not found in MongoDB!");
  if (templateInDb.organizationId.toString() !== org._id.toString()) {
    throw new Error("Organization ID mismatch in MongoDB!");
  }
  if (templateInDb.isMandatory !== true) {
    throw new Error(`Expected isMandatory == true in MongoDB, got ${templateInDb.isMandatory}`);
  }
  if (templateInDb.signatureRequired !== true) {
    throw new Error(`Expected signatureRequired == true in MongoDB, got ${templateInDb.signatureRequired}`);
  }
  console.log("✅ MongoDB DocumentTemplate record verified:");
  console.log(`   - _id: ${templateInDb._id}`);
  console.log(`   - isMandatory: ${templateInDb.isMandatory}`);
  console.log(`   - organizationId: ${templateInDb.organizationId}`);
  console.log(`   - version: ${templateInDb.version}`);

  // ============================================================================
  // Step 6: Document Assignment & E-Signature Audit Trail with SHA-256
  // ============================================================================
  console.log("\n--- Step 6: Execute Signature & Verify SHA-256 Audit Trail ---");
  // 6a. Admin assigns document to employee
  const assignRes = await axios.post(
    `${API_BASE}/documents/assign`,
    {
      templateId: createdTemplate._id,
      employeeId: employeeUser._id,
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  const assignment = assignRes.data.data;
  console.log(`✅ Document assigned to employee: Assignment ID ${assignment._id}`);

  // 6b. Employee signs document
  const signPayload = {
    type: "type",
    signerName: "Clark Kent",
    signatureDataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  };

  const signRes = await axios.post(
    `${API_BASE}/documents/${assignment._id}/sign`,
    signPayload,
    { headers: { Authorization: `Bearer ${employeeToken}` } }
  );

  console.log(`✅ Document signed status: ${signRes.status}`);
  const signedDoc = signRes.data.data;
  const sha256Hash = signedDoc.signatureData?.sha256Hash;
  console.log(`✅ SHA-256 Signature Checksum generated: ${sha256Hash}`);

  if (!sha256Hash || sha256Hash.length !== 64) {
    throw new Error(`Invalid SHA-256 hash checksum: ${sha256Hash}`);
  }

  // 6c. Admin queries signatures audit trail
  const sigsRes = await axios.get(
    `${API_BASE}/documents/${createdTemplate._id}/signatures`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  console.log(`✅ Signatures audit trail status: ${sigsRes.status} (Expected 200 OK)`);
  const signaturesList = sigsRes.data.data;
  console.log(`✅ Signatures returned: ${signaturesList.length}`);

  if (!Array.isArray(signaturesList) || signaturesList.length === 0) {
    throw new Error("No signatures returned in audit trail query!");
  }

  const firstSig = signaturesList[0];
  const auditSha256 = firstSig.signatureData?.sha256Hash;
  const signerName = firstSig.signatureData?.signerName;
  const signedAt = firstSig.signedAt || firstSig.signatureData?.signedAt;

  console.log("✅ Audit Signature Record:");
  console.log(`   - Signer: ${signerName}`);
  console.log(`   - Signed At: ${signedAt}`);
  console.log(`   - Truncated SHA-256: ${auditSha256.substring(0, 16)}...`);

  if (signerName !== "Clark Kent") {
    throw new Error(`Signer name mismatch: expected 'Clark Kent', got '${signerName}'`);
  }
  if (!auditSha256 || auditSha256 !== sha256Hash) {
    throw new Error("SHA-256 hash in audit trail does not match signed document hash!");
  }

  // ============================================================================
  // Step 7: Integration Check (Linkable in Journey Template Steps)
  // ============================================================================
  console.log("\n--- Step 7: Integration Check (Available in Template Catalog) ---");
  const catalogRes = await axios.get(`${API_BASE}/documents/templates`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const catalogTemplates = catalogRes.data.data || [];
  const foundInCatalog = catalogTemplates.find((t: any) => t._id.toString() === createdTemplate._id.toString());
  if (!foundInCatalog) {
    throw new Error("Template not discoverable in /documents/templates catalog for Journey Builder!");
  }
  console.log(`✅ Template "${foundInCatalog.title}" successfully discoverable in catalog for Journey Builder.`);

  console.log("\n===============================================================================");
  console.log("🎉 ALL PROGRAMMATIC TEST SUITES PASSED FOR UJ-ADM-006!");
  console.log("===============================================================================\n");

  await mongoose.disconnect();
}

runJourneyTest().catch(async (err) => {
  console.error("❌ TEST FAILED:", err.response?.data || err.message || err);
  await mongoose.disconnect();
  process.exit(1);
});
