import mongoose from "mongoose";
import dotenv from "dotenv";
import { createSigner } from "fast-jwt";

dotenv.config();

async function runLiveSync() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/talnova-onboarding";
  await mongoose.connect(mongoUri);

  const orgId = "6a42e795916da0cac4bb1853";
  const deviceId = "TEST-KIOSK-001";

  // Ensure journey has journeyCode "kiosk-jrn-01"
  let journey = await mongoose.connection.collection("kioskjourneys").findOne({
    organizationId: new mongoose.Types.ObjectId(orgId),
  });

  // Ensure device exists
  let device = await mongoose.connection.collection("kioskdevices").findOne({ deviceId });
  if (!device) {
    await mongoose.connection.collection("kioskdevices").insertOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      deviceId,
      hardwareGuid: deviceId,
      name: "Assembly Floor Terminal",
      location: "Building 3",
      status: "online",
      paired: true,
      lastSeen: new Date(),
      lastHeartbeatAt: new Date(),
      currentContentVersion: 1,
      telemetry: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✓ Re-seeded TEST-KIOSK-001 in MongoDB");
  }

  // Create valid device token
  const jwtSecret = process.env.JWT_SECRET || "talnova-jwt-secret-for-development-super-secure-key-2026";
  const signToken = createSigner({ key: jwtSecret });
  const deviceToken = signToken({
    deviceId,
    organizationId: orgId,
    role: "kiosk_device",
  });

  console.log("Device token generated:", deviceToken.substring(0, 30) + "...");

  // Step 1: Transmit heartbeat
  console.log("\n--- Dispatching Heartbeat (POST /api/v1/kiosk/devices/heartbeat) ---");
  const heartbeatResp = await fetch("http://localhost:8080/api/v1/kiosk/devices/heartbeat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deviceToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      batteryLevel: 88,
      appVersion: "1.4.2",
    }),
  });

  const heartbeatBody = await heartbeatResp.json();
  console.log("Heartbeat Status:", heartbeatResp.status);
  console.log("Heartbeat Body:", JSON.stringify(heartbeatBody, null, 2));

  // Step 2: Upload buffered analytics events
  console.log("\n--- Dispatching Analytics Sync (POST /api/v1/kiosk/analytics/sync) ---");
  const syncResp = await fetch("http://localhost:8080/api/v1/kiosk/analytics/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deviceToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      events: [
        {
          journeyId: "kiosk-jrn-01",
          stepId: "step-01",
          eventType: "STEP_VIEWED",
          durationSeconds: 30,
        },
        {
          journeyId: "kiosk-jrn-01",
          stepId: "step-01",
          eventType: "PPE_COMPLETED",
        },
      ],
    }),
  });

  const syncBody = await syncResp.json();
  console.log("Sync Status:", syncResp.status);
  console.log("Sync Body:", JSON.stringify(syncBody, null, 2));

  // Step 3: Verify MongoDB Records
  console.log("\n--- Verifying MongoDB Records ---");
  const storedDevice = await mongoose.connection.collection("kioskdevices").findOne({ deviceId });
  console.log("Updated KioskDevice lastHeartbeatAt:", storedDevice?.lastHeartbeatAt);
  console.log("Updated KioskDevice telemetry:", storedDevice?.telemetry);

  const analyticsCount = await mongoose.connection.collection("kioskanalytics").countDocuments({
    eventType: { $in: ["STEP_VIEWED", "PPE_COMPLETED"] },
  });
  console.log("Persisted KioskAnalytics events count:", analyticsCount);

  await mongoose.disconnect();
}

runLiveSync().catch(console.error);
