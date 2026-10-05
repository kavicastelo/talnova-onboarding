import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";
import { buildApp } from "../app.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskJourneyModel,
  KioskDeviceModel
} from "../modules/kiosk/index.js";

dotenv.config();

async function run() {
  const app = await buildApp();
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding");
  console.log("Connected to MongoDB.");

  // Find an active organization or create one
  let org = await Organization.findOne({ status: "Active", isDeleted: false });
  if (!org) {
    org = await Organization.create({
      name: "Talnova Industrial Logistics",
      slug: "talnova-industrial",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
  }
  const orgId = org._id;
  console.log("Using Organization:", org.name, orgId.toString());

  // Find or create frontline worker
  let worker = await User.findOne({
    organizationId: orgId,
    "employment.employeeId": "EMP-1001",
    isDeleted: false
  });

  if (!worker) {
    worker = await User.create({
      organizationId: orgId,
      auth: {
        email: "alex.taylor@talnova.com",
        passwordHash: "dummy-hash-12345",
        failedLoginAttempts: 0
      },
      profile: {
        firstName: "Alex",
        lastName: "Taylor",
        displayName: "Alex Taylor"
      },
      permissions: {
        role: "employee"
      },
      employment: {
        employeeId: "EMP-1001",
        badgeId: "BDG-2002",
        nationalId: "NAT-998877",
        department: "Assembly & Robotics",
        jobTitle: "Production Specialist",
        status: "active"
      },
      isDeleted: false
    });
    console.log("Created frontline worker Alex Taylor (EMP-1001 / BDG-2002 / alex.taylor@talnova.com)");
  } else {
    console.log("Found frontline worker:", worker.profile?.displayName, worker.employment?.employeeId);
  }

  // Find or create published journey
  let journey = await KioskJourneyModel.findOne({
    organizationId: orgId,
    journeyCode: "SAFE-BRIEF-01",
    isDeleted: false
  });

  if (!journey) {
    journey = await KioskJourneyModel.create({
      organizationId: orgId,
      journeyCode: "SAFE-BRIEF-01",
      title: "Assembly Line Safety & Cleanroom Protocols",
      description: "Mandatory daily industrial safety and cleanroom PPE compliance briefing.",
      category: "safety",
      status: "published",
      version: 1,
      priority: "high",
      targetRoles: ["employee", "all"],
      publishing: {
        status: "published",
        publishedAt: new Date()
      },
      settings: {
        security: {
          requirePin: false
        },
        timeoutSeconds: 180,
        allowedLanguages: ["en"],
        defaultLanguage: "en"
      },
      steps: [
        {
          id: "step-1",
          type: "standard_step",
          title: "PPE Verification",
          order: 0,
          blocks: [
            {
              id: "block-1",
              type: "text",
              order: 0,
              mediaReferences: {
                en: {
                  textValue: "Ensure steel-toe boots, anti-static gloves, and high-visibility vests are fastened before crossing the yellow threshold."
                }
              }
            }
          ],
          interaction: {
            type: "tap_to_continue"
          }
        },
        {
          id: "step-2",
          type: "standard_step",
          title: "Emergency Stop Controls",
          order: 1,
          blocks: [
            {
              id: "block-2",
              type: "text",
              order: 0,
              mediaReferences: {
                en: {
                  textValue: "Emergency E-Stop buttons are located every 15 meters along the conveyor. In case of anomaly, press immediately."
                }
              }
            }
          ],
          interaction: {
            type: "tap_to_continue"
          }
        },
        {
          id: "step-3",
          type: "standard_step",
          title: "Sign-off Confirmation",
          order: 2,
          blocks: [
            {
              id: "block-3",
              type: "text",
              order: 0,
              mediaReferences: {
                en: {
                  textValue: "You have completed the daily safety protocols review. Tap complete below to log your compliance record."
                }
              }
            }
          ],
          interaction: {
            type: "tap_to_continue"
          }
        }
      ],
      slides: [
        {
          id: "slide-1",
          type: "text",
          title: "PPE Verification",
          content: "Ensure steel-toe boots, anti-static gloves, and high-visibility vests are fastened before crossing the yellow threshold.",
          order: 1,
          duration: 30
        },
        {
          id: "slide-2",
          type: "text",
          title: "Emergency Stop Controls",
          content: "Emergency E-Stop buttons are located every 15 meters along the conveyor. In case of anomaly, press immediately.",
          order: 2,
          duration: 30
        },
        {
          id: "slide-3",
          type: "text",
          title: "Sign-off Confirmation",
          content: "You have completed the daily safety protocols review. Tap complete below to log your compliance record.",
          order: 3,
          duration: 20
        }
      ],
      complianceRequirements: {
        requireSupervisorVerification: false,
        requireIdentityVerification: true
      },
      createdBy: worker._id,
      publishedAt: new Date()
    });
    console.log("Created published journey:", journey.title, journey._id.toString());
  } else {
    // Ensure it is published and has steps
    journey.status = "published";
    journey.publishing = { status: "published", publishedAt: new Date() };
    (journey as any).steps = [
      {
        id: "step-1",
        type: "standard_step",
        title: "PPE Verification",
        order: 0,
        blocks: [
          {
            id: "block-1",
            type: "text",
            order: 0,
            mediaReferences: {
              en: {
                textValue: "Ensure steel-toe boots, anti-static gloves, and high-visibility vests are fastened before crossing the yellow threshold."
              }
            }
          }
        ],
        interaction: {
          type: "tap_to_continue"
        }
      },
      {
        id: "step-2",
        type: "standard_step",
        title: "Emergency Stop Controls",
        order: 1,
        blocks: [
          {
            id: "block-2",
            type: "text",
            order: 0,
            mediaReferences: {
              en: {
                textValue: "Emergency E-Stop buttons are located every 15 meters along the conveyor. In case of anomaly, press immediately."
              }
            }
          }
        ],
        interaction: {
          type: "tap_to_continue"
        }
      },
      {
        id: "step-3",
        type: "standard_step",
        title: "Sign-off Confirmation",
        order: 2,
        blocks: [
          {
            id: "block-3",
            type: "text",
            order: 0,
            mediaReferences: {
              en: {
                textValue: "You have completed the daily safety protocols review. Tap complete below to log your compliance record."
              }
            }
          }
        ],
        interaction: {
          type: "tap_to_continue"
        }
      }
    ];
    await journey.save();
    console.log("Updated journey with steps:", journey.title, journey._id.toString());
  }

  // Register or pair device
  const deviceId = "KIOSK-DEV-001";
  const deviceGuid = "7202f8e8-e6e7-4367-be3c-e8fae042beb9";

  const deviceToken = app.jwt.sign({
    deviceId,
    organizationId: orgId.toString(),
    role: "kiosk_device"
  });

  const tokenRef = crypto.createHash("sha256").update(deviceToken).digest("hex");

  let device = await KioskDeviceModel.findOne({ deviceId, organizationId: orgId });
  if (!device) {
    device = await KioskDeviceModel.create({
      organizationId: orgId,
      deviceId,
      name: "Kiosk Tablet TERM",
      location: "Reception Lobby",
      deviceGroup: "Assembly Line North",
      guid: deviceGuid,
      status: "online",
      paired: true,
      tokenRef,
      lastHeartbeat: new Date(),
      networkInfo: {
        ipAddress: "192.168.1.50"
      },
      hardwareInfo: {
        platform: "Browser/Electron",
        displayResolution: "1920x1080",
        appVersion: "1.0.0"
      }
    });
    console.log("Created paired device:", device.deviceId, device.guid);
  } else {
    device.tokenRef = tokenRef;
    device.status = "online";
    device.paired = true;
    device.guid = deviceGuid;
    await device.save();
    console.log("Updated device credentials:", device.deviceId);
  }

  console.log("\n================ KIOSK SEED SUMMARY ================");
  console.log("Org ID:", orgId.toString());
  console.log("Device ID:", deviceId);
  console.log("Device GUID:", deviceGuid);
  console.log("Device Token:", deviceToken);
  console.log("Journey ID:", journey._id.toString());
  console.log("Worker:", {
    name: "Alex Taylor",
    email: "alex.taylor@talnova.com",
    employeeId: "EMP-1001",
    badgeId: "BDG-2002"
  });
  console.log("====================================================\n");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
