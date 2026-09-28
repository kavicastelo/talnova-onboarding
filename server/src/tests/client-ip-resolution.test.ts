import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance, FastifyRequest } from "fastify";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { Session } from "../modules/auth/models/session.model.js";
import { hashPassword } from "../utils/crypto.js";
import { getClientIp, normalizeIp } from "../common/utils/ip.util.js";
import { getDemoSessionModel, getDemoUserModel, getDemoTenantModel } from "../modules/demo/models/index.js";

describe("Client IP Resolution & Anomaly Detection Consistency", () => {
  let app: FastifyInstance;
  const testOrgSlug = `ip-test-org-${Date.now()}`;
  const testUserEmail = `user-${Date.now()}@iptest.local`;
  const testUserPassword = "Password123!";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Create test organization
    const org = await Organization.create({
      name: "IP Test Organization",
      slug: testOrgSlug,
      plan: "Enterprise",
      status: "Active",
      limits: { maxUsers: 50 },
      createdBy: new mongoose.Types.ObjectId(),
    });

    // Create test user
    const hashedPassword = await hashPassword(testUserPassword);
    await User.create({
      organizationId: org._id,
      auth: {
        email: testUserEmail,
        passwordHash: hashedPassword,
        emailVerified: true,
      },
      profile: { firstName: "IP", lastName: "Tester", fullName: "IP Tester" },
      permissions: { role: "admin" },
      employment: { status: "active", employmentType: "full_time" },
    });
  });

  afterAll(async () => {
    await User.deleteMany({ "auth.email": testUserEmail });
    await Organization.deleteMany({ slug: testOrgSlug });
    await Session.deleteMany({});
    if (app) await app.close();
    await closeDemoConnection();
    await disconnectDatabase();
  });

  describe("1. ip.util Unit Tests", () => {
    it("normalizeIp handles IPv6 prefix, loopback, and whitespace", () => {
      expect(normalizeIp("::1")).toBe("127.0.0.1");
      expect(normalizeIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
      expect(normalizeIp("::ffff:198.51.100.5")).toBe("198.51.100.5");
      expect(normalizeIp("  203.0.113.195  ")).toBe("203.0.113.195");
      expect(normalizeIp(null)).toBe("127.0.0.1");
      expect(normalizeIp(undefined)).toBe("127.0.0.1");
    });

    it("getClientIp prioritizes Cloudflare and real IP headers over proxy chains", () => {
      // 1. CF-Connecting-IP takes highest priority
      const cfReq = {
        headers: {
          "cf-connecting-ip": "1.1.1.1",
          "x-real-ip": "2.2.2.2",
          "x-forwarded-for": "3.3.3.3, 4.4.4.4",
        },
      } as unknown as FastifyRequest;
      expect(getClientIp(cfReq)).toBe("1.1.1.1");

      // 2. True-Client-IP takes priority when CF is not present
      const trueClientReq = {
        headers: {
          "true-client-ip": "9.9.9.9",
          "x-real-ip": "2.2.2.2",
          "x-forwarded-for": "3.3.3.3",
        },
      } as unknown as FastifyRequest;
      expect(getClientIp(trueClientReq)).toBe("9.9.9.9");

      // 3. X-Real-IP takes priority over X-Forwarded-For
      const realIpReq = {
        headers: {
          "x-real-ip": "198.51.100.25",
          "x-forwarded-for": "203.0.113.1, 10.0.0.1",
        },
      } as unknown as FastifyRequest;
      expect(getClientIp(realIpReq)).toBe("198.51.100.25");

      // 4. Multi-hop X-Forwarded-For extracts the first (original client) IP
      const multiHopReq = {
        headers: {
          "x-forwarded-for": "203.0.113.42, 10.0.0.1, 172.16.0.1",
        },
      } as unknown as FastifyRequest;
      expect(getClientIp(multiHopReq)).toBe("203.0.113.42");

      // 5. Fallback to request.ip
      const fallbackReq = {
        headers: {},
        ip: "192.168.1.100",
      } as unknown as FastifyRequest;
      expect(getClientIp(fallbackReq)).toBe("192.168.1.100");
    });
  });

  describe("2. Standard User Auth IP Capture", () => {
    it("captures real client IP from X-Forwarded-For and stores in Session document", async () => {
      const clientIp = "198.51.100.77";

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: testUserEmail,
          password: testUserPassword,
        },
        headers: {
          "x-forwarded-for": `${clientIp}, 10.0.0.1`,
          "user-agent": "Mozilla/5.0 Client-IP-Test",
        },
      });

      expect(loginRes.statusCode).toBe(200);

      // Verify Session in database has the real client IP (not 127.0.0.1)
      const user = await User.findOne({ "auth.email": testUserEmail });
      expect(user).toBeDefined();

      const session = await Session.findOne({ userId: user?._id }).sort({ createdAt: -1 });
      expect(session).toBeDefined();
      expect(session?.ipAddress).toBe(clientIp);
    });
  });

  describe("3. Demo Environment IP Consistency", () => {
    const demoEmail = `demo-${Date.now()}@talnova.demo`;
    const demoPassword = "DemoPassword123!";
    let demoTenantId: string;
    let demoUserId: string;

    beforeAll(async () => {
      const DemoTenant = getDemoTenantModel();
      const DemoUser = getDemoUserModel();

      const tenant = await DemoTenant.create({
        name: "IP Consistency Demo Corp",
        slug: `demo-ip-${Date.now()}`,
        domain: "ip-demo.com",
        contactEmail: "admin@ip-demo.com",
        status: "ACTIVE",
        tier: "GROWTH",
        expiresAt: new Date(Date.now() + 86400000),
        sessionLimit: 5,
        allowedIpRanges: [],
      });
      demoTenantId = tenant._id.toString();

      const user = await DemoUser.create({
        demoTenantId: tenant._id,
        email: demoEmail,
        passwordHash: await hashPassword(demoPassword),
        fullName: "Demo Tester",
        role: "demo_admin",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 86400000),
      });
      demoUserId = user._id.toString();
    });

    afterAll(async () => {
      const DemoTenant = getDemoTenantModel();
      const DemoUser = getDemoUserModel();
      const DemoSession = getDemoSessionModel();

      await DemoUser.deleteMany({ email: demoEmail });
      await DemoTenant.deleteMany({ _id: demoTenantId });
      await DemoSession.deleteMany({ demoUserId });
    });

    it("does NOT falsely flag sudden IP shift when user makes requests behind a proxy", async () => {
      const clientIp = "203.0.113.88";

      // 1. Login with real client IP in X-Forwarded-For
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/login",
        payload: {
          email: demoEmail,
          password: demoPassword,
          deviceInfo: "Chrome on macOS",
        },
        headers: {
          "x-forwarded-for": `${clientIp}, 10.0.0.1`,
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const loginData = loginRes.json().data;
      const token = loginData.token;
      const sessionId = loginData.session.sessionId;

      // 2. Make authenticated API request using the same proxy IP
      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/demo/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
          "x-forwarded-for": `${clientIp}, 10.0.0.1`,
        },
      });

      expect(meRes.statusCode).toBe(200);

      // 3. Verify session was NOT marked as HIGH_RISK or SUSPICIOUS
      const DemoSession = getDemoSessionModel();
      const session = await DemoSession.findOne({ sessionId });
      expect(session).toBeDefined();
      expect(session?.ipAddress).toBe(clientIp);
      expect(session?.riskStatus).toBe("NORMAL");
      expect(session?.suspiciousReason).toBeUndefined();
    });

    it("DOES flag sudden IP shift when the client IP genuinely changes during session", async () => {
      const initialIp = "203.0.113.88";
      const genuineNewIp = "198.51.100.99";

      // 1. Login with initial IP
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/demo/auth/login",
        payload: {
          email: demoEmail,
          password: demoPassword,
          deviceInfo: "Safari on iOS",
        },
        headers: {
          "x-forwarded-for": initialIp,
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const loginData = loginRes.json().data;
      const token = loginData.token;
      const sessionId = loginData.session.sessionId;

      // 2. Make authenticated API request with a DIFFERENT client IP
      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/demo/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
          "x-forwarded-for": genuineNewIp,
        },
      });

      expect(meRes.statusCode).toBe(200);

      // 3. Verify genuine rapid IP shift was detected
      const DemoSession = getDemoSessionModel();
      const session = await DemoSession.findOne({ sessionId });
      expect(session).toBeDefined();
      expect(session?.riskStatus).toBe("HIGH_RISK");
      expect(session?.suspiciousReason).toContain("Sudden IP shift detected");
      expect(session?.suspiciousReason).toContain(initialIp);
      expect(session?.suspiciousReason).toContain(genuineNewIp);
    });
  });
});
