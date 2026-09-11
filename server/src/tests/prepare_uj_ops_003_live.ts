import mongoose from "mongoose";
import dotenv from "dotenv";
import Organization from "../modules/organizations/models/organization.model.js";
import User from "../modules/auth/models/user.model.js";
import { Certificate } from "../modules/certificates/models/certificate.model.js";

dotenv.config();

async function prepareLive() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";
  await mongoose.connect(mongoUri);

  console.log("--- Ensuring Acme Corp & User for Public Certificate ---");
  let org = await Organization.findOne({ name: "Acme Corp" });
  if (!org) {
    org = await Organization.create({
      name: "Acme Corp",
      slug: "acme-corp",
      domain: "acme.test",
      plan: "Enterprise",
      status: "Active",
      branding: {
        primaryColor: "#10B981",
        secondaryColor: "#3B82F6",
        accentColor: "#F59E0B",
      },
      certificate: {
        template: "classic",
        signatoryName: "Robert Vance",
        signatoryTitle: "Chief Operations Officer",
      },
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false,
    });
  }

  let user = await User.findOne({ "profile.fullName": "Jane Doe" });
  if (!user) {
    user = await User.create({
      organizationId: org._id,
      auth: {
        email: "jane.doe@acme.test",
        passwordHash: "$argon2id$mockHash123",
      },
      profile: {
        firstName: "Jane",
        lastName: "Doe",
        fullName: "Jane Doe",
      },
      employment: {
        department: "Safety Operations",
        jobTitle: "Field Specialist",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });
  }

  console.log("--- Ensuring cert-valid-01 is Active in MongoDB ---");
  let cert = await Certificate.findOne({ certificateNumber: "cert-valid-01" });
  if (!cert) {
    cert = await Certificate.create({
      organizationId: org._id,
      employeeId: user._id,
      certificateNumber: "cert-valid-01",
      recipientName: "Jane Doe",
      organizationName: "Acme Corp",
      journeyTitle: "Enterprise Compliance & Safety Certification",
      issueDate: new Date("2026-09-01T00:00:00.000Z"),
      completionDate: new Date("2026-09-01T00:00:00.000Z"),
      sha256Signature: "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
      status: "active",
    });
    console.log("Created cert-valid-01");
  } else {
    cert.status = "active";
    cert.recipientName = "Jane Doe";
    cert.organizationName = "Acme Corp";
    cert.issueDate = new Date("2026-09-01T00:00:00.000Z");
    await cert.save();
    console.log("Updated cert-valid-01 to active");
  }

  console.log("\n--- Testing Live GET /api/v1/assignments/public/verify/cert-valid-01 ---");
  const resValid = await fetch("http://localhost:8080/api/v1/assignments/public/verify/cert-valid-01");
  console.log("Status:", resValid.status);
  const dataValid = await resValid.json();
  console.log("Valid Response Payload:\n", JSON.stringify(dataValid, null, 2));

  console.log("\n--- Testing Live GET /api/v1/assignments/public/verify/invalid-id-999 ---");
  const resInvalid = await fetch("http://localhost:8080/api/v1/assignments/public/verify/invalid-id-999");
  console.log("Status:", resInvalid.status);
  const dataInvalid = await resInvalid.json();
  console.log("Invalid Response Payload:\n", JSON.stringify(dataInvalid, null, 2));

  await mongoose.disconnect();
}

prepareLive().catch(console.error);
