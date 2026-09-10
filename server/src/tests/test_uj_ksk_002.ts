import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { User } from '../modules/auth/models/user.model.js';
import { KioskJourneyModel } from '../modules/kiosk/models/kiosk-journey.model.js';
import { KioskSecurityService } from '../modules/kiosk/services/kiosk-security.service.js';
import config from '../config/index.js';

dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJKSK002Tests() {
  console.log('========================================================================');
  console.log('=== RUNNING JOURNEY TEST UJ-KSK-002: Launch Touch Kiosk Journey Player ===');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const securityService = new KioskSecurityService();
  const secret = config.jwt.secret;

  // Step 0: Ensure Organization and Published Kiosk Journey
  console.log('Step 0: Initializing test tenant and published Kiosk Journey in MongoDB...');
  
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

  // Ensure an admin user exists for createdBy reference
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
    $or: [{ journeyCode: 'kiosk-jrn-01' }, { _id: '6aa2ff010000000000000001' }],
  });

  const journeyData = {
    organizationId: org._id,
    journeyCode: 'kiosk-jrn-01',
    title: 'Frontline Safety & Operational Protocol',
    description: 'Mandatory frontline worker safety briefing and gear verification.',
    languages: ['en'],
    steps: [
      {
        id: 'step-01',
        type: 'standard_step',
        title: 'Step 1: Safety Protocol Overview',
        order: 0,
        blocks: [
          {
            id: 'block-text-01',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: {
                textValue: 'Welcome to the frontline safety and operational protocol briefing. Ensure you have reviewed all safety equipment requirements before stepping onto the operations floor.',
              },
            },
            settings: { size: 'large' },
          },
          {
            id: 'block-icon-01',
            type: 'icon',
            order: 1,
            mediaReferences: { en: {} },
            settings: { theme: 'warning' },
          },
        ],
        interaction: {
          type: 'tap_to_continue',
        },
      },
      {
        id: 'step-02',
        type: 'standard_step',
        title: 'Step 2: Equipment Verification Video',
        order: 1,
        blocks: [
          {
            id: 'block-text-02',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: {
                textValue: 'Watch this demonstration on proper PPE gear inspection and emergency halt procedures.',
              },
            },
            settings: { size: 'medium' },
          },
          {
            id: 'block-video-01',
            type: 'video',
            order: 1,
            mediaReferences: {
              en: {
                embedUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
              },
            },
            settings: { autoplay: true, loop: false },
          },
        ],
        interaction: {
          type: 'tap_to_continue',
        },
      },
    ],
    settings: {
      autoPlay: false,
      loopForever: false,
      idleTimeoutSeconds: 120,
      autoReturnHome: true,
      hideNavigation: false,
      disableExit: false,
      security: {
        protectionType: 'signed_url',
        expiresAt: new Date(Date.now() + 86400000 * 7),
      },
    },
    publishing: {
      status: 'published',
      version: 1,
      publishedAt: new Date(),
    },
    createdBy: adminUser._id,
  };

  const kioskJourney = new KioskJourneyModel(journeyData);
  await kioskJourney.save();
  console.log(`✅ Seeded Published KioskJourney: "${kioskJourney.title}" (journeyCode: kiosk-jrn-01, id: ${kioskJourney._id})`);

  // Generate Valid HMAC-SHA256 Signed URL Parameters
  const journeyCode = 'kiosk-jrn-01';
  const orgParam = org._id.toString();
  const futureExp = Math.floor(Date.now() / 1000) + 7200; // 2 hours in the future
  const validSig = securityService.generateSignature(journeyCode, orgParam, futureExp, secret);

  console.log('\n--- Cryptographic HMAC-SHA256 Signature Generated ---');
  console.log(`Journey Identifier: ${journeyCode}`);
  console.log(`Organization ID:    ${orgParam}`);
  console.log(`Expiration:         ${futureExp}`);
  console.log(`HMAC-SHA256 Hash:   ${validSig}`);

  // Test 1: Happy Path - Unauthenticated Frontline Worker Access with Valid Signed URL
  console.log('\n--- Test 1: Happy Path - Unauthenticated Access via Valid Signed URL ---');
  const validUrl = `${API_BASE}/kiosk/journeys/play/${journeyCode}?o=${orgParam}&exp=${futureExp}&sig=${validSig}`;
  console.log(`GET ${validUrl}`);
  
  const validRes = await fetch(validUrl);
  const validBody = await validRes.json();
  console.log(`Status: ${validRes.status}`);

  if (validRes.status !== 200) {
    throw new Error(`Expected HTTP 200 OK for valid signed URL, got ${validRes.status}: ${JSON.stringify(validBody)}`);
  }
  if (!validBody.success || !validBody.data) {
    throw new Error(`Expected success: true and data object in response, got: ${JSON.stringify(validBody)}`);
  }
  if (validBody.data.journeyCode !== 'kiosk-jrn-01' && validBody.data.title !== journeyData.title) {
    throw new Error(`Mismatch in returned journey: ${validBody.data.title}`);
  }
  console.log(`✅ Happy Path Passed: Loaded journey "${validBody.data.title}" with ${validBody.data.steps?.length} steps without authentication.`);

  // Test 2: Negative Test - Tampered Signature
  console.log('\n--- Test 2: Negative Test - Tampered Signature ---');
  const tamperedSig = validSig.substring(0, validSig.length - 1) + (validSig.endsWith('0') ? '1' : '0');
  const tamperedUrl = `${API_BASE}/kiosk/journeys/play/${journeyCode}?o=${orgParam}&exp=${futureExp}&sig=${tamperedSig}`;
  console.log(`GET ${tamperedUrl}`);

  const tamperedRes = await fetch(tamperedUrl);
  const tamperedBody = await tamperedRes.json();
  console.log(`Status: ${tamperedRes.status}`);

  if (tamperedRes.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden for tampered signature, got ${tamperedRes.status}: ${JSON.stringify(tamperedBody)}`);
  }
  console.log(`✅ Negative Test 1 Passed: Tampered signature blocked with 403 Forbidden (${tamperedBody.code || tamperedBody.error})`);

  // Test 3: Negative Test - Expired Signature
  console.log('\n--- Test 3: Negative Test - Expired Signature ---');
  const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour in the past
  const expiredSig = securityService.generateSignature(journeyCode, orgParam, pastExp, secret);
  const expiredUrl = `${API_BASE}/kiosk/journeys/play/${journeyCode}?o=${orgParam}&exp=${pastExp}&sig=${expiredSig}`;
  console.log(`GET ${expiredUrl}`);

  const expiredRes = await fetch(expiredUrl);
  const expiredBody = await expiredRes.json();
  console.log(`Status: ${expiredRes.status}`);

  if (expiredRes.status !== 401) {
    throw new Error(`Expected HTTP 401 Unauthorized for expired signature, got ${expiredRes.status}: ${JSON.stringify(expiredBody)}`);
  }
  console.log(`✅ Negative Test 2 Passed: Expired signature blocked with 401 Unauthorized (${expiredBody.code || expiredBody.error})`);

  // Test 4: Authorization Boundary Test - Signed URL query parameters cannot access admin endpoints
  console.log('\n--- Test 4: Authorization Boundary Test - Admin Route Isolation ---');
  const adminAttemptUrl = `${API_BASE}/kiosk/journeys?o=${orgParam}&exp=${futureExp}&sig=${validSig}`;
  const adminRes = await fetch(adminAttemptUrl);
  console.log(`GET ${adminAttemptUrl} status: ${adminRes.status}`);
  if (adminRes.status !== 401) {
    throw new Error(`Expected HTTP 401 Unauthorized when signed URL parameters access admin routes, got ${adminRes.status}`);
  }
  console.log('✅ Authorization Test Passed: Signed URL parameters cannot bypass admin authentication.');

  // Test 5: Also test with direct MongoDB ID to ensure full interoperability
  console.log('\n--- Test 5: ObjectId Interoperability Test ---');
  const mongoId = kioskJourney._id.toString();
  const mongoSig = securityService.generateSignature(mongoId, orgParam, futureExp, secret);
  const mongoUrl = `${API_BASE}/kiosk/journeys/play/${mongoId}?o=${orgParam}&exp=${futureExp}&sig=${mongoSig}`;
  const mongoRes = await fetch(mongoUrl);
  if (mongoRes.status !== 200) {
    throw new Error(`Expected HTTP 200 OK for ObjectId signed URL, got ${mongoRes.status}`);
  }
  console.log('✅ ObjectId Interoperability Passed: Both journeyCode and ObjectId URLs operate reliably.');

  console.log('\n--- Test Configuration for UI Verification in Browser ---');
  const uiUrl = `http://localhost:5173/kiosk/play/${journeyCode}?o=${orgParam}&exp=${futureExp}&sig=${validSig}`;
  console.log(`Frontend URL: ${uiUrl}`);

  await mongoose.disconnect();
  console.log('\n========================================================================');
  console.log('=== UJ-KSK-002 AUTOMATED API & SECURITY SUITE: ALL TESTS PASSED ===');
  console.log('========================================================================\n');

  return { uiUrl, journeyCode, orgParam, futureExp, validSig };
}

runUJKSK002Tests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
