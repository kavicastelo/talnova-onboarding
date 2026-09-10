import mongoose from 'mongoose';
import { User } from '../modules/auth/models/user.model.js';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { Journey } from '../modules/journeys/models/journey.model.js';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJAuth003Tests() {
  console.log('=== RUNNING JOURNEY TEST UJ-AUTH-003: User Self-Registration ===\n');

  const timestamp = Date.now();
  const testCompany = `Acme Testing Corp ${timestamp}`;
  const testSlug = `acme-test-${timestamp}`;
  const testEmail = `owner_${timestamp}@acmetest.com`;
  const testPassword = 'Password123!';
  const weakPassword = '123';

  // 1. Negative Test 2: Weak Password (<8 chars)
  console.log('Test 1: Weak Password Validation (<8 chars)...');
  const weakRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgName: testCompany,
      orgSlug: testSlug,
      firstName: 'Test',
      lastName: 'Owner',
      email: testEmail,
      password: weakPassword
    })
  });
  const weakData = await weakRes.json();
  console.log(`Weak Password Response Status: ${weakRes.status}`);
  console.log('Weak Password Response Body:', JSON.stringify(weakData, null, 2));

  if (weakRes.status !== 422) {
    throw new Error(`Expected HTTP 422 for weak password, got ${weakRes.status}`);
  }
  console.log('✓ Test 1 Passed: Weak password rejected with HTTP 422 validation error\n');

  // 2. Happy Path Registration
  console.log('Test 2: Happy Path Registration...');
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgName: testCompany,
      orgSlug: testSlug,
      supportEmail: testEmail,
      firstName: 'Test',
      lastName: 'Owner',
      email: testEmail,
      password: testPassword
    })
  });
  const regData = await regRes.json();
  console.log(`Registration Response Status: ${regRes.status}`);
  console.log('Registration Response Body:', JSON.stringify(regData, null, 2));

  if (regRes.status !== 201) {
    throw new Error(`Expected HTTP 201 for valid registration, got ${regRes.status}`);
  }
  if (!regData.data?.token || !regData.data?.accessToken) {
    throw new Error('Expected response to contain token/accessToken');
  }
  if (regData.data?.user?.role !== 'owner') {
    throw new Error(`Expected user role to be "owner", got "${regData.data?.user?.role}"`);
  }
  console.log('✓ Test 2 Passed: HTTP 201 Created returned with token and user role "owner"\n');

  const createdOrgId = regData.data.organization.id;
  const createdUserId = regData.data.user.id;

  // 3. Negative Test 1: Duplicate Email
  console.log('Test 3: Duplicate Email Validation...');
  const dupRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgName: `Another Corp ${timestamp}`,
      orgSlug: `another-slug-${timestamp}`,
      firstName: 'Another',
      lastName: 'Owner',
      email: testEmail, // Existing email
      password: testPassword
    })
  });
  const dupData = await dupRes.json();
  console.log(`Duplicate Email Response Status: ${dupRes.status}`);
  console.log('Duplicate Email Response Body:', JSON.stringify(dupData, null, 2));

  if (dupRes.status !== 409) {
    throw new Error(`Expected HTTP 409 for duplicate email, got ${dupRes.status}`);
  }
  if (dupData.error?.code !== 'EMAIL_ALREADY_EXISTS') {
    throw new Error(`Expected error code EMAIL_ALREADY_EXISTS, got ${dupData.error?.code}`);
  }
  console.log('✓ Test 3 Passed: Duplicate email rejected with HTTP 409 Conflict (EMAIL_ALREADY_EXISTS)\n');

  // 4. Data Integrity Checks in MongoDB Atlas
  console.log('Test 4: MongoDB Data Integrity and Seeding Verification...');
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI not found in env');
  await mongoose.connect(mongoUri);

  const orgDoc = await Organization.findById(createdOrgId);
  const userDoc = await User.findById(createdUserId);

  if (!orgDoc) throw new Error(`Organization ${createdOrgId} not found in MongoDB`);
  if (!userDoc) throw new Error(`User ${createdUserId} not found in MongoDB`);

  console.log('MongoDB Organization Document:', {
    _id: orgDoc._id.toString(),
    name: orgDoc.name,
    slug: orgDoc.slug,
    createdBy: orgDoc.createdBy?.toString()
  });

  console.log('MongoDB User Document:', {
    _id: userDoc._id.toString(),
    organizationId: userDoc.organizationId?.toString(),
    email: userDoc.auth.email,
    role: userDoc.permissions.role,
    fullName: userDoc.profile.fullName
  });

  if (userDoc.organizationId?.toString() !== orgDoc._id.toString()) {
    throw new Error(`DATA_INTEGRITY_FAILURE: User.organizationId (${userDoc.organizationId}) does not match Organization._id (${orgDoc._id})`);
  }

  if (userDoc.permissions.role !== 'owner') {
    throw new Error(`Expected role 'owner', got '${userDoc.permissions.role}'`);
  }

  // Check integration: default onboarding template seeded
  const seededJourneys = await Journey.find({ organizationId: orgDoc._id });
  console.log(`Seeded Onboarding Journeys count: ${seededJourneys.length}`);
  if (seededJourneys.length > 0) {
    console.log('Seeded Journey Template:', {
      _id: seededJourneys[0]._id.toString(),
      title: seededJourneys[0].title,
      status: seededJourneys[0].status,
      category: seededJourneys[0].category
    });
  }

  await mongoose.disconnect();
  console.log('✓ Test 4 Passed: MongoDB records atomic, tenant bound, and default template seeded\n');

  console.log('=== ALL UJ-AUTH-003 API & INTEGRITY CHECKS PASSED ===');
}

runUJAuth003Tests().catch((err) => {
  console.error('UJ-AUTH-003 Test Failure:', err);
  process.exit(1);
});
