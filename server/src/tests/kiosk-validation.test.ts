import { describe, it, expect } from "vitest";
import {
  KioskJourneySchema,
  KioskDeviceRegistrationSchema,
  KioskAnalyticsBulkSyncSchema,
  SignedUrlQuerySchema,
  validateSafe
} from "../modules/kiosk/validation/index.js";

describe("Kiosk Onboarding Validation Layer Tests", () => {
  const validOrganizationId = "6573c09b2e98ba1234567890";
  const validJourneyId = "6573c09b2e98ba1234567891";
  const validUserId = "6573c09b2e98ba1234567892";

  const getValidStep = (id: string, order: number) => ({
    id,
    type: "instruction_step" as const,
    title: `Step Title ${id}`,
    order,
    blocks: [
      {
        id: `block_${id}_1`,
        type: "text" as const,
        order: 0,
        mediaReferences: {
          en: {
            textValue: "Hello world"
          }
        },
        settings: {
          size: "medium" as const
        }
      }
    ],
    interaction: {
      type: "tap_to_continue" as const
    }
  });

  const getValidJourney = () => ({
    _id: validJourneyId,
    organizationId: validOrganizationId,
    title: "On-site Factory Safety Journey",
    description: "Emergency exits and standard operating procedures briefing.",
    languages: ["en", "pt"],
    steps: [getValidStep("step_1", 0), getValidStep("step_2", 1)],
    settings: {
      autoPlay: false,
      loopForever: false,
      idleTimeoutSeconds: 60,
      autoReturnHome: true,
      hideNavigation: false,
      disableExit: true,
      security: {
        protectionType: "none" as const
      }
    },
    publishing: {
      status: "draft" as const,
      version: 1,
      publishedAt: null
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: validUserId,
    isDeleted: false
  });

  describe("Journey Schema Validations", () => {
    it("should pass a valid draft journey payload successfully", () => {
      const result = validateSafe(KioskJourneySchema, getValidJourney());
      expect(result.success).toBe(true);
    });

    it("should fail validation if organizationId is not a valid ObjectId", () => {
      const journey = getValidJourney();
      journey.organizationId = "invalid-id";
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid ObjectId format");
      }
    });

    it("should fail validation if language codes are duplicated", () => {
      const journey = getValidJourney();
      journey.languages = ["en", "en"];
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Duplicate language code");
      }
    });

    it("should fail validation if step order indices are duplicated", () => {
      const journey = getValidJourney();
      journey.steps[0].order = 0;
      journey.steps[1].order = 0; // Duplicate order
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Duplicate step order index");
      }
    });

    it("should fail validation if step IDs are duplicated", () => {
      const journey = getValidJourney();
      journey.steps[0].id = "step_dup";
      journey.steps[1].id = "step_dup"; // Duplicate ID
      // Reset order to avoid order conflicts
      journey.steps[0].order = 0;
      journey.steps[1].order = 1;
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Duplicate step ID");
      }
    });

    it("should fail validation if a published journey has zero steps", () => {
      const journey = getValidJourney();
      journey.publishing.status = "published" as const;
      journey.steps = [];
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Published journeys must contain at least one step");
      }
    });
  });

  describe("Journey Security Settings Validation", () => {
    it("should fail if protectionType is 'pin' but pinCode is not defined", () => {
      const journey = getValidJourney();
      journey.settings.security = {
        protectionType: "pin" as const,
        pinCode: undefined
      } as any;
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("PIN code is required when protection type is PIN");
      }
    });

    it("should fail if protectionType is 'pin' but pinCode is non-numeric or too short", () => {
      const journey = getValidJourney();
      journey.settings.security = {
        protectionType: "pin" as const,
        pinCode: "abc" // Too short and non-numeric
      };
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("PIN code must contain digits only");
      }
    });

    it("should fail if protectionType is 'signed_url' but expiresAt is not provided", () => {
      const journey = getValidJourney();
      journey.settings.security = {
        protectionType: "signed_url" as const,
        expiresAt: null
      };
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Expiration timestamp is required when protection type is signed_url");
      }
    });
  });

  describe("Step Content & Routing Validation", () => {
    it("should fail if step interaction correctStepId points to a non-existent step", () => {
      const journey = getValidJourney();
      journey.steps[0].interaction = {
        type: "tap_to_continue" as const,
        correctStepId: "missing_destination_step"
      };
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Correct target step ID");
      }
    });

    it("should fail if a step block has duplicate orders", () => {
      const journey = getValidJourney();
      const firstStep = journey.steps[0];
      firstStep.blocks = [
        {
          id: "b1",
          type: "text" as const,
          order: 0,
          mediaReferences: {},
          settings: { size: "medium" as const }
        },
        {
          id: "b2",
          type: "image" as const,
          order: 0, // Duplicate order
          mediaReferences: {},
          settings: { zoomable: false }
        }
      ];
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Duplicate block order index");
      }
    });

    it("should fail if a step block has duplicate IDs", () => {
      const journey = getValidJourney();
      const firstStep = journey.steps[0];
      firstStep.blocks = [
        {
          id: "dup_block",
          type: "text" as const,
          order: 0,
          mediaReferences: {},
          settings: { size: "medium" as const }
        },
        {
          id: "dup_block", // Duplicate ID
          type: "image" as const,
          order: 1,
          mediaReferences: {},
          settings: { zoomable: false }
        }
      ];
      const result = validateSafe(KioskJourneySchema, journey);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Duplicate block ID");
      }
    });
  });

  describe("Device Registration & Verification Validation", () => {
    it("should validate a correct device registration payload", () => {
      const validDevice = {
        deviceId: "device-uuid-fingerprint-12345",
        name: "Main Reception Kiosk",
        location: "Building C lobby entrance",
        ipAddress: "192.168.1.100",
        macAddress: "00:1B:44:11:3A:B7"
      };
      const result = validateSafe(KioskDeviceRegistrationSchema, validDevice);
      expect(result.success).toBe(true);
    });

    it("should fail device registration validation on invalid IP or MAC format", () => {
      const invalidDevice = {
        deviceId: "device-uuid-fingerprint-12345",
        name: "Main Reception Kiosk",
        location: "Building C lobby entrance",
        ipAddress: "999.999.999.999", // Invalid IP
        macAddress: "invalid-mac-address"
      };
      const result = validateSafe(KioskDeviceRegistrationSchema, invalidDevice);
      expect(result.success).toBe(false);
    });
  });

  describe("Analytics Sync Validation", () => {
    it("should validate a correct analytics batch payload", () => {
      const payload = {
        sessions: [
          {
            deviceId: validUserId,
            journeyId: validJourneyId,
            journeyVersion: 1,
            languageUsed: "en",
            metrics: {
              launchesCount: 1,
              completedCount: 1,
              durationSeconds: 120
            },
            interactions: [
              {
                stepId: "step_1",
                elementClicked: "next",
                timestamp: new Date().toISOString()
              }
            ],
            dateKey: "2026-07-03"
          }
        ]
      };
      const result = validateSafe(KioskAnalyticsBulkSyncSchema, payload);
      expect(result.success).toBe(true);
    });

    it("should fail analytics batch if dateKey format is invalid", () => {
      const payload = {
        sessions: [
          {
            journeyId: validJourneyId,
            journeyVersion: 1,
            languageUsed: "en",
            metrics: {
              launchesCount: 1,
              completedCount: 0,
              durationSeconds: 45
            },
            interactions: [],
            dateKey: "03-07-2026" // Invalid format (expected YYYY-MM-DD)
          }
        ]
      };
      const result = validateSafe(KioskAnalyticsBulkSyncSchema, payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Date key must be formatted as YYYY-MM-DD");
      }
    });
  });

  describe("Signed URL Validation", () => {
    it("should validate correct query parameters", () => {
      const query = {
        o: validOrganizationId,
        exp: "1783094400",
        sig: "abcdef1234567890abcdef1234567890"
      };
      const result = validateSafe(SignedUrlQuerySchema, query);
      expect(result.success).toBe(true);
    });

    it("should fail if signed url parameters are missing or non-numeric", () => {
      const query = {
        o: validOrganizationId,
        exp: "not-a-timestamp",
        sig: ""
      };
      const result = validateSafe(SignedUrlQuerySchema, query);
      expect(result.success).toBe(false);
    });
  });
});
