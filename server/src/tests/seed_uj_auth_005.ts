import mongoose from "mongoose";
import dotenv from "dotenv";
import Organization from "../modules/organizations/models/organization.model.js";
import User from "../modules/auth/models/user.model.js";
import SSOConfig from "../modules/auth/models/sso-config.model.js";

dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/talnova";

async function seed() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB for seeding UJ-AUTH-005 preconditions");

  let org = await Organization.findOne({ slug: "acme-corp" });
  const dummyAdminId = new mongoose.Types.ObjectId();
  if (!org) {
    org = await Organization.create({
      name: "Acme Corp",
      slug: "acme-corp",
      createdBy: dummyAdminId,
      isDeleted: false,
    });
  }

  let admin = await User.findOne({ "auth.email": "admin@acme.corp" });
  if (!admin) {
    admin = await User.create({
      organizationId: org._id,
      auth: {
        email: "admin@acme.corp",
        passwordHash: "argon2_hash",
      },
      profile: {
        firstName: "Acme",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });
  }

  let sso = await SSOConfig.findOne({ organizationId: org._id });
  if (!sso) {
    sso = new SSOConfig({
      organizationId: org._id,
      createdBy: admin._id,
    });
  }

  sso.provider = "saml2";
  sso.domains = ["acme.corp"];
  sso.ssoUrl = "https://idp.acme.corp/sso";
  sso.issuerUrl = "https://idp.acme.corp/sso";
  sso.enforceSSO = false;
  sso.status = "active";
  sso.defaultRole = "employee";
  sso.roleMappings = [
    { idpGroup: "Engineering-Leads", role: "manager" },
    { idpGroup: "HR-Admins", role: "admin" },
  ];

  await sso.save();
  console.log("✅ Seeded Acme Corp with active SAML 2.0 SSO on domain acme.corp successfully:", sso.domains);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
