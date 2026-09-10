import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { User } from '../modules/auth/models/user.model.js';
import { KioskJourneyModel } from '../modules/kiosk/models/kiosk-journey.model.js';
import { KioskAnalyticsModel } from '../modules/kiosk/models/kiosk-analytics.model.js';
import { KioskSecurityService } from '../modules/kiosk/services/kiosk-security.service.js';
import config from '../config/index.js';

dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJKSK003Tests() {
  console.log('========================================================================');
  console.log('=== RUNNING JOURNEY TEST UJ-KSK-003: SOP Playback & Touch PPE Confirmation ===');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const securityService = new KioskSecurityService();
  const secret = config.jwt.secret;

  // Step 0: Ensure Organization and Published Kiosk Journey with step-sop-01
  console.log('Step 0: Initializing test tenant and published Kiosk Journey with step-sop-01...');
  
  let org = await Organization.findOne({ isDeleted: false });
  if (!org) {
    org = new Organization({
      name: 'Talnova Kiosk Corp',
      slug: 'org-01',
      supportEmail: 'kiosk@talnova.test',
      status: 'Active',
    });
    await org.save();
  }

  let adminUser = await User.findOne({ organizationId: org._id, isDeleted: false });
  if (!adminUser) {
    adminUser = new User({
      organizationId: org._id,
      auth: { email: 'kiosk_admin@talnova.test', passwordHash: 'hash123', emailVerified: true },
      profile: { firstName: 'Kiosk', lastName: 'Admin', fullName: 'Kiosk Admin' },
      employment: { status: 'active' },
      permissions: { role: 'admin' },
    });
    await adminUser.save();
  }

  // Clean up any existing journey with journeyCode 'kiosk-jrn-01'
  await KioskJourneyModel.deleteMany({
    $or: [{ journeyCode: 'kiosk-jrn-01' }, { _id: new mongoose.Types.ObjectId('6aa2ff010000000000000001') }],
  });

  const journeyId = '6aa2ff010000000000000001';

  const journeyData = {
    _id: new mongoose.Types.ObjectId(journeyId),
    organizationId: org._id,
    journeyCode: 'kiosk-jrn-01',
    title: 'Frontline Safety SOP & PPE Compliance',
    description: 'Frontline SOP instructional briefing with mandatory touch PPE verification.',
    languages: ['en'],
    steps: [
      {
        id: 'step-sop-01',
        type: 'video_step',
        title: 'Step 1: SOP Playback & Mandatory PPE Verification',
        order: 0,
        blocks: [
          {
            id: 'block-sop-video-01',
            type: 'video',
            order: 0,
            mediaReferences: {
              en: {
                embedUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                textValue: 'Review mandatory shift safety procedures and confirm PPE readiness.',
              },
            },
            settings: { autoplay: true, loop: false },
          },
          {
            id: 'block-sop-text-01',
            type: 'text',
            order: 1,
            mediaReferences: {
              en: {
                textValue: 'Frontline operators must watch this safety briefing and confirm all mandatory PPE gear.',
              },
            },
            settings: { size: 'large' },
          },
        ],
        interaction: {
          type: 'ppe_checklist',
          ppeItems: ['Hard Hat', 'Safety Glasses', 'Steel-Toe Boots'],
        },
      },
    ],
    publishing: {
      isPublished: true,
      version: 1,
      publishedAt: new Date(),
    },
    settings: {
      security: {
        protectionType: 'none',
      },
      idleTimeoutSeconds: 60,
      autoPlay: true,
    },
    createdBy: adminUser._id,
    isDeleted: false,
  };

  const journey = new KioskJourneyModel(journeyData);
  await journey.save();
  console.log(`✓ Kiosk Journey seeded: ID = ${journey._id}, Code = ${journey.journeyCode}`);
  console.log(`✓ Step configured: step-sop-01 with PPE items: Hard Hat, Safety Glasses, Steel-Toe Boots`);

  // Clean prior analytics
  await KioskAnalyticsModel.deleteMany({ journeyId: journey._id });

  // Generate cryptographic HMAC-SHA256 signature
  const expTimestamp = Math.floor(Date.now() / 1000) + 7 * 86400; // 7 days in future
  const orgSlug = org.slug || org._id.toString();
  const validSig = securityService.generateSignature(journeyId, orgSlug, expTimestamp, secret);

  const signedQuery = `o=${orgSlug}&exp=${expTimestamp}&sig=${validSig}`;
  const signedUrl = `/kiosk/play/${journeyId}?${signedQuery}`;
  console.log(`✓ Generated HMAC-SHA256 Signed URL: ${signedUrl}\n`);

  // TEST 1: Negative Authorization Test — Attempt syncing without signed context or device token
  console.log('--- TEST 1: Negative Authorization Test (Sync without Auth) ---');
  const unauthResp = await fetch(`${API_BASE}/kiosk/analytics/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessions: [
        {
          journeyId,
          journeyVersion: 1,
          languageUsed: 'en',
          eventType: 'PPE_COMPLIANCE_CONFIRMED',
          stepId: 'step-sop-01',
          metrics: { launchesCount: 1, completedCount: 1, durationSeconds: 12 },
          interactions: [
            { stepId: 'step-sop-01', elementClicked: 'ppe_confirm', timestamp: new Date().toISOString() },
          ],
          dateKey: new Date().toISOString().substring(0, 10),
        },
      ],
    }),
  });

  console.log(`Unauthenticated sync status: ${unauthResp.status}`);
  if (unauthResp.status === 401) {
    console.log('✓ PASS: Telemetry sync rejected with 401 UNAUTHORIZED when signature context is omitted.');
  } else {
    console.error(`✗ FAIL: Expected 401, got ${unauthResp.status}`);
    process.exit(1);
  }

  // TEST 2: Negative Validation Test — Tampered HMAC Signature
  console.log('\n--- TEST 2: Negative Security Test (Tampered HMAC Signature) ---');
  const tamperedSig = validSig.substring(0, validSig.length - 4) + 'abcd';
  const tamperedResp = await fetch(`${API_BASE}/kiosk/analytics/sync?o=${orgSlug}&exp=${expTimestamp}&sig=${tamperedSig}&journeyId=${journeyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessions: [
        {
          journeyId,
          journeyVersion: 1,
          languageUsed: 'en',
          eventType: 'PPE_COMPLIANCE_CONFIRMED',
          stepId: 'step-sop-01',
          metrics: { launchesCount: 1, completedCount: 1, durationSeconds: 12 },
          interactions: [
            { stepId: 'step-sop-01', elementClicked: 'ppe_confirm', timestamp: new Date().toISOString() },
          ],
          dateKey: new Date().toISOString().substring(0, 10),
        },
      ],
    }),
  });

  console.log(`Tampered signature sync status: ${tamperedResp.status}`);
  if (tamperedResp.status === 403) {
    console.log('✓ PASS: Telemetry sync rejected with 403 INVALID_SIGNATURE on tampered signature.');
  } else {
    console.error(`✗ FAIL: Expected 403, got ${tamperedResp.status}`);
    process.exit(1);
  }

  // TEST 3: Happy Path — Submit Verified PPE Compliance Telemetry via Signed URL Context
  console.log('\n--- TEST 3: Happy Path Telemetry Dispatch (/api/v1/kiosk/analytics/sync) ---');
  const syncPayload = {
    sessions: [
      {
        journeyId,
        journeyVersion: 1,
        languageUsed: 'en',
        eventType: 'PPE_COMPLIANCE_CONFIRMED',
        stepId: 'step-sop-01',
        metrics: {
          launchesCount: 1,
          completedCount: 1,
          durationSeconds: 15,
        },
        interactions: [
          {
            stepId: 'step-sop-01',
            elementClicked: 'ppe_check_hard_hat',
            eventType: 'PPE_ITEM_CHECKED',
            timestamp: new Date(Date.now() - 10000).toISOString(),
          },
          {
            stepId: 'step-sop-01',
            elementClicked: 'ppe_check_safety_glasses',
            eventType: 'PPE_ITEM_CHECKED',
            timestamp: new Date(Date.now() - 7000).toISOString(),
          },
          {
            stepId: 'step-sop-01',
            elementClicked: 'ppe_check_steel_toe_boots',
            eventType: 'PPE_ITEM_CHECKED',
            timestamp: new Date(Date.now() - 4000).toISOString(),
          },
          {
            stepId: 'step-sop-01',
            elementClicked: 'ppe_confirm',
            eventType: 'PPE_COMPLIANCE_CONFIRMED',
            timestamp: new Date().toISOString(),
          },
        ],
        dateKey: new Date().toISOString().substring(0, 10),
      },
    ],
  };

  const syncResp = await fetch(`${API_BASE}/kiosk/analytics/sync?o=${orgSlug}&exp=${expTimestamp}&sig=${validSig}&journeyId=${journeyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syncPayload),
  });

  const syncBody = await syncResp.json();
  console.log(`Sync HTTP status: ${syncResp.status}`);
  console.log('Sync response:', JSON.stringify(syncBody, null, 2));

  if (syncResp.status === 200 && syncBody.success) {
    console.log('✓ PASS: Telemetry payload accepted and synchronized successfully.');
  } else {
    console.error('✗ FAIL: Telemetry sync rejected:', syncBody);
    process.exit(1);
  }

  // TEST 4: Data Integrity Verification in MongoDB KioskAnalytics
  console.log('\n--- TEST 4: Data Integrity Verification (MongoDB KioskAnalytics) ---');
  const storedEvent = await KioskAnalyticsModel.findOne({
    journeyId: new mongoose.Types.ObjectId(journeyId),
    eventType: 'PPE_COMPLIANCE_CONFIRMED',
  });

  if (!storedEvent) {
    console.error('✗ FAIL: Expected KioskAnalytics record with eventType: "PPE_COMPLIANCE_CONFIRMED" not found.');
    process.exit(1);
  }

  console.log('✓ Found persisted KioskAnalytics document in MongoDB:');
  console.log(`  _id: ${storedEvent._id}`);
  console.log(`  organizationId: ${storedEvent.organizationId}`);
  console.log(`  journeyId: ${storedEvent.journeyId}`);
  console.log(`  stepId: ${storedEvent.stepId}`);
  console.log(`  eventType: ${storedEvent.eventType}`);
  console.log(`  interactions count: ${storedEvent.interactions.length}`);
  console.log(`  interactions:`, JSON.stringify(storedEvent.interactions, null, 2));

  if (storedEvent.stepId === 'step-sop-01' && storedEvent.eventType === 'PPE_COMPLIANCE_CONFIRMED') {
    console.log('✓ PASS: MongoDB KioskAnalytics stores event with stepId: "step-sop-01", eventType: "PPE_COMPLIANCE_CONFIRMED", and timestamp.');
  } else {
    console.error('✗ FAIL: Invariant failed on stored document properties.');
    process.exit(1);
  }

  console.log('\n========================================================================');
  console.log('=== ALL BACKEND & TELEMETRY INTEGRITY CHECKS PASSED FOR UJ-KSK-003 ===');
  console.log(`=== PLAYBACK BROWSER URL: http://localhost:5173${signedUrl} ===`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runUJKSK003Tests().catch((err) => {
  console.error('FATAL ERROR in test_uj_ksk_003:', err);
  process.exit(1);
});
