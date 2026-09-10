import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../modules/organizations/models/organization.model.js';
import User from '../modules/auth/models/user.model.js';
import AuditLog from '../modules/audit-logs/models/audit-log.model.js';
import { hashPassword } from '../utils/crypto.js';

dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJSUP002Tests() {
  console.log('========================================================================');
  console.log('=== RUNNING JOURNEY TEST UJ-SUP-002: Manage Tenants & Subscriptions ===');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const superAdminEmail = 'superadmin@talnova.test';
  const ownerEmail = 'regular_owner@talnova.test';
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);

  console.log('Step 0: Initializing test environment and target tenant (org-test-01)...');

  // Ensure Base Org for Users
  let baseOrg = await Organization.findOne({ slug: 'talnova-hq', isDeleted: false });
  if (!baseOrg) {
    baseOrg = new Organization({
      name: 'Talnova HQ',
      slug: 'talnova-hq',
      domain: 'talnova.test',
      plan: 'Enterprise',
      status: 'Active',
      supportEmail: 'support@talnova.test',
      createdBy: new mongoose.Types.ObjectId()
    });
    await baseOrg.save();
  }

  // Ensure Super Admin
  let superAdmin = await User.findOne({ 'auth.email': superAdminEmail });
  if (!superAdmin) {
    superAdmin = new User({
      organizationId: baseOrg._id,
      auth: { email: superAdminEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Super', lastName: 'Admin', fullName: 'Super Admin' },
      employment: { status: 'active', employmentType: 'full_time' },
      permissions: { role: 'super_admin', customRoles: [] }
    });
    await superAdmin.save();
  } else {
    superAdmin.auth.passwordHash = passwordHash;
    superAdmin.permissions.role = 'super_admin';
    await superAdmin.save();
  }

  // Ensure Regular Owner for Authorization Testing
  let regularOwner = await User.findOne({ 'auth.email': ownerEmail });
  if (!regularOwner) {
    regularOwner = new User({
      organizationId: baseOrg._id,
      auth: { email: ownerEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Regular', lastName: 'Owner', fullName: 'Regular Owner' },
      employment: { status: 'active', employmentType: 'full_time' },
      permissions: { role: 'owner', customRoles: [] }
    });
    await regularOwner.save();
  }

  // Seed / Reset Target Organization: org-test-01
  const targetSlug = 'org-test-01';
  let targetOrg = await Organization.findOne({ slug: targetSlug });
  if (targetOrg) {
    targetOrg.name = 'Acme Logistics Test';
    targetOrg.plan = 'Professional';
    targetOrg.subscription = {
      plan: 'Professional',
      status: 'active',
      seatLimit: 50,
      billingCycle: 'monthly'
    };
    targetOrg.limits = {
      maxUsers: 50,
      maxStorageGb: 10
    };
    targetOrg.status = 'Active';
    targetOrg.isDeleted = false;
    await targetOrg.save();
  } else {
    targetOrg = new Organization({
      name: 'Acme Logistics Test',
      slug: targetSlug,
      domain: 'acmelogistics.test',
      plan: 'Professional',
      subscription: {
        plan: 'Professional',
        status: 'active',
        seatLimit: 50,
        billingCycle: 'monthly'
      },
      limits: {
        maxUsers: 50,
        maxStorageGb: 10
      },
      status: 'Active',
      supportEmail: 'billing@acmelogistics.test',
      createdBy: superAdmin._id
    });
    await targetOrg.save();
  }

  // Login helper
  async function login(email: string): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
    }
    return data.data.accessToken;
  }

  console.log('Authenticating test users...');
  const superAdminToken = await login(superAdminEmail);
  const ownerToken = await login(ownerEmail);
  console.log('✅ Authenticated successfully.');

  // =========================================================================
  // 1. Authorization Tests
  // =========================================================================
  console.log('\n--- Test Phase 1: Authorization Boundary (Non-SuperAdmin Rejection) ---');
  const unauthAttempt = await fetch(`${API_BASE}/super-admin/organizations/${targetSlug}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      plan: 'Enterprise',
      seatQuota: 1000
    })
  });
  console.log(`[Auth Check - Tenant Owner] Status: ${unauthAttempt.status}`);
  if (unauthAttempt.status === 403) {
    console.log('✅ PASS: Organization owner strictly rejected with HTTP 403 Forbidden.');
  } else {
    throw new Error(`AUTHORIZATION_FAILURE: Expected 403 Forbidden, received ${unauthAttempt.status}`);
  }

  // =========================================================================
  // 2. Starting State Verification (GET /organizations)
  // =========================================================================
  console.log('\n--- Test Phase 2: Starting State Verification ---');
  const getOrgsRes = await fetch(`${API_BASE}/super-admin/organizations?search=${targetSlug}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  const getOrgsData = await getOrgsRes.json();
  console.log(`[GET /organizations] Status: ${getOrgsRes.status}`);

  if (getOrgsRes.status !== 200 || !getOrgsData.success) {
    throw new Error(`GET /organizations failed: ${JSON.stringify(getOrgsData)}`);
  }
  const locatedOrg = getOrgsData.data.data.find((o: any) => o.slug === targetSlug);
  if (!locatedOrg) {
    throw new Error(`Tenant ${targetSlug} not located in roster`);
  }
  console.log(`✅ Located tenant row ${targetSlug}: Plan=${locatedOrg.plan}, Seats=${locatedOrg.seatLimit}`);

  // =========================================================================
  // 3. Negative Tests (Negative Seat Quota)
  // =========================================================================
  console.log('\n--- Test Phase 3: Negative Test - Negative Seat Quota Rejection ---');
  const negativeQuotaRes = await fetch(`${API_BASE}/super-admin/organizations/${targetSlug}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      seatQuota: -50
    })
  });
  const negativeQuotaData = await negativeQuotaRes.json();
  console.log(`[Negative Seat Quota Network Log] Status: ${negativeQuotaRes.status}`, negativeQuotaData);

  if (negativeQuotaRes.status === 400 && (negativeQuotaData.code === 'INVALID_SEAT_QUOTA' || negativeQuotaData.message?.includes('non-negative'))) {
    console.log(`✅ PASS: Schema validation flagged error for negative seat quota (HTTP 400).`);
  } else {
    throw new Error(`Expected HTTP 400 Bad Request, got ${negativeQuotaRes.status}: ${JSON.stringify(negativeQuotaData)}`);
  }

  // =========================================================================
  // 4. Happy Path: Modify Subscription Plan & Seat Quota
  // =========================================================================
  console.log('\n--- Test Phase 4: Happy Path - Update Plan to Enterprise and Seat Limit to 500 ---');
  const patchRes = await fetch(`${API_BASE}/super-admin/organizations/${targetSlug}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      plan: 'Enterprise',
      seatQuota: 500
    })
  });
  const patchData = await patchRes.json();
  console.log(`[PATCH /super-admin/organizations/${targetSlug}] Status: ${patchRes.status}`, patchData);

  if (patchRes.status !== 200 || !patchData.success) {
    throw new Error(`PATCH request failed with status ${patchRes.status}: ${JSON.stringify(patchData)}`);
  }
  if (patchData.data.plan !== 'Enterprise') {
    throw new Error(`Expected plan Enterprise, got ${patchData.data.plan}`);
  }
  if (patchData.data.limits?.maxUsers !== 500 && patchData.data.seatLimit !== 500) {
    throw new Error(`Expected seat limit 500, got ${patchData.data.seatLimit || patchData.data.limits?.maxUsers}`);
  }
  console.log('✅ PASS: API returned updated organization data with Enterprise plan and 500 seats.');

  // =========================================================================
  // 5. Data Integrity Checks in MongoDB
  // =========================================================================
  console.log('\n--- Test Phase 5: MongoDB Data Integrity Checks ---');
  const dbOrg = await Organization.findOne({ slug: targetSlug });
  if (!dbOrg) {
    throw new Error(`Tenant ${targetSlug} not found in MongoDB`);
  }

  console.log('Inspecting MongoDB Organization document:', {
    slug: dbOrg.slug,
    plan: dbOrg.plan,
    'subscription.plan': dbOrg.subscription?.plan,
    'limits.maxUsers': dbOrg.limits?.maxUsers
  });

  if (dbOrg.plan !== 'Enterprise') {
    throw new Error(`MongoDB Organization.plan mismatch: expected Enterprise, got ${dbOrg.plan}`);
  }
  if (dbOrg.subscription?.plan !== 'Enterprise') {
    throw new Error(`MongoDB Organization.subscription.plan mismatch: expected Enterprise, got ${dbOrg.subscription?.plan}`);
  }
  if (dbOrg.limits?.maxUsers !== 500) {
    throw new Error(`DATA_INTEGRITY_FAILURE: MongoDB Organization.limits.maxUsers expected 500, got ${dbOrg.limits?.maxUsers}`);
  }
  console.log('✅ PASS: Data integrity confirmed: Organization.subscription.plan == "Enterprise" and Organization.limits.maxUsers == 500.');

  // =========================================================================
  // 6. Alternative Path: Change Tenant Status (active -> suspended -> active)
  // =========================================================================
  console.log('\n--- Test Phase 6: Alternative Path - Tenant Status Toggle ---');
  const suspendRes = await fetch(`${API_BASE}/super-admin/organizations/${targetSlug}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ status: 'Suspended' })
  });
  const suspendData = await suspendRes.json();
  console.log(`[Suspend Network Log] Status: ${suspendRes.status}`, suspendData.data?.status);

  if (suspendRes.status !== 200 || suspendData.data?.status !== 'Suspended') {
    throw new Error(`Failed to suspend tenant: ${JSON.stringify(suspendData)}`);
  }

  const suspendedDbOrg = await Organization.findOne({ slug: targetSlug });
  if (suspendedDbOrg?.status !== 'Suspended') {
    throw new Error(`MongoDB status not updated to Suspended: ${suspendedDbOrg?.status}`);
  }
  console.log('✅ PASS: Tenant status updated to Suspended in MongoDB.');

  // Restore back to Active
  const activateRes = await fetch(`${API_BASE}/super-admin/organizations/${targetSlug}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ status: 'Active' })
  });
  const activateData = await activateRes.json();
  if (activateRes.status === 200 && activateData.data?.status === 'Active') {
    console.log('✅ PASS: Tenant status reactivated to Active.');
  }

  console.log('\n========================================================================');
  console.log('=== ALL UJ-SUP-002 BACKEND & INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===');
  console.log('========================================================================');

  await mongoose.disconnect();
}

runUJSUP002Tests().catch((err) => {
  console.error('\n❌ UJ-SUP-002 TEST RUN FAILED:', err);
  process.exit(1);
});
