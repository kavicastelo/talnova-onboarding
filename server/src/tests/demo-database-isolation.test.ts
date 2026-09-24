import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { getDemoConnection, closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import { getDemoTenantModel, getDemoUserModel } from "../modules/demo/models/index.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { User } from "../modules/auth/models/user.model.js";
import { envSchema } from "../config/env.schema.js";

describe("Demo Environment — Database Isolation & Fail-Safe Boundary", () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
  });

  afterAll(async () => {
    await closeDemoConnection(app.log);
    await disconnectDatabase(app.log);
  });

  it("1. Verifies that demo models execute on a distinct, isolated connection pool", async () => {
    const demoConn = getDemoConnection(app.log);
    const prodConn = mongoose.connection;

    expect(demoConn).toBeDefined();
    expect(prodConn).toBeDefined();

    // Must be completely different connection instances
    expect(demoConn).not.toBe(prodConn);
    expect(demoConn.id).not.toBe(prodConn.id);
  });

  it("2. Verifies that creating records in Demo DB does not leak into Production DB", async () => {
    const DemoTenant = getDemoTenantModel();
    const uniqueSlug = `isolation-check-${Date.now()}`;

    // Create in Demo DB
    const demoTenant = await DemoTenant.create({
      name: "Isolation Test Corp",
      slug: uniqueSlug,
      domain: "isolation-test.com",
      contactEmail: "admin@isolation-test.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      allowedFeatures: ["checklist_tasks"],
    });

    expect(demoTenant._id).toBeDefined();

    // Verify it does NOT exist in the production Organization collection
    const prodOrg = await Organization.findOne({ slug: uniqueSlug });
    expect(prodOrg).toBeNull();

    // Verify production Organization count does not include demo tenant
    const prodMatches = await Organization.find({ name: "Isolation Test Corp" });
    expect(prodMatches.length).toBe(0);

    // Clean up demo record
    await DemoTenant.deleteOne({ _id: demoTenant._id });
  });

  it("3. Verifies that creating a User in Production does not appear in Demo User collection", async () => {
    const DemoUser = getDemoUserModel();
    const prodEmail = `prod-user-${Date.now()}@realcompany.com`;

    const dummyOrgId = new mongoose.Types.ObjectId();
    const prodUser = await User.create({
      organizationId: dummyOrgId,
      auth: {
        email: prodEmail,
        passwordHash: "$argon2id$v=19$dummyhash",
      },
      profile: { firstName: "Real", lastName: "Customer", fullName: "Real Customer" },
      permissions: { role: "admin", customRoles: [] },
      employment: { employmentType: "full_time", status: "active" },
    });

    expect(prodUser._id).toBeDefined();

    // Search in demo user collection
    const demoUser = await DemoUser.findOne({ email: prodEmail });
    expect(demoUser).toBeNull();

    // Clean up prod record
    await User.deleteOne({ _id: prodUser._id });
  });

  it("4. Fail-Safe: Verifies that APP_ENV=demo without DEMO_DATABASE_URL strictly fails validation", () => {
    const invalidConfig = {
      PORT: 8080,
      HOST: "0.0.0.0",
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      MONGODB_URI: "mongodb://localhost:27017/prod_db",
      JWT_SECRET: "secret123456",
      JWT_REFRESH_SECRET: "secret123456",
      COOKIE_SECRET: "secret123456",
      R2_ENDPOINT: "https://r2.example.com",
      R2_BUCKET: "bucket",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_URL: "https://assets.example.com",
      APP_ENV: "demo",
      // DEMO_DATABASE_URL omitted!
    };

    expect(() => envSchema.parse(invalidConfig)).toThrow(
      /FATAL: DEMO_DATABASE_URL is strictly required when APP_ENV is 'demo'/
    );
  });

  it("5. Fail-Safe: Verifies that DEMO_DATABASE_URL cannot match MONGODB_URI in production", () => {
    const dangerousProdConfig = {
      PORT: 8080,
      HOST: "0.0.0.0",
      NODE_ENV: "production",
      LOG_LEVEL: "info",
      MONGODB_URI: "mongodb+srv://prod-cluster/production-db",
      JWT_SECRET: "secret123456",
      JWT_REFRESH_SECRET: "secret123456",
      COOKIE_SECRET: "secret123456",
      R2_ENDPOINT: "https://r2.example.com",
      R2_BUCKET: "bucket",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_URL: "https://assets.example.com",
      APP_ENV: "demo",
      DEMO_DATABASE_URL: "mongodb+srv://prod-cluster/production-db", // identical to prod!
    };

    expect(() => envSchema.parse(dangerousProdConfig)).toThrow(
      /FATAL: DEMO_DATABASE_URL must never be identical to MONGODB_URI in production/
    );
  });
});
