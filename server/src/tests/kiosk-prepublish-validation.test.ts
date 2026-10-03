import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { Upload } from "../modules/uploads/models/upload.model.js";
import {
  KioskJourneyModel,
  KioskJourneyVersionModel,
  validateJourneyForPublish
} from "../modules/kiosk/index.js";

describe("Kiosk Journey Pre-Publish Validation & Linter Pipeline (K-JRN-003)", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let adminAToken: string;
  let supervisorUser: any;
  let activeUploadA: any;
  let deletedUploadA: any;
  let foreignUploadB: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up stale organizations
    await Organization.deleteMany({ slug: { $in: ["kiosk-val-org-a", "kiosk-val-org-b"] } });

    const orgA = await Organization.create({
      name: "Kiosk Validation Org A",
      slug: "kiosk-val-org-a",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgAId = orgA._id as mongoose.Types.ObjectId;

    const orgB = await Organization.create({
      name: "Kiosk Validation Org B",
      slug: "kiosk-val-org-b",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // Clean up old test data
    await User.deleteMany({
      "auth.email": { $in: ["kiosk-val-admin-a@test.com", "kiosk-val-sup-a@test.com"] }
    });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskJourneyVersionModel.collection.deleteMany({
      organizationId: { $in: [orgAId, orgBId] }
    });
    await Upload.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });

    // Seed admin user
    adminAUser = await User.create({
      organizationId: orgAId,
      auth: { email: "kiosk-val-admin-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
      profile: { firstName: "Admin", lastName: "ValA" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false
    });

    adminAToken = app.jwt.sign({
      userId: adminAUser._id.toString(),
      organizationId: orgAId.toString(),
      role: "admin"
    });

    // Seed test uploads
    activeUploadA = await Upload.create({
      organizationId: orgAId,
      fileName: "safety_poster.jpg",
      originalFileName: "safety_poster.jpg",
      extension: "jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 10240,
      type: "image",
      storage: {
        provider: "cloudflare-r2",
        bucket: "talnova-uploads",
        objectKey: "uploads/safety_poster.jpg",
        publicUrl: "https://cdn.example.com/safety_poster.jpg"
      },
      ownership: {
        uploadedBy: adminAUser._id,
        uploadedAt: new Date()
      },
      usage: { usageCount: 1 },
      security: { visibility: "public", virusScanned: true, virusScanStatus: "clean" },
      lifecycle: { status: "active" }
    });

    deletedUploadA = await Upload.create({
      organizationId: orgAId,
      fileName: "deleted_guide.mp4",
      originalFileName: "deleted_guide.mp4",
      extension: "mp4",
      mimeType: "video/mp4",
      fileSizeBytes: 20480,
      type: "video",
      storage: {
        provider: "cloudflare-r2",
        bucket: "talnova-uploads",
        objectKey: "uploads/deleted_guide.mp4",
        publicUrl: "https://cdn.example.com/deleted_guide.mp4"
      },
      ownership: {
        uploadedBy: adminAUser._id,
        uploadedAt: new Date()
      },
      usage: { usageCount: 0 },
      security: { visibility: "public", virusScanned: true, virusScanStatus: "clean" },
      lifecycle: { status: "deleted" }
    });

    foreignUploadB = await Upload.create({
      organizationId: orgBId,
      fileName: "org_b_asset.jpg",
      originalFileName: "org_b_asset.jpg",
      extension: "jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 5120,
      type: "image",
      storage: {
        provider: "cloudflare-r2",
        bucket: "talnova-uploads",
        objectKey: "uploads/org_b_asset.jpg",
        publicUrl: "https://cdn.example.com/org_b_asset.jpg"
      },
      ownership: {
        uploadedBy: new mongoose.Types.ObjectId(),
        uploadedAt: new Date()
      },
      usage: { usageCount: 1 },
      security: { visibility: "public", virusScanned: true, virusScanStatus: "clean" },
      lifecycle: { status: "active" }
    });
  });

  afterAll(async () => {
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
    await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskJourneyVersionModel.collection.deleteMany({
      organizationId: { $in: [orgAId, orgBId] }
    });
    await Upload.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });

    await app.close();
    await disconnectDatabase(app.log);
  });

  const createBaseJourneyData = (overrides: any = {}) => ({
    organizationId: orgAId,
    createdBy: adminAUser?._id || new mongoose.Types.ObjectId(),
    title: "Safety Induction & Compliance Briefing",
    description: "Standard terminal safety journey",
    version: 1,
    status: "draft",
    defaultLanguage: "en",
    languages: ["en"],
    estimatedDurationMinutes: 10,
    steps: [
      {
        id: "step-1",
        title: "PPE Gear Inspection",
        type: "instruction_step",
        order: 0,
        interaction: {
          type: "tap_to_continue"
        },
        blocks: [
          {
            id: "b-1",
            type: "text",
            order: 0,
            settings: {
              size: "medium"
            },
            mediaReferences: {
              en: {
                textValue: "Please equip helmet, high-vis vest, and safety boots."
              }
            }
          }
        ]
      },
      {
        id: "step-term",
        title: "Session Completion",
        type: "completion",
        order: 1,
        interaction: {
          type: "tap_to_continue"
        },
        blocks: [
          {
            id: "b-term",
            type: "text",
            order: 0,
            settings: {
              size: "medium"
            },
            mediaReferences: {
              en: {
                textValue: "Session completed successfully."
              }
            }
          }
        ]
      }
    ],
    settings: {
      autoPlay: false,
      loopForever: false,
      idleTimeoutSeconds: 60,
      autoReturnHome: true,
      hideNavigation: false,
      disableExit: true,
      security: {
        protectionType: "none"
      },
      requireSupervisorWitness: false,
      enableOfflineCaching: true
    },
    publishing: {
      version: 1,
      status: "draft"
    },
    isDeleted: false,
    ...overrides
  });

  describe("Rule 1: Step Structure & Terminal Completion Enforcement", () => {
    it("should reject journey with 0 content steps (only completion step)", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-term",
            title: "Session Completion",
            type: "completion",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "step_structure")).toBe(true);
      expect(report.errors.find(e => e.rule === "step_structure")?.message).toContain("at least 1 content step");
    });

    it("should reject journey with 0 completion steps", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-1",
            title: "Content Step 1",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Step 1" } } }]
          },
          {
            id: "step-2",
            title: "Content Step 2",
            type: "instruction_step",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-2", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Step 2" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "terminal_completion")).toBe(true);
      expect(report.errors.find(e => e.rule === "terminal_completion")?.message).toContain("exactly 1 terminal completion step");
    });

    it("should reject journey where completion step is NOT terminal (placed in the middle)", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-1",
            title: "Content Step 1",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Step 1" } } }]
          },
          {
            id: "step-term",
            title: "Completion in the middle",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          },
          {
            id: "step-3",
            title: "Trailing Content Step",
            type: "instruction_step",
            order: 2,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-3", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Step 3" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "terminal_completion")).toBe(true);
      expect(report.errors.find(e => e.rule === "terminal_completion")?.message).toContain("must be the final step");
    });

    it("should reject journey with multiple completion steps", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-1",
            title: "Content Step 1",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Step 1" } } }]
          },
          {
            id: "step-term-1",
            title: "Completion 1",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-t1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done 1" } } }]
          },
          {
            id: "step-term-2",
            title: "Completion 2",
            type: "completion",
            order: 2,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-t2", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done 2" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "terminal_completion")).toBe(true);
    });
  });

  describe("Rule 2: S3 Media Asset Verification", () => {
    it("should reject journey with non-existent uploadId", async () => {
      const fakeUploadId = new mongoose.Types.ObjectId().toString();
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-media",
            title: "Media Step",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-media",
                type: "image",
                order: 0,
                settings: { zoomable: false },
                mediaReferences: {
                  en: {
                    uploadId: fakeUploadId,
                    embedUrl: undefined
                  }
                }
              }
            ]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "media_asset")).toBe(true);
      expect(report.errors.find(e => e.rule === "media_asset")?.message).toContain("does not exist or has been deleted");
    });

    it("should reject journey with deleted uploadId", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-deleted-media",
            title: "Deleted Media Step",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-deleted",
                type: "video",
                order: 0,
                settings: { autoplay: false, loop: false, aspect: "16:9" },
                mediaReferences: {
                  en: {
                    uploadId: deletedUploadA._id.toString()
                  }
                }
              }
            ]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "media_asset")).toBe(true);
    });

    it("should reject journey referencing an uploadId belonging to a different tenant (Org B)", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-foreign-media",
            title: "Cross Tenant Media Step",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-foreign",
                type: "image",
                order: 0,
                settings: { zoomable: false },
                mediaReferences: {
                  en: {
                    uploadId: foreignUploadB._id.toString()
                  }
                }
              }
            ]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "media_asset")).toBe(true);
    });

    it("should accept journey with valid active upload or valid embedUrl", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-valid-media",
            title: "Valid Media Step",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-valid-upload",
                type: "image",
                order: 0,
                settings: { zoomable: false },
                mediaReferences: {
                  en: {
                    uploadId: activeUploadA._id.toString()
                  }
                }
              },
              {
                id: "b-valid-embed",
                type: "video",
                order: 1,
                settings: { autoplay: false, loop: false, aspect: "16:9" },
                mediaReferences: {
                  en: {
                    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
                  }
                }
              }
            ]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.errors.filter(e => e.rule === "media_asset")).toHaveLength(0);
      expect(report.isValid).toBe(true);
    });
  });

  describe("Rule 3: Declared Language Translation Completeness", () => {
    it("should reject journey with declared language missing translation text", async () => {
      const journey = createBaseJourneyData({
        languages: ["en", "es"],
        steps: [
          {
            id: "step-1",
            title: "Bilingual Step",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-1",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: {
                    textValue: "English instruction here"
                  }
                  // 'es' is intentionally missing!
                }
              }
            ]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-term",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: { textValue: "Session done" },
                  es: { textValue: "Sesión completada" }
                }
              }
            ]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "language_translation" && e.language === "es")).toBe(true);
      const esError = report.errors.find(e => e.rule === "language_translation" && e.language === "es");
      expect(esError?.stepId).toBe("step-1");
      expect(esError?.blockId).toBe("b-1");
    });

    it("should reject journey with declared language containing empty or whitespace-only translation", async () => {
      const journey = createBaseJourneyData({
        languages: ["en", "fr"],
        steps: [
          {
            id: "step-1",
            title: "Instruction",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-1",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: { textValue: "English instruction" },
                  fr: { textValue: "   " } // whitespace only
                }
              }
            ]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-term",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: { textValue: "Done" },
                  fr: { textValue: "Terminé" }
                }
              }
            ]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "language_translation" && e.language === "fr")).toBe(true);
    });

    it("should accept journey when all declared languages have non-empty translations", async () => {
      const journey = createBaseJourneyData({
        languages: ["en", "de"],
        steps: [
          {
            id: "step-1",
            title: "Step 1",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-1",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: { textValue: "Safety briefing" },
                  de: { textValue: "Sicherheitsunterweisung" }
                }
              }
            ]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-term",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: { textValue: "Done" },
                  de: { textValue: "Fertig" }
                }
              }
            ]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.errors.filter(e => e.rule === "language_translation")).toHaveLength(0);
      expect(report.isValid).toBe(true);
    });
  });

  describe("Rule 4: Quiz Question Answer Correctness & Passing Score Bounds", () => {
    it("should reject quiz with passing score lower than 50%", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-quiz",
            title: "Safety Quiz",
            type: "quiz_step",
            order: 0,
            interaction: {
              type: "quiz",
              quiz: {
                passingScore: 45, // invalid: < 50
                questions: [
                  {
                    id: "q1",
                    question: "What is the emergency number?",
                    options: ["911", "000"],
                    correctOptionIndex: 0
                  }
                ]
              }
            },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Quiz" } } }]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "quiz_correctness")).toBe(true);
      expect(report.errors.find(e => e.rule === "quiz_correctness")?.message).toContain("between 50% and 100%");
    });

    it("should reject quiz with passing score greater than 100%", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-quiz",
            title: "Safety Quiz",
            type: "quiz_step",
            order: 0,
            interaction: {
              type: "quiz",
              quiz: {
                passingScore: 105, // invalid: > 100
                questions: [
                  {
                    id: "q1",
                    question: "What color is hazard tape?",
                    options: ["Yellow/Black", "Pink"],
                    correctOptionIndex: 0
                  }
                ]
              }
            },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Quiz" } } }]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "quiz_correctness")).toBe(true);
    });

    it("should reject quiz with 0 questions", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-quiz",
            title: "Safety Quiz",
            type: "quiz_step",
            order: 0,
            interaction: {
              type: "quiz",
              quiz: {
                passingScore: 80,
                questions: []
              }
            },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Quiz" } } }]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "quiz_correctness")).toBe(true);
      expect(report.errors.find(e => e.rule === "quiz_correctness")?.message).toContain("at least 1 question");
    });

    it("should reject quiz with invalid question options or out-of-bounds correctOptionIndex", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-quiz",
            title: "Safety Quiz",
            type: "quiz_step",
            order: 0,
            interaction: {
              type: "quiz",
              quiz: {
                passingScore: 80,
                questions: [
                  {
                    id: "q1",
                    question: "Question with only 1 option",
                    options: ["Only Option"],
                    correctOptionIndex: 0
                  },
                  {
                    id: "q2",
                    question: "Question with out-of-bounds correctOptionIndex",
                    options: ["Option A", "Option B"],
                    correctOptionIndex: 5 // out of bounds
                  }
                ]
              }
            },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Quiz" } } }]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      const quizErrors = report.errors.filter(e => e.rule === "quiz_correctness");
      expect(quizErrors.length).toBeGreaterThanOrEqual(2);
      expect(quizErrors.some(e => e.message.includes("at least 2 options"))).toBe(true);
      expect(quizErrors.some(e => e.message.includes("out of bounds"))).toBe(true);
    });

    it("should accept valid quiz meeting all correctness requirements", async () => {
      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-quiz",
            title: "Safety Quiz",
            type: "quiz_step",
            order: 0,
            interaction: {
              type: "quiz",
              quiz: {
                passingScore: 80,
                questions: [
                  {
                    id: "q1",
                    question: "What is required before entering Zone A?",
                    options: ["Helmet and boots", "None", "Visitor badge only"],
                    correctOptionIndex: 0
                  }
                ]
              }
            },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Quiz" } } }]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.errors.filter(e => e.rule === "quiz_correctness")).toHaveLength(0);
      expect(report.isValid).toBe(true);
    });
  });

  describe("Rule 5: Supervisor Role Availability", () => {
    it("should reject journey requiring supervisor witness when organization has no active supervisor users", async () => {
      // Ensure no supervisor or manager user exists in orgAId
      await User.deleteMany({
        organizationId: orgAId,
        $or: [
          { "permissions.role": { $in: ["supervisor", "manager"] } },
          { "permissions.roles": "supervisor" },
          { "permissions.customRoles": "supervisor" }
        ]
      });

      const journey = createBaseJourneyData({
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none" },
          requireSupervisorWitness: true,
          enableOfflineCaching: true
        }
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "supervisor_availability")).toBe(true);
      expect(report.errors.find(e => e.rule === "supervisor_availability")?.message).toContain("no active supervisor");
    });

    it("should reject step requiring supervisor witness when organization has no supervisor", async () => {
      await User.deleteMany({
        organizationId: orgAId,
        $or: [
          { "permissions.role": { $in: ["supervisor", "manager"] } },
          { "permissions.roles": "supervisor" },
          { "permissions.customRoles": "supervisor" }
        ]
      });

      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-witness",
            title: "Witnessed Step",
            type: "signature_step",
            requireSupervisorWitness: true,
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-1", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Sign here" } } }]
          },
          {
            id: "step-term",
            title: "Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(false);
      expect(report.errors.some(e => e.rule === "supervisor_availability")).toBe(true);
    });

    it("should accept journey requiring supervisor witness once an active supervisor exists", async () => {
      // Create supervisor user with valid role: "supervisor"
      supervisorUser = await User.create({
        organizationId: orgAId,
        auth: { email: "kiosk-val-sup-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
        profile: { firstName: "Supervisor", lastName: "ValA" },
        permissions: { role: "supervisor" },
        employment: { status: "active" },
        isDeleted: false
      });

      const journey = createBaseJourneyData({
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none" },
          requireSupervisorWitness: true,
          enableOfflineCaching: true
        }
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.errors.filter(e => e.rule === "supervisor_availability")).toHaveLength(0);
      expect(report.isValid).toBe(true);
    });

    it("should accept journey requiring supervisor witness when a user has a configured supervisor witness PIN", async () => {
      // Delete any dedicated supervisor/manager roles
      await User.deleteMany({
        organizationId: orgAId,
        $or: [
          { "permissions.role": { $in: ["supervisor", "manager"] } },
          { "permissions.roles": { $in: ["supervisor", "manager"] } },
          { "permissions.customRoles": { $in: ["supervisor", "manager"] } }
        ]
      });

      // Configure a supervisor PIN on an admin user in the organization
      await User.findByIdAndUpdate(adminAUser._id, {
        $set: {
          "security.supervisorPinHash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        }
      });

      const journey = createBaseJourneyData({
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none" },
          requireSupervisorWitness: true,
          enableOfflineCaching: true
        }
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.errors.filter(e => e.rule === "supervisor_availability")).toHaveLength(0);
      expect(report.warnings.filter(e => e.rule === "supervisor_availability")).toHaveLength(0);
      expect(report.isValid).toBe(true);

      // Clean up PIN hash on admin
      await User.findByIdAndUpdate(adminAUser._id, {
        $unset: { "security.supervisorPinHash": 1 }
      });
    });

    it("should issue a warning when supervisors exist but none have configured a 4-digit PIN", async () => {
      // Create supervisor without PIN hash
      await User.create({
        organizationId: orgAId,
        auth: { email: "kiosk-val-sup-nopin@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
        profile: { firstName: "SupervisorNoPin", lastName: "ValA" },
        permissions: { role: "supervisor" },
        employment: { status: "active" },
        security: {},
        isDeleted: false
      });

      const journey = createBaseJourneyData({
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none" },
          requireSupervisorWitness: true,
          enableOfflineCaching: true
        }
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.isValid).toBe(true);
      expect(report.errors.filter(e => e.rule === "supervisor_availability")).toHaveLength(0);
      expect(report.warnings.some(w => w.rule === "supervisor_availability" && w.message.includes("no 4-digit supervisor witness PIN has been configured"))).toBe(true);

      await User.deleteMany({ "auth.email": "kiosk-val-sup-nopin@test.com" });

      // Re-seed supervisorUser for subsequent publishing tests
      supervisorUser = await User.create({
        organizationId: orgAId,
        auth: { email: "kiosk-val-sup-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
        profile: { firstName: "Supervisor", lastName: "ValA" },
        permissions: { role: "supervisor" },
        employment: { status: "active" },
        isDeleted: false
      });
    });

    it("should accept journey with a step of type supervisor_gate when a supervisor exists with configured PIN", async () => {
      // Configure supervisor PIN on supervisorUser
      await User.findByIdAndUpdate(supervisorUser._id, {
        $set: {
          "security.supervisorPinHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        }
      });

      const journey = createBaseJourneyData({
        steps: [
          {
            id: "step-gate",
            title: "Supervisor Witness Sign-Off",
            type: "supervisor_gate",
            requireSupervisorWitness: true,
            order: 0,
            interaction: { type: "supervisor_witness", requireSupervisorWitness: true },
            blocks: [{ id: "b-gate", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Supervisor Witness Sign-Off" } } }]
          },
          {
            id: "step-term",
            title: "Terminal Done",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [{ id: "b-term", type: "text", order: 0, settings: { size: "medium" }, mediaReferences: { en: { textValue: "Terminal Done" } } }]
          }
        ]
      });

      const report = await validateJourneyForPublish(journey as any, orgAId);
      expect(report.errors.filter(e => e.rule === "supervisor_availability")).toHaveLength(0);
      expect(report.isValid).toBe(true);

      // Clean up PIN hash
      await User.findByIdAndUpdate(supervisorUser._id, {
        $unset: { "security.supervisorPinHash": 1 }
      });
    });
  });

  describe("API Publishing Handler Enforcement (POST /api/v1/kiosk/journeys/:id/publish)", () => {
    it("should reject publication with 400 VALIDATION_FAILED when journey has pre-publish defects", async () => {
      // Create a draft journey in DB with defects (missing translation & no completion step)
      const invalidJourney = await KioskJourneyModel.create({
        organizationId: orgAId,
        createdBy: adminAUser._id,
        title: "Defective Journey Direct API Test",
        description: "Should fail pre-publish validator",
        version: 1,
        status: "draft",
        defaultLanguage: "en",
        languages: ["en", "es"],
        estimatedDurationMinutes: 5,
        steps: [
          {
            id: "step-1",
            title: "Step 1",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-1",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: { textValue: "Only English text provided" }
                  // 'es' missing
                }
              }
            ]
          }
          // completion step missing!
        ],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none" },
          requireSupervisorWitness: false,
          enableOfflineCaching: true
        },
        publishing: {
          version: 1,
          status: "draft"
        },
        isDeleted: false
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${invalidJourney._id}/publish`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.code || body.error).toBe("VALIDATION_FAILED");
      const errorList = body.errors || body.details?.errors || [];
      expect(errorList.length).toBeGreaterThanOrEqual(2);
      expect(errorList.some((e: any) => e.rule === "terminal_completion")).toBe(true);
      expect(errorList.some((e: any) => e.rule === "language_translation")).toBe(true);

      // Verify that status remained 'draft' and no version snapshot was published
      const journeyInDb = await KioskJourneyModel.findById(invalidJourney._id);
      expect(journeyInDb?.publishing?.status).toBe("draft");
      const versionsCount = await KioskJourneyVersionModel.countDocuments({ journeyId: invalidJourney._id });
      expect(versionsCount).toBe(0);
    });

    it("should allow publication with 200 OK when journey passes all pre-publish validation rules", async () => {
      const validJourney = await KioskJourneyModel.create(createBaseJourneyData({
        title: "Clean Production Safety Journey",
        languages: ["en"],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none" },
          requireSupervisorWitness: true, // supervisor exists now!
          enableOfflineCaching: true
        }
      }));

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${validJourney._id}/publish`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.publishing.status).toBe("published");

      // Verify immutable version snapshot exists in DB
      const versionDoc = await KioskJourneyVersionModel.findOne({ journeyId: validJourney._id, version: 1 });
      expect(versionDoc).not.toBeNull();
      expect(versionDoc?.steps).toHaveLength(2);
    });
  });

  describe("Pre-Publish Linter Inspection API (POST /api/v1/kiosk/journeys/:id/validate)", () => {
    it("should return detailed ValidationReport without mutating or publishing the journey", async () => {
      const journeyToAudit = await KioskJourneyModel.create(createBaseJourneyData({
        title: "Linter Dry Run Audit Journey",
        languages: ["en", "fr"], // French missing on step-1
        steps: [
          {
            id: "step-1",
            title: "Content Step",
            type: "instruction_step",
            order: 0,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-1",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: { textValue: "Audit text" }
                  // 'fr' missing
                }
              }
            ]
          },
          {
            id: "step-term",
            title: "Completion",
            type: "completion",
            order: 1,
            interaction: { type: "tap_to_continue" },
            blocks: [
              {
                id: "b-term",
                type: "text",
                order: 0,
                settings: { size: "medium" },
                mediaReferences: {
                  en: { textValue: "Done" },
                  fr: { textValue: "Terminé" }
                }
              }
            ]
          }
        ]
      }));

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journeyToAudit._id}/validate`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toBeDefined();
      expect(body.data.isValid).toBe(false);
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.errors[0].rule).toBe("language_translation");
      expect(body.data.errors[0].language).toBe("fr");
      expect(body.data.errors[0].blockId).toBe("b-1");

      // Verify journey is still in draft mode
      const dbCheck = await KioskJourneyModel.findById(journeyToAudit._id);
      expect(dbCheck?.publishing?.status).toBe("draft");
    });
  });
});
