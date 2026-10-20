import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { User } from "../modules/auth/models/user.model.js";
import { hashPassword } from "../utils/crypto.js";
import {
  SAFE_EXTENSIONS,
  ALL_SAFE_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  validateFileName,
  PRESIGNED_URL_TTL_SECONDS,
} from "../config/storage.config.js";
import { UploadService } from "../modules/uploads/services/upload.service.js";
import { UploadRepository } from "../modules/uploads/repositories/upload.repository.js";

describe("SEC-UPL: S3/R2 Upload Hardening, Strict Extension Filtering & TTL Clamping", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let testOrgId: string;
  let testUserId: string;
  let uploadService: UploadService;
  let ipCounter = 10;

  function nextHeaders() {
    return {
      authorization: `Bearer ${adminToken}`,
      "x-forwarded-for": `10.0.50.${ipCounter++}`,
    };
  }

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    uploadService = new UploadService(new UploadRepository());

    // 1. Create Organization
    const org = await Organization.create({
      name: "Upload Hardening Test Org",
      slug: `upload-hardening-org-${Date.now()}`,
      plan: "Enterprise",
      status: "Active",
      limits: { maxStorageGb: 10 },
      createdBy: new mongoose.Types.ObjectId(),
    });
    testOrgId = org._id.toString();

    // 2. Create Admin User
    const hashedPassword = await hashPassword("Password123!");
    const user = await User.create({
      organizationId: org._id,
      auth: {
        email: `upload-admin-${Date.now()}@talnova.test`,
        passwordHash: hashedPassword,
        emailVerified: true,
      },
      profile: { firstName: "Storage", lastName: "Admin", fullName: "Storage Admin" },
      permissions: { role: "admin" },
      employment: { status: "active", employmentType: "full_time" },
    });
    testUserId = user._id.toString();

    adminToken = app.jwt.sign({
      userId: testUserId,
      organizationId: testOrgId,
      role: "admin",
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await Organization.findByIdAndDelete(testOrgId);
    await User.findByIdAndDelete(testUserId);
    await closeDemoConnection();
    await disconnectDatabase();
    await app.close();
  });

  // =========================================================================
  // 1. REJECTION OF EXECUTABLE & DANGEROUS EXTENSIONS (HTTP 422)
  // =========================================================================
  describe("1. Rejection of Executable and Script Extensions (HTTP 422)", () => {
    it("rejects test.html with HTTP 422 Validation Error", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/request-url",
        headers: nextHeaders(),
        payload: {
          fileName: "test.html",
          fileSizeBytes: 1024,
          mimeType: "text/html",
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe("Validation failed");
      expect(JSON.stringify(body.error)).toMatch(/prohibited|not allowed|validation/i);
    });

    it("rejects test.exe with HTTP 422 Validation Error", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/request-url",
        headers: nextHeaders(),
        payload: {
          fileName: "test.exe",
          fileSizeBytes: 2048,
          mimeType: "application/x-msdownload",
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe("Validation failed");
      expect(JSON.stringify(body.error)).toMatch(/prohibited|not allowed|validation/i);
    });

    it("rejects other executable extensions (.sh, .bat, .js, .vbs, .php, .py, .htm)", async () => {
      const maliciousFiles = [
        { fileName: "malware.sh", mime: "application/x-sh" },
        { fileName: "payload.bat", mime: "application/x-bat" },
        { fileName: "script.js", mime: "application/javascript" },
        { fileName: "worm.vbs", mime: "text/vbscript" },
        { fileName: "backdoor.php", mime: "application/x-php" },
        { fileName: "exploit.py", mime: "text/x-python" },
        { fileName: "phish.htm", mime: "text/html" },
      ];

      for (const item of maliciousFiles) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/uploads/request-url",
          headers: nextHeaders(),
          payload: {
            fileName: item.fileName,
            fileSizeBytes: 1024,
            mimeType: item.mime,
          },
        });

        expect(res.statusCode).toBe(422);
        const body = res.json();
        expect(body.success).toBe(false);
      }
    });

    it("rejects SVG files from uploads to prevent stored SVG XSS", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/request-url",
        headers: nextHeaders(),
        payload: {
          fileName: "vector-graphic.svg",
          fileSizeBytes: 1024,
          mimeType: "image/svg+xml",
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.success).toBe(false);
    });

    it("service layer also enforces 422 error on programmatic invocation with .html or .exe", async () => {
      await expect(
        uploadService.requestUploadUrl(testOrgId, testUserId, {
          fileName: "exploit.html",
          fileSizeBytes: 500,
          mimeType: "text/html",
        })
      ).rejects.toThrow(/prohibited/i);

      await expect(
        uploadService.requestUploadUrl(testOrgId, testUserId, {
          fileName: "trojan.exe",
          fileSizeBytes: 500,
          mimeType: "application/x-msdownload",
        })
      ).rejects.toThrow(/prohibited/i);
    });
  });

  // =========================================================================
  // 2. DOUBLE EXTENSION ATTACK MITIGATION
  // =========================================================================
  describe("2. Double Extension Attack Mitigation", () => {
    it("rejects document.pdf.exe with HTTP 422 Validation Error", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/request-url",
        headers: nextHeaders(),
        payload: {
          fileName: "document.pdf.exe",
          fileSizeBytes: 1024,
          mimeType: "application/pdf",
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(JSON.stringify(body.error)).toMatch(/prohibited|double extension|validation/i);
    });

    it("rejects files disguising executables as approved extensions (e.g. document.exe.pdf)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/request-url",
        headers: nextHeaders(),
        payload: {
          fileName: "document.exe.pdf",
          fileSizeBytes: 1024,
          mimeType: "application/pdf",
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(JSON.stringify(body.error)).toMatch(/double extension/i);
    });

    it("rejects double safe extensions (e.g. invoice.docx.pdf, image.png.jpg)", async () => {
      const doubleSafe = ["invoice.docx.pdf", "photo.png.jpg", "notes.txt.csv"];

      for (const fileName of doubleSafe) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/uploads/request-url",
          headers: nextHeaders(),
          payload: {
            fileName,
            fileSizeBytes: 1024,
            mimeType: "application/pdf",
          },
        });

        expect(res.statusCode).toBe(422);
      }
    });

    it("allows standard filenames with numbers, hyphens, and single dots (e.g. quarterly-report-v1.0.pdf)", () => {
      const res1 = validateFileName("quarterly-report-2026.pdf");
      expect(res1.isValid).toBe(true);

      const res2 = validateFileName("document-version-1.0.pdf");
      expect(res2.isValid).toBe(true);
    });
  });

  // =========================================================================
  // 3. SAFE EXTENSIONS ALLOWLIST & SUCCESSFUL PRESIGNED URL ISSUANCE
  // =========================================================================
  describe("3. Safe Extensions Allowlist Verification", () => {
    it("successfully issues presigned upload URL for approved document types (.pdf, .docx, .xlsx, .csv, .txt)", async () => {
      const testCases = [
        { fileName: "employee-handbook.pdf", mime: "application/pdf" },
        { fileName: "job-description.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        { fileName: "compensation-grid.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        { fileName: "user-export.csv", mime: "text/csv" },
        { fileName: "readme.txt", mime: "text/plain" },
      ];

      for (const item of testCases) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/uploads/request-url",
          headers: nextHeaders(),
          payload: {
            fileName: item.fileName,
            fileSizeBytes: 1024,
            mimeType: item.mime,
            visibility: "private",
          },
        });

        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.success).toBe(true);
        expect(body.data.uploadUrl).toBeDefined();
        expect(body.data.objectKey).toBeDefined();
      }
    });

    it("successfully issues presigned upload URL for approved media (.png, .jpg, .webp, .mp4, .mp3)", async () => {
      const testCases = [
        { fileName: "profile-avatar.png", mime: "image/png" },
        { fileName: "office-photo.jpg", mime: "image/jpeg" },
        { fileName: "hero-banner.webp", mime: "image/webp" },
        { fileName: "welcome-video.mp4", mime: "video/mp4" },
        { fileName: "podcast-intro.mp3", mime: "audio/mpeg" },
      ];

      for (const item of testCases) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/uploads/request-url",
          headers: nextHeaders(),
          payload: {
            fileName: item.fileName,
            fileSizeBytes: 5000,
            mimeType: item.mime,
            visibility: "private",
          },
        });

        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.success).toBe(true);
        expect(body.data.uploadUrl).toBeDefined();
      }
    });
  });

  // =========================================================================
  // 4. PRESIGNED URL TTL CLAMPING & CONTENT-DISPOSITION
  // =========================================================================
  describe("4. Presigned URL TTL Clamping (300s) & Content-Disposition Attachment Metadata", () => {
    it("clamps presigned URL expiration strictly to 300 seconds (5 minutes) instead of 3600 seconds", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/request-url",
        headers: nextHeaders(),
        payload: {
          fileName: "confidential-contract.pdf",
          fileSizeBytes: 2048,
          mimeType: "application/pdf",
          visibility: "private",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      const uploadUrl: string = body.data.uploadUrl;

      // Parse the query string of the AWS S3 / Cloudflare R2 presigned URL
      const parsedUrl = new URL(uploadUrl);
      const amzExpires = parsedUrl.searchParams.get("X-Amz-Expires");

      // Verify expiration is clamped to exactly 300 seconds
      expect(amzExpires).toBe("300");
      expect(PRESIGNED_URL_TTL_SECONDS).toBe(300);
    });

    it("attaches Content-Disposition: attachment metadata to private uploads to prevent in-browser execution", async () => {
      const fileName = "sensitive-employee-record.pdf";
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/request-url",
        headers: nextHeaders(),
        payload: {
          fileName,
          fileSizeBytes: 4096,
          mimeType: "application/pdf",
          visibility: "private",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      const uploadUrl: string = body.data.uploadUrl;
      const parsedUrl = new URL(uploadUrl);

      // Verify that content-disposition is part of signed headers or signed query parameters
      const signedHeaders = parsedUrl.searchParams.get("X-Amz-SignedHeaders") || "";
      expect(signedHeaders.toLowerCase()).toContain("content-disposition");
    });
  });
});
